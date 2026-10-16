import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GLOSSARY_SORTS, glossarySortLabel, type GlossaryEntry } from '@nw/model';
import { Glossar, BegriffLink } from '../kern/glossar';
import { HILFE, abschnittId } from '../kern/hilfe';
import { KAPITEL, buchstabe, regelKapitel } from '../kern/handbuch';

/**
 * **Das Handbuch** (T-242, T-225, E-055): alle Erklärungen auf einer
 * Seite, in Kapiteln mit Inhaltsverzeichnis. Woher jedes Kapitel kommt,
 * steht in `kern/handbuch.ts`; hier wird nur gezeichnet.
 *
 * Das Glossar am Ende sucht beim Tippen in Begriff, Aliassen und
 * Definition, springt mit der Buchstabenleiste und filtert nach Sorte.
 * Ein Klick auf einen Begriff öffnet ihn in der Glossarleiste.
 *
 * Ein Anker (`/handbook#rules`, `#page-play`) scrollt an die Stelle —
 * das „?" der Kopfleiste und What's new führen so hierher.
 */
@Component({
  selector: 'nw-handbuch',
  imports: [RouterLink, BegriffLink],
  template: `
    <div class="seite">
      <header>
        <h1>Handbook</h1>
        <nav class="inhalt" aria-label="Chapters">
          <ol>
            @for (k of kapitel; track k.id) {
              <li><a [routerLink]="[]" [fragment]="k.id" (click)="springe(k.id, $event)">{{ k.title }}</a></li>
            }
          </ol>
        </nav>
      </header>

      @for (k of kapitel; track k.id) {
        <section class="kapitel" [id]="k.id">
          <h2>{{ k.title }}</h2>
          <p class="intro">{{ k.intro }}</p>
          @for (a of k.sections ?? []; track $index) {
            <h3>{{ a.heading }}</h3>
            @for (t of a.text; track $index) {
              <p>{{ t }}</p>
            }
          }

          @switch (k.id) {
            @case ('pages') {
              @for (s of hilfe; track s.title) {
                <article class="abschnitt" [id]="abschnitt(s)">
                  <h3>{{ s.title }}</h3>
                  @for (a of s.sections; track $index) {
                    @if (a.heading) {
                      <h4>{{ a.heading }}</h4>
                    }
                    @for (t of a.text; track $index) {
                      <p>{{ t }}</p>
                    }
                  }
                </article>
              }
            }
            @case ('rules') {
              @for (r of regeln; track r.sorte.key) {
                <article class="abschnitt" [id]="'rules-' + r.sorte.key">
                  <h3>{{ r.sorte.label }}</h3>
                  <p>{{ r.sorte.does }}</p>
                  @for (o of r.optionen; track o.key) {
                    <h4>{{ o.label }}</h4>
                    <p>{{ o.does }}</p>
                    @if (o.variants?.length) {
                      <dl>
                        @for (v of o.variants; track v.key) {
                          <dt>{{ v.label }}</dt>
                          <dd>{{ v.does }}</dd>
                        }
                      </dl>
                    }
                  }
                </article>
              }
            }
            @case ('types') {
              @if (arten().length) {
                <dl class="arten">
                  @for (e of arten(); track e.id) {
                    <dt><button type="button" [nwBegriff]="e.id" (click)="oeffne(e)">{{ e.term }}</button></dt>
                    <dd>{{ e.definition }}</dd>
                  }
                </dl>
              } @else {
                <p class="dim">Loading …</p>
              }
            }
            @case ('glossary') {
              <div class="werkzeug">
                <input
                  type="search"
                  placeholder="Search the glossary"
                  aria-label="Search the glossary"
                  [value]="suche()"
                  (input)="suche.set($any($event.target).value)"
                />
                <div class="sorten" role="group" aria-label="Filter by sort">
                  <button type="button" [class.an]="!sorte()" [attr.aria-pressed]="!sorte()" (click)="sorte.set(null)">All</button>
                  @for (s of sorten(); track s.key) {
                    <button type="button" [class.an]="sorte() === s.key" [attr.aria-pressed]="sorte() === s.key" (click)="sorte.set(s.key)">
                      {{ s.label }}
                    </button>
                  }
                </div>
                <nav class="abc" aria-label="Jump to letter">
                  @for (b of abc(); track b.b) {
                    @if (b.da) {
                      <a [routerLink]="[]" [fragment]="'glossary-' + b.b" (click)="springe('glossary-' + b.b, $event)">{{ b.b }}</a>
                    } @else {
                      <span class="leer">{{ b.b }}</span>
                    }
                  }
                </nav>
              </div>
              @if (glossar.eintraege() === null) {
                <p class="dim">Loading …</p>
              } @else if (!gruppen().length) {
                <p class="dim">No term matches.</p>
              }
              @for (g of gruppen(); track g.b) {
                <h3 class="buchstabe" [id]="'glossary-' + g.b">{{ g.b }}</h3>
                <dl class="begriffe">
                  @for (e of g.eintraege; track e.id) {
                    <dt>
                      <button type="button" [nwBegriff]="e.id" (click)="oeffne(e)">{{ e.term }}</button>
                      <span class="sorte">{{ sortLabel(e.sort) }}</span>
                    </dt>
                    <dd>
                      {{ e.definition }}
                      @if (e.aliases.length) {
                        <span class="dim">Also: {{ e.aliases.join(', ') }}</span>
                      }
                    </dd>
                  }
                </dl>
              }
            }
          }
        </section>
      }
    </div>
  `,
  styles: `
    .seite {
      max-width: 52rem;
      margin: 0 auto;
      padding: 1rem 1.25rem 4rem;
    }
    h1 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0.5rem 0;
    }
    .inhalt ol {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.25rem;
      margin: 0;
      padding-left: 1.2rem;
    }
    .kapitel {
      margin-top: 2rem;
      padding-top: 0.5rem;
      border-top: 2px solid var(--line);
      scroll-margin-top: 4rem;
    }
    h2 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0.25rem 0;
    }
    .intro {
      color: var(--dim);
    }
    h3 {
      margin: 1.25rem 0 0.25rem;
    }
    h4 {
      margin: 0.75rem 0 0.15rem;
      color: var(--accent);
      font-size: 0.95rem;
    }
    p {
      line-height: 1.5;
      margin: 0.3rem 0;
    }
    .abschnitt,
    .buchstabe {
      scroll-margin-top: 4rem;
    }
    dl {
      margin: 0.4rem 0;
    }
    dt {
      font-weight: 600;
      margin-top: 0.5rem;
    }
    dd {
      margin: 0.1rem 0 0 1rem;
      line-height: 1.45;
    }
    .dim,
    .sorte {
      color: var(--dim);
    }
    .sorte {
      margin-left: 0.5rem;
      font-weight: 400;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    dd .dim {
      display: block;
      font-size: 0.85rem;
    }
    .werkzeug {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 0.5rem 0;
      background: var(--bg, var(--surface));
      display: grid;
      gap: 0.4rem;
    }
    .werkzeug input {
      width: 100%;
      box-sizing: border-box;
    }
    .sorten {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .sorten button {
      min-height: 0;
      padding: 0.15rem 0.55rem;
      font-size: 0.85rem;
    }
    .sorten button.an {
      background: var(--accent);
      color: var(--surface);
    }
    .abc {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15rem 0.45rem;
      font-size: 0.9rem;
    }
    .abc .leer {
      color: var(--line);
    }
  `,
})
export class Handbuch {
  protected readonly glossar = inject(Glossar);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  protected readonly kapitel = KAPITEL;
  protected readonly hilfe = HILFE;
  protected readonly regeln = regelKapitel();

