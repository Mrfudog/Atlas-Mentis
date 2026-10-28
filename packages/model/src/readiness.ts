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

import { answerKey, choiceTitle, pendingChoices } from './choices.js';
import { enumOptions, primaryInterface, typeChain } from './entity.js';
import type { Entity, EntityId, Registry, RequiredState } from './types.js';
import { STATUS_COMPONENT as STATUS_CARD } from './visibility.js';
/** Die Stände in ihrer Reihenfolge, wenn das Register keine Zeile `State` trägt. */
const STAENDE = ['idea', 'prepared', 'ready'] as const;

type Reg = Pick<Registry, 'interfaces' | 'relations' | 'enums'>;

/**
 * Was für einen Stand fehlt: ein Feld (`Typ.feld`), eine Kante
 * (`edge:<Art>`) oder ein offener Entscheid (`choice:<Quelle>#<Wahl>`).
 */
export interface StateGap {
  kind: 'field' | 'edge' | 'choice';
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

/**
 * Der Bestand, gegen den die Wahlen einer Figur gelesen werden. Ohne ihn
 * fragt niemand nach Entscheiden — wer nur das Register hat, prüft Felder
 * und Kanten.
 */
export interface GapContext {
  byId?: ReadonlyMap<EntityId, Entity>;
}

/**
 * **Ein offener Entscheid hält bei `idea`** (T-436, E-176): eine Figur
 * entsteht im Assistenten gleich, mit allem, was schon gewählt ist; solange
 * eine Wahl ihrer Abstammung, ihres Hintergrunds, ihrer Klasse oder eines
 * gewährten Merkmals offen ist, darf sie nicht höher. Die Ausrüstung ist
 * kein Entscheid der Figur — sie folgt dem Verfahren der Kampagne und darf
 * auf später gelegt werden (T-193).
 */
const ENTSCHEID_STAND: RequiredState = 'prepared';

/** Die offenen Entscheide einer Figur — dieselbe Frage für Server und Assistent. */
export function openDecisions(entity: Entity, byId: ReadonlyMap<EntityId, Entity>): StateGap[] {
  return pendingChoices(entity, byId)
    .filter((c) => c.choice.kind !== 'equipment')
    .map((c) => ({
      kind: 'choice' as const,
      ref: `choice:${answerKey(c.source.entity.id, c.choice.id, c.source.grant)}`,
      label: choiceTitle(c),
      state: ENTSCHEID_STAND,
    }));
}

const leer = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * **Was diesem Artikel für `state` fehlt** — alles, was für diesen Stand
 * oder einen darunter Pflicht ist. Für `idea` (und einen unbekannten
 * Stand) fehlt nie etwas: `required` prüft `validateEntity`.
 */
export function stateGaps(registry: Reg, entity: Entity, state: string, ctx: GapContext = {}): StateGap[] {
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
  if (ctx.byId && rang(order, ENTSCHEID_STAND) <= ziel) raus.push(...openDecisions(entity, ctx.byId));
  return raus;
}

/** Der höchste Stand bis `wanted`, den der Artikel ohne Lücke erreicht. */
export function reachableState(registry: Reg, entity: Entity, wanted: string, ctx: GapContext = {}): string {
  const order = stateOrder(registry);
  for (let i = rang(order, wanted); i > 0; i--) {
    if (!stateGaps(registry, entity, order[i]!, ctx).length) return order[i]!;
  }
  return order[0] ?? 'idea';
}

/**
 * **Darf dieser Artikel so gespeichert werden?** (E-178) Steigt sein Stand
 * (oder kommt er neu mit einem Stand über `idea`), muss die Pflicht des
 * neuen Stands erfüllt sein; sonst die Lücken. Bleibt der Stand oder
 * sinkt er, wird nichts verwehrt — fehlt dann etwas, sagt es die Werkbank.
 */
export function stateRefusal(registry: Reg, before: Entity | undefined, after: Entity, ctx: GapContext = {}): StateGap[] | null {
  const neu = stateOf(after);
  if (!neu) return null;
  const order = stateOrder(registry);
  const alt = before ? stateOf(before) : undefined;
  /* Ohne Karte zählte der alte Artikel als fertig (D72): kein Aufstieg. */
  if (before && alt === undefined) return null;
  if (rang(order, neu) <= rang(order, alt)) return null;
  const luecken = stateGaps(registry, after, neu, ctx);
  return luecken.length ? luecken : null;
}

/** Ein Satz für die Maske: was fehlt, um `state` zu setzen — und was zu tun ist. */
export function stateGapMessage(state: string, gaps: readonly StateGap[]): string {
  const was = gaps.filter((g) => g.kind !== 'choice').map((g) => (g.kind === 'edge' ? `a “${g.label}” edge` : g.label));
  const wahl = gaps.filter((g) => g.kind === 'choice').map((g) => g.label);
  const teile = [...(was.length ? [`fill in: ${was.join(', ')}`] : []), ...(wahl.length ? [`decide: ${wahl.join(', ')}`] : [])];
  return `To set ${state}, ${teile.join('; ')}. Keep a lower state until then.`;
}
