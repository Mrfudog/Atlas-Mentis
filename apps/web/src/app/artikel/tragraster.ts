import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  assembleCarry, carryFieldValue, carrySheetOf, enumOptions, formatCarrySheet, formatContainerTemplate, formatPairs,
  openRows, parseContainerTemplate, parsePairs, sheetFields, typeChain,
  type CarryBlock, type CarryCondition, type ContainerTemplate,
} from '@nw/model';
import { Bestand } from '../kern/bestand';
import { zonenFarbe } from '../kern/zonenfarbe';
import { Zonenmaler, type Gemalt } from './zonenmaler';

/** Eine Behältervorlage im Entwurf. */
interface Vorlage extends ContainerTemplate {
  name: string;
}

/** Was der Editor bearbeitet — Basils Blatt und was dazugehört, gelesen. */
interface Entwurf {
  blocks: CarryBlock[];
  vorlagen: Vorlage[];
  hand: { drop: string; stow: string };
  plaetze: Record<string, string | undefined>;
  cols: number;
  rows: number;
}

/** Ein Feld, nach dem ein Baustein fragen kann. */
interface Feldwahl {
  ref: string;
  label: string;
  /** Die Werte einer Aufzählung; ohne ist es eine Zahl mit Spanne. */
  werte: string[] | null;
  formel?: string;
}

const VORLAGE = 'container:';
const ATTRIBUTE = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * **Das Tragblatt einstellen** (REQ-355, REQ-356): Basils Blatt aus
 * **Bausteinen**. Jeder Baustein hat eine gemalte Form, eigene Zonen
 * (Felder mit einer Dauer) und Bedingungen auf Felder des Statblocks —
 * Grösse, Stärke oder jedes andere. Was für eine Kreatur gilt, wird
 * aneinandergefügt (`assembleCarry`); die Vorschau oben zeigt es für eine
 * gewählte Grösse und Stärke, damit man sieht, was die Stärke ausmacht.
 *
 * Geschrieben wird die Einstellung `carrySheet` (JSON), die Vorlagen als
 * `container:*`, dazu `handActions`, `slotDraw`, `inventoryCols`/`Rows`.
 * Die älteren `carrySquares`/`carryZones` bleiben stehen und gelten nur,
 * solange es kein `carrySheet` gibt. Alles gilt für die ganze
 * Installation (E-096); schreiben dürfen die Verwaltung und die Leitung
 * der laufenden Kampagne.
 */
