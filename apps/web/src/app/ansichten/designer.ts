import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PLACE_VIEWS,
  TAB_NODE,
  adjustFrom,
  appliesHolds,
  appliesText,
  canMove,
  entityName,
  findElement,
  freeElementId,
  holdsChildren,
  insertElement,
  isAdjust,
  isDesignedView,
  layoutFor,
  moveToElement,
  moveTree,
  ownLayout,
  patchElement,
  pathEndType,
  pathOptions,
  pathText,
  primaryInterface,
  tabsAsTree,
  treeAsTabs,
  typeChain,
  typeList,
  viewKeys,
  whenText,
} from '@nw/model';
import type { Entity, IncomingEdge, LayoutElement, LayoutWhen, Registry, TreeMove, ViewApplies, ViewDef, ViewPathStep } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from '../register/arbeit';
import { techName } from '../register/regeln';
import { RegVorschau } from '../register/vorschau';
import { Ansichtsbaum } from './baum';
import { GRUPPEN, ORTE, PALETTE, eintrag, eintragText } from './palette';
import { anpassungLeer, ansichtsTeile, sagtEigenes } from './uebersicht';

/** Eine Zeile des Baums, flach gezeichnet mit Einzug. */
interface Zeile {
  el: LayoutElement;
  tiefe: number;
  icon: string;
  name: string;
  sum: string;
  kinder: number;
  zu: boolean;
}

/**
 * **Wohin gespeichert wird** (T-276, E-103) — die eine Frage beim
 * Speichern: die Ansicht selbst (jeder Artikel), der ganze Typ (eigene
 * Anordnung oder angepasst), diese gestaltete Ansicht, nur dieser Artikel,
 * oder eine neue Ansicht mit Bedingungen.
 */
export type Speichern = 'view' | 'type' | 'this' | 'article' | 'condition';

/** Was der Designer der Seite gibt, an der er gestaltet: den Entwurf, und wie er zu zeichnen ist. */
export interface AnsichtsEntwurf {
  /** Der Baum in gespeicherter Form (Reiter als `tabs`). */
  baum: LayoutElement[];
  /** Als gestaltete Ansicht (eigener Zeichner), sonst wie die Seite die Ansicht zeichnet. */
  gestaltet: boolean;
  /** Das Register, wie es mit dem Entwurf wäre — für die Seite und die Vorschau. */
  register: Registry | null;
}

/**
 * **Der Ansichtseditor** (T-268, T-276, E-103) — seit T-276 der einzige:
 * Registry › Views, „Design" an der Typseite und „Design this view" am
 * Artikel öffnen ihn. Eine Ansicht als Baum aus Elementen: Palette nach
 * Sorte, Struktur mit Einzug (← → ↑ ↓ ×, zuklappbar, Ziehen als Zusatz),
 * rechts Konfiguration und Werte des gewählten Elements (auch über Kanten),
 * oben die Vorschau an einem Beispielartikel.
 *
 * Was die alten Editoren konnten, steht hier: Name, Reihenfolge, `rest`,
 * `empty`, der Löschschutz der Ansichten der Orte (`PLACE_VIEWS`), die
 * Anordnung einer Art — eigene oder **angepasst** (nur die Abweichung,
 * `adjustFrom`) —, „Leave out", „Only when", Reiter und JSON.
 *
 * Gespeichert wird eine Registerzeile über `RegisterArbeit` (`views` oder
 * `interfaces`) — der Server prüft Recht und Form.
 */
@Component({
  selector: 'nw-ansichtsdesigner',
  imports: [RouterLink, Ansichtsbaum, RegVorschau],
  templateUrl: './designer.html',
  styleUrl: './designer.scss',
})
export class Ansichtsdesigner {
  /** Die Ansicht, die bearbeitet wird; `null` legt eine neue an. */
  readonly schluessel = input<string | null>(null);
  /** Der Typ, für den gestaltet wird (von der Typseite oder vom Artikel). */
  readonly typ = input<string | null>(null);
  /** Der Artikel, an dem gestaltet wird (Leiste am Artikel). */
  readonly beispiel = input<Entity | null>(null);
  readonly kompakt = input(false);
  /** Darf das Register ändern; sonst nur lesen. */
  readonly darf = input(true);
  /** Der Entwurf, sobald er sich ändert — die Artikelseite zeichnet ihn. */
  readonly entwurf = output<AnsichtsEntwurf>();
  /** Gespeichert (Schlüssel) oder verworfen (`null`). */
  readonly fertig = output<string | null>();
  /** Am Artikel: eine andere Ansicht gestalten — auch eine, die hier noch nicht gilt. */
  readonly wechsel = output<string>();

