/**
 * **Die Regeloptionen einer Kampagne** (T-190): `GET /api/campaigns/:id/rules`.
 *
 * Was heute an verschiedenen Stellen steht — Felder an der Kampagne,
 * Verfahren über Kanten, Einstellungen der Installation —, nach Sorte
 * gruppiert und mit dem Regelartikel, der jede Variante erklärt
 * (`ruleOptionsOf`). Gerechnet **hier**: ein Regelartikel wird nur genannt,
 * wenn er im Stapel steht und dieser Betrachter ihn sieht — dasselbe Sieb
 * wie jede Route; die gewählten Verfahren ebenso. Mit T-132 schaut
 * `ruleOptionsOf` ins Modul, die Route bleibt.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { entityName, primaryInterface, ruleOptionRuleNames, ruleOptionsOf, type Entity, type RuleRef } from '@nw/model';
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

export function registerRegeloptionen(app: FastifyInstance, deps: RegeloptionenDeps): void {
  const { repo, roh, sieve } = deps;

  app.get<{ Params: { id: string } }>('/api/campaigns/:id/rules', async (request, reply) => {
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roheKampagne = stand.map.get(request.params.id);
    const [kampagne] = roheKampagne ? await sieve(request, [roheKampagne], stand.map) : [];
    if (!kampagne || primaryInterface(kampagne) !== 'Campaign') return reply.code(404).send({ error: 'Keine Kampagne.' });

    /* Die Regelartikel, die die Seite nennen könnte: nach Namen, nur
       Regeln (Talente sind auch Regeln, aber „Feats" meint die Regel). */
    const kandidaten = new Map<string, Entity>();
    for (const name of ruleOptionRuleNames()) {
      for (const e of stand.namen.get(name.toLowerCase()) ?? []) {
        if (primaryInterface(e) === RULE_TYPE && entityName(e).toLowerCase() === name.toLowerCase()) kandidaten.set(e.id, e);
      }
    }
    const sichtbar = await sieve(request, [...kandidaten.values()], stand.map);
    const nachName = new Map<string, RuleRef>();
    /* Bei zwei gleichnamigen gilt der erste in Nummernfolge — stabil, statt nach Ladereihenfolge. */
    for (const e of [...sichtbar].sort((a, z) => a.id.localeCompare(z.id))) {
      const k = entityName(e).toLowerCase();
      if (!nachName.has(k)) nachName.set(k, { id: e.id, name: entityName(e) });
    }

    /* Die gewählten Verfahren: was dieser Betrachter nicht sieht, fehlt auch hier. */
    const ziele = (kampagne.relations ?? [])
      .filter((r) => r.type === 'allowsMethod' || r.type === 'allowsEquipment')
      .map((r) => stand.map.get(r.to))
      .filter((e): e is Entity => !!e);
    const verfahren = await sieve(request, ziele, stand.map);
    const byId = new Map(verfahren.map((e) => [e.id, e]));
    const gesiebt: Entity = { ...kampagne, relations: (kampagne.relations ?? []).filter((r) => (r.type !== 'allowsMethod' && r.type !== 'allowsEquipment') || byId.has(r.to)) };

    return {
      campaign: { id: kampagne.id, name: entityName(kampagne) },
      sorts: ruleOptionsOf(gesiebt, {
        byId,
        settings: registry.settings ?? null,
        ruleNamed: (names) => names.map((n) => nachName.get(n.toLowerCase())).find((r): r is RuleRef => !!r),
      }),
    };
  });
}
