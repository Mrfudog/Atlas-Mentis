import { Component, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  anchorAreaOf,
  anchorsOf,
  AREA_MIN,
  areaOf,
  BOARD_TYPE,
  boardCard,
  entityName,
  INSTANCE_RELATION,
  isArea,
  isInstance,
  LAYER_RELATION,
  nextPlacement,
  PART_OF_RELATION,
  PLACED_RELATION,
  PLACEMENT_MIN,
  placementOf,
  placementsOf,
  placementView,
  primaryInterface,
  snapTo,
  isDesignedView,
  layoutFor,
  viewKeys,
  viewsFor,
  withAnchors,
} from '@nw/model';
import type { BoardAnchor, BoardPlacement, Entity, Relation } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Brett, chainAbove, isBoard, storyOf, type Mangel } from './brett';
import { Kachel } from './kachel';
import { Ansichtsbaum } from '../ansichten/baum';
import { BoardSuche } from './suche';
import { SCHNELL_KONTEXT, type SchnellKontext } from '../artikel/schnell';

interface Karte {
  rel: Relation;
  platz: BoardPlacement;
  ziel: Entity | undefined;
  /** Die Zeile aus der Liste — Name und Art stehen, bevor der ganze Artikel da ist. */
  kurz: Entity | undefined;
  ansicht: string;
  bereich: string;
  /** Der Bereich des Boards, in dem die Karte liegt (T-073) — aus der Lage. */
  liegtIn: string | null;
}

/** Ein Rechteck, das gerade auf der Leinwand gezogen wird (T-073). */
interface Rahmen {
  sx: number;
  sy: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Wie hoch ein eingeklappter Bereich ist: seine Titelzeile. */
const BEREICH_KOPF = 34;

interface Zug {
  id: string;
  art: 'schieben' | 'groesse';
  sx: number;
  sy: number;
  von: BoardPlacement;
  jetzt: BoardPlacement;
}

/** Ein Rechteck auf der Leinwand. */
interface Lage {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Ein Bereich, der gerade gezogen wird (T-146). Verschoben nimmt er seine
 * Karten mit — welche das sind, sagt die Lage beim Greifen; sonst stünden
 * sie nach dem Loslassen draussen und gehörten zu keinem Bereich mehr.
 */
interface Bzug {
  id: string;
  art: 'schieben' | 'groesse';
  sx: number;
  sy: number;
  von: Lage;
  jetzt: Lage;
}

/**
 * Ein Board (REQ-157, 158, 165, 166): eine Leinwand, auf der Artikel frei
 * liegen — nach `Board.dc.html`.
 *
 * **Was darauf liegt, sind Kanten** (`placed`) mit Ort, Grösse, Ebene und
 * vielleicht einer Ansicht, wie das Register sie erklärt. Verschieben,
 * grösser ziehen, hinlegen und wegnehmen ändern nur diese Kanten; der
 * Artikel auf der Kachel bleibt, wie er ist. Geschrieben wird das ganze
 * Board über `validateEntity` und `PUT`, nach jedem Griff — ein Board, das
 * erst auf „Speichern" wartet, verliert beim Neuladen, was man am Tisch
 * gerade umgelegt hat.
 *
 * **Die Kachel wählt ihre Ansicht** (REQ-161, CLAUDE.md „Drei Ansichten"):
 * die Platzierung, dann die Regel des Boards, dann die Grösse — flach ist
 * eine Zeile (`overview`), höher eine Karte (`quick`).
 */
@Component({
  selector: 'nw-board',
  imports: [RouterLink, Kachel, BoardSuche, Ansichtsbaum],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  /* Was aus der Suche neu angelegt wird, folgt der Ebene des Boards (T-131). */
  providers: [{ provide: SCHNELL_KONTEXT, useExisting: forwardRef(() => Board) }],
  host: {
    '(window:pointermove)': 'bewegen($event)',
    '(window:pointerup)': 'loslassen()',
    '(window:pointercancel)': 'abbrechen()',
    '(window:keydown.escape)': 'zeichnenAbbrechen()',
  },
})
export class Board implements SchnellKontext {
  readonly id = input.required<string>();

