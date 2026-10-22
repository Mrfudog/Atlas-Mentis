/**
 * The storage port.
 *
 * Routes talk to this, never to Postgres directly, so the whole HTTP surface
 * is testable without a database — and so the day a different store is wanted,
 * one file changes rather than every handler.
 */

import type { Entity, Registry } from '@nw/model';
import type { ApiToken, Invite, User } from './auth.js';

/** Was die Ablage über einen Zugang weiss. Der Hash bleibt hier und geht
 *  nie an eine Route — deshalb trägt `User` ihn nicht. */
export interface StoredUser extends User {
  passwordHash: string;
}
export interface SessionRow {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

/**
 * **Die Revision stimmt nicht mehr** (REQ-192): seit dem Lesen hat jemand
 * anders geschrieben, oder es gibt den Artikel schon, obwohl er neu sein
 * sollte. Geschrieben ist nichts; `current` ist die Revision, die gilt
 * (`null`: es gibt ihn nicht mehr).
 */
export class RevisionConflict extends Error {
  constructor(
    readonly id: string,
    readonly expected: number | null,
    readonly current: number | null,
  ) {
    super(`Revision von ${id}: erwartet ${expected ?? 'keine'}, steht ${current ?? 'keine'}`);
  }
}

/** Wogegen geschrieben wird: eine Revision, oder `null` für „neu". Ohne
 *  Angabe wird nicht geprüft — das tun Einfuhr, Massenänderung und die
 *  Folgeschreiben einer Route, die selbst schon geprüft hat. */
export interface PutOptions {
  expectRevision?: number | null;
}

/** Ein Eintrag im Protokoll (`event_log`). */
export interface StoredEvent {
  id: string;
  name: string;
  subject?: string | undefined;
  payload: unknown;
  at: string;
}

export interface EventFilter {
  name?: string;
  subject?: string;
  limit?: number;
  /** Ohne `payload.changes` — die alten Fassungen einer Massenänderung
   *  sind gross, und eine Liste braucht sie nicht. */
  light?: boolean;
  /** Eines dieser Subjekte — **oder** `payload[key] = value`, wenn
   *  `orPayload` dasteht (T-172: die Würfe einer Sitzung sind die auf ihr
   *  und die, die während ihr fielen). */
  subjects?: string[];
  orPayload?: { key: string; value: string };
  /** So viele der Neusten überspringen — zum Weiterblättern. */
  offset?: number;
}

/** **Der letzte fertige Stand** eines Artikels (REQ-237, E-012): eine Kopie,
 *  wie er war, als eine Spielerin ihn nach `ready` änderte. `at` ist, wann
 *  dieser Stand geschrieben wurde. */
/**
 * **Ein gespeicherter Filter** (T-137): eine Filtergruppe einer Listenseite
 * — der Kampagne (`campaignId`, die Leitung pflegt sie) oder eines Kontos
 * (`userId`, nur seine). Genau eins von beiden ist gesetzt. `isDefault`
 * gibt es nur an einer Gruppe der Kampagne und je Seite einmal: sie ist
 * die Vorgabe der Seite. Kein Artikel — eine Konto-Id wandert nicht mit
 * der Ausfuhr (REQ-199).
 */
export interface ListFilterRow {
  id: string;
  /** `compendium`, `world`, `story`, `rules` — die Seite, an der sie steht. */
  page: string;
  name: string;
  campaignId: string | null;
  userId: string | null;
  filter: Record<string, unknown>;
  isDefault: boolean;
  rank: number;
}

export interface ReadyStand {
  entity: Entity;
  at: string;
}

/** Eine Zeile aus `app_user_layer` (T-098). */
export interface LayerGrant {
  userId: string;
  layerId: string;
  owner: boolean;
  /** **Die Spielerebene dieses Kontos in dieser Kampagne** (T-164): steht
   *  hier, neben dem Konto, und nicht an der Ebene (REQ-199). */
  campaign?: string;
}

export interface Repository {
  getRegistry(): Promise<Registry>;
  putRegistryPart<K extends keyof Registry>(part: K, value: Registry[K]): Promise<void>;

