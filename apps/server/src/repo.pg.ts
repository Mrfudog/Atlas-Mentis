/**
 * The Postgres adapter for the storage port.
 *
 * Entities are assembled from the three tables on read and written back
 * component by component, because that is what makes `sparse by default`
 * real: a component that is not set has no row at all.
 */

import type { Pool } from 'pg';
import type { Entity, Registry, Relation } from '@nw/model';
import type { Repository } from './repo.js';

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
}
