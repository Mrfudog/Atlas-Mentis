/**
 * **Reservierte Stücke sind gesperrt** (T-134, Folge aus T-128, REQ-184).
 *
 * Das Material eines Fertigungsauftrags bleibt im Inventar und trägt
 * `holds.props.reservedFor`. Die Maske bot es schon nicht zum Verschieben
 * an; ein `PUT` hätte es trotzdem verkauft, verbraucht, verschoben oder
 * gelöscht. Darum prüft der Server — über das Repository, an jeder
 * Schreibung, die nicht die des Auftrags selbst ist: frei wird ein Stück
 * nur durch Abschluss oder Abbruch des Auftrags (`handwerk.ts`), durch die
 * Leitung, oder indem der Auftrag gelöscht wird (dann wie ein Abbruch).
 *
 * Der Laden (T-133) und die Übernahme (T-130) fragen dieselbe Funktion
 * (`reservierteSperre`), bevor sie ein Inventar schreiben.
 */
import {
  applySettlement,
  currentCampaign,
  entityName,
  ORDER_COMPONENT,
  primaryInterface,
  reservationBreaches,
  reservedFor,
  reservedPieces,
  tableRole,
  type Entity,
  type ReservationBreach,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

const ORDER_TYPE = 'CraftingOrder';

/** Läuft der Auftrag noch? Ein abgeschlossener, abgebrochener oder fehlender sperrt nichts. */
export function auftragLaeuft(map: ReadonlyMap<string, Entity>): (id: string) => boolean {
  return (id) => {
    const o = map.get(id);
    if (!o || primaryInterface(o) !== ORDER_TYPE) return false;
    const outcome = o.components?.[ORDER_COMPONENT]?.['outcome'];
    return outcome === undefined || outcome === null || outcome === '' || outcome === 'open';
  };
}

/** Die Leitung gibt frei (T-134): Verwaltung, `gm` und `co-gm` der laufenden Kampagne — wie am Auftrag. */
async function leitet(repo: Repository, user: User | null, map: Map<string, Entity>): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin) return true;
  const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
  const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
  return rolle === 'gm' || rolle === 'co-gm';
}

/**
 * „Reserved for crafting order …" — mit den Namen, damit man weiss, wo man
 * abbricht. Englisch, weil die Maske sie so zeigt, wie sie kommt.
 */
function meldung(breaches: ReservationBreach[], map: ReadonlyMap<string, Entity>): string {
  const stuecke = breaches.map((b) => {
    const was = entityName(map.get(b.item)) || b.item;
    if (b.change === 'added') return `${was}: only a crafting order reserves materials`;
    return `${was} is reserved for crafting order “${entityName(map.get(b.order)) || b.order}”`;
  });
  return `${[...new Set(stuecke)].join('; ')}. It is freed when the order is finished or aborted, or by the GM.`;
}

/**
 * **Darf diese Schreibung reservierte Stücke anrühren?** `vorher` ist der
 * gespeicherte Stand (oder nichts: neu), `nachher` der neue (oder nichts:
 * gelöscht). Antwortet mit der Meldung, wenn nicht, sonst mit `null`.
 */
export async function reservierteSperre(
  repo: Repository,
  user: User | null,
  vorher: Entity | null | undefined,
  nachher: Entity | null | undefined,
  bestand?: Map<string, Entity>,
): Promise<string | null> {
  const fasst = (e: Entity | null | undefined) => (e?.relations ?? []).some((r) => r.type === 'holds' && reservedFor(r));
  if (!fasst(vorher) && !fasst(nachher)) return null;
  const map = bestand ?? new Map((await repo.listEntities()).map((e) => [e.id, e]));
  const breaches = reservationBreaches(vorher, nachher, auftragLaeuft(map));
  if (!breaches.length || (await leitet(repo, user, map))) return null;
  return meldung(breaches, map);
}

/**
 * **Vor dem Löschen** (T-134): ein Inventar mit reserviertem Material und
 * ein Gegenstand, der irgendwo reserviert liegt, gehen nicht (ausser durch
 * die Leitung). Ein Auftrag darf gehen und gibt vorher alles frei, wie ein
 * Abbruch — sonst sperrte sein Material, bis jemand die Kante von Hand
 * putzt.
 */
export async function vorDemLoeschen(
  repo: Repository,
  user: User | null,
  weg: Entity,
  map: Map<string, Entity>,
): Promise<string | null> {
  if (primaryInterface(weg) === ORDER_TYPE) {
    for (const inv of map.values()) {
      const stuecke = reservedPieces(inv, weg.id);
      if (stuecke.length) await repo.putEntity(applySettlement(inv, new Map(stuecke.map((p) => [p.edge, p.qty]))));
    }
    return null;
  }
  const laeuft = auftragLaeuft(map);
  const breaches: ReservationBreach[] = [];
  for (const inv of map.values()) {
    if (inv.id === weg.id) {
      breaches.push(...reservationBreaches(inv, null, laeuft));
      continue;
    }
    for (const r of inv.relations ?? []) {
      const order = r.type === 'holds' && r.to === weg.id ? reservedFor(r) : null;
      if (order && laeuft(order)) breaches.push({ edge: r.id, item: r.to, order, change: 'removed' });
    }
  }
  if (!breaches.length || (await leitet(repo, user, map))) return null;
  return meldung(breaches, map);
}
