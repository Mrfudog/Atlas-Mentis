/**
 * **Die Ebenen, die jede Installation hat** (T-425): die Regelsysteme
 * (`RULE_SYSTEM_LAYERS`, E-166) und die **Parkplatz-Ebene „Unassigned“**
 * (E-182, E-186). Startzeilen wie das Register: der Start legt an, was
 * fehlt (`startebenenNachziehen` am Server), und lässt stehen, was da ist.
 *
 * „Unassigned“ nimmt auf, was keine andere Ebene hat — jeder Artikel hat
 * eine (E-182). Sie ist eine gewöhnliche Ebene: nicht aufgeschaltet, bis die
 * Leitung es tut (E-186), und die Werkbank führt ihren Inhalt als offene
 * Arbeit. Ihre Id nennt das Modell (`UNASSIGNED_LAYER`).
 */

import { UNASSIGNED_LAYER, type Entity } from '@nw/model';
import { RULE_SYSTEM_LAYERS } from './regelsysteme.js';

export const UNASSIGNED_LAYER_ROW: Entity = {
  id: UNASSIGNED_LAYER,
  name: 'Unassigned',
  interfaces: ['Layer'],
  components: {
    Identity: { name: 'Unassigned', aliases: [] },
    Status: { status: 'ready' },
    Description: {
      description:
        'Articles that have no other layer wait here. Move each into the layer it belongs to — the workbench lists them under Unassigned. Switch this layer on in a campaign to see its articles there.',
    },
    Layer: { kind: 'pack', order: 5 },
  },
  relations: [],
};

export const START_LAYERS: readonly Entity[] = [...RULE_SYSTEM_LAYERS, UNASSIGNED_LAYER_ROW];
