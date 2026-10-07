/**
 * The Postgres adapter for the storage port.
 *
 * Entities are assembled from the three tables on read and written back
 * component by component, because that is what makes `sparse by default`
 * real: a component that is not set has no row at all.
 */

import type { Pool } from 'pg';
import type { Entity, Registry, Relation } from '@nw/model';
import type { Repository, SessionRow, StoredUser } from './repo.js';
import type { Invite, User } from './auth.js';

type Row = Record<string, unknown>;

export class PgRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  async getRegistry(): Promise<Registry> {
    const [components, interfaces, relations, views, vars] = await Promise.all([
      this.pool.query<Row>('select * from component_def'),
      this.pool.query<Row>('select * from interface_def'),
      this.pool.query<Row>('select * from relation_def'),
      this.pool.query<Row>('select * from view_def order by ord'),
      this.pool.query<Row>('select * from var_def'),
    ]);

    const registry: Registry = {
      components: {}, interfaces: {}, relations: {}, views: {}, vars: {},
    };

    for (const r of components.rows) {
      registry.components[r['name'] as string] = {
        name: r['name'] as string,
        label: (r['label'] as string) ?? undefined,
        engine: (r['engine'] as string) ?? null,
        schema: r['schema'] as Registry['components'][string]['schema'],
      };
    }
    for (const r of interfaces.rows) {
      registry.interfaces[r['name'] as string] = {
        name: r['name'] as string,
        label: (r['label'] as string) ?? undefined,
        abstract: Boolean(r['abstract']),
        extends: (r['extends'] as string[]) ?? [],
        requires: (r['requires'] as string[]) ?? [],
        allows: (r['allows'] as string[]) ?? [],
        blockTypes: (r['block_types'] as string[]) ?? [],
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
      };
    }
    for (const r of views.rows) {
      registry.views[r['key'] as string] = {
        ...(r['config'] as object),
        label: r['label'] as string,
        order: r['ord'] as number,
      } as Registry['views'][string];
    }
    for (const r of vars.rows) registry.vars[r['name'] as string] = r['value'] as string;

