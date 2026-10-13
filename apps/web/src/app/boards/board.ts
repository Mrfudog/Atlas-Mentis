import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  areaOf,
  boardCard,
  entityName,
  INSTANCE_RELATION,
  isInstance,
  LAYER_RELATION,
  nextPlacement,
  PLACED_RELATION,
  PLACEMENT_MIN,
  placementOf,
  placementsOf,
  placementView,
  primaryInterface,
  snapTo,
  viewKeys,
} from '@nw/model';
import type { BoardPlacement, Entity, Relation } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Brett, chainAbove, isBoard, storyOf, type Mangel } from './brett';
import { Kachel } from './kachel';
import { BoardSuche } from './suche';

interface Karte {
  rel: Relation;
  platz: BoardPlacement;
  ziel: Entity | undefined;
  /** Die Kurzfassung — Name und Art stehen, bevor der ganze Artikel da ist. */
  kurz: Entity | undefined;
  ansicht: string;
  bereich: string;
}

interface Zug {
  id: string;
  art: 'schieben' | 'groesse';
  sx: number;
  sy: number;
  von: BoardPlacement;
  jetzt: BoardPlacement;
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
  imports: [RouterLink, Kachel, BoardSuche],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  host: {
    '(window:pointermove)': 'bewegen($event)',
    '(window:pointerup)': 'loslassen()',
    '(window:pointercancel)': 'abbrechen()',
  },
})
export class Board {
  readonly id = input.required<string>();

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
      for (const k of this.kanten()) void this.bestand.oeffnen(k.to, false, false);
    });
    /* Am Telefon passt eine Leinwand von 2400 px nicht; sie fängt
       verkleinert an, statt dass man zuerst sucht, wo etwas liegt. */
    if (typeof window !== 'undefined' && window.innerWidth < 700) this.zoom.set(0.5);
  }

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
  private readonly entwurf = signal<Relation[] | null>(null);
  protected readonly kanten = computed<Relation[]>(() => {
    const b = this.board();
    if (!b) return [];
    return placementsOf({ ...b, relations: this.entwurf() ?? b.relations ?? [] });
  });

  protected readonly zoom = signal(1);
  protected readonly gewaehlt = signal<string | null>(null);
  private readonly zug = signal<Zug | null>(null);

  protected readonly karten = computed<Karte[]>(() => {
    const b = this.board();
    const r = this.bestand.registry();
    if (!b || !r) return [];
    const voll = this.bestand.voll();
    const byId = this.bestand.byId();
    const z = this.zug();
    return this.kanten().map((rel) => {
      const ziel = voll.get(rel.to);
      const kurz = ziel ?? byId.get(rel.to);
      const platz = z && z.id === rel.id ? z.jetzt : placementOf(rel);
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
      };
    });
  });

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
    return r ? viewKeys(r).filter((k) => k !== 'full') : [];
  });

  /** Kampagne › Kapitel › Sitzung — und je Sprosse ihr Board, wenn sie eines hat. */
  protected readonly pfad = computed(() => {
    const b = this.board();
    if (!b) return [];
    const s = storyOf(b);
    if (!s) return [];
    const byId = this.bestand.byId();
    const story = byId.get(s);
    if (!story) return [];
    const boards = this.bestand.entities().filter(isBoard);
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
    const byId = this.bestand.byId();
    const voll = this.bestand.voll();
    const nicht = new Set([LAYER_RELATION, INSTANCE_RELATION, PLACED_RELATION]);
    const out = new Map<string, Entity>();
    for (const k of this.kanten()) {
      for (const rel of voll.get(k.to)?.relations ?? []) {
        if (nicht.has(rel.type) || liegt.has(rel.to) || rel.to === b.id) continue;
        const e = byId.get(rel.to);
        if (e && !isInstance(e)) out.set(e.id, e);
      }
    }
    return [...out.values()].sort((a, c) => entityName(a).localeCompare(entityName(c), 'de'));
  });

  /** Was auf dem Board liegt und noch nicht fertig ist (`Status`, REQ-188). */
  protected readonly offen = computed(() => {
    const byId = this.bestand.byId();
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
    const platz = nextPlacement({ ...b, relations: this.kanten() });
    const neu: Relation = {
      id: `r-${crypto.randomUUID()}`,
      type: PLACED_RELATION,
      to: e.id,
      props: { x: platz.x, y: platz.y, w: platz.w, h: platz.h, z: platz.z },
    };
    this.gewaehlt.set(neu.id);
    void this.schreiben([...this.alleKanten(), neu]);
  }

  protected wegnehmen(rel: Relation): void {
    void this.schreiben(this.alleKanten().filter((r) => r.id !== rel.id));
  }

  protected ansichtSetzen(rel: Relation, view: string): void {
    this.aendern(rel.id, { view: view || undefined });
  }

  // ----------------------------------------------------------------- Ziehen

  protected greifen(ev: PointerEvent, k: Karte, art: Zug['art']): void {
    if (!this.darfSchreiben() || k.platz.locked || ev.button !== 0) return;
    /* Ein Knopf, eine Auswahl oder der Name in der Kopfzeile tun ihr
       Eigenes; gezogen wird an der freien Fläche. */
    const t = ev.target as HTMLElement | null;
    if (art === 'schieben' && t?.closest('a, button, select')) return;
    ev.preventDefault();
    this.gewaehlt.set(k.rel.id);
    this.zug.set({ id: k.rel.id, art, sx: ev.clientX, sy: ev.clientY, von: k.platz, jetzt: k.platz });
  }

  protected bewegen(ev: PointerEvent): void {
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
  }

  protected zoomen(schritt: number): void {
    this.zoom.update((z) => Math.round(Math.min(1.5, Math.max(0.3, z + schritt)) * 10) / 10);
  }

  // -------------------------------------------------------------- Schreiben

  protected readonly speichert = signal(false);
  protected readonly fehler = signal<Mangel | null>(null);
  private wartet: Relation[] | null = null;

  /** Alle Kanten des Boards, nicht nur die Platzierungen — `partOf` und `inLayer` bleiben. */
  private alleKanten(): Relation[] {
    return this.entwurf() ?? this.board()?.relations ?? [];
  }

  private aendern(id: string, props: Record<string, unknown>): void {
    const kanten = this.alleKanten().map((r) => {
      if (r.id !== id) return r;
      const neu: Record<string, unknown> = { ...(r.props ?? {}), ...props };
      for (const k of Object.keys(neu)) if (neu[k] === undefined) delete neu[k];
      return { ...r, props: neu };
    });
    void this.schreiben(kanten);
  }

  /**
   * Eins nach dem anderen: läuft ein Schreiben, wartet der neueste Stand
   * und geht danach — zwei gleichzeitige PUTs könnten in der falschen
   * Reihenfolge ankommen, und dann gälte der ältere Griff.
   */
  private async schreiben(kanten: Relation[]): Promise<void> {
    this.entwurf.set(kanten);
    this.fehler.set(null);
    if (this.speichert()) {
      this.wartet = kanten;
      return;
    }
    this.speichert.set(true);
    let naechste: Relation[] | null = kanten;
    while (naechste) {
      const b = this.board();
      if (!b) break;
      const fehler = await this.brett.schreiben({ ...b, relations: naechste });
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
