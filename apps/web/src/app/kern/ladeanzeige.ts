import { Component, input } from '@angular/core';

/**
 * **Die Ladeanzeige** (T-126, Punkt 8): ein Kreis, der sich dreht, solange
 * ein grosses Bild lädt — eine Karte ist 5–30 MB (E-032), und eine leere
 * Fläche sieht bis dahin aus wie eine kaputte.
 *
 * Eine Komponente und nicht ein Stück CSS je Ort, weil der Design-Lauf
 * (T-135) einen eigenen Spinner bringt: dann wird **diese** Datei
 * ausgetauscht, und Karte, Artikelbild und Leseansicht bleiben, wie sie
 * sind. Wer sie setzt, sagt, was lädt (`label`), und legt sie über die
 * Fläche, die gerade leer ist — wo sie steht, bestimmt der Ort.
 */
@Component({
  selector: 'nw-ladeanzeige',
  host: { role: 'status' },
  template: `
    <span class="kreis" aria-hidden="true"></span>
    <span class="nur-vorlesen">{{ label() }}</span>
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
    }
    .kreis {
      width: 2rem;
      height: 2rem;
      box-sizing: border-box;
      border: 3px solid var(--line);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: drehen 0.9s linear infinite;
    }
    @keyframes drehen {
      to {
        transform: rotate(360deg);
      }
    }
    /* Wer weniger Bewegung will, sieht sie langsamer — ganz still sähe
       sie aus wie ein hängengebliebenes Bild. */
    @media (prefers-reduced-motion: reduce) {
      .kreis {
        animation-duration: 2.4s;
      }
    }
    .nur-vorlesen {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class Ladeanzeige {
  /** Was lädt — für Vorleseprogramme; zu sehen ist nur der Kreis. */
  readonly label = input('Loading image …');
}
