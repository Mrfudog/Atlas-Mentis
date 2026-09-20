import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  allowedComponents,
  backlinks,
  blockTypesFor,
  entityName,
  primaryInterface,
  relationDef,
  requiredComponents,
  resolveView,
  showBlock,
  showField,
  viewKeys,
} from '@nw/model';
import type { Entity, PropertySchema, Registry, ViewDef } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { ausEingabe, eingabeArt, inEingabe, type Eingabe } from './felder';

interface Zelle {
  ref: string;
  label: string;
  wert: string;
}

interface Feld {
  /** `Component.property` — eindeutig und zugleich der Name im Formular. */
  ref: string;
  comp: string;
  prop: string;
  label: string;
  art: Eingabe;
  schema: PropertySchema | undefined;
  wert: string;
  jaNein: boolean;
  pflicht: boolean;
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
  imports: [RouterLink, FormsModule],
  template: `
    @if (artikel(); as e) {
      <article>
        <header class="kopf">
          <div>
            <h2>{{ name(e) }}</h2>
            <span class="art">{{ art(e) }}</span>
          </div>
          <div class="werkzeuge">
            @if (!bearbeitet()) {
              <select [value]="stufe()" (change)="waehle($any($event.target).value)">
                @for (k of stufen(); track k) {
                  <option [value]="k">{{ label(k) }}</option>
                }
              </select>
            }
            @if (darfSchreiben()) {
              <button type="button" (click)="bearbeitet() ? abbrechen() : beginnen()">
                {{ bearbeitet() ? 'Cancel' : 'Edit' }}
              </button>
            }
            @if (bearbeitet()) {
              <button type="button" class="pri" [disabled]="speichert()" (click)="speichern()">
                {{ speichert() ? 'Saving…' : 'Save' }}
              </button>
            }
          </div>
        </header>

        @if (bearbeitet()) {
          @if (problem(); as p) {
            <p class="fehler" role="alert">{{ p }}</p>
          }
          @if (maengel().length) {
            <ul class="maengel" role="alert">
              @for (m of maengel(); track m) {
                <li>{{ m }}</li>
              }
            </ul>
          }

          <div class="maske">
            @for (f of felder(); track f.ref) {
              <label>
                <span>{{ f.label }}@if (f.pflicht) {<i class="pflicht" title="required">*</i>}</span>
                @switch (f.art) {
                  @case ('jaNein') {
                    <input type="checkbox" [(ngModel)]="f.jaNein" [name]="f.ref" />
                  }
                  @case ('auswahl') {
                    <select [(ngModel)]="f.wert" [name]="f.ref">
                      <option value=""></option>
                      @for (o of f.schema?.enum ?? []; track o) {
                        <option [value]="o">{{ o }}</option>
                      }
                    </select>
                  }
                  @case ('lang') {
                    <textarea rows="4" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                  }
                  @case ('zahl') {
                    <input type="text" inputmode="decimal" [(ngModel)]="f.wert" [name]="f.ref" />
                  }
                  @case ('liste') {
                    <input type="text" [(ngModel)]="f.wert" [name]="f.ref" placeholder="one, two, three" />
                  }
                  @default {
                    <input type="text" [(ngModel)]="f.wert" [name]="f.ref" />
                  }
                }
              </label>
            }
          </div>

          <h3>Text blocks</h3>
          @for (b of entwurfBloecke(); track b.id) {
            <div class="blockmaske">
              <div class="bkopf">
                <span class="bl">{{ b.blockType }}</span>
                <button type="button" class="weg" (click)="blockWeg(b.id)" title="Remove">×</button>
              </div>
              <textarea rows="3" [(ngModel)]="b.body" [name]="b.id"></textarea>
            </div>
          }
          <div class="werkzeuge">
            <select #neueArt>
              @for (t of blockArten(); track t) {
                <option [value]="t">{{ t }}</option>
              }
            </select>
            <button type="button" (click)="blockDazu(neueArt.value)">+ Block</button>
          </div>
        } @else {

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

  // ------------------------------------------------------------ bearbeiten

  protected readonly bearbeitet = signal(false);
  protected readonly speichert = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly maengel = signal<string[]>([]);
  protected readonly felder = signal<Feld[]>([]);
  protected readonly entwurfBloecke = signal<{ id: string; blockType: string; body: string }[]>([]);

  private readonly api = inject(Api);

  protected readonly darfSchreiben = computed(() => {
    const e = this.artikel();
    return e ? this.session.darfSchreiben()(e.id) : false;
  });

  /**
   * Die Maske zeigt **jedes erlaubte Feld**, nicht nur die ausgefüllten:
   * ein Feld, das erst erscheint, wenn es einen Wert hat, kann niemand zum
   * ersten Mal ausfüllen. Die Darstellungsstufe gilt hier nicht — sie sagt,
   * was man *liest*, nicht was es gibt.
   */
  protected beginnen(): void {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return;
    const erlaubt = allowedComponents(r, primaryInterface(e));
    const pflicht = new Set(requiredComponents(r, primaryInterface(e)));
    const out: Feld[] = [];
    for (const comp of erlaubt) {
      const def = r.components[comp];
      if (!def) continue;
      const karte = (e.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [prop, schema] of Object.entries(def.schema?.properties ?? {})) {
        /* Abgeleitete Werte bekommen keine Eingabe (D8). Sie hier
           anzubieten hiesse, jemanden etwas eintippen zu lassen, das beim
           nächsten Lesen überschrieben wird. */
        if (schema.derived) continue;
        const art = eingabeArt(schema);
        out.push({
          ref: `${comp}.${prop}`,
          comp,
          prop,
          label: `${def.label ?? comp} · ${schema.title ?? prop}`,
          art,
          schema,
          wert: art === 'jaNein' ? '' : inEingabe(karte[prop]),
          jaNein: karte[prop] === true,
          pflicht: pflicht.has(comp) && (def.schema?.required ?? []).includes(prop),
        });
      }
    }
    this.felder.set(out);
    this.entwurfBloecke.set(
      [...(e.blocks ?? [])]
        .sort((a2, b2) => (a2.order ?? 0) - (b2.order ?? 0))
        .map((b) => ({ id: b.anchor || b.id, blockType: b.blockType, body: b.body ?? '' })),
    );
    this.problem.set(null);
    this.maengel.set([]);
    this.bearbeitet.set(true);
  }

  protected abbrechen(): void {
    this.bearbeitet.set(false);
    this.problem.set(null);
    this.maengel.set([]);
  }

  protected blockArten(): string[] {
    const e = this.artikel();
    const r = this.reg();
    return e && r ? blockTypesFor(r, primaryInterface(e)) : [];
  }

  protected blockDazu(art: string): void {
    if (!art) return;
    this.entwurfBloecke.update((bs) => [
      ...bs,
      { id: `neu-${bs.length}-${Date.now()}`, blockType: art, body: '' },
    ]);
  }
  protected blockWeg(id: string): void {
    this.entwurfBloecke.update((bs) => bs.filter((b) => b.id !== id));
  }

  /**
   * Geschrieben wird der ganze Artikel, auf einer Kopie gebaut. Erst ein
   * gelungenes Schreiben ersetzt ihn im Bestand — sonst stünde nach einem
   * Fehlschlag ein Stand da, den der Server nie gesehen hat, und beim
   * nächsten Laden wäre er lautlos weg.
   */
  protected async speichern(): Promise<void> {
    const alt = this.artikel();
    if (!alt || this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    this.maengel.set([]);

    const components: Record<string, Record<string, unknown>> = {};
    for (const f of this.felder()) {
      const wert = ausEingabe(f.schema, f.art === 'jaNein' ? f.jaNein : f.wert);
      if (wert === undefined) continue;
      (components[f.comp] ??= {})[f.prop] = wert;
    }
    const blocks = this.entwurfBloecke()
      .filter((b) => b.body.trim() !== '')
      .map((b, i) => ({ id: b.id, anchor: b.id, blockType: b.blockType, body: b.body, order: i }));

    const neu = { ...alt, components, blocks } as Entity;

    try {
      const gespeichert = await this.api.putEntity(neu);
      await this.bestand.load(true);
      this.bearbeitet.set(false);
      /* Was der Server zurückgibt, gilt — er setzt `updatedAt` und darf
         mehr ändern, als hier geschickt wurde. */
      void gespeichert;
    } catch (error) {
      if (error instanceof ApiError) {
        this.problem.set(error.message);
        /* Die Liste wird gezeigt und nicht zusammengefasst: „ungültig" ohne
           Grund ist am Tisch keine Hilfe. */
        const issues = error.issues;
        if (Array.isArray(issues)) {
          this.maengel.set(
            issues.map((i) => {
              const o = i as { t?: string; message?: string; path?: unknown[] };
              if (o.t) return o.t;
              const pfad = Array.isArray(o.path) ? o.path.join('.') : '';
              return pfad ? `${pfad}: ${o.message ?? '?'}` : (o.message ?? JSON.stringify(i));
            }),
          );
        }
      } else {
        this.problem.set('Could not reach the server.');
      }
    } finally {
      this.speichert.set(false);
    }
  }

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
