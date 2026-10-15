import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { articlesTaking, enumHolds, enumOptions, typeList } from '@nw/model';
import type { PropertySchema, Registry } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit, articles, carry } from './arbeit';
import { RegFacette } from './facette';
import {
  FIELD_KINDS,
  enumRefs,
  fieldKind,
  fieldKey,
  fieldMentions,
  refKind,
  removeField,
  renameField,
  setFieldKind,
  takersOf,
} from './regeln';

/**
 * **Die Einstellungen eines Feldes** — aufgeklappt unter seiner Zeile.
 *
 * Auf dem Design-Canvas steht dafür eine Spalte rechts. Hier steht sie
 * unter der Zeile: die Feldliste einer Spielerfigur ist länger als ein
 * Bildschirm, und eine Spalte, die oben stehen bleibt, während das Feld
 * unten aufgeklappt wird, ist eine, die man suchen muss — oder eine mit
 * eigenem Scroll, und davon hat die Seite genau einen (CLAUDE.md, „Eine
 * Seite, ein Scroll").
 *
 * Geändert wird **der Typ, dem das Feld gehört** (`owner`), auch wenn es
 * hier unter einem anderen aufgeklappt ist (`within`); darum steht es oben
 * dabei, samt allen, für die es dann gilt. **Was eine Einstellung auslöst,
 * steht darunter.** Was für dieses Feld nicht gilt, steht nicht da.
 */
