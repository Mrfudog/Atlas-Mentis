/**
 * The storage port.
 *
 * Routes talk to this, never to Postgres directly, so the whole HTTP surface
 * is testable without a database — and so the day a different store is wanted,
 * one file changes rather than every handler.
 */

import type { Entity, Registry } from '@nw/model';
import type { Invite, User } from './auth.js';

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

export interface Repository {
  getRegistry(): Promise<Registry>;
  putRegistryPart<K extends keyof Registry>(part: K, value: Registry[K]): Promise<void>;

  listEntities(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | undefined>;
  putEntity(entity: Entity): Promise<Entity>;
  deleteEntity(id: string): Promise<boolean>;

  /** REQ-003: append-only change chain. */
  appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<void>;

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

  /** Fehlversuche im Fenster, je Konto UND Herkunft. */
  countAttempts(nameFold: string, origin: string, since: string): Promise<number>;
  noteAttempt(nameFold: string, origin: string): Promise<void>;
  clearAttempts(nameFold: string, origin: string): Promise<void>;
}

const emptyRegistry = (): Registry => ({
  components: {},
  interfaces: {},
  relations: {},
  views: {},
  vars: {},
});

/** Used by the tests, and by `--seed-only` runs that never touch Postgres. */
export class InMemoryRepository implements Repository {
  private registry: Registry;
  private entities = new Map<string, Entity>();
  readonly events: { name: string; subject?: string | undefined; payload: unknown }[] = [];

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

  async getEntity(id: string): Promise<Entity | undefined> {
    const found = this.entities.get(id);
    return found ? structuredClone(found) : undefined;
  }

  async putEntity(entity: Entity): Promise<Entity> {
    const stored: Entity = { ...structuredClone(entity), updatedAt: new Date().toISOString() };
    this.entities.set(stored.id, stored);
    return structuredClone(stored);
  }

  async deleteEntity(id: string): Promise<boolean> {
    return this.entities.delete(id);
  }

  async appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<void> {
    this.events.push({ name, subject, payload });
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
      if (u.name.trim().toLocaleLowerCase('de') === nameFold) return { ...u };
    }
    return undefined;
  }
  async getUser(id: string): Promise<StoredUser | undefined> {
    const u = this.users.get(id);
    return u ? { ...u } : undefined;
  }
  async listUsers(): Promise<User[]> {
    return [...this.users.values()].map(({ passwordHash: _hash, ...rest }) => ({ ...rest }));
  }
  async putUser(user: StoredUser): Promise<void> {
    this.users.set(user.id, { ...user, actorIds: [...(user.actorIds ?? [])] });
  }
  async usersOfActor(actorId: string): Promise<User[]> {
    return [...this.users.values()]
      .filter((u) => (u.actorIds ?? []).includes(actorId))
      .map(({ passwordHash: _hash, ...rest }) => ({ ...rest, actorIds: [...rest.actorIds] }));
  }

  async putInvite(invite: Invite): Promise<void> {
    this.invites.set(invite.codeHash, { ...invite });
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