  protected readonly bestand = inject(Bestand);
  protected readonly arbeit = inject(RegisterArbeit);

  protected readonly palette = PALETTE;
  protected readonly gruppen = GRUPPEN;

  protected readonly label = signal('');
  protected readonly gruppe = signal('');
  protected readonly order = signal<number | null>(null);
  protected readonly rest = signal(false);
  protected readonly leer = signal(false);
  protected readonly geltung = signal<ViewApplies>({});
  /** Der Baum im Designer: Reiter als Knoten (`tabsAsTree`). */
  protected readonly baum = signal<LayoutElement[]>([]);
  protected readonly gewaehlt = signal<string | null>(null);
  /** Zugeklappte Unterbäume, nach Id. */
  protected readonly zu = signal<ReadonlySet<string>>(new Set());
  protected readonly speichernAls = signal<Speichern>('view');
  /** Für „jeder Artikel dieses Typs": welcher (T-318: vorgewählt der, von dem man kommt). */
  protected readonly zielTyp = signal('');
  /** Fest: die eigene Anordnung des Typs, auch wo eine Anpassung reichte — er folgt der
   *  allgemeinen Ansicht dann nicht mehr. Sonst wird angepasst, wo es geht (T-318). */
  protected readonly fest = signal(false);
  /** Die Suche in den Elementen (T-318): die Palette ist lang. */
  protected readonly elementSuche = signal('');
  /** Was eine Anpassung nie zeigt (`LayoutAdjust.hide`). */
  protected readonly versteckt = signal<string[]>([]);
  protected readonly wertSuche = signal('');
  /** Wohin „+ value" schreibt: in die Werte oder unter „Leave out". */
  protected readonly wertZiel = signal<'fields' | 'except'>('fields');
  protected readonly gezogen = signal<string | null>(null);
  /** Der Beispielartikel im Register — über die Suche gewählt. */
  protected readonly beispielId = signal<string | null>(null);
  protected readonly beispielSuche = signal('');
  protected readonly beispielTreffer = signal<{ id: string; name: string; type: string }[]>([]);

  protected readonly reg = this.bestand.registry;
  protected readonly def = computed<ViewDef | undefined>(() => {
    const k = this.schluessel();
    return k ? this.reg()?.views[k] : undefined;
  });
  /** Eine gestaltete Ansicht (mit Gruppe oder Geltung), oder eine neue. */
  protected readonly gestaltet = computed(() => !this.schluessel() || isDesignedView(this.def()));
  /** Die Ansichten der Orte lassen sich umbauen, nicht löschen. */
  protected readonly ortsansicht = computed(() => (PLACE_VIEWS as readonly string[]).includes(this.schluessel() ?? ''));
  protected readonly ort = computed(() => {
    const k = this.schluessel();
    return k ? (ORTE[k] ?? (this.gestaltet() ? '' : 'Your own view: chosen on a board tile and when printing.')) : '';
  });
  /** Gespeichert wird als gestaltete Ansicht (eigener Zeichner). */
  protected readonly alsGestaltet = computed(() => ['this', 'article', 'condition'].includes(this.speichernAls()));