@Component({
  selector: 'nw-tragraster',
  imports: [Zonenmaler],
  template: `
    @if (entwurf(); as d) {
      <div class="tragraster">
        <h5>Try it</h5>
        <p class="hint">Pick a creature to see its grid: every block whose conditions hold is joined, left to right.</p>
        <div class="zeile probe">
          @for (f of probeFelder(); track f.ref) {
            @if (f.werte) {
              <label>{{ f.label }}
                <select (change)="probeSetzen(f.ref, $any($event.target).value)">
                  <option value="" [selected]="!probe()[f.ref]">—</option>
                  @for (w of f.werte; track w) {
                    <option [value]="w" [selected]="probe()[f.ref] === w">{{ w }}</option>
                  }
                </select>
              </label>
            } @else {
              <label>{{ f.label }}
                <input type="number" [value]="probe()[f.ref] || ''" (input)="probeSetzen(f.ref, $any($event.target).value)" />
              </label>
            }
          }
        </div>
        @if (ergebnis(); as t) {
          <p class="bilanz">
            @for (p of t.parts; track p.id) {
              {{ $first ? '' : ' + ' }}<b>{{ p.label || 'Block' }}</b> {{ p.w }}×{{ p.h }}
            }
            = {{ t.rows[0]?.length ?? 0 }}×{{ t.rows.length }}, {{ felderVon(t.rows) }} cells
          </p>
          <div class="raster vorschau" [style.--spalten]="t.rows[0]?.length ?? 1" aria-label="Assembled grid">
            @for (r of t.rows; track $index; let y = $index) {
              @for (x of reihe(r.length); track x) {
                <span class="feld" [class.aus]="r.charAt(x) === '.'" [class.naht]="naht().has(x)"
                      [style.background-color]="r.charAt(x) === '.' ? null : farbe(t.zones[x + ',' + y])"
                      [attr.title]="t.zones[x + ',' + y] || ''"></span>
              }
            }
          </div>
        } @else {
          <p class="hint">No block applies — this creature gets the plain rectangle ({{ d.cols }}×{{ d.rows }}).</p>
        }
        <p class="legende">
          @for (l of leiter(); track l) {
            <span><i [style.background-color]="farbe(l)"></i>{{ l }}</span>
          }
        </p>

        <h5>Blocks</h5>
        <p class="hint">Each block has its own shape and zones and applies when all its conditions hold. Order is left to right.</p>
        @for (b of d.blocks; track b.id; let i = $index) {
          <details class="baustein" [open]="offen().has(b.id)" (toggle)="aufklappen(b.id, $any($event.target).open)">
            <summary>
              <b>{{ b.label || 'Block' }}</b>
              <span class="hint">{{ blockText(b) }}</span>
              @if (gilt().has(b.id)) {
                <span class="marke an">in the preview</span>
              }
            </summary>
            <div class="zeile">
              <input type="text" class="name" [value]="b.label" aria-label="Block name" (change)="block(i, { label: $any($event.target).value })" />
              <button type="button" class="klein" [disabled]="i === 0" (click)="schiebe(i, -1)" aria-label="Move left">↑</button>
              <button type="button" class="klein" [disabled]="i === d.blocks.length - 1" (click)="schiebe(i, 1)" aria-label="Move right">↓</button>
              <button type="button" class="klein" (click)="kopiere(i)">Duplicate</button>
              <button type="button" class="klein" (click)="blockWeg(i)" [attr.aria-label]="'Remove block ' + b.label">Remove</button>
            </div>
            <div class="bedingungen">
              <span class="hint">Applies when</span>
              @for (c of b.when; track $index; let j = $index) {
                <div class="bedingung">
                  <select aria-label="Field" (change)="bedingung(i, j, { field: $any($event.target).value, is: undefined, min: undefined, max: undefined })">
                    @for (f of felder(); track f.ref) {
                      <option [value]="f.ref" [selected]="f.ref === c.field">{{ f.label }}</option>
                    }
                  </select>
                  @if (feldVon(c.field)?.werte; as werte) {
                    <span class="werte">
                      @for (w of werte; track w) {
                        <label><input type="checkbox" [checked]="c.is?.includes(w) ?? false" (change)="wertKippen(i, j, w, $any($event.target).checked)" />{{ w }}</label>
                      }
                    </span>
                  } @else {
                    <label>from <input type="number" [value]="c.min ?? ''" (change)="bedingung(i, j, { min: zahl($any($event.target).value) })" /></label>
                    <label>to <input type="number" [value]="c.max ?? ''" (change)="bedingung(i, j, { max: zahl($any($event.target).value) })" /></label>
                  }
                  <button type="button" class="klein" (click)="bedingungWeg(i, j)" aria-label="Remove condition">×</button>
                </div>
              } @empty {
                <span class="hint">always</span>
              }
              <button type="button" class="klein" (click)="bedingungNeu(i)">+ Condition</button>
            </div>
            <nw-zonenmaler [rows]="b.rows" [zones]="b.zones" [leiter]="leiter()" [label]="b.label" (aendern)="gemalt(i, $event)" />
          </details>
        }
        <button type="button" class="klein" (click)="blockNeu()">+ Block</button>

        <h5>Without a block</h5>
        <p class="hint">The rectangle for a creature no block applies to, and for any container without a shape of its own.</p>
        <div class="zeile">
          <label>Columns <input type="number" min="1" max="30" [value]="d.cols" (change)="setze({ cols: +$any($event.target).value || 10 })" /></label>
          <label>Rows <input type="number" min="1" max="30" [value]="d.rows" (change)="setze({ rows: +$any($event.target).value || 6 })" /></label>
        </div>

        <h5>Container templates</h5>
        <p class="hint">Offered when a container is set up — with its shape and its zones.</p>
        @for (v of d.vorlagen; track $index; let i = $index) {
          <details class="baustein" [open]="offen().has('v:' + i)" (toggle)="aufklappen('v:' + i, $any($event.target).open)">
            <summary><b>{{ v.name }}</b> <span class="hint">{{ v.rows[0]?.length ?? 0 }}×{{ v.rows.length }}, {{ v.zones.length }} {{ v.zones.length === 1 ? 'zone' : 'zones' }}</span></summary>
            <div class="zeile">
              <input type="text" class="name" [value]="v.name" aria-label="Template name" (change)="vorlage(i, { name: $any($event.target).value })" />
              <button type="button" class="klein" (click)="vorlageWeg(i)" [attr.aria-label]="'Remove ' + v.name">Remove</button>
            </div>
            <nw-zonenmaler [rows]="v.rows" [zones]="v.zones" [leiter]="leiter()" [label]="v.name" (aendern)="vorlage(i, $event)" />
          </details>
        }
        <button type="button" class="klein" (click)="vorlageNeu()">+ Template</button>

        <h5>Hands</h5>
        <div class="zeile">
          <label>Drop
            <select (change)="setze({ hand: { drop: $any($event.target).value, stow: d.hand.stow } })">
              <option value="" [selected]="!d.hand.drop">— not offered</option>
              @for (l of leiter(); track l) {
                <option [value]="l" [selected]="l === d.hand.drop">{{ l }}</option>
              }
            </select>
          </label>
          <label>Stow
            <select (change)="setze({ hand: { drop: d.hand.drop, stow: $any($event.target).value } })">
              <option value="" [selected]="!d.hand.stow">— not offered</option>
              @for (l of leiter(); track l) {
                <option [value]="l" [selected]="l === d.hand.stow">{{ l }}</option>
              }
            </select>
          </label>
        </div>

        <details>
          <summary>Body slots ({{ platzNamen().length }})</summary>
          <p class="hint">How fast something comes from a body slot; a container there adds one step for what is inside.</p>
          <div class="plaetze">
            @for (p of platzNamen(); track p) {
              <label>{{ p }}
                <select (change)="platz(p, $any($event.target).value)">
                  <option value="" [selected]="!d.plaetze[p]">—</option>
                  @for (l of leiter(); track l) {
                    <option [value]="l" [selected]="l === d.plaetze[p]">{{ l }}</option>
                  }
                </select>
              </label>
            }
          </div>
        </details>

        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }
        <div class="zeile knoepfe">
          <button type="button" class="pri" [disabled]="!geaendert() || laeuft()" (click)="speichern()">{{ laeuft() ? 'Saving…' : 'Save grid settings' }}</button>
          <button type="button" [disabled]="!geaendert() || laeuft()" (click)="zuruecksetzen()">Discard changes</button>
          @if (gespeichert()) {
            <span class="hint" role="status">Saved — applies to every campaign of this installation.</span>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .tragraster { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; margin-top: 0.4rem; }
    .tragraster > .raster, .tragraster > .baustein { align-self: stretch; }
    h5 { margin: 0.8rem 0 0; font-size: 0.95rem; }
    .hint { color: var(--dim); margin: 0; font-size: 0.9rem; }
    .zeile, .plaetze, .bedingung, .werte { display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; align-items: center; }
    input.name { width: 10rem; }
    input[type='number'] { width: 4rem; }
    .bilanz { margin: 0.2rem 0 0; }
    .raster { display: grid; grid-template-columns: repeat(var(--spalten), minmax(1.3rem, 2rem)); gap: 2px; max-width: 100%; overflow-x: auto; }
    .feld { aspect-ratio: 1; min-height: 1.2rem; border: 1px solid var(--line); border-radius: 2px; background: var(--surface); }
    .feld.aus { background-color: transparent; border-style: dotted; opacity: 0.5; }
    /* Wo ein Baustein an den nächsten stösst. */
    .feld.naht { box-shadow: -3px 0 0 var(--accent); }
    .legende { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--dim); }
    .legende i { display: inline-block; width: 0.9rem; height: 0.9rem; margin-right: 0.25rem; vertical-align: -0.15rem; border: 1px solid var(--line); border-radius: 2px; }
    .baustein { border-left: 3px solid var(--line); padding: 0.3rem 0.6rem; }
    .baustein[open] { display: flex; flex-direction: column; gap: 0.4rem; }
    .baustein summary { cursor: pointer; display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; align-items: baseline; }
    .bedingungen { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; }
    .marke.an { color: var(--accent); font-size: 0.8rem; }
    .plaetze label { display: inline-flex; gap: 0.3rem; align-items: center; }
    .knoepfe { margin-top: 0.6rem; }
    .fehler { color: var(--warn); }
  `,
})
export class Tragraster {
  private readonly bestand = inject(Bestand);

