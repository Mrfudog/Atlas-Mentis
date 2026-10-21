import { Component, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  anchorAreaOf,
  anchorsOf,
  AREA_MIN,
  areaOf,
  BOARD_DRAW_KINDS,
  BOARD_TYPE,
  boardBackground,
  boardCard,
  boardContentBounds,
  boardExtent,
  drawnSheets,
  entityName,
  fitPoints,
  isMap,
  newShape,
  shapesOf,
  SHAPE_MIN,
  withBackground,
  withShapes,
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
  viewKeys,
  viewsFor,
  withAnchors,
} from '@nw/model';
import type { BackgroundFit, BoardAnchor, BoardBackground, BoardPlacement, BoardShape, BoardShapeKind, Entity, IncomingEdge, Relation, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Brett, chainAbove, isBoard, storyOf, type Mangel } from './brett';
import { Kachel } from './kachel';
import { BoardSuche } from './suche';
import { SCHNELL_KONTEXT, type SchnellKontext } from '../artikel/schnell';
import { BildWahl, bildAdresse } from '../artikel/bild';
import { Text } from '../artikel/text';
import { Blatt } from '../artikel/blatt';
/* Die Karte wird eingebettet, nicht umgebaut (T-339): dieselbe Komponente wie auf der Artikelseite. */
import { Karte as KartenAnsicht } from '../karten/karte';

/**
 * **Die Werkzeuge des Boards** (T-339), nach dem Muster der Karte (T-325):
 * links am Desktop, unten fest am Telefon; das gewählte zeigt seine
 * Optionen in der Zeile über der Leinwand. Was ein Werkzeug anlegt, ist
 * eine Form am Board (`Board.shapes`) oder eine Kante (`placed`).
 */
type Werkzeug = 'auswahl' | 'artikel' | 'text' | 'bild' | 'zeichnen' | 'karte' | 'hintergrund' | 'bereich';
const WERKZEUGE: { key: Werkzeug; sym: string; label: string; title: string; schreibt: boolean }[] = [
  { key: 'auswahl', sym: '↖', label: 'Select', title: 'Select, move and resize; drag the empty canvas to pan', schreibt: false },
  { key: 'artikel', sym: '▤', label: 'Article', title: 'Place an article as a card', schreibt: true },
  { key: 'text', sym: 'T', label: 'Text', title: 'Click the canvas to place a heading, paragraph, list or quote', schreibt: true },
  { key: 'bild', sym: '▧', label: 'Image', title: 'Upload an image or choose one from the assets', schreibt: true },
  { key: 'zeichnen', sym: '✎', label: 'Draw', title: 'Freehand, line, arrow, rectangle, ellipse', schreibt: true },
  { key: 'karte', sym: '⌖', label: 'Map', title: 'A live map as a card, or as the background of the board', schreibt: true },
  { key: 'hintergrund', sym: '◩', label: 'Background', title: 'Background image, colour or map', schreibt: true },
  { key: 'bereich', sym: '▭', label: 'Area', title: 'Drag a rectangle to mark a named area', schreibt: true },
];

/** Die Textarten (T-339): Markdown am Anfang der ersten Zeile, kein eigenes Feld. */
const TEXT_STILE = [
  { key: 'h1', label: 'H1', title: 'Heading 1', vor: '# ' },
  { key: 'h2', label: 'H2', title: 'Heading 2', vor: '## ' },
  { key: 'h3', label: 'H3', title: 'Heading 3', vor: '### ' },
  { key: 'p', label: '¶', title: 'Paragraph', vor: '' },
  { key: 'list', label: '•', title: 'List', vor: '- ' },
  { key: 'quote', label: '❝', title: 'Quote', vor: '> ' },
] as const;
type TextStil = (typeof TEXT_STILE)[number]['key'];

const ZEICHEN_ARTEN: { key: BoardShapeKind; label: string }[] = [
  { key: 'pen', label: 'Freehand' },
  { key: 'line', label: 'Line' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'rect', label: 'Rectangle' },
  { key: 'ellipse', label: 'Ellipse' },
];

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;

/** Eine Form, die gerade gezogen wird (T-339). */
interface Fzug {
  id: string;
  art: 'schieben' | 'groesse';
  sx: number;
  sy: number;
  von: Lage;
  jetzt: Lage;
}

