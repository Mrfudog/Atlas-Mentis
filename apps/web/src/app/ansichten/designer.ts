import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  appliesHolds,
  appliesText,
  entityName,
  findElement,
  freeElementId,
  insertElement,
  isContainer,
  isDesignedView,
  layoutFor,
  moveTree,
  patchElement,
  pathEndType,
  pathOptions,
  pathText,
  primaryInterface,
  typeChain,
  typeList,
} from '@nw/model';
import type { Entity, IncomingEdge, LayoutElement, LayoutWhen, ViewApplies, ViewDef, ViewPathStep } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from '../register/arbeit';
import { techName } from '../register/regeln';
import { Ansichtsbaum } from './baum';
import { GRUPPEN, PALETTE, eintrag } from './palette';

/** Eine Zeile des Baums, flach gezeichnet mit Einzug. */
interface Zeile {
  el: LayoutElement;
  tiefe: number;
  icon: string;
  name: string;
  sum: string;
}

type Speichern = 'this' | 'article' | 'condition';

/**
 * **Der Ansichtsdesigner** (T-268, E-103): eine Ansicht als Baum aus
 * Elementen — Palette, Struktur mit ← → ↑ ×, Konfiguration des gewählten
 * Elements, seine Werte (auch über Kanten) — und ihre Geltung. Im Register
 * mit Vorschau an einem Beispielartikel oben; am Artikel als Leiste
 * (`kompakt`), deren Entwurf die Seite gleich zeichnet.
 *
 * Gespeichert wird eine Registerzeile (`views`), über `RegisterArbeit` wie
 * jede andere — der Server prüft Recht und Form. Die Ansichten der Orte
 * (Overview, Quick, Full, Print) bleiben, wie sie sind: aus ihnen entsteht
 * hier eine **neue** Ansicht, geändert werden sie unter Registry › Views.
 */
@Component({
  selector: 'nw-ansichtsdesigner',
  imports: [RouterLink, Ansichtsbaum],
  templateUrl: './designer.html',
  styleUrl: './designer.scss',
})
export class Ansichtsdesigner {
  /** Die Ansicht, die bearbeitet wird; `null` legt eine neue an. */
  readonly schluessel = input<string | null>(null);
  /** Der Artikel, an dem gestaltet wird (Leiste am Artikel). */
  readonly beispiel = input<Entity | null>(null);
  readonly kompakt = input(false);
  /** Der Entwurf, sobald er sich ändert — die Artikelseite zeichnet ihn. */
  readonly entwurf = output<LayoutElement[]>();
  /** Gespeichert (Schlüssel) oder verworfen (`null`). */
  readonly fertig = output<string | null>();

  protected readonly bestand = inject(Bestand);
  protected readonly arbeit = inject(RegisterArbeit);

  protected readonly palette = PALETTE;
  protected readonly gruppen = GRUPPEN;

  protected readonly label = signal('');
  protected readonly gruppe = signal('');
  protected readonly geltung = signal<ViewApplies>({});
  protected readonly baum = signal<LayoutElement[]>([]);
  protected readonly gewaehlt = signal<string | null>(null);
  protected readonly speichernAls = signal<Speichern>('this');
  protected readonly wertSuche = signal('');
  /** Der Beispielartikel im Register — über die Suche gewählt. */
  protected readonly beispielId = signal<string | null>(null);
  protected readonly beispielSuche = signal('');
  protected readonly beispielTreffer = signal<{ id: string; name: string; type: string }[]>([]);

  protected readonly reg = this.bestand.registry;
  protected readonly def = computed<ViewDef | undefined>(() => {
    const k = this.schluessel();
    return k ? this.reg()?.views[k] : undefined;
  });
  /** Eine Ansicht der Orte oder eine eigene ohne Geltung: daraus entsteht eine neue. */
  protected readonly ausVorlage = computed(() => !!this.schluessel() && !isDesignedView(this.def()));