    return registry;
  }

  async putRegistryPart<K extends keyof Registry>(part: K, value: Registry[K]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (part === 'components') {
        await client.query('delete from component_def');
        for (const [name, def] of Object.entries(value as Registry['components'])) {
          await client.query(
            'insert into component_def(name,label,engine,schema) values ($1,$2,$3,$4)',
            [name, def.label ?? null, def.engine, JSON.stringify(def.schema)],
          );
        }
      } else if (part === 'interfaces') {
        await client.query('delete from interface_def');
        for (const [name, def] of Object.entries(value as Registry['interfaces'])) {
          await client.query(
            `insert into interface_def(name,label,abstract,extends,requires,allows,block_types)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [name, def.label ?? null, def.abstract ?? false, def.extends ?? [], def.requires ?? [],
             def.allows ?? [], def.blockTypes ?? []],
          );
        }
      } else if (part === 'relations') {
        await client.query('delete from relation_def');
        for (const [type, def] of Object.entries(value as Registry['relations'])) {
          await client.query(
            `insert into relation_def(type,label,inverse_label,from_ifaces,to_ifaces,owned,cardinality,section,props)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [type, def.label, def.inverseLabel, def.from ?? ['*'], def.to ?? ['*'],
             def.owned ?? false, def.cardinality ?? 'many', def.section ?? null,
             JSON.stringify(def.props ?? {})],
          );
        }
      } else if (part === 'views') {
        await client.query('delete from view_def');
        for (const [key, def] of Object.entries(value as Registry['views'])) {
          await client.query('insert into view_def(key,label,ord,config) values ($1,$2,$3,$4)', [
            key, def.label, def.order ?? 99, JSON.stringify(def),
          ]);
        }
      } else if (part === 'vars') {
        await client.query('delete from var_def');
        for (const [name, v] of Object.entries(value as Registry['vars'])) {
          await client.query('insert into var_def(name,value) values ($1,$2)', [name, v]);
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

  async listEntities(): Promise<Entity[]> {
    const { rows } = await this.pool.query<Row>('select id from entity order by created_at');
    const out: Entity[] = [];
    for (const row of rows) {
      const entity = await this.getEntity(row['id'] as string);
      if (entity) out.push(entity);
    }
    return out;
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

    const byType: Record<string, Record<string, unknown>> = {};
    for (const r of components.rows) {
      byType[r['type'] as string] = r['payload'] as Record<string, unknown>;
    }

    const meta = (byType['__meta'] ?? {}) as Record<string, unknown>;
    delete byType['__meta'];

    return {
      id,
      interfaces: (meta['interfaces'] as string[]) ?? [],
      name: (byType['Name']?.['text'] as string) ?? '',
      tags: (meta['tags'] as string[]) ?? [],
      components: byType,
      adhoc: (meta['adhoc'] as Entity['adhoc']) ?? [],
      blocks: (meta['blocks'] as Entity['blocks']) ?? [],
      relations: relations.rows.map((r) => ({
        id: r['id'] as string,
        type: r['type'] as string,
        to: r['to_id'] as string,
        props: (r['props'] as Relation['props']) ?? {},
      })),
      createdAt: (base.rows[0]?.['created_at'] as Date)?.toISOString(),
      updatedAt: (base.rows[0]?.['updated_at'] as Date)?.toISOString(),
    };
  }

  async putEntity(entity: Entity): Promise<Entity> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into entity(id) values ($1)
         on conflict (id) do update set updated_at = now()`,
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
          tags: entity.tags ?? [],
          adhoc: entity.adhoc ?? [],
          blocks: entity.blocks ?? [],
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

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return (await this.getEntity(entity.id)) as Entity;
  }

  async deleteEntity(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('delete from entity where id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<void> {
    await this.pool.query(
      'insert into event_log(id,name,subject,payload) values (gen_random_uuid(),$1,$2,$3)',
      [name, subject ?? null, JSON.stringify(payload ?? {})],
    );
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
      isGm: row['is_gm'] === true,
      actorIds: raw.filter((x): x is string => typeof x === 'string' && x.length > 0),
      disabledAt: row['disabled_at'] ? new Date(row['disabled_at'] as string).toISOString() : undefined,
    };
  }

  /** Ein Konto samt seinen Figuren. Als eigener Ausdruck, damit die vier
   *  Stellen, die Konten lesen, nicht viermal dasselbe `left join`
   *  schreiben — und dann eine davon anders. */
  private static readonly USER_SELECT = `
    select u.*, array_agg(a.actor_id order by a.added_at) as actor_ids
      from app_user u
      left join app_user_actor a on a.user_id = u.id`;

  private static toInvite(row: Row): Invite {
    return {
      codeHash: String(row['code_hash']),
      label: (row['label'] as string | null) ?? undefined,
      isGm: row['is_gm'] === true,
      actorId: (row['actor_id'] as string | null) ?? undefined,
      usesLeft: row['uses_left'] == null ? undefined : Number(row['uses_left']),
      expiresAt: row['expires_at'] ? new Date(row['expires_at'] as string).toISOString() : undefined,
      createdBy: (row['created_by'] as string | null) ?? undefined,
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

  /* Konto und Figuren gehen zusammen hinein. In einer Transaktion, weil
     ein Konto ohne seine Figuren ein Spieler ohne Blatt ist — und wer das
     nach einem halben Schreiben sieht, meldet einen Fehler, den es nicht
     gibt. */
  async putUser(user: StoredUser): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into app_user(id,name,name_fold,password_hash,is_gm,disabled_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,now())
         on conflict (id) do update set
           name = excluded.name, name_fold = excluded.name_fold,
           password_hash = excluded.password_hash, is_gm = excluded.is_gm,
           disabled_at = excluded.disabled_at, updated_at = now()`,
        [
          user.id,
          user.name,
          user.name.trim().toLocaleLowerCase('de'),
          user.passwordHash,
          user.isGm,
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
      `insert into app_invite(code_hash,label,is_gm,actor_id,uses_left,expires_at,created_by)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (code_hash) do update set
         label = excluded.label, is_gm = excluded.is_gm, actor_id = excluded.actor_id,
         uses_left = excluded.uses_left, expires_at = excluded.expires_at`,
      [
        invite.codeHash,
        invite.label ?? null,
        invite.isGm,
        invite.actorId ?? null,
        invite.usesLeft ?? null,
        invite.expiresAt ?? null,
        invite.createdBy ?? null,
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
