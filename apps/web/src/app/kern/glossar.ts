/**
 * **Das Glossar in der Oberfläche** (T-242): die Einträge, einmal geladen,
 * der Suchindex für die Erkennung im Text und welcher Eintrag in der
 * Seitenleiste offen ist.
 *
 * Geladen wird beim ersten Bedarf (ein Text, die Leiste, das Handbuch) —
 * `GET /api/glossary` hat schon gesiebt: was hier ankommt, darf gezeigt
 * werden. Ändert sich der Stapel, lädt `neuLaden` frisch.
 *
 * **Erkennen, Vorschau, Öffnen:** ein Begriff im Text ist gepunktet
 * unterstrichen (`nwBegriff`). Darüberfahren und ein schlichter Klick
 * zeigen die Kurzansicht seines Artikels — dieselbe wie an jedem Verweis;
 * Strg/⌘+Klick oder Enter öffnen den Eintrag in der Seitenleiste
 * (`nw-glossar-leiste`), die neben der Seite stehen bleibt.
 */

import { Directive, ElementRef, Injectable, Input, computed, inject, signal } from '@angular/core';
import { glossaryEntryNamed, termIndex, type GlossaryEntry, type Registry } from '@nw/model';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class Glossar {
  private readonly api = inject(Api);
  private readonly _eintraege = signal<GlossaryEntry[] | null>(null);
  private laeuft: Promise<void> | null = null;

  /** Alle Einträge, alphabetisch; `null`, solange nicht geladen. */
  readonly eintraege = this._eintraege.asReadonly();
  /** Der Index für die Erkennung im Fliesstext — nur Artikel mit `autolink`. */
  readonly index = computed(() => termIndex(this._eintraege() ?? []));
  /** Id → Eintrag. */
  readonly nachId = computed(() => new Map((this._eintraege() ?? []).map((e) => [e.id, e])));

  /** Der Eintrag in der Seitenleiste. */
  readonly offen = signal<string | null>(null);

  /** Einmal laden; ein zweiter Aufruf wartet auf den ersten. */
  laden(): Promise<void> {
    this.laeuft ??= Promise.resolve()
      .then(() => this.api.glossary())
      .then((r) => this._eintraege.set(r.terms))
      .catch(() => {
        /* Ohne Glossar bleibt der Text, wie er ist; beim nächsten Bedarf neu. */
        this.laeuft = null;
      });
    return this.laeuft;
  }

  /** Nach einem Wechsel des Stapels: die Liste gilt nicht mehr. */
  neuLaden(): Promise<void> {
    this.laeuft = null;
    return this.laden();
  }

  oeffnen(id: string): void {
    void this.laden();
    this.offen.set(id);
  }

  schliessen(): void {
    this.offen.set(null);
  }

  /** Der Eintrag zu einem Namen oder Alias — nur wenn genau einer passt. */
  nachName(name: string): GlossaryEntry | null {
    const k = name.trim().toLowerCase();
    const treffer = (this._eintraege() ?? []).filter((e) => [e.term, ...e.aliases].some((n) => n.toLowerCase() === k));
    return treffer.length === 1 ? treffer[0]! : null;
  }

  /** Die Id des Eintrags zu einem genannten Artikel — für `[nwBegriff]` an
   *  Zuständen, Eigenschaften und Kanten (T-242); `null` ohne Eintrag. */
  begriffZu(id: string | null | undefined, name: string): string | null {
    void this.laden();
    const e = this.fuer({ ...(id ? { id } : {}), name });
    return e && e.id !== id ? e.id : null;
  }

  /** Die Id des Eintrags, den ein Feld oder eine Regeloption nennt
   *  (`glossary`, T-347) — `null`, solange es ihn auf der Installation nicht gibt. */
  genannt(name: string | null | undefined): string | null {
    if (!name) return null;
    void this.laden();
    return glossaryEntryNamed(this._eintraege() ?? [], name)?.id ?? null;
  }

  /** Die Id des Eintrags, den das Feld `Typ.feld` nennt (`PropertySchema.glossary`, T-347) —
   *  für Feldnamen an Artikel, Statblock und Bogen dieselbe Frage. */
  feld(registry: Pick<Registry, 'interfaces'> | null | undefined, ref: string | null | undefined): string | null {
    const punkt = ref?.indexOf('.') ?? -1;
    if (!ref || punkt <= 0) return null;
    return this.genannt(registry?.interfaces[ref.slice(0, punkt)]?.schema?.properties?.[ref.slice(punkt + 1)]?.glossary);
  }

  /** Der Eintrag, der einen Artikel erklärt (`explains`), sonst der gleichnamige. */
  fuer(artikel: { id?: string; name: string }): GlossaryEntry | null {
    const erklaert = (this._eintraege() ?? []).filter((e) => !!artikel.id && e.explains.some((x) => x.id === artikel.id));
    return erklaert.length === 1 ? erklaert[0]! : this.nachName(artikel.name);
  }
}

/**
 * Markiert einen Begriff: `<span [nwBegriff]="id">`. Strg/⌘+Klick und
 * Enter öffnen ihn in der Seitenleiste; ein schlichter Klick bleibt der
 * Kurzansicht (`nwQuick` daneben).
 *
 * `@Input` statt `input()`: die Prüfumgebung übersetzt JIT (wie `KurzLink`).
 */
@Directive({
  selector: '[nwBegriff]',
  host: {
    '[class.begriff]': '!!id',
    '[attr.data-begriff]': 'id || null',
    '[attr.tabindex]': 'id ? 0 : null',
    '[attr.title]': 'titel',
    '(click)': 'klick($event)',
    '(keydown.enter)': 'enter($event)',
  },
})
export class BegriffLink {
  @Input({ alias: 'nwBegriff' }) id: string | null | undefined = '';

  private readonly glossar = inject(Glossar);
  readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /* Der Titel trägt die Definition (T-347): am Feldnamen ist er die
     Erklärung des Feldes, nicht nur ein Hinweis auf die Leiste. */
  protected get titel(): string | null {
    if (!this.id) return null;
    const e = this.glossar.nachId().get(this.id);
    return e?.definition ? `${e.term}: ${e.definition} — Ctrl/⌘+click for the glossary` : 'Glossary — Ctrl/⌘+click to open';
  }

  protected klick(ev: MouseEvent): void {
    if (!this.id || !(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.glossar.oeffnen(this.id);
  }

  protected enter(ev: Event): void {
    if (!this.id) return;
    ev.preventDefault();
    this.glossar.oeffnen(this.id);
  }
}
