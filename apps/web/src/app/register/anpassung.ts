import { Component, computed, inject, input, output } from '@angular/core';
import { applyAdjust } from '@nw/model';
import type { LayoutAdjust, LayoutElement } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { ELEMENTE, eintragText, RegAnordnung, RegFeldwahl } from './anordnung';

/**
 * **Die geerbte Anordnung, hier angepasst** (T-110, `LayoutAdjust`): je
 * Element ein Haken (zeigen oder nicht), die Reihenfolge, Felder, die ein
 * Element hier dazunimmt, Einträge, die hier nirgends erscheinen, und
 * Elemente, die nur hier stehen.
 *
 * Gespeichert wird nur die Abweichung. Ändert sich die Ansicht oder der
 * Obertyp, gilt die Anpassung über dem Neuen — eine Abschrift bliebe beim
 * Alten stehen.
 */
@Component({
  selector: 'nw-reg-anpassung',
  imports: [RegFeldwahl, RegAnordnung],
  template: `
    <ol class="anordnung">
      @for (el of reihe(); track el.id; let i = $index; let erstes = $first; let letztes = $last) {
        <li class="element" [class.aus]="weg(el.id)">
          <div class="fhead">
            @if (!extra(el.id)) {
              <label class="haken">
                <input type="checkbox" [checked]="!weg(el.id)" [disabled]="!darf()" (change)="zeigen(el.id, $any($event.target).checked)" />
                <b>{{ elLabel(el.el) }}</b>
              </label>
            } @else {
              <b>{{ elLabel(el.el) }}</b> <span class="pill">only here</span>
            }
            <code class="dim">{{ el.id }}</code>
            @if (darf()) {
              <span class="rechts">
                <button type="button" class="klein" [disabled]="erstes" (click)="schieben(i, -1)" aria-label="Move up">↑</button>
                <button type="button" class="klein" [disabled]="letztes" (click)="schieben(i, 1)" aria-label="Move down">↓</button>
              </span>
            }
          </div>
          @if (!weg(el.id) && !extra(el.id) && (el.el === 'fields' || el.el === 'prose')) {
            <p class="hint">{{ nimmtText(el) }}</p>
            @if (el.fields !== 'all') {
              <div class="chips">
                <span class="dim">Adds here:</span>
                @for (f of adjust().add?.[el.id] ?? []; track f) {
                  <span class="chip">
                    {{ eintrag(f) }}
                    @if (darf()) {
                      <button type="button" class="klein" (click)="dazuWeg(el.id, f)" [attr.aria-label]="'Remove ' + f">×</button>
                    }
                  </span>
                } @empty {
                  <span class="dim">nothing</span>
                }
              </div>
              @if (darf()) {
                <nw-reg-feldwahl [nur]="typen()" titel="Add field here" (gewaehlt)="dazu(el.id, $event)" />
              }
            }
          }
        </li>
      }
    </ol>

    <div class="chips">
      <span class="dim">Never shown for this type:</span>
      @for (f of adjust().hide ?? []; track f) {
        <span class="chip">
          {{ eintrag(f) }}
          @if (darf()) {
            <button type="button" class="klein" (click)="versteckWeg(f)" [attr.aria-label]="'Show ' + f + ' again'">×</button>
          }
        </span>
      } @empty {
        <span class="dim">nothing</span>
      }
    </div>
    @if (darf()) {
      <nw-reg-feldwahl [nur]="typen()" titel="Hide" knopf="Hide" (gewaehlt)="verstecken($event)" />
    }

    <h4>Elements only here</h4>
    <nw-reg-anordnung [layout]="adjust().extra ?? []" [darf]="darf()" [typen]="typen()" [vergeben]="basisIds()"
      (geaendert)="extraSetzen($event)" />
  `,
})
export class RegAnpassung {
  /** Was geerbt wird — die Anordnung der Kette darüber, sonst der Ansicht. */
  readonly basis = input.required<LayoutElement[]>();
  readonly adjust = input.required<LayoutAdjust>();
  readonly darf = input(false);
  readonly typen = input<readonly string[] | null>(null);
  readonly geaendert = output<LayoutAdjust>();

  private readonly bestand = inject(Bestand);

  /** Alle Elemente, auch die ausgeblendeten, in der Reihenfolge, die gälte. */
  protected readonly reihe = computed(() => {
    const a = this.adjust();
    /* Ohne `drop` gerechnet: ein ausgeblendetes Element soll dastehen, um es wieder einzuschalten. */
    return applyAdjust(this.basis(), { ...a, drop: [] });
  });

  protected readonly basisIds = computed(() => this.basis().map((x) => x.id));

  protected weg(id: string): boolean {
    return (this.adjust().drop ?? []).includes(id);
  }
  protected extra(id: string): boolean {
    return (this.adjust().extra ?? []).some((x) => x.id === id);
  }
  protected elLabel(el: string): string {
    return ELEMENTE.find((e) => e.el === el)?.label ?? el;
  }
  protected eintrag(e: string): string {
    return eintragText(this.bestand.registry(), e);
  }
  protected nimmtText(el: LayoutElement): string {
    const basis = this.basis().find((x) => x.id === el.id);
    if (!basis || basis.fields === 'all' || basis.fields === undefined) return 'Takes every field the type has.';
    return basis.fields.length ? `Takes: ${basis.fields.map((f) => this.eintrag(f)).join(', ')}.` : 'Takes nothing by itself.';
  }

  private neu(f: (a: LayoutAdjust) => void): void {
    const a = structuredClone(this.adjust());
    f(a);
    /* Leere Listen bleiben nicht stehen — eine Anpassung sagt nur, was abweicht. */
    for (const k of ['drop', 'hide', 'order', 'extra'] as const) if (!a[k]?.length) delete a[k];
    if (a.add) {
      for (const [k, v] of Object.entries(a.add)) if (!v.length) delete a.add[k];
      if (!Object.keys(a.add).length) delete a.add;
    }
    this.geaendert.emit(a);
  }
  protected zeigen(id: string, an: boolean): void {
    this.neu((a) => {
      a.drop = an ? (a.drop ?? []).filter((x) => x !== id) : [...new Set([...(a.drop ?? []), id])];
    });
  }
  protected schieben(i: number, um: number): void {
    const ids = this.reihe().map((x) => x.id);
    const [x] = ids.splice(i, 1);
    ids.splice(i + um, 0, x!);
    this.neu((a) => {
      a.order = ids;
    });
  }
  protected dazu(id: string, eintraege: string[]): void {
    this.neu((a) => {
      a.add = { ...(a.add ?? {}), [id]: [...new Set([...(a.add?.[id] ?? []), ...eintraege])] };
    });
  }
  protected dazuWeg(id: string, e: string): void {
    this.neu((a) => {
      if (a.add?.[id]) a.add[id] = a.add[id].filter((x) => x !== e);
    });
  }
  protected verstecken(eintraege: string[]): void {
    this.neu((a) => {
      a.hide = [...new Set([...(a.hide ?? []), ...eintraege])];
    });
  }
  protected versteckWeg(e: string): void {
    this.neu((a) => {
      a.hide = (a.hide ?? []).filter((x) => x !== e);
    });
  }
  protected extraSetzen(l: LayoutElement[]): void {
    this.neu((a) => {
      a.extra = l;
      /* Ein neues Element hat noch keinen Platz in `order`: es steht hinten. */
    });
  }
}