  herkunft(): Entity | null {
    return this.board() ?? null;
  }

  protected readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  private readonly brett = inject(Brett);

  constructor() {
    void this.bestand.load();
    effect(() => {
      void this.bestand.oeffnen(this.id(), false, false);
    });
    /* Die Artikel auf den Kacheln kommen erst, wenn sie auf dem Board
       liegen — ganz, aber ohne Rückbezüge; die zeigt keine Kachel. */
    effect(() => {
      /* Mit den Rückbezügen: „hat einen Shop" ist eine Kante, die auf die
         Kreatur zeigt, und gestaltete Ansichten fragen danach (T-268). */
      for (const k of this.kanten()) void this.bestand.oeffnen(k.to, false, true);
    });
    /* Was die Seitenspalte nennt (verbundene Artikel) und der Pfad über dem
       Board (die Geschichte) kommen aus der Liste am Server (W7) — Namen und
       Arten, nicht ganze Artikel. Gefragt wird nur, was noch fehlt. */
    effect(() => {
      const fehlen = this.fehlendeIds();
      if (!fehlen.length) return;
      const schluessel = fehlen.join(',');
      if (schluessel === this.zuletztGefragt) return;
      this.zuletztGefragt = schluessel;
      untracked(() => void this.bestand.liste({ ids: fehlen, limit: 200 }).catch(() => undefined));
    });
    effect(() => {
      const b = this.board();
      if (!b || !storyOf(b) || this.geschichteGeholt) return;
      this.geschichteGeholt = true;
      untracked(() => {
        void Promise.all([
          this.bestand.liste({ of: ['Story'], rel: [PART_OF_RELATION], limit: 200 }),
          this.bestand.liste({ type: BOARD_TYPE, rel: [PART_OF_RELATION], limit: 200 }),
        ]).catch(() => undefined);
      });
    });
    /* Am Telefon passt eine Leinwand von 2400 px nicht; sie fängt
       verkleinert an, statt dass man zuerst sucht, wo etwas liegt. */
    if (typeof window !== 'undefined' && window.innerWidth < 700) this.zoom.set(0.5);
    /* Wer einen Bereich umbenennt — auch gleich nach dem Ziehen —, tippt
       sofort, statt erst ins Feld zu klicken. */
    effect(() => {
      if (!this.benennt()) return;
      requestAnimationFrame(() => {
        const ein = this.buehne()?.nativeElement.querySelector<HTMLInputElement>('.bname-ein');
        ein?.focus();
        ein?.select();
      });
    });
    effect(() => {
      let zu: string[] = [];
      try {
        const roh = globalThis.localStorage?.getItem(this.speicherSchluessel());
        const v: unknown = roh ? JSON.parse(roh) : [];
        if (Array.isArray(v)) zu = v.filter((x): x is string => typeof x === 'string');
      } catch {
        /* Kein Speicher, oder etwas Unlesbares darin: alles offen. */
      }
      untracked(() => this.eingeklappt.set(new Set(zu)));
    });
  }

  private zuletztGefragt = '';
  private geschichteGeholt = false;

  /** Was die Seite kennt: ganze Artikel, sonst die schmalen aus der Liste. */
  private readonly kennt = computed<ReadonlyMap<string, Entity>>(() => {
    const m = new Map(this.bestand.kurz());
    for (const [id, e] of this.bestand.voll()) m.set(id, e);
    return m;
  });

  /** Die Ziele der Kanten auf den Kacheln, deren Name und Art noch fehlen. */
  private readonly fehlendeIds = computed(() => {
    const voll = this.bestand.voll();
    const kurz = this.bestand.kurz();
    const raus = new Set<string>();
    for (const k of this.kanten()) {
      for (const rel of voll.get(k.to)?.relations ?? []) {
        if (!voll.has(rel.to) && !kurz.has(rel.to)) raus.add(rel.to);
      }
    }
    return [...raus].sort();
  });

  protected readonly board = computed<Entity | undefined>(() => {
    const e = this.bestand.voll().get(this.id());
    return e && isBoard(e) ? e : undefined;
  });
  protected readonly keinBoard = computed(() => {
    const e = this.bestand.voll().get(this.id());
    return this.bestand.fehlt().has(this.id()) || (!!e && !isBoard(e));
  });

