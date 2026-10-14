/**
 * **Liegengelassen** (T-140): `POST /api/sessions/:id/end` und
 * `POST /api/sessions/:id/pick-up`, dazu `liegenlassen` für den Wechsel
 * der Szene (Regel `immediately`).
 *
 * Was in den Inventaren der laufenden Kampagne unverstaut liegt
 * (`holds.props.unstowed`), verlässt sie und steht an der Sitzung als
 * `leftBehind` — je nach `Campaign.stowing` beim Sitzungsende oder schon,
 * wenn der Tisch weiterzieht. Gelöscht wird nichts. Die Inventare sind die
 * der Gruppen dieser Kampagne und ihrer Figuren, samt Behältern darin
 * (`inventareDerFigur`). Geschrieben wird gegen die gelesene Revision und
 * durch `validateEntity`; der Live-Kanal (T-116) sagt es jedem am Tisch.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  currentCampaign,
  leaveBehind,
  partiesOf,
  pickUp,
  primaryInterface,
  stowingRuleOf,
  tableRole,
  typeChain,
  type Entity,
  type LeftPiece,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import { inventareDerFigur } from './laden.js';
import { RevisionConflict, type Repository } from './repo.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface LiegenDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (
    entity: Entity,
    erwartet?: number | null,
  ) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
}

const SESSION_TYPE = 'Session';

/** Die Inventare einer Kampagne: ihre Gruppen, deren Figuren, und die Behälter darin. */
export function inventareDerKampagne(map: ReadonlyMap<string, Entity>, kampagneId: string): string[] {
  const gruppen = partiesOf(map as Map<string, Entity>, kampagneId);
  const ids = new Set(gruppen.map((g) => g.id));
  const traeger = [
    ...gruppen,
    ...[...map.values()].filter((e) => (e.relations ?? []).some((r) => r.type === 'memberOfParty' && ids.has(r.to))),
  ];
  return [...new Set(traeger.flatMap((t) => inventareDerFigur(t, map)))];
}

const neueKante = (von: string, art: string): string => `${von}~${art}-${randomUUID().slice(0, 8)}`;

/**
 * **Liegenlassen**, was in der Kampagne unverstaut liegt, an `sitzungId`.
 * Erst die Inventare, dann die Sitzung, je gegen die frische Revision —
 * kommt etwas dazwischen, bleibt der Rest, wie er war, und der nächste
 * Lauf nimmt es mit. Gibt zurück, was liegen blieb.
 */
export async function liegenlassen(
  deps: Pick<LiegenDeps, 'repo' | 'roh' | 'schreibeGeprueft'>,
  sitzungId: string,
  kampagne: Entity,
  grund: 'end' | 'movedOn',
): Promise<LeftPiece[]> {
  const { repo, roh, schreibeGeprueft } = deps;
  const stand = await roh();
  const sitzung = await repo.getEntity(sitzungId);
  if (!sitzung) return [];
  const inventare = (await Promise.all(inventareDerKampagne(stand.map, kampagne.id).map((id) => repo.getEntity(id)))).filter(
    (e): e is Entity => !!e,
  );
  const r = leaveBehind(sitzung, inventare, { at: new Date().toISOString(), newId: () => neueKante(sitzung.id, 'leftBehind') });
  if (!r.left.length) return [];
  /* **Erst die Sitzung, dann die Inventare**: scheitert danach eins, liegt
     sein Stapel kurz doppelt da und wird an der Sitzung wieder gestrichen —
     andersherum wäre er verloren. */
  const s = await schreibeGeprueft(r.session, sitzung.revision ?? null);
  if ('issues' in s) return [];
  const blieb = new Set<string>();
  for (const inv of r.inventories) {
    try {
      const w = await schreibeGeprueft(inv, inv.revision ?? null);
      if ('issues' in w) blieb.add(inv.id);
    } catch (fehler) {
      if (!(fehler instanceof RevisionConflict)) throw fehler;
      blieb.add(inv.id);
    }
  }
  const left = r.left.filter((l) => !blieb.has(l.inventory));
  if (blieb.size) {
    const nachher = (await repo.getEntity(sitzung.id)) ?? s.stored;
    const neu = new Set((r.session.relations ?? []).map((k) => k.id));
    const alt = new Set((sitzung.relations ?? []).map((k) => k.id));
    const streichen = new Set(
      (r.session.relations ?? [])
        .filter((k) => neu.has(k.id) && !alt.has(k.id) && blieb.has(String(k.props?.['from'] ?? '')))
        .map((k) => k.id),
    );
    await schreibeGeprueft({ ...nachher, relations: (nachher.relations ?? []).filter((k) => !streichen.has(k.id)) }, nachher.revision ?? null);
  }
  if (!left.length) return [];
  await repo.appendEvent('inventory.leftBehind', sitzung.id, { reason: grund, pieces: left });
  return left;
}

