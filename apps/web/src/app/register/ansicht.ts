import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isAdjust, ownLayout, PLACE_VIEWS, typeList } from '@nw/model';
import type { LayoutElement, Registry, ViewDef } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from './arbeit';
import { RegAnordnung } from './anordnung';
import { RegVorschau } from './vorschau';

/** Wo eine Ansicht gezeichnet wird — der Ort wählt sie (CLAUDE.md, „Drei Ansichten"). */
export const ORTE: Record<string, string> = {
  overview: 'A link, a list row in the compendium (its columns) and small board tiles.',
  quick: 'A card: the preview beside a list, the popup on every named article, board tiles.',
  full: 'The article page.',
  print: '“Print” on the article page: one A4 sheet.',
};

/**
 * **Eine Ansicht im Register** (T-110, REQ-256, E-030 b): wie sie heisst,
 * was sie global zeigt — Elemente in ihrer Reihenfolge, Felder nach Typ
 * oder `Typ.feld` —, was mit leeren und ungenannten Feldern geschieht, und
 * welche Arten sie für sich anders sagen. Darunter die Vorschau an einem
 * Beispielartikel, aus dem Entwurf.
 *
 * Geändert wird ein Entwurf; „Save" schreibt den Teil `views`. Die vier
 * Ansichten, nach denen ein Ort fragt (`PLACE_VIEWS`), lassen sich nicht
 * löschen; eigene schon — dann gehen auch die Anordnungen der Arten für
 * sie mit.
 */
@Component({
  selector: 'nw-reg-ansicht',
  imports: [RouterLink, RegAnordnung, RegVorschau],
  template: `
    @if (def(); as d) {
      <div class="typkopf">
        <h2>{{ d.label }}</h2>
        <code>{{ name() }}</code>
        <span class="dim">{{ ort() }}</span>
      </div>
      <section class="kasten" aria-label="View">
        <label class="f">
          <span>Label</span>
          <input type="text" [value]="entwurf()?.label ?? d.label" [disabled]="!darf()"
            (change)="setzen({ label: $any($event.target).value.trim() || d.label })" />
        </label>
        <label class="f">
          <span>Order</span>
          <input type="number" [value]="entwurf()?.order ?? d.order ?? 99" [disabled]="!darf()"
            (change)="setzen({ order: +$any($event.target).value })" />
        </label>
        <p class="hint">Where the view stands among the others — in the choice on a board tile and when printing.</p>
        <label class="haken">
          <input type="checkbox" [checked]="!!(entwurf() ?? d).rest" [disabled]="!darf()"
            (change)="setzen({ rest: $any($event.target).checked || undefined })" />
          Fields no element takes stand at the end
        </label>
        <p class="hint">On: nothing an article has is lost from this view, even a field added tomorrow. Off: the view shows exactly what its elements name.</p>
        <label class="haken">
          <input type="checkbox" [checked]="(entwurf() ?? d).empty === 'show'" [disabled]="!darf()"
            (change)="setzen({ empty: $any($event.target).checked ? 'show' : undefined })" />
          Show empty fields (as “—”)
        </label>
        <p class="hint">Off: an article shows only what it has. On: every field the elements take stands there, filled or not — useful on a sheet you fill in at the table.</p>
      </section>

      <section class="kasten" aria-label="Arrangement">
        <h3>Arrangement</h3>
        <p class="hint">
          What every type shows in this view, unless it says otherwise below. A whole type takes its new fields by
          itself; a single field stays a single field. A field stands in the first element that takes it.
        </p>
        <nw-reg-anordnung [layout]="layout()" [darf]="darf()" (geaendert)="setzen({ layout: $event })" />
      </section>

      @if (entwurf() && darf()) {
        <div class="knoepfe">
          <button type="button" class="pri" [disabled]="arbeit.speichert()" (click)="speichern()">Save view</button>
          <button type="button" (click)="entwurf.set(null)">Discard changes</button>
        </div>
      }

      <section class="kasten" aria-label="Types that say their own">
        <h3>Types that say their own</h3>
        @for (t of eigene(); track t.name) {
          <div class="frow lesen">
            <a class="fk" [routerLink]="[]" [queryParams]="{ tab: null, view: null, type: t.name }">{{ t.label }}</a>
            <span class="pill">{{ t.wie }}</span>
            <span class="dim">inherited by its subtypes</span>
          </div>
        } @empty {
          <p class="hint">None — every type shows this view as above.</p>
        }
        <p class="hint">A type changes it on its own page, under Views: its own arrangement, or this one adjusted.</p>
      </section>

      <section class="kasten" aria-label="Preview">
        <h3>Preview</h3>
        <nw-reg-vorschau [ansicht]="name()" [register]="vorschauRegister()" />
      </section>

      @if (darf() && !fest()) {
        <div class="knoepfe">
          <button type="button" class="weg" (click)="entfernen()">Remove view</button>
        </div>
      }
    } @else {
      <p class="leer">There is no view {{ name() }}.</p>
    }
  `,
})
export class RegAnsicht {
  readonly name = input.required<string>();
  readonly darf = input(false);