  protected readonly alleAnsichten = computed(() => {
    const r = this.reg();
    return r ? viewKeys(r).map((k) => ({ key: k, label: r.views[k]?.label ?? k })) : [];
  });

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
    return e ? primaryInterface(e) : (this.typ() ?? this.geltung().types?.[0] ?? '');
  });
  /** Der Typ, bei dem der Entwurf anfängt — ein Name, damit ein neu geladener Artikel ihn nicht neu beginnt. */
  private readonly startTyp = computed(() => {
    const b = this.beispiel();
    return this.typ() ?? (b ? primaryInterface(b) : null);
  });
  /** Der Baum in gespeicherter Form — für den Zeichner gestalteter Ansichten. */
  protected readonly entwurfsBaum = computed(() => treeAsTabs(this.baum()));
  protected readonly gilt = computed(() => {
    const e = this.probe();
    const r = this.reg();
    return e && r && this.alsGestaltet() ? appliesHolds(r, this.geltung(), e, this.probeRueck()) : null;
  });

  constructor() {
    /* Eine andere Ansicht (oder ein anderer Typ) gewählt: der Entwurf fängt bei dem an, was dort gilt. */
    effect(() => {
      const k = this.schluessel();
      const t = this.startTyp();
      const r = this.reg();
      if (!r) return;
      untracked(() => this.beginne(r, k, t));
    });
    effect(() => this.entwurf.emit({ baum: this.entwurfsBaum(), gestaltet: this.alsGestaltet(), register: this.entwurfsRegister() }));
  }

  private beginne(r: Registry, k: string | null, t: string | null): void {
    const def = k ? r.views[k] : undefined;
    this.gewaehlt.set(null);
    this.zu.set(new Set());
    this.label.set(def?.label ?? 'New view');
    this.order.set(def?.order ?? null);
    this.rest.set(!!def?.rest);
    this.leer.set(def?.empty === 'show');
    this.versteckt.set([]);
    this.zielTyp.set(t ?? '');
    this.fest.set(false);
    if (!def || isDesignedView(def)) {
      this.gruppe.set(def ? (def.group ?? k ?? '') : 'quick');
      this.geltung.set(structuredClone(def?.applies ?? (t ? { types: [t] } : {})));
      this.baum.set(tabsAsTree(structuredClone(def?.layout ?? [])));
      this.speichernAls.set(def ? 'this' : this.beispiel() ? 'article' : 'condition');
      if (def?.applies?.article && !this.beispiel()) this.waehleBeispiel(def.applies.article);
      return;
    }
    /* Eine Ansicht ohne Geltung: was für diesen Typ gilt — von ihm, einem Obertyp oder der Ansicht.
       **Kommt man von einem Typ, ändert man diesen Typ** (T-318): vorgewählt ist er selbst,
       auch wenn er noch nichts Eigenes sagt — sonst landete die Änderung in der Ansicht und
       damit an jedem Artikel. */
    this.gruppe.set(k!);
    this.geltung.set(t ? { types: [t] } : {});
    if (t && r.interfaces[t]) {
      const eigen = r.interfaces[t]?.views?.[k!];
      this.zielTyp.set(t);
      this.fest.set(ownLayout(eigen) && !isAdjust(eigen));
      if (isAdjust(eigen)) this.versteckt.set([...(eigen.adjust.hide ?? [])]);
      this.speichernAls.set('type');
      this.baum.set(tabsAsTree(structuredClone(layoutFor(r, k!, t).layout)));
    } else {
      this.speichernAls.set('view');
      this.baum.set(tabsAsTree(structuredClone(def.layout ?? [])));
    }
  }

  // ------------------------------------------------------------ Baum

  protected readonly zeilen = computed<Zeile[]>(() => {
    const raus: Zeile[] = [];
    const zu = this.zu();
    const geh = (l: readonly LayoutElement[], tiefe: number): void => {
      for (const el of l) {
        const p = eintrag(el.el);
        const kinder = el.children?.length ?? 0;
        raus.push({ el, tiefe, icon: p?.icon ?? '·', name: p?.name ?? el.el, sum: this.summe(el), kinder, zu: zu.has(el.id) });
        if (el.children && !zu.has(el.id)) geh(el.children, tiefe + 1);
      }
    };
    geh(this.baum(), 0);
    return raus;
  });

  private summe(el: LayoutElement): string {
    const r = this.reg();
    const teile: string[] = [];
    if (el.text) teile.push(`“${el.text}”`);
    if (el.path?.length) teile.push(pathText(el.path));
    if (Array.isArray(el.fields)) teile.push(el.fields.map((f) => eintragText(r, f)).join(', ') || 'nothing yet');
    else if (el.fields === 'all') teile.push('all fields');
    if (el.except?.length) teile.push(`but ${el.except.join(', ')}`);
    if (el.props?.length) teile.push(`edge: ${el.props.join(', ')}`);
    if (el.columns) teile.push(`${el.columns} columns`);
    if (el.when) teile.push(`only when ${whenText(el.when)}`);
    return teile.join(' · ');
  }

  protected readonly auswahl = computed(() => {
    const id = this.gewaehlt();
    return id ? (findElement(this.baum(), id) ?? null) : null;
  });

  protected dazu(el: string): void {
    if (!el) return;
    const p = eintrag(el);
    const neu: LayoutElement = { id: freeElementId(this.baum(), el), el: el as LayoutElement['el'] };
    if (p && holdsChildren(neu)) neu.children = [];
    if (el === 'section' || el === 'collapsible') neu.text = p?.name ?? '';
    if (el === 'tabs') neu.children = [{ id: freeElementId(this.baum(), 'tab'), el: 'tab' as LayoutElement['el'], text: 'Tab', children: [] }];
    if (el === 'prose') neu.fields = 'all';
    else if (p?.werte && el !== 'reader') neu.fields = [];
    this.baum.set(insertElement(this.baum(), neu, this.gewaehlt()));
    this.gewaehlt.set(neu.id);
  }

  protected reiterDazu(): void {
    const el = this.auswahl();
    if (el?.el !== 'tabs') return;
    const neu: LayoutElement = { id: freeElementId(this.baum(), 'tab'), el: 'tab' as LayoutElement['el'], text: 'Tab', children: [] };
    this.baum.set(insertElement(this.baum(), neu, el.id));
  }

  protected kann(id: string, op: TreeMove): boolean {
    return canMove(this.baum(), id, op);
  }

  protected bewege(id: string, op: TreeMove, ev?: Event): void {
    ev?.stopPropagation();
    this.baum.set(moveTree(this.baum(), id, op));
    if (op === 'remove' && this.gewaehlt() === id) this.gewaehlt.set(null);
  }

  protected umklappen(id: string, ev?: Event): void {
    ev?.stopPropagation();
    const z = new Set(this.zu());
    if (z.has(id)) z.delete(id);
    else z.add(id);
    this.zu.set(z);
  }

  /** Ziehen: auf einen Behälter hinein, sonst dahinter. */
  protected fallen(ziel: LayoutElement, ev: DragEvent): void {
    ev.preventDefault();
    const id = this.gezogen();
    this.gezogen.set(null);
    if (!id) return;
    const vorher = this.baum();
    let neu = holdsChildren(ziel) ? moveToElement(vorher, id, ziel.id, 'into') : vorher;
    if (neu === vorher || JSON.stringify(neu) === JSON.stringify(vorher)) neu = moveToElement(vorher, id, ziel.id, 'after');
    this.baum.set(neu);
  }

  protected setze(patch: Partial<Record<keyof LayoutElement, unknown>>): void {
    const id = this.gewaehlt();
    if (id) this.baum.set(patchElement(this.baum(), id, patch));
  }

  protected elementName(el: LayoutElement): string {
    return eintrag(el.el)?.name ?? el.el;
  }
  protected elementTip(el: LayoutElement): string {
    return eintrag(el.el)?.tip ?? '';
  }
  protected nurSeite(el: LayoutElement): boolean {
    return !!eintrag(el.el)?.seite;
  }
  protected nimmtWerte(el: LayoutElement): boolean {
    return !!eintrag(el.el)?.werte;
  }
  protected mitTitel(el: LayoutElement): boolean {
    return ['heading', 'text', 'section', 'collapsible', 'carousel', 'edgeTable', TAB_NODE].includes(el.el);
  }
  protected istReiter(el: LayoutElement): boolean {
    return (el.el as string) === TAB_NODE;
  }

  // ------------------------------------------------------------ Werte

  /** Die Art, an der die Werte des gewählten Elements gelesen werden — am Ende seines Pfads. */
  protected readonly endTyp = computed(() => pathEndType(this.probeTyp(), this.auswahl()?.path));
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
    if (!r || !el) return [];
    const schon = new Set(this.wertZiel() === 'fields' ? (Array.isArray(el.fields) ? el.fields : []) : (el.except ?? []));
    const q = this.wertSuche().trim().toLocaleLowerCase();
    /* Ohne Beispiel und ohne Typ: jeder Typ mit Feldern. */
    const typen = t ? typeChain(r, t) : typeList(r);
    const raus: { ref: string; von: string }[] = [];
    for (const typ of typen) {
      const props = Object.entries(r.interfaces[typ]?.schema?.properties ?? {});
      if (!props.length) continue;
      raus.push({ ref: typ, von: `all ${props.length} fields of ${r.interfaces[typ]?.label ?? typ} — new ones come by themselves` });
      for (const [key, prop] of props) raus.push({ ref: `${typ}.${key}`, von: prop.title ?? key });
    }
    return raus.filter((x) => !schon.has(x.ref) && (!q || x.ref.toLocaleLowerCase().includes(q) || x.von.toLocaleLowerCase().includes(q))).slice(0, 40);
  });

  protected wertDazu(ref: string): void {
    const el = this.auswahl();
    if (!el) return;
    if (this.wertZiel() === 'except') {
      this.setze({ except: [...new Set([...(el.except ?? []), ref])] });
      return;
    }
    const alt = Array.isArray(el.fields) ? el.fields : [];
    this.setze({ fields: [...alt, ref] });
  }
  protected wertWeg(ref: string): void {
    const el = this.auswahl();
    if (!el || !Array.isArray(el.fields)) return;
    this.setze({ fields: el.fields.filter((f) => f !== ref) });
  }
  protected wertFrueher(i: number): void {
    const el = this.auswahl();
    if (!el || !Array.isArray(el.fields) || i < 1) return;
    const f = [...el.fields];
    [f[i - 1], f[i]] = [f[i]!, f[i - 1]!];
    this.setze({ fields: f });
  }
  protected ausnahmeWeg(ref: string): void {
    const el = this.auswahl();
    const rest = (el?.except ?? []).filter((x) => x !== ref);
    this.setze({ except: rest.length ? rest : null });
  }
  protected alleFelder(an: boolean): void {
    this.setze({ fields: an ? 'all' : [] });
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

  /** „Only when" (T-184): leer heisst immer. */
  protected wennSetzen(teil: Partial<LayoutWhen>): void {
    const el = this.auswahl();
    if (!el) return;
    const w: LayoutWhen = { ...(el.when ?? {}), ...teil };
    for (const k of Object.keys(w) as (keyof LayoutWhen)[]) if (w[k] === undefined || w[k] === '') delete w[k];
    this.setze({ when: Object.keys(w).length ? w : null });
  }
  protected liste(text: string): string[] | undefined {
    const l = text.split(',').map((x) => x.trim()).filter(Boolean);
    return l.length ? l : undefined;
  }

  // ------------------------------------------------------------ Geltung

  protected readonly alleTypen = computed(() => {
    const r = this.reg();
    return r ? typeList(r).filter((t) => !r.interfaces[t]?.abstract) : [];
  });
  /** Die Typen, an denen eine Anordnung stehen kann — auch geteilte Obertypen. */
  protected readonly anordnungsTypen = computed(() => {
    const r = this.reg();
    const t = this.probeTyp();
    return r ? (t ? typeChain(r, t) : typeList(r)) : [];
  });
  protected readonly alleKanten = computed(() =>
    Object.values(this.reg()?.relations ?? {})
      .map((d) => ({ type: d.type, label: d.label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en')),
  );
  protected readonly geltungText = computed(() => {
    if (this.speichernAls() === 'view') return 'every article (the view itself)';
    if (this.speichernAls() === 'type') return `every article of ${this.typLabel(this.zielTyp())} and its subtypes`;
    if (this.speichernAls() === 'article') return `only ${this.probeName()}`;
    return appliesText(this.geltung(), (id) => this.bestand.name()(id));
  });
  protected typLabel(t: string): string {
    return this.reg()?.interfaces[t]?.label ?? t;
  }

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
  protected versteckDazu(ref: string): void {
    if (ref) this.versteckt.update((v) => [...new Set([...v, ref])]);
  }
  protected versteckWeg(ref: string): void {
    this.versteckt.update((v) => v.filter((x) => x !== ref));
  }

  // ------------------------------------------------------------ Entwurf

  /** Die geerbte Anordnung des Zieltyps — ohne seine eigene Zeile; die Grundlage einer Anpassung. */
  private basisFuer(r: Registry, key: string, typ: string): LayoutElement[] {
    const d = r.interfaces[typ];
    if (!d) return [];
    const views = { ...(d.views ?? {}) };
    delete views[key];
    return layoutFor({ ...r, interfaces: { ...r.interfaces, [typ]: { ...d, views } } }, key, typ).layout;
  }

  /** Die Anpassung des Entwurfs, oder `null`, wenn er sich so nicht sagen lässt (oder fest gespeichert wird). */
  protected readonly anpassung = computed(() => {
    const r = this.reg();
    const k = this.schluessel();
    const t = this.zielTyp();
    if (!r || !k || !t || this.speichernAls() !== 'type' || this.fest()) return null;
    return adjustFrom(this.basisFuer(r, k, t), treeAsTabs(this.baum()), this.versteckt());
  });
  /** Wie der Typ gespeichert wird — gesagt, nicht gefragt (T-318): angepasst, wo es geht. */
  protected readonly speicherArt = computed<'adjust' | 'own' | 'general'>(() => {
    const a = this.anpassung();
    if (!a) return 'own';
    return anpassungLeer(a) ? 'general' : 'adjust';
  });
  /** Sagt der Zieltyp für diese Ansicht schon Eigenes? Dann gibt es „Use the general view". */
  protected readonly zielHatEigenes = computed(() => {
    const k = this.schluessel();
    return !!k && sagtEigenes(this.reg()?.interfaces[this.zielTyp()]?.views?.[k]);
  });
  /** Was in dieser Ansicht gilt (T-318): allgemein, je Typ, gestaltete ihrer Gruppe. */
  protected readonly teile = computed(() => {
    const r = this.reg();
    const k = this.schluessel();
    if (!r || !k || this.gestaltet()) return [];
    return ansichtsTeile(r, k, (id) => this.bestand.name()(id));
  });
  /** Die Palette nach der Suche (T-318): Name, Element und Erklärung. */
  protected readonly paletteGefiltert = computed(() => {
    const q = this.elementSuche().trim().toLocaleLowerCase();
    if (!q) return this.palette;
    return this.palette
      .map((g) => ({ ...g, items: g.items.filter((p) => [p.name, p.el, p.tip].some((x) => x?.toLocaleLowerCase().includes(q))) }))
      .filter((g) => g.items.length);
  });

  /** Die Ansichtszeile, wie sie mit dem Entwurf wäre (Name, Reihenfolge, Rest, leere Felder). */
  private zeileAusEntwurf(basis: ViewDef | undefined): ViewDef {
    const d: ViewDef = { ...(basis ? structuredClone(basis) : { fields: 'all' as const }), label: this.label().trim() || basis?.label || 'View' };
    if (this.order() !== null) d.order = this.order()!;
    if (this.rest()) d.rest = true;
    else delete d.rest;
    if (this.leer()) d.empty = 'show';
    else delete d.empty;
    return d;
  }

  /** Das Register, wie es mit dem Entwurf wäre — die Vorschau und die Seite am Artikel zeichnen daraus. */
  protected readonly entwurfsRegister = computed<Registry | null>(() => {
    const r = this.reg();
    const k = this.schluessel();
    if (!r || !k || this.alsGestaltet()) return r;
    const layout = treeAsTabs(this.baum());
    if (this.speichernAls() === 'view') return { ...r, views: { ...r.views, [k]: { ...this.zeileAusEntwurf(r.views[k]), layout } } };
    const t = this.zielTyp();
    const d = r.interfaces[t];
    if (!d) return r;
    const a = this.anpassung();
    const wert = a ? { adjust: a } : layout;
    return { ...r, interfaces: { ...r.interfaces, [t]: { ...d, views: { ...(d.views ?? {}), [k]: wert } } } };
  });

  protected readonly json = computed(() => JSON.stringify(treeAsTabs(this.baum()), null, 2));
  protected jsonSetzen(text: string): void {
    let w: unknown;
    try {
      w = JSON.parse(text);
    } catch {
      this.arbeit.fehler.set('The arrangement is not valid JSON.');
      return;
    }
    if (!Array.isArray(w)) {
      this.arbeit.fehler.set('An arrangement is a list of elements [ … ].');
      return;
    }
    this.baum.set(tabsAsTree(w as LayoutElement[]));
  }

  // ------------------------------------------------------------ Beispiel

  protected async sucheBeispiel(q: string): Promise<void> {
    this.beispielSuche.set(q);
    if (q.trim().length < 2) {
      this.beispielTreffer.set([]);
      return;
    }
    try {
      const l = await this.bestand.liste({ q, limit: 8, type: this.typ() ?? this.geltung().types?.[0] });
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

  protected async speichern(): Promise<void> {
    const r = this.reg();
    if (!r || !this.darf()) return;
    const als = this.speichernAls();
    const k = this.schluessel();
    const layout = treeAsTabs(this.baum());
    if (als === 'view' && k) {
      const zeile = { ...this.zeileAusEntwurf(r.views[k]), layout };
      const ok = await this.arbeit.aendern('views', (views) => {
        if (!views[k]) return `There is no view ${k}.`;
        views[k] = zeile;
        return undefined;
      });
      if (ok) this.fertig.emit(k);
      return;
    }
    if (als === 'type' && k) {
      const t = this.zielTyp();
      /* Angepasst, wo es geht; was eine Anpassung nicht sagen kann (ein Element in einen
         Behälter verschoben, anders eingestellt), wird die eigene Anordnung (T-318). */
      const a = this.anpassung();
      const wert = a ? { adjust: a } : layout;
      const ok = await this.arbeit.aendern('interfaces', (ifs) => {
        const d = ifs[t];
        if (!d) return `There is no type ${t}.`;
        const v = { ...(d.views ?? {}) };
        if (sagtEigenes(wert)) v[k] = wert;
        else delete v[k];
        if (Object.keys(v).length) d.views = v;
        else delete d.views;
        return undefined;
      });
      if (ok) this.fertig.emit(k);
      return;
    }
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
    let key = k;
    if (als !== 'this' || !key) key = techName(als === 'article' && probe ? `${label} ${entityName(probe)}` : label, r.views, true);
    const basis = als === 'this' && this.def() ? this.def() : k ? r.views[k] : undefined;
    const def: ViewDef = {
      ...this.zeileAusEntwurf(basis),
      label: als === 'article' && probe && !label.includes(entityName(probe)) ? `${label} · ${entityName(probe)}` : label,
      group: gruppe,
      applies,
      layout,
    };
    if (als !== 'this') delete def.order;
    const fest = key;
    const ok = await this.arbeit.aendern('views', (views) => {
      def.order ??= Math.max(0, ...Object.values(views).map((v) => v.order ?? 0)) + 1;
      views[fest] = def;
    });
    if (ok) this.fertig.emit(fest);
  }

  /** Der Typ folgt wieder der allgemeinen Ansicht (T-318): seine Zeile für sie geht. */
  protected allgemeinWieder(): void {
    const k = this.schluessel();
    const t = this.zielTyp();
    if (!k || !t || !this.darf()) return;
    this.arbeit.fragen({
      titel: `Use the general ${this.def()?.label ?? k} view for ${this.typLabel(t)}?`,
      text: [`What ${this.typLabel(t)} says for this view goes; its articles show the general view (or what a parent type says) again.`],
      ja: 'Use the general view',
      tun: async () => {
        const ok = await this.arbeit.aendern('interfaces', (ifs) => {
          const d = ifs[t];
          if (!d?.views) return undefined;
          delete d.views[k];
          if (!Object.keys(d.views).length) delete d.views;
          return undefined;
        });
        if (ok) this.fertig.emit(k);
      },
    });
  }

  /** Löschen: nie eine Ansicht der Orte; mit ihr gehen die Anordnungen der Arten für sie. */
  protected loeschen(): void {
    const k = this.schluessel();
    const r = this.reg();
    if (!k || !r || this.ortsansicht() || !this.darf()) return;
    const arten = typeList(r).filter((t) => ownLayout(r.interfaces[t]?.views?.[k]));
    this.arbeit.fragen({
      titel: `Delete the view ${this.def()?.label ?? k}?`,
      text: [
        arten.length ? `${arten.length} type(s) say their own for it (${arten.map((a) => this.typLabel(a)).join(', ')}); that goes too.` : 'No type says its own for it.',
        'Board tiles that chose it show the quick view again.',
      ],
      ja: 'Delete',
      tun: async () => {
        if (arten.length) {
          const ok = await this.arbeit.aendern('interfaces', (ifs) => {
            for (const a of arten) {
              const d = ifs[a];
              if (!d?.views) continue;
              delete d.views[k];
              if (!Object.keys(d.views).length) delete d.views;
            }
          });
          if (!ok) return;
        }
        const ok = await this.arbeit.aendern('views', (views) => {
          delete views[k];
        });
        if (ok) this.fertig.emit(null);
      },
    });
  }

  protected istListe(x: unknown): x is string[] {
    return Array.isArray(x);
  }
  protected text(r: string): string {
    return eintragText(this.reg(), r);
  }

  protected optionWert(ev: Event): string {
    return (ev.target as HTMLSelectElement | HTMLInputElement).value;
  }
}
