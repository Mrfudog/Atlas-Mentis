/**
 * **Abläufe als Ansicht mit Steps** (T-425, REQ-440, REQ-433, E-176).
 *
 * Ein geführter Ablauf ist keine eigene Seite mit eigenem Code, sondern
 * eine Erfassungsmaske mit dem Element `steps`: jedes Kind ist eine Seite.
 * Was als Nächstes kommt, steht in keinem Feld — **wo man steht, wird aus
 * dem gelesen, was befüllt ist** (`currentStep`), sonst wäre der Fortschritt
 * die zweite Stelle, die beim Bearbeiten an anderer Stelle falsch steht.
 */
import { typeChain } from './entity.js';
import type { Entity, LayoutElement, Registry } from './types.js';
import { hasValue } from './usage.js';
import { layoutFor } from './views.js';

export interface CreateStep {
  id: string;
  /** Die Überschrift des Kindes, sonst „Step n“. */
  title: string;
  /** Die Felder (`Typ.feld`) der Feldelemente darin, in ihrer Reihenfolge. */
  fields: string[];
}

function flach(els: readonly LayoutElement[]): LayoutElement[] {
  return els.flatMap((el) => [el, ...flach(el.children ?? []), ...(el.tabs ?? []).flatMap((t) => flach(t.layout))]);
}

/** Die Seiten des ersten `steps`-Elements der Maske, oder `null`, wenn sie keines hat. */
export function createSteps(registry: Pick<Registry, 'interfaces' | 'views'>, place: string, type: string): CreateStep[] | null {
  const steps = flach(layoutFor(registry, place, type).layout).find((el) => el.el === 'steps');
  if (!steps) return null;
  return (steps.children ?? []).map((kind, i) => ({
    id: kind.id,
    title: kind.text?.trim() || `Step ${i + 1}`,
    fields: flach([kind])
      .filter((el) => el.el === 'fields' && Array.isArray(el.fields))
      .flatMap((el) => el.fields as string[]),
  }));
}

/**
 * **Wo man steht** (E-176): nach dem letzten Schritt, in dem schon etwas
 * steht, der nächste — ausser weiter vorn fehlt ein Pflichtfeld, dann
 * dort. Nie über den letzten hinaus.
 */
export function currentStep(registry: Pick<Registry, 'interfaces'>, steps: readonly CreateStep[], entity: Entity): number {
  if (!steps.length) return 0;
  const typ = entity.interfaces?.[0] ?? '';
  const pflicht = new Set(
    typeChain(registry, typ).flatMap((t) => (registry.interfaces[t]?.schema?.required ?? []).map((k) => `${t}.${k}`)),
  );
  const wert = (ref: string): unknown => {
    const [t, k] = ref.split('.');
    return (entity.components?.[t ?? ''] as Record<string, unknown> | undefined)?.[k ?? ''];
  };
  let zuletzt = -1;
  steps.forEach((s, i) => {
    if (s.fields.some((f) => hasValue(wert(f)))) zuletzt = i;
  });
  const luecke = steps.findIndex((s) => s.fields.some((f) => pflicht.has(f) && !hasValue(wert(f))));
  const weiter = Math.min(zuletzt + 1, steps.length - 1);
  return luecke >= 0 ? Math.min(luecke, weiter) : weiter;
}

/** Ob die Maske in den Charakter-Assistenten führt (Element `builder`, E-169). */
export function hasBuilder(registry: Pick<Registry, 'interfaces' | 'views'>, place: string, type: string): boolean {
  return flach(layoutFor(registry, place, type).layout).some((el) => el.el === 'builder');
}
