/**
 * **Ein Stück kommt in ein Inventar** (T-150): gekauft (T-133, `laden.ts`),
 * gefertigt (T-128, `handwerk.ts`), als Startausrüstung (T-096) oder von
 * der Leitung gegeben — Beute und Geschenke gehen diesen Weg
 * (`POST /api/inventories/:id/give`). Was ankommt, ist eine **Instanz**
 * des Grundartikels (`newInstance`): ein eigener Artikel mit `instanceOf`,
 * der nur speichert, was abweicht — eine Gravur, ein Name, verbrauchte
 * Ladungen. Liegt schon ein loser Stapel desselben da, wächst der
 * (`receivePiece`), und es entsteht nichts.
 *
 * Instanzen stehen in keiner Liste und sind kein Verweisziel (CLAUDE.md
 * „Vorlage und Instanz"); die Ebene ist die der laufenden Kampagne, sonst
 * stünde das Stück in keinem Stapel.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  arriveUnstowed,
  currentCampaign,
  entityName,
  isInstance,
  newInstance,
  nextId,
  primaryInterface,
  receivePiece,
  tableRole,
  type Entity,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import { RevisionConflict, type Repository } from './repo.js';
import { reservierteSperre } from './reservierung.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

type Geprueft = { stored: Entity } | { issues: ReturnType<typeof validateEntity> };

export interface StueckDeps {
  repo: Repository;
  schreibeGeprueft: (entity: Entity, erwartet?: number | null) => Promise<Geprueft>;
  kampagnenEbene: (map: Map<string, Entity>, kampagne: Entity | null) => Promise<Entity | null>;
}

/** Eine neue Artikel-Id, die es im Bestand noch nicht gibt. */
export function neueArtikelId(belegt: { has(id: string): boolean }): string {
  const neu = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let id = neu();
  while (belegt.has(id)) id = neu();
  return id;
}

/**
 * Die Werkstatt für Stücke **einer** Anfrage: sie legt Instanzen an,
 * vergibt Nummern ohne Doppel (auch zwei neue derselben Art in einem
 * Zug), sieht ihre eigenen Stücke beim Stapeln — zweimal „Fackel" in der
 * Startausrüstung ist ein Stapel, nicht zwei — und nimmt sie zurück, wenn
 * das Inventar danach nicht geschrieben werden kann. Ohne Inventar kein
 * Stück, und eines, das niemand hält, wäre ein Waisenkind.
 */
export function stueckWerkstatt(deps: StueckDeps, stand: Stand, kampagne: Entity | null) {
  const map = new Map(stand.map);
  const nummern: string[] = [];
  const angelegt: string[] = [];
  let ebene: Entity | null | undefined;

  return {
    /** Was diese Werkstatt angelegt hat. */
    angelegt,
    /** Der Bestand samt den neuen Stücken. */
    bestand: map as ReadonlyMap<string, Entity>,
    /**
     * `qty` Stück von `itemId` in `inventar`. Das neue Inventar kommt
     * zurück (noch nicht geschrieben) — oder die Prüfgründe, wenn das
     * Stück nicht angelegt werden konnte. `autor`: das Konto, dem das
     * Stück gehört (D72) — eine Spielerin graviert, was sie bekam.
     */
    async geben(
      inventar: Entity,
      itemId: string,
      qty: number,
      autor?: string | null,
    ): Promise<{ inventory: Entity; piece: string; created: boolean } | { issues: ReturnType<typeof validateEntity> }> {
      const item = map.get(itemId);
      /* Ein Stück, das weitergegeben wird, bleibt dieses Stück — eine
         Instanz einer Instanz wäre ein Umweg ohne Grund. */
      const eigenes = !item || isInstance(item);
      const stueckId = eigenes ? itemId : neueArtikelId(map);
      const r = receivePiece(inventar, itemId, qty, { edge: `${inventar.id}~holds-${randomUUID().slice(0, 8)}`, to: stueckId }, map);
      if (!r.created || eigenes || !item) return { ...r, created: false };
      if (ebene === undefined) ebene = await deps.kampagnenEbene(stand.map, kampagne);
      const nummer = nextId(map.values(), primaryInterface(item), nummern);
      nummern.push(nummer);
      const stueck = newInstance(item, { id: stueckId, number: nummer, layer: ebene?.id ?? null });
      const geschrieben = await deps.schreibeGeprueft(stueck, null);
      if ('issues' in geschrieben) return geschrieben;
      angelegt.push(stueckId);
      map.set(stueckId, stueck);
      if (autor) await deps.repo.addAuthored(autor, stueckId);
      return r;
    },
    /** Alles wieder weg, was diese Werkstatt angelegt hat. */
    async zuruecknehmen(): Promise<void> {
      for (const id of angelegt.splice(0)) await deps.repo.deleteEntity(id);
    },
  };
}