  private readonly bestand = inject(Bestand);
  protected readonly arbeit = inject(RegisterArbeit);

  /** Der Entwurf — `null`, solange nichts geändert ist. */
  protected readonly entwurf = signal<ViewDef | null>(null);

  constructor() {
    /* Eine andere Ansicht gewählt: der Entwurf der vorigen gilt nicht hier. */
    effect(() => {
      this.name();
      this.entwurf.set(null);
    });
  }

  private readonly reg = computed(() => this.bestand.registry());
  protected readonly def = computed(() => this.reg()?.views[this.name()]);
  protected readonly fest = computed(() => (PLACE_VIEWS as readonly string[]).includes(this.name()));
  protected readonly ort = computed(
    () => ORTE[this.name()] ?? 'Your own view: chosen on a board tile and when printing.',
  );
  protected readonly layout = computed(() => (this.entwurf() ?? this.def())?.layout ?? []);

  /** Das Register, wie es mit dem Entwurf wäre — für die Vorschau. */
  protected readonly vorschauRegister = computed<Registry | null>(() => {
    const r = this.reg();
    const e = this.entwurf();
    return r && e ? { ...r, views: { ...r.views, [this.name()]: e } } : r;
  });

  protected readonly eigene = computed(() => {
    const r = this.reg();
    if (!r) return [];
    return typeList(r)
      .map((t) => ({ name: t, label: r.interfaces[t]?.label ?? t, v: r.interfaces[t]?.views?.[this.name()] }))
      .filter((x) => ownLayout(x.v))
      .map((x) => ({ name: x.name, label: x.label, wie: isAdjust(x.v) ? 'adjusted' : 'its own arrangement' }));
  });

  protected setzen(teil: Partial<ViewDef> & { layout?: LayoutElement[] }): void {
    const basis = this.entwurf() ?? structuredClone(this.def()!);
    const neu: ViewDef = { ...basis, ...teil };
    for (const k of Object.keys(teil) as (keyof ViewDef)[]) if (teil[k] === undefined) delete neu[k];
    this.entwurf.set(neu);
  }

  protected speichern(): void {
    const e = this.entwurf();
    const n = this.name();
    if (!e) return;
    void this.arbeit
      .aendern('views', (views) => {
        if (!views[n]) return `There is no view ${n}.`;
        views[n] = e;
        return undefined;
      })
      .then((ok) => ok && this.entwurf.set(null));
  }

  protected entfernen(): void {
    const n = this.name();
    if (this.fest()) return;
    const arten = this.eigene();
    this.arbeit.fragen({
      titel: `Remove the view ${this.def()?.label ?? n}?`,
      text: [
        arten.length
          ? `${arten.length} type(s) say their own for it (${arten.map((a) => a.label).join(', ')}); that goes too.`
          : 'No type says its own for it.',
        'Board tiles that chose it show the quick view again.',
      ],
      ja: 'Remove',
      tun: async () => {
        if (arten.length) {
          const ok = await this.arbeit.aendern('interfaces', (ifs) => {
            for (const a of arten) {
              const d = ifs[a.name];
              if (!d?.views) continue;
              delete d.views[n];
              if (!Object.keys(d.views).length) delete d.views;
            }
          });
          if (!ok) return;
        }
        await this.arbeit.aendern('views', (views) => {
          delete views[n];
        });
      },
    });
  }
}
