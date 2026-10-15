/**
 * **Türen am Tisch** (T-118, docs/Karten.md › Sperren).
 *
 * - `POST /api/maps/:id/door` `{wall, state, nat?}` — eine Tür öffnen,
 *   schliessen oder (nur die Leitung) verschliessen.
 *
 * **Wer darf:** die Leitung jede Tür, in jeden Zustand. Spielende nur, wenn
 * die Kampagne es sagt (`Campaign.doors: 'players'`), nur eine Tür, die sie
 * sehen (die gesiebte Karte trägt sie, `redactWalls`), nur auf und zu, und
 * nur mit einer eigenen Figur daneben — anderthalb Felder von ihrer Mitte
 * bis zur Tür. Eine verschlossene bleibt zu (423); dass sie klemmt, merkt
 * man beim Versuch, nicht vorher an der Karte.
 *
 * **Aufgedeckt wird, was man durch die offene Tür sieht** — wenn die Karte
 * Nebel hat und Züge aufdecken (`revealOnMove`): für jede Figur der
 * Gruppe, die die Tür sieht, ihr Sichtpolygon (`sightReveal`), mit `for`
 * auf sie. Eine zweite Regel dafür wäre die, nach der eine geöffnete Tür
 * auf dem Beamer etwas anderes zeigt als ein Schritt hindurch.
 *
 * Geschrieben wird die Karte durch `validateEntity` wie jede; der
 * Live-Kanal meldet sie, und jeder Tisch zeichnet die Tür neu.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  cleanNat,
  currentCampaign,
  fogOn,
  isDoor,
  isMap,
  mapRulesOf,
  mapSettings,
  mapWalls,
  markersOf,
  PARTY_RELATION,
  segDistance,
  setDoorState,
  sightReveal,
  wallMid,
  wallsClear,
  type DoorState,
  type Entity,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { leitetTisch } from './wuerfe.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface TuerenDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
}

/** So weit reicht eine Figur an eine Tür, in Feldern von ihrer Mitte. */
export const TUER_REICHWEITE = 1.5;

const ZUSTAENDE: readonly DoorState[] = ['open', 'closed', 'locked'];

/**
 * Was man durch eine eben geöffnete Tür sieht: für jede Figur der Gruppe
 * (ein Token, dessen Ziel in einer Gruppe ist, oder das Gruppen-Token), die
 * die Mitte der Tür ohne Sperre dazwischen sieht, ihr Sichtpolygon.
 */
export function tuerAufdecken(karte: Entity, tuer: string, nat: { w: number; h: number }, bestand: ReadonlyMap<string, Entity>): Entity {
  const sperren = mapWalls(karte);
  const t = sperren.find((w) => w.id === tuer);
  if (!t) return karte;
  const ar = nat.w > 0 ? nat.h / nat.w : 1;
  const mitte = wallMid(t);
  let neu = karte;
  for (const m of markersOf(karte)) {
    if (m.hidden || m.prepared) continue;
    const ziel = bestand.get(m.to);
    const gruppe = m.kind === 'party' || (ziel?.relations ?? []).some((r) => r.type === PARTY_RELATION);
    if (!gruppe || !wallsClear(sperren, m, mitte, ar, 'sight')) continue;
    neu = sightReveal(neu, m, nat, `s-${randomUUID()}`, m.to);
  }
  return neu;
}

export function registerTueren(app: FastifyInstance, deps: TuerenDeps): void {
  const { repo, viewerOf, roh, sieve, geltend, schreibeGeprueft } = deps;

  app.post<{ Params: { id: string }; Body: { wall?: unknown; state?: unknown; nat?: unknown } | null }>(
    '/api/maps/:id/door',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
      const stand = await roh();
      const gefunden = stand.map.get(request.params.id);
      if (!gefunden || !isMap(gefunden)) return reply.code(404).send({ error: 'Nicht gefunden' });
      const roheKarte = await geltend(gefunden, stand.map);
      const [karte] = await sieve(request, [roheKarte], stand.map);
      if (!karte) return reply.code(404).send({ error: 'Nicht gefunden' });
      const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
      const leitet = leitetTisch(user, kampagne?.id ?? null);

      const b = request.body ?? {};
      const tuer = mapWalls(roheKarte).find((w) => w.id === b.wall && isDoor(w));
      /* Spielende kennen nur die Türen, die ihre Karte als Tür trägt — eine geschlossene Geheimtür ist dort eine Wand. */
      if (!tuer || (!leitet && !mapWalls(karte).some((w) => w.id === tuer.id && isDoor(w)))) return reply.code(404).send({ error: 'There is no door here.' });
      const state = b.state as DoorState;
      if (!ZUSTAENDE.includes(state)) return reply.code(422).send({ error: 'state: open, closed or locked' });
      const nat = cleanNat(b.nat);
      const regeln = mapRulesOf(kampagne, roheKarte);

      if (!leitet) {
        if (regeln.doors !== 'players') return reply.code(403).send({ error: 'Only the GM opens doors in this campaign.' });
        if (state === 'locked') return reply.code(403).send({ error: 'Only the GM locks a door.' });
        if (tuer.state === 'locked') return reply.code(423).send({ error: 'The door is locked.' });
        /* Daneben stehen: eine eigene Figur, anderthalb Felder von der Tür. */
        if (!nat) return reply.code(422).send({ error: 'nat: {w, h} — the size of the map image' });
        const ar = nat.h / nat.w;
        const reich = (TUER_REICHWEITE * mapSettings(roheKarte).gridSize) / nat.w;
        const eigene = new Set(user.actorIds ?? []);
        const seg = { x1: tuer.x1, y1: tuer.y1 * ar, x2: tuer.x2, y2: tuer.y2 * ar };
        const dabei = markersOf(roheKarte).some((m) => eigene.has(m.to) && !m.hidden && segDistance({ x: m.x, y: m.y * ar }, seg) <= reich);
        if (!dabei) return reply.code(403).send({ error: 'Your character has to stand at the door.' });
      }

      if (tuer.state === state) return { wall: tuer.id, state };
      let neu = setDoorState(roheKarte, tuer.id, state);
      if (state === 'open' && nat && fogOn(roheKarte) && regeln.revealOnMove) neu = tuerAufdecken(neu, tuer.id, nat, stand.map);
      const r = await schreibeGeprueft(neu);
      if ('issues' in r) return reply.code(422).send({ error: 'Die Karte liess sich nicht schreiben.', issues: r.issues });
      return { wall: tuer.id, state };
    },
  );
}
