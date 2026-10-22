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
 *   GET    /api/knowledge/:id/contents — was ein Wissen vereint (T-287)
 *   POST   /api/knowledge/of/:id/reveal — Felder den Gruppen zuteilen, ein Klick
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
  appliesHolds,
  appliesText,
  ancestryLine,
  fieldText,
  informationsIn,
  knows,
  unitsFor,
  bundlesWith,
  currentCampaign,
  entityName,
  infoApplies,
  informationsOf,
  INCLUDES_RELATION,
  INFO_COMPONENT,
  KNOWN_BY_RELATION,
  nextId,
  partiesOf,
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

  /**
   * **Aufdecken** (REQ-178): der eine Klick der Leitung, mit dem die
   * Spielenden etwas über einen Artikel erfahren — als Vorgabe den Namen
   * statt des Decknamens. Darunter liegt dasselbe Wissen wie im Kasten
   * Knowledge: eine Information für genau diesen Artikel, die die Felder
   * nennt, und `knownBy` an die Gruppe. Gibt es schon eine Information
   * für genau diese Felder, wird sie zugeteilt und keine zweite angelegt.
   * Ohne genannte Gruppe bekommen es alle Gruppen der Kampagne; andere
   * Felder (Basiswerte, ein Teil des Wissens) nennt `fields`.
   */
  app.post<{ Params: { id: string }; Body: { fields?: unknown; name?: unknown; party?: unknown } | null }>(
    '/api/knowledge/of/:id/reveal',
    async (request, reply) => {
      const stand = await roh();
      const l = await leitung(request, stand);
      if (!l) return reply.code(403).send({ error: 'Wissen verteilt die Leitung.' });
      const artikel = stand.map.get(request.params.id);
      const [sichtbar] = artikel ? await sieve(request, [artikel], stand.map) : [];
      if (!artikel || !sichtbar) return reply.code(404).send({ error: 'Nicht gefunden' });
      const gewaehlt = liste(request.body?.fields);
      const fields = gewaehlt.length ? gewaehlt : ['Identity.name'];
      const partyWahl = typeof request.body?.party === 'string' ? request.body.party : '';
      const gruppen = partyWahl
        ? [stand.map.get(partyWahl)].filter((g): g is Entity => !!g && primaryInterface(g) === 'Party')
        : l.kampagne
          ? partiesOf(stand.map, l.kampagne.id)
          : [];
      if (!gruppen.length) {
        return reply.code(409).send({ error: 'Es gibt keine Gruppe, der es zugeteilt werden kann. Lege unter Party eine Gruppe an und nimm die Figuren auf.' });
      }
      const registry = await repo.getRegistry();
      const gleich = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
      let info = informationsOf(stand.map, artikel, registry).find((i) => {
        const g = infoApplies(i);
        return g?.article === artikel.id && gleich(liste((i.components?.[INFO_COMPONENT] as { fields?: unknown } | undefined)?.fields), fields);
      });
      if (!info) {
        const name = typeof request.body?.name === 'string' && request.body.name.trim()
          ? request.body.name.trim()
          : fields.length === 1 && fields[0] === 'Identity.name'
            ? `${entityName(artikel)}: name`
            : `${entityName(artikel)}: ${fields.join(', ')}`;
        const ebene = await kampagnenEbene(stand.map, l.kampagne);
        const id = `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        info = {
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
      }
      const fehlt = gruppen.filter((g) => !(info!.relations ?? []).some((r) => r.type === KNOWN_BY_RELATION && r.to === g.id));
      if (fehlt.length || !stand.map.has(info.id)) {
        const f = await schreib({
          ...info,
          relations: [...(info.relations ?? []), ...fehlt.map((g) => ({ id: kante(info!.id, KNOWN_BY_RELATION), type: KNOWN_BY_RELATION, to: g.id, props: {} }))],
        });
        if (f) return reply.code(422).send({ error: f });
      }
      return { info: info.id, fields, parties: gruppen.map((g) => ({ id: g.id, name: entityName(g) })) };
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

  /**
   * **Was ein Wissen vereint** (T-287, REQ-353): je Information die Artikel
   * mit genau den Feldern, die sie abdeckt — so, wie dieser Betrachter sie
   * liest (gesiebt und zurückgehalten wie jede Route). Wer das Wissen nicht
   * hat, bekommt nur, dass es es gibt; die Leitung sieht alles. Eine
   * Information für eine Gruppe nennt bis zu `JE_GRUPPE` passende Artikel
   * und zählt die übrigen.
   */
  const JE_GRUPPE = 30;
  app.get<{ Params: { id: string } }>('/api/knowledge/:id/contents', async (request, reply) => {
    const stand = await roh();
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const roh1 = stand.map.get(request.params.id);
    const [buendel] = roh1 && primaryInterface(roh1) === KNOWLEDGE_TYPE ? await sieve(request, [roh1], stand.map) : [];
    if (!roh1 || !buendel) return reply.code(404).send({ error: 'Kein Wissen.' });
    const istLeitung = !!(await leitung(request, stand));
    const known = istLeitung || knows(stand.map, roh1, user.actorIds ?? []);
    if (!known) return { knowledge: { id: roh1.id, name: entityName(buendel) }, known: false, infos: [] };
    const registry = await repo.getRegistry();
    const reihe = (id: string) => ancestryLine(id, stand.map);
    const infos = await sieve(request, informationsIn(stand.map, roh1), stand.map);
    const raus = [];
    for (const info of infos) {
      const roheInfo = stand.map.get(info.id) ?? info;
      const karte = (roheInfo.components?.[INFO_COMPONENT] ?? {}) as Record<string, unknown>;
      const felder = liste(karte['fields']);
      const geltung = infoApplies(roheInfo);
      let ziele: Entity[];
      if (geltung && !geltung.types?.length && !geltung.where?.length && geltung.article) {
        ziele = [stand.map.get(geltung.article)].filter((x): x is Entity => !!x);
      } else if (geltung) {
        ziele = stand.alle.filter((e) => e.id !== roheInfo.id && primaryInterface(e) !== INFO_COMPONENT && appliesHolds(registry, geltung, e, [], reihe));
      } else {
        ziele = stand.alle.filter((e) => (e.relations ?? []).some((r) => r.type === 'knowledge' && r.to === roheInfo.id));
      }
      const gezeigt = await sieve(request, ziele.slice(0, JE_GRUPPE), stand.map);
      const deckt = (comp: string, prop: string) => felder.includes(comp) || felder.includes(`${comp}.${prop}`);
      raus.push({
        id: info.id,
        name: entityName(info),
        ...(geltung && !geltung.article ? { applies: appliesText(geltung, (id) => entityName(stand.map.get(id))) } : {}),
        articles: gezeigt.map((a) => {
          const mode = unitsFor(registry, primaryInterface(a));
          const cells: { ref: string; label: string; text: string; long: boolean }[] = [];
          for (const [comp, k] of Object.entries(a.components ?? {})) {
            for (const [prop, wert] of Object.entries((k ?? {}) as Record<string, unknown>)) {
              if (!deckt(comp, prop)) continue;
              const schema = registry.interfaces[comp]?.schema?.properties?.[prop];
              const text = fieldText(registry, schema, wert, mode);
              if (!text) continue;
              cells.push({ ref: `${comp}.${prop}`, label: schema?.title ?? prop, text, long: schema?.format === 'long' });
            }
          }
          return { id: a.id, name: entityName(a), type: primaryInterface(a), cells };
        }),
        more: Math.max(0, ziele.length - JE_GRUPPE),
      });
    }
    return { knowledge: { id: roh1.id, name: entityName(buendel) }, known: true, infos: raus };
  });
}