/** Was gerade gezeichnet wird: die Punkte in px der Leinwand. */
interface Strich {
  kind: BoardShapeKind;
  punkte: [number, number][];
}

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
  imports: [RouterLink, Kachel, BoardSuche, BildWahl, Text, Blatt, KartenAnsicht],
  templateUrl: './board.html',
  styleUrls: ['./board.scss', './werkzeuge.scss'],
  /* Was aus der Suche neu angelegt wird, folgt der Ebene des Boards (T-131). */
  providers: [{ provide: SCHNELL_KONTEXT, useExisting: forwardRef(() => Board) }],
  host: {
    '(window:pointermove)': 'bewegen($event)',
    '(window:pointerup)': 'loslassen()',
    '(window:pointercancel)': 'abbrechen()',
    '(window:keydown.escape)': 'zeichnenAbbrechen()',
    '(window:keydown)': 'taste($event)',
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
    /* Die Karte im Hintergrund kommt wie jeder Artikel — gesiebt (T-339). */
    effect(() => {
      const id = this.hintergrund().map;
      if (id) void this.bestand.oeffnen(id, false, false);
    });
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
        /* Wer das Board nicht schreibt, bekommt ohne Wahl den Handzettel (T-339, E-123 a). */
        ansicht: placementView(r, b, { ...rel, props: { ...rel.props, h: platz.h } }, typ, { player: !this.darfSchreiben() }),
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
            x: snapTo(von.x + dx, c.snap),
            y: snapTo(von.y + dy, c.snap),
          }
        : {
            ...von,
            w: snapTo(von.w + dx, c.snap, AREA_MIN.w),
            h: snapTo(von.h + dy, c.snap, AREA_MIN.h),
          };
    this.bzug.set({ ...z, jetzt });
  }

  /** Eine Karte im gezogenen Bereich wandert mit; beim Grössenändern bleibt sie liegen. */
  private mitBereich(p: BoardPlacement, liegtIn: string | null): BoardPlacement {
    const z = this.bzug();
    if (!z || z.art !== 'schieben' || liegtIn !== z.id) return p;
    const dx = z.jetzt.x - z.von.x;
    const dy = z.jetzt.y - z.von.y;
    if (!dx && !dy) return p;
    /* Die Leinwand hat keinen Rand mehr rechts und unten (T-339). */
    return { ...p, x: Math.max(0, p.x + dx), y: Math.max(0, p.y + dy) };
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
    if (a.zoom) this.zoom.set(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, a.zoom)));
    const z = this.zoom();
    const rand = 16;
    /* Erst nach dem Zeichnen: ein neuer Zoom ändert die Grösse der Fläche. */
    requestAnimationFrame(() => {
      buehne.scrollTo({ left: Math.max(0, a.x * z - rand), top: Math.max(0, a.y * z - rand), behavior: 'smooth' });
      buehne.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /** Mit „Add area" in der Hand legt ein Ziehen auf der Leinwand einen Bereich an. */
  protected readonly zeichnet = computed(() => this.werkzeug() === 'bereich');
  protected readonly rahmen = signal<Rahmen | null>(null);
  protected readonly benennt = signal<string | null>(null);

  protected leinwandGreifen(ev: PointerEvent): void {
    this.gewaehlt.set(null);
    this.formGewaehlt.set(null);
    const w = this.werkzeug();
    /* Schwenken (T-339): die leere Leinwand ziehen, mit der Maus oder der
       mittleren Taste — der Finger scrollt ohnehin. */
    if ((w === 'auswahl' && ev.button === 0 && ev.pointerType === 'mouse') || ev.button === 1) {
      const buehne = this.buehne()?.nativeElement;
      if (!buehne) return;
      ev.preventDefault();
      this.schwenk.set({ sx: ev.clientX, sy: ev.clientY, l: buehne.scrollLeft, t: buehne.scrollTop });
      return;
    }
    if (!this.darfSchreiben() || ev.button !== 0) return;
    const c = this.karte();
    if (!c) return;
    const [px, py] = this.punkt(ev);
    if (w === 'text') {
      ev.preventDefault();
      this.formHinlegen(
        newShape('text', { id: `sh-${crypto.randomUUID()}`, x: snapTo(px, c.snap), y: snapTo(py, c.snap), text: `${this.vorsatz(this.textStil())}Text` }),
      );
      this.werkzeug.set('auswahl');
      return;
    }
    if (w === 'zeichnen') {
      ev.preventDefault();
      this.strich.set({ kind: this.zeichenArt(), punkte: [[px, py], [px, py]] });
      return;
    }
    if (w !== 'bereich') return;
    ev.preventDefault();
    const x = snapTo(px, c.snap);
    const y = snapTo(py, c.snap);
    this.rahmen.set({ sx: x, sy: y, x, y, w: 0, h: 0 });
  }

  /** Wo der Zeiger auf der Leinwand steht, in px der Leinwand. */
  private punkt(ev: PointerEvent): [number, number] {
    const fl = this.buehne()?.nativeElement.querySelector('.leinwand')?.getBoundingClientRect();
    if (!fl) return [0, 0];
    return [Math.max(0, (ev.clientX - fl.left) / this.zoom()), Math.max(0, (ev.clientY - fl.top) / this.zoom())];
  }

  private rahmenZiehen(ev: PointerEvent): void {
    const r = this.rahmen();
    const c = this.karte();
    const fl = this.buehne()?.nativeElement.querySelector('.leinwand')?.getBoundingClientRect();
    if (!r || !c || !fl) return;
    const px = snapTo((ev.clientX - fl.left) / this.zoom(), c.snap);
    const py = snapTo((ev.clientY - fl.top) / this.zoom(), c.snap);
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
    this.werkzeug.set('auswahl');
    if (r.w < AREA_MIN.w || r.h < AREA_MIN.h) return;
    const n = this.bereiche().length + 1;
    const neu: BoardAnchor = { id: `an-${crypto.randomUUID()}`, name: `Area ${n}`, x: r.x, y: r.y, w: r.w, h: r.h };
    this.benennt.set(neu.id);
    this.ankerSchreiben([...this.anker(), neu]);
  }

  protected zeichnenAbbrechen(): void {
    if (this.werkzeug() === 'bereich' || this.strich()) this.werkzeug.set('auswahl');
    this.rahmen.set(null);
    this.strich.set(null);
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
    /* Seit T-339 auch `full` — sie scrollt in der Kachel. Der Druck ist ein Blatt, keine Kachel. */
    return r ? viewKeys(r).filter((k) => k !== 'print' && k !== 'search' && !isDesignedView(r.views[k])) : [];
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
  protected rueckVon(e: Entity): IncomingEdge[] {
    return (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props }));
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

  protected readonly suchtOffen = computed(() => this.werkzeug() === 'artikel');
  /** Das Board und was daraufliegt — die Suche bietet beides nicht an. */
  protected readonly liegt = computed(
    () => new Set([this.id(), ...this.kanten().map((k) => k.to)]),
  );

  protected hinlegen(e: Entity, w?: number, h?: number): void {
    const b = this.board();
    if (!b) return;
    const buehne = this.buehne()?.nativeElement;
    const sichtbar = buehne ? buehne.clientWidth / this.zoom() : undefined;
    const platz = nextPlacement({ ...b, relations: this.kanten() }, w, h, sichtbar);
    const neu: Relation = {
      id: `r-${crypto.randomUUID()}`,
      type: PLACED_RELATION,
      to: e.id,
      props: { x: platz.x, y: platz.y, w: platz.w, h: platz.h, z: Math.max(platz.z, this.obenauf() + 1) },
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
    const sw = this.schwenk();
    if (sw) {
      const buehne = this.buehne()?.nativeElement;
      if (buehne) {
        buehne.scrollLeft = sw.l - (ev.clientX - sw.sx);
        buehne.scrollTop = sw.t - (ev.clientY - sw.sy);
      }
      return;
    }
    const st = this.strich();
    if (st) return this.strichZiehen(ev, st);
    const fz = this.fzug();
    if (fz) return this.formZiehen(ev, fz);
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
            x: snapTo(z.von.x + dx, c.snap),
            y: snapTo(z.von.y + dy, c.snap),
          }
        : {
            ...z.von,
            w: snapTo(z.von.w + dx, c.snap, PLACEMENT_MIN.w),
            h: snapTo(z.von.h + dy, c.snap, PLACEMENT_MIN.h),
          };
    this.zug.set({ ...z, jetzt });
  }

  protected loslassen(): void {
    if (this.schwenk()) return this.schwenk.set(null);
    const st = this.strich();
    if (st) return this.strichFertig(st);
    const fz = this.fzug();
    if (fz) return this.formFertig(fz);
    if (this.rahmen()) return this.rahmenFertig();
    const bz = this.bzug();
    if (bz) return this.bereichFertig(bz);
    const z = this.zug();
    if (!z) return;
    this.zug.set(null);
    const { von, jetzt } = z;
    if (von.x === jetzt.x && von.y === jetzt.y && von.w === jetzt.w && von.h === jetzt.h) return;
    /* Was man gerade bewegt hat, liegt danach obenauf — auch über den Formen. */
    const oben = this.obenauf();
    const zNeu = von.z < oben || this.kanten().filter((k) => placementOf(k).z === oben).length > 1 ? oben + 1 : von.z;
    this.aendern(z.id, { x: jetzt.x, y: jetzt.y, w: jetzt.w, h: jetzt.h, z: zNeu });
  }

  protected abbrechen(): void {
    this.zug.set(null);
    this.bzug.set(null);
    this.rahmen.set(null);
    this.fzug.set(null);
    this.strich.set(null);
    this.schwenk.set(null);
  }

  protected zoomen(schritt: number): void {
    this.zoom.update((z) => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + schritt)) * 10) / 10);
  }

  // --------------------------------------------------------- Werkzeuge (T-339)

  protected readonly WERKZEUGE = WERKZEUGE;
  protected readonly TEXT_STILE = TEXT_STILE;
  protected readonly ZEICHEN_ARTEN = ZEICHEN_ARTEN;
  protected readonly werkzeug = signal<Werkzeug>('auswahl');
  /** Die Leiste nur mit Zeichen (wie auf der Karte). */
  protected readonly leisteZu = signal(false);
  protected readonly werkzeuge = computed(() => WERKZEUGE.filter((w) => !w.schreibt || this.darfSchreiben()));

  protected werkzeugWaehlen(w: Werkzeug): void {
    this.werkzeug.set(this.werkzeug() === w ? 'auswahl' : w);
    /* Wer zu zeichnen anfängt, ist mit der gewählten Form fertig — ihr Blatt läge sonst über der Leinwand. */
    if (this.werkzeug() !== 'auswahl' && this.werkzeug() !== 'bild') this.formGewaehlt.set(null);
    this.rahmen.set(null);
    this.strich.set(null);
  }

  protected readonly textStil = signal<TextStil>('p');
  protected readonly zeichenArt = signal<BoardShapeKind>('pen');
  protected readonly farbe = signal('#8c1c13');
  protected readonly staerke = signal(3);
  protected readonly fuellen = signal(false);
  protected readonly karteAls = signal<'kachel' | 'grund'>('kachel');

  private vorsatz(stil: TextStil): string {
    return TEXT_STILE.find((t) => t.key === stil)?.vor ?? '';
  }

  /** Die Textart der ersten Zeile umstellen — der Rest bleibt, wie er ist. */
  protected stilSetzen(stil: TextStil): void {
    this.textStil.set(stil);
    const f = this.gewaehlteForm();
    if (!f || f.kind !== 'text') return;
    const [erste = '', ...rest] = f.text.split('\n');
    const ohne = erste.replace(/^(#{1,6}\s+|[-*]\s+|>\s?)/, '');
    this.formAendern(f.id, { text: [this.vorsatz(stil) + ohne, ...rest].join('\n') });
  }

  /** Die Variablen für `{VAR}` im Text einer Form: die des Boards, dann die der Kampagne. */
  protected readonly scopes = computed<VarScopes>(() => {
    const vars = this.board()?.components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.bestand.registry()?.vars };
  });

  // -------------------------------------------------------------- Formen

  protected readonly fzug = signal<Fzug | null>(null);
  protected readonly strich = signal<Strich | null>(null);
  protected readonly schwenk = signal<{ sx: number; sy: number; l: number; t: number } | null>(null);
  protected readonly formGewaehlt = signal<string | null>(null);
  /** Ein eben hingelegtes Bild nimmt beim ersten Laden sein Seitenverhältnis an. */
  private neuesBild: string | null = null;

  protected readonly formen = computed<BoardShape[]>(() => {
    const b = this.stand();
    const z = this.fzug();
    if (!b) return [];
    return shapesOf(b).map((f) => (z && z.id === f.id ? { ...f, ...z.jetzt } : f));
  });
  protected readonly gewaehlteForm = computed(() => this.formen().find((f) => f.id === this.formGewaehlt()) ?? null);

  protected istZeichnung(f: BoardShape): boolean {
    return BOARD_DRAW_KINDS.includes(f.kind);
  }

  /** Die Punkte einer Linie oder Freihand, auf die Grösse der Form gestreckt (Ziehen an der Ecke). */
  protected linie(f: BoardShape): string {
    return f.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  }

  protected readonly bildAdresse = bildAdresse;

  protected bild(f: BoardShape): string | null {
    return bildAdresse(f.asset);
  }

  /** Was die Leitung am höchsten gelegt hat — Kacheln und Formen zählen zusammen. */
  private obenauf(): number {
    const zs = [...this.kanten().map((k) => placementOf(k).z), ...this.formen().map((f) => f.z)];
    return zs.length ? Math.max(...zs) : 0;
  }

  protected formGreifen(ev: PointerEvent, f: BoardShape, art: Fzug['art']): void {
    /* Mit einem anlegenden Werkzeug in der Hand zeichnet man über der Form weiter. */
    if (this.werkzeug() !== 'auswahl') return;
    ev.stopPropagation();
    this.gewaehlt.set(null);
    this.formGewaehlt.set(f.id);
    if (!this.darfSchreiben() || ev.button !== 0) return;
    const t = ev.target as HTMLElement | null;
    if (art === 'schieben' && t?.closest('a, button, input, textarea, select')) return;
    ev.preventDefault();
    const von = { x: f.x, y: f.y, w: f.w, h: f.h };
    this.fzug.set({ id: f.id, art, sx: ev.clientX, sy: ev.clientY, von, jetzt: von });
  }

  private formZiehen(ev: PointerEvent, z: Fzug): void {
    const c = this.karte();
    if (!c) return;
    const dx = (ev.clientX - z.sx) / this.zoom();
    const dy = (ev.clientY - z.sy) / this.zoom();
    const jetzt =
      z.art === 'schieben'
        ? { ...z.von, x: snapTo(z.von.x + dx, c.snap), y: snapTo(z.von.y + dy, c.snap) }
        : { ...z.von, w: Math.max(SHAPE_MIN.w, Math.round(z.von.w + dx)), h: Math.max(SHAPE_MIN.h, Math.round(z.von.h + dy)) };
    this.fzug.set({ ...z, jetzt });
  }

  private formFertig(z: Fzug): void {
    this.fzug.set(null);
    const { von, jetzt } = z;
    if (von.x === jetzt.x && von.y === jetzt.y && von.w === jetzt.w && von.h === jetzt.h) return;
    const f = this.formen().find((x) => x.id === z.id);
    if (!f) return;
    /* Gestreckt werden auch die Punkte — sie stehen relativ zur Ecke. */
    const sx = von.w ? jetzt.w / von.w : 1;
    const sy = von.h ? jetzt.h / von.h : 1;
    const points = f.points.map(([x, y]) => [Math.round(x * sx), Math.round(y * sy)] as [number, number]);
    this.formAendern(f.id, { ...jetzt, points });
  }

  private strichZiehen(ev: PointerEvent, st: Strich): void {
    const p = this.punkt(ev);
    if (st.kind === 'pen') {
      const letzter = st.punkte[st.punkte.length - 1]!;
      if (Math.hypot(p[0] - letzter[0], p[1] - letzter[1]) < 3) return;
      this.strich.set({ ...st, punkte: [...st.punkte, p] });
    } else {
      this.strich.set({ ...st, punkte: [st.punkte[0]!, p] });
    }
  }

  /** Die Vorschau dessen, was gerade gezeichnet wird. */
  protected readonly strichForm = computed<BoardShape | null>(() => {
    const st = this.strich();
    return st ? this.ausStrich(st, 'vorschau') : null;
  });

  private ausStrich(st: Strich, id: string): BoardShape {
    const punkte = st.punkte.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]);
    const flaeche = st.kind === 'rect' || st.kind === 'ellipse';
    const box = fitPoints(flaeche ? [punkte[0]!, punkte[punkte.length - 1]!] : punkte);
    return newShape(st.kind, {
      id,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      points: flaeche ? [] : box.points,
      color: this.farbe(),
      stroke: this.staerke(),
      fill: flaeche && this.fuellen() ? this.farbe() : '',
      z: this.obenauf() + 1,
    });
  }

  private strichFertig(st: Strich): void {
    this.strich.set(null);
    const f = this.ausStrich(st, `sh-${crypto.randomUUID()}`);
    /* Ein Antippen ist kein Strich. */
    if (Math.hypot(f.w, f.h) < SHAPE_MIN.w) return;
    this.formHinlegen(f);
  }

  private formHinlegen(f: BoardShape): void {
    const b = this.stand();
    if (!b) return;
    const neu = { ...f, z: f.z || this.obenauf() + 1 };
    this.formGewaehlt.set(neu.id);
    this.gewaehlt.set(null);
    void this.schreiben(withShapes(b, [...this.formen(), neu]));
  }

  protected formAendern(id: string, teil: Partial<BoardShape>): void {
    const b = this.stand();
    if (!b) return;
    void this.schreiben(withShapes(b, this.formen().map((f) => (f.id === id ? { ...f, ...teil } : f))));
  }

  protected formLoeschen(id: string): void {
    const b = this.stand();
    if (!b) return;
    this.formGewaehlt.set(null);
    void this.schreiben(withShapes(b, this.formen().filter((f) => f.id !== id)));
  }

  protected nachVorn(f: BoardShape): void {
    this.formAendern(f.id, { z: this.obenauf() + 1 });
  }

  protected nachHinten(f: BoardShape): void {
    const zs = [...this.kanten().map((k) => placementOf(k).z), ...this.formen().map((x) => x.z)];
    this.formAendern(f.id, { z: Math.min(0, ...zs) - 1 });
  }

  /** Entf löscht die gewählte Form — nicht, solange man in einem Feld tippt. */
  protected taste(ev: KeyboardEvent): void {
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
    const t = ev.target as HTMLElement | null;
    if (t?.closest('input, textarea, select, [contenteditable]')) return;
    const f = this.gewaehlteForm();
    if (!f || !this.darfSchreiben()) return;
    ev.preventDefault();
    this.formLoeschen(f.id);
  }

  /** Die Mitte dessen, was man gerade sieht — dorthin kommt ein neues Bild. */
  private sichtMitte(): [number, number] {
    const buehne = this.buehne()?.nativeElement;
    if (!buehne) return [200, 200];
    const z = this.zoom();
    return [(buehne.scrollLeft + buehne.clientWidth / 2) / z, (buehne.scrollTop + buehne.clientHeight / 2) / z];
  }

  protected bildHinlegen(asset: string): void {
    if (!asset) return;
    const f = this.gewaehlteForm();
    if (f?.kind === 'image') {
      this.neuesBild = f.id;
      this.formAendern(f.id, { asset });
      return;
    }
    const [mx, my] = this.sichtMitte();
    const neu = newShape('image', { id: `sh-${crypto.randomUUID()}`, x: Math.max(0, Math.round(mx - 160)), y: Math.max(0, Math.round(my - 120)), w: 320, h: 240, asset });
    this.neuesBild = neu.id;
    this.formHinlegen(neu);
    this.werkzeug.set('auswahl');
  }

  protected bildGeladen(f: BoardShape, ev: Event): void {
    if (this.neuesBild !== f.id) return;
    this.neuesBild = null;
    const img = ev.target as HTMLImageElement;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const h = Math.round((f.w * img.naturalHeight) / img.naturalWidth);
    if (Math.abs(h - f.h) > 2) this.formAendern(f.id, { h });
  }

  // --------------------------------------------------------- Hintergrund

  protected readonly hintergrund = computed<BoardBackground>(() => {
    const b = this.stand();
    return b ? boardBackground(b) : { image: '', color: '', fit: 'stretch', map: '' };
  });

  protected hintergrundSetzen(teil: Partial<BoardBackground>): void {
    const b = this.stand();
    if (b) void this.schreiben(withBackground(b, teil));
  }

  protected fitSetzen(v: string): void {
    this.hintergrundSetzen({ fit: v as BackgroundFit });
  }

  /** Wie das Bild als CSS liegt — gekachelt, gestreckt, einmal. */
  protected readonly grundStil = computed(() => {
    const bg = this.hintergrund();
    const url = bildAdresse(bg.image);
    return {
      farbe: bg.color || null,
      bild: url ? `url("${url}")` : null,
      groesse: bg.fit === 'stretch' ? '100% 100%' : 'auto',
      wiederholen: bg.fit === 'tile' ? 'repeat' : 'no-repeat',
    };
  });

  /** Die Karte im Hintergrund, wie der Server sie diesem Betrachter schickt (gesiebt, T-312). */
  protected readonly grundKarte = computed(() => {
    const id = this.hintergrund().map;
    const e = id ? this.bestand.voll().get(id) : undefined;
    return e && isMap(e) ? e : undefined;
  });
  protected readonly grundBlaetter = computed(() => {
    const e = this.grundKarte();
    /* Spielenden fehlen die Blätter der Leitung schon am Server (`redactMap`). */
    return e ? drawnSheets(e, this.darfSchreiben()).filter((s) => !s.hidden) : [];
  });
  /** Höhe durch Breite der Hintergrundkarte, sobald ihr Bild geladen ist. */
  protected readonly grundVerhaeltnis = signal(0);
  protected grundGeladen(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img.naturalWidth) this.grundVerhaeltnis.set(img.naturalHeight / img.naturalWidth);
  }

  protected karteGewaehlt(e: Entity): void {
    if (this.karteAls() === 'grund') {
      this.hintergrundSetzen({ map: e.id });
      this.werkzeug.set('auswahl');
      return;
    }
    this.hinlegen(e, 480, 360);
  }

  protected istKarte(k: Karte): boolean {
    /* Eine Karte ohne eigene Wahl ist die Karte selbst, nicht ihr Steckbrief. */
    return !!k.ziel && isMap(k.ziel) && !k.rel.props?.['view'];
  }

  protected verbergen(rel: Relation): void {
    this.aendern(rel.id, { hidden: rel.props?.['hidden'] === true ? undefined : true });
  }

  // ---------------------------------------------- Unendliche Leinwand (T-339)

  /**
   * **Wie gross die Leinwand gerade ist**: was das Board sagt (`boardExtent`),
   * dazu, was gerade gezogen oder gezeichnet wird — so wächst sie unter dem
   * Finger mit, statt am Rand anzuschlagen.
   */
  protected readonly ausdehnung = computed(() => {
    const b = this.stand();
    if (!b) return { width: 2400, height: 1500 };
    const extra: { x: number; y: number; w: number; h: number }[] = [];
    const z = this.zug();
    if (z) extra.push(z.jetzt);
    const bz = this.bzug();
    if (bz) extra.push(bz.jetzt);
    const fz = this.fzug();
    if (fz) extra.push(fz.jetzt);
    const st = this.strichForm();
    if (st) extra.push(st);
    const r = this.rahmen();
    if (r) extra.push(r);
    const v = this.grundVerhaeltnis();
    if (this.grundKarte() && v) {
      const w = boardCard(b).width;
      extra.push({ x: 0, y: 0, w, h: Math.round(w * v) });
    }
    return boardExtent(b, extra);
  });

  /** Breite der Hintergrundkarte: die Mindestbreite des Boards — sie wandert nicht mit dem Inhalt. */
  protected readonly grundBreite = computed(() => {
    const b = this.stand();
    return b ? boardCard(b).width : 2400;
  });

  /** „Fit all“: alles, was daraufliegt, in den Kasten. */
  protected allesZeigen(): void {
    const b = this.stand();
    const buehne = this.buehne()?.nativeElement;
    const r = b ? boardContentBounds(b) : null;
    if (!r || !buehne) return;
    const rand = 32;
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min((buehne.clientWidth - rand) / Math.max(1, r.w), (buehne.clientHeight - rand) / Math.max(1, r.h), 1.5)));
    this.zoom.set(Math.floor(z * 100) / 100);
    requestAnimationFrame(() => {
      const zz = this.zoom();
      buehne.scrollTo({ left: Math.max(0, r.x * zz - rand / 2), top: Math.max(0, r.y * zz - rand / 2) });
    });
  }

  /** Strg/⌘ + Rad zoomt um den Zeiger; ohne scrollt die Leinwand wie jede Fläche. */
  protected rad(ev: WheelEvent): void {
    if (!ev.ctrlKey && !ev.metaKey) return;
    const buehne = this.buehne()?.nativeElement;
    if (!buehne) return;
    ev.preventDefault();
    const alt = this.zoom();
    const neu = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, alt * (ev.deltaY < 0 ? 1.1 : 1 / 1.1))) * 100) / 100;
    if (neu === alt) return;
    const kasten = buehne.getBoundingClientRect();
    const ox = ev.clientX - kasten.left;
    const oy = ev.clientY - kasten.top;
    const lx = (buehne.scrollLeft + ox) / alt;
    const ly = (buehne.scrollTop + oy) / alt;
    this.zoom.set(neu);
    requestAnimationFrame(() => {
      buehne.scrollLeft = lx * neu - ox;
      buehne.scrollTop = ly * neu - oy;
    });
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
