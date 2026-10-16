import { Component, input, output } from '@angular/core';

/** Eine Aktion der Leiste: ein Zeichen und ein Wort — am Telefon nur das Zeichen. */
export interface LeistenAktion {
  id: string;
  icon: string;
  label: string;
  /** Gesperrt, mit Grund im Titel. */
  gesperrt?: boolean;
  grund?: string;
}

/**
 * **Die schwebende Werkzeugleiste** (T-247): unten mittig, solange etwas
 * gewählt ist — Titel, Aktionen (Zeichen mit Wort), Rückgängig, Fertig.
 * Auf dem Telefon kompakt (nur Zeichen), und „Details" öffnet ein Blatt
 * von unten (`nw-unterblatt`).
 *
 * Ein Muster und kein Teil der Spielerseite (Die Leitung: „ein gutes
 * Pattern, das wir auch andernorts wiederverwenden können wie für
 * Karten“): sie weiss nichts von dem, was gewählt ist — die Seite gibt
 * Titel und Aktionen und hört auf `aktion`, `rueckgaengig`, `fertig`.
 */
@Component({
  selector: 'nw-werkzeugleiste',
  template: `
    <div class="leiste" role="toolbar" [attr.aria-label]="beschriftung() || titel()">
      <b class="titel" [attr.title]="titel()">{{ titel() }}</b>
      @if (hinweis()) {
        <span class="hinweis">{{ hinweis() }}</span>
      }
      @for (a of aktionen(); track a.id) {
        <button
          type="button"
          class="aktion"
          [disabled]="a.gesperrt"
          [attr.title]="a.grund || a.label"
          [attr.aria-label]="a.label"
          (click)="aktion.emit(a.id)"
        >
          <span class="icon" aria-hidden="true">{{ a.icon }}</span><span class="wort">{{ a.label }}</span>
        </button>
      }
      @if (rueckgaengigMoeglich() !== null) {
        <button
          type="button"
          class="aktion"
          [attr.aria-disabled]="!rueckgaengigMoeglich()"
          [class.aus]="!rueckgaengigMoeglich()"
          aria-label="Undo"
          title="Undo"
          (click)="rueckgaengigMoeglich() && rueckgaengig.emit()"
        >
          <span class="icon" aria-hidden="true">↶</span><span class="wort">Undo</span>
        </button>
      }
      @if (mitDetails()) {
        <button type="button" class="details" [attr.aria-expanded]="detailsOffen()" (click)="details.emit()">Details</button>
      }
      <button type="button" class="fertig" (click)="fertig.emit()">Done</button>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      z-index: 8;
      max-width: calc(100% - 16px);
    }
    .leiste {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.5rem;
      border: 2px solid var(--accent);
      border-radius: 10px;
      background: var(--surface);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
      white-space: nowrap;
      overflow-x: auto;
    }
    .titel {
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--heading);
    }
    .hinweis {
      color: var(--dim);
      font-size: 0.85rem;
    }
    button {
      min-height: 36px;
      padding: 0 0.55rem;
      font-size: 0.9rem;
      flex: none;
    }
    .aktion {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .icon {
      font-size: 1.05rem;
    }
    .aus {
      opacity: 0.4;
      cursor: default;
    }
    .details {
      display: none;
    }
    .fertig {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
    }
    @media (max-width: 760px) {
      .wort,
      .hinweis {
        display: none;
      }
      .titel {
        max-width: 7rem;
      }
      .details {
        display: inline-block;
      }
    }
  `,
})
export class Werkzeugleiste {
  readonly titel = input.required<string>();
  /** Für Vorleser, wenn der Titel allein nicht sagt, was die Leiste tut („Move item"). */
  readonly beschriftung = input<string>('');
  readonly hinweis = input<string>('');
  readonly aktionen = input<readonly LeistenAktion[]>([]);
  /** `null`: kein Rückgängig; sonst, ob es gerade etwas zurückzunehmen gibt. */
  readonly rueckgaengigMoeglich = input<boolean | null>(null);
  /** Gibt es ein Blatt mit Details (am Telefon über „Details")? */
  readonly mitDetails = input(false);
  readonly detailsOffen = input(false);

  readonly aktion = output<string>();
  readonly rueckgaengig = output<void>();
  readonly details = output<void>();
  readonly fertig = output<void>();
}

/**
 * **Das Blatt von unten** (T-247), der Begleiter der Werkzeugleiste: auf
 * breiten Bildschirmen steht sein Inhalt an seinem Ort in der Seite, auf
 * dem Telefon ist er verborgen, bis „Details" ihn als Blatt von unten
 * öffnet — statt weit oben auf der Seite, wo man ihn nicht sieht.
 */
@Component({
  selector: 'nw-unterblatt',
  template: `
    <div class="blatt" [class.offen]="offen()" [attr.aria-label]="titel()" role="region">
      <div class="kopf">
        <b>{{ titel() }}</b>
        <button type="button" (click)="schliessen.emit()">Close</button>
      </div>
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .kopf {
      display: none;
    }
    @media (max-width: 760px) {
      .blatt {
        display: none;
      }
      .blatt.offen {
        display: block;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        max-height: 72vh;
        overflow-y: auto;
        z-index: 9;
        padding: 0.75rem 1rem 1.25rem;
        background: var(--surface);
        border-top: 2px solid var(--accent);
        border-radius: 12px 12px 0 0;
        box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.25);
      }
      .kopf {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
    }
  `,
})
export class Unterblatt {
  readonly titel = input('Details');
  readonly offen = input(false);
  readonly schliessen = output<void>();
}
