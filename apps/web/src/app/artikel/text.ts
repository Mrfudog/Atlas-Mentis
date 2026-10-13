import { booleanAttribute, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  entityName,
  linkCandidates,
  parseInline,
  parseMarkdown,
  rollDice,
  rollText,
} from '@nw/model';
import type { Block, Segment, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';

/** Ein Segment, wie die Vorlage es braucht: der Verweis schon aufgelöst. */
type Stueck = Segment & { ziel?: string; titel?: string; schluessel: string };

/**
 * Ein langes Textfeld, gezeichnet (M10–M12).
 *
 * Gelesen wird mit `parseMarkdown` und `parseInline` aus `packages/model` —
 * denselben Funktionen, die der Prototyp nachbildet. **Kein `innerHTML`**:
 * jeder Block wird ein Element, jeder Text ein Textknoten, und was im Feld
 * wie HTML aussieht, steht als Text da.
 *
 * Ein Verweis zeigt auf den Artikel, dessen Id er nennt; ein Name, der
 * mehreres trifft, wird nicht geraten (M11) — er steht da und sagt es.
 * Ein Würfelausdruck ist ein Knopf, und das Ergebnis steht daneben
 * (REQ-070): wer den Wurf nicht sieht, glaubt ihn nicht.
 */
@Component({
  selector: 'nw-text',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <ng-template #bloecke let-liste>
      @for (b of liste; track $index) {
        @switch (b.kind) {
          @case ('heading') {
            <div class="h" [attr.role]="'heading'" [attr.aria-level]="b.level + 2" [class]="'h' + b.level">
              <ng-container *ngTemplateOutlet="zeile; context: { $implicit: b.text }" />
            </div>
          }
          @case ('paragraph') {
            <p><ng-container *ngTemplateOutlet="zeile; context: { $implicit: b.text }" /></p>
          }
          @case ('rule') {
            <hr />
          }
          @case ('quote') {
            <blockquote>
              <ng-container *ngTemplateOutlet="bloecke; context: { $implicit: b.blocks }" />
            </blockquote>
          }
          @case ('list') {
            @if (b.ordered) {
              <ol [attr.start]="b.start === 1 ? null : b.start">
                @for (punkt of b.items; track $index) {
                  <li><ng-container *ngTemplateOutlet="bloecke; context: { $implicit: punkt }" /></li>
                }
              </ol>
            } @else {
              <ul>
                @for (punkt of b.items; track $index) {
                  <li><ng-container *ngTemplateOutlet="bloecke; context: { $implicit: punkt }" /></li>
                }
              </ul>
            }
          }
          @case ('table') {
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    @for (zelle of b.head; track $index) {
                      <th [style.text-align]="b.align[$index]">
                        <ng-container *ngTemplateOutlet="zeile; context: { $implicit: zelle }" />
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (reihe of b.rows; track $index) {
                    <tr>
                      @for (zelle of reihe; track $index) {
                        <td [style.text-align]="b.align[$index]">
                          <ng-container *ngTemplateOutlet="zeile; context: { $implicit: zelle }" />
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    </ng-template>

    <!-- Eng gesetzt und mit Absicht: jeder Zeilenumbruch hier würde ein
         Leerzeichen vor „leather armor" und in „( 2d6 )" setzen. -->
    <ng-template #zeile let-text>
      @for (s of stuecke(text); track $index) {<span [class.b]="s.bold" [class.i]="s.italic">@switch (s.kind) {@case ('link') {@if (s.ziel) {<a [routerLink]="['/artikel', s.ziel]" [attr.title]="s.titel">{{ s.text }}</a>} @else {<span class="tot" [attr.title]="s.titel">{{ s.text }}</span>}}@case ('var') {<span class="vr" [class.offen]="!s.resolved">{{ s.text }}</span>}@case ('dice') {<button type="button" class="wurf" [attr.title]="'Roll ' + s.expr" (click)="wirf(s.schluessel, s.expr)">{{ s.text }}</button>@if (wuerfe()[s.schluessel]; as w) {<output class="ergebnis">{{ w }}</output>}}@default {<ng-container>{{ s.text }}</ng-container>}}</span>}
    </ng-template>

    <ng-template #vorspannT>
      <strong class="vorspann">@if (vorspannZiel()) {<a [routerLink]="['/artikel', vorspannZiel()]">{{ vorspann() }}</a>} @else {<ng-container>{{ vorspann() }}</ng-container>}</strong>
    </ng-template>

    @if (inline()) {
      <ng-container *ngTemplateOutlet="zeile; context: { $implicit: text() }" />
    } @else if (vorspann() && bloeckeVon()[0]?.kind === 'paragraph') {
      <!-- Der Name läuft in den ersten Absatz hinein, wie im Buch:
           „Nimble Escape. The goblin can …" -->
      <p>
        <ng-container *ngTemplateOutlet="vorspannT" />
        {{ ' ' }}<ng-container *ngTemplateOutlet="zeile; context: { $implicit: $any(bloeckeVon()[0]).text }" />
      </p>
      <ng-container *ngTemplateOutlet="bloecke; context: { $implicit: bloeckeVon().slice(1) }" />
    } @else {
      @if (vorspann()) {
        <p><ng-container *ngTemplateOutlet="vorspannT" /></p>
      }
      <ng-container *ngTemplateOutlet="bloecke; context: { $implicit: bloeckeVon() }" />
    }
  `,
  host: { '[class.inline]': 'inline()' },
  styles: `
    :host {
      display: block;
      line-height: 1.55;
    }
    /* Eine Zeile im Satz — der Wert neben „Armor Class", die Angriffszeile
       hinter dem Namen —, kein Absatz. */
    :host(.inline) {
      display: inline;
    }
    p {
      margin: 0.25rem 0 0;
      white-space: pre-line;
    }
    .h {
      font-weight: 600;
      margin: 0.75rem 0 0.25rem;
    }
    .h1 {
      font-size: 1.2rem;
    }
    .h2 {
      font-size: 1.1rem;
    }
    ul,
    ol {
      margin: 0.25rem 0 0;
      padding-left: 1.4rem;
    }
    blockquote {
      margin: 0.5rem 0;
      padding-left: 0.75rem;
      border-left: 2px solid var(--line);
    }
    .tw {
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    table {
      border-collapse: collapse;
    }
    th,
    td {
      border-bottom: 1px solid var(--line);
      padding: 0.15rem 0.6rem;
      vertical-align: top;
    }
    .b {
      font-weight: 600;
    }
    .vorspann {
      font-style: italic;
      font-weight: 700;
    }
    .vorspann a {
      color: inherit;
      text-decoration: none;
    }
    .vorspann a:hover {
      text-decoration: underline;
    }
    .i {
      font-style: italic;
    }
    .tot {
      text-decoration: underline dotted;
      color: var(--dim);
    }
    .vr.offen {
      color: var(--warn);
    }
    /* Wie im Design-Canvas: ein Würfel ist ein Knopf in Gold. Die
       Mindesthöhe der Knöpfe gilt hier nicht — er steht mitten im Satz. */
    .wurf {
      font: inherit;
      min-height: 0;
      padding: 0 0.35rem;
      border: 1px solid var(--gold);
      border-radius: 4px;
      background: var(--hover);
      color: var(--ink);
      line-height: 1.35;
      cursor: pointer;
    }
    .ergebnis {
      margin-left: 0.3rem;
      font-weight: 600;
    }
  `,
})
export class Text {
  readonly text = input<string>('');
  readonly scopes = input<VarScopes>({});
  /** Eine Zeile statt Absätzen: kein `parseMarkdown`, nur `parseInline`. */
  readonly inline = input(false, { transform: booleanAttribute });
  /** Ein Name, fett und kursiv in den ersten Absatz gestellt („Bite."). */
  readonly vorspann = input('');
  /** Wohin der Name führt — der Artikel des Merkmals. */
  readonly vorspannZiel = input('');

  private readonly bestand = inject(Bestand);

  protected readonly bloeckeVon = computed<Block[]>(() => parseMarkdown(this.text()));

  /** Je Würfelknopf das letzte Ergebnis; ein neuer Wurf ersetzt es. */
  protected readonly wuerfe = signal<Record<string, string>>({});

  protected stuecke(text: string): Stueck[] {
    const bestand = this.bestand.entities();
    return parseInline(text, this.scopes()).map((s, i) => {
      /* Zeile und Stelle: zwei gleiche Ausdrücke in einer Zeile sind zwei
         Würfe, und ein neues Zeichnen verliert das Ergebnis nicht. */
      const schluessel = `${i}#${text}`;
      if (s.kind !== 'link') return { ...s, schluessel };
      const treffer = linkCandidates(bestand, s.target);
      if (treffer.length === 1) {
        const ziel = treffer[0]!;
        return { ...s, schluessel, ziel: ziel.id, titel: entityName(ziel) };
      }
      return {
        ...s,
        schluessel,
        titel: treffer.length
          ? `Ambiguous: ${treffer.length} articles are called “${s.target}”`
          : `No article “${s.target}”`,
      };
    });
  }

  protected wirf(schluessel: string, expr: string): void {
    const r = rollDice(expr);
    this.wuerfe.update((w) => ({ ...w, [schluessel]: rollText(r) }));
  }
}
