/**
 * **Womit gefertigt wird** (REQ-184, T-122): Werkzeug, Attribut und SG
 * einer Handwerksprobe.
 *
 * Das Rezept nennt die Vorgabe seiner Quelle (`Recipe.tool`, `.ability`,
 * `.dc`). Eine Kampagne, eine Gruppe oder eine Figur darf davon abweichen —
 * Weisheit statt Intelligenz für alles, was mit dem Kräuterset gemacht
 * wird, oder eine Figur, die ihre Tränke mit Geschick braut. Die Abweichung
 * ist eine **Kante** `craftsWith` vom Träger zum Rezept oder zum Werkzeug,
 * und sie trägt nur, was sie ändert. Eine Kopie des Rezepts wäre eine
 * zweite Fassung, die die Korrektur am Original nicht mehr erreicht.
 *
 * Gelesen wird vom Allgemeinen zum Besonderen, und das Spätere schlägt das
 * Frühere: Kampagne, Gruppe, Figur — je Träger erst die Kante am Werkzeug,
 * dann die am Rezept. Eine Kante am Werkzeug gilt für jedes Rezept, das
 * **von sich aus** dieses Werkzeug nennt; was eine Kante am Rezept als
 * Werkzeug einsetzt, zieht keine Werkzeugkante nach sich (sonst hinge das
 * Ergebnis von der Reihenfolge der Kanten ab).
 */

import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';

export const CRAFTS_WITH = 'craftsWith';
export const RECIPE_COMPONENT = 'Recipe';

/** Vorgaben, wenn das Rezept nichts sagt — dieselben wie im Register. */
const ABILITY_DEFAULT = 'int';
const DC_DEFAULT = 12;

/** Wer einen Wert gesetzt hat. `recipe`: die Vorgabe der Quelle. */
export interface CraftSource {
  by: 'recipe' | 'campaign' | 'party' | 'actor';
  /** Der Träger der Kante; fehlt bei `recipe`. */
  holder?: EntityId;
  /** Woran die Kante hängt: das Rezept selbst oder sein Werkzeug. */
  on?: 'recipe' | 'tool';
}

export interface CraftCheck {
  /** Name eines Werkzeug-Artikels (E-020), oder leer. */
  tool: string;
  ability: string;
  dc: number;
  source: { tool: CraftSource; ability: CraftSource; dc: CraftSource };
}

export interface CraftContext {
  get(id: EntityId): Entity | undefined;
  campaign?: Entity | null;
  /** Die Figur, die fertigt. Ihre Gruppen liest die Rechnung selbst (`memberOfParty`). */
  actor?: Entity | null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Die Gruppen einer Figur — ein Schritt weit, wie beim Wissen. */
function gruppenVon(actor: Entity): EntityId[] {
  return (actor.relations ?? []).filter((r) => r.type === 'memberOfParty').map((r) => r.to);
}

/**
 * Werkzeug, Attribut und SG, mit denen `actor` dieses Rezept fertigt —
 * und je Wert, wer ihn gesetzt hat. Ohne Kontext die Vorgabe der Quelle.
 */
export function craftCheck(recipe: Entity, ctx: CraftContext): CraftCheck {
  const karte = recipe.components?.[RECIPE_COMPONENT] ?? {};
  const eigenesWerkzeug = text(karte['tool']);
  const quelle: CraftSource = { by: 'recipe' };
  const out: CraftCheck = {
    tool: eigenesWerkzeug,
    ability: text(karte['ability']) || ABILITY_DEFAULT,
    dc: zahl(karte['dc']) ?? DC_DEFAULT,
    source: { tool: quelle, ability: quelle, dc: quelle },
  };

  const traeger: { e: Entity; by: CraftSource['by'] }[] = [];
  if (ctx.campaign) traeger.push({ e: ctx.campaign, by: 'campaign' });
  if (ctx.actor) {
    for (const id of gruppenVon(ctx.actor)) {
      const g = ctx.get(id);
      if (g) traeger.push({ e: g, by: 'party' });
    }
    traeger.push({ e: ctx.actor, by: 'actor' });
  }

  const werkzeugName = eigenesWerkzeug.toLowerCase();
  for (const { e, by } of traeger) {
    const kanten = (e.relations ?? []).filter((r) => r.type === CRAFTS_WITH);
    const amWerkzeug = werkzeugName
      ? kanten.filter((r) => r.to !== recipe.id && entityName(ctx.get(r.to)).toLowerCase() === werkzeugName)
      : [];
    const amRezept = kanten.filter((r) => r.to === recipe.id);
    for (const [on, liste] of [['tool', amWerkzeug], ['recipe', amRezept]] as const) {
      for (const r of liste) {
        const p = r.props ?? {};
        const von: CraftSource = { by, holder: e.id, on };
        /* Das Werkzeug tauscht nur eine Kante am Rezept: eine am Werkzeug,
           die das Werkzeug ersetzt, wäre eine Regel über ein anderes. */
        if (on === 'recipe' && text(p['tool'])) {
          out.tool = text(p['tool']);
          out.source.tool = von;
        }
        if (text(p['ability'])) {
          out.ability = text(p['ability']);
          out.source.ability = von;
        }
        const dc = zahl(p['dc']);
        if (dc !== null) {
          out.dc = dc;
          out.source.dc = von;
        }
      }
    }
  }
  return out;
}
