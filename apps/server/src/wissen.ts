/**
 * **Der Reiter Knowledge am Artikel** (T-286, REQ-352): welche
 * Informationen es zu einem Artikel gibt — angehängte und solche, deren
 * Geltung ihn trifft (T-285) —, je mit Feldern, Bündeln (`Knowledge`) und
 * wem sie zugeteilt sind; dazu Anlegen, Ändern und Entfernen.
 *
 *   GET    /api/knowledge/of/:id      — die Informationen eines Artikels
 *   POST   /api/knowledge/of/:id      — eine neue Information für ihn
 *   PUT    /api/knowledge/info/:info  — Name, Felder, Bündel ändern
 *   DELETE /api/knowledge/info/:info  — eine Information entfernen
 *
 * **Eine neue Information ändert den Artikel nicht:** sie gilt für ihn
 * über ihre Geltung (`applies.article`) und liegt in der Ebene der
 * Kampagne. So lässt sich auch eine Blaupause aus einem fremden Regelwerk
 * mit Wissen versehen, ohne sie anzupassen. Nur die Leitung der laufenden
 * Kampagne und die Verwaltung; ein Bündel ändert nur, wer es schreibt.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  validateEntity} from '@nw/model';
import {
  appliesText,
  bundlesWith,
  currentCampaign,
  entityName,
  infoApplies,
  informationsOf,
  INCLUDES_RELATION,
  INFO_COMPONENT,
  KNOWN_BY_RELATION,
  nextId,
  primaryInterface,
  tableRole,
  type Entity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface WissenDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  kampagnenEbene: (map: Map<string, Entity>, kampagne: Entity | null) => Promise<Entity | null>;
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
}

const KNOWLEDGE_TYPE = 'Knowledge';
const kante = (von: string, art: string) => `${von}~${art}-${randomUUID().slice(0, 8)}`;
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()) : []);

export function registerWissen(app: FastifyInstance, deps: WissenDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, kampagnenEbene, darfSchreiben } = deps;

  /** Leitung der laufenden Kampagne oder Verwaltung — sonst `null`. */
  async function leitung(request: FastifyRequest, stand: Stand): Promise<{ user: User; kampagne: Entity | null } | null> {
    const user = await viewerOf(request);
    if (!user) return null;
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    if (user.isAdmin) return { user, kampagne };
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    return rolle === 'gm' || rolle === 'co-gm' ? { user, kampagne } : null;
  }

  async function schreib(e: Entity): Promise<string | null> {
    const r = await schreibeGeprueft(e);
    return 'issues' in r ? r.issues.map((i) => i.message).join('; ') : null;
  }

  /** Die Sicht des Reiters auf einen Artikel. */
  async function sicht(request: FastifyRequest, artikel: Entity, stand: Stand) {
    const registry = await repo.getRegistry();
    const name = (id: string) => entityName(stand.map.get(id));
    const infos = informationsOf(stand.map, artikel, registry);
    const sichtbar = new Set((await sieve(request, infos, stand.map)).map((e) => e.id));
    const buendelAlle = stand.alle.filter((e) => primaryInterface(e) === KNOWLEDGE_TYPE);
    const buendel = await sieve(request, buendelAlle, stand.map);
    const schreibbar = new Set<string>();
    for (const b of buendel) if (await darfSchreiben(request, b.id)) schreibbar.add(b.id);
    return {
      article: { id: artikel.id, name: entityName(artikel) },
      infos: await Promise.all(
        infos
          .filter((i) => sichtbar.has(i.id))
          .map(async (i) => {
            const karte = (i.components?.[INFO_COMPONENT] ?? {}) as Record<string, unknown>;
            const geltung = infoApplies(i);
            const angehaengt = (artikel.relations ?? []).some((r) => r.type === 'knowledge' && r.to === i.id);
            return {
              id: i.id,
              name: entityName(i),
              fields: liste(karte['fields']),
              tier: typeof karte['tier'] === 'string' ? karte['tier'] : '',
              /* `attached`: über `knowledge` am Artikel; `article`: Geltung genau
                 dieser Artikel; `group`: eine Regel für viele (T-285). */
              scope: angehaengt ? 'attached' : geltung?.article === artikel.id && !geltung.types?.length && !geltung.where?.length ? 'article' : 'group',
              ...(geltung && !(geltung.article === artikel.id) ? { applies: appliesText(geltung, name) } : {}),
              bundles: bundlesWith(stand.map, i.id).map((b) => ({ id: b.id, name: entityName(b) })),
              knownBy: (i.relations ?? []).filter((r) => r.type === KNOWN_BY_RELATION).map((r) => ({ id: r.to, name: name(r.to) })),
              canEdit: await darfSchreiben(request, i.id),
            };
          }),
      ),
      bundles: buendel
        .map((b) => ({
          id: b.id,
          name: entityName(b),
          canEdit: schreibbar.has(b.id),
          knownBy: (b.relations ?? []).filter((r) => r.type === KNOWN_BY_RELATION).map((r) => ({ id: r.to, name: name(r.to) })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /**
   * **Die Bündel einer Information setzen:** an jedem schreibbaren Bündel
   * die Kante `includes` dazu oder weg. Ein Bündel, das man nicht
   * schreibt, bleibt wie es ist — und sagt es.
   */
  async function buendelSetzen(request: FastifyRequest, info: string, soll: Set<string>, stand: Stand): Promise<string | null> {
    for (const b of stand.alle) {
      if (primaryInterface(b) !== KNOWLEDGE_TYPE) continue;
      const hat = (b.relations ?? []).some((r) => r.type === INCLUDES_RELATION && r.to === info);
      if (hat === soll.has(b.id)) continue;
      if (!(await darfSchreiben(request, b.id))) return `„${entityName(b)}" kannst du nicht ändern.`;
      const relations = hat
        ? (b.relations ?? []).filter((r) => !(r.type === INCLUDES_RELATION && r.to === info))
        : [...(b.relations ?? []), { id: kante(b.id, INCLUDES_RELATION), type: INCLUDES_RELATION, to: info, props: {} }];
      const f = await schreib({ ...b, relations });
      if (f) return f;
    }
    return null;
  }

  /** Ein neues Bündel in der Ebene der Kampagne. */
  async function neuesBuendel(name: string, stand: Stand, kampagne: Entity | null): Promise<Entity | string> {
    const ebene = await kampagnenEbene(stand.map, kampagne);
    const id = `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const b: Entity = {
      id,
      interfaces: [KNOWLEDGE_TYPE],
      name,
      components: { Identity: { name, id: nextId(stand.alle, KNOWLEDGE_TYPE) }, Status: { status: 'ready' } },
      relations: ebene ? [{ id: `${id}~inLayer`, type: 'inLayer', to: ebene.id, props: {} }] : [],
    };
    const f = await schreib(b);
    if (f) return f;
    stand.alle.push(b);
    stand.map.set(b.id, b);
    return b;
  }

  app.get<{ Params: { id: string } }>('/api/knowledge/of/:id', async (request, reply) => {
    const stand = await roh();
    if (!(await leitung(request, stand))) return reply.code(403).send({ error: 'Wissen verteilt die Leitung.' });
    const roh1 = stand.map.get(request.params.id);
    const [artikel] = roh1 ? await sieve(request, [roh1], stand.map) : [];
    if (!roh1 || !artikel) return reply.code(404).send({ error: 'Nicht gefunden' });
    return sicht(request, roh1, stand);
  });

  app.post<{ Params: { id: string }; Body: { name?: unknown; fields?: unknown; bundles?: unknown; newBundle?: unknown } | null }>(
    '/api/knowledge/of/:id',
    async (request, reply) => {
      const stand = await roh();
      const l = await leitung(request, stand);
      if (!l) return reply.code(403).send({ error: 'Wissen verteilt die Leitung.' });
      const artikel = stand.map.get(request.params.id);
      const [sichtbar] = artikel ? await sieve(request, [artikel], stand.map) : [];
      if (!artikel || !sichtbar) return reply.code(404).send({ error: 'Nicht gefunden' });
      const fields = liste(request.body?.fields);
      if (!fields.length) return reply.code(400).send({ error: 'Eine Information nennt mindestens ein Feld.' });
      const name = typeof request.body?.name === 'string' && request.body.name.trim() ? request.body.name.trim() : `${entityName(artikel)}: ${fields.join(', ')}`;
      const ebene = await kampagnenEbene(stand.map, l.kampagne);
      const id = `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const info: Entity = {
        id,
        interfaces: [INFO_COMPONENT],
        name,
        components: {
          Identity: { name, id: nextId(stand.alle, INFO_COMPONENT) },
          [INFO_COMPONENT]: { fields, tier: 'secret', applies: { article: artikel.id } },
          Status: { status: 'ready' },
        },
        relations: ebene ? [{ id: `${id}~inLayer`, type: 'inLayer', to: ebene.id, props: {} }] : [],
      };
      const f = await schreib(info);
      if (f) return reply.code(422).send({ error: f });
      stand.alle.push(info);
      stand.map.set(info.id, info);
      const soll = new Set(liste(request.body?.bundles));
      const neu = typeof request.body?.newBundle === 'string' ? request.body.newBundle.trim() : '';
      if (neu) {
        const b = await neuesBuendel(neu, stand, l.kampagne);
        if (typeof b === 'string') return reply.code(422).send({ error: b });
        soll.add(b.id);
      }
      const f2 = await buendelSetzen(request, info.id, soll, stand);
      if (f2) return reply.code(403).send({ error: f2 });
      return sicht(request, artikel, await roh());
    },
  );

  app.put<{ Params: { info: string }; Body: { name?: unknown; fields?: unknown; bundles?: unknown; newBundle?: unknown; article?: unknown } | null }>(
    '/api/knowledge/info/:info',
    async (request, reply) => {
      const stand = await roh();
      const l = await leitung(request, stand);
      if (!l) return reply.code(403).send({ error: 'Wissen verteilt die Leitung.' });
      const info = stand.map.get(request.params.info);
      if (!info || primaryInterface(info) !== INFO_COMPONENT) return reply.code(404).send({ error: 'Keine Information.' });
      const body = request.body ?? {};
      if (body.name !== undefined || body.fields !== undefined) {
        if (!(await darfSchreiben(request, info.id))) return reply.code(403).send({ error: 'Diese Information kannst du nicht ändern.' });
        const karte = (info.components?.[INFO_COMPONENT] ?? {}) as Record<string, unknown>;
        const fields = body.fields !== undefined ? liste(body.fields) : liste(karte['fields']);
        if (!fields.length) return reply.code(400).send({ error: 'Eine Information nennt mindestens ein Feld.' });
        const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : entityName(info);
        const f = await schreib({
          ...info,
          name,
          components: {
            ...info.components,
            Identity: { ...(info.components?.['Identity'] ?? {}), name },
            [INFO_COMPONENT]: { ...karte, fields },
          },
        });
        if (f) return reply.code(422).send({ error: f });
      }
      if (body.bundles !== undefined || body.newBundle !== undefined) {
        const soll = new Set(body.bundles !== undefined ? liste(body.bundles) : bundlesWith(stand.map, info.id).map((b) => b.id));
        const neu = typeof body.newBundle === 'string' ? body.newBundle.trim() : '';
        if (neu) {
          const b = await neuesBuendel(neu, stand, l.kampagne);
          if (typeof b === 'string') return reply.code(422).send({ error: b });
          soll.add(b.id);
        }
        const f2 = await buendelSetzen(request, info.id, soll, stand);
        if (f2) return reply.code(403).send({ error: f2 });
      }
      const neuStand = await roh();
      const artikel = typeof body.article === 'string' ? neuStand.map.get(body.article) : undefined;
      return artikel ? sicht(request, artikel, neuStand) : { ok: true };
    },
  );

  app.delete<{ Params: { info: string } }>('/api/knowledge/info/:info', async (request, reply) => {
    const stand = await roh();
    if (!(await leitung(request, stand))) return reply.code(403).send({ error: 'Wissen verteilt die Leitung.' });
    const info = stand.map.get(request.params.info);
    if (!info || primaryInterface(info) !== INFO_COMPONENT) return reply.code(404).send({ error: 'Keine Information.' });
    if (!(await darfSchreiben(request, info.id))) return reply.code(403).send({ error: 'Diese Information kannst du nicht entfernen.' });
    /* Erst aus den Bündeln, dann weg — ein `includes` ins Leere verwaiste. */
    const f = await buendelSetzen(request, info.id, new Set(), stand);
    if (f) return reply.code(403).send({ error: f });
    await repo.deleteEntity(info.id);
    return { ok: true };
  });
}