  protected readonly darfSchreiben = computed(() => this.session.darfSchreiben()(this.id()));
  protected readonly karte = computed(() => {
    const b = this.board();
    return b ? boardCard(b) : null;
  });

  // ---------------------------------------------------------------- Stand

  /**
   * Was gerade gilt: der Entwurf, solange ein Schreiben läuft oder
   * fehlschlug, sonst das Board, wie der Server es zuletzt geschickt hat.
   * So springt eine Kachel nach dem Loslassen nicht zurück, bis die Antwort
   * da ist.
   */
  private readonly entwurf = signal<Entity | null>(null);
  private readonly stand = computed<Entity | undefined>(() => this.entwurf() ?? this.board());
  protected readonly kanten = computed<Relation[]>(() => {
    const b = this.stand();
    return b ? placementsOf(b) : [];
  });

  protected readonly zoom = signal(1);
  private readonly buehne = viewChild<ElementRef<HTMLElement>>('buehne');
  protected readonly gewaehlt = signal<string | null>(null);
  private readonly zug = signal<Zug | null>(null);

  protected readonly karten = computed<Karte[]>(() => {
    const b = this.board();
    const r = this.bestand.registry();
    if (!b || !r) return [];
    const voll = this.bestand.voll();
    const byId = this.kennt();
    const z = this.zug();
    const anker = this.anker();
    return this.kanten().map((rel) => {
      const ziel = voll.get(rel.to);
      const kurz = ziel ?? byId.get(rel.to);
      const liegt = placementOf(rel);
      const platz = z && z.id === rel.id ? z.jetzt : this.mitBereich(liegt, anchorAreaOf(anker, liegt));
      const typ = kurz ? primaryInterface(kurz) : '';
      return {
        rel,
        platz,
        ziel,
        kurz,
        /* Während des Ziehens zählt schon die neue Höhe: wer die Kachel
           grösser zieht, sieht die Karte kommen. */
        ansicht: placementView(r, b, { ...rel, props: { ...rel.props, h: platz.h } }, typ),
        bereich: kurz ? areaOf(r, typ) : '',
        /* Gezählt wird, wo die Karte lag, als man sie griff: sie soll
           nicht verschwinden, während man sie über einen eingeklappten
           Bereich zieht. */
        liegtIn: anchorAreaOf(anker, z && z.id === rel.id ? z.von : liegt),
      };
    });
  });

  /** Was gezeichnet wird: die Karten in eingeklappten Bereichen nicht (T-073). */
  protected readonly sichtbar = computed(() => {
    const zu = this.eingeklappt();
    return this.karten().filter((k) => !k.liegtIn || !zu.has(k.liegtIn));
  });

  // --------------------------------------------------------------- Bereiche

  /** Die Anker des Boards (REQ-159); die mit Rechteck sind Bereiche (T-073). */
  protected readonly anker = computed<BoardAnchor[]>(() => {
    const b = this.stand();
    return b ? anchorsOf(b) : [];
  });
  protected readonly bereiche = computed(() => this.anker().filter(isArea));

  /**
   * Was eingeklappt ist, hält der Betrachter für sich (T-073: lokal reicht).
   * Am Board gespeichert klappte ein Spieler der Leitung die Conditions zu.
   */
  protected readonly eingeklappt = signal<ReadonlySet<string>>(new Set());
  private speicherSchluessel(): string {
    return `nw.board.${this.id()}.collapsed`;
  }

  protected istZu(id: string): boolean {
    return this.eingeklappt().has(id);
  }

  protected klappen(id: string): void {
    const neu = new Set(this.eingeklappt());
    if (!neu.delete(id)) neu.add(id);
    this.eingeklappt.set(neu);
    try {
      globalThis.localStorage?.setItem(this.speicherSchluessel(), JSON.stringify([...neu]));
    } catch {
      /* Ohne Speicher gilt es bis zum Neuladen. */
    }
  }