  listEntities(): Promise<Entity[]>;
  /**
   * Woran man sieht, ob sich der Bestand seit dem letzten Mal geändert hat.
   * Gleicher Stempel heisst gleicher Bestand — darauf baut der Index der
   * Liste (`liste.ts`), der je Stempel und Betrachter einmal gerechnet wird.
   */
  version(): Promise<string>;
  /** Wie viele Artikel es gibt — ohne sie alle zu laden. */
  countEntities(): Promise<number>;
  /** Den gehaltenen Bestand loslassen (T-296): wer gleich zehntausende
   *  Artikel schreibt, will ihn nicht bei jedem Schreiben nachgeführt
   *  haben — das kopierte jedes Mal die ganze Liste und zählte zweimal die
   *  Tabelle. Das nächste Lesen liest neu. */
  releaseHeld?(): void;
  /** Wie gross die Datenbank auf der Platte ist (Bytes) — nur, wo es eine
   *  gibt; ein grosser Lauf misst vorher und nachher (T-296). */
  databaseBytes?(): Promise<number>;
  getEntity(id: string): Promise<Entity | undefined>;
  /** Schreibt und zählt die Revision hoch. Mit `expectRevision` atomar
   *  geprüft — wirft `RevisionConflict`, ohne etwas zu schreiben. */
  putEntity(entity: Entity, options?: PutOptions): Promise<Entity>;
  deleteEntity(id: string): Promise<boolean>;

  /** REQ-003: append-only change chain. Gibt die Id des Eintrags zurück. */
  appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<string>;
  getEvent(id: string): Promise<StoredEvent | undefined>;
  /** Die neusten zuerst. */
  listEvents(filter: EventFilter): Promise<StoredEvent[]>;

  // ------------------------------------------------------------- Zugang
  /* Zugänge sind keine Artikel: ein Artikel gehört der Kampagne und wandert
     mit ihr, ein Zugang gehört der Instanz und darf beim Spiegeln von prod
     nach preprod ausdrücklich nicht mitwandern (REQ-199). */
  countUsers(): Promise<number>;
  findUserByName(nameFold: string): Promise<StoredUser | undefined>;
  getUser(id: string): Promise<StoredUser | undefined>;
  listUsers(): Promise<User[]>;
  putUser(user: StoredUser): Promise<void>;

  /** Alle Konten, die diese Figur führen. Die Gegenrichtung von
   *  `User.actorIds` — gefragt wird sie dort, wo etwas freigegeben werden
   *  soll: „wer hat das angelegt" ist die Frage, an der das Freigeben
   *  hängt. */
  usersOfActor(actorId: string): Promise<User[]>;

  /** **Wer diesen Artikel angelegt hat** (REQ-237): eine Zeile neben dem
   *  Konto, nicht im Artikel (REQ-199). `putUser` lässt sie in Ruhe — sie
   *  entsteht beim Anlegen und sonst nirgends. */
  addAuthored(userId: string, entityId: string): Promise<void>;
  /** Die Konten, die diesen Artikel angelegt haben (meist eines, oft keines). */
  authorsOf(entityId: string): Promise<string[]>;
  /** Alle Artikel, die irgendein Konto angelegt hat — was die Leitung
   *  vorgelegt bekommt. */
  authoredArticles(): Promise<string[]>;
  /** **Wer ihn hinzugefügt hat** (T-382): genau ein Konto je Artikel, beim
   *  Anlegen gesetzt, danach fest. Anders als `addAuthored` erlaubt es
   *  nichts — es ist Herkunft für Filter und Spalte „Added by". */
  addCreator(userId: string, entityId: string): Promise<void>;
  /** Artikel-Id → Konto-Id, für alles, dessen Herkunft bekannt ist. */
  creators(): Promise<Map<string, string>>;

  /** **Wer in einer Ebene schreibt** (T-098, E-001): je Konto und Ebene
   *  eine Zeile neben dem Konto (`app_user_layer`), nicht an der Ebene
   *  (REQ-199). `owner` heisst: besitzt sie und sagt, wer sonst darin
   *  schreibt. Ein zweites Setzen ändert nur `owner` — und `campaign`,
   *  wenn es genannt ist: dann ist die Ebene die Spielerebene des Kontos
   *  in dieser Kampagne (T-164). */
  grantLayer(userId: string, layerId: string, owner?: boolean, campaign?: string): Promise<void>;
  revokeLayer(userId: string, layerId: string): Promise<boolean>;
  /** Alle Zeilen — wenige; gefragt, wer eine Ebene besitzt und wer darin schreibt. */
  layerGrants(): Promise<LayerGrant[]>;

