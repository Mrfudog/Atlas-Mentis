import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { RuleOptionState, RuleSortState, RuleVariantState } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { ExperimenteSchalter } from '../lab/experimente-schalter';

/**
 * **Rules & options** (T-190): die Regeloptionen einer Kampagne, nach
 * Sorte gruppiert, je Option ein Satz, was sie bewirkt, und je Variante der
 * Regelartikel, der sie erklärt. Gerechnet am Server
 * (`GET /api/campaigns/:id/rules`) — hier steht nur, was ankommt.
 *
 * Geändert wird, wo es heute steht: die Felder in der Maske der Kampagne,
 * die Verfahren über ihre Kanten, die Einstellungen der Installation
 * nirgends hier (sie gelten für jede Kampagne, bis T-132 sie ins Modul
 * holt). Fehlt einer Variante ein Regelartikel, schreibt die Leitung ihn —
 * unter dem Namen, unter dem die Seite ihn danach findet (`ownRuleName`).
 */
@Component({
  selector: 'nw-regeloptionen',
  imports: [RouterLink, KurzLink, ExperimenteSchalter],
  template: `
    <section class="regeln" aria-labelledby="regeln-titel">
      <header class="kopf">
        <h2 id="regeln-titel">Rules &amp; options</h2>
        <p class="hint">
          How this campaign plays. Each option says what it does; each variant links the rule article that explains it.
        </p>
        @if (darfSchreiben()) {
          <a class="knopf" [routerLink]="['/artikel', kampagne()]" [queryParams]="{ edit: 1 }">Change options</a>
        }
      </header>

      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (laedt() && !sorten().length) {
        <p class="hint">Loading…</p>
      }

      <nav class="inhalt" aria-label="Rule sorts">
        @for (s of sorten(); track s.key) {
          <a [href]="'#regel-' + s.key" (click)="springe($event, s.key)">{{ s.label }}</a>
        }
      </nav>

      @for (s of sorten(); track s.key) {
        <section class="sorte" [id]="'regel-' + s.key">
          <h3>{{ s.label }}</h3>
          <p class="was">{{ s.does }}</p>
          @for (o of s.options; track o.key) {
            <article class="option">
              <div class="optionskopf">
                <h4>{{ o.label }}</h4>
                @if (o.scope === 'installation') {
                  <span class="marke" title="A setting of this installation: it applies to every campaign.">installation-wide</span>
                }
                @if (o.rule; as r) {
                  <a class="regel" [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">Rule: {{ r.name }}</a>
                }
              </div>
              <p class="was">{{ o.does }}</p>

              @if (o.variants) {
                <ul class="varianten">
                  @for (v of o.variants; track v.key) {
                    <li [class.gewaehlt]="v.chosen">
                      <div class="zeile">
                        <span class="name">{{ v.label }}</span>
                        @if (v.chosen) {
                          <span class="marke an">in use</span>
                        }
                        @if (v.rule; as r) {
                          <a class="regel" [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">Rule: {{ r.name }}</a>
                        } @else if (leitet()) {
                          <button type="button" class="klein" [disabled]="schreibt() === v.ownName" (click)="schreibeRegel(o, v)"
                                  [attr.title]="'Create the rule article “' + v.ownName + '” and open it'">
                            {{ schreibt() === v.ownName ? 'Creating…' : 'Write rule article' }}
                          </button>
                        }
                      </div>
                      <p class="was">{{ v.does }}</p>
                    </li>
                  }
                </ul>
              } @else if (o.methods) {
                <ul class="varianten">
                  @for (m of o.methods; track m.id) {
                    <li class="gewaehlt">
                      <div class="zeile">
                        @if (m.builtIn) {
                          <span class="name">{{ m.name }}</span>
                          <span class="marke" title="Applies while the campaign names no method of its own.">default</span>
                        } @else {
                          <a class="name" [routerLink]="['/artikel', m.id]" [nwQuick]="m.id">{{ m.name }}</a>
                        }
                      </div>
                      <p class="was">{{ m.does }}</p>
                    </li>
                  } @empty {
                    <li class="hint">None — add one to the campaign with “{{ o.relation }}”.</li>
                  }
                </ul>
              } @else if (o.value?.length && o.scope === 'installation') {
                <ul class="werte">
                  @for (w of o.value; track w) {
                    <li><code>{{ w }}</code></li>
                  }
                </ul>
              } @else if (o.value?.length) {
                <p class="liste">{{ (o.value ?? []).join(', ') }}</p>
              } @else {
                <p class="hint">{{ o.scope === 'installation' ? 'Not set.' : 'Not set — no limit.' }}</p>
              }
            </article>
          }
        </section>
      }

      <!-- Versuche (T-270): nur Leitung und Verwaltung, Schalter je Konto. -->
      @if (leitet()) {
        <nw-experimente />
      }
    </section>
  `,
  styles: `
    .regeln {
      max-width: 54rem;
      margin: 1rem 0;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.5rem 1rem;
    }
    .kopf h2 {
      margin: 0;
    }
    .kopf .hint {
      flex: 1 1 20rem;
      margin: 0;
    }
    .hint,
    .was {
      color: var(--dim);
    }
    .was {
      margin: 0.2rem 0 0.4rem;
    }
    .inhalt {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.9rem;
      margin: 0.8rem 0;
      padding: 0.5rem 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .inhalt a {
      color: var(--link);
    }
    .sorte {
      margin: 1.2rem 0 1.6rem;
      scroll-margin-top: 4rem;
    }
    .sorte h3 {
      margin: 0 0 0.1rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.2rem;
    }
    .option {
      margin: 0.8rem 0 0.8rem 0.2rem;
    }
    .optionskopf,
    .zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.6rem;
    }
    h4 {
      margin: 0;
      font-size: 1rem;
    }
    .varianten,
    .werte {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .varianten li {
      padding: 0.35rem 0.6rem;
      border-left: 3px solid var(--line);
      margin: 0.2rem 0;
    }
    .varianten li.gewaehlt {
      border-left-color: var(--accent);
      background: var(--surface);
    }
    .varianten .was {
      margin: 0.1rem 0 0;
    }
    .name {
      font-weight: 600;
    }
    .gewaehlt .name {
      color: var(--accent);
    }
    .marke {
      font-size: 0.75rem;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--dim);
    }
    .marke.an {
      border-color: var(--accent);
      color: var(--accent);
    }
    .regel {
      font-size: 0.85rem;
      color: var(--link);
    }
    .werte code {
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }
    .liste {
      margin: 0.2rem 0;
      font-weight: 600;
    }
    button.klein {
      font-size: 0.8rem;
      min-height: 28px;
    }
  `,
})
export class Regeloptionen {
  readonly kampagne = input.required<string>();
  readonly darfSchreiben = input(false);

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  /**
   * Leitet dieses Konto die Kampagne (oder verwaltet die Installation)? Dann
   * darf es einer Variante ihren Regelartikel schreiben — angelegt wird in
   * seiner Schreibebene, nicht im Kampagnenartikel. Anzeige, der Server prüft.
   */
  protected readonly leitet = computed(() => {
    const u = this.session.user();
    const rolle = u?.roles?.[this.kampagne()];
    return !!u && (u.isAdmin || rolle === 'gm' || rolle === 'co-gm');
  });

