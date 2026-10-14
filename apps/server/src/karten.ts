/**
 * **Karten am Tisch** (T-115, REQ-130 bis 136): was eine Karte neben sich
 * braucht, und welche Karte gerade auf dem Tisch liegt.
 *
 * - `GET /api/maps/:id/context` — die Karten darüber (Brotkrumen), die
 *   Unterkarten mit ihren Rahmen, die Ziele der Marker (Name, Art, Bild)
 *   und wo die Gruppe steht. Die Karte selbst kommt wie jeder Artikel aus
 *   `/api/entities/:id` — gesiebt, mit `redactMap`.
 * - `GET /api/play` — die Sitzungen der laufenden Kampagne und die Karte,
 *   die an der laufenden liegt (`SessionState.activeMap`).
 *
 * **Gesiebt wird wie überall** (`sieve`): eine Unterkarte, die jemand nicht
 * sehen darf, hat keinen Rahmen auf seiner Karte, und das Gruppen-Token
 * steht nur, wo er die Karte sieht, auf der es wirklich steht. Die
 * Gegenrichtung von `insideMap` ist eine Abfrage — gespeichert wird nur
 * vorwärts.
 *
 * Keine eigene Ablage: alles wird beim Lesen gerechnet (D8). Ändert sich
 * ein Artikel, fragt die Seite neu — dasselbe, was ein Ereignis aus dem
 * Live-Kanal (T-116) später auslöst.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  currentCampaign,
  entityName,
  fogOn,
  frameOf,
  frameRevealed,
  INSIDE_MAP_RELATION,
  isMap,
  mapAncestors,
  markersOf,
  PARTY_RELATION,
  partiesOf,
  partyPosition,
  primaryInterface,
  type Entity,
  type Frame,
} from '@nw/model';
import type { Repository } from './repo.js';

const SESSION_TYPE = 'Session';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface KartenDeps {
  repo: Repository;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  /** Leitet der Betrachter diese Karte (oder schreibt sie)? Dann gilt der Nebel ihm nicht. */
  leitet: (request: FastifyRequest, karte: Entity, bestand: Map<string, Entity>) => Promise<boolean>;
}

/** Was eine Marke zeichnet: Name, Art und ein Bild, wenn der Artikel eines hat. */
export interface MarkerZiel {
  name: string;
  type: string;
  image?: string;
}

export interface KartenKontext {
  parents: { id: string; name: string }[];
  children: { id: string; name: string; frame: Frame }[];
  targets: Record<string, MarkerZiel>;
  party: { id: string; name: string; x: number; y: number; mapId: string; mapName: string; direct: boolean } | null;
}

