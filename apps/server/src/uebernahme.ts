/**
 * **Übernahme zwischen zwei Installationen** (T-130, REQ-155): Artikel,
 * Registerzeilen und Bilder von dev nach prod schieben, von prod nach dev
 * holen, und dev ganz aus prod neu bestücken (Überklonen).
 *
 * **Zwei Rollen, ein Server.** Die Installation, auf der die Leitung
 * auswählt (dev), ist der **Auslöser**: sie kennt ihre Gegenstelle aus
 * der Server-Einstellung (`ATLAS_PEER_URL`, `ATLAS_PEER_TOKEN`) und spricht
 * sie über deren API an — nie der Browser, und das Token steht nie in
 * einer Antwort. Die andere (prod) ist die **Gegenstelle**: sie liefert
 * ihren Bestand an ein Verwaltungskonto (`/api/transfer/peer/…`) und nimmt
 * nur an, wenn dort `ATLAS_TRANSFER_ACCEPT=1` steht (E-042). Auf `prod`
 * löst nichts aus: ein Überklonen, das prod überschreibt, gibt es nicht.
 *
 * **Die Basis steht beim Auslöser** (`transfer_base`): je Artikel und
 * Registerzeile der Stand der letzten Übernahme. Daraus rechnet
 * `uebernahme.ts` im Modell, wer seither was geändert hat.
 *
 * **Nichts wird still überschrieben, alles lässt sich zurücknehmen.** Vor
 * dem Schreiben steht eine Vorschau; der Lauf schreibt genau sie oder
 * gar nichts (hat sich seither etwas bewegt: 409). Jeder Artikel geht
 * durch `validateEntity`. Vor dem ersten Schreiben liegt die Sicherung
 * (die alten Fassungen als Ausfuhrdatei in `ATLAS_BACKUP_DIR`, wie die
 * Sicherungen beim Ausrollen in `backups/`) und das Ereignis im Protokoll
 * mit jeder alten Fassung — Rückgängig je Übernahme, auf beiden Seiten.
 *
 * **Konten wandern nicht** (REQ-199): gelesen und geschrieben werden nur
 * Artikel, Register und Bilder. Mitglieder, Rollen, Tokens, Einladungen,
 * wer was angelegt hat und welche Ebene wem gehört stehen in eigenen
 * Tabellen und bleiben auf ihrer Installation.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  LAYER_RELATION,
  RegistrySchema,
  TransferRequestSchema,
  TransferRunSchema,
  articleId,
  assignNumbers,
  entityName,
  isInstance,
  mergeTransfer,
  registryItem,
  registryKey,
  registryRow,
  repoint,
  resolveInstance,
  selectEntities,
  stableJson,
  stageBases,
  transferItem,
  transferKey,
  validateEntity,
  withDependencies,
  withNumber,
  yieldNumbers,
  type BulkSelect,
  type Entity,
  type Registry,
  type TransferChoice,
  type TransferItem,
  type TransferRequest,
} from '@nw/model';
import type { Repository } from './repo.js';
import type { ApiToken, User } from './auth.js';
import type { AtlasEnv } from './config.js';
import type { AssetStore } from './assets.js';
import { runImport, ImportFehler } from './import.js';

// ------------------------------------------------------------ Gegenstelle

/** Die andere Installation, wie der Server sie anspricht. */
export interface Gegenstelle {
  /** Ihr Name (der Host) — Schlüssel der Basis, steht im Protokoll. */
  name: string;
  url: string;
  json<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: T }>;
  /** Eine Datei der Bilderablage; `null`, wenn es sie dort nicht gibt. */
  datei(key: string): Promise<Buffer | null>;
}

