import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  backlinks,
  entityName,
  primaryInterface,
  relationDef,
  resolveView,
  showBlock,
  showField,
  viewKeys,
} from '@nw/model';
import type { Entity, Registry, ViewDef } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';

interface Zelle {
  ref: string;
  label: string;
  wert: string;
}

/**
 * Ein Artikel.
 *
 * **Gezeichnet wird aus dem Register**, nicht aus einer Vorlage je
 * Artikelart: welche Felder eine Darstellungsstufe zeigt, steht in der
 * Ansicht, und die Auswahl macht `showField` aus `packages/model` — dieselbe
 * Funktion, die der Prototyp benutzt. Eine zweite Auswahl hier wäre die
 * zweite Stelle, an der jemand etwas vergisst.
 *
 * **Zurückgehalten wird am Server** (`redactEntity`). Was hier ankommt, darf
 * angezeigt werden; die Seite prüft das nicht noch einmal. Eine zweite
 * Prüfung sähe nach Sorgfalt aus und wäre das Gegenteil: sie lüde dazu ein,
 * die erste wegzulassen.
 */
@Component({
  selector: 'nw-artikel',
  imports: [RouterLink],
  template: `
    @if (artikel(); as e) {
      <article>
        <header class="kopf">
          <div>
            <h2>{{ name(e) }}</h2>
            <span class="art">{{ art(e) }}</span>
          </div>
          <select [value]="stufe()" (change)="waehle($any($event.target).value)">
            @for (k of stufen(); track k) {
              <option [value]="k">{{ label(k) }}</option>
            }
          </select>
        </header>

        @if (beschreibung(); as text) {
          <p class="beschreibung">{{ text }}</p>
        }

        @if (zellen().length) {
          <dl class="felder">
            @for (z of zellen(); track z.ref) {
              <dt>{{ z.label }}</dt>
              <dd>{{ z.wert }}</dd>
            }
          </dl>
        }

        @for (b of bloecke(); track b.id) {
          <section class="block" [class]="b.blockType">
            @if (b.blockType !== 'paragraph') {
              <div class="bl">{{ b.blockType }}</div>
            }
            <p>{{ b.body }}</p>
          </section>
        }

        @if (kanten().length) {
          <h3>Relations</h3>
          <ul class="kanten">
            @for (k of kanten(); track k.id) {
              <li>
                <span class="rl">{{ k.label }}</span>
                @if (k.ziel) {
                  <a [routerLink]="['/artikel', k.ziel]">{{ k.text }}</a>
                } @else {
                  <span class="weg">{{ k.text }}</span>
                }
              </li>
            }
          </ul>
        }

        @if (rueckbezuege().length) {
          <h3>Referred to by</h3>
          <ul class="kanten">
            @for (r of rueckbezuege(); track r.id) {
              <li>
                <span class="rl">{{ r.label }}</span>
                <a [routerLink]="['/artikel', r.ziel]">{{ r.text }}</a>
              </li>
            }
          </ul>
        }
      </article>
    } @else if (bestand.geladen()) {
      <p class="fehler">No such article — or not one you may see.</p>
    }
  `,
  styleUrl: './artikel.scss',
})
export class Artikel {
  readonly id = input.required<string>();

  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);

  /* Die gewählte Darstellungsstufe lebt in der Maske und nicht in der
     Adresse: sie ist eine Frage des Lesens, keine des Ortes. */
  private gewaehlt: string | undefined;
  protected stufe(): string {
    return this.gewaehlt ?? this.stufen()[0] ?? 'full';
  }
  protected waehle(k: string): void {
    this.gewaehlt = k;
  }

  constructor() {
    void this.bestand.load();
  }

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());
  protected readonly artikel = computed<Entity | undefined>(() =>
    this.bestand.byId().get(this.id()),
  );
  protected readonly stufen = computed<string[]>(() => {
    const r = this.reg();
    return r ? viewKeys(r) : [];
  });
  private readonly view = computed<ViewDef | null>(() => {
    const r = this.reg();
    return r ? resolveView(r, this.stufe()) : null;
  });

  protected label(key: string): string {
    return this.reg()?.views[key]?.label ?? key;
  }
  protected name(e: Entity): string {
    return entityName(e);
  }
  protected art(e: Entity): string {
    return primaryInterface(e);
  }

  protected readonly beschreibung = computed<string | null>(() => {
    const e = this.artikel();
    const v = this.view();
    if (!e || !v?.description) return null;
    const d = e.components?.['Description'] as { raw?: string } | undefined;
    return d?.raw ?? null;
  });

  /**
   * Die Feldzellen. `Description` bleibt draussen, weil sie schon als Absatz
   * oben steht — sie zweimal zu zeigen wäre kein Fehler, aber es liest sich
   * wie einer.
   */
  protected readonly zellen = computed<Zelle[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    const v = this.view();
    if (!e || !r || !v) return [];
    const out: Zelle[] = [];
    for (const [comp, karte] of Object.entries(e.components ?? {})) {
      if (comp === 'Description' && v.description) continue;
      const def = r.components[comp];
      for (const [prop, wert] of Object.entries((karte ?? {}) as Record<string, unknown>)) {
        if (!showField(v, comp, prop)) continue;
        if (wert === null || wert === undefined || wert === '') continue;
        const titel = def?.schema?.properties?.[prop]?.title ?? prop;
        out.push({
          ref: `${comp}.${prop}`,
          label: titel,
          wert: Array.isArray(wert) ? wert.join(', ') : String(wert),
        });
      }
    }
    return out;
  });

  protected readonly bloecke = computed(() => {
    const e = this.artikel();
    const v = this.view();
    if (!e || !v) return [];
    return [...(e.blocks ?? [])]
      .filter((b) => showBlock(v, b.blockType))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  protected readonly kanten = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    const map = this.bestand.byId();
    return (e.relations ?? []).map((rel) => {
      const ziel = map.get(rel.to);
      return {
        id: rel.id,
        label: relationDef(r, rel.type).label,
        ziel: ziel?.id ?? '',
        /* Ein Ziel, das es nicht gibt, wird gesagt und nicht verschwiegen —
           es kann auch heissen, dass der Betrachter es nicht sehen darf. */
        text: ziel ? entityName(ziel) : '(not here)',
      };
    });
  });

  protected readonly rueckbezuege = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    return backlinks(r, this.bestand.entities(), e.id).map((b) => ({
      id: `${b.from.id}:${b.relation.id}`,
      label: b.def.inverseLabel,
      ziel: b.from.id,
      text: entityName(b.from),
    }));
  });
}