  private readonly registry = computed(() => this.bestand.registry());
  private readonly settings = computed(() => this.registry()?.settings ?? {});
  protected readonly leiter = computed<string[]>(() => this.registry()?.enums?.['DrawTime']?.values ?? []);
  private readonly zusatzMax = computed(() => {
    const pd = this.registry()?.interfaces['Statblock']?.schema?.properties?.['carryExtra'];
    return typeof pd?.max === 'number' ? pd.max : 5;
  });

  protected readonly entwurf = signal<Entwurf | null>(null);
  /** Der Stand beim Laden, als Text — „geändert“ ist ein Vergleich, kein Zähler. */
  private readonly geladen = signal('');
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal('');
  protected readonly gespeichert = signal(false);
  /** Welche Bausteine aufgeklappt sind — über ein Speichern hinweg. */
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  /** Die Werte der Vorschau, je Feld (`Statblock.size`, `Abilities.str`). */
  protected readonly probe = signal<Record<string, string>>({ 'Statblock.size': 'medium', 'Abilities.str': '16' });

  constructor() {
    effect(() => {
      const s = this.settings();
      untracked(() => {
        if (this.entwurf() && this.geaendert()) return;
        this.lies(s);
      });
    });
  }

  private lies(s: Record<string, string>): void {
    const d: Entwurf = {
      blocks: carrySheetOf(s, this.zusatzMax())?.blocks ?? [],
      vorlagen: Object.keys(s)
        .filter((k) => k.startsWith(VORLAGE))
        .map((k) => ({ name: k.slice(VORLAGE.length), ...(parseContainerTemplate(s[k]) ?? { rows: ['#'], zones: [] }) })),
      hand: { drop: parsePairs(s['handActions'])['drop'] ?? '', stow: parsePairs(s['handActions'])['stow'] ?? '' },
      plaetze: Object.fromEntries(Object.entries(parsePairs(s['slotDraw'])).map(([k, v]) => [k, v === '-' ? '' : v])),
      cols: Number(s['inventoryCols']) || 10,
      rows: Number(s['inventoryRows']) || 6,
    };
    this.entwurf.set(d);
    this.geladen.set(JSON.stringify(d));
  }

