/**
 * The Postgres adapter for the storage port.
 *
 * Entities are assembled from the three tables on read and written back one
 * card per type, because that is what makes `sparse by default` real: a type
 * whose fields are all empty has no row at all.
 */

import type { Pool } from 'pg';
import { isTableRole } from '@nw/model';
import type { Entity, InterfaceDef, Registry, Relation, RelationDef, TableRole } from '@nw/model';
import { RevisionConflict } from './repo.js';
import type { EventFilter, LayerGrant, ListFilterRow, PutOptions, ReadyStand, Repository, SessionRow, StoredEvent, StoredUser } from './repo.js';
import type { ApiToken, Invite, TokenScope, User } from './auth.js';

type Row = Record<string, unknown>;

export class PgRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  async getRegistry(): Promise<Registry> {
    const [interfaces, relations, views, units, vars, enums, settings] = await Promise.all([
      this.pool.query<Row>('select * from interface_def'),
      this.pool.query<Row>('select * from relation_def'),
      this.pool.query<Row>('select * from view_def order by ord'),
      this.pool.query<Row>('select * from unit_def'),
      this.pool.query<Row>('select * from var_def'),
      this.pool.query<Row>('select * from enum_def'),
      this.pool.query<Row>('select * from setting_def'),
    ]);

    const registry: Registry = { interfaces: {}, relations: {}, views: {}, units: {}, vars: {} };

    for (const r of interfaces.rows) {
      registry.interfaces[r['name'] as string] = {
        name: r['name'] as string,
        label: (r['label'] as string) ?? undefined,
        abstract: Boolean(r['abstract']),
        extends: (r['extends'] as string[]) ?? [],
        schema: (r['schema'] as InterfaceDef['schema']) ?? undefined,
        area: (r['area'] as InterfaceDef['area']) ?? undefined,
        units: (r['units'] as InterfaceDef['units']) ?? undefined,
        /* Die Anordnung wohnt am Typ (D28): eine Kreatur ordnet ihre `full`
           anders als ein Rezept, und das steht bei der Kreatur. */
        views: (r['views'] as InterfaceDef['views']) ?? undefined,
        /* Wie ein geerbtes Feld an dieser Art heisst. */
        titles: (r['titles'] as InterfaceDef['titles']) ?? undefined,
        /* Wohin ein geerbtes Feld an dieser Art zeigt (T-119). */
        targets: (r['targets'] as InterfaceDef['targets']) ?? undefined,
      };
    }
    for (const r of relations.rows) {
      registry.relations[r['type'] as string] = {
        type: r['type'] as string,
        label: r['label'] as string,
        inverseLabel: r['inverse_label'] as string,
        from: (r['from_ifaces'] as string[]) ?? ['*'],
        to: (r['to_ifaces'] as string[]) ?? ['*'],
        owned: Boolean(r['owned']),
        cardinality: (r['cardinality'] as 'one' | 'many') ?? 'many',
        section: (r['section'] as string) ?? undefined,
        /* An welchem Ende sie sich wie ein Feld liest (Migration 022). */
        asField: (r['as_field'] as RelationDef['asField']) ?? undefined,
        /* Was sie bedeutet und bewirken soll (T-111, Migration 045). */
        means: (r['means'] as string | null) ?? undefined,
        intended: (r['intended'] as string | null) ?? undefined,
        /* Als Filter in der Liste (T-174): `false` oder `{label, order}`. */
        ...(r['facet'] !== null && r['facet'] !== undefined ? { facet: r['facet'] as RelationDef['facet'] } : {}),
        /* Was die Kante selbst trägt — geschrieben wurde es immer, gelesen
           bis zur Migration 022 nie. Ein leeres Schema ist keines. */
        props: Object.keys((r['props'] as { properties?: object } | null)?.properties ?? {}).length
          ? (r['props'] as RelationDef['props'])
          : undefined,
      };
    }
    for (const r of views.rows) {
      registry.views[r['key'] as string] = {
        ...(r['config'] as object),
        label: r['label'] as string,
        order: r['ord'] as number,
      } as Registry['views'][string];
    }
    /* Einheiten sind Zeilen wie alles andere: `base` sagt, wie viel eine
       davon in der Grundeinheit ihrer Grösse ist. */
    for (const r of units.rows) {
      registry.units[r['code'] as string] = {
        code: r['code'] as string,
        label: r['label'] as string,
        quantity: r['quantity'] as string,
        system: r['system'] as 'imperial' | 'metric',
        base: Number(r['base']),
        aliases: (r['aliases'] as string[]) ?? [],
        decimals: r['decimals'] == null ? undefined : Number(r['decimals']),
      };
    }
    for (const r of vars.rows) registry.vars[r['name'] as string] = r['value'] as string;
    /* Aufzählungen und Einstellungen (Migration 019): ohne sie bleiben
       Auswahllisten leer und jede Einstellung gilt mit ihrer Vorgabe. */
    if (enums.rows.length) {
      registry.enums = {};
      for (const r of enums.rows) {
        registry.enums[r['name'] as string] = { ...(r['config'] as object), name: r['name'] as string } as NonNullable<Registry['enums']>[string];
      }
    }
    if (settings.rows.length) {
      registry.settings = {};
      for (const r of settings.rows) registry.settings[r['key'] as string] = r['value'] as string;
    }