  /** **Der letzte fertige Stand** (REQ-237, E-012): alle, die es gibt — es
   *  sind wenige, nur Artikel, die eine Spielerin nach `ready` geändert hat
   *  und die die Leitung noch nicht wieder fertig nannte. Eine Kopie am
   *  Server (`entity_ready`), keine zweite Karte im Artikel. */
  readyStands(): Promise<Map<string, ReadyStand>>;
  /** Merkt den fertigen Stand; steht schon einer da, bleibt der alte —
   *  er ist der, der gilt. */
  keepReadyStand(stand: ReadyStand): Promise<void>;
  /** Der neue Stand gilt (die Leitung nannte ihn fertig) oder der Artikel ist weg. */
  dropReadyStand(entityId: string): Promise<void>;

  /** **Der Stand der letzten Übernahme** (T-130): je Gegenstelle (`peer`,
   *  der Name der anderen Installation) und Schlüssel (Peg-Id oder
   *  `registry:<teil>:<name>`) der Stand, auf dem beide Seiten zuletzt
   *  gleich standen — die Basis des Dreiwege-Vergleichs. Neben dem
   *  Bestand, nicht im Artikel: sie wandert nicht mit einer Ausfuhr. */
  transferBase(peer: string, keys?: Iterable<string>): Promise<Map<string, unknown>>;
  /** `null` nimmt den Schlüssel weg. */
  keepTransferBase(peer: string, rows: { key: string; value: unknown }[]): Promise<void>;
  /** Alles für diese Gegenstelle weg (Überklonen setzt neu). */
  clearTransferBase(peer: string): Promise<void>;

  /** **Wo ein Konto in einem Buch stehen blieb** (T-091, REQ-247): je
   *  Konto und Ebene der zuletzt gelesene Abschnitt. Kein Artikel — ein
   *  Lesezeichen wandert nicht mit der Ausfuhr (wie `app_session`). */
  readingPosition(userId: string, layerId: string): Promise<string | undefined>;
  keepReadingPosition(userId: string, layerId: string, entityId: string): Promise<void>;
  /** **Filtergruppen** (T-137): die der Kampagne und die eigenen dieses
   *  Kontos, nach Seite und Rang. */
  listFilters(campaignId: string | null, userId: string): Promise<ListFilterRow[]>;
  getListFilter(id: string): Promise<ListFilterRow | undefined>;
  /** Schreibt die Gruppe; ist sie die Vorgabe, verliert jede andere der
   *  Kampagne an derselben Seite die Marke — in einem Schritt. */
  putListFilter(row: ListFilterRow): Promise<void>;
  dropListFilter(id: string): Promise<boolean>;
  /** **Die Spalten einer Übersicht als Vorgabe der Kampagne** (T-343):
   *  Schlüssel `seite` oder `seite|Art` → Spalten. Gesetzt von der Leitung,
   *  neben der Kampagne und nicht in ihr — wie die Filtergruppen. */
  listColumnDefaults(campaignId: string): Promise<Record<string, string[]>>;
  /** `null` nimmt die Vorgabe weg. */
  putListColumnDefault(campaignId: string, key: string, columns: string[] | null): Promise<void>;
  /** **Einstellungen je Konto** (T-092): Schlüssel → Wert, wie die Seite
   *  sie schreibt. Wie jemand liest, nicht was gilt — darum am Konto und
   *  in keinem Artikel. */
  getPrefs(userId: string): Promise<Record<string, unknown>>;
  /** `null` nimmt die Einstellung weg. */
  putPref(userId: string, key: string, value: unknown): Promise<void>;

  /* Einladungen. Ein Code erlaubt eine Registrierung und sonst nichts; ein
     offener Registrierungsendpunkt wäre ein Loch, und ein Passwort, das die
     Spielleitung für jeden ausdenkt und weitergibt, geht über einen Kanal,
     der keiner ist. */
  putInvite(invite: Invite): Promise<void>;
  getInvite(codeHash: string): Promise<Invite | undefined>;
  listInvites(): Promise<Invite[]>;
  dropInvite(codeHash: string): Promise<boolean>;
  /** Zieht einen Gebrauch ab und sagt, ob er noch zu haben war. Beides in
   *  einem Schritt, weil zwei Leute denselben Link gleichzeitig öffnen. */
  useInvite(codeHash: string, now: string): Promise<Invite | undefined>;