  protected readonly geaendert = computed(() => JSON.stringify(this.entwurf()) !== this.geladen());

  // ------------------------------------------------------------ Felder

  /** Die Felder des Statblocks (mit Abilities), nach denen eine Bedingung fragen kann. */
  protected readonly felder = computed<Feldwahl[]>(() => {
    const r = this.registry();
    if (!r) return [];
    const raus: Feldwahl[] = [];
    for (const comp of typeChain(r, 'Statblock')) {
      const def = r.interfaces[comp];
      for (const [k, p] of Object.entries(def?.schema?.properties ?? {})) {
        const werte = p.enumRef || p.enum ? (enumOptions(r, p) ?? null) : null;
        if (p.type !== 'number' && !werte) continue;
        raus.push({ ref: `${comp}.${k}`, label: `${p.title ?? k}${comp === 'Statblock' ? '' : ` (${def?.label ?? comp})`}`, werte, ...(p.derived ? { formel: p.derived } : {}) });
      }
    }
    return raus.sort((a, b) => a.label.localeCompare(b.label));
  });

  protected feldVon(ref: string): Feldwahl | undefined {
    return this.felder().find((f) => f.ref === ref);
  }

  /**
   * Was die Vorschau fragt: die Felder der Bedingungen — ein gerechnetes
   * Feld nicht selbst, sondern die Attribute, aus denen es rechnet. So
   * stellt man STR ein und sieht, was das Zusatzquadrat daraus macht.
   */
  protected readonly probeFelder = computed<Feldwahl[]>(() => {
    const refs = new Set<string>();
    for (const ref of sheetFields({ blocks: this.entwurf()?.blocks ?? [] })) {
      const f = this.feldVon(ref);
      if (f?.formel) {
        for (const a of ATTRIBUTE) if (new RegExp(`\\b${a}\\b`).test(f.formel)) refs.add(`Abilities.${a}`);
      } else refs.add(ref);
    }
    return [...refs].map((ref) => {
      const f = this.feldVon(ref);
      return f ?? { ref, label: ref, werte: null };
    });
  });

  protected probeSetzen(ref: string, wert: string): void {
    this.probe.set({ ...this.probe(), [ref]: wert });
  }

