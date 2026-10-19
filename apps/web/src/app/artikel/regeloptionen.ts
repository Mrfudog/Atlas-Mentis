import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { withRuleVariant, type Entity, type Relation, type RuleOptionState, type RuleSortState, type RuleVariantState } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { ExperimenteSchalter } from '../lab/experimente-schalter';
import { Text } from './text';

/**
 * **Rules & options** (T-190): die Regeloptionen einer Kampagne, nach
 * System gruppiert. **Seit T-270 aus Regelartikeln:** jedes System, jede
 * Regel und jede Option ist ein Artikel, und ihr Name führt dorthin.
 * Gerechnet am Server (`GET /api/campaigns/:id/rules`) — hier steht nur,
 * was ankommt.
 *
 * Gewählt wird hier („Use this"); die Verfahren über ihre Kanten in der
 * Maske der Kampagne, die Einstellungen der Installation nirgends hier.
 * Einen Regelartikel schreibt man nicht von hier aus: was fehlt, legt die
 * Einfuhr der Regeln an (`scripts/regeln-anlegen.mjs`).
 */
@Component({
  selector: 'nw-regeloptionen',
  imports: [RouterLink, KurzLink, ExperimenteSchalter, Text],
  template: `
    <section class="regeln" aria-labelledby="regeln-titel">
      <header class="kopf">
        <h2 id="regeln-titel">Rules &amp; options</h2>
        <p class="hint">
          How this campaign plays. Every system, rule and option is a rule article — its name opens it.
          @if (darfSchreiben()) {
            Pick “Use this” to change a choice right here.
          }
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
      } @else if (!laedt() && !sorten().length && !fehler()) {
        <p class="hint">No rule articles are in play yet.</p>
      }
      @if (leitet() && fehlen()) {
        <p class="hint fehlt">
          {{ fehlen() }} rules or options the app knows have no rule article in play, so they are not listed. A layer with the
          table rules adds them.
        </p>
      }

      <nav class="inhalt" aria-label="Rule sorts">
        @for (s of sorten(); track s.key) {
          <a [href]="'#regel-' + s.key" (click)="springe($event, s.key)">{{ s.label }}</a>
        }
      </nav>

      @for (s of sorten(); track s.key) {
        <section class="sorte" [id]="'regel-' + s.key">
          @if (s.rule; as r) {
            <h3><a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ s.label }}</a></h3>
          } @else {
            <h3>{{ s.label }}</h3>
          }
          <p class="was"><nw-text [text]="s.does" inline /></p>
          @for (o of s.options; track o.key) {
            <article class="option">
              <div class="optionskopf">
                @if (o.rule; as r) {
                  <h4><a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ o.label }}</a></h4>
                } @else {
                  <h4>{{ o.label }}</h4>
                }
                @if (o.scope === 'installation') {
                  <span class="marke" title="A setting of this installation: it applies to every campaign.">installation-wide</span>
                }
              </div>
              <p class="was"><nw-text [text]="o.does" inline /></p>

              @if (o.variants) {
                <ul class="varianten">
                  @for (v of o.variants; track v.key) {
                    <li [class.gewaehlt]="v.chosen">
                      <div class="zeile">
                        <!-- Der Name führt auf den Artikel der Option; ohne steht nur die gewählte da. -->
                        @if (v.rule; as r) {
                          <a class="name" [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ v.label }}</a>
                        } @else {
                          <span class="name">{{ v.label }}</span>
                        }
                        @if (v.chosen) {
                          <span class="marke an">in use</span>
                        } @else if (darfSchreiben() && o.field) {
                          <button type="button" class="klein" [disabled]="waehlt() !== null" (click)="waehle(o, v)"
                                  [attr.title]="'Use “' + v.label + '” in this campaign'">
                            {{ waehlt() === o.key + ':' + v.key ? 'Saving…' : 'Use this' }}
                          </button>
                        }
                      </div>
                      <p class="was"><nw-text [text]="v.does" inline /></p>
                    </li>
                  }
                </ul>
              } @else if (o.methods && darfSchreiben() && o.relation && (wahl()[o.relation]?.length ?? 0) > 0) {
                <!-- Mehrfachwahl (Leitung 19.10.): jedes mögliche Verfahren mit Häkchen, an- und abwählbar. -->
                <ul class="varianten">
                  @for (m of wahl()[o.relation!] ?? []; track m.id) {
                    <li [class.gewaehlt]="gewaehlt(o, m.id)">
                      <label class="zeile">
                        <input type="checkbox" [checked]="gewaehlt(o, m.id)" [disabled]="waehlt() !== null" (change)="schalte(o, m.id, $any($event.target).checked)" />
                        <a class="name" [routerLink]="['/artikel', m.id]" [nwQuick]="m.id">{{ m.name }}</a>
                        @if (waehlt() === o.key + ':' + m.id) {
                          <span class="marke">Saving…</span>
                        }
                      </label>
                      <p class="was">{{ m.does }}</p>
                    </li>
                  }
                  @for (m of o.methods; track m.id) {
                    @if (m.builtIn) {
                      <li class="vorgabe">
                        <div class="zeile">
                          <span class="name">{{ m.name }}</span>
                          <span class="marke" title="Applies while nothing is ticked.">default</span>
                        </div>
                        <p class="was">{{ m.does }}</p>
                      </li>
                    }
                  }
                </ul>
                <p class="hint">Untick all to fall back to the defaults.</p>
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

      <!-- Versuche (T-270): nur Leitung und Verwaltung, Schalter je Konto;
           nachgeladen, damit der Versuch das erste Bündel nicht schwerer macht. -->
      @if (leitet()) {
        @defer {
          <nw-experimente />
        }
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
    .regel.siehe {
      color: var(--dim);
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
  private readonly session = inject(Session);

  /**
   * Leitet dieses Konto die Kampagne (oder verwaltet die Installation)? Dann
   * sieht es, wie viele Regeln noch keinen Artikel haben, und die Versuche.
   * Anzeige, der Server prüft.
   */
  protected readonly leitet = computed(() => {
    const u = this.session.user();
    const rolle = u?.roles?.[this.kampagne()];
    return !!u && (u.isAdmin || rolle === 'gm' || rolle === 'co-gm');
  });

  protected readonly sorten = signal<RuleSortState[]>([]);
  protected readonly laedt = signal(false);
  protected readonly fehler = signal<string | null>(null);
  /** Welche Variante gerade gespeichert wird (`option:variante`). */
  protected readonly waehlt = signal<string | null>(null);
  /** Wie viele Regeln und Optionen der Laufzeit noch keinen Artikel im Stapel haben. */
  protected readonly fehlen = signal(0);
  /** Was je Kante zur Wahl steht (`choices` vom Server). */
  protected readonly wahl = signal<Record<string, { id: string; name: string; does: string }[]>>({});

  constructor() {
    effect(() => {
      void this.lade(this.kampagne());
    });
  }

  private async lade(id: string): Promise<void> {
    this.laedt.set(true);
    this.fehler.set(null);
    try {
      const r = await this.api.campaignRules(id);
      this.sorten.set(r.sorts);
      this.fehlen.set(r.missing ?? 0);
      this.wahl.set(r.choices ?? {});
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The options could not be loaded.');
    } finally {
      this.laedt.set(false);
    }
  }

  /** Ist dieses Verfahren gewählt? (Die gewählten nennt der Server unter `methods`.) */
  protected gewaehlt(o: RuleOptionState, id: string): boolean {
    return (o.methods ?? []).some((m) => m.id === id && !m.builtIn);
  }

  /**
   * **Ein Verfahren an- oder abwählen** (Mehrfachwahl): die Kante von der
   * Kampagne auf den Artikel setzen oder wegnehmen und wie aus der Maske
   * speichern. Ohne Häkchen gelten die Vorgaben.
   */
  protected async schalte(o: RuleOptionState, id: string, an: boolean): Promise<void> {
    if (this.waehlt() || !o.relation) return;
    this.waehlt.set(`${o.key}:${id}`);
    this.fehler.set(null);
    try {
      const { refs: _refs, fromTemplate: _ft, ...k } = (await this.api.entity(this.kampagne())) as Entity & { refs?: unknown; fromTemplate?: unknown };
      const alt = (k.relations ?? []) as Relation[];
      const hat = alt.some((r) => r.type === o.relation && r.to === id);
      if (hat === an) return;
      const relations = an
        ? [...alt, { id: `${k.id}~${o.relation}-${Date.now().toString(36)}`, type: o.relation, to: id, props: {} }]
        : alt.filter((r) => !(r.type === o.relation && r.to === id));
      await this.api.putEntity({ ...(k as Entity), relations });
      await this.lade(this.kampagne());
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The option could not be saved.');
    } finally {
      this.waehlt.set(null);
    }
  }

  /** Im Reiter springen, ohne die Adresse (und damit den Reiter) zu verlieren. */
  protected springe(ev: Event, key: string): void {
    ev.preventDefault();
    document.getElementById(`regel-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * **Eine Variante direkt wählen:** die Kampagne holen, das Feld setzen
   * (`withRuleVariant`) und wie aus der Maske speichern — das Schreibrecht
   * und `validateEntity` prüft der Server.
   */
  protected async waehle(o: RuleOptionState, v: RuleVariantState): Promise<void> {
    if (this.waehlt()) return;
    this.waehlt.set(`${o.key}:${v.key}`);
    this.fehler.set(null);
    try {
      const { refs: _refs, fromTemplate: _ft, ...k } = (await this.api.entity(this.kampagne())) as Entity & { refs?: unknown; fromTemplate?: unknown };
      const neu = withRuleVariant(k as Entity, o.key, v.key);
      if (!neu) return;
      await this.api.putEntity(neu);
      await this.lade(this.kampagne());
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The option could not be saved.');
    } finally {
      this.waehlt.set(null);
    }
  }
}