export function registerLiegen(app: FastifyInstance, deps: LiegenDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, darfSchreiben } = deps;

  /** Die Sitzung, sichtbar und eine Sitzung — sonst die Antwort. */
  async function sitzungFuer(
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<{ fehler: { code: number; error: string } } | { user: User; stand: Stand; sitzung: Entity; kampagne: Entity | null; leitet: boolean }> {
    const user = await viewerOf(request);
    if (!user) return { fehler: { code: 401, error: 'Nicht angemeldet' } };
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roh_ = stand.map.get(request.params.id);
    const [sichtbar] = roh_ ? await sieve(request, [roh_], stand.map) : [];
    if (!roh_ || !sichtbar || !typeChain(registry, primaryInterface(roh_)).includes(SESSION_TYPE)) {
      return { fehler: { code: 404, error: 'Keine Sitzung.' } };
    }
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    const leitet = user.isAdmin || rolle === 'gm' || rolle === 'co-gm';
    return { user, stand, sitzung: roh_, kampagne, leitet };
  }

  /**
   * **Die Sitzung endet** — mit `bySessionEnd` oder `immediately` bleibt
   * liegen, was nicht verstaut ist. Nur die Leitung beendet eine Sitzung.
   * Mit `anytime` bleibt alles, wo es ist; die Antwort sagt die Regel.
   */
  app.post<{ Params: { id: string } }>('/api/sessions/:id/end', async (request, reply) => {
    const v = await sitzungFuer(request);
    if ('fehler' in v) return reply.code(v.fehler.code).send({ error: v.fehler.error });
    if (!v.leitet) return reply.code(403).send({ error: 'Die Sitzung beendet die Leitung.' });
    const rule = stowingRuleOf(v.kampagne);
    if (!v.kampagne || rule === 'anytime') return { rule, left: [] };
    try {
      const left = await liegenlassen({ repo, roh, schreibeGeprueft }, v.sitzung.id, v.kampagne, 'end');
      return { rule, left };
    } catch (fehler) {
      if (fehler instanceof RevisionConflict) return reply.code(409).send({ error: 'Inzwischen hat sich etwas geändert — noch einmal versuchen.' });
      throw fehler;
    }
  });

  /**
   * **Aufheben**: ein liegengelassener Stapel kommt in ein Inventar, das
   * der Aufhebende schreibt (die eigene Figur, die Gruppe — wie jedes
   * Schreiben), wieder unverstaut. Die Sitzung schreibt dabei der Server:
   * aufheben darf, wer das Ziel schreibt, auch ohne die Sitzung zu führen.
   */
  app.post<{ Params: { id: string }; Body: { edge?: unknown; inventory?: unknown } | null }>(
    '/api/sessions/:id/pick-up',
    async (request, reply) => {
      const v = await sitzungFuer(request);
      if ('fehler' in v) return reply.code(v.fehler.code).send({ error: v.fehler.error });
      const zielId = String(request.body?.inventory ?? '');
      const ziel = await repo.getEntity(zielId);
      if (!ziel || primaryInterface(ziel) !== 'Inventory') return reply.code(400).send({ error: 'Wohin? Das Inventar fehlt.' });
      if (!(await darfSchreiben(request, ziel.id))) return reply.code(403).send({ error: 'Dieses Inventar schreibst du nicht.' });
      const sitzung = (await repo.getEntity(v.sitzung.id)) ?? v.sitzung;
      const r = pickUp(sitzung, ziel, String(request.body?.edge ?? ''), neueKante(ziel.id, 'holds'));
      if ('refused' in r) return reply.code(409).send({ error: 'Das liegt hier nicht (mehr).', refused: r.refused });
      try {
        const a = await schreibeGeprueft(r.inventory, ziel.revision ?? null);
        if ('issues' in a) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: a.issues });
        const b = await schreibeGeprueft(r.session, sitzung.revision ?? null);
        if ('issues' in b) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: b.issues });
      } catch (fehler) {
        if (fehler instanceof RevisionConflict) return reply.code(409).send({ error: 'Inzwischen hat sich etwas geändert — noch einmal versuchen.' });
        throw fehler;
      }
      await repo.appendEvent('inventory.pickedUp', sitzung.id, { item: r.item, qty: r.qty, inventory: ziel.id, by: v.user.id });
      return { item: r.item, qty: r.qty, inventory: ziel.id };
    },
  );
}
