import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  embeddedFeatures,
  entityName,
  featureText,
  isEmbedParagraph,
  isOptionalFeature,
} from '@nw/model';
import type { Entity, VarScopes } from '@nw/model';
import { Text } from '../artikel/text';

/** Wie tief ein Merkmal in sich selbst gezeichnet wird — darüber steht der Verweis. */
const TIEFE = 3;

/**
 * Ein Merkmal, ausgeschrieben wie in 5e.tools: Name, Regeltext, und was es
 * einbettet (`embeddedFeatures`, W6).
 *
 * **Teile stehen offen, Optionen zugeklappt.** Ein Kopf wie „School of
 * Abjuration" bettet Merkmale derselben Sorte ein — das sind seine Teile,
 * und wer die Unterklasse liest, liest sie. „Fighting Style" bettet elf
 * Stile ein, von denen man einen wählt; die stehen als Zeile zum
 * Aufklappen, sonst ist die erste Stufe des Kämpfers drei Bildschirme lang.
 *
 * Die Absätze, die nur ein eingebettetes Merkmal nennen, zeichnet der Text
 * nicht noch einmal als Verweis — das Merkmal steht ja darunter.
 */
@Component({
  selector: 'nw-merkmal',
  imports: [RouterLink, Text],
  template: `
    @let f = merkmal();
    <div class="merkmal" [class.optional]="optional()" [class.tief]="tiefe() > 0">
      @if (!ohneName()) {
        <div class="kopf" [attr.role]="'heading'" [attr.aria-level]="3 + tiefe()">
          <span class="name">{{ name(f) }}</span>
          @if (optional()) {
            <span class="marke" title="Optional class feature or variant rule">optional</span>
          }
          <a
            class="zum"
            [routerLink]="['/artikel', f.id]"
            title="Open the article"
            aria-label="Open the article"
            >↗</a
          >
        </div>
      }
      @if (text()) {
        <nw-text [text]="text()" [scopes]="scopes()" />
      }
      @for (k of teile(); track k.id) {
        <nw-merkmal
          [merkmal]="k"
          [index]="index()"
          [tiefe]="tiefe() + 1"
          [scopes]="scopes()"
          [zeigeOptional]="zeigeOptional()"
        />
      }
      @if (optionen().length) {
        <div class="optionen">
          @for (k of optionen(); track k.id) {
            <details>
              <summary>{{ name(k) }}</summary>
              <nw-merkmal
                [merkmal]="k"
                [index]="index()"
                [tiefe]="tiefe() + 1"
                [scopes]="scopes()"
                [zeigeOptional]="zeigeOptional()"
              />
            </details>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .merkmal {
      font-family: var(--serif);
      font-size: 1.02rem;
    }
    .merkmal.tief {
      margin-top: 0.6rem;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2rem 0.5rem;
    }
    .name {
      font-family: var(--caps);
      font-weight: 700;
      font-size: 1.12rem;
      color: var(--heading);
    }
    .tief > .kopf .name {
      font-size: 1rem;
    }
    .marke {
      padding: 0 0.45rem;
      border: 1px solid var(--gold);
      border-radius: 10px;
      color: var(--gold);
      font-family: var(--sans);
      font-size: 0.72rem;
    }
    .zum {
      font-family: var(--sans);
      font-size: 0.85rem;
      text-decoration: none;
      color: var(--dim);
    }
    .zum:hover {
      color: var(--link);
    }
    .optional {
      border-left: 3px solid var(--gold);
      padding-left: 0.6rem;
    }
    .optionen {
      margin-top: 0.4rem;
      border-top: 1px solid var(--line2);
    }
    details {
      border-bottom: 1px solid var(--line2);
      padding: 0.15rem 0;
    }
    summary {
      cursor: pointer;
      font-family: var(--sans);
      font-weight: 600;
      color: var(--ink);
      padding: 0.2rem 0;
    }
    details[open] > summary {
      color: var(--heading);
    }
  `,
})
export class Merkmal {
  readonly merkmal = input.required<Entity>();
  /** Nummer und Id → Artikel: alles, was die Klassenansicht geladen hat. */
  readonly index = input.required<ReadonlyMap<string, Entity>>();
  readonly tiefe = input(0);
  readonly scopes = input<VarScopes>({});
  /** Optionale Teile und Optionen zeigen (`?opt=1`); ohne fallen sie weg wie in der Tabelle. */
  readonly zeigeOptional = input(false);
  /** In der Vergleichsspalte trägt der Kopf den Namen der Unterklasse schon darüber. */
  readonly ohneName = input(false);

  protected name(e: Entity): string {
    return entityName(e);
  }

  protected readonly optional = computed(() => isOptionalFeature(this.merkmal()));

  private readonly eingebettet = computed(() =>
    this.tiefe() >= TIEFE
      ? []
      : embeddedFeatures(this.merkmal(), this.index()).filter(
          (k) => this.zeigeOptional() || !isOptionalFeature(k),
        ),
  );
  private sorte(e: Entity): string {
    return String(e.components?.['Feature']?.['featureType'] ?? '');
  }
  protected readonly teile = computed(() =>
    this.eingebettet().filter((k) => this.sorte(k) === this.sorte(this.merkmal())),
  );
  protected readonly optionen = computed(() =>
    this.eingebettet().filter((k) => this.sorte(k) !== this.sorte(this.merkmal())),
  );

  /** Der Regeltext ohne die Absätze, die nur ein eingebettetes Merkmal nennen. */
  protected readonly text = computed(() => {
    const index = this.index();
    const zeigt = this.tiefe() < TIEFE;
    return featureText(this.merkmal())
      .split(/\n\s*\n/)
      .filter((a) => !(zeigt && isEmbedParagraph(a, index)))
      .join('\n\n')
      .trim();
  });
}
