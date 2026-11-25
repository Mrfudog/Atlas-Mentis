/**
 * Was die Liste der Boards und das Board selbst gemeinsam brauchen: wozu
 * ein Board gehört, und wie es geschrieben wird.
 */

import { Injectable, inject } from '@angular/core';
import {
  BOARD_TYPE,
  entityName,
  mergeEntity,
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
 * Sitzung. Gelesen aus den Zeilen der Liste, die `partOf` mittragen
 * (`/api/list?rel=partOf`, W7) — oder aus ganzen Artikeln; ein Kreis
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
  /**
   * `basis` ist der Stand, von dem die Änderung ausging. Ist er gegeben und
   * weist der Server ab, weil jemand anders gespeichert hat, wird
   * zusammengeführt (`mergeEntity`, REQ-192): **berühren sich die beiden
   * Änderungen nicht** — zwei Tokens, Nebel hier und ein Zug dort —, geht
   * das Ergebnis gleich nochmals hinaus (T-399, REQ-398 Akzeptanz 4).
   * Berühren sie sich, gilt, wer zuerst speicherte.
   */
  async schreiben(e: Entity, basis?: Entity): Promise<Mangel | null> {
    const r = this.bestand.registry();
    if (!r) return { text: 'The registry is not loaded.', einzeln: [] };
    /* Ohne `knownTypes`: welche Arten die Ziele haben, weiss nur der
       Bestand, und den hält die Seite nicht mehr (W7) — das prüft der
       Server, der ihn hat. */
    const issues = validateEntity(r, e);
    if (issues.length) {
      return { text: 'This would not be valid.', einzeln: issues.map(issueText) };
    }
    try {
      await this.api.putEntity(e);
      await this.bestand.oeffnen(e.id, true, false);
      return null;
    } catch (error) {
      /* Jemand anders hat gespeichert (REQ-192): nichts ist geschrieben.
         Das Board holt den Stand, der gilt — der nächste Zug geht von dort
         aus, statt den der anderen still zu überschreiben. */
      if (error instanceof ApiError && error.status === 409) {
        if (basis) {
          const zusammen = await this.zusammenfuehren(basis, e).catch(() => null);
          if (zusammen) return this.schreiben(zusammen);
        }
        await this.bestand.oeffnen(e.id, true, false);
        return { text: 'Someone else changed this meanwhile — reloaded. Please try again.', einzeln: [] };
      }
      if (error instanceof ApiError) {
        return {
          text: error.message,
          einzeln: Array.isArray(error.issues) ? error.issues.map(issueText) : [],
        };
      }
      return { text: 'Could not reach the server.', einzeln: [] };
    }
  }

  /** Drei Fassungen zusammen — oder `null`, wenn sich die Änderungen berühren. */
  private async zusammenfuehren(basis: Entity, mine: Entity): Promise<Entity | null> {
    const { refs: _r, fromTemplate: _f, ...theirs } = (await this.api.entity(mine.id)) as Entity & { refs?: unknown; fromTemplate?: unknown };
    const ohne = (x: Entity): Entity => {
      const { refs: _x, fromTemplate: _y, ...rest } = x as Entity & { refs?: unknown; fromTemplate?: unknown };
      return rest as Entity;
    };
    const r = mergeEntity(ohne(basis), ohne(mine), theirs as Entity);
    return r.conflicts.length ? null : r.merged;
  }

  /**
   * Ein neues Board, für einen Geschichtsartikel (REQ-205) oder ohne einen
   * — dann ist es ein Regel-Board. Es heisst wie sein Artikel: das Board
   * der Sitzung „Die Kerzengasse" ist „Die Kerzengasse".
   */
  async anlegen(story?: Entity, name?: string): Promise<{ id: string } | Mangel> {
    const titel = (name ?? (story ? entityName(story) : '') ?? '').trim() || 'New board';
    /* Angelegt wird am Server (W7): er vergibt Peg-Id und Nummer (`nextId`)
       über den ganzen Bestand, den die Seite nicht hält. */
    try {
      const neu = await this.api.createEntity(
        BOARD_TYPE,
        titel,
        {},
        story ? [{ type: PART_OF_RELATION, to: story.id }] : [],
      );
      await this.bestand.oeffnen(neu.id, true, false);
      return { id: neu.id };
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
}