  /** Wo ein Bereich gezeichnet wird: während des Ziehens, wo der Finger ist. */
  protected lageVon(a: BoardAnchor): Lage {
    const z = this.bzug();
    const l = z && z.id === a.id ? z.jetzt : { x: a.x, y: a.y, w: a.w ?? 0, h: a.h ?? 0 };
    return { ...l, h: this.istZu(a.id) ? BEREICH_KOPF : l.h || BEREICH_KOPF };
  }

  // ------------------------------------------------- Bereiche ziehen (T-146)

  /** Mit Pointer-Events, damit Maus, Stift und Finger denselben Weg nehmen. */
  protected readonly bzug = signal<Bzug | null>(null);

  protected bereichGreifen(ev: PointerEvent, a: BoardAnchor, art: Bzug['art']): void {
    /* Mit „Add area" in der Hand zeichnet man auch über einem Bereich —
       ein kleinerer darin ist erlaubt. */
    if (this.zeichnet() || !this.darfSchreiben() || ev.button !== 0 || !isArea(a)) return;
    const t = ev.target as HTMLElement | null;
    if (art === 'schieben' && t?.closest('a, button, input, select')) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.gewaehlt.set(null);
    const von = { x: a.x, y: a.y, w: a.w, h: a.h };
    this.bzug.set({ id: a.id, art, sx: ev.clientX, sy: ev.clientY, von, jetzt: von });
  }

  private bereichZiehen(ev: PointerEvent, z: Bzug): void {
    const c = this.karte();
    if (!c) return;
    const dx = (ev.clientX - z.sx) / this.zoom();
    const dy = (ev.clientY - z.sy) / this.zoom();
    const { von } = z;
    const jetzt =
      z.art === 'schieben'
        ? {
            ...von,
            x: Math.max(0, Math.min(snapTo(von.x + dx, c.snap), c.width - von.w)),
            y: Math.max(0, Math.min(snapTo(von.y + dy, c.snap), c.height - von.h)),
          }
        : {
            ...von,
            w: Math.max(AREA_MIN.w, Math.min(snapTo(von.w + dx, c.snap), c.width - von.x)),
            h: Math.max(AREA_MIN.h, Math.min(snapTo(von.h + dy, c.snap), c.height - von.y)),
          };
    this.bzug.set({ ...z, jetzt });
  }

  /** Eine Karte im gezogenen Bereich wandert mit; beim Grössenändern bleibt sie liegen. */
  private mitBereich(p: BoardPlacement, liegtIn: string | null): BoardPlacement {
    const z = this.bzug();
    if (!z || z.art !== 'schieben' || liegtIn !== z.id) return p;
    const c = this.karte();
    const dx = z.jetzt.x - z.von.x;
    const dy = z.jetzt.y - z.von.y;
    if (!dx && !dy) return p;
    const breit = c?.width ?? Infinity;
    const hoch = c?.height ?? Infinity;
    return {
      ...p,
      x: Math.max(0, Math.min(p.x + dx, breit - p.w)),
      y: Math.max(0, Math.min(p.y + dy, hoch - p.h)),
    };
  }

  private bereichFertig(z: Bzug): void {
    const b = this.stand();
    const { von, jetzt } = z;
    if (!b || (von.x === jetzt.x && von.y === jetzt.y && von.w === jetzt.w && von.h === jetzt.h)) {
      this.bzug.set(null);
      return;
    }
    /* Die Karten aus der Lage vor dem Zug — noch gilt der alte Anker. */
    const anker = this.anker();
    const kanten = this.alleKanten().map((r) => {
      if (r.type !== PLACED_RELATION) return r;
      const p = placementOf(r);
      const neu = this.mitBereich(p, anchorAreaOf(anker, p));
      return neu === p ? r : { ...r, props: { ...(r.props ?? {}), x: neu.x, y: neu.y } };
    });
    this.bzug.set(null);
    const mitAnker = withAnchors(b, anker.map((a) => (a.id === z.id ? { ...a, ...jetzt } : a)));
    void this.schreiben({ ...mitAnker, relations: kanten });
  }