  createSession(row: SessionRow & { agent?: string | undefined }): Promise<void>;
  /** Gibt den Nutzer zurück und schiebt das Ablaufdatum nach; eine
      abgelaufene Sitzung verschwindet dabei. */
  touchSession(tokenHash: string, until: string): Promise<StoredUser | undefined>;
  dropSession(tokenHash: string): Promise<void>;
  dropSessionsOf(userId: string): Promise<number>;

  /* API-Tokens (W9). Wie die Sitzung: der Hash steht hier, der Klartext
     nur in der Antwort auf das Anlegen. */
  createToken(token: ApiToken): Promise<void>;
  /** Die Tokens eines Kontos, ohne Hash. */
  listTokens(userId: string): Promise<ApiToken[]>;
  dropToken(userId: string, id: string): Promise<boolean>;
  /** Das Konto zu einem gültigen Token, und vermerkt den Gebrauch. Ein
   *  abgelaufenes gilt nicht. */
  useToken(tokenHash: string): Promise<{ user: StoredUser; token: ApiToken } | undefined>;

  /** Fehlversuche im Fenster, je Konto UND Herkunft. */
  countAttempts(nameFold: string, origin: string, since: string): Promise<number>;
  noteAttempt(nameFold: string, origin: string): Promise<void>;
  clearAttempts(nameFold: string, origin: string): Promise<void>;
}

const emptyRegistry = (): Registry => ({
  interfaces: {},
  relations: {},
  views: {},
  units: {},
  vars: {},
});

/** Used by the tests, and by `--seed-only` runs that never touch Postgres. */
export class InMemoryRepository implements Repository {
  private registry: Registry;
  private entities = new Map<string, Entity>();
  /** Zählt jedes Schreiben und Löschen; das ist der Stempel. */
  private rev = 0;
  readonly events: StoredEvent[] = [];

  constructor(registry: Registry = emptyRegistry(), entities: Entity[] = []) {
    this.registry = structuredClone(registry);
    for (const entity of entities) this.entities.set(entity.id, structuredClone(entity));
  }

  async getRegistry(): Promise<Registry> {
    return structuredClone(this.registry);
  }

  async putRegistryPart<K extends keyof Registry>(part: K, value: Registry[K]): Promise<void> {
    this.registry = { ...this.registry, [part]: structuredClone(value) };
  }

  async listEntities(): Promise<Entity[]> {
    return [...this.entities.values()].map((e) => structuredClone(e));
  }

  async version(): Promise<string> {
    return String(this.rev);
  }

  async countEntities(): Promise<number> {
    return this.entities.size;
  }

  async getEntity(id: string): Promise<Entity | undefined> {
    const found = this.entities.get(id);
    return found ? structuredClone(found) : undefined;
  }

  async putEntity(entity: Entity, options: PutOptions = {}): Promise<Entity> {
    const vorher = this.entities.get(entity.id)?.revision ?? null;
    if (options.expectRevision !== undefined && options.expectRevision !== vorher) {
      throw new RevisionConflict(entity.id, options.expectRevision, vorher);
    }
    const stored: Entity = {
      ...structuredClone(entity),
      /* Wie `created_at` in Postgres: beim ersten Schreiben gesetzt, danach
         fest — ein zurückgeholter Artikel (Undo) bringt seinen mit (T-382). */
      createdAt: this.entities.get(entity.id)?.createdAt ?? entity.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: (vorher ?? 0) + 1,
    };
    this.entities.set(stored.id, stored);
    this.rev += 1;
    return structuredClone(stored);
  }

  async deleteEntity(id: string): Promise<boolean> {
    this.rev += 1;
    return this.entities.delete(id);
  }

