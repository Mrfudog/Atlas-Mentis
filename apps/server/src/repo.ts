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
}

/** **Der letzte fertige Stand** eines Artikels (REQ-237, E-012): eine Kopie,
 *  wie er war, als eine Spielerin ihn nach `ready` änderte. `at` ist, wann
 *  dieser Stand geschrieben wurde. */
export interface ReadyStand {
  entity: Entity;
  at: string;
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
  getEntity(id: string): Promise<Entity | undefined>;
  putEntity(entity: Entity): Promise<Entity>;
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

  /** **Wo ein Konto in einem Buch stehen blieb** (T-091, REQ-247): je
   *  Konto und Ebene der zuletzt gelesene Abschnitt. Kein Artikel — ein
   *  Lesezeichen wandert nicht mit der Ausfuhr (wie `app_session`). */
  readingPosition(userId: string, layerId: string): Promise<string | undefined>;
  keepReadingPosition(userId: string, layerId: string, entityId: string): Promise<void>;

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

  async putEntity(entity: Entity): Promise<Entity> {
    const stored: Entity = { ...structuredClone(entity), updatedAt: new Date().toISOString() };
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
      .reverse()
      .slice(0, filter.limit ?? 50)
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
      if (u.name.trim().toLocaleLowerCase('de') === nameFold) return { ...u, authoredIds: [...(u.authoredIds ?? [])] };
    }
    return undefined;
  }
  async getUser(id: string): Promise<StoredUser | undefined> {
    const u = this.users.get(id);
    return u ? { ...u, authoredIds: [...(u.authoredIds ?? [])] } : undefined;
  }
  async listUsers(): Promise<User[]> {
    return [...this.users.values()].map(({ passwordHash: _hash, ...rest }) => ({ ...rest }));
  }
  async putUser(user: StoredUser): Promise<void> {
    this.users.set(user.id, {
      ...user,
      actorIds: [...(user.actorIds ?? [])],
      roles: { ...(user.roles ?? {}) },
      /* Wie in Postgres: was jemand angelegt hat, schreibt `putUser` nicht. */
      authoredIds: [...(this.users.get(user.id)?.authoredIds ?? [])],
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
  private readonly lesestand = new Map<string, string>();
  async readingPosition(userId: string, layerId: string): Promise<string | undefined> {
    return this.lesestand.get(`${userId}|${layerId}`);
  }
  async keepReadingPosition(userId: string, layerId: string, entityId: string): Promise<void> {
    this.lesestand.set(`${userId}|${layerId}`, entityId);
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
