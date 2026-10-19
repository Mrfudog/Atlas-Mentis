import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAYER_RELATION, forArticle, layoutFor, primaryInterface, relationDef } from '@nw/model';
import type { Entity, Registry, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Abschnitte } from './abschnitte';
import { anordnen, feldZellen, mitLeeren, prosaVon } from './anordnung';
import { Fluss } from './fluss';
import { Gegenstand } from './gegenstand';
import { Statblock } from './statblock';
import { Kennzahlen } from './kennzahlen';
import { TokenBild } from './token-bild';
import { Text } from './text';
import { Zauber } from './zauber';
import { Bild, bildDes } from './bild';

/**
 * **Ein Artikel in einer Ansicht, als Blatt** (T-110): der Druck und die
 * Vorschau im Register. Nur lesen — bearbeitet wird auf der Artikelseite.
 *
 * Gezeichnet wird wie dort: die Anordnung der Art für **diese** Ansicht
 * (`layoutFor`), zugeteilt in `anordnen`, mit dem, was die Ansicht sagt —
 * leere Felder (`empty`) und den Rest am Ende (`rest`). Was ein Element
 * verlangt, das hier noch keine Form hat (Bogen, Karte), bleibt weg.
 *
 * Zurückgehalten hat der Server (`redactEntity`); was ankommt, steht da.
 */
@Component({
  selector: 'nw-blatt',
  imports: [RouterLink, Text, Statblock, Kennzahlen, TokenBild, Zauber, Gegenstand, Abschnitte, Fluss, Bild],
  template: `
    @for (st of stuecke(); track st.id) {
      @switch (st.art) {
        @case ('statblock') {
          <nw-statblock [artikel]="artikel()" />
        }
        @case ('stats') {
          <nw-kennzahlen [artikel]="artikel()" />
        }
        @case ('token') {
          <nw-token [artikel]="artikel()" />
        }
        @case ('spell') {
          <nw-zauber [artikel]="artikel()" [scopes]="scopes()" />
        }
        @case ('item') {
          <nw-gegenstand [artikel]="artikel()" />
        }
        @case ('beschreibung') {
          <nw-text class="beschreibung" [text]="st.text ?? ''" [scopes]="scopes()" />
        }
        @case ('teile') {
          <nw-abschnitte [besitzer]="artikel()" />
        }
        @case ('fluss') {
          <nw-fluss [besitzer]="artikel()" />
        }
        @case ('ueberschrift') {
          <h2>{{ st.text }}</h2>
        }
        @case ('bild') {
          <nw-bild [wert]="st.bild!.wert" [version]="st.bild!.version" [groesse]="ansicht() === 'full' ? 'full' : 'thumb'" [caption]="st.bild!.caption" [alt]="st.bild!.alt" [oeffnen]="false" />
        }
        @case ('karte') {
          @if (st.bild; as b) {
            <nw-bild [wert]="b.wert" [groesse]="ansicht() === 'full' ? 'full' : 'thumb'" [caption]="b.caption" [alt]="b.alt" [oeffnen]="false" />
          }
        }
        @case ('absatz') {
          <p class="beschreibung">{{ st.text }}</p>
        }
        @case ('felder') {
          <dl class="felder">
            @for (z of st.zellen; track z.ref) {
              <div class="feld" [class.lang]="z.lang" [class.leer]="z.fehlt">
                <dt>{{ z.label }}</dt>
                <dd>
                  @if (z.links) {
                    @for (l of z.links; track $index) {
                      @if (!$first) {<ng-container>, </ng-container>}
                      @if (l.ziel) {
                        <a [routerLink]="['/artikel', l.ziel]">{{ l.text }}</a>
                      } @else {
                        <span>{{ l.text }}</span>
                      }
                    }
                  } @else if (z.bild) {
                    <nw-bild [wert]="z.bild" groesse="thumb" [alt]="z.label" [oeffnen]="false" />
                  } @else if (z.lang) {
                    <nw-text [text]="z.wert" [scopes]="scopes()" />
                  } @else {
                    <nw-text inline [text]="z.wert" [scopes]="scopes()" />
                  }
                </dd>
              </div>
            }
          </dl>
        }
        @case ('prosa') {
          @for (b of st.prosa; track b.ref) {
            <section class="block" [class]="b.key">
              @if (b.key !== 'paragraph') {
                <h2>{{ b.label }}</h2>
              }
              <nw-text [text]="b.wert" [scopes]="scopes()" />
            </section>
          }
        }
        @case ('kanten') {
          @if (kanten().length) {
            <dl class="kanten">
              @for (k of kanten(); track k.label) {
                <div>
                  <dt>{{ k.label }}</dt>
                  <dd>{{ k.namen.join(', ') }}</dd>
                </div>
              }
            </dl>
          }
        }
      }
    } @empty {
      <p class="leer">Nothing to show in this view.</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    h2 {
      margin: 0.5rem 0 0;
      font-family: var(--caps);
      font-size: 1.35rem;
      font-weight: 500;
      color: var(--heading);
      border-bottom: 1px solid var(--heading);
    }
    .beschreibung,
    .block {
      font-family: var(--serif);
      font-size: 1.05rem;
    }
    .felder {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr));
      gap: 0.5rem 1rem;
    }
    .feld {
      min-width: 0;
    }
    .feld.lang {
      grid-column: 1 / -1;
    }
    dt {
      font-family: var(--caps);
      font-size: 0.85rem;
      color: var(--dim);
    }
    dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--heading);
    }
    /* Ein langer Einzeltext wie Prosa (T-126). */
    .feld.lang dd {
      font-family: var(--serif);
      font-size: 1.05rem;
      color: var(--ink);
    }
    .feld.leer dd,
    .leer {
      color: var(--dim);
    }
    .block.secret,
    .block.tactics {
      background: var(--line2);
      border-top: 3px solid var(--ink);
      border-bottom: 3px solid var(--ink);
      padding: 0.6rem 0.9rem;
    }
    .block.readaloud {
      font-style: italic;
      border-left: 3px solid var(--gold);
      padding-left: 0.75rem;
    }
    .kanten {
      margin: 0;
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.2rem 1rem;
    }
    .kanten div {
      display: contents;
    }
    /* Auf Papier: kein Kasten bricht mitten durch, Links sind Text. */
    @media print {
      .feld,
      .block {
        break-inside: avoid;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
    }
  `,
})
export class Blatt {
  readonly artikel = input.required<Entity>();
  readonly ansicht = input.required<string>();
  /** Ein anderes Register als das geladene — der Entwurf in der Vorschau des Registers. */
  readonly register = input<Registry | null>(null);