  /** Zum Anker springen: die Leinwand scrollt hin, und mit `zoom` zoomt sie auch. */
  protected springen(a: BoardAnchor): void {
    const buehne = this.buehne()?.nativeElement;
    if (!buehne) return;
    if (a.zoom) this.zoom.set(Math.min(1.5, Math.max(0.3, a.zoom)));
    const z = this.zoom();
    const rand = 16;
    /* Erst nach dem Zeichnen: ein neuer Zoom ändert die Grösse der Fläche. */
    requestAnimationFrame(() => {
      buehne.scrollTo({ left: Math.max(0, a.x * z - rand), top: Math.max(0, a.y * z - rand), behavior: 'smooth' });
      buehne.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /** Mit „Add area" in der Hand legt ein Ziehen auf der Leinwand einen Bereich an. */
  protected readonly zeichnet = signal(false);
  protected readonly rahmen = signal<Rahmen | null>(null);
  protected readonly benennt = signal<string | null>(null);

  protected leinwandGreifen(ev: PointerEvent): void {
    this.gewaehlt.set(null);
    if (!this.zeichnet() || !this.darfSchreiben() || ev.button !== 0) return;
    const c = this.karte();
    const fl = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    if (!c) return;
    ev.preventDefault();
    const x = snapTo((ev.clientX - fl.left) / this.zoom(), c.snap);
    const y = snapTo((ev.clientY - fl.top) / this.zoom(), c.snap);
    this.rahmen.set({ sx: x, sy: y, x, y, w: 0, h: 0 });
  }

  private rahmenZiehen(ev: PointerEvent): void {
    const r = this.rahmen();
    const c = this.karte();
    const fl = this.buehne()?.nativeElement.querySelector('.leinwand')?.getBoundingClientRect();
    if (!r || !c || !fl) return;
    const px = Math.min(c.width, snapTo((ev.clientX - fl.left) / this.zoom(), c.snap));
    const py = Math.min(c.height, snapTo((ev.clientY - fl.top) / this.zoom(), c.snap));
    this.rahmen.set({
      ...r,
      x: Math.min(r.sx, px),
      y: Math.min(r.sy, py),
      w: Math.abs(px - r.sx),
      h: Math.abs(py - r.sy),
    });
  }

  private rahmenFertig(): void {
    const r = this.rahmen();
    this.rahmen.set(null);
    if (!r) return;
    this.zeichnet.set(false);
    if (r.w < AREA_MIN.w || r.h < AREA_MIN.h) return;
    const n = this.bereiche().length + 1;
    const neu: BoardAnchor = { id: `an-${crypto.randomUUID()}`, name: `Area ${n}`, x: r.x, y: r.y, w: r.w, h: r.h };
    this.benennt.set(neu.id);
    this.ankerSchreiben([...this.anker(), neu]);
  }

  protected zeichnenAbbrechen(): void {
    this.zeichnet.set(false);
    this.rahmen.set(null);
  }

  protected umbenennen(a: BoardAnchor, name: string): void {
    this.benennt.set(null);
    const n = name.trim();
    if (!n || n === a.name) return;
    this.ankerSchreiben(this.anker().map((x) => (x.id === a.id ? { ...x, name: n } : x)));
  }

  /** Die Karten darin bleiben liegen — ein Bereich ist eine Lage, kein Behälter. */
  protected bereichLoeschen(a: BoardAnchor): void {
    this.ankerSchreiben(this.anker().filter((x) => x.id !== a.id));
  }

  private ankerSchreiben(anker: BoardAnchor[]): void {
    const b = this.stand();
    if (b) void this.schreiben(withAnchors(b, anker));
  }

  protected typLabel(e: Entity | undefined): string {
    if (!e) return '';
    const typ = primaryInterface(e);
    const label = this.bestand.registry()?.interfaces[typ]?.label ?? typ;
    const stand = (e.components?.['Status'] as { status?: string } | undefined)?.status;
    return stand ? `${label} · ${stand}` : label;
  }
  protected name(e: Entity | undefined): string {
    return e ? entityName(e) : '';
  }
  protected viewLabel(key: string): string {
    return this.bestand.registry()?.views[key]?.label ?? key;
  }

  /** Was eine Kachel zur Wahl stellt: jede Ansicht ausser der Artikelseite. */
  protected readonly ansichten = computed(() => {
    const r = this.bestand.registry();
    /* Die Artikelseite und der Druck sind Seiten, keine Kacheln; eigene Ansichten stehen zur Wahl (T-110). */
    return r ? viewKeys(r).filter((k) => k !== 'full' && k !== 'print' && !isDesignedView(r.views[k])) : [];
  });

  /**
   * **Was diese Kachel zur Wahl stellt** (T-268, T-276, E-103): die
   * gestalteten Ansichten, die für ihren Artikel gelten, genaueste zuerst,
   * und dahinter dieselbe Liste wie immer.
   */
  protected ansichtenFuer(e: Entity | undefined): string[] {
    const r = this.bestand.registry();
    if (!r || !e) return this.ansichten();
    const rueck = (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id }));
    const gestaltete = viewsFor(e, r, { incoming: rueck })
      .filter((v) => isDesignedView(r.views[v.key]))
      .map((v) => v.key);
    return [...gestaltete, ...this.ansichten()];
  }
  protected rueckVon(e: Entity): { type: string; from: string }[] {
    return (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id }));
  }
  protected gestaltet(key: string): boolean {
    return isDesignedView(this.bestand.registry()?.views[key]);
  }
  protected gestaltetesLayout(key: string, e: Entity) {
    const r = this.bestand.registry();
    return r ? layoutFor(r, key, primaryInterface(e)).layout : [];
  }