    return registry;
  }

  async putRegistryPart<K extends keyof Registry>(part: K, value: Registry[K]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (part === 'interfaces') {
        await client.query('delete from interface_def');
        for (const [name, def] of Object.entries(value as Registry['interfaces'])) {
          await client.query(
            `insert into interface_def(name,label,abstract,extends,schema,area,views,units,titles,targets)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [name, def.label ?? null, def.abstract ?? false,
             def.extends ?? [],
             def.schema ? JSON.stringify(def.schema) : null,
             def.area ?? null, def.views ? JSON.stringify(def.views) : null,
             def.units ?? null, def.titles ? JSON.stringify(def.titles) : null,
             def.targets ? JSON.stringify(def.targets) : null],
          );
        }
      } else if (part === 'relations') {
        await client.query('delete from relation_def');
        for (const [type, def] of Object.entries(value as Registry['relations'])) {
          await client.query(
            `insert into relation_def(type,label,inverse_label,from_ifaces,to_ifaces,owned,cardinality,section,props,as_field,means,intended)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [type, def.label, def.inverseLabel, def.from ?? ['*'], def.to ?? ['*'],
             def.owned ?? false, def.cardinality ?? 'many', def.section ?? null,
             JSON.stringify(def.props ?? {}), def.asField ?? null, def.means ?? null, def.intended ?? null],
          );
          /* `facet` (T-174, Migration 074) nur, wo eine Kante es sagt — so
             schreibt dieselbe Zeile auch in eine Datenbank vor 073. */
          if (def.facet !== undefined) {
            await client.query('update relation_def set facet = $2 where type = $1', [type, JSON.stringify(def.facet)]);
          }
        }
      } else if (part === 'views') {
        await client.query('delete from view_def');
        for (const [key, def] of Object.entries(value as Registry['views'])) {
          await client.query('insert into view_def(key,label,ord,config) values ($1,$2,$3,$4)', [
            key, def.label, def.order ?? 99, JSON.stringify(def),
          ]);
        }
      } else if (part === 'units') {
        await client.query('delete from unit_def');
        for (const [code, def] of Object.entries(value as Registry['units'])) {
          await client.query(
            `insert into unit_def(code,label,quantity,system,base,aliases,decimals)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [code, def.label, def.quantity, def.system, def.base,
             def.aliases ?? [], def.decimals ?? null],
          );
        }
      } else if (part === 'vars') {
        await client.query('delete from var_def');
        for (const [name, v] of Object.entries(value as Registry['vars'])) {
          await client.query('insert into var_def(name,value) values ($1,$2)', [name, v]);
        }
      } else if (part === 'enums') {
        await client.query('delete from enum_def');
        for (const [name, def] of Object.entries((value ?? {}) as NonNullable<Registry['enums']>)) {
          await client.query('insert into enum_def(name,config) values ($1,$2)', [name, JSON.stringify(def)]);
        }
      } else if (part === 'settings') {
        await client.query('delete from setting_def');
        for (const [key, v] of Object.entries((value ?? {}) as NonNullable<Registry['settings']>)) {
          await client.query('insert into setting_def(key,value) values ($1,$2)', [key, String(v)]);
        }
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Der ganze Bestand in drei Abfragen, nicht in dreien je Artikel.
   *
   * Bis zum 13.10. holte das jeden Artikel über `getEntity` — bei 24 157
   * Artikeln aus 5e.tools gut 72 000 Abfragen, und die Liste wird je
   * Anfrage zweimal gebraucht (Sieb und Antwort). Die Seite blieb leer,
   * weil die Antwort nicht kam. Gelesen wird in einer Transaktion, damit die
   * drei Abfragen denselben Stand sehen: ein Artikel, der dazwischen
   * geschrieben wird, stünde sonst ohne seine Karten da.
   */
  async listEntities(): Promise<Entity[]> {
    const stempel = await this.stempel();
    if (this.bestand?.stempel === stempel) return [...this.bestand.liste];
    if (this.laedt?.stempel !== stempel) {
      const lauf = this.ladeBestand().then((liste) => {
        this.bestand = { stempel, liste };
        return liste;
      });
      this.laedt = { stempel, lauf };
      /* Ein Fehlschlag bleibt nicht als Antwort für alle Späteren liegen. */
      lauf.catch(() => undefined).finally(() => {
        if (this.laedt?.lauf === lauf) this.laedt = null;
      });
    }
    return [...(await this.laedt!.lauf)];
  }

  /**
   * Woran man sieht, dass sich der Bestand geändert hat: wie viele Artikel
   * es gibt und wann zuletzt einer geschrieben wurde. Jedes Schreiben geht
   * durch `putEntity` und setzt `updated_at`; ein Löschen ändert die Zahl.
   * Gefragt wird die Datenbank und nicht ein Merker im Prozess, denn die
   * Einfuhr läuft als eigener Prozess (`import.js`) und schreibt an diesem
   * Server vorbei.
   */
  async version(): Promise<string> {
    return this.stempel();
  }

  private static readonly STEMPEL = `select count(*)::text || '/' || coalesce(max(updated_at)::text, '') as s from entity`;

  private async stempel(): Promise<string> {
    const { rows } = await this.pool.query<Row>(PgRepository.STEMPEL);
    return String(rows[0]?.['s'] ?? '');
  }

  /**
   * Der gelesene Bestand, solange sich nichts geändert hat (`stempel`).
   *
   * Jede Anfrage braucht den ganzen Bestand — das Sieb fragt Stapel,
   * Vorlagen und Wissen über alle Artikel, auch wenn nur einer geöffnet
   * wird. Mit den 24 157 Artikeln aus 5e.tools hiess das je Anfrage gut eine
   * Sekunde Datenbank, auf dem kleinen Server mehrere, und eine Artikelseite
   * stellt zwei Anfragen. Die Artikel darin werden geteilt und **nicht
   * verändert** — wer einen ändern will, baut einen neuen (`readInstance`,
   * `redactEntity`, `detachInstance` tun das schon). Das Feld ist eine
   * Kopie, damit niemand die Liste selbst umstellt.
   */
  private bestand: { stempel: string; liste: Entity[] } | null = null;
  /** Ein Lesen, das gerade läuft — zwei gleichzeitige Anfragen lesen einmal. */
  private laedt: { stempel: string; lauf: Promise<Entity[]> } | null = null;

  private async ladeBestand(): Promise<Entity[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin isolation level repeatable read read only');
      const base = await client.query<Row>('select * from entity order by created_at');
      const components = await client.query<Row>('select entity_id, type, payload from component');
      const relations = await client.query<Row>(
        'select from_id, id, type, to_id, props from relation order by from_id, ord nulls last',
      );
      await client.query('commit');
      const kartenVon = new Map<string, Row[]>();
      for (const r of components.rows) {
        const id = r['entity_id'] as string;
        (kartenVon.get(id) ?? kartenVon.set(id, []).get(id)!).push(r);
      }
      const kantenVon = new Map<string, Row[]>();
      for (const r of relations.rows) {
        const id = r['from_id'] as string;
        (kantenVon.get(id) ?? kantenVon.set(id, []).get(id)!).push(r);
      }
      return base.rows.map((b) =>
        zusammensetzen(b, kartenVon.get(b['id'] as string) ?? [], kantenVon.get(b['id'] as string) ?? []),
      );
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async countEntities(): Promise<number> {
    const { rows } = await this.pool.query<Row>('select count(*)::int as n from entity');
    return Number(rows[0]?.['n'] ?? 0);
  }

  async getEntity(id: string): Promise<Entity | undefined> {
    const base = await this.pool.query<Row>('select * from entity where id = $1', [id]);
    if (!base.rows.length) return undefined;

    const [components, relations] = await Promise.all([
      this.pool.query<Row>('select type, payload from component where entity_id = $1', [id]),
      this.pool.query<Row>(
        'select id, type, to_id, props from relation where from_id = $1 order by ord nulls last',
        [id],
      ),
    ]);

    return zusammensetzen(base.rows[0]!, components.rows, relations.rows);
  }

  async putEntity(entity: Entity, options: PutOptions = {}): Promise<Entity> {
    const gehalten = this.bestand;
    this.bestand = null;
    /* **Nachführen statt neu lesen** (T-143): wer einen Artikel schreibt,
       weiss, was sich geändert hat. Bis hierher warf jedes Schreiben den
       gehaltenen Bestand weg, und die nächste Anfrage las ihn ganz neu —
       nach einem Häkchen an der Ebenenliste mehrere Sekunden, bei gut
       150 000 Artikeln. Nachgeführt wird nur, wenn der Bestand **genau**
       auf dem Stand vor diesem Schreiben war: die Tabelle ist dafür für
       andere Schreiber gesperrt (Lesen geht weiter), und der Stempel wird
       vorher und nachher in derselben Transaktion gelesen. Stimmt etwas
       nicht, bleibt es beim Neulesen. */
    let nachher: string | null = null;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      /* **Die Tabelle zuerst, für jedes Schreiben** (REQ-192): sperrte nur,
         wer den Bestand hält, nahm ein zweites Schreiben derselben Zeile
         erst die Zeile (`for update`) und wartete dann beim Einfügen auf
         die Tabelle, während das erste die Tabelle hielt und auf die Zeile
         wartete — Postgres brach eines ab (40P01), und es kam als 500
         statt 409 an. Dieselbe Reihenfolge überall hat keinen Kreis;
         Lesen geht weiter. */
      await client.query('lock table entity in share row exclusive mode');
      if (gehalten) {
        const { rows } = await client.query<Row>(PgRepository.STEMPEL);
        nachher = String(rows[0]?.['s'] ?? '') === gehalten.stempel ? '' : null;
      }
      /* Die Zeile gesperrt gelesen (REQ-192): zwei gleichzeitige Schreiben
         mit derselben Revision kommen sonst beide durch die Prüfung. Ein
         Artikel, der noch nicht steht, hat nichts zu sperren — zwei, die
         ihn gleichzeitig anlegen, trennt der Primärschlüssel. */
      if (options.expectRevision !== undefined) {
        const { rows } = await client.query<Row>(
          'select revision from entity where id = $1 for update',
          [entity.id],
        );
        const steht = rows.length ? Number(rows[0]!['revision']) : null;
        if (steht !== options.expectRevision) {
          throw new RevisionConflict(entity.id, options.expectRevision, steht);
        }
      }
      await client.query(
        options.expectRevision === null
          ? 'insert into entity(id) values ($1)'
          : `insert into entity(id) values ($1)
             on conflict (id) do update set updated_at = now(), revision = entity.revision + 1`,
        [entity.id],
      );

      await client.query('delete from component where entity_id = $1', [entity.id]);
      for (const [type, payload] of Object.entries(entity.components ?? {})) {
        await client.query(
          'insert into component(entity_id,type,payload) values ($1,$2,$3)',
          [entity.id, type, JSON.stringify(payload)],
        );
      }
      // Envelope fields with no card of their own ride in a reserved component.
      await client.query('insert into component(entity_id,type,payload) values ($1,$2,$3)', [
        entity.id,
        '__meta',
        JSON.stringify({
          interfaces: entity.interfaces,
          adhoc: entity.adhoc ?? [],
        }),
      ]);

      await client.query('delete from relation where from_id = $1', [entity.id]);
      let ord = 0;
      for (const relation of entity.relations ?? []) {
        await client.query(
          'insert into relation(id,from_id,to_id,type,props,ord) values ($1,$2,$3,$4,$5,$6)',
          [relation.id, entity.id, relation.to, relation.type,
           JSON.stringify(relation.props ?? {}), ord++],
        );
      }

      if (nachher !== null) {
        const { rows } = await client.query<Row>(PgRepository.STEMPEL);
        nachher = String(rows[0]?.['s'] ?? '');
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      /* Zwei legen denselben Artikel gleichzeitig an: der zweite ist zu spät. */
      if (options.expectRevision === null && (error as { code?: string }).code === '23505') {
        throw new RevisionConflict(entity.id, null, 1);
      }
      throw error;
    } finally {
      client.release();
    }

    const gespeichert = (await this.getEntity(entity.id)) as Entity;
    /* Nur, wenn seither niemand anders den Bestand gesetzt hat: ein
       gleichzeitiges Lesen oder Schreiben in diesem Prozess gewinnt. */
    if (gehalten && nachher && gespeichert && this.bestand === null) {
      const liste = [...gehalten.liste];
      const i = liste.findIndex((e) => e.id === entity.id);
      if (i >= 0) liste[i] = gespeichert;
      else liste.push(gespeichert);
      this.bestand = { stempel: nachher, liste };
    }
    return gespeichert;
  }

  async deleteEntity(id: string): Promise<boolean> {
    this.bestand = null;
    const { rowCount } = await this.pool.query('delete from entity where id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<string> {
    const { rows } = await this.pool.query<Row>(
      'insert into event_log(id,name,subject,payload) values (gen_random_uuid(),$1,$2,$3) returning id',
      [name, subject ?? null, JSON.stringify(payload ?? {})],
    );
    return String(rows[0]?.['id']);
  }

  private static toEvent(r: Row): StoredEvent {
    return {
      id: String(r['id']),
      name: String(r['name']),
      subject: (r['subject'] as string | null) ?? undefined,
      payload: r['payload'],
      at: new Date(r['at'] as string).toISOString(),
    };
  }

  async getEvent(id: string): Promise<StoredEvent | undefined> {
    const { rows } = await this.pool.query<Row>('select * from event_log where id = $1', [id]);
    return rows[0] ? PgRepository.toEvent(rows[0]) : undefined;
  }

  async listEvents(filter: EventFilter): Promise<StoredEvent[]> {
    /* `payload - 'changes'` am Server: die alten Fassungen einer
       Massenänderung sind Megabytes, und eine Liste braucht sie nicht. */
    const { rows } = await this.pool.query<Row>(
      `select id, name, subject, at, ${filter.light ? "payload - 'changes' as payload" : 'payload'}
         from event_log
        where ($1::text is null or name = $1) and ($2::text is null or subject = $2)
          and ($4::text[] is null or subject = any($4) or ($5::text is not null and payload->>$5 = $6))
        order by at desc limit $3 offset $7`,
      [
        filter.name ?? null,
        filter.subject ?? null,
        filter.limit ?? 50,
        filter.subjects ?? null,
        filter.orPayload?.key ?? null,
        filter.orPayload?.value ?? null,
        filter.offset ?? 0,
      ],
    );
    return rows.map((r) => PgRepository.toEvent(r));
  }

  // ------------------------------------------------------------- Zugang

  /* Die Figuren kommen aus der Verbundtabelle und werden hier
     hineingelegt. `array_agg` liefert `{null}` für ein Konto ohne Figur —
     das eine Element ist dann null und kein Name. */
  private static toUser(row: Row): StoredUser {
    const raw = (row['actor_ids'] as (string | null)[] | null) ?? [];
    return {
      id: String(row['id']),
      name: String(row['name']),
      passwordHash: String(row['password_hash']),
      isAdmin: row['is_admin'] === true,
      actorIds: raw.filter((x): x is string => typeof x === 'string' && x.length > 0),
      roles: PgRepository.rollen(row['roles']),
      authoredIds: ((row['authored_ids'] as (string | null)[] | null) ?? []).filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
      ),
      layerIds: ((row['layer_ids'] as (string | null)[] | null) ?? []).filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
      ),
      ownedLayerIds: ((row['owned_layer_ids'] as (string | null)[] | null) ?? []).filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
      ),
      disabledAt: row['disabled_at'] ? new Date(row['disabled_at'] as string).toISOString() : undefined,
      createdAt: row['created_at'] ? new Date(row['created_at'] as string).toISOString() : undefined,
    };
  }

  /** Was aus `campaign_member` kommt, und nur Rollen, die es gibt. Eine
   *  unbekannte bleibt draussen — eine Rolle zu raten hiesse, jemandem ein
   *  Geheimnis zu zeigen, weil ein Wort falsch geschrieben war. */
  private static rollen(raw: unknown): Record<string, TableRole> {
    const out: Record<string, TableRole> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (isTableRole(v)) out[k] = v;
    }
    return out;
  }

  /** Ein Konto samt seinen Figuren und Rollen. Als eigener Ausdruck, damit
   *  die vier Stellen, die Konten lesen, nicht viermal dasselbe `left join`
   *  schreiben — und dann eine davon anders.
   *
   *  Die Rollen als Unterabfrage und nicht als zweiter Join: zwei Joins
   *  multiplizierten die Zeilen, und jede Figur stünde so oft da, wie das
   *  Konto Kampagnen hat. */
  private static readonly USER_SELECT = `
    select u.*, array_agg(a.actor_id order by a.added_at) as actor_ids,
           (select coalesce(jsonb_object_agg(m.campaign_id, m.role), '{}'::jsonb)
              from campaign_member m where m.user_id = u.id) as roles,
           array(select w.entity_id from app_user_article w
                  where w.user_id = u.id order by w.added_at) as authored_ids,
           array(select g.layer_id from app_user_layer g
                  where g.user_id = u.id order by g.added_at) as layer_ids,
           array(select g.layer_id from app_user_layer g
                  where g.user_id = u.id and g.owner order by g.added_at) as owned_layer_ids
      from app_user u
      left join app_user_actor a on a.user_id = u.id`;

  private static toInvite(row: Row): Invite {
    return {
      codeHash: String(row['code_hash']),
      label: (row['label'] as string | null) ?? undefined,
      isAdmin: row['is_admin'] === true,
      actorId: (row['actor_id'] as string | null) ?? undefined,
      usesLeft: row['uses_left'] == null ? undefined : Number(row['uses_left']),
      expiresAt: row['expires_at'] ? new Date(row['expires_at'] as string).toISOString() : undefined,
      createdBy: (row['created_by'] as string | null) ?? undefined,
      createdAt: row['created_at'] ? new Date(row['created_at'] as string).toISOString() : undefined,
      campaignId: (row['campaign_id'] as string | null) ?? undefined,
      role: isTableRole(row['role']) ? row['role'] : undefined,
    };
  }

  async countUsers(): Promise<number> {
    const { rows } = await this.pool.query<Row>('select count(*)::int as n from app_user');
    return Number(rows[0]?.['n'] ?? 0);
  }

  async findUserByName(nameFold: string): Promise<StoredUser | undefined> {
    const { rows } = await this.pool.query<Row>(
      `${PgRepository.USER_SELECT} where u.name_fold = $1 group by u.id`,
      [nameFold],
    );
    return rows[0] ? PgRepository.toUser(rows[0]) : undefined;
  }

  async getUser(id: string): Promise<StoredUser | undefined> {
    const { rows } = await this.pool.query<Row>(
      `${PgRepository.USER_SELECT} where u.id = $1 group by u.id`,
      [id],
    );
    return rows[0] ? PgRepository.toUser(rows[0]) : undefined;
  }

  async listUsers(): Promise<User[]> {
    const { rows } = await this.pool.query<Row>(
      `${PgRepository.USER_SELECT} group by u.id order by u.name`,
    );
    return rows.map((r) => {
      const { passwordHash: _hash, ...rest } = PgRepository.toUser(r);
      return rest;
    });
  }

  async usersOfActor(actorId: string): Promise<User[]> {
    const { rows } = await this.pool.query<Row>(
      `${PgRepository.USER_SELECT}
        where u.id in (select user_id from app_user_actor where actor_id = $1)
        group by u.id order by u.name`,
      [actorId],
    );
    return rows.map((r) => {
      const { passwordHash: _hash, ...rest } = PgRepository.toUser(r);
      return rest;
    });
  }

  /* Was jemand angelegt hat (REQ-237). Eine Zeile je Konto und Artikel;
     ein zweites Anlegen derselben Zeile ändert nichts. */
  async addAuthored(userId: string, entityId: string): Promise<void> {
    await this.pool.query(
      `insert into app_user_article(user_id, entity_id) values ($1, $2) on conflict do nothing`,
      [userId, entityId],
    );
  }

  async authorsOf(entityId: string): Promise<string[]> {
    const { rows } = await this.pool.query<Row>(
      'select user_id from app_user_article where entity_id = $1 order by added_at',
      [entityId],
    );
    return rows.map((r) => String(r['user_id']));
  }

  async authoredArticles(): Promise<string[]> {
    const { rows } = await this.pool.query<Row>('select distinct entity_id from app_user_article');
    return rows.map((r) => String(r['entity_id']));
  }

  /* Wer in einer Ebene schreibt (T-098). Ein zweites Setzen ändert nur
     `owner`. */
  async grantLayer(userId: string, layerId: string, owner = false, campaign?: string): Promise<void> {
    await this.pool.query(
      `insert into app_user_layer(user_id, layer_id, owner, campaign_id) values ($1, $2, $3, $4)
       on conflict (user_id, layer_id) do update
         set owner = excluded.owner,
             campaign_id = coalesce(excluded.campaign_id, app_user_layer.campaign_id)`,
      [userId, layerId, owner, campaign ?? null],
    );
  }

  async revokeLayer(userId: string, layerId: string): Promise<boolean> {
    const res = await this.pool.query('delete from app_user_layer where user_id = $1 and layer_id = $2', [userId, layerId]);
    return (res.rowCount ?? 0) > 0;
  }

  async layerGrants(): Promise<LayerGrant[]> {
    const { rows } = await this.pool.query<Row>('select user_id, layer_id, owner, campaign_id from app_user_layer order by added_at');
    return rows.map((r) => ({
      userId: String(r['user_id']),
      layerId: String(r['layer_id']),
      owner: r['owner'] === true,
      ...(r['campaign_id'] ? { campaign: String(r['campaign_id']) } : {}),
    }));
  }

  /* Der letzte fertige Stand (REQ-237, E-012), als JSON-Kopie. Wenige
     Zeilen; gelesen wird alles auf einmal. */
  async readyStands(): Promise<Map<string, ReadyStand>> {
    const { rows } = await this.pool.query<Row>('select entity_id, data, ready_at from entity_ready');
    return new Map(
      rows.map((r) => [
        String(r['entity_id']),
        { entity: r['data'] as Entity, at: new Date(r['ready_at'] as string).toISOString() },
      ]),
    );
  }

  async keepReadyStand(stand: ReadyStand): Promise<void> {
    await this.pool.query(
      `insert into entity_ready(entity_id, data, ready_at) values ($1, $2, $3) on conflict do nothing`,
      [stand.entity.id, JSON.stringify(stand.entity), stand.at],
    );
  }

  async dropReadyStand(entityId: string): Promise<void> {
    await this.pool.query('delete from entity_ready where entity_id = $1', [entityId]);
  }

  async transferBase(peer: string, keys?: Iterable<string>): Promise<Map<string, unknown>> {
    const liste = keys ? [...keys] : null;
    const { rows } = liste
      ? await this.pool.query<Row>('select key, value from transfer_base where peer = $1 and key = any($2)', [peer, liste])
      : await this.pool.query<Row>('select key, value from transfer_base where peer = $1', [peer]);
    return new Map(rows.map((r) => [String(r['key']), r['value']]));
  }

  async keepTransferBase(peer: string, rows: { key: string; value: unknown }[]): Promise<void> {
    if (!rows.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const r of rows) {
        if (r.value === null || r.value === undefined) {
          await client.query('delete from transfer_base where peer = $1 and key = $2', [peer, r.key]);
        } else {
          await client.query(
            `insert into transfer_base(peer, key, value, at) values ($1, $2, $3, now())
             on conflict (peer, key) do update set value = excluded.value, at = excluded.at`,
            [peer, r.key, JSON.stringify(r.value)],
          );
        }
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async clearTransferBase(peer: string): Promise<void> {
    await this.pool.query('delete from transfer_base where peer = $1', [peer]);
  }

  async readingPosition(userId: string, layerId: string): Promise<string | undefined> {
    const { rows } = await this.pool.query<Row>(
      'select entity_id from reading_position where user_id = $1 and layer_id = $2',
      [userId, layerId],
    );
    return rows[0] ? String(rows[0]['entity_id']) : undefined;
  }

  async keepReadingPosition(userId: string, layerId: string, entityId: string): Promise<void> {
    await this.pool.query(
      `insert into reading_position(user_id, layer_id, entity_id) values ($1, $2, $3)
       on conflict (user_id, layer_id) do update set entity_id = excluded.entity_id, updated_at = now()`,
      [userId, layerId, entityId],
    );
  }

  async listFilters(campaignId: string | null, userId: string): Promise<ListFilterRow[]> {
    const { rows } = await this.pool.query<Row>(
      `select * from list_filter where ($1::text is not null and campaign_id = $1) or user_id = $2
        order by page, (user_id is not null), rank, name`,
      [campaignId, userId],
    );
    return rows.map(filterZeile);
  }

  async getListFilter(id: string): Promise<ListFilterRow | undefined> {
    const { rows } = await this.pool.query<Row>('select * from list_filter where id = $1', [id]);
    return rows[0] ? filterZeile(rows[0]) : undefined;
  }

  async putListFilter(row: ListFilterRow): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (row.isDefault) {
        await client.query(
          'update list_filter set is_default = false where campaign_id = $1 and page = $2 and id <> $3',
          [row.campaignId, row.page, row.id],
        );
      }
      await client.query(
        `insert into list_filter(id, page, name, campaign_id, user_id, filter, is_default, rank)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set page = excluded.page, name = excluded.name,
           filter = excluded.filter, is_default = excluded.is_default, rank = excluded.rank,
           updated_at = now()`,
        [row.id, row.page, row.name, row.campaignId, row.userId, JSON.stringify(row.filter), row.isDefault, row.rank],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async dropListFilter(id: string): Promise<boolean> {
    const r = await this.pool.query('delete from list_filter where id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  }

  async getPrefs(userId: string): Promise<Record<string, unknown>> {
    const { rows } = await this.pool.query<Row>('select key, value from app_user_pref where user_id = $1', [userId]);
    return Object.fromEntries(rows.map((r) => [String(r['key']), r['value']]));
  }

  async putPref(userId: string, key: string, value: unknown): Promise<void> {
    if (value === null || value === undefined) {
      await this.pool.query('delete from app_user_pref where user_id = $1 and key = $2', [userId, key]);
      return;
    }
    await this.pool.query(
      `insert into app_user_pref(user_id, key, value, updated_at) values ($1, $2, $3, now())
       on conflict (user_id, key) do update set value = excluded.value, updated_at = now()`,
      [userId, key, JSON.stringify(value)],
    );
  }

  /* Konto und Figuren gehen zusammen hinein. In einer Transaktion, weil
     ein Konto ohne seine Figuren ein Spieler ohne Blatt ist — und wer das
     nach einem halben Schreiben sieht, meldet einen Fehler, den es nicht
     gibt. */
  async putUser(user: StoredUser): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into app_user(id,name,name_fold,password_hash,is_admin,disabled_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,now())
         on conflict (id) do update set
           name = excluded.name, name_fold = excluded.name_fold,
           password_hash = excluded.password_hash, is_admin = excluded.is_admin,
           disabled_at = excluded.disabled_at, updated_at = now()`,
        [
          user.id,
          user.name,
          user.name.trim().toLocaleLowerCase('de'),
          user.passwordHash,
          user.isAdmin,
          user.disabledAt ?? null,
        ],
      );
      const ids = [...new Set(user.actorIds ?? [])];
      /* Abziehen, was nicht mehr dasteht, und dazulegen, was fehlt — statt
         alles zu löschen und neu zu schreiben. Sonst verlöre jede Bindung
         bei jedem Passwortwechsel ihr `added_at`. */
      await client.query(
        `delete from app_user_actor where user_id = $1 and actor_id <> all($2::text[])`,
        [user.id, ids],
      );
      if (ids.length) {
        await client.query(
          `insert into app_user_actor(user_id, actor_id)
             select $1, unnest($2::text[]) on conflict do nothing`,
          [user.id, ids],
        );
      }
      /* Die Rollen ebenso: was nicht mehr dasteht, geht; was dasteht, wird
         gesetzt. Eine Rolle, die sich nur ändert, behält ihr `added_at`. */
      const rollen = Object.entries(user.roles ?? {}).filter(([, r]) => isTableRole(r));
      await client.query(
        `delete from campaign_member where user_id = $1 and campaign_id <> all($2::text[])`,
        [user.id, rollen.map(([k]) => k)],
      );
      for (const [kampagne, rolle] of rollen) {
        await client.query(
          `insert into campaign_member(campaign_id, user_id, role) values ($1,$2,$3)
             on conflict (campaign_id, user_id) do update set role = excluded.role`,
          [kampagne, user.id, rolle],
        );
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------- Einladungen

  async putInvite(invite: Invite): Promise<void> {
    await this.pool.query(
      `insert into app_invite(code_hash,label,is_admin,actor_id,uses_left,expires_at,created_by,
                              campaign_id,role)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (code_hash) do update set
         label = excluded.label, is_admin = excluded.is_admin, actor_id = excluded.actor_id,
         uses_left = excluded.uses_left, expires_at = excluded.expires_at,
         campaign_id = excluded.campaign_id, role = excluded.role`,
      [
        invite.codeHash,
        invite.label ?? null,
        invite.isAdmin,
        invite.actorId ?? null,
        invite.usesLeft ?? null,
        invite.expiresAt ?? null,
        invite.createdBy ?? null,
        invite.campaignId ?? null,
        invite.role ?? null,
      ],
    );
  }

  async getInvite(codeHash: string): Promise<Invite | undefined> {
    const { rows } = await this.pool.query<Row>('select * from app_invite where code_hash = $1', [
      codeHash,
    ]);
    return rows[0] ? PgRepository.toInvite(rows[0]) : undefined;
  }

  async listInvites(): Promise<Invite[]> {
    const { rows } = await this.pool.query<Row>('select * from app_invite order by created_at desc');
    return rows.map((r) => PgRepository.toInvite(r));
  }

  async dropInvite(codeHash: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('delete from app_invite where code_hash = $1', [
      codeHash,
    ]);
    return (rowCount ?? 0) > 0;
  }

  /* Abziehen und zurückgeben in **einem** Schritt. Zwei Leute öffnen
     denselben Link gleichzeitig; wer erst liest, dann prüft und dann
     schreibt, lässt beide durch. Die Bedingung steht deshalb im `update`
     und nicht davor. */
  async useInvite(codeHash: string, now: string): Promise<Invite | undefined> {
    const { rows } = await this.pool.query<Row>(
      `update app_invite
          set uses_left = case when uses_left is null then null else uses_left - 1 end
        where code_hash = $1
          and (expires_at is null or expires_at > $2)
          and (uses_left is null or uses_left > 0)
        returning *`,
      [codeHash, now],
    );
    if (!rows[0]) return undefined;
    const invite = PgRepository.toInvite(rows[0]);
    /* Aufgebraucht heisst weg. Eine Einladung mit null Gebrauchen wäre eine
       Zeile, die nur noch erklärt, warum sie nicht mehr geht. */
    if (invite.usesLeft != null && invite.usesLeft <= 0) await this.dropInvite(codeHash);
    return invite;
  }

  async createSession(row: SessionRow & { agent?: string | undefined }): Promise<void> {
    await this.pool.query(
      `insert into app_session(token_hash,user_id,expires_at,agent) values ($1,$2,$3,$4)
       on conflict (token_hash) do nothing`,
      [row.tokenHash, row.userId, row.expiresAt, row.agent ?? null],
    );
  }

  async touchSession(tokenHash: string, until: string): Promise<StoredUser | undefined> {
    /* Nachschieben und lesen in einem Schritt: zwei Abfragen liessen ein
       Zeitfenster, in dem eine gerade abgemeldete Sitzung noch gilt. */
    const { rows } = await this.pool.query<Row>(
      `update app_session set seen_at = now(), expires_at = $2
         where token_hash = $1 and expires_at > now()
       returning user_id`,
      [tokenHash, until],
    );
    const userId = rows[0]?.['user_id'];
    if (!userId) {
      await this.pool.query('delete from app_session where token_hash = $1 and expires_at <= now()', [
        tokenHash,
      ]);
      return undefined;
    }
    return this.getUser(String(userId));
  }

  async dropSession(tokenHash: string): Promise<void> {
    await this.pool.query('delete from app_session where token_hash = $1', [tokenHash]);
  }

  async dropSessionsOf(userId: string): Promise<number> {
    const { rowCount } = await this.pool.query('delete from app_session where user_id = $1', [
      userId,
    ]);
    return rowCount ?? 0;
  }

  // ------------------------------------------------------------- Tokens

  private static toToken(r: Row): ApiToken {
    return {
      id: String(r['id']),
      userId: String(r['user_id']),
      name: String(r['name']),
      tokenHash: String(r['token_hash'] ?? ''),
      scope: r['scope'] as TokenScope,
      expiresAt: new Date(r['expires_at'] as string).toISOString(),
      createdAt: r['created_at'] ? new Date(r['created_at'] as string).toISOString() : undefined,
      lastUsedAt: r['last_used_at'] ? new Date(r['last_used_at'] as string).toISOString() : undefined,
    };
  }

  async createToken(token: ApiToken): Promise<void> {
    await this.pool.query(
      `insert into app_token(id,user_id,name,token_hash,scope,expires_at) values ($1,$2,$3,$4,$5,$6)`,
      [token.id, token.userId, token.name, token.tokenHash, token.scope, token.expiresAt],
    );
  }

  async listTokens(userId: string): Promise<ApiToken[]> {
    const { rows } = await this.pool.query<Row>(
      `select id, user_id, name, '' as token_hash, scope, expires_at, created_at, last_used_at
         from app_token where user_id = $1 order by created_at desc`,
      [userId],
    );
    return rows.map((r) => PgRepository.toToken(r));
  }

  async dropToken(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('delete from app_token where id = $1 and user_id = $2', [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  async useToken(tokenHash: string): Promise<{ user: StoredUser; token: ApiToken } | undefined> {
    /* Vermerken und lesen in einem Schritt, und nur, solange es gilt. */
    const { rows } = await this.pool.query<Row>(
      `update app_token set last_used_at = now()
         where token_hash = $1 and expires_at > now()
       returning *`,
      [tokenHash],
    );
    if (!rows[0]) return undefined;
    const token = PgRepository.toToken(rows[0]);
    const user = await this.getUser(token.userId);
    return user ? { user, token } : undefined;
  }

  async countAttempts(nameFold: string, origin: string, since: string): Promise<number> {
    const { rows } = await this.pool.query<Row>(
      `select count(*)::int as n from login_attempt
         where name_fold = $1 and origin = $2 and at >= $3`,
      [nameFold, origin, since],
    );
    return Number(rows[0]?.['n'] ?? 0);
  }

  async noteAttempt(nameFold: string, origin: string): Promise<void> {
    await this.pool.query('insert into login_attempt(name_fold,origin) values ($1,$2)', [
      nameFold,
      origin,
    ]);
    /* Alte Versuche wegräumen, damit die Tabelle nicht das Einzige ist, was
       in dieser Datenbank unbegrenzt wächst. */
    await this.pool.query("delete from login_attempt where at < now() - interval '1 day'");
  }

  async clearAttempts(nameFold: string, origin: string): Promise<void> {
    await this.pool.query('delete from login_attempt where name_fold = $1 and origin = $2', [
      nameFold,
      origin,
    ]);
  }
}

/** Ein Artikel aus seiner Zeile, seinen Karten und seinen Kanten (in Reihenfolge). */
function zusammensetzen(base: Row, components: Row[], relations: Row[]): Entity {
  const byType: Record<string, Record<string, unknown>> = {};
  for (const r of components) {
    byType[r['type'] as string] = r['payload'] as Record<string, unknown>;
  }

  const meta = (byType['__meta'] ?? {}) as Record<string, unknown>;
  delete byType['__meta'];

  return {
    id: base['id'] as string,
    interfaces: (meta['interfaces'] as string[]) ?? [],
    name: (byType['Name']?.['text'] as string) ?? '',
    components: byType,
    adhoc: (meta['adhoc'] as Entity['adhoc']) ?? [],
    relations: relations.map((r) => ({
      id: r['id'] as string,
      type: r['type'] as string,
      to: r['to_id'] as string,
      props: (r['props'] as Relation['props']) ?? {},
    })),
    createdAt: (base['created_at'] as Date)?.toISOString(),
    updatedAt: (base['updated_at'] as Date)?.toISOString(),
    ...(base['revision'] != null ? { revision: Number(base['revision']) } : {}),
  };
}

function filterZeile(r: Row): ListFilterRow {
  return {
    id: String(r['id']),
    page: String(r['page']),
    name: String(r['name']),
    campaignId: r['campaign_id'] === null ? null : String(r['campaign_id']),
    userId: r['user_id'] === null ? null : String(r['user_id']),
    filter: (r['filter'] ?? {}) as Record<string, unknown>,
    isDefault: r['is_default'] === true,
    rank: Number(r['rank'] ?? 0),
  };
}