  private readonly bestand = inject(Bestand);
  private readonly reg = computed(() => this.register() ?? this.bestand.registry());

  protected readonly scopes = computed<VarScopes>(() => {
    const vars = this.artikel().components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });

  protected readonly stuecke = computed(() => {
    const r = this.reg();
    const e = this.artikel();
    if (!r) return [];
    const view = r.views[this.ansicht()];
    const zellen = feldZellen(r, e, this.bestand.name());
    const d = (e.components?.['Description'] as { description?: string } | undefined)?.description;
    return anordnen(
      forArticle(layoutFor(r, this.ansicht(), primaryInterface(e)).layout, e),
      view?.empty === 'show' ? mitLeeren(r, e, zellen) : zellen,
      prosaVon(r, e),
      { beschreibung: view?.description === false ? null : (d ?? null), rest: !!view?.rest, bild: bildDes(e, r, this.bestand.bild().get(e.id)) },
      /* Ein Blatt hat keine Reiter: die Regeloptionen (T-190) stehen als Felder. */
    ).map((st) => (st.art === 'regeln' ? { ...st, art: 'felder' as const } : st));
  });

  /** Die Kanten nach Art, mit den Namen ihrer Ziele — die Ebene steht im Kopf. */
  protected readonly kanten = computed(() => {
    const r = this.reg();
    if (!r) return [];
    const name = this.bestand.name();
    const je = new Map<string, string[]>();
    for (const rel of this.artikel().relations ?? []) {
      if (rel.type === LAYER_RELATION) continue;
      const label = relationDef(r, rel.type).label;
      je.set(label, [...(je.get(label) ?? []), name(rel.to) ?? '(not here)']);
    }
    return [...je].map(([label, namen]) => ({ label, namen }));
  });
}