  async appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<string> {
    const id = `ev-${this.events.length + 1}`;
    this.events.push({ id, name, subject, payload: structuredClone(payload), at: new Date().toISOString() });
    return id;
  }
  async getEvent(id: string): Promise<StoredEvent | undefined> {
    const e = this.events.find((x) => x.id === id);
    return e ? structuredClone(e) : undefined;
  }
  async listEvents(filter: EventFilter): Promise<StoredEvent[]> {
    return this.events
      .filter((e) => (!filter.name || e.name === filter.name) && (!filter.subject || e.subject === filter.subject))
      .filter((e) => {
        if (!filter.subjects) return true;
        if (e.subject && filter.subjects.includes(e.subject)) return true;
        const p = filter.orPayload;
        return !!p && (e.payload as Record<string, unknown> | null)?.[p.key] === p.value;
      })
      .reverse()
      .slice(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50))
      .map((e) => {
        const kopie = structuredClone(e);
        if (filter.light && kopie.payload && typeof kopie.payload === 'object') {
          delete (kopie.payload as Record<string, unknown>)['changes'];
        }
        return kopie;
      });
  }

  // ------------------------------------------------------------- Zugang

  private users = new Map<string, StoredUser>();
  private invites = new Map<string, Invite>();
  private sessions = new Map<string, SessionRow>();
  private attempts: { key: string; at: string }[] = [];

