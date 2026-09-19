/**
 * The storage port.
 *
 * Routes talk to this, never to Postgres directly, so the whole HTTP surface
 * is testable without a database — and so the day a different store is wanted,
 * one file changes rather than every handler.
 */

import type { Entity, Registry } from '@nw/model';

export interface Repository {
  getRegistry(): Promise<Registry>;
  putRegistryPart<K extends keyof Registry>(part: K, value: Registry[K]): Promise<void>;

  listEntities(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | undefined>;
  putEntity(entity: Entity): Promise<Entity>;
  deleteEntity(id: string): Promise<boolean>;

  /** REQ-003: append-only change chain. */
  appendEvent(name: string, subject: string | undefined, payload: unknown): Promise<void>;
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
}
