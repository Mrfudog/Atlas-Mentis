import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Api, type KampagnenEbene, type KampagnenEbenen } from '../kern/api';

/**
 * **Die Ebenen einer Kampagne** (T-069, E-008) — auf der Kampagnenseite,
 * unter den Mitgliedern: je Ebene ein Häkchen (aufgeschaltet ja/nein) und
 * für die aufgeschalteten die Reihenfolge. Geschrieben werden die Kanten
 * `activates` an der Kampagne, der ganze Stapel auf einmal
 * (`PUT /api/campaigns/:c/layers`).
 *
 * Was eine Kampagne zeigt, ist ihre wichtigste Einstellung. Die Kante hiess
 * in der Maske „runs on", und die Leitung fand sie nicht, als nach dem
 * Anlegen einer Kampagne alle Artikel aus 5e.tools fehlten.
 *
 * Oben steht die spezifischste Ebene — sie gewinnt, wenn zwei dasselbe
 * sagen. Was der Server nicht annähme, bietet die Seite nicht an
 * (`may`, `canActivate`).
 */
@Component({
  selector: 'nw-kampagnen-ebenen',
  template: `
    <section class="kasten" aria-label="Layers in play">
      <h2>Layers in play</h2>
      <p class="fuss">
        The lists of this campaign show what its layers bring, and articles without a layer. A layer
        higher up wins where two say the same. Turning a layer off deletes nothing.
      </p>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (daten(); as d) {
        <ul class="ebenen">
          @for (l of oben(); track l.id; let i = $index, last = $last) {
            <li [class.aus]="!l.active">
              <label class="haken">
                <input
                  type="checkbox"
                  [checked]="l.active"
                  [disabled]="!aenderbar(l) || laeuft()"
                  (change)="umschalten(l)"
                />
                <span class="name">{{ l.name }}</span>
              </label>
              <span class="dim">
                @if (l.kind) {
                  {{ l.kind }} ·
                }
                {{ zahl(l.articles) }} {{ l.articles === 1 ? 'article' : 'articles' }}
                @if (l.alsoIn.length) {
                  · also in {{ l.alsoIn.join(', ') }}
                }
                @if (!l.active && !l.canActivate && d.may === 'manage') {
                  · belongs to another campaign; the admin can turn it on
                }
              </span>
              @if (l.active && d.may === 'manage') {
                <span class="knoepfe">
                  <button
                    type="button"
                    class="klein"
                    [disabled]="i === 0 || laeuft()"
                    [attr.aria-label]="'Move ' + l.name + ' up'"
                    (click)="schieben(l, 1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="klein"
                    [disabled]="last || !naechsteAktiv(i) || laeuft()"
                    [attr.aria-label]="'Move ' + l.name + ' down'"
                    (click)="schieben(l, -1)"
                  >
                    ↓
                  </button>
                </span>
              }
            </li>
          } @empty {
            <li class="dim">There is no layer yet. Everything is in play.</li>
          }
        </ul>
        @if (d.may === 'see') {
          <p class="fuss">A co-GM sees the layers; the GM turns them on.</p>
        }
      } @else if (!fehler()) {
        <p class="dim">Loading…</p>
      }
    </section>
  `,
  styles: `
    /* Wie die übrigen Kästen der Kampagnenseite (verwaltung.scss). */
    .kasten {
      min-width: 0;
      margin: 0 1.5rem 1rem;
      padding: 0.9rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    @media (max-width: 640px) {
      .kasten {
        margin: 0 1rem 1rem;
      }
    }
    h2 {
      margin: 0 0 0.25rem;
      font-family: var(--caps);
      font-size: 1.25rem;
      color: var(--accent);
    }
    .fuss {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .ebenen {
      margin: 0.5rem 0 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
      padding: 0.45rem 0;
      border-top: 1px solid var(--line2);
    }
    li:first-child {
      border-top: 0;
    }
    li.aus .name {
      color: var(--dim);
    }
    .haken {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 40px;
      flex: 1 1 14rem;
      min-width: 0;
    }
    .haken input {
      width: 1.1rem;
      height: 1.1rem;
    }
    .name {
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .dim {
      color: var(--dim);
    }
    .knoepfe {
      display: inline-flex;
      gap: 0.25rem;
      margin-left: auto;
    }
    .klein {
      min-width: 40px;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }
    .klein[disabled] {
      opacity: 0.4;
      cursor: default;
    }
    .fehler {
      color: var(--warn);
    }
  `,
})
export class KampagnenEbenenListe {
  readonly kampagne = input.required<string>();

  private readonly api = inject(Api);
  protected readonly daten = signal<KampagnenEbenen | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);

  constructor() {
    effect(() => {
      const c = this.kampagne();
      void this.laden(c);
    });
  }

  private async laden(c: string): Promise<void> {
    try {
      const d = await this.api.campaignLayers(c);
      if (c !== this.kampagne()) return;
      this.daten.set(d);
      this.fehler.set(null);
    } catch (error) {
      this.daten.set(null);
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** Die aufgeschalteten, oben die spezifischste; darunter die übrigen. */
  protected readonly oben = computed(() => {
    const l = this.daten()?.layers ?? [];
    return [...l.filter((x) => x.active).reverse(), ...l.filter((x) => !x.active)];
  });

  /** Der Stapel von unten nach oben, wie der Server ihn will. */
  private stapel(): string[] {
    return (this.daten()?.layers ?? []).filter((x) => x.active).map((x) => x.id);
  }

  protected aenderbar(l: KampagnenEbene): boolean {
    if (this.daten()?.may !== 'manage') return false;
    return l.active || l.canActivate;
  }

  protected naechsteAktiv(i: number): boolean {
    return this.oben()[i + 1]?.active === true;
  }

  protected zahl(n: number): string {
    return n.toLocaleString('en');
  }

  protected umschalten(l: KampagnenEbene): void {
    if (l.active) {
      void this.schreiben(this.stapel().filter((id) => id !== l.id));
    } else {
      /* Der Server setzt eine neue Ebene dorthin, wo ihre Spezifität sie
         hinstellt (ein Regelwerk unten); verschieben geht danach. */
      void this.schreiben(null, l.id);
    }
  }

  /** `um` 1 heisst nach oben (spezifischer), −1 nach unten. */
  protected schieben(l: KampagnenEbene, um: 1 | -1): void {
    const s = this.stapel();
    const i = s.indexOf(l.id);
    const j = i + um;
    if (i < 0 || j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j]!, s[i]!];
    void this.schreiben(s);
  }

  private async schreiben(stapel: string[] | null, dazu?: string): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      if (stapel) await this.api.setCampaignLayers(c, stapel);
      else if (dazu) await this.api.activateLayer(c, dazu);
      await this.laden(c);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}