@Component({
  selector: 'nw-reg-feld',
  imports: [RouterLink, RegFacette],
  template: `
    @if (p(); as p) {
      <div class="einst">
        @if (owner() !== within() || nehmer().length) {
          <p class="gilt">
            Belongs to
            <a [routerLink]="[]" [queryParams]="{ type: owner() }">{{ label(owner()) }}</a>
            @if (nehmer().length) {
              — a change here holds for every type that takes it ({{ nehmer().length }}:
              {{ nehmerText() }}).
            }
          </p>
        }

        <label class="f">
          <span>Key</span>
          <input
            type="text"
            [value]="key()"
            [disabled]="!darf() || belegt() !== 0"
            (change)="umbenennen($any($event.target))"
          />
        </label>
        <p class="hint">
          @if (belegt() > 0) {
            {{ carryText(belegt()) }} a value under <code>{{ key() }}</code>. Renaming the key
            would leave them behind, so it stays.
          } @else if (belegt() < 0) {
            The name the value is stored under. The stock could not be counted, so it stays.
          } @else {
            The name the value is stored under. Nothing carries one yet, so it may still change.
          }
        </p>

        <label class="f">
          <span>Label</span>
          <input
            type="text"
            [value]="p.title ?? ''"
            [placeholder]="key()"
            [disabled]="!darf()"
            (change)="setzen({ title: wert($event) || undefined })"
          />
        </label>
        <p class="hint">What the field is called wherever it is drawn. A type may rename it for itself.</p>

        <!-- T-195: was das Feld meint, gezeigt in „+ Add field“. -->
        <label class="f">
          <span>Description</span>
          <textarea
            rows="2"
            [value]="p.description ?? ''"
            [disabled]="!darf()"
            (change)="setzen({ description: wert($event) || undefined })"
          ></textarea>
        </label>
        <p class="hint">One sentence on what the field means — shown when someone adds it while editing an article.</p>

        <label class="f">
          <span>Holds</span>
          <select [disabled]="!darf()" (change)="artWechseln($any($event.target))">
            @for (k of arten; track k[0]) {
              <option [value]="k[0]" [selected]="k[0] === art()">{{ k[1] }}</option>
            }
          </select>
        </label>
        <p class="hint">
          What goes into it and which input the form shows.
          @if (belegt() > 0) {
            {{ carryText(belegt()) }} a value here — a change is asked about first.
          }
        </p>

        <label class="f">
          <span>Required</span>
          <select [disabled]="!darf() || !!p.derived" (change)="pflichtSetzen($any($event.target).value === '1')">
            <option value="" [selected]="!pflicht()">no</option>
            <option value="1" [selected]="pflicht()">yes</option>
          </select>
        </label>
        <p class="hint">
          A required field must be filled before an article is saved — every article of a type that takes
          {{ label(owner()) }}.
        </p>

        @if (!p.derived && !p.readOnly) {
          <label class="f">
            <span>Edited</span>
            <select [disabled]="!darf()" (change)="schalter('alwaysEdit', $any($event.target).value === '1')">
              <option value="" [selected]="!p.alwaysEdit">only while editing</option>
              <option value="1" [selected]="!!p.alwaysEdit">always an input</option>
            </select>
          </label>
          <p class="hint">
            <b>Always an input</b> shows the input without pressing Edit — for a value set mid-turn, like hit
            points. Who may not write still sees the value.
          </p>
          <label class="f">
            <span>In the edit form</span>
            <select [disabled]="!darf()" (change)="schalter('prominent', $any($event.target).value === '1')">
              <option value="" [selected]="!p.prominent">when required or filled</option>
              <option value="1" [selected]="!!p.prominent">always, even empty</option>
            </select>
          </label>
          <p class="hint">
            The edit form shows required fields and fields with a value; the rest are under <b>+ Add field</b>.
            <b>Always, even empty</b> keeps a field one fills on almost every article in view.
          </p>
          <!-- Ein Schlüssel zum Ordnen liest niemand (T-126, editOnly). -->
          <label class="f">
            <span>Read</span>
            <select [disabled]="!darf()" (change)="schalter('editOnly', $any($event.target).value === '1')">
              <option value="" [selected]="!p.editOnly">on the page</option>
              <option value="1" [selected]="!!p.editOnly">only in the edit form</option>
            </select>
          </label>
          <p class="hint">
            <b>Only in the edit form</b> keeps a value off every page, card and print — for a key that orders
            and that nobody reads, like the sortable value next to a date.
          </p>
          <!-- Die Facette einstellbar (T-212): sonst nur aus der Form abgeleitet. -->
          <nw-reg-facette [hint]="p.facet" [darf]="darf()" [feld]="true" (aendern)="setzen({ facet: $event })" />
        }

        @if (art() === 'text' && !p.format) {
          <label class="f">
            <span>Input</span>
            <select [disabled]="!darf() || !!p.derived" (change)="schalter('suggest', $any($event.target).value === '1')">
              <option value="" [selected]="!p.suggest">free text</option>
              <option value="1" [selected]="!!p.suggest">free text, suggests values in use</option>
            </select>
          </label>
          <p class="hint">
            <b>Suggests values in use</b> offers what other visible articles already carry in this field — for a
            kind of thing (species, item type), so the same kind is not spelled three ways. Leave it off for a
            name: a cover name is meant one at a time.
          </p>
        }

        @if (art() === 'text' || art() === 'number') {
          <label class="f">
            <span>Display</span>
            <select [disabled]="!darf()" (change)="formatSetzen($any($event.target).value)">
              <option value="" [selected]="!p.format">—</option>
              <option value="long" [selected]="p.format === 'long'">long text</option>
              <option value="signed" [selected]="p.format === 'signed'">signed</option>
              <option value="measure" [selected]="p.format === 'measure'">measure (text with units)</option>
            </select>
          </label>
          <p class="hint">
            How it is drawn and typed. <b>long text</b> gives a textarea instead of one line; <b>signed</b> prints +3
            and −1 instead of 3 and -1; <b>measure</b> says the text carries numbers with units and is converted on
            read — that one needs a unit below.
          </p>
        }

        @if (art() === 'text' || art() === 'list') {
          <label class="f haken">
            <input
              type="checkbox"
              [checked]="!!p.many"
              [disabled]="!darf()"
              (change)="vieleSetzen($any($event.target))"
            />
            <span>Several entries</span>
          </label>
          <p class="hint">
            Holds a list of entries, each with its own id, instead of one value. With <b>long text</b> it is a text
            block (secrets, lore): the prose element draws it, not the field table, and knowledge is shared per
            entry.
          </p>
        }

        @if (p.format === 'measure' || art() === 'number' || p.unit) {
          <label class="f">
            <span>Stored in unit</span>
            <select [disabled]="!darf()" (change)="setzen({ unit: $any($event.target).value || undefined })">
              <option value="" [selected]="!p.unit">—</option>
              @for (u of einheiten(); track u.code) {
                <option [value]="u.code" [selected]="u.code === p.unit">{{ u.code }} — {{ u.label }} ({{ u.quantity }})</option>
              }
            </select>
          </label>
          <p class="hint">
            The unit the stored number is in. It is converted on read to what the campaign shows (setting
            <code>units</code>) and never stored twice (D8).
            @if (p.format === 'measure' && !p.unit) {
              <b>A measure without a unit converts nothing</b> — name the unit its bare numbers are in.
            }
          </p>
        }

        @if (art() === 'number') {
          <div class="f">
            <span>Range</span>
            <span class="paar">
              <input
                type="number"
                aria-label="Lowest"
                placeholder="min"
                [value]="p.min ?? ''"
                [disabled]="!darf()"
                (change)="grenze('min', $any($event.target).value)"
              />
              <span>to</span>
              <input
                type="number"
                aria-label="Highest"
                placeholder="max"
                [value]="p.max ?? ''"
                [disabled]="!darf()"
                (change)="grenze('max', $any($event.target).value)"
              />
            </span>
          </div>
          <p class="hint">
            A number with bounds is a range, not a list of twenty words. The form stops at the bounds, and the check
            refuses a value outside them when an article is saved.
          </p>
        }

        @if (art() === 'choice' || art() === 'choices') {
          <div class="f">
            <span>Choices from</span>
            <div class="wahl">
              @for (e of listen(); track e.name) {
                <label class="haken">
                  <input
                    type="checkbox"
                    [checked]="refs().includes(e.name)"
                    [disabled]="!darf()"
                    (change)="listeSchalten(e.name, $any($event.target).checked)"
                  />
                  {{ e.label }} <span class="dim">({{ e.n }})</span>
                </label>
              } @empty {
                <span class="dim">No lists yet — make one under Lists.</span>
              }
              <input
                type="text"
                placeholder="or the names of articles: Skill, Weapon.category"
                [value]="artRefs()"
                [disabled]="!darf()"
                (change)="artRefsSetzen($any($event.target))"
              />
            </div>
          </div>
          <p class="hint">
            A list two fields share is a row under <b>Lists</b>, and the field names it — several named lists count
            together. A type name offers the names of its visible articles and <b>suggests</b> instead of holding;
            <code>Type.field</code> takes another field's own words.
          </p>
          @if (!refs().length) {
            <label class="f">
              <span>Its own words</span>
              <input
                type="text"
                placeholder="common, rare"
                [value]="(p.enum ?? []).join(', ')"
                [disabled]="!darf()"
                (change)="eigeneWerte($any($event.target))"
              />
            </label>
            <p class="hint">
              Comma separated. A list only this field uses stays here; once a second field needs it, make it a list.
            </p>
          }
        }

        @if (art() === 'link' || art() === 'links') {
          <label class="f">
            <span>May point at</span>
            <select
              multiple
              size="6"
              [disabled]="!darf()"
              (change)="zielSetzen($any($event.target))"
            >
              @for (t of alleTypen(); track t) {
                <option [value]="t" [selected]="(p.target?.interfaces ?? []).includes(t)">{{ label(t) }}</option>
              }
            </select>
          </label>
          <p class="hint">
            The types a link may hold, subtypes included — the check refuses any other. Nothing picked means any
            article.
          </p>
          <label class="f">
            <span>Suggest with tags</span>
            <input
              type="text"
              placeholder="any of these"
              [value]="(p.target?.tags ?? []).join(', ')"
              [disabled]="!darf()"
              (change)="markenSetzen($any($event.target))"
            />
          </label>
          <p class="hint">Narrows what the form offers; it does not hold — a tag removed later breaks nothing.</p>
        }

        <label class="f">
          <span>Derived from</span>
          <input
            type="text"
            placeholder="10+mod(wis)"
            [value]="p.derived ?? ''"
            [disabled]="!darf()"
            (change)="setzen({ derived: wert($event) || undefined })"
          />
        </label>
        <p class="hint">
          <b>A sum instead of a value.</b> The field is worked out every time the article is read — never stored, and it
          gets no input (D8). Names resolve against the <b>other fields of this same type</b> first, then the article's
          other cards: <code>mod(dex)</code> reads <code>dex</code> next door, and a statblock's
          <code>8+prof+modOf(spellAbility)</code> takes the INT score from Abilities.
        </p>

        @if (p.derived) {
          <label class="f">
            <span>Belongs to field</span>
            <input
              type="text"
              placeholder="dex"
              [value]="p.of ?? ''"
              [disabled]="!darf()"
              (change)="setzen({ of: wert($event) || undefined })"
            />
          </label>
          <p class="hint">
            <b>Where a computed value is shown.</b> Name a neighbour and this field rides in its cell instead of taking
            one of its own: <code>dexMod</code> belongs to <code>dex</code>, so the sheet reads <b>DEX 16 (+3)</b>.
          </p>
        }

        @if (darf()) {
          <div class="knoepfe">
            @if (owner() === within()) {
              <button type="button" class="weg" (click)="entfernen()">Remove field</button>
            } @else {
              <span class="dim"
                >Removed only where it is declared —
                <a [routerLink]="[]" [queryParams]="{ type: owner() }">at {{ label(owner()) }}</a>.</span
              >
            }
          </div>
        }
      </div>
    }
  `,
  /* Gezeichnet im Stil der Registerseite (`register.scss`, einmal geladen). */
})
export class RegFeld {
  /** Der Typ, der das Feld erklärt — geändert wird er. */
  readonly owner = input.required<string>();
  readonly key = input.required<string>();
  /** Der Typ, unter dem es gerade aufgeklappt ist. */
  readonly within = input.required<string>();
  readonly darf = input(false);