/** Das Bild eines Artikels: an einem Asset es selbst, sonst `Image.image`. */
function bildVon(e: Entity): string | undefined {
  if (primaryInterface(e) === 'Asset' && (e.components?.['Asset'] as { ref?: unknown } | undefined)?.ref) return e.id;
  const v = (e.components?.['Image'] as { image?: unknown } | undefined)?.image;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function registerKarten(app: FastifyInstance, deps: KartenDeps): void {
  const { repo, roh, sieve, geltend, leitet } = deps;

  app.get<{ Params: { id: string } }>('/api/maps/:id/context', async (request, reply) => {
    const stand = await roh();
    const gefunden = stand.map.get(request.params.id);
    if (!gefunden) return reply.code(404).send({ error: 'Nicht gefunden' });
    const roheKarte = await geltend(gefunden, stand.map);
    /* Alle Karten auf einmal gesiebt: Brotkrumen, Unterkarten und das
       Gruppen-Token fragen dieselben, und das Sieb ist der teure Teil. */
    const karten = await sieve(request, stand.alle.filter(isMap), stand.map);
    const sichtbar = new Map(karten.map((k) => [k.id, k]));
    const karte = sichtbar.get(roheKarte.id);
    if (!karte || !isMap(karte)) return reply.code(404).send({ error: 'Nicht gefunden' });

    const parents = mapAncestors(sichtbar, karte).map((e) => ({ id: e.id, name: entityName(e) }));
    const children = karten
      .filter((k) => k.id !== karte.id)
      .flatMap((k) => {
        const rel = (k.relations ?? []).find((r) => r.type === INSIDE_MAP_RELATION && r.to === karte.id);
        const frame = frameOf(rel);
        return frame ? [{ id: k.id, name: entityName(k), frame }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    /* **Unter dem Nebel kein Rahmen** (REQ-139): eine Unterkarte im
       Verdeckten verriete, dass dort etwas ist. Es zählt, ob die Mitte
       oder eine Ecke aufgedeckt ist. */
    const ohneNebel = !fogOn(karte) || (await leitet(request, roheKarte, stand.map));
    const kinder = ohneNebel ? children : children.filter((k) => frameRevealed(karte, k.frame));

    /* Die Ziele der Marker — auf der Karte stehen nur noch die, die der
       Betrachter sieht (`redactMap`); gesiebt wird trotzdem, denn ein Name
       ist ein Feld. */
    const zielIds = [...new Set(markersOf(karte).map((m) => m.to))];
    const ziele = await sieve(
      request,
      zielIds.map((id) => stand.map.get(id)).filter((e): e is Entity => !!e),
      stand.map,
    );
    const targets: Record<string, MarkerZiel> = {};
    for (const z of ziele) {
      const bild = bildVon(z);
      targets[z.id] = { name: entityName(z), type: primaryInterface(z), ...(bild ? { image: bild } : {}) };
    }

    /* **Wo die Gruppe steht** (REQ-136): ihr Token oder das einer ihrer
       Figuren, auf der feinsten Karte, abgebildet durch die Rahmen. */
    let party: KartenKontext['party'] = null;
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const gruppe = kampagne ? partiesOf(stand.map, kampagne.id)[0] : undefined;
    const [gruppeSichtbar] = gruppe ? await sieve(request, [gruppe], stand.map) : [];
    if (gruppeSichtbar) {
      const ids = new Set([gruppeSichtbar.id]);
      for (const e of stand.alle) {
        if ((e.relations ?? []).some((r) => r.type === PARTY_RELATION && r.to === gruppeSichtbar.id)) ids.add(e.id);
      }
      const p = partyPosition(sichtbar, karte, ids);
      if (p) {
        party = {
          id: gruppeSichtbar.id,
          name: entityName(gruppeSichtbar),
          ...p,
          mapName: entityName(sichtbar.get(p.mapId)),
        };
      }
    }
    return { parents, children: kinder, targets, party } satisfies KartenKontext;
  });

  /**
   * **Was auf dem Tisch liegt** (REQ-116): die Karte der laufenden Sitzung.
   * Welche Sitzung läuft, sagt `?session=`; sonst die jüngste, an der eine
   * Karte liegt — nach Weltzeit (`Time.sort`), dann nach Nummer. Eine
   * zweite Stelle dafür (am Schirm, im Browser) wäre die, an der der Beamer
   * etwas anderes zeigt als der Laptop.
   */
  app.get<{ Querystring: { session?: string } }>('/api/play', async (request) => {
    const stand = await roh();
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const sitzungen = await sieve(
      request,
      stand.alle.filter((e) => primaryInterface(e) === SESSION_TYPE),
      stand.map,
    );
    const karten = new Map(
      (await sieve(request, stand.alle.filter(isMap), stand.map)).map((k) => [k.id, k]),
    );
    const zeile = (e: Entity) => {
      const st = (e.components?.['SessionState'] ?? {}) as { activeMap?: unknown };
      const t = (e.components?.['Time'] ?? {}) as { sort?: unknown };
      const id = typeof st.activeMap === 'string' && karten.has(st.activeMap) ? st.activeMap : null;
      return {
        id: e.id,
        name: entityName(e),
        activeMap: id,
        mapName: id ? entityName(karten.get(id)) : null,
        sort: typeof t.sort === 'number' ? t.sort : Number.NEGATIVE_INFINITY,
        nummer: String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? ''),
      };
    };
    const zeilen = sitzungen
      .map(zeile)
      .sort((a, b) => b.sort - a.sort || b.nummer.localeCompare(a.nummer) || a.id.localeCompare(b.id));
    const gewaehlt =
      zeilen.find((z) => z.id === request.query.session) ?? zeilen.find((z) => z.activeMap) ?? null;
    return {
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      sessions: zeilen.map(({ sort: _s, nummer: _n, ...z }) => z),
      session: gewaehlt?.id ?? null,
      map: gewaehlt?.activeMap ?? null,
      maps: [...karten.values()]
        .map((k) => ({ id: k.id, name: entityName(k) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    };
  });
}