  async countUsers(): Promise<number> {
    return this.users.size;
  }
  async findUserByName(nameFold: string): Promise<StoredUser | undefined> {
    for (const u of this.users.values()) {
      if (u.name.trim().toLocaleLowerCase('de') === nameFold) return this.mitEbenen(u);
    }
    return undefined;
  }
  async getUser(id: string): Promise<StoredUser | undefined> {
    const u = this.users.get(id);
    return u ? this.mitEbenen(u) : undefined;
  }
  async listUsers(): Promise<User[]> {
    return [...this.users.values()].map((u) => {
      const { passwordHash: _hash, ...rest } = this.mitEbenen(u);
      return rest;
    });
  }
  /** Wie in Postgres: die Ebenen kommen aus ihrer eigenen Tabelle dazu. */
  private mitEbenen(u: StoredUser): StoredUser {
    const meine = [...this.ebenenRechte.values()].filter((g) => g.userId === u.id);
    return {
      ...u,
      authoredIds: [...(u.authoredIds ?? [])],
      layerIds: meine.map((g) => g.layerId),
      ownedLayerIds: meine.filter((g) => g.owner).map((g) => g.layerId),
    };
  }
  private readonly ebenenRechte = new Map<string, LayerGrant>();
  async grantLayer(userId: string, layerId: string, owner = false, campaign?: string): Promise<void> {
    if (!this.users.has(userId)) return;
    const vorher = this.ebenenRechte.get(`${userId}|${layerId}`)?.campaign;
    const k = campaign ?? vorher;
    this.ebenenRechte.set(`${userId}|${layerId}`, { userId, layerId, owner, ...(k ? { campaign: k } : {}) });
  }
  async revokeLayer(userId: string, layerId: string): Promise<boolean> {
    return this.ebenenRechte.delete(`${userId}|${layerId}`);
  }
  async layerGrants(): Promise<LayerGrant[]> {
    return [...this.ebenenRechte.values()].map((g) => ({ ...g }));
  }
  async putUser(user: StoredUser): Promise<void> {
    this.users.set(user.id, {
      ...user,
      actorIds: [...(user.actorIds ?? [])],
      roles: { ...(user.roles ?? {}) },
      /* Wie in Postgres: was jemand angelegt hat, schreibt `putUser` nicht —
         und die Ebenen auch nicht (die stehen in `ebenenRechte`). */
      authoredIds: [...(this.users.get(user.id)?.authoredIds ?? [])],
      layerIds: undefined,
      ownedLayerIds: undefined,
      /* Wie `created_at` in Postgres: beim ersten Schreiben gesetzt, danach fest (T-163). */
      createdAt: this.users.get(user.id)?.createdAt ?? user.createdAt ?? new Date().toISOString(),
    });
  }
  async addAuthored(userId: string, entityId: string): Promise<void> {
    const u = this.users.get(userId);
    if (!u) return;
    const l = (u.authoredIds ??= []);
    if (!l.includes(entityId)) l.push(entityId);
  }
  async authorsOf(entityId: string): Promise<string[]> {
    return [...this.users.values()].filter((u) => (u.authoredIds ?? []).includes(entityId)).map((u) => u.id);
  }
  async authoredArticles(): Promise<string[]> {
    return [...new Set([...this.users.values()].flatMap((u) => u.authoredIds ?? []))];
  }
  private readonly erschaffer = new Map<string, string>();
  async addCreator(userId: string, entityId: string): Promise<void> {
    if (!this.users.has(userId) || this.erschaffer.has(entityId)) return;
    this.erschaffer.set(entityId, userId);
  }
  async creators(): Promise<Map<string, string>> {
    return new Map(this.erschaffer);
  }
  private readonly fertig = new Map<string, ReadyStand>();
  async readyStands(): Promise<Map<string, ReadyStand>> {
    return new Map([...this.fertig].map(([k, v]) => [k, structuredClone(v)]));
  }
  async keepReadyStand(stand: ReadyStand): Promise<void> {
    if (!this.fertig.has(stand.entity.id)) this.fertig.set(stand.entity.id, structuredClone(stand));
  }
  async dropReadyStand(entityId: string): Promise<void> {
    this.fertig.delete(entityId);
  }
  private readonly basis = new Map<string, Map<string, unknown>>();
  async transferBase(peer: string, keys?: Iterable<string>): Promise<Map<string, unknown>> {
    const alle = this.basis.get(peer) ?? new Map<string, unknown>();
    if (!keys) return new Map([...alle].map(([k, v]) => [k, structuredClone(v)]));
    const raus = new Map<string, unknown>();
    for (const k of keys) if (alle.has(k)) raus.set(k, structuredClone(alle.get(k)));
    return raus;
  }
  async keepTransferBase(peer: string, rows: { key: string; value: unknown }[]): Promise<void> {
    const alle = this.basis.get(peer) ?? this.basis.set(peer, new Map()).get(peer)!;
    for (const r of rows) {
      if (r.value === null || r.value === undefined) alle.delete(r.key);
      else alle.set(r.key, structuredClone(r.value));
    }
  }
  async clearTransferBase(peer: string): Promise<void> {
    this.basis.delete(peer);
  }
  private readonly lesestand = new Map<string, string>();
  async readingPosition(userId: string, layerId: string): Promise<string | undefined> {
    return this.lesestand.get(`${userId}|${layerId}`);
  }
  async keepReadingPosition(userId: string, layerId: string, entityId: string): Promise<void> {
    this.lesestand.set(`${userId}|${layerId}`, entityId);
  }
  private readonly filtergruppen = new Map<string, ListFilterRow>();
  async listFilters(campaignId: string | null, userId: string): Promise<ListFilterRow[]> {
    return [...this.filtergruppen.values()]
      .filter((f) => (campaignId !== null && f.campaignId === campaignId) || f.userId === userId)
      .sort((a, b) => a.page.localeCompare(b.page) || Number(!!a.userId) - Number(!!b.userId) || a.rank - b.rank || a.name.localeCompare(b.name))
      .map((f) => structuredClone(f));
  }
  async getListFilter(id: string): Promise<ListFilterRow | undefined> {
    const f = this.filtergruppen.get(id);
    return f ? structuredClone(f) : undefined;
  }
  async putListFilter(row: ListFilterRow): Promise<void> {
    if (row.isDefault) {
      for (const f of this.filtergruppen.values()) {
        if (f.id !== row.id && f.campaignId === row.campaignId && f.page === row.page) f.isDefault = false;
      }
    }
    this.filtergruppen.set(row.id, structuredClone(row));
  }
  async dropListFilter(id: string): Promise<boolean> {
    return this.filtergruppen.delete(id);
  }
  private readonly spaltenVorgaben = new Map<string, Record<string, string[]>>();
  async listColumnDefaults(campaignId: string): Promise<Record<string, string[]>> {
    return structuredClone(this.spaltenVorgaben.get(campaignId) ?? {});
  }
  async putListColumnDefault(campaignId: string, key: string, columns: string[] | null): Promise<void> {
    const v = this.spaltenVorgaben.get(campaignId) ?? {};
    if (columns === null) delete v[key];
    else v[key] = [...columns];
    this.spaltenVorgaben.set(campaignId, v);
  }
  private readonly prefs = new Map<string, Record<string, unknown>>();
  async getPrefs(userId: string): Promise<Record<string, unknown>> {
    return structuredClone(this.prefs.get(userId) ?? {});
  }
  async putPref(userId: string, key: string, value: unknown): Promise<void> {
    if (!this.users.has(userId)) return;
    const p = this.prefs.get(userId) ?? {};
    if (value === null || value === undefined) delete p[key];
    else p[key] = structuredClone(value);
    this.prefs.set(userId, p);
  }
  async usersOfActor(actorId: string): Promise<User[]> {
    return [...this.users.values()]
      .filter((u) => (u.actorIds ?? []).includes(actorId))
      .map(({ passwordHash: _hash, ...rest }) => ({
        ...rest,
        actorIds: [...rest.actorIds],
        roles: { ...(rest.roles ?? {}) },
      }));
  }

