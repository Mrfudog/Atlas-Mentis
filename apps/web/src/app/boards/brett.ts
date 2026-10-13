/**
 * Was die Liste der Boards und das Board selbst gemeinsam brauchen: wozu
 * ein Board gehört, und wie es geschrieben wird.
 */

import { Injectable, inject } from '@angular/core';
import {
  BOARD_TYPE,
  entityName,
  nextId,
  PART_OF_RELATION,
  primaryInterface,
  typeChain,
  validateEntity,
} from '@nw/model';
import type { Entity, Registry, ValidationIssue } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';

/**
 * Ein Board je Geschichtsartikel — Kampagne, Kapitel, Sitzung, **nicht
 * Szene** (REQ-205): eine Szene ist eine Karte auf dem Board ihrer
 * Sitzung und kein eigener Schirm. Kapitel und Arc sind Wörter an `Story`
 * (`Story.kind`), also zählt alles, was eine Story ist, ausser der Szene.
 */
const STORY_TYPE = 'Story';
const SCENE_TYPE = 'Scene';

export function isStoryRung(registry: Pick<Registry, 'interfaces'>, e: Entity): boolean {
  const kette = typeChain(registry, primaryInterface(e));
  return kette.includes(STORY_TYPE) && !kette.includes(SCENE_TYPE);
}

export function isBoard(e: Entity): boolean {
  return primaryInterface(e) === BOARD_TYPE;
}

/** Wozu dieses Board gehört (`partOf`), oder nichts — dann ist es ein Regel-Board. */
export function storyOf(board: Entity): string | undefined {
  return (board.relations ?? []).find((r) => r.type === PART_OF_RELATION)?.to;
}

/**
 * Die Kette über einem Artikel, die oberste zuerst: Kampagne › Kapitel ›
 * Sitzung. Gelesen aus der Kurzfassung, die `partOf` mitträgt; ein Kreis
 * hört beim zweiten Besuch auf.
 */
export function chainAbove(byId: ReadonlyMap<string, Entity>, id: string): Entity[] {
  const out: Entity[] = [];
  const gesehen = new Set<string>([id]);
  let jetzt = byId.get(id);
  while (jetzt) {
    const hoch = (jetzt.relations ?? []).find((r) => r.type === PART_OF_RELATION)?.to;
    if (!hoch || gesehen.has(hoch)) break;
    gesehen.add(hoch);
    const e = byId.get(hoch);
    if (!e) break;
    out.unshift(e);
    jetzt = e;
  }
  return out;
}

/** Ein Fehlschlag beim Schreiben, so gesagt, dass man am Tisch etwas damit anfängt. */
export interface Mangel {
  text: string;
  einzeln: string[];
}

function issueText(i: unknown): string {
  const o = i as Partial<ValidationIssue> & { t?: string; path?: unknown[] };
  if (o.t) return o.t;
  const pfad = Array.isArray(o.path) ? o.path.join('.') : '';
  return pfad ? `${pfad}: ${o.message ?? '?'}` : (o.message ?? JSON.stringify(i));
}

@Injectable({ providedIn: 'root' })
export class Brett {
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);

  /**
   * **Schreiben geht durch `validateEntity`** (CLAUDE.md) — hier zuerst,
   * damit ein kaputter Stand gar nicht erst losgeschickt wird, und am
   * Server noch einmal, weil nur dessen Prüfung zählt. Danach wird der
   * Artikel neu geholt: was die Seite zeigt, ist gesiebt, und das
   * Gespeicherte ist es nicht.
   */
  async schreiben(e: Entity): Promise<Mangel | null> {
    const r = this.bestand.registry();
    if (!r) return { text: 'The registry is not loaded.', einzeln: [] };
    const bekannt = new Map(this.bestand.entities().map((x) => [x.id, primaryInterface(x)]));
    bekannt.set(e.id, primaryInterface(e));
    const issues = validateEntity(r, e, { knownTypes: bekannt });
    if (issues.length) {
      return { text: 'This would not be valid.', einzeln: issues.map(issueText) };
    }
    try {
      await this.api.putEntity(e);
      await this.bestand.oeffnen(e.id, true, false);
      return null;
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          text: error.message,
          einzeln: Array.isArray(error.issues) ? error.issues.map(issueText) : [],
        };
      }
      return { text: 'Could not reach the server.', einzeln: [] };
    }
  }

  /**
   * Ein neues Board, für einen Geschichtsartikel (REQ-205) oder ohne einen
   * — dann ist es ein Regel-Board. Es heisst wie sein Artikel: das Board
   * der Sitzung „Die Kerzengasse" ist „Die Kerzengasse".
   */
  async anlegen(story?: Entity, name?: string): Promise<{ id: string } | Mangel> {
    const titel = (name ?? (story ? entityName(story) : '') ?? '').trim() || 'New board';
    const id = `e-${crypto.randomUUID()}`;
    const neu: Entity = {
      id,
      interfaces: [BOARD_TYPE],
      name: titel,
      components: {
        Identity: { name: titel, id: nextId(this.bestand.entities(), BOARD_TYPE), aliases: [] },
        [BOARD_TYPE]: {},
      },
      relations: story ? [{ id: `r-${crypto.randomUUID()}`, type: PART_OF_RELATION, to: story.id }] : [],
      createdAt: new Date().toISOString(),
    };
    const fehler = await this.schreiben(neu);
    return fehler ?? { id };
  }
}