  private readonly bestand = inject(Bestand);
  private readonly arbeit = inject(RegisterArbeit);
  protected readonly arten = FIELD_KINDS;

  private readonly reg = computed(() => this.bestand.registry());
  protected readonly p = computed<PropertySchema | undefined>(
    () => this.reg()?.interfaces[this.owner()]?.schema?.properties[this.key()],
  );
  protected readonly art = computed(() => fieldKind(this.p()));
  protected readonly pflicht = computed(
    () => (this.reg()?.interfaces[this.owner()]?.schema?.required ?? []).includes(this.key()),
  );
  protected readonly refs = computed(() => enumRefs(this.p()));
  protected readonly nehmer = computed(() => {
    const r = this.reg();
    return r ? takersOf(r, this.owner()) : [];
  });
  protected readonly nehmerText = computed(() => {
    const n = this.nehmer().map((t) => this.label(t));
    return n.length > 6 ? `${n.slice(0, 6).join(', ')} …` : n.join(', ');
  });
  /** In wie vielen Artikeln etwas in diesem Feld steht; −1 heisst: nicht gezählt. */
  protected readonly belegt = computed(() => {
    const u = this.arbeit.usage();
    if (!u) return -1;
    return u.cards[this.owner()]?.fields[this.key()] ?? 0;
  });
  protected readonly einheiten = computed(() =>
    Object.values(this.reg()?.units ?? {}).sort(
      (a, b) => a.quantity.localeCompare(b.quantity) || a.base - b.base,
    ),
  );
  protected readonly listen = computed(() =>
    Object.entries(this.reg()?.enums ?? {})
      .map(([name, e]) => ({ name, label: e.label ?? name, n: e.values.length }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en')),
  );
  protected readonly artRefs = computed(() =>
    this.refs()
      .filter((n) => !this.reg()?.enums?.[n])
      .join(', '),
  );
  protected readonly alleTypen = computed(() => {
    const r = this.reg();
    return r ? typeList(r) : [];
  });

  protected label(t: string): string {
    return this.reg()?.interfaces[t]?.label ?? t;
  }
  protected carryText(n: number): string {
    return carry(n);
  }
  protected artikelText(n: number): string {
    return articles(n).replace(/^./, (c) => c.toUpperCase());
  }
  protected wert(ev: Event): string {
    return String((ev.target as HTMLInputElement).value ?? '').trim();
  }

  /** Das Feld ändern; `undefined` nimmt eine Angabe heraus. */
  protected setzen(teil: Partial<PropertySchema>): Promise<boolean> {
    return this.feldAendern((p) => {
      for (const [k, v] of Object.entries(teil)) {
        if (v === undefined) delete (p as unknown as Record<string, unknown>)[k];
        else (p as unknown as Record<string, unknown>)[k] = v;
      }
      return p;
    });
  }
  protected schalter(k: 'alwaysEdit' | 'editOnly' | 'suggest' | 'prominent', an: boolean): void {
    void this.setzen({ [k]: an ? true : undefined });
  }

  private feldAendern(f: (p: PropertySchema) => PropertySchema | string): Promise<boolean> {
    const owner = this.owner();
    const key = this.key();
    return this.arbeit.aendern('interfaces', (ifs) => {
      const props = ifs[owner]?.schema?.properties;
      const alt = props?.[key];
      if (!props || !alt) return `${owner}.${key} is gone.`;
      const neu = f(alt);
      if (typeof neu === 'string') return neu;
      props[key] = neu;
      return undefined;
    });
  }

  /** Erst fragen, wenn etwas dasteht — und sagen, was es trifft. */
  private nachfragen(titel: string, text: string[], ja: string, tun: () => unknown, belegt = this.belegt()): void {
    if (belegt === 0) {
      void tun();
      return;
    }
    const zahl = belegt < 0 ? ['The stock could not be counted — this may touch stored values.'] : [];
    this.arbeit.fragen({ titel, text: [...zahl, ...text], ja, tun: () => void tun() });
  }

  protected umbenennen(el: HTMLInputElement): void {
    const neu = fieldKey(el.value);
    const alt = this.key();
    if (!neu || neu === alt) {
      el.value = alt;
      return;
    }
    const reg = this.reg() as Registry;
    if (fieldMentions(reg, this.owner(), alt).some((m) => m.startsWith('the view'))) {
      this.arbeit.fehler.set(`A view under Registry › views names ${this.owner()}.${alt}; rename it there first.`);
      el.value = alt;
      return;
    }
    const owner = this.owner();
    void this.arbeit.aendern('interfaces', (ifs) => renameField(ifs, owner, alt, neu)).then((ok) => {
      if (!ok) el.value = alt;
    });
  }

  protected artWechseln(el: HTMLSelectElement): void {
    const kind = el.value;
    const vorher = this.art();
    if (kind === vorher) return;
    el.value = vorher; // erst nach der Antwort umstellen
    const n = this.belegt();
    this.nachfragen(
      `Change ${this.key()} to ${FIELD_KINDS.find(([k]) => k === kind)?.[1] ?? kind}?`,
      [
        `${carry(n)} a value in ${this.owner()}.${this.key()}.`,
        'The values stay as they are. One that does not fit the new kind is drawn as best it can be, and the check refuses it on that article’s next save if the new kind has a list or a range it breaks.',
      ],
      'Change it',
      () => this.feldAendern((p) => setFieldKind(p, kind)),
    );
  }

  protected pflichtSetzen(an: boolean): void {
    const owner = this.owner();
    const key = this.key();
    const tun = () =>
      this.arbeit.aendern('interfaces', (ifs) => {
        const schema = ifs[owner]?.schema;
        if (!schema) return `${owner} has no fields.`;
        const r = (schema.required ?? []).filter((x) => x !== key);
        if (an) r.push(key);
        if (r.length) schema.required = r;
        else delete schema.required;
        return undefined;
      });
    if (!an) {
      void tun();
      return;
    }
    const u = this.arbeit.usage();
    const reg = this.reg();
    const leer = u && reg ? Math.max(0, articlesTaking(reg, u, owner) - (u.cards[owner]?.fields[key] ?? 0)) : -1;
    this.nachfragen(
      `Make ${this.key()} required?`,
      [
        `${this.artikelText(leer)} of the types that take ${this.label(owner)} have nothing in it.`,
        'They stay as they are, but each is refused on its next save until the field is filled.',
      ],
      'Make it required',
      tun,
      leer,
    );
  }

  protected formatSetzen(f: string): void {
    void this.feldAendern((p) => {
      const n = { ...p };
      if (f) n.format = f;
      else delete n.format;
      /* Ein Mass braucht sein Ausgangsmass — die Prüfung verlangt es, also
         steht es gleich da und nicht erst nach einer Abweisung. */
      if (f === 'measure' && !n.unit) n.unit = 'ft';
      return n;
    });
  }

  protected vieleSetzen(el: HTMLInputElement): void {
    const an = el.checked;
    el.checked = !an;
    this.nachfragen(
      an ? `Let ${this.key()} hold several entries?` : `Let ${this.key()} hold one value again?`,
      [
        `${carry(this.belegt())} a value here.`,
        an
          ? 'A single value already stored is still read as one entry; the next save writes it as a list.'
          : 'Articles with several entries keep them, but the form shows only one value — the others are no longer drawn.',
      ],
      'Change it',
      () => this.setzen({ many: an ? true : undefined }),
    );
  }

  protected grenze(k: 'min' | 'max', roh: string): void {
    const zahl = roh === '' ? undefined : Number(roh);
    if (zahl !== undefined && !Number.isFinite(zahl)) return;
    const enger = zahl !== undefined && (this.p()?.[k] === undefined || (k === 'min' ? zahl > this.p()!.min! : zahl < this.p()!.max!));
    const tun = () => this.setzen({ [k]: zahl });
    if (!enger) {
      void tun();
      return;
    }
    this.nachfragen(
      `Narrow the range of ${this.key()}?`,
      [
        `${carry(this.belegt())} a value here.`,
        'Any of them outside the new range is refused on its next save until it is changed.',
      ],
      'Narrow it',
      tun,
    );
  }

  /**
   * **Werte, die verloren gingen.** Hält die neue Liste, und stehen Werte im
   * Bestand, die sie nicht mehr kennt, wird vorher gesagt, welche und wie oft
   * — ein solcher Artikel wird beim nächsten Speichern abgewiesen
   * (`value_not_allowed`).
   */
  private wertePruefen(neu: PropertySchema, tun: () => unknown): void {
    const reg = this.reg();
    const u = this.arbeit.usage();
    if (!reg) return;
    const zaehler = u?.values[`${this.owner()}.${this.key()}`] ?? {};
    const erlaubt = enumHolds(reg, neu) ? enumOptions(reg, neu) : undefined;
    const weg = erlaubt
      ? Object.entries(zaehler).filter(([w]) => !erlaubt.includes(w))
      : [];
    if (!weg.length) {
      void tun();
      return;
    }
    const liste = weg.slice(0, 8).map(([w, n]) => `“${w}” in ${articles(n)}`).join(', ');
    this.arbeit.fragen({
      titel: `Values no longer allowed in ${this.key()}`,
      text: [
        `The stock carries values the new list does not have: ${liste}${weg.length > 8 ? ' …' : ''}.`,
        'They stay stored, but each such article is refused on its next save until the value is changed.',
      ],
      ja: 'Change it anyway',
      tun: () => void tun(),
    });
  }

  private refsSetzen(neu: string[]): void {
    const p = this.p();
    if (!p) return;
    const n: PropertySchema = { ...p };
    if (neu.length) {
      n.enumRef = neu.length === 1 ? neu[0]! : neu;
      delete n.enum;
    } else {
      delete n.enumRef;
      if (!n.enum) n.enum = [];
    }
    this.wertePruefen(n, () => this.feldAendern(() => n));
  }

  protected listeSchalten(name: string, an: boolean): void {
    const jetzt = this.refs().filter((r) => r !== name);
    this.refsSetzen(an ? [...jetzt, name] : jetzt);
  }

  protected artRefsSetzen(el: HTMLInputElement): void {
    const reg = this.reg();
    if (!reg) return;
    const genannt = el.value.split(',').map((x) => x.trim()).filter(Boolean);
    const fehlt = genannt.filter((n) => !refKind(reg, n));
    if (fehlt.length) {
      this.arbeit.fehler.set(`Not a type or a field: ${fehlt.join(', ')}`);
      el.value = this.artRefs();
      return;
    }
    this.refsSetzen([...this.refs().filter((n) => reg.enums?.[n]), ...genannt]);
  }

  protected eigeneWerte(el: HTMLInputElement): void {
    const p = this.p();
    if (!p) return;
    const werte = [...new Set(el.value.split(',').map((x) => x.trim()).filter(Boolean))];
    const n: PropertySchema = { ...p, enum: werte };
    this.wertePruefen(n, () => this.feldAendern(() => n));
  }

  protected zielSetzen(el: HTMLSelectElement): void {
    const gewaehlt = Array.from(el.selectedOptions).map((o) => o.value);
    void this.feldAendern((p) => {
      const t = { ...(p.target ?? {}) };
      if (gewaehlt.length) t.interfaces = gewaehlt;
      else delete t.interfaces;
      return { ...p, target: t };
    });
  }

  protected markenSetzen(el: HTMLInputElement): void {
    const xs = el.value.split(',').map((x) => x.trim()).filter(Boolean);
    void this.feldAendern((p) => {
      const t = { ...(p.target ?? {}) };
      if (xs.length) t.tags = xs;
      else delete t.tags;
      return { ...p, target: t };
    });
  }

  /**
   * **Ein Feld wegnehmen** — nur dort, wo es erklärt ist. Vorher wird
   * gezählt und gesagt, was es noch trägt und wer es nennt.
   */
  protected entfernen(): void {
    const reg = this.reg();
    if (!reg) return;
    const owner = this.owner();
    const key = this.key();
    const n = this.belegt();
    const nennen = fieldMentions(reg, owner, key);
    this.arbeit.fragen({
      titel: `Remove the field ${key} from ${this.label(owner)}?`,
      text: [
        n < 0
          ? 'The stock could not be counted.'
          : n === 0
            ? 'No article carries a value in it.'
            : `${carry(n)} a value in it. The values stay in the articles but are no longer shown, edited or exported as a field.`,
        ...(this.nehmer().length ? [`It goes from every type that takes ${this.label(owner)} (${this.nehmer().length}).`] : []),
        ...(nennen.length ? [`Also named elsewhere: ${nennen.join('; ')}.`] : []),
      ],
      ja: 'Remove',
      tun: () => void this.arbeit.aendern('interfaces', (ifs) => removeField(ifs, owner, key)),
    });
  }
}