  protected readonly sorten = signal<RuleSortState[]>([]);
  protected readonly laedt = signal(false);
  protected readonly fehler = signal<string | null>(null);
  /** Der Name der Regel, die gerade angelegt wird. */
  protected readonly schreibt = signal<string | null>(null);

  constructor() {
    effect(() => {
      void this.lade(this.kampagne());
    });
  }

  private async lade(id: string): Promise<void> {
    this.laedt.set(true);
    this.fehler.set(null);
    try {
      this.sorten.set((await this.api.campaignRules(id)).sorts);
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The options could not be loaded.');
    } finally {
      this.laedt.set(false);
    }
  }

  /** Im Reiter springen, ohne die Adresse (und damit den Reiter) zu verlieren. */
  protected springe(ev: Event, key: string): void {
    ev.preventDefault();
    document.getElementById(`regel-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * **Eine Variante als Regelartikel** (T-190): angelegt in der
   * Schreibebene, mit dem Satz der Seite als Anfang — danach schreibt die
   * Leitung ihn aus, und die Seite findet ihn unter diesem Namen.
   */
  protected async schreibeRegel(o: RuleOptionState, v: RuleVariantState): Promise<void> {
    if (this.schreibt()) return;
    this.schreibt.set(v.ownName);
    this.fehler.set(null);
    try {
      const e = await this.api.createEntity('Rule', v.ownName, {
        'Rule.kind': 'option',
        /* „Feats: Allowed" ist ein Name, kein Begriff im Fliesstext (REQ-175). */
        'Rule.autolink': false,
        'Description.description': `${o.does} ${v.does}`,
      });
      if (!this.session.isAdmin()) await this.session.load(true);
      await this.router.navigate(['/artikel', e.id], { queryParams: { edit: 1 } });
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The rule article could not be created.');
    } finally {
      this.schreibt.set(null);
    }
  }
}
