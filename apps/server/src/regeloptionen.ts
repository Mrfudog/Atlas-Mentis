/**
 * **Die Regeloptionen einer Kampagne** (T-190): `GET /api/campaigns/:id/rules`.
 *
 * Was heute an verschiedenen Stellen steht — Felder an der Kampagne,
 * Verfahren über Kanten, Einstellungen der Installation —, nach Sorte
 * gruppiert — **aus den Regelartikeln** (T-270): je System, Regel und
 * Option ein Artikel (`ruleOptionsOf`). Gerechnet **hier**: ein Regelartikel wird nur genannt,
 * wenn er im Stapel steht und dieser Betrachter ihn sieht — dasselbe Sieb
 * wie jede Route; die gewählten Verfahren ebenso. Mit T-132 schaut
 * `ruleOptionsOf` ins Modul, die Route bleibt.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { entityName, missingRuleArticles, primaryInterface, ruleArticleKey, ruleArticleKind, ruleOptionsOf, typeChain, type Entity } from '@nw/model';
import type { Repository } from './repo.js';

interface Stand {
  map: Map<string, Entity>;
  /** Kleingeschriebener Name → Artikel (`roh()` in app.ts). */
  namen: Map<string, Entity[]>;
}

export interface RegeloptionenDeps {
  repo: Repository;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
}

const RULE_TYPE = 'Rule';
/* Kanten auf Artikel, die eine Option tragen — Verfahren und Ersatzregeln (T-197). */
const VERFAHREN = new Set(['allowsMethod', 'allowsEquipment', 'allowsSubstitution']);

export function registerRegeloptionen(app: FastifyInstance, deps: RegeloptionenDeps): void {
  const { repo, roh, sieve } = deps;

  /**
   * **Die Regelartikel** (T-270): jedes System, jede Regel und jede Option
   * mit Schlüssel oder Graph, ganz — für den Regel-Builder, der sie nach
   * System ordnet und bearbeitet. Gesiebt wie jede Route: was nicht im
   * Stapel steht oder der Betrachter nicht sieht, fehlt.
   */
  app.get('/api/rule-articles', async (request) => {
    const stand = await roh();
    const kandidaten = [...stand.map.values()].filter(
      (e) => primaryInterface(e) === RULE_TYPE && ruleArticleKind(e) && (ruleArticleKey(e) || e.components?.['Rule']?.['graph']),
    );
    return sieve(request, kandidaten, stand.map);
  });

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/rules', async (request, reply) => {
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roheKampagne = stand.map.get(request.params.id);
    const [kampagne] = roheKampagne ? await sieve(request, [roheKampagne], stand.map) : [];
    if (!kampagne || primaryInterface(kampagne) !== 'Campaign') return reply.code(404).send({ error: 'Keine Kampagne.' });

    /* Die Regelartikel (T-270): je System, Regel und Option einer, mit
       Schlüssel. Genannt wird nur, was im Stapel steht und dieser
       Betrachter sieht — dasselbe Sieb wie jede Route. */
    const kandidaten = [...stand.map.values()].filter((e) => primaryInterface(e) === RULE_TYPE && ruleArticleKind(e) && ruleArticleKey(e));
    const artikel = await sieve(request, kandidaten, stand.map);

    /* Die gewählten Verfahren: was dieser Betrachter nicht sieht, fehlt auch hier. */
    const ziele = (kampagne.relations ?? [])
      .filter((r) => VERFAHREN.has(r.type))
      .map((r) => stand.map.get(r.to))
      .filter((e): e is Entity => !!e);
    const verfahren = await sieve(request, ziele, stand.map);
    const byId = new Map(verfahren.map((e) => [e.id, e]));
    const gesiebt: Entity = { ...kampagne, relations: (kampagne.relations ?? []).filter((r) => !VERFAHREN.has(r.type) || byId.has(r.to)) };

    /* **Was zur Wahl steht** (Mehrfachwahl abwählen, Leitung 19.10.): je
       Kante jeder Artikel im Stapel, den sie nennen darf (`relations.to`,
       die `extends`-Kette hoch) — mit demselben Satz, den ein gewählter
       trägt. Gerechnet über eine gedachte Kampagne, die alle nennt: so
       sagt `ruleOptionsOf` dasselbe wie für die gewählten. */
    const passend = (e: Entity, rel: string) => {
      const ziele = registry.relations[rel]?.to ?? [];
      const kette = typeChain(registry, primaryInterface(e));
      return ziele.some((t) => kette.includes(t));
    };
    const moegliche = await sieve(
      request,
      [...stand.map.values()].filter((e) => [...VERFAHREN].some((rel) => passend(e, rel))),
      stand.map,
    );
    const alleKampagne: Entity = {
      ...kampagne,
      relations: [
        ...(kampagne.relations ?? []).filter((r) => !VERFAHREN.has(r.type)),
        ...[...VERFAHREN].flatMap((rel) => moegliche.filter((e) => passend(e, rel)).map((e) => ({ id: `${rel}~${e.id}`, type: rel, to: e.id, props: {} }))),
      ],
    };
    const alleById = new Map(moegliche.map((e) => [e.id, e]));
    const choices: Record<string, { id: string; name: string; does: string }[]> = {};
    for (const sorte of ruleOptionsOf(alleKampagne, { byId: alleById, settings: registry.settings ?? null, articles: artikel })) {
      for (const o of sorte.options) {
        if (o.relation && o.methods) choices[o.relation] = o.methods.filter((m) => !m.builtIn).map((m) => ({ id: m.id, name: m.name, does: m.does }));
      }
    }

    return {
      campaign: { id: kampagne.id, name: entityName(kampagne) },
      sorts: ruleOptionsOf(gesiebt, {
        byId,
        settings: registry.settings ?? null,
        articles: artikel,
      }),
      choices,
      /* Was die Laufzeit kann und noch keinen Artikel hat — die Seite sagt es der Leitung. */
      missing: missingRuleArticles(artikel).length,
    };
  });
}