  private readonly probeWert = computed(() => {
    const r = this.registry();
    const karten: Record<string, Record<string, unknown>> = {};
    for (const [ref, v] of Object.entries(this.probe())) {
      const [comp, name] = ref.split('.');
      if (!comp || !name || v === '') continue;
      const f = this.feldVon(ref);
      (karten[comp] ??= {})[name] = f?.werte ? v : Number(v);
    }
    return r ? carryFieldValue(r, karten) : () => undefined;
  });

  protected readonly ergebnis = computed(() => assembleCarry({ blocks: this.entwurf()?.blocks ?? [] }, this.probeWert()));
  protected readonly gilt = computed(() => new Set(this.ergebnis()?.parts.map((p) => p.id) ?? []));
  /** Die Spalten, an denen ein Baustein beginnt (ausser dem ersten). */
  protected readonly naht = computed(() => new Set((this.ergebnis()?.parts ?? []).slice(1).map((p) => p.x)));

  protected blockText(b: CarryBlock): string {
    const groesse = `${b.rows[0]?.length ?? 0}×${b.rows.length}`;
    const wann = b.when.map((c) => {
      const name = this.feldVon(c.field)?.label ?? c.field;
      if (c.is?.length) return `${name} ${c.is.join('/')}`;
      if (c.min !== undefined && c.max !== undefined) return c.min === c.max ? `${name} ${c.min}` : `${name} ${c.min}–${c.max}`;
      if (c.min !== undefined) return `${name} ≥ ${c.min}`;
      if (c.max !== undefined) return `${name} ≤ ${c.max}`;
      return name;
    });
    return `${groesse} · ${wann.length ? wann.join(', ') : 'always'} · ${b.zones.length} ${b.zones.length === 1 ? 'zone' : 'zones'}`;
  }

  protected reihe(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  protected felderVon(rows: readonly string[]): number {
    return rows.reduce((n, r) => n + r.replace(/\./g, '').length, 0);
  }

  protected farbe(stufe: string | undefined): string | null {
    return zonenFarbe(stufe, this.leiter());
  }

  protected zahl(v: string): number | undefined {
    return v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v);
  }

  protected aufklappen(id: string, auf: boolean): void {
    const s = new Set(this.offen());
    if (auf) s.add(id);
    else s.delete(id);
    this.offen.set(s);
  }

  // ------------------------------------------------------------ ändern

  protected setze(teil: Partial<Entwurf>): void {
    const d = this.entwurf();
    if (d) this.entwurf.set({ ...d, ...teil });
    this.gespeichert.set(false);
  }

