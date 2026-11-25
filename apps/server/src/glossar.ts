/**
 * **Das Glossar** (T-242): `GET /api/glossary` und
 * `GET /api/glossary/:id/uses`.
 *
 * Die Liste legt zwei Quellen zusammen: die Wörter der App aus dem Repo
 * (`APP_TERMS`, für jeden gleich) und die Glossarartikel (`GlossaryTerm`),
 * die im Stapel stehen und dieser Betrachter sieht — dasselbe Sieb wie
 * jede Route. Worauf ein Begriff zeigt (`explains`), steht nur da, wenn
 * auch das Ziel sichtbar ist.
 *
 * **Nennungen** („Used in N places") sind die Rückfrage: welche Artikel den
 * Begriff nennen, als Verweis oder Wort. Vorgefiltert wird am rohen
 * Bestand, geprüft am gesiebten — ein Begriff, der nur in einem Geheimnis
 * steht, das dieser Betrachter nicht kennt, zählt für ihn nicht.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  appTermId,
  entityName,
  glossaryEntryOf,
  mentionsTerm,
  primaryInterface,
  type Entity,
  type GlossaryEntry,
} from '@nw/model';
import { APP_TERMS } from '@nw/registry';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface GlossarDeps {
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
}

const ART = 'GlossaryTerm';
/** So viele Nennungen stehen namentlich da; gezählt werden alle. */
const NENNUNGEN = 50;

/** Die Wörter der App als Einträge (T-242) — einmal, sie ändern sich nur mit dem Code. */
export const APP_EINTRAEGE: readonly GlossaryEntry[] = APP_TERMS.map((t) => ({
  id: appTermId(t.term),
  term: t.term,
  aliases: t.aliases ?? [],
  sort: t.sort,
  definition: t.definition,
  ...(t.effect ? { effect: t.effect } : {}),
  examples: t.example ? [t.example] : [],
  translations: Object.entries(t.translations ?? {}).map(([lang, term]) => ({ lang, term })),
  explains: [],
  ...(t.types ? { types: t.types } : {}),
  ...(t.see ? { see: t.see } : {}),
  autolink: false,
  article: false,
}));

export function registerGlossar(app: FastifyInstance, deps: GlossarDeps): void {
  const { roh, sieve } = deps;

  /** Die sichtbaren Glossarartikel als Einträge. */
  async function artikel(request: FastifyRequest): Promise<GlossaryEntry[]> {
    const stand = await roh();
    const begriffe = await sieve(request, stand.alle.filter((e) => primaryInterface(e) === ART), stand.map);
    const ziele = [...new Set(begriffe.flatMap((e) => (e.relations ?? []).filter((r) => r.type === 'explains').map((r) => r.to)))]
      .map((id) => stand.map.get(id))
      .filter((e): e is Entity => !!e);
    const sichtbar = new Map((await sieve(request, ziele, stand.map)).map((e) => [e.id, entityName(e)]));
    return begriffe.map((e) => glossaryEntryOf(e, (id) => sichtbar.get(id)));
  }

  app.get('/api/glossary', async (request) => {
    const terms = [...APP_EINTRAEGE, ...(await artikel(request))].sort((a, b) =>
      a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }),
    );
    return { terms };
  });

  app.get<{ Params: { id: string } }>('/api/glossary/:id/uses', async (request, reply) => {
    const id = request.params.id;
    /* Die Wörter der App stehen in jedem Regeltext („field", „type") —
       gezählt würde Zufall. */
    if (APP_EINTRAEGE.some((e) => e.id === id)) return { counted: false, total: 0, rows: [] };
    const eintrag = (await artikel(request)).find((e) => e.id === id);
    if (!eintrag) return reply.code(404).send({ error: 'Kein Glossarbegriff.' });
    const stand = await roh();
    const vorab = stand.alle.filter((e) => mentionsTerm(e, eintrag));
    const treffer = (await sieve(request, vorab, stand.map))
      .filter((e) => mentionsTerm(e, eintrag))
      .sort((a, b) => entityName(a).localeCompare(entityName(b)));
    return {
      counted: true,
      total: treffer.length,
      rows: treffer.slice(0, NENNUNGEN).map((e) => ({ id: e.id, name: entityName(e), type: primaryInterface(e) })),
    };
  });
}