  /** Kampagne › Kapitel › Sitzung — und je Sprosse ihr Board, wenn sie eines hat. */
  protected readonly pfad = computed(() => {
    const b = this.board();
    if (!b) return [];
    const s = storyOf(b);
    if (!s) return [];
    const byId = this.kennt();
    const story = byId.get(s);
    if (!story) return [];
    const boards = [...byId.values()].filter(isBoard);
    return [...chainAbove(byId, s), story].map((e) => {
      const eigenes = boards.find((x) => storyOf(x) === e.id && x.id !== b.id);
      return {
        id: e.id,
        name: entityName(e),
        art: this.typLabel(e).split(' · ')[0] ?? '',
        link: eigenes ? ['/boards', eigenes.id] : ['/artikel', e.id],
      };
    });
  });

  // ------------------------------------------------------------- Seitenspalte

  /**
   * Was mit den Karten verbunden ist, aber nicht auf dem Board liegt — wie
   * auf `Board.dc.html`. Gelesen aus den ausgehenden Kanten der Artikel auf
   * den Kacheln; die Gegenrichtung bräuchte je Kachel eine Rückfrage am
   * Server.
   */
  protected readonly verbunden = computed(() => {
    const b = this.board();
    if (!b) return [];
    const liegt = new Set(this.kanten().map((k) => k.to));
    const byId = this.kennt();
    const voll = this.bestand.voll();
    const nicht = new Set([LAYER_RELATION, INSTANCE_RELATION, PLACED_RELATION]);
    const out = new Map<string, { id: string; e: Entity; von: Set<string>; zusatz: string }>();
    for (const k of this.kanten()) {
      const karte = byId.get(k.to);
      for (const rel of voll.get(k.to)?.relations ?? []) {
        if (nicht.has(rel.type) || liegt.has(rel.to) || rel.to === b.id) continue;
        const e = byId.get(rel.to);
        if (!e || isInstance(e)) continue;
        const x = out.get(e.id) ?? { id: e.id, e, von: new Set<string>(), zusatz: '' };
        if (karte) x.von.add(entityName(karte));
        out.set(e.id, x);
      }
    }
    /* Gleichnamiges unterscheidbar machen (T-126): zwei „Battleaxe" aus
       verschiedenen Statblöcken sahen gleich aus. Erst die Art, und wo auch
       die gleich ist, die Karte, von der die Kante ausgeht. */
    const liste = [...out.values()];
    const zaehle = (f: (x: (typeof liste)[number]) => string) => {
      const n = new Map<string, number>();
      for (const x of liste) n.set(f(x), (n.get(f(x)) ?? 0) + 1);
      return n;
    };
    const art = (x: (typeof liste)[number]) => this.typLabel(x.e).split(' · ')[0] ?? '';
    const gleicherName = zaehle((x) => entityName(x.e));
    const gleicheArt = zaehle((x) => `${entityName(x.e)}\u0000${art(x)}`);
    for (const x of liste) {
      if ((gleicherName.get(entityName(x.e)) ?? 0) < 2) continue;
      const teile = [art(x)];
      if ((gleicheArt.get(`${entityName(x.e)}\u0000${art(x)}`) ?? 0) > 1 && x.von.size) {
        teile.push(`from ${[...x.von].sort().join(', ')}`);
      }
      x.zusatz = teile.filter(Boolean).join(' · ');
    }
    return liste.sort(
      (a, c) => entityName(a.e).localeCompare(entityName(c.e), 'de') || a.zusatz.localeCompare(c.zusatz, 'de'),
    );
  });