export interface GebenDeps extends StueckDeps {
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  /** Darf dieses Konto den Artikel schreiben (wie an `PUT`)? */
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
}

/**
 * **Geben** (T-150): `POST /api/inventories/:id/give` mit `{ item, qty }`.
 * Was die Leitung austeilt — Beute, ein Geschenk, die Belohnung für einen
 * Auftrag — und was eine Spielerin selbst in ihr Inventar legt: ein Stück
 * als Instanz. Die Leitung der laufenden Kampagne gibt in jedes Inventar,
 * das sie sieht, sonst darf geben, wer das Inventar schreibt; der
 * Gegenstand muss für ihn sichtbar sein.
 */
export function registerGeben(app: FastifyInstance, deps: GebenDeps): void {
  const { repo, viewerOf, roh, sieve, darfSchreiben } = deps;

  app.post<{ Params: { id: string }; Body: { item?: unknown; qty?: unknown } | null }>(
    '/api/inventories/:id/give',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
      const stand = await roh();
      const registry = await repo.getRegistry();
      const roherInv = stand.map.get(request.params.id);
      const [sichtbar] = roherInv ? await sieve(request, [roherInv], stand.map) : [];
      if (!roherInv || !sichtbar || primaryInterface(roherInv) !== 'Inventory') return reply.code(404).send({ error: 'Kein Inventar.' });
      const kampagne = currentCampaign(stand.map, registry.settings ?? null);
      const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
      const leitet = user.isAdmin || rolle === 'gm' || rolle === 'co-gm';
      /* Die Leitung teilt aus, wohin sie will (wie beim Kauf für jede Figur);
         sonst nur, wer das Inventar schreibt. */
      if (!leitet && !(await darfSchreiben(request, roherInv.id))) return reply.code(403).send({ error: 'Das gehört dir nicht.' });
      const item = stand.map.get(String(request.body?.item ?? ''));
      const [itemSichtbar] = item ? await sieve(request, [item], stand.map) : [];
      if (!item || !itemSichtbar) return reply.code(404).send({ error: 'Diesen Gegenstand gibt es nicht.' });
      const qty = Math.max(1, Math.trunc(Number(request.body?.qty ?? 1)) || 1);
      /* Frisch gelesen: gegen diese Revision wird geschrieben. */
      const inventar = (await repo.getEntity(roherInv.id)) ?? roherInv;
      const werkstatt = stueckWerkstatt(deps, stand, kampagne);
      const r = await werkstatt.geben(inventar, item.id, qty, leitet ? null : user.id);
      if ('issues' in r) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: r.issues });
      /* Beute und Geschenke liegen erst vor der Figur (T-140): verstaut wird am Tisch. */
      const ankunft = arriveUnstowed(inventar, r.inventory, () => `${inventar.id}~holds-${randomUUID().slice(0, 8)}`);
      const gesperrt = await reservierteSperre(repo, user, inventar, ankunft);
      let fehler: { code: number; body: unknown } | null = gesperrt ? { code: 423, body: { error: gesperrt } } : null;
      if (!fehler) {
        try {
          const w = await deps.schreibeGeprueft(ankunft, inventar.revision ?? null);
          if ('issues' in w) fehler = { code: 422, body: { error: 'Validierung fehlgeschlagen', issues: w.issues } };
        } catch (e) {
          if (!(e instanceof RevisionConflict)) throw e;
          fehler = { code: 409, body: { error: 'Inzwischen hat sich etwas geändert — noch einmal versuchen.' } };
        }
      }
      if (fehler) {
        await werkstatt.zuruecknehmen();
        return reply.code(fehler.code).send(fehler.body);
      }
      await repo.appendEvent('inventory.given', inventar.id, {
        item: item.id,
        qty,
        piece: r.piece,
        ...(r.created ? { created: true } : {}),
        by: user.id,
      });
      return { item: { id: item.id, name: entityName(item) }, piece: r.piece, qty, created: r.created };
    },
  );
}