/** Ohne Adresse oder Token gibt es keine Gegenstelle. */
export function gegenstelleAus(url: string | undefined, token: string | undefined, holen: typeof fetch = fetch): Gegenstelle | null {
  const basis = url?.trim().replace(/\/+$/, '');
  if (!basis || !token?.trim()) return null;
  let name: string;
  try {
    name = new URL(basis).host;
  } catch {
    return null;
  }
  const kopf = { authorization: `Bearer ${token.trim()}` };
  return {
    name,
    url: basis,
    async json<T>(method: 'GET' | 'POST', path: string, body?: unknown) {
      const res = await holen(`${basis}${path}`, {
        method,
        headers: body === undefined ? kopf : { ...kopf, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });
      const text = await res.text();
      let daten: unknown = null;
      try {
        daten = text ? JSON.parse(text) : null;
      } catch {
        daten = { error: text.slice(0, 200) };
      }
      return { status: res.status, body: daten as T };
    },
    async datei(key: string) {
      const res = await holen(`${basis}/api/transfer/peer/file/${encodeURIComponent(key)}`, { headers: kopf, signal: AbortSignal.timeout(10 * 60 * 1000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Datei ${key}: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// ---------------------------------------------------------------- Sicherung

/** Wohin die Sicherung vor dem Schreiben geht. Gibt zurück, wo sie liegt. */
export interface Sicherung {
  schreibe(name: string, daten: unknown): Promise<string>;
}

/** Eine Datei je Sicherung in `ATLAS_BACKUP_DIR` (im Container `/data/backups`). */
export class DateiSicherung implements Sicherung {
  constructor(private readonly dir: string) {}
  async schreibe(name: string, daten: unknown): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const text = JSON.stringify(daten);
    /* Nie überschreiben: zwei Läufe in derselben Millisekunde bekommen -2, -3 … */
    for (let n = 1; ; n += 1) {
      const pfad = join(this.dir, n === 1 ? name : name.replace(/\.json$/, `-${n}.json`));
      try {
        await writeFile(pfad, text, { flag: 'wx' });
        return pfad;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || n > 50) throw error;
      }
    }
  }
}

/** Für Tests: hält die Sicherungen im Speicher. */
export class SpeicherSicherung implements Sicherung {
  readonly dateien = new Map<string, unknown>();
  async schreibe(name: string, daten: unknown): Promise<string> {
    this.dateien.set(name, structuredClone(daten));
    return `memory:${name}`;
  }
}

const stempel = () => new Date().toISOString().replace(/[-:]/g, '').replace('.', '-');
const sicher = (s: string) => s.replace(/[^a-zA-Z0-9.-]+/g, '-');

// ------------------------------------------------------------------- Routen

interface Wer {
  user: User;
  token?: ApiToken | undefined;
}

export interface UebernahmeOptionen {
  repo: Repository;
  env: AtlasEnv | null;
  peer: Gegenstelle | null;
  /** Nimmt diese Installation Übernahmen an (`ATLAS_TRANSFER_ACCEPT`)? */
  accept: boolean;
  sicherung: Sicherung | null;
  assets: AssetStore;
  /** Nur die Verwaltung der Installation (`is_admin`), nie in einer Sicht. */
  verwaltung: (request: FastifyRequest) => Promise<Wer | string>;
}

/** Was in Basis und Übertragung steht: der gespeicherte Artikel ohne Revision und Zeiten. */
function rein(e: Entity): Entity {
  return {
    id: e.id,
    interfaces: e.interfaces ?? [],
    name: e.name,
    components: e.components ?? {},
    ...(e.adhoc?.length ? { adhoc: e.adhoc } : {}),
    relations: e.relations ?? [],
  };
}

/** Die Ebene selbst gehört zu „eine Ebene mit Inhalt". */
function auswahl(registry: Registry, alle: Entity[], select: BulkSelect | undefined): string[] {
  if (!select || (!select.ids?.length && !select.types?.length && !select.layer && !select.tag && !select.where?.length)) return [];
  const ids = selectEntities(registry, alle, select).map((e) => e.id);
  const ebene = select.layer?.trim();
  if (ebene) for (const e of alle) if (e.id === ebene || articleId(e) === ebene) ids.push(e.id);
  return [...new Set(ids)];
}

/** Zeilen eines Registers nach Schlüssel. `teil:*` nimmt den ganzen Teil. */
function registerZeilen(reg: Registry, keys: string[]): Map<string, unknown> {
  const raus = new Map<string, unknown>();
  for (const key of keys) {
    const k = registryKey(key);
    if (!k) continue;
    if (k.name === '*') {
      const teil = (reg as unknown as Record<string, Record<string, unknown> | undefined>)[k.part] ?? {};
      for (const [name, row] of Object.entries(teil)) raus.set(`${k.part}:${name}`, row);
    } else raus.set(key, registryRow(reg, key));
  }
  return raus;
}

/** Ein Register mit diesen Zeilen (`undefined`: Zeile weg). */
function mitZeilen(reg: Registry, rows: { key: string; value: unknown }[]): Registry {
  const raus = structuredClone(reg) as unknown as Record<string, Record<string, unknown>>;
  for (const r of rows) {
    const k = registryKey(r.key)!;
    const teil = (raus[k.part] ??= {});
    if (r.value === undefined || r.value === null) delete teil[k.name];
    else teil[k.name] = r.value;
  }
  return raus as unknown as Registry;
}

interface Abgelehnt {
  id: string;
  name: string;
  type: string;
  issues: string[];
}

/** Prüft Artikel, als stünden sie schon im Bestand `danach` (wie `pruefeLauf`). */
function pruefe(registry: Registry, danach: Map<string, Entity>, kandidaten: Entity[]): Abgelehnt[] {
  const known = new Map([...danach.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  const ids = new Set(known.keys());
  const stufen = stageBases(danach.values());
  const raus: Abgelehnt[] = [];
  for (const e of kandidaten) {
    const pruefling = isInstance(e) ? resolveInstance(danach, e) : e;
    const issues = validateEntity(registry, pruefling, { knownTypes: known, knownIds: ids, stageOf: stufen });
    if (issues.length) raus.push({ id: e.id, name: entityName(e), type: e.interfaces?.[0] ?? '', issues: issues.map((i) => i.message) });
  }
  return raus;
}

/** Bilder: die Dateischlüssel eines Asset-Artikels (Datei und Vorschau). */
function dateiSchluessel(e: Entity | undefined): string[] {
  const a = e?.components?.['Asset'] as { ref?: unknown; backend?: unknown } | undefined;
  if (!a || typeof a.ref !== 'string' || (a.backend ?? 'app') !== 'app') return [];
  return [a.ref, `${a.ref}.thumb.webp`];
}

async function dateiLesen(assets: AssetStore, key: string): Promise<Buffer | null> {
  const d = await assets.get(key).catch(() => null);
  if (!d) return null;
  const teile: Buffer[] = [];
  for await (const t of d.body) teile.push(Buffer.isBuffer(t) ? t : Buffer.from(t as Uint8Array));
  return Buffer.concat(teile);
}

interface Aenderung {
  id: string;
  before: Entity | null;
  after: Entity | null;
}

interface RegAenderung {
  key: string;
  before: unknown;
  after: unknown;
}

/** Zurücknehmen: alte Fassungen hin, wenn seither niemand etwas geändert hat. */
async function zuruecknehmen(
  repo: Repository,
  changes: Aenderung[],
  registry: RegAenderung[],
  force: boolean,
  dryRun: boolean,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const alle = await repo.listEntities();
  const roh = new Map(alle.map((e) => [e.id, e]));
  const konflikte: { id: string; name: string; reason: string }[] = [];
  const zurueck: Aenderung[] = [];
  for (const c of [...changes].reverse()) {
    const jetzt = roh.get(c.id) ?? null;
    const name = entityName((c.before ?? c.after) ?? undefined);
    if (transferKey(jetzt) === transferKey(c.before)) continue;
    if (transferKey(jetzt) !== transferKey(c.after)) {
      konflikte.push({ id: c.id, name, reason: jetzt ? (c.after ? 'changed since' : 'exists again') : 'deleted since' });
      if (!force) continue;
    }
    zurueck.push({ id: c.id, before: jetzt, after: c.before });
  }
  const reg = await repo.getRegistry();
  const regZurueck: RegAenderung[] = [];
  for (const r of registry) {
    const jetzt = registryRow(reg, r.key);
    if (stableJson(jetzt ?? null) === stableJson(r.before ?? null)) continue;
    if (stableJson(jetzt ?? null) !== stableJson(r.after ?? null)) {
      konflikte.push({ id: `registry:${r.key}`, name: r.key, reason: 'changed since' });
      if (!force) continue;
    }
    regZurueck.push({ key: r.key, before: jetzt, after: r.before });
  }
  if (konflikte.length && !force) {
    return { status: 409, body: { error: `${konflikte.length} wurden seither geändert. Mit "force": true gewinnt die alte Fassung.`, conflicts: konflikte } };
  }
  const neuesRegister = mitZeilen(reg, regZurueck.map((r) => ({ key: r.key, value: r.after })));
  const danach = new Map(roh);
  for (const c of zurueck) {
    if (c.after) danach.set(c.id, c.after);
    else danach.delete(c.id);
  }
  const abgelehnt = pruefe(neuesRegister, danach, zurueck.flatMap((c) => (c.after ? [c.after] : [])));
  const antwort = { restored: zurueck.length + regZurueck.length, conflicts: konflikte, rejected: abgelehnt };
  if (dryRun) return { status: 200, body: { dryRun: true, ...antwort } };
  if (abgelehnt.length) return { status: 422, body: { error: 'Die alten Fassungen bestehen die Prüfung nicht — nichts geschrieben.', ...antwort } };
  await schreibeRegister(repo, reg, regZurueck.map((r) => ({ key: r.key, value: r.after })));
  for (const c of zurueck) if (!c.after) await repo.deleteEntity(c.id);
  for (const c of zurueck) if (c.after) await repo.putEntity(c.after);
  return { status: 200, body: { ...antwort, changes: zurueck, registryChanges: regZurueck } };
}

/** Schreibt nur die Teile des Registers, in denen sich eine Zeile ändert. */
async function schreibeRegister(repo: Repository, vorher: Registry, rows: { key: string; value: unknown }[]): Promise<void> {
  if (!rows.length) return;
  const nachher = mitZeilen(vorher, rows);
  const teile = new Set(rows.map((r) => registryKey(r.key)!.part));
  for (const teil of teile) {
    await repo.putRegistryPart(teil as keyof Registry, (nachher as unknown as Record<string, never>)[teil]);
  }
}

/** Was die Gegenstelle auf `read` liefert. */
interface Lesung {
  entities: Entity[];
  registry: Record<string, unknown>;
  names: Record<string, string>;
  selected: string[];
}

/** Ein Lauf der Übernahme, wie er im Protokoll des Auslösers steht. */
interface LaufEreignis {
  direction: 'push' | 'pull';
  peer: string;
  by: { id: string; name: string };
  remote?: string;
  items: { id: string; name: string; type: string; status: string }[];
  numbers: Record<string, string>;
  backup: string | null;
  changes: Aenderung[];
  registryChanges: RegAenderung[];
  baseBefore: { key: string; value: unknown }[];
  notAligned?: Abgelehnt[];
}

export function uebernahmeRouten(app: FastifyInstance, o: UebernahmeOptionen): void {
  const { repo } = o;

  // ===================================================== Gegenstelle (prod)

  /** Wer hier fragt, muss die Verwaltung sein; für Schreibendes auch die Annahme. */
  async function peerWer(request: FastifyRequest, schreibt: boolean): Promise<Wer | { code: number; error: string }> {
    const wer = await o.verwaltung(request);
    if (typeof wer === 'string') return { code: 403, error: wer };
    if (schreibt && !o.accept) {
      return { code: 403, error: 'Diese Installation nimmt keine Übernahmen an (ATLAS_TRANSFER_ACCEPT ist nicht gesetzt).' };
    }
    return wer;
  }
  const istFehler = (x: Wer | { code: number; error: string }): x is { code: number; error: string } => 'code' in x;

  app.get('/api/transfer/peer', async (request, reply) => {
    const wer = await peerWer(request, false);
    if (istFehler(wer)) return reply.code(wer.code).send({ error: wer.error });
    return { env: o.env, accept: o.accept, articles: await repo.countEntities() };
  });

  /** Gespeicherte Artikel (ungesiebt, Instanzen dünn) nach Auswahl oder Ids. */
  app.post<{ Body: { ids?: string[]; select?: BulkSelect; dependencies?: boolean; registry?: string[] } | null }>(
    '/api/transfer/peer/read',
    async (request, reply) => {
      const wer = await peerWer(request, false);
      if (istFehler(wer)) return reply.code(wer.code).send({ error: wer.error });
      const body = request.body ?? {};
      const alle = await repo.listEntities();
      const roh = new Map(alle.map((e) => [e.id, e]));
      const registry = await repo.getRegistry();
      let ids = [...auswahl(registry, alle, body.select), ...(body.ids ?? []).filter((id) => roh.has(id))];
      const selected = [...new Set(ids)];
      if (body.dependencies) ids = withDependencies(roh, selected);
      const entities = [...new Set(ids)].map((id) => roh.get(id)!).filter(Boolean);
      const names: Record<string, string> = {};
      for (const e of entities) {
        for (const r of e.relations ?? []) if (r.type === LAYER_RELATION && roh.has(r.to)) names[r.to] = entityName(roh.get(r.to));
      }
      const rows = registerZeilen(registry, body.registry ?? []);
      return { entities, registry: Object.fromEntries(rows), names, selected } satisfies Lesung;
    },
  );

  /** Der ganze Bestand — für das Überklonen. Format der Ausfuhr. */
  app.get('/api/transfer/peer/stock', async (request, reply) => {
    const wer = await peerWer(request, false);
    if (istFehler(wer)) return reply.code(wer.code).send({ error: wer.error });
    const registry = await repo.getRegistry();
    return { format: 'nebelwacht/1', at: new Date().toISOString(), registry, entities: (await repo.listEntities()).map(rein) };
  });

  app.get<{ Params: { key: string } }>('/api/transfer/peer/file/:key', async (request, reply) => {
    const wer = await peerWer(request, false);
    if (istFehler(wer)) return reply.code(wer.code).send({ error: wer.error });
    const datei = await o.assets.get(request.params.key).catch(() => null);
    if (!datei) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.type('application/octet-stream').send(datei.body);
  });

  /**
   * **Annehmen** (nur mit `ATLAS_TRANSFER_ACCEPT`): die Artikel und Zeilen
   * eines Laufs. Steht ein Artikel nicht mehr in der Revision, die die
   * Vorschau sah, wird nichts geschrieben (409). Neue Artikel bekommen
   * hier ihre Nummer (`assignNumbers`) — prod ist der Master.
   */
  app.post<{
    Body: {
      from?: string;
      by?: string;
      items?: { entity: Entity; expect: number | null }[];
      registry?: { key: string; value: unknown }[];
      files?: { key: string; data: string }[];
      dryRun?: boolean;
    } | null;
  }>('/api/transfer/peer/apply', { bodyLimit: 512 * 1024 * 1024 }, async (request, reply) => {
    const wer = await peerWer(request, true);
    if (istFehler(wer)) return reply.code(wer.code).send({ error: wer.error });
    const body = request.body ?? {};
    const items = body.items ?? [];
    const regRows = (body.registry ?? []).filter((r) => registryKey(r.key));
    const alle = await repo.listEntities();
    const roh = new Map(alle.map((e) => [e.id, e]));
    const veraltet = items.filter((i) => (roh.get(i.entity.id)?.revision ?? null) !== (i.expect ?? null)).map((i) => i.entity.id);
    if (veraltet.length) {
      return reply.code(409).send({ error: `${veraltet.length} Artikel wurden hier seit der Vorschau geändert — nichts geschrieben.`, stale: veraltet });
    }
    const nummern = assignNumbers(alle, items.map((i) => i.entity));
    const umNummern = new Map<string, string>();
    for (const i of items) {
      const neu = nummern.get(i.entity.id);
      if (neu) umNummern.set(articleId(i.entity), neu);
    }
    let kommend = items.map((i) => (nummern.has(i.entity.id) ? withNumber(rein(i.entity), nummern.get(i.entity.id)!) : rein(i.entity)));
    if (umNummern.size) {
      const neu = repoint(kommend, new Map(), umNummern);
      kommend = kommend.map((e) => neu.get(e.id) ?? e);
    }
    const vorherReg = await repo.getRegistry();
    const reg = mitZeilen(vorherReg, regRows);
    const geprueft = RegistrySchema.safeParse(reg);
    if (!geprueft.success) {
      return reply.code(422).send({ error: `Register ungültig: ${geprueft.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` });
    }
    const danach = new Map(roh);
    for (const e of kommend) danach.set(e.id, e);
    const abgelehnt = pruefe(reg, danach, kommend);
    if (abgelehnt.length) return reply.code(422).send({ error: `${abgelehnt.length} Artikel bestehen die Prüfung nicht — nichts geschrieben.`, rejected: abgelehnt });
    if (body.dryRun) return { dryRun: true, numbers: Object.fromEntries(nummern) };

    const changes: Aenderung[] = kommend.map((e) => ({ id: e.id, before: roh.get(e.id) ? rein(roh.get(e.id)!) : null, after: e }));
    const registryChanges: RegAenderung[] = regRows.map((r) => ({ key: r.key, before: registryRow(vorherReg, r.key) ?? null, after: r.value }));
    let backup: string | null = null;
    if (o.sicherung) {
      backup = await o.sicherung.schreibe(`${stempel()}-vor-uebernahme-von-${sicher(body.from ?? 'peer')}.json`, {
        format: 'nebelwacht/1',
        at: new Date().toISOString(),
        note: 'Vor einer Übernahme (T-130): die Artikel und Registerzeilen, wie sie vorher standen.',
        registryRows: Object.fromEntries(registryChanges.map((r) => [r.key, r.before])),
        entities: changes.flatMap((c) => (c.before ? [c.before] : [])),
      });
    }
    const id = await repo.appendEvent('transfer.in', undefined, {
      from: body.from ?? null,
      by: { id: wer.user.id, name: wer.user.name, for: body.by ?? null },
      token: wer.token?.name ?? null,
      backup,
      numbers: Object.fromEntries(nummern),
      summary: changes.slice(0, 5).map((c) => `${entityName(c.after ?? undefined)} (${c.before ? 'update' : 'create'})`),
      count: changes.length,
      changes,
      registryChanges,
    });
    for (const f of body.files ?? []) {
      if (!(await o.assets.has(f.key))) await o.assets.put(f.key, Buffer.from(f.data, 'base64'));
    }
    await schreibeRegister(repo, vorherReg, regRows);
    const written: Entity[] = [];
    for (const e of kommend) written.push(await repo.putEntity(e));
    return { event: id, numbers: Object.fromEntries(nummern), written: written.map(rein), backup };
  });

  app.post<{ Params: { id: string }; Body: { force?: boolean; dryRun?: boolean } | null }>(
    '/api/transfer/peer/undo/:id',
    async (request, reply) => {
      const wer = await peerWer(request, true);
      if (istFehler(wer)) return reply.code(wer.code).send({ error: wer.error });
      const ereignis = await repo.getEvent(request.params.id);
      if (!ereignis || ereignis.name !== 'transfer.in') return reply.code(404).send({ error: 'Nicht gefunden' });
      if ((await repo.listEvents({ name: 'transfer.in.undone', subject: ereignis.id, limit: 1, light: true })).length) {
        return reply.code(409).send({ error: 'Schon rückgängig gemacht.' });
      }
      const p = ereignis.payload as { changes?: Aenderung[]; registryChanges?: RegAenderung[] };
      const r = await zuruecknehmen(repo, p.changes ?? [], p.registryChanges ?? [], Boolean(request.body?.force), Boolean(request.body?.dryRun));
      if (r.status === 200 && !request.body?.dryRun) {
        await repo.appendEvent('transfer.in.undone', ereignis.id, { by: { id: wer.user.id, name: wer.user.name }, restored: r.body['restored'] });
      }
      const { changes: _c, registryChanges: _r, ...antwort } = r.body;
      return reply.code(r.status).send(antwort);
    },
  );

  // ========================================================= Auslöser (dev)

  async function ausloeser(request: FastifyRequest): Promise<{ wer: Wer; peer: Gegenstelle } | { code: number; error: string }> {
    const wer = await o.verwaltung(request);
    if (typeof wer === 'string') return { code: 403, error: wer };
    if (o.env === 'prod') return { code: 403, error: 'Auf prod wird keine Übernahme ausgelöst — prod ist die Gegenstelle.' };
    if (!o.peer) return { code: 409, error: 'Keine Gegenstelle eingerichtet (ATLAS_PEER_URL und ATLAS_PEER_TOKEN am Server).' };
    return { wer, peer: o.peer };
  }
  const nichtDa = (x: object): x is { code: number; error: string } => 'code' in x;

  /** Fragt die Gegenstelle und macht aus einem Fehler eine Antwort. */
  async function frage<T>(peer: Gegenstelle, method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: T }> {
    try {
      return await peer.json<T>(method, path, body);
    } catch (error) {
      return { status: 502, body: { error: `${peer.name} antwortet nicht: ${error instanceof Error ? error.message : String(error)}` } as T };
    }
  }

  app.get('/api/transfer', async (request, reply) => {
    const wer = await o.verwaltung(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const runs = (await repo.listEvents({ name: 'transfer', limit: 20, light: true })).concat(
      await repo.listEvents({ name: 'transfer.clone', limit: 5, light: true }),
    );
    const zurueck = new Set((await repo.listEvents({ name: 'transfer.undone', limit: 1000, light: true })).map((e) => e.subject));
    let peerState: unknown = null;
    if (o.peer && o.env !== 'prod') {
      const r = await frage<{ env?: string; accept?: boolean; articles?: number; error?: string }>(o.peer, 'GET', '/api/transfer/peer');
      peerState = r.status === 200 ? r.body : { error: r.body?.error ?? `HTTP ${r.status}` };
    }
    return {
      env: o.env,
      accept: o.accept,
      canTrigger: o.env !== 'prod',
      backup: Boolean(o.sicherung),
      peer: o.peer ? { name: o.peer.name, url: o.peer.url } : null,
      peerState,
      runs: runs
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((e) => {
          const p = e.payload as Record<string, unknown>;
          return { id: e.id, at: e.at, kind: e.name, undone: zurueck.has(e.id), direction: p['direction'], by: p['by'], items: p['items'], count: p['count'], backup: p['backup'] };
        }),
    };
  });

  interface Plan {
    items: TransferItem[];
    quelle: Map<string, Entity>;
    ziel: Map<string, Entity>;
    basis: Map<string, unknown>;
    regQuelle: Map<string, unknown>;
    regZiel: Map<string, unknown>;
    lokal: Map<string, Entity>;
    lokalesRegister: Registry;
  }

  /** Die Vorschau — und dieselbe Rechnung vor dem Lauf. */
  async function plane(peer: Gegenstelle, auftrag: TransferRequest): Promise<Plan | { code: number; error: string }> {
    const lokalAlle = await repo.listEntities();
    const lokal = new Map(lokalAlle.map((e) => [e.id, e]));
    const lokalesRegister = await repo.getRegistry();
    const keys = auftrag.registry ?? [];
    let quelle: Map<string, Entity>;
    let ziel: Map<string, Entity>;
    let regQuelle: Map<string, unknown>;
    let regZiel: Map<string, unknown>;
    let namen: Record<string, string> = {};
    if (auftrag.direction === 'push') {
      let ids = auswahl(lokalesRegister, lokalAlle, auftrag.select);
      if (auftrag.dependencies) ids = withDependencies(lokal, ids);
      quelle = new Map(ids.map((id) => [id, lokal.get(id)!]));
      regQuelle = registerZeilen(lokalesRegister, keys);
      const r = await frage<Lesung & { error?: string }>(peer, 'POST', '/api/transfer/peer/read', { ids, registry: [...regQuelle.keys()] });
      if (r.status !== 200) return { code: r.status === 403 ? 403 : 502, error: `${peer.name}: ${r.body?.error ?? r.status}` };
      ziel = new Map(r.body.entities.map((e) => [e.id, e]));
      regZiel = new Map(Object.entries(r.body.registry).filter(([, v]) => v !== undefined && v !== null));
    } else {
      const r = await frage<Lesung & { error?: string }>(peer, 'POST', '/api/transfer/peer/read', {
        ...(auftrag.select ? { select: auftrag.select } : {}),
        dependencies: Boolean(auftrag.dependencies),
        registry: keys,
      });
      if (r.status !== 200) return { code: r.status === 403 ? 403 : 502, error: `${peer.name}: ${r.body?.error ?? r.status}` };
      quelle = new Map(r.body.entities.map((e) => [e.id, e]));
      namen = r.body.names;
      ziel = new Map([...quelle.keys()].filter((id) => lokal.has(id)).map((id) => [id, lokal.get(id)!]));
      regQuelle = new Map(Object.entries(r.body.registry).filter(([, v]) => v !== undefined && v !== null));
      regZiel = registerZeilen(lokalesRegister, [...regQuelle.keys()]);
    }
    const basis = await repo.transferBase(peer.name, [...quelle.keys(), ...[...regQuelle.keys()].map((k) => `registry:${k}`)]);
    const ebene = (id: string) => namen[id] ?? entityName(lokal.get(id) ?? quelle.get(id) ?? ziel.get(id)) ?? id;
    const items: TransferItem[] = [];
    for (const e of quelle.values()) items.push(transferItem(basis.get(e.id) as Entity | undefined, e, ziel.get(e.id), ebene));
    for (const [key, row] of regQuelle) {
      if (row === undefined) continue;
      items.push(registryItem(key, basis.get(`registry:${key}`), row, regZiel.get(key)));
    }
    return { items, quelle, ziel, basis, regQuelle, regZiel, lokal, lokalesRegister };
  }

  app.post<{ Body: unknown }>('/api/transfer/preview', async (request, reply) => {
    const a = await ausloeser(request);
    if (nichtDa(a)) return reply.code(a.code).send({ error: a.error });
    const parsed = TransferRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Übernahme ungültig', issues: parsed.error.issues });
    const t0 = Date.now();
    const plan = await plane(a.peer, parsed.data);
    if (nichtDa(plan)) return reply.code(plan.code).send({ error: plan.error });
    const zaehlen = (s: string) => plan.items.filter((i) => i.status === s).length;
    return {
      direction: parsed.data.direction,
      source: parsed.data.direction === 'push' ? 'here' : a.peer.name,
      target: parsed.data.direction === 'push' ? a.peer.name : 'here',
      items: plan.items,
      counts: { new: zaehlen('new'), changed: zaehlen('changed'), conflict: zaehlen('conflict'), unchanged: zaehlen('unchanged'), targetAhead: zaehlen('target-ahead') },
      ms: Date.now() - t0,
    };
  });

  /**
   * **Der Lauf.** Rechnet die Vorschau noch einmal und schreibt nur, wenn
   * jeder gewählte Artikel noch so steht, wie sie ihn zeigte. Schieben:
   * prod nimmt an, vergibt Nummern; dev übernimmt das Ergebnis selbst
   * (beide Seiten stehen danach gleich, wie nach einem Merge). Holen: dev
   * schreibt, was von prod kommt; was auf dev dieselbe Nummer trägt,
   * weicht.
   */
  app.post<{ Body: unknown }>('/api/transfer/run', { bodyLimit: 64 * 1024 * 1024 }, async (request, reply) => {
    const a = await ausloeser(request);
    if (nichtDa(a)) return reply.code(a.code).send({ error: a.error });
    const parsed = TransferRunSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Übernahme ungültig', issues: parsed.error.issues });
    const lauf = parsed.data;
    const plan = await plane(a.peer, lauf);
    if (nichtDa(plan)) return reply.code(plan.code).send({ error: plan.error });
    const gewaehlt = new Set(lauf.apply);
    const items = plan.items.filter((i) => gewaehlt.has(i.id));
    const fehlt = lauf.apply.filter((id) => !plan.items.some((i) => i.id === id));
    const veraltet = items.filter((i) => {
      const e = lauf.expect[i.id];
      return !e || e[0] !== i.sourceKey || e[1] !== i.targetKey;
    });
    if (fehlt.length || veraltet.length) {
      return reply.code(409).send({ error: 'Seit der Vorschau hat sich etwas geändert — neu vorschauen.', stale: [...fehlt, ...veraltet.map((i) => i.id)] });
    }
    const offen: { id: string; keys: string[] }[] = [];
    const ergebnis = new Map<string, Entity>();
    const regErgebnis = new Map<string, unknown>();
    for (const i of items) {
      const wahl = (lauf.choices?.[i.id] ?? {}) as Record<string, TransferChoice>;
      if (i.kind === 'registry') {
        const key = i.id.slice('registry:'.length);
        const f = i.fields[0];
        if (!f) continue;
        let wert: unknown;
        if (f.state === 'source') wert = f.source;
        else if (f.state === 'target') continue;
        else {
          const w = wahl['row'];
          if (w === 'source') wert = f.source;
          else if (w === 'target') continue;
          else if (w && typeof w === 'object') wert = w.value;
          else {
            offen.push({ id: i.id, keys: ['row'] });
            continue;
          }
        }
        regErgebnis.set(key, wert);
        continue;
      }
      const m = mergeTransfer(plan.basis.get(i.id) as Entity | undefined, plan.quelle.get(i.id)!, plan.ziel.get(i.id), wahl);
      if (m.unresolved.length) offen.push({ id: i.id, keys: m.unresolved });
      else ergebnis.set(i.id, m.entity);
    }
    if (offen.length) return reply.code(422).send({ error: `${offen.length} Konflikte sind nicht gelöst — nichts geschrieben.`, unresolved: offen });

    const basisVorher = (keys: string[]) => keys.map((key) => ({ key, value: plan.basis.has(key) ? plan.basis.get(key) : null }));
    const itemsKurz = items.map((i) => ({ id: i.id, name: i.name, type: i.type, status: i.status }));

    if (lauf.direction === 'push') {
      /* Nur, was sich auf prod ändert, geht hinüber. */
      const senden = [...ergebnis.values()].filter((e) => transferKey(e) !== transferKey(plan.ziel.get(e.id)));
      const regSenden = [...regErgebnis].map(([key, value]) => ({ key, value })).filter((r) => stableJson(r.value) !== stableJson(plan.regZiel.get(r.key) ?? null));
      const files: { key: string; data: string }[] = [];
      for (const e of senden) {
        const alt = new Set(dateiSchluessel(plan.ziel.get(e.id)));
        for (const key of dateiSchluessel(e)) {
          if (alt.has(key)) continue;
          const d = await dateiLesen(o.assets, key);
          if (d) files.push({ key, data: d.toString('base64') });
        }
      }
      let remote: { event?: string; numbers?: Record<string, string>; written?: Entity[]; error?: string } = { numbers: {}, written: [] };
      if (senden.length || regSenden.length) {
        const r = await frage<typeof remote & { stale?: string[]; rejected?: Abgelehnt[] }>(a.peer, 'POST', '/api/transfer/peer/apply', {
          from: o.env ?? 'peer',
          by: a.wer.user.name,
          items: senden.map((e) => ({ entity: e, expect: plan.ziel.get(e.id)?.revision ?? null })),
          registry: regSenden,
          files,
        });
        if (r.status !== 200) return reply.code([403, 409, 422].includes(r.status) ? r.status : 502).send({ ...r.body, error: `${a.peer.name}: ${r.body?.error ?? r.status}` });
        remote = r.body;
      }
      /* dev zieht nach: das Ergebnis, mit der Nummer von prod. */
      const geschrieben = new Map((remote.written ?? []).map((e) => [e.id, e]));
      const nummern = new Map(Object.entries(remote.numbers ?? {}));
      const aufDev = new Map<string, Entity>();
      for (const e of ergebnis.values()) {
        const w = geschrieben.get(e.id) ?? e;
        aufDev.set(e.id, w);
      }
      /* Jede Nummer, die auf dev anders heisst als jetzt auf prod — neu
         vergeben oder schon vorher auseinander —, wandert samt Verweisen. */
      const umNummern = new Map<string, string>();
      for (const e of aufDev.values()) {
        const alt = articleId(plan.lokal.get(e.id) ?? ({ components: {} } as Entity));
        const neu = articleId(e);
        if (alt && neu && alt !== neu) umNummern.set(alt, neu);
      }
      const danach = new Map(plan.lokal);
      for (const e of aufDev.values()) danach.set(e.id, e);
      if (umNummern.size) {
        const nicht = [...danach.values()].filter((e) => !aufDev.has(e.id));
        for (const [id, e] of repoint(nicht, new Map(), umNummern)) danach.set(id, e);
      }
      const regLokal = [...regErgebnis].map(([key, value]) => ({ key, value })).filter((r) => stableJson(r.value) !== stableJson(registryRow(plan.lokalesRegister, r.key) ?? null));
      const lokalRegister = mitZeilen(plan.lokalesRegister, regLokal);
      const lokalAenderungen: Aenderung[] = [];
      for (const [id, e] of danach) {
        const vorher = plan.lokal.get(id);
        if (vorher && transferKey(vorher) === transferKey(e)) continue;
        lokalAenderungen.push({ id, before: vorher ? rein(vorher) : null, after: rein(e) });
      }
      const nichtAngeglichen = pruefe(lokalRegister, danach, lokalAenderungen.map((c) => c.after!));
      const raus = new Set(nichtAngeglichen.map((x) => x.id));
      const lokalSchreiben = lokalAenderungen.filter((c) => !raus.has(c.id));
      const baseKeys = [...ergebnis.keys(), ...[...regErgebnis.keys()].map((k) => `registry:${k}`)];
      const ereignis: LaufEreignis = {
        direction: 'push',
        peer: a.peer.name,
        by: { id: a.wer.user.id, name: a.wer.user.name },
        ...(remote.event ? { remote: remote.event } : {}),
        items: itemsKurz,
        numbers: Object.fromEntries(nummern),
        backup: (remote as { backup?: string | null }).backup ?? null,
        changes: lokalSchreiben,
        registryChanges: regLokal.map((r) => ({ key: r.key, before: registryRow(plan.lokalesRegister, r.key) ?? null, after: r.value })),
        baseBefore: basisVorher(baseKeys),
        ...(nichtAngeglichen.length ? { notAligned: nichtAngeglichen } : {}),
      };
      const id = await repo.appendEvent('transfer', undefined, { ...ereignis, count: items.length });
      await schreibeRegister(repo, plan.lokalesRegister, regLokal);
      for (const c of lokalSchreiben) await repo.putEntity(c.after!);
      await repo.keepTransferBase(a.peer.name, [
        ...[...aufDev.values()].map((e) => ({ key: e.id, value: rein(e) })),
        ...[...regErgebnis].map(([k, v]) => ({ key: `registry:${k}`, value: v })),
      ]);
      return {
        id,
        direction: 'push',
        written: senden.length + regSenden.length,
        numbers: Object.fromEntries(nummern),
        aligned: lokalSchreiben.length,
        notAligned: nichtAngeglichen,
        remote: remote.event ?? null,
      };
    }

    // ------------------------------------------------------------ Holen
    /* Die Nummer gehört prod, auch an einem Artikel, den dev schon hat. */
    const umNummern = new Map<string, string>();
    for (const [id, e] of ergebnis) {
      const vonProd = articleId(plan.quelle.get(id)!);
      const aufDev = articleId(e);
      if (vonProd && vonProd !== aufDev) {
        ergebnis.set(id, withNumber(e, vonProd));
        if (aufDev) umNummern.set(aufDev, vonProd);
      }
    }
    const kommend = [...ergebnis.values()];
    const weichen = yieldNumbers([...plan.lokal.values()].filter((e) => !ergebnis.has(e.id)), kommend);
    const danach = new Map(plan.lokal);
    for (const e of kommend) danach.set(e.id, e);
    for (const [peg, neu] of weichen) {
      const e = danach.get(peg)!;
      umNummern.set(articleId(e), neu);
      danach.set(peg, withNumber(e, neu));
    }
    if (umNummern.size) {
      const nicht = [...danach.values()].filter((e) => !ergebnis.has(e.id));
      for (const [id, e] of repoint(nicht, new Map(), umNummern)) danach.set(id, weichen.has(id) ? withNumber(e, weichen.get(id)!) : e);
    }
    const regRows = [...regErgebnis].map(([key, value]) => ({ key, value }));
    const neuesRegister = mitZeilen(plan.lokalesRegister, regRows);
    const geprueft = RegistrySchema.safeParse(neuesRegister);
    if (!geprueft.success) return reply.code(422).send({ error: 'Das Register danach wäre ungültig — nichts geschrieben.' });
    const changes: Aenderung[] = [];
    for (const [id, e] of danach) {
      const vorher = plan.lokal.get(id);
      if (vorher && transferKey(vorher) === transferKey(e)) continue;
      changes.push({ id, before: vorher ? rein(vorher) : null, after: rein(e) });
    }
    const abgelehnt = pruefe(neuesRegister, danach, changes.map((c) => c.after!));
    if (abgelehnt.length) return reply.code(422).send({ error: `${abgelehnt.length} Artikel bestehen die Prüfung nicht — nichts geschrieben.`, rejected: abgelehnt });
    const registryChanges = regRows.map((r) => ({ key: r.key, before: registryRow(plan.lokalesRegister, r.key) ?? null, after: r.value }));
    let backup: string | null = null;
    if (o.sicherung) {
      backup = await o.sicherung.schreibe(`${stempel()}-vor-uebernahme-von-${sicher(a.peer.name)}.json`, {
        format: 'nebelwacht/1',
        at: new Date().toISOString(),
        note: 'Vor einer Übernahme (T-130): die Artikel und Registerzeilen, wie sie vorher standen.',
        registryRows: Object.fromEntries(registryChanges.map((r) => [r.key, r.before])),
        entities: changes.flatMap((c) => (c.before ? [c.before] : [])),
      });
    }
    /* Die Bilder: was die neuen Asset-Artikel nennen und hier fehlt. */
    let dateien = 0;
    for (const e of kommend) {
      for (const key of dateiSchluessel(e)) {
        if (await o.assets.has(key)) continue;
        const d = await a.peer.datei(key).catch(() => null);
        if (d) {
          await o.assets.put(key, d);
          dateien += 1;
        }
      }
    }
    const baseKeys = [...ergebnis.keys(), ...[...regErgebnis.keys()].map((k) => `registry:${k}`)];
    const ereignis: LaufEreignis = {
      direction: 'pull',
      peer: a.peer.name,
      by: { id: a.wer.user.id, name: a.wer.user.name },
      items: itemsKurz,
      numbers: Object.fromEntries(weichen),
      backup,
      changes,
      registryChanges,
      baseBefore: basisVorher(baseKeys),
    };
    const id = await repo.appendEvent('transfer', undefined, { ...ereignis, count: items.length });
    await schreibeRegister(repo, plan.lokalesRegister, regRows);
    for (const c of changes) await repo.putEntity(c.after!);
    /* Die Basis ist der Stand von prod: was dev davon abweichend behielt,
       schlägt die nächste Übernahme nach prod vor. */
    await repo.keepTransferBase(a.peer.name, [
      ...[...ergebnis.keys()].map((k) => ({ key: k, value: rein(plan.quelle.get(k)!) })),
      ...[...regErgebnis.keys()].map((k) => ({ key: `registry:${k}`, value: plan.regQuelle.get(k) })),
    ]);
    return { id, direction: 'pull', written: changes.length + registryChanges.length, numbers: Object.fromEntries(weichen), files: dateien, backup };
  });

  /** Eine Übernahme zurücknehmen — auf prod (Schieben) und hier. */
  app.post<{ Params: { id: string }; Body: { force?: boolean; dryRun?: boolean } | null }>('/api/transfer/:id/undo', async (request, reply) => {
    const a = await ausloeser(request);
    if (nichtDa(a)) return reply.code(a.code).send({ error: a.error });
    const ereignis = await repo.getEvent(request.params.id);
    if (!ereignis || ereignis.name !== 'transfer') return reply.code(404).send({ error: 'Nicht gefunden' });
    if ((await repo.listEvents({ name: 'transfer.undone', subject: ereignis.id, limit: 1, light: true })).length) {
      return reply.code(409).send({ error: 'Schon rückgängig gemacht.' });
    }
    const p = ereignis.payload as LaufEreignis;
    const force = Boolean(request.body?.force);
    const dryRun = Boolean(request.body?.dryRun);
    /* Zuerst hier prüfen, dann drüben zurücknehmen, dann hier. */
    const probe = await zuruecknehmen(repo, p.changes ?? [], p.registryChanges ?? [], force, true);
    if (probe.status !== 200) return reply.code(probe.status).send({ ...probe.body, side: 'here' });
    let remote: Record<string, unknown> | null = null;
    if (p.direction === 'push' && p.remote) {
      const r = await frage<Record<string, unknown>>(a.peer, 'POST', `/api/transfer/peer/undo/${encodeURIComponent(p.remote)}`, { force, dryRun });
      if (r.status !== 200) return reply.code([403, 409, 422].includes(r.status) ? r.status : 502).send({ ...r.body, side: a.peer.name });
      remote = r.body;
    }
    if (dryRun) return { dryRun: true, here: probe.body, remote };
    const hier = await zuruecknehmen(repo, p.changes ?? [], p.registryChanges ?? [], force, false);
    if (hier.status !== 200) return reply.code(hier.status).send({ ...hier.body, side: 'here', remote });
    await repo.keepTransferBase(p.peer, p.baseBefore ?? []);
    await repo.appendEvent('transfer.undone', ereignis.id, { by: { id: a.wer.user.id, name: a.wer.user.name }, restored: hier.body['restored'], remote });
    return { restored: hier.body['restored'], remote };
  });

  /**
   * **Überklonen**: dev wird ganz aus prod neu bestückt — Register,
   * Artikel und Bilder; nichts, was nur auf dev stand, überlebt. Die
   * Konten, Rollen und Tokens von dev bleiben (REQ-199). Nur mit
   * Sicherung (die ganze Ausfuhr von dev, vorher) und `confirm:
   * "OVERWRITE"`; `dryRun` sagt, was geschähe.
   */
  app.post<{ Body: { confirm?: string; dryRun?: boolean } | null }>('/api/transfer/clone', async (request, reply) => {
    const a = await ausloeser(request);
    if (nichtDa(a)) return reply.code(a.code).send({ error: a.error });
    const dryRun = Boolean(request.body?.dryRun);
    if (!dryRun && request.body?.confirm !== 'OVERWRITE') {
      return reply.code(409).send({ error: 'Überklonen ersetzt alles hier. Bestätige mit "confirm": "OVERWRITE".' });
    }
    if (!dryRun && !o.sicherung) {
      return reply.code(409).send({ error: 'Ohne Sicherungsverzeichnis (ATLAS_BACKUP_DIR) wird nicht überklont.' });
    }
    const r = await frage<{ format?: string; registry?: Registry; entities?: Entity[]; error?: string }>(a.peer, 'GET', '/api/transfer/peer/stock');
    if (r.status !== 200 || !Array.isArray(r.body.entities)) return reply.code(502).send({ error: `${a.peer.name}: ${r.body?.error ?? r.status}` });
    const stock = r.body as { registry: Registry; entities: Entity[] };
    const hier = await repo.listEntities();
    try {
      if (dryRun) {
        const probe = await runImport(repo, { format: 'nebelwacht/1', registry: stock.registry, entities: stock.entities }, { replace: true, dryRun: true });
        return { dryRun: true, here: hier.length, incoming: stock.entities.length, text: probe.text };
      }
      const backup = await o.sicherung!.schreibe(`${stempel()}-vor-ueberklonen.json`, {
        format: 'nebelwacht/1',
        at: new Date().toISOString(),
        note: 'Der ganze Bestand vor dem Überklonen (T-130). Zurück: import.js <datei> --replace.',
        registry: await repo.getRegistry(),
        entities: hier.map(rein),
      });
      const id = await repo.appendEvent('transfer.clone', undefined, {
        direction: 'clone',
        peer: a.peer.name,
        by: { id: a.wer.user.id, name: a.wer.user.name },
        backup,
        count: stock.entities.length,
        replaced: hier.length,
      });
      const ergebnis = await runImport(repo, { format: 'nebelwacht/1', registry: stock.registry, entities: stock.entities }, { replace: true });
      let dateien = 0;
      for (const e of stock.entities) {
        for (const key of dateiSchluessel(e)) {
          if (await o.assets.has(key)) continue;
          const d = await a.peer.datei(key).catch(() => null);
          if (d) {
            await o.assets.put(key, d);
            dateien += 1;
          }
        }
      }
      /* Danach stehen beide gleich: das ist die neue Basis. */
      await repo.clearTransferBase(a.peer.name);
      await repo.keepTransferBase(a.peer.name, stock.entities.map((e) => ({ key: e.id, value: rein(e) })));
      return { id, backup, written: ergebnis.geschrieben, removed: ergebnis.geloescht, files: dateien, text: ergebnis.text };
    } catch (error) {
      if (error instanceof ImportFehler) return reply.code(422).send({ error: error.message });
      throw error;
    }
  });
}