  /** Was auf dem Board liegt und noch nicht fertig ist (`Status`, REQ-188). */
  protected readonly offen = computed(() => {
    const byId = this.kennt();
    return this.kanten()
      .map((k) => byId.get(k.to))
      .filter((e): e is Entity => !!e)
      .map((e) => ({ e, stand: (e.components?.['Status'] as { status?: string } | undefined)?.status }))
      .filter((x) => x.stand && x.stand !== 'ready');
  });

  // ------------------------------------------------------------- Hinzufügen

  protected readonly suchtOffen = signal(false);
  /** Das Board und was daraufliegt — die Suche bietet beides nicht an. */
  protected readonly liegt = computed(
    () => new Set([this.id(), ...this.kanten().map((k) => k.to)]),
  );

  protected hinlegen(e: Entity): void {
    const b = this.board();
    if (!b) return;
    const buehne = this.buehne()?.nativeElement;
    const sichtbar = buehne ? buehne.clientWidth / this.zoom() : undefined;
    const platz = nextPlacement({ ...b, relations: this.kanten() }, undefined, undefined, sichtbar);
    const neu: Relation = {
      id: `r-${crypto.randomUUID()}`,
      type: PLACED_RELATION,
      to: e.id,
      props: { x: platz.x, y: platz.y, w: platz.w, h: platz.h, z: platz.z },
    };
    this.gewaehlt.set(neu.id);
    this.kantenSchreiben([...this.alleKanten(), neu]);
  }

  protected wegnehmen(rel: Relation): void {
    this.kantenSchreiben(this.alleKanten().filter((r) => r.id !== rel.id));
  }

  protected ansichtSetzen(rel: Relation, view: string): void {
    this.aendern(rel.id, { view: view || undefined });
  }

  // ----------------------------------------------------------------- Ziehen

  protected greifen(ev: PointerEvent, k: Karte, art: Zug['art'], amNamen = false): void {
    if (!this.darfSchreiben() || k.platz.locked || ev.button !== 0) return;
    /* Am Namen zieht nur der Finger (T-146): verkleinert ist die Kopfzeile
       am Telefon kaum 14 px hoch, und der Browser lenkt einen Tipp dorthin
       auf den nächsten Verweis. Antippen öffnet weiter den Artikel; mit der
       Maus bleibt der Name ein Verweis wie bisher. */
    if (amNamen && ev.pointerType === 'mouse') return;
    /* Ein Knopf, eine Auswahl oder der Name in der Kopfzeile tun ihr
       Eigenes; gezogen wird an der freien Fläche. */
    const t = ev.target as HTMLElement | null;
    if (art === 'schieben' && !amNamen && t?.closest('a, button, select')) return;
    ev.preventDefault();
    this.gewaehlt.set(k.rel.id);
    this.zug.set({ id: k.rel.id, art, sx: ev.clientX, sy: ev.clientY, von: k.platz, jetzt: k.platz });
  }

