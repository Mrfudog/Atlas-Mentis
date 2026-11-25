import { Injectable, signal } from '@angular/core';

/**
 * **Die Ablage** (T-425, REQ-436, E-171): was „Copy" zuletzt genommen hat,
 * für „Paste" an einer anderen Stelle — ein Muster für jede Leiste, nicht
 * nur den Designer. Sie hält eine Sorte und einen Wert und weiss nichts
 * davon; wer einfügt, fragt nach seiner Sorte. Sie lebt im Browserfenster
 * und geht mit ihm: nichts davon wird gespeichert.
 */
@Injectable({ providedIn: 'root' })
export class Ablage {
  private readonly inhalt = signal<{ sorte: string; wert: unknown; name: string } | null>(null);

  /** Was gerade abliegt — Sorte und Name, für Knopf und Hinweis. */
  readonly stand = this.inhalt.asReadonly();

  nimm(sorte: string, wert: unknown, name: string): void {
    this.inhalt.set({ sorte, wert: structuredClone(wert), name });
  }

  /** Was abliegt, wenn es diese Sorte ist — als Kopie, damit Einfügen die Ablage nicht ändert. */
  hole<T>(sorte: string): T | null {
    const x = this.inhalt();
    return x && x.sorte === sorte ? (structuredClone(x.wert) as T) : null;
  }
}
