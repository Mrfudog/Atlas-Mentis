/**
 * **Die Struktur** (T-341): Organigramm oder Beziehungsnetz vom
 * Startartikel aus, für die Kachel „Structure" auf dem Board und das
 * Element `structure` einer Ansicht.
 *
 *   GET /api/structure/:id?edges=memberOf,regards&depth=2&layout=tree
 *
 * **Gerechnet wird je Betrachter** (CLAUDE.md, „Zurückgehalten wird am
 * Server"): zuerst grob über den rohen Bestand, welche Artikel überhaupt
 * in Frage kommen (billig, mit Spielraum über der Grenze), dann nur diese
 * gesiebt — Stapel, Sichtbarkeit, Wissen —, und über das Gesiebte noch
 * einmal gerechnet. So steht für eine Spielerin weder ein Knoten da, den
 * sie nicht sieht, noch einer, der nur über ihn erreichbar war, und die
 * Namen sind die gesiebten (ein Deckname bleibt ein Deckname). Der
 * Startartikel selbst muss sichtbar sein, sonst gibt es die Struktur
 * nicht — 404 wie bei jedem verborgenen Artikel.
 *
 * Die Frage kommt aus der Adresse und nicht von der Kachel: die Kachel
 * verrät nichts, was ihre Artikel nicht verraten, und ein Element am
 * Artikel hat keine Kachel. Ob die Kachel selbst zurückgehalten ist
 * (`hidden`), entscheidet das Board (`redactBoard`).
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { STRUCTURE_LIMIT, structureGraph, structureSpecOf, type Entity } from '@nw/model';
import type { User } from './auth.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface StrukturDeps {
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
}

export function registerStruktur(app: FastifyInstance, deps: StrukturDeps): void {
  const { viewerOf, roh, sieve } = deps;

  app.get<{ Params: { id: string }; Querystring: { edges?: string; depth?: string; layout?: string } }>(
    '/api/structure/:id',
    async (request, reply) => {
      if (!(await viewerOf(request))) return reply.code(401).send({ error: 'Nicht angemeldet.' });
      const q = request.query;
      const spec = structureSpecOf({
        root: request.params.id,
        edges: (q.edges ?? '').split(',').map((x) => x.trim()).filter(Boolean),
        depth: q.depth === undefined ? undefined : Number(q.depth),
        layout: q.layout,
      });
      const stand = await roh();
      /* Grob: was überhaupt in Frage kommt, ungesiebt — einen Schritt
         tiefer, damit „es geht weiter" (`more`) auch nach dem Sieb stimmt.
         Der Spielraum über der Grenze ist für das, was das Sieb wegnimmt. */
      const grob = structureGraph(stand.map, { ...spec, depth: spec.depth + 1 }, { limit: STRUCTURE_LIMIT * 4 });
      if (!grob) return reply.code(404).send({ error: 'This article is not there — or not for you.' });
      const kandidaten = grob.nodes.map((n) => stand.map.get(n.id)!).filter(Boolean);
      const gesiebt = await sieve(request, kandidaten, stand.map);
      const graph = structureGraph(gesiebt, spec);
      if (!graph) return reply.code(404).send({ error: 'This article is not there — or not for you.' });
      return { ...graph, edges: spec.edges, depth: spec.depth };
    },
  );
}
