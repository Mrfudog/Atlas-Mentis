/**
 * **Pflicht je Stand** (T-425, REQ-441, E-177, E-178, E-180).
 *
 * `required` gilt immer; `requiredFor` erst für einen Stand: eine Szene
 * darf als Idee ohne Beschreibung dastehen, aber nicht `ready` werden.
 * So bleiben Ideen schnell, und was die Runde sieht, ist vollständig.
 *
 * Die Angabe steht am Feld (`PropertySchema.requiredFor`) oder an der
 * Kantenart (`RelationDef.requiredFor`, gilt für den Anfang der Kante) und
 * darf je Art überschrieben werden (`InterfaceDef.requiredFor`, Schlüssel
 * `Typ.feld` oder `edge:<Kantenart>`, `none` hebt auf) — die `extends`-Kette
 * hoch geerbt wie `titles`, die genaueste Art gewinnt.
 *
 * **Geprüft wird beim Setzen eines Stands** (E-178): wer einen Artikel auf
 * einen höheren Stand hebt, muss die Pflicht dieses Stands erfüllen. Wer
 * den Stand schon hat, behält ihn, auch wenn später etwas fehlt — die
 * Werkbank zeigt das als „Ready with gaps" (`readyWithGaps`), statt dass
 * ein fertiger Artikel beim nächsten Tippfehler verschwindet. Fällt ein
 * Artikel nach D74 zurück, landet er auf dem höchsten Stand, den er
 * erreicht (`reachableState`).
 */

import { enumOptions, primaryInterface, typeChain } from './entity.js';
import type { Entity, Registry, RequiredState } from './types.js';
import { STATUS_COMPONENT as STATUS_CARD } from './visibility.js';
/** Die Stände in ihrer Reihenfolge, wenn das Register keine Zeile `State` trägt. */
const STAENDE = ['idea', 'prepared', 'ready'] as const;

type Reg = Pick<Registry, 'interfaces' | 'relations' | 'enums'>;

/** Was für einen Stand fehlt: ein Feld (`Typ.feld`) oder eine Kante (`edge:<Art>`). */
export interface StateGap {
  kind: 'field' | 'edge';
  ref: string;
  label: string;
  /** Ab welchem Stand es Pflicht ist. */
  state: RequiredState;
}

/** Die Stände in Reihenfolge, gelesen aus der Zeile `State` (`Status.status`). */
export function stateOrder(registry: Pick<Registry, 'interfaces' | 'enums'>): string[] {
  const prop = registry.interfaces[STATUS_CARD]?.schema?.properties['status'];
  const werte = enumOptions(registry, prop);
  return werte?.length ? werte : [...STAENDE];
}

/** Der Rang eines Stands; ohne Stand oder unbekannt: -1. */
function rang(order: readonly string[], state: unknown): number {
  return typeof state === 'string' ? order.indexOf(state) : -1;
}

/** Der Stand, den ein Artikel trägt, oder `undefined` (ohne Karte, D72: zählt als fertig). */
export function stateOf(entity: Entity): string | undefined {
  const s = (entity.components?.[STATUS_CARD] as { status?: unknown } | undefined)?.status;
  return typeof s === 'string' && s ? s : undefined;
}

/**
 * **Was an dieser Art für welchen Stand Pflicht ist**: `Typ.feld` bzw.
 * `edge:<Kantenart>` → Stand. Zuerst die Angaben an Feldern und Kanten,
 * dann die der Arten, von der allgemeinsten zur genauesten — so gewinnt
 * die genaueste, und `none` nimmt heraus.
 */
export function requiredForOf(registry: Reg, type: string): Map<string, RequiredState> {
  const kette = typeChain(registry, type);
  const raus = new Map<string, RequiredState>();
  for (const t of kette) {
    for (const [feld, prop] of Object.entries(registry.interfaces[t]?.schema?.properties ?? {})) {
      if (prop.requiredFor && !prop.derived) raus.set(`${t}.${feld}`, prop.requiredFor);
    }
  }
  const nennt = (l: readonly string[] | undefined) => !l?.length || l.some((x) => x === '*' || kette.includes(x));
  for (const def of Object.values(registry.relations ?? {})) {
    if (def.requiredFor && nennt(def.from)) raus.set(`edge:${def.type}`, def.requiredFor);
  }
  for (const t of [...kette].reverse()) {
    for (const [ref, stand] of Object.entries(registry.interfaces[t]?.requiredFor ?? {})) {
      if (stand === 'none') raus.delete(ref);
      else raus.set(ref, stand);
    }
  }
  return raus;
}

const leer = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * **Was diesem Artikel für `state` fehlt** — alles, was für diesen Stand
 * oder einen darunter Pflicht ist. Für `idea` (und einen unbekannten
 * Stand) fehlt nie etwas: `required` prüft `validateEntity`.
 */
export function stateGaps(registry: Reg, entity: Entity, state: string): StateGap[] {
  const order = stateOrder(registry);
  const ziel = rang(order, state);
  if (ziel <= 0) return [];
  const raus: StateGap[] = [];
  for (const [ref, stand] of requiredForOf(registry, primaryInterface(entity))) {
    if (rang(order, stand) > ziel) continue;
    if (ref.startsWith('edge:')) {
      const art = ref.slice(5);
      if (!(entity.relations ?? []).some((r) => r.type === art)) {
        raus.push({ kind: 'edge', ref, label: registry.relations?.[art]?.label ?? art, state: stand });
      }
      continue;
    }
    const [typ = '', feld = ''] = ref.split('.');
    const prop = registry.interfaces[typ]?.schema?.properties[feld];
    if (!prop) continue;
    if (leer((entity.components?.[typ] as Record<string, unknown> | undefined)?.[feld])) {
      const titel = registry.interfaces[primaryInterface(entity)]?.titles?.[ref];
      raus.push({ kind: 'field', ref, label: titel ?? prop.title ?? feld, state: stand });
    }
  }
  return raus;
}

/** Der höchste Stand bis `wanted`, den der Artikel ohne Lücke erreicht. */
export function reachableState(registry: Reg, entity: Entity, wanted: string): string {
  const order = stateOrder(registry);
  for (let i = rang(order, wanted); i > 0; i--) {
    if (!stateGaps(registry, entity, order[i]!).length) return order[i]!;
  }
  return order[0] ?? 'idea';
}

/**
 * **Darf dieser Artikel so gespeichert werden?** (E-178) Steigt sein Stand
 * (oder kommt er neu mit einem Stand über `idea`), muss die Pflicht des
 * neuen Stands erfüllt sein; sonst die Lücken. Bleibt der Stand oder
 * sinkt er, wird nichts verwehrt — fehlt dann etwas, sagt es die Werkbank.
 */
export function stateRefusal(registry: Reg, before: Entity | undefined, after: Entity): StateGap[] | null {
  const neu = stateOf(after);
  if (!neu) return null;
  const order = stateOrder(registry);
  const alt = before ? stateOf(before) : undefined;
  /* Ohne Karte zählte der alte Artikel als fertig (D72): kein Aufstieg. */
  if (before && alt === undefined) return null;
  if (rang(order, neu) <= rang(order, alt)) return null;
  const luecken = stateGaps(registry, after, neu);
  return luecken.length ? luecken : null;
}

/** Ein Satz für die Maske: was fehlt, um `state` zu setzen — und was zu tun ist. */
export function stateGapMessage(state: string, gaps: readonly StateGap[]): string {
  const was = gaps.map((g) => (g.kind === 'edge' ? `a “${g.label}” edge` : g.label)).join(', ');
  return `To set ${state}, fill in: ${was}. Keep a lower state until then.`;
}