  protected bewegen(ev: PointerEvent): void {
    if (this.rahmen()) return this.rahmenZiehen(ev);
    const bz = this.bzug();
    if (bz) return this.bereichZiehen(ev, bz);
    const z = this.zug();
    const c = this.karte();
    if (!z || !c) return;
    const dx = (ev.clientX - z.sx) / this.zoom();
    const dy = (ev.clientY - z.sy) / this.zoom();
    const jetzt =
      z.art === 'schieben'
        ? {
            ...z.von,
            x: Math.min(snapTo(z.von.x + dx, c.snap), c.width - z.von.w),
            y: Math.min(snapTo(z.von.y + dy, c.snap), c.height - z.von.h),
          }
        : {
            ...z.von,
            w: Math.min(snapTo(z.von.w + dx, c.snap, PLACEMENT_MIN.w), c.width - z.von.x),
            h: Math.min(snapTo(z.von.h + dy, c.snap, PLACEMENT_MIN.h), c.height - z.von.y),
          };
    this.zug.set({ ...z, jetzt });
  }

  protected loslassen(): void {
    if (this.rahmen()) return this.rahmenFertig();
    const bz = this.bzug();
    if (bz) return this.bereichFertig(bz);
    const z = this.zug();
    if (!z) return;
    this.zug.set(null);
    const { von, jetzt } = z;
    if (von.x === jetzt.x && von.y === jetzt.y && von.w === jetzt.w && von.h === jetzt.h) return;
    /* Was man gerade bewegt hat, liegt danach obenauf. */
    const oben = Math.max(...this.kanten().map((k) => placementOf(k).z));
    const zNeu = von.z < oben || this.kanten().filter((k) => placementOf(k).z === oben).length > 1 ? oben + 1 : von.z;
    this.aendern(z.id, { x: jetzt.x, y: jetzt.y, w: jetzt.w, h: jetzt.h, z: zNeu });
  }

  protected abbrechen(): void {
    this.zug.set(null);
    this.bzug.set(null);
    this.rahmen.set(null);
  }

  protected zoomen(schritt: number): void {
    this.zoom.update((z) => Math.round(Math.min(1.5, Math.max(0.3, z + schritt)) * 10) / 10);
  }

  // -------------------------------------------------------------- Schreiben

  protected readonly speichert = signal(false);
  protected readonly fehler = signal<Mangel | null>(null);
  private wartet: Entity | null = null;

  /** Alle Kanten des Boards, nicht nur die Platzierungen — `partOf` und `inLayer` bleiben. */
  private alleKanten(): Relation[] {
    return this.stand()?.relations ?? [];
  }

  private kantenSchreiben(kanten: Relation[]): void {
    const b = this.stand();
    if (b) void this.schreiben({ ...b, relations: kanten });
  }

  private aendern(id: string, props: Record<string, unknown>): void {
    const kanten = this.alleKanten().map((r) => {
      if (r.id !== id) return r;
      const neu: Record<string, unknown> = { ...(r.props ?? {}), ...props };
      for (const k of Object.keys(neu)) if (neu[k] === undefined) delete neu[k];
      return { ...r, props: neu };
    });
    this.kantenSchreiben(kanten);
  }

  /**
   * Eins nach dem anderen: läuft ein Schreiben, wartet der neueste Stand
   * und geht danach — zwei gleichzeitige PUTs könnten in der falschen
   * Reihenfolge ankommen, und dann gälte der ältere Griff.
   */
  private async schreiben(entwurf: Entity): Promise<void> {
    this.entwurf.set(entwurf);
    this.fehler.set(null);
    if (this.speichert()) {
      this.wartet = entwurf;
      return;
    }
    this.speichert.set(true);
    let naechste: Entity | null = entwurf;
    while (naechste) {
      const b = this.board();
      if (!b) break;
      /* Kanten und Karten aus dem Entwurf, der Rest so, wie der Server ihn
         zuletzt schickte. */
      const fehler = await this.brett.schreiben({
        ...b,
        relations: naechste.relations,
        components: naechste.components,
      });
      if (fehler) {
        /* Zurück auf das, was der Server hat — ein Stand, den er nie
           gesehen hat, wäre beim nächsten Laden lautlos weg. */
        this.fehler.set(fehler);
        this.wartet = null;
        this.entwurf.set(null);
        break;
      }
      naechste = this.wartet;
      this.wartet = null;
    }
    if (!this.fehler()) this.entwurf.set(null);
    this.speichert.set(false);
  }
}