  protected readonly probe = computed<Entity | null>(() => {
    const b = this.beispiel();
    if (b) return b;
    const id = this.beispielId();
    return id ? (this.bestand.voll().get(id) ?? null) : null;
  });
  protected readonly probeName = computed(() => {
    const e = this.probe();
    return e ? entityName(e) : '';
  });
  protected readonly probeRueck = computed<IncomingEdge[]>(() => {
    const e = this.probe();
    if (!e) return [];
    return (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props }));
  });
  protected readonly probeTyp = computed(() => {
    const e = this.probe();
    return e ? primaryInterface(e) : (this.geltung().types?.[0] ?? '');
  });
  protected readonly gilt = computed(() => {
    const e = this.probe();
    const r = this.reg();
    return e && r ? appliesHolds(r, this.geltung(), e, this.probeRueck()) : null;
  });

  constructor() {
    /* Eine andere Ansicht gewählt: der Entwurf fängt bei ihr an. */
    effect(() => {
      const k = this.schluessel();
      const def = this.def();
      const typ = untracked(() => this.probeTyp());
      untracked(() => {
        const r = this.reg();
        if (!r) return;
        this.label.set(def ? (isDesignedView(def) ? def.label : `${def.label} (designed)`) : 'New view');
        this.gruppe.set(def ? (def.group ?? k ?? '') : 'quick');
        this.geltung.set(structuredClone(def?.applies ?? (typ ? { types: [typ] } : {})));
        const start = def ? (isDesignedView(def) ? (def.layout ?? []) : k && typ ? layoutFor(r, k, typ).layout : (def.layout ?? [])) : [];
        this.baum.set(structuredClone(start));
        this.gewaehlt.set(null);
        this.speichernAls.set(def && isDesignedView(def) ? 'this' : this.beispiel() ? 'article' : 'condition');
        if (def?.applies?.article && !this.beispiel()) this.waehleBeispiel(def.applies.article);
      });
    });
    effect(() => this.entwurf.emit(this.baum()));
  }

  // ------------------------------------------------------------ Baum

  protected readonly zeilen = computed<Zeile[]>(() => {
    const raus: Zeile[] = [];
    const geh = (l: readonly LayoutElement[], tiefe: number): void => {
      for (const el of l) {
        const p = eintrag(el.el);
        raus.push({ el, tiefe, icon: p?.icon ?? '·', name: p?.name ?? el.el, sum: this.summe(el) });
        if (el.children) geh(el.children, tiefe + 1);
      }
    };
    geh(this.baum(), 0);
    return raus;
  });

  private summe(el: LayoutElement): string {
    const teile: string[] = [];
    if (el.text) teile.push(`“${el.text}”`);
    if (el.path?.length) teile.push(pathText(el.path));
    if (Array.isArray(el.fields)) teile.push(el.fields.join(', '));
    else if (el.fields === 'all') teile.push('all fields');
    if (el.props?.length) teile.push(`edge: ${el.props.join(', ')}`);
    if (el.columns) teile.push(`${el.columns} columns`);
    if (el.children) teile.push(`${el.children.length} inside`);
    return teile.join(' · ');
  }

  protected readonly auswahl = computed(() => {
    const id = this.gewaehlt();
    return id ? (findElement(this.baum(), id) ?? null) : null;
  });

  protected dazu(el: string): void {
    const p = eintrag(el);
    const neu: LayoutElement = { id: freeElementId(this.baum(), el), el: el as LayoutElement['el'] };
    if (p && isContainer(neu)) neu.children = [];
    if (el === 'section' || el === 'collapsible') neu.text = p?.name ?? '';
    if (p?.werte && el !== 'reader') neu.fields = [];
    this.baum.set(insertElement(this.baum(), neu, this.gewaehlt()));
    this.gewaehlt.set(neu.id);
  }

  protected bewege(id: string, op: 'out' | 'into' | 'up' | 'remove', ev?: Event): void {
    ev?.stopPropagation();
    this.baum.set(moveTree(this.baum(), id, op));
    if (op === 'remove' && this.gewaehlt() === id) this.gewaehlt.set(null);
  }

  protected setze(patch: Partial<Record<keyof LayoutElement, unknown>>): void {
    const id = this.gewaehlt();
    if (id) this.baum.set(patchElement(this.baum(), id, patch));
  }

  protected elementName(el: LayoutElement): string {
    return eintrag(el.el)?.name ?? el.el;
  }
  protected istBehaelter(el: LayoutElement): boolean {
    return isContainer(el);
  }
  protected nimmtWerte(el: LayoutElement): boolean {
    return !!eintrag(el.el)?.werte;
  }

  // ------------------------------------------------------------ Werte

  /** Die Art, an der die Werte des gewählten Elements gelesen werden — am Ende seines Pfads. */
  protected readonly endTyp = computed(() => {
    const el = this.auswahl();
    return pathEndType(this.probeTyp(), el?.path);
  });
  protected readonly pfadText = computed(() => pathText(this.auswahl()?.path, this.probeTyp() || 'this article'));
  protected readonly weiter = computed(() => {
    const r = this.reg();
    const t = this.endTyp();
    return r && t ? pathOptions(r, t) : [];
  });

  /** Was als Wert dazukommen kann: je Typ der Kette die ganze Gruppe und jedes Feld. */
  protected readonly verfuegbar = computed(() => {
    const r = this.reg();
    const t = this.endTyp();
    const el = this.auswahl();
    if (!r || !t || !el) return [];
    const schon = new Set(Array.isArray(el.fields) ? el.fields : []);
    const q = this.wertSuche().trim().toLocaleLowerCase();
    const raus: { ref: string; von: string }[] = [];
    for (const typ of typeChain(r, t)) {
      const props = Object.entries(r.interfaces[typ]?.schema?.properties ?? {});
      if (!props.length) continue;
      raus.push({ ref: typ, von: `all ${props.length} fields of ${r.interfaces[typ]?.label ?? typ}` });
      for (const [key, prop] of props) raus.push({ ref: `${typ}.${key}`, von: prop.title ?? key });
    }
    return raus.filter((x) => !schon.has(x.ref) && (!q || x.ref.toLocaleLowerCase().includes(q) || x.von.toLocaleLowerCase().includes(q))).slice(0, 40);
  });

  protected wertDazu(ref: string): void {
    const el = this.auswahl();
    if (!el) return;
    const alt = Array.isArray(el.fields) ? el.fields : [];
    this.setze({ fields: [...alt, ref] });
  }
  protected wertWeg(ref: string): void {
    const el = this.auswahl();
    if (!el || !Array.isArray(el.fields)) return;
    this.setze({ fields: el.fields.filter((f) => f !== ref) });
  }
  protected schritt(i: string): void {
    const o = this.weiter()[Number(i)];
    const el = this.auswahl();
    if (!o || !el) return;
    /* Ein neuer Schritt: die Werte gehören jetzt einer anderen Art. */
    this.setze({ path: [...(el.path ?? []), o.step], fields: [] });
  }
  protected schrittWeg(): void {
    const el = this.auswahl();
    if (!el?.path?.length) return;
    const p = el.path.slice(0, -1);
    this.setze({ path: p.length ? p : null, fields: [] });
  }
  protected kantenProps(): string[] {
    const el = this.auswahl();
    const letzte: ViewPathStep | undefined = el?.path?.[el.path.length - 1];
    const def = letzte ? this.reg()?.relations[letzte.relation] : undefined;
    return Object.keys(def?.props?.properties ?? {});
  }
  protected propUmschalten(p: string): void {
    const el = this.auswahl();
    const alt = el?.props ?? [];
    this.setze({ props: alt.includes(p) ? alt.filter((x) => x !== p) : [...alt, p] });
  }

  // ------------------------------------------------------------ Geltung

  protected readonly alleTypen = computed(() => {
    const r = this.reg();
    return r ? typeList(r).filter((t) => !r.interfaces[t]?.abstract) : [];
  });
  protected readonly alleKanten = computed(() =>
    Object.values(this.reg()?.relations ?? {})
      .map((d) => ({ type: d.type, label: d.label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en')),
  );
  protected readonly geltungText = computed(() => appliesText(this.geltung(), (id) => this.bestand.name()(id)));

  protected typDazu(t: string): void {
    if (!t) return;
    const g = this.geltung();
    this.geltung.set({ ...g, types: [...new Set([...(g.types ?? []), t])] });
  }
  protected typWeg(t: string): void {
    const g = { ...this.geltung() };
    g.types = (g.types ?? []).filter((x) => x !== t);
    if (!g.types.length) delete g.types;
    this.geltung.set(g);
  }
  protected bedingungDazu(): void {
    const g = this.geltung();
    this.geltung.set({ ...g, where: [...(g.where ?? []), { incoming: '' }] });
  }
  protected bedingungSetzen(i: number, art: string, wert: string, werte = ''): void {
    const g = structuredClone(this.geltung());
    const w: LayoutWhen =
      art === 'field'
        ? { field: wert, ...(werte.trim() ? { has: werte.split(',').map((x) => x.trim()).filter(Boolean) } : {}) }
        : art === 'relation'
          ? { relation: wert }
          : { incoming: wert };
    (g.where ??= [])[i] = w;
    this.geltung.set(g);
  }
  protected bedingungWeg(i: number): void {
    const g = structuredClone(this.geltung());
    g.where = (g.where ?? []).filter((_, j) => j !== i);
    if (!g.where.length) delete g.where;
    this.geltung.set(g);
  }
  protected bedingungsArt(w: LayoutWhen): string {
    return w.field !== undefined ? 'field' : w.relation !== undefined ? 'relation' : 'incoming';
  }
  protected artikelWeg(): void {
    const g = { ...this.geltung() };
    delete g.article;
    this.geltung.set(g);
  }
  protected readonly felderDerTypen = computed(() => {
    const r = this.reg();
    if (!r) return [];
    const typen = this.geltung().types?.length ? this.geltung().types! : this.probeTyp() ? [this.probeTyp()] : [];
    const raus = new Set<string>();
    for (const t of typen) for (const c of typeChain(r, t)) for (const k of Object.keys(r.interfaces[c]?.schema?.properties ?? {})) raus.add(`${c}.${k}`);
    return [...raus].sort();
  });

  // ------------------------------------------------------------ Beispiel

  protected async sucheBeispiel(q: string): Promise<void> {
    this.beispielSuche.set(q);
    if (q.trim().length < 2) {
      this.beispielTreffer.set([]);
      return;
    }
    try {
      const l = await this.bestand.liste({ q, limit: 8, type: this.geltung().types?.[0] });
      this.beispielTreffer.set(l.rows.map((z) => ({ id: z.id, name: z.name, type: z.type })));
    } catch {
      this.beispielTreffer.set([]);
    }
  }
  protected waehleBeispiel(id: string): void {
    this.beispielId.set(id);
    this.beispielTreffer.set([]);
    void this.bestand.oeffnen(id, false, true);
  }

  // ------------------------------------------------------------ Speichern

  protected readonly darf = computed(() => !!this.reg());

  protected async speichern(): Promise<void> {
    const r = this.reg();
    if (!r) return;
    const als = this.ausVorlage() || !this.schluessel() ? (this.speichernAls() === 'this' ? 'condition' : this.speichernAls()) : this.speichernAls();
    const probe = this.probe();
    let applies: ViewApplies = structuredClone(this.geltung());
    if (als === 'article') {
      if (!probe) {
        this.arbeit.fehler.set('Pick an article first.');
        return;
      }
      applies = { types: [primaryInterface(probe)], article: probe.id };
    } else if (als === 'condition') {
      delete applies.article;
    }
    applies.where = (applies.where ?? []).filter((w) => w.field || w.relation || w.incoming);
    if (!applies.where.length) delete applies.where;
    const label = this.label().trim() || 'View';
    const gruppe = this.gruppe().trim() || techName(label, {}, true);
    let key = this.schluessel();
    if (als !== 'this' || !key) key = techName(als === 'article' && probe ? `${label} ${entityName(probe)}` : label, r.views, true);
    const def: ViewDef = {
      ...(als === 'this' && this.def() ? structuredClone(this.def()!) : { fields: 'all' as const }),
      label: als === 'article' && probe && !this.label().includes(entityName(probe)) ? `${label} · ${entityName(probe)}` : label,
      group: gruppe,
      applies,
      layout: this.baum(),
    };
    const fest = key;
    const ok = await this.arbeit.aendern('views', (views) => {
      def.order ??= Math.max(0, ...Object.values(views).map((v) => v.order ?? 0)) + 1;
      views[fest] = def;
    });
    if (ok) this.fertig.emit(fest);
  }

  protected async loeschen(): Promise<void> {
    const k = this.schluessel();
    if (!k || !isDesignedView(this.def())) return;
    const ok = await this.arbeit.aendern('views', (views) => {
      delete views[k];
    });
    if (ok) this.fertig.emit(null);
  }

  protected istListe(x: unknown): x is string[] {
    return Array.isArray(x);
  }

  protected optionWert(ev: Event): string {
    return (ev.target as HTMLSelectElement | HTMLInputElement).value;
  }
}