  protected block(i: number, teil: Partial<CarryBlock>): void {
    const d = this.entwurf();
    if (d) this.setze({ blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...teil } : b)) });
  }

  protected gemalt(i: number, g: Gemalt): void {
    this.block(i, { rows: g.rows, zones: g.zones });
  }

  private neueId(stamm: string): string {
    const da = new Set(this.entwurf()?.blocks.map((b) => b.id) ?? []);
    let n = 1;
    while (da.has(`${stamm}-${n}`)) n++;
    return `${stamm}-${n}`;
  }

  protected blockNeu(): void {
    const d = this.entwurf();
    if (!d) return;
    const id = this.neueId('block');
    this.setze({ blocks: [...d.blocks, { id, label: 'New block', when: [], rows: openRows(3, 3), zones: [] }] });
    this.aufklappen(id, true);
  }

  protected kopiere(i: number): void {
    const d = this.entwurf();
    const b = d?.blocks[i];
    if (!d || !b) return;
    const id = this.neueId('block');
    const kopie: CarryBlock = JSON.parse(JSON.stringify({ ...b, id, label: `${b.label} (copy)` }));
    this.setze({ blocks: [...d.blocks.slice(0, i + 1), kopie, ...d.blocks.slice(i + 1)] });
    this.aufklappen(id, true);
  }

  protected schiebe(i: number, um: number): void {
    const d = this.entwurf();
    if (!d) return;
    const l = [...d.blocks];
    const [b] = l.splice(i, 1);
    l.splice(i + um, 0, b!);
    this.setze({ blocks: l });
  }

  protected blockWeg(i: number): void {
    const d = this.entwurf();
    if (d) this.setze({ blocks: d.blocks.filter((_, j) => j !== i) });
  }

  protected bedingungNeu(i: number): void {
    const b = this.entwurf()?.blocks[i];
    if (!b) return;
    const erstes = this.felder().find((f) => f.ref === 'Statblock.size') ?? this.felder()[0];
    if (erstes) this.block(i, { when: [...b.when, { field: erstes.ref }] });
  }

  protected bedingung(i: number, j: number, teil: Partial<CarryCondition>): void {
    const b = this.entwurf()?.blocks[i];
    if (!b) return;
    const when = b.when.map((c, k) => {
      if (k !== j) return c;
      const neu: CarryCondition = { ...c, ...teil };
      for (const key of ['is', 'min', 'max'] as const) if (neu[key] === undefined) delete neu[key];
      return neu;
    });
    this.block(i, { when });
  }

  protected wertKippen(i: number, j: number, w: string, an: boolean): void {
    const c = this.entwurf()?.blocks[i]?.when[j];
    if (!c) return;
    const is = an ? [...new Set([...(c.is ?? []), w])] : (c.is ?? []).filter((x) => x !== w);
    this.bedingung(i, j, { is: is.length ? is : undefined });
  }

  protected bedingungWeg(i: number, j: number): void {
    const b = this.entwurf()?.blocks[i];
    if (b) this.block(i, { when: b.when.filter((_, k) => k !== j) });
  }

  protected vorlage(i: number, teil: Partial<Vorlage>): void {
    const d = this.entwurf();
    if (!d) return;
    const v = { ...d.vorlagen[i]!, ...teil };
    if (teil.name !== undefined) v.name = teil.name.trim();
    this.setze({ vorlagen: d.vorlagen.map((w, j) => (j === i ? v : w)) });
  }

  protected vorlageNeu(): void {
    const d = this.entwurf();
    if (!d) return;
    let name = 'New container';
    for (let k = 2; d.vorlagen.some((v) => v.name === name); k++) name = `New container ${k}`;
    this.setze({ vorlagen: [...d.vorlagen, { name, rows: openRows(4, 3), zones: [] }] });
    this.aufklappen(`v:${d.vorlagen.length}`, true);
  }

  protected vorlageWeg(i: number): void {
    const d = this.entwurf();
    if (d) this.setze({ vorlagen: d.vorlagen.filter((_, j) => j !== i) });
  }

  protected readonly platzNamen = computed(() => Object.keys(this.entwurf()?.plaetze ?? {}));

  protected platz(p: string, stufe: string): void {
    const d = this.entwurf();
    if (d) this.setze({ plaetze: { ...d.plaetze, [p]: stufe } });
  }

  protected zuruecksetzen(): void {
    this.fehler.set('');
    this.lies(this.settings());
  }

  protected async speichern(): Promise<void> {
    const d = this.entwurf();
    if (!d) return;
    const namen = d.vorlagen.map((v) => v.name);
    if (namen.some((n) => !n) || new Set(namen).size !== namen.length) {
      this.fehler.set('Every template needs a name of its own.');
      return;
    }
    this.laeuft.set(true);
    this.fehler.set('');
    /* Alles andere in den Einstellungen bleibt, wie es ist; nur die
       Vorlagen werden ganz ersetzt, damit eine gelöschte auch weg ist.
       `carrySquares`/`carryZones` bleiben stehen: sie gelten nur, solange
       es kein `carrySheet` gibt (REQ-356). */
    const neu: Record<string, string> = Object.fromEntries(Object.entries(this.settings()).filter(([k]) => !k.startsWith(VORLAGE)));
    neu['carrySheet'] = formatCarrySheet({ blocks: d.blocks });
    neu['handActions'] = formatPairs({ drop: d.hand.drop, stow: d.hand.stow });
    /* Ein Platz ohne Stufe bleibt in der Liste, sonst verschwände er aus der Auswahl. */
    neu['slotDraw'] = Object.entries(d.plaetze).map(([k, v]) => `${k}:${v || '-'}`).join(', ');
    neu['inventoryCols'] = String(d.cols);
    neu['inventoryRows'] = String(d.rows);
    for (const v of d.vorlagen) neu[`${VORLAGE}${v.name}`] = formatContainerTemplate({ rows: v.rows, zones: v.zones });
    try {
      await this.bestand.registerSchreiben('settings', neu);
      this.lies(neu);
      this.gespeichert.set(true);
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }
}
