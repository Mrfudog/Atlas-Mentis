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
import { entityName, missingRuleArticles, primaryInterface, ruleArticleKey, ruleArticleKind, ruleOptionsOf, type Entity } from '@nw/model';
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

    return {
      campaign: { id: kampagne.id, name: entityName(kampagne) },
      sorts: ruleOptionsOf(gesiebt, {
        byId,
        settings: registry.settings ?? null,
        articles: artikel,
      }),
      /* Was die Laufzeit kann und noch keinen Artikel hat — die Seite sagt es der Leitung. */
      missing: missingRuleArticles(artikel).length,
    };
  });
}