  protected readonly suche = signal('');
  protected readonly sorte = signal<string | null>(null);

  protected readonly arten = computed(() => (this.glossar.eintraege() ?? []).filter((e) => e.sort === 'type'));

  /** Nur Sorten, die vorkommen — in der Reihenfolge von `GLOSSARY_SORTS`. */
  protected readonly sorten = computed(() => {
    const da = new Set((this.glossar.eintraege() ?? []).map((e) => e.sort));
    return GLOSSARY_SORTS.filter((s) => da.has(s.key));
  });

  private readonly treffer = computed(() => {
    const q = this.suche().trim().toLowerCase();
    const s = this.sorte();
    return (this.glossar.eintraege() ?? []).filter(
      (e) =>
        (!s || e.sort === s) &&
        (!q || [e.term, ...e.aliases, e.definition, ...e.translations.map((t) => t.term)].some((x) => x.toLowerCase().includes(q))),
    );
  });

  protected readonly gruppen = computed(() => {
    const m = new Map<string, GlossaryEntry[]>();
    for (const e of this.treffer()) {
      const b = buchstabe(e.term);
      (m.get(b) ?? m.set(b, []).get(b)!).push(e);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([b, eintraege]) => ({ b, eintraege }));
  });

  protected readonly abc = computed(() => {
    const da = new Set(this.gruppen().map((g) => g.b));
    return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map((b) => ({ b, da: da.has(b) }));
  });

  constructor() {
    /* Der Anker der Adresse: nach dem Zeichnen dorthin, und wieder, wenn
       das Glossar geladen ist (die Liste schiebt alles darunter). */
    const sub = this.route.fragment.subscribe((f) => {
      if (f) afterNextRender(() => this.zeige(f), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    void this.glossar.laden().then(() => {
      const f = this.route.snapshot.fragment;
      if (f) setTimeout(() => this.zeige(f));
    });
  }

  protected abschnitt = abschnittId;
  protected sortLabel = glossarySortLabel;

  protected oeffne(e: GlossaryEntry): void {
    this.glossar.oeffnen(e.id);
  }

  /** Ein Sprung im Inhaltsverzeichnis: die Adresse merkt ihn, die Seite scrollt. */
  protected springe(id: string, ev: Event): void {
    ev.preventDefault();
    history.replaceState(history.state, '', `${location.pathname}#${id}`);
    this.zeige(id);
  }

  private zeige(id: string): void {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }
}