  async putInvite(invite: Invite): Promise<void> {
    this.invites.set(invite.codeHash, {
      createdAt: new Date().toISOString(),
      ...invite,
    });
  }
  async getInvite(codeHash: string): Promise<Invite | undefined> {
    const i = this.invites.get(codeHash);
    return i ? { ...i } : undefined;
  }
  async listInvites(): Promise<Invite[]> {
    return [...this.invites.values()].map((i) => ({ ...i }));
  }
  async dropInvite(codeHash: string): Promise<boolean> {
    return this.invites.delete(codeHash);
  }
  async useInvite(codeHash: string, now: string): Promise<Invite | undefined> {
    const i = this.invites.get(codeHash);
    if (!i) return undefined;
    if (i.expiresAt && i.expiresAt <= now) return undefined;
    if (i.usesLeft != null) {
      if (i.usesLeft <= 0) return undefined;
      i.usesLeft -= 1;
      if (i.usesLeft <= 0) this.invites.delete(codeHash);
    }
    return { ...i };
  }

  async createSession(row: SessionRow): Promise<void> {
    this.sessions.set(row.tokenHash, { ...row });
  }
  async touchSession(tokenHash: string, until: string): Promise<StoredUser | undefined> {
    const row = this.sessions.get(tokenHash);
    if (!row) return undefined;
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(tokenHash);
      return undefined;
    }
    row.expiresAt = until;
    return this.getUser(row.userId);
  }
  async dropSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
  async dropSessionsOf(userId: string): Promise<number> {
    let n = 0;
    for (const [k, v] of this.sessions) {
      if (v.userId === userId) {
        this.sessions.delete(k);
        n += 1;
      }
    }
    return n;
  }

  private tokens = new Map<string, ApiToken>();
  async createToken(token: ApiToken): Promise<void> {
    this.tokens.set(token.id, { ...token, createdAt: token.createdAt ?? new Date().toISOString() });
  }
  async listTokens(userId: string): Promise<ApiToken[]> {
    return [...this.tokens.values()]
      .filter((t) => t.userId === userId)
      .map(({ tokenHash: _h, ...t }) => ({ ...t, tokenHash: '' }));
  }
  async dropToken(userId: string, id: string): Promise<boolean> {
    const t = this.tokens.get(id);
    if (!t || t.userId !== userId) return false;
    return this.tokens.delete(id);
  }
  async useToken(tokenHash: string): Promise<{ user: StoredUser; token: ApiToken } | undefined> {
    const t = [...this.tokens.values()].find((x) => x.tokenHash === tokenHash);
    if (!t || new Date(t.expiresAt).getTime() <= Date.now()) return undefined;
    t.lastUsedAt = new Date().toISOString();
    const user = await this.getUser(t.userId);
    return user ? { user, token: { ...t } } : undefined;
  }

  async countAttempts(nameFold: string, origin: string, since: string): Promise<number> {
    const key = `${nameFold}|${origin}`;
    return this.attempts.filter((a) => a.key === key && a.at >= since).length;
  }
  async noteAttempt(nameFold: string, origin: string): Promise<void> {
    this.attempts.push({ key: `${nameFold}|${origin}`, at: new Date().toISOString() });
  }
  async clearAttempts(nameFold: string, origin: string): Promise<void> {
    const key = `${nameFold}|${origin}`;
    this.attempts = this.attempts.filter((a) => a.key !== key);
  }
}
