import { signal, type WritableSignal } from '@angular/core';
import { DRAW_SHAPES, drawShape, wallKind, type DrawShape, type WallKind } from '@nw/model';

/** Unter diesem Schlüssel merkt sich der Browser die Schalter des Editors. */
const SCHLUESSEL = 'nw.karteneditor';

interface Gemerkt {
  form: DrawShape;
  closed: boolean;
  cut: boolean;
  points: boolean;
  snap: boolean;
  strength: number;
  doorWidth: number;
}

const VORGABE: Gemerkt = {
  form: 'polyline',
  closed: false,
  cut: true,
  points: false,
  snap: true,
  strength: 12,
  doorWidth: 25,
};

function lesen(): Gemerkt {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}') as Partial<Gemerkt>;
    return { ...VORGABE, ...roh, form: drawShape(roh.form).key };
  } catch {
    return { ...VORGABE };
  }
}

/** Die Fangstärke in Bildschirmpunkten: von aus bis grob. */
export const STAERKE_MIN = 4;
export const STAERKE_MAX = 40;
/** Ein Finger trifft ungenauer als ein Mauszeiger: am Telefon fängt derselbe Regler weiter. */
export const FINGER_FAKTOR = 1.6;

/**
 * **Die Schalter des Karteneditors** (T-304): Form, „Closed“, Schneiden,
 * Punkte zeigen, Einrasten und seine Stärke, die Türdicke. Sie gehören dem
 * Werkzeug und nicht der Karte — wer gerade Räume zeichnet, will auf der
 * nächsten Karte dieselben —, darum merkt sie sich der Browser
 * (`localStorage`, eine Bequemlichkeit: ohne ihn gilt die Vorgabe).
 */
export class EditorStand {
  private readonly stand = lesen();
  readonly form: WritableSignal<DrawShape> = signal(this.stand.form);
  readonly geschlossen = signal(this.stand.closed);
  readonly schneiden = signal(this.stand.cut);
  readonly punkte = signal(this.stand.points);
  readonly einrasten = signal(this.stand.snap);
  readonly staerke = signal(Math.min(STAERKE_MAX, Math.max(STAERKE_MIN, this.stand.strength)));
  /** Die Dicke einer neuen Tür in Prozent eines Feldes. */
  readonly tuerDicke = signal(Math.min(100, Math.max(5, this.stand.doorWidth)));

  readonly FORMEN = DRAW_SHAPES;

  setzen<K extends keyof Gemerkt>(k: K, v: Gemerkt[K]): void {
    const ziel: Record<keyof Gemerkt, WritableSignal<unknown>> = {
      form: this.form,
      closed: this.geschlossen,
      cut: this.schneiden,
      points: this.punkte,
      snap: this.einrasten,
      strength: this.staerke,
      doorWidth: this.tuerDicke,
    };
    ziel[k].set(v);
    try {
      localStorage.setItem(
        SCHLUESSEL,
        JSON.stringify({
          form: this.form(),
          closed: this.geschlossen(),
          cut: this.schneiden(),
          points: this.punkte(),
          snap: this.einrasten(),
          strength: this.staerke(),
          doorWidth: this.tuerDicke(),
        }),
      );
    } catch {
      /* Ohne Speicher gilt der Stand bis zum Neuladen. */
    }
  }

  /**
   * Die Form, mit der diese Art gezeichnet wird: **eine Tür ist immer eine
   * Linie** über der Öffnung — zwei Punkte, das Viereck kommt aus der Dicke.
   */
  formFuer(kind: WallKind): DrawShape {
    return wallKind(kind).door ? 'line' : this.form();
  }
}
