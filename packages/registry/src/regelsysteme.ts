/**
 * **Die Regelsysteme, die jede Installation hat** (E-166, T-394): das
 * Regelsystem Inventory mit seinen Mechaniken Weight, Slots und Grid.
 * Ebenen, also Artikel — aber Startzeilen wie das
 * Register: der Start legt an, was fehlt (`regelsystemeNachziehen` am
 * Server), und lässt stehen, was da ist; was die Leitung daran ändert,
 * bleibt. Die Nummer (`Identity.id`) vergibt der Server beim Anlegen.
 *
 * Grid gilt mit Weight (Leitung, 22.10.). Die Vorgabeformen trägt Grid
 * selbst (D90); eine eigene Mechanik Default shapes gibt es nicht mehr —
 * ein Formmodul, nicht zwei (D91, Migration 151).
 */

import type { Entity } from '@nw/model';

const ebene = (
  id: string,
  art: 'RuleSystem' | 'RuleMechanic',
  name: string,
  layer: Record<string, unknown>,
  eigen: Record<string, unknown>,
  text: string,
  relations: { type: string; to: string }[] = [],
): Entity => ({
  id,
  name,
  interfaces: [art],
  components: {
    Identity: { name, aliases: [] },
    Status: { status: 'ready' },
    Description: { description: text },
    Layer: layer,
    [art]: eigen,
  },
  relations: relations.map((r) => ({ id: `${id}~${r.type}-${r.to}`, type: r.type, to: r.to, props: {} })),
});

const INV = 'ly_rs_inventory';

export const RULE_SYSTEM_LAYERS: readonly Entity[] = [
  ebene(INV, 'RuleSystem', 'Inventory', { kind: 'group', order: 5 }, { sort: 'inventory' },
    'How a table counts what characters carry. Turned on in a campaign it brings its mechanics; single mechanics can be taken out or moved up.'),
  ebene('ly_rm_weight', 'RuleMechanic', 'Weight', { kind: 'pack', order: 5 }, { method: 'weight' },
    'Carrying by weight, with the encumbrance stages of the Player’s Handbook variant.', [{ type: 'partOf', to: INV }]),
  ebene('ly_rm_slots', 'RuleMechanic', 'Slots', { kind: 'pack', order: 5 }, { method: 'slots' },
    'Carrying by slots: one slot per stack, and a stack holds the item’s stack size.', [{ type: 'partOf', to: INV }]),
  ebene('ly_rm_grid', 'RuleMechanic', 'Grid', { kind: 'pack', order: 5 }, { method: 'grid' },
    'Carrying in a grid: every item takes its shape, and containers have zones that set how long drawing takes.',
    [{ type: 'partOf', to: INV }, { type: 'compatibleWith', to: 'ly_rm_weight' }]),
];
