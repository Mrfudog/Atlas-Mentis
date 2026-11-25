import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { stepsFromString, stepsToString, type Audience, type TransformStep } from '@nw/model';
import { Api, ApiError, type SichtKnoten, type SichtSpalte, type SichtUebersicht } from '../kern/api';
import { Session } from '../kern/session';
import { Transformationen, type GespeicherteKette } from '../muster/transformationen';

/** Die Stufen, wie die Übersicht sie nennt — `campaign` heisst am Tisch „Table". */
const STUFEN: { key: Audience; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'campaign', label: 'Table' },
  { key: 'players', label: 'Players' },
  { key: 'gm', label: 'GM' },
];
const STUFE_NAME = Object.fromEntries(STUFEN.map((s) => [s.key, s.label])) as Record<Audience, string>;

/** Fertige Ketten (T-253): die häufigsten Fragen der Leitung. */
const VORLAGEN: GespeicherteKette[] = [
  { name: 'Layer → Type', steps: 'group:layer,group:type' },
  { name: 'Layer group → Layer', steps: 'group:layerGroup,group:layer' },
  { name: 'Area → Type', steps: 'group:area,group:type' },
];

/**
 * **Wer sieht was** (T-252, E-098) — der Reiter „Visibility" der
 * Kampagnenseite. Zeilen sind Gruppen aus den Transformationen (T-253),
 * Spalten Public · Table · je Spielende/r · GM; je Zelle, wie viele Artikel
 * der Gruppe dort sichtbar sind. Gerechnet am Server mit derselben Rechnung
 * wie jede Route — hier steht nur, was ankommt.
 *
 * **Gesetzt wird je Gruppe**: eine Stufe (die Regel der Kampagne schlägt
 * die Vorgabe der Ebene), je Spielende/r zeigen oder verbergen (Klick auf
 * die Zelle), ↺ zurück zur Vorgabe der Ebene. Artikel mit eigenem Feld
 * schlagen jede Regel; sie stehen als Ausnahmen da und folgen auf Wunsch
 * wieder der Gruppe.
 */
@Component({
  selector: 'nw-kampagnen-sichtbarkeit',
  imports: [RouterLink, Transformationen],
  template: `
    <section class="sicht" aria-labelledby="sicht-titel">
      <h2 id="sicht-titel">Who sees what</h2>
      <p class="fuss">
        The layer sets the default, the campaign overrides per group; an article’s own setting wins over both.
        Click a player’s cell to show or hide the whole group for that player only.
      </p>
      @if (daten(); as d) {
        <nw-transformationen
          [dimensionen]="d.dimensions"
          [steps]="steps()"
          (stepsChange)="neueKette($event)"
          [vorlagen]="vorlagen"
          ort="campaign-visibility"
          [adresse]="true"
        />
        @if (d.unknown.length) {
          <p class="fuss">Not known here, so not applied: {{ d.unknown.join(', ') }}.</p>
        }
      }
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (meldung(); as m) {
        <p class="meldung" role="status">{{ m }}</p>
      }
      @if (daten(); as d) {
        <div class="rolle" role="region" aria-label="Visibility by group" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col" class="gruppe">Group</th>
                <th scope="col" class="zahl">N</th>
                @for (s of d.columns; track s.key) {
                  <th scope="col" class="spalte" [attr.title]="spaltenTitel(s)">
                    {{ s.label }}
                    @if (ansehbar(s)) {
                      <button type="button" class="klein leise" [attr.aria-label]="'View as ' + s.label" (click)="ansehen(s)">View as</button>
                    }
                  </th>
                }
                <th scope="col">Set for the group</th>
              </tr>
            </thead>
            <tbody>
              @for (z of zeilen(); track z.key) {
                <tr [class.tief]="z.depth > 0">
                  <th scope="row" class="gruppe">
                    <span class="einzug" [style.padding-left.rem]="z.depth * 1.2">
                      @if (z.children.length) {
                        <button type="button" class="pfeil" [attr.aria-expanded]="offen().has(z.key)"
                                [attr.aria-label]="(offen().has(z.key) ? 'Collapse ' : 'Expand ') + z.label" (click)="umschalten(z.key)">
                          {{ offen().has(z.key) ? '▾' : '▸' }}
                        </button>
                      } @else {
                        <span class="pfeil" aria-hidden="true"></span>
                      }
                      <span class="dim">{{ dimName(z.dim) }}</span>
                      <b>{{ z.label }}</b>
                    </span>
                    <small class="herkunft">{{ herkunft(z) }}</small>
                  </th>
                  <td class="zahl">{{ z.count }}</td>
                  @for (s of d.columns; track s.key) {
                    <td>
                      @if (s.kind === 'player' && darf()) {
                        <button type="button" class="zelle" [class]="zellKlasse(z, s)" [class.eigen]="!!spielerRegel(z, s)"
                                [attr.title]="zellTitel(z, s)" [attr.aria-label]="z.label + ', ' + s.label + ': ' + zellText(z, s) + '. ' + zellTitel(z, s)"
                                (click)="spielerUmschalten(z, s)">{{ zellText(z, s) }}</button>
                      } @else {
                        <span class="zelle" [class]="zellKlasse(z, s)" [attr.title]="zellTitel(z, s)">{{ zellText(z, s) }}</span>
                      }
                    </td>
                  }
                  <td class="setzen">
                    @if (darf()) {
                      <span class="seg" role="group" [attr.aria-label]="'Audience for ' + z.label">
                        @for (st of stufen; track st.key) {
                          <button type="button" [attr.aria-pressed]="gewaehlt(z) === st.key" [disabled]="laeuft()" (click)="stufeSetzen(z, st.key)">
                            {{ st.label }}
                          </button>
                        }
                      </span>
                      @if (z.rule?.audience) {
                        <button type="button" class="klein leise" title="Back to the layer default" [attr.aria-label]="z.label + ': back to the layer default'"
                                [disabled]="laeuft()" (click)="stufeSetzen(z, null)">↺</button>
                      }
                    } @else {
                      <span class="dim">{{ stufenText(z) }}</span>
                    }
                    @if (z.exceptions.count) {
                      <button type="button" class="klein ausnahme" (click)="ausnahmenVon.set(z.key)">{{ z.exceptions.count }} own</button>
                    }
                  </td>
                </tr>
                @if (ausnahmenVon() === z.key) {
                  <tr class="ausnahmen">
                    <td [attr.colspan]="d.columns.length + 3">
                      <div class="kopfzeile">
                        <b>Own setting in {{ z.label }}</b>
                        <span class="dim">these articles say it themselves and win over the group</span>
                        <button type="button" class="klein" (click)="ausnahmenVon.set(null)">Close</button>
                      </div>
                      <ul>
                        @for (e of z.exceptions.items; track e.id) {
                          <li>
                            <a [routerLink]="['/artikel', e.id]">{{ e.name }}</a>
                            <span class="dim">{{ e.own }}</span>
                            @if (darf()) {
                              <button type="button" class="klein" [disabled]="laeuft()" (click)="folgen(z, [e.id])">Follow the group</button>
                            }
                          </li>
                        }
                      </ul>
                      @if (z.exceptions.count > z.exceptions.items.length) {
                        <p class="dim">and {{ z.exceptions.count - z.exceptions.items.length }} more.</p>
                      }
                      @if (darf() && z.exceptions.items.length > 1) {
                        <button type="button" [disabled]="laeuft()" (click)="folgen(z, alleIds(z))">All shown follow the group</button>
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td [attr.colspan]="d.columns.length + 3" class="dim">Nothing in play.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="fuss">
          Columns: <b>Public</b> every account · <b>Table</b> anyone with a role here, spectators included · each player with
          their characters · <b>GM</b> you and the co-GM. {{ d.total }} articles in play.
        </p>
      } @else if (!fehler()) {
        <p class="fuss">Counting…</p>
      }
    </section>
  `,
  styles: `
    .sicht {
      padding: 0.9rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .sicht h2 {
      margin-top: 0;
    }
    .fuss {
      font-size: 0.85rem;
      color: var(--dim);
    }
    .fehler {
      color: var(--accent);
    }
    .rolle {
      overflow-x: auto;
      max-width: 100%;
    }
    table {
      border-collapse: collapse;
      min-width: 100%;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.3rem 0.45rem;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
      white-space: nowrap;
    }
    thead th {
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--dim);
    }
    th.gruppe {
      font-weight: normal;
      min-width: 14rem;
      white-space: normal;
    }
    .einzug {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .pfeil {
      width: 26px;
      min-height: 26px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
    }
    .dim {
      color: var(--dim);
      font-size: 0.8rem;
    }
    .einzug .dim {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .herkunft {
      display: block;
      margin-left: 1.9rem;
      color: var(--dim);
    }
    .zahl {
      color: var(--dim);
    }
    .zelle {
      display: inline-block;
      min-width: 3.6rem;
      min-height: 26px;
      padding: 0 0.35rem;
      border: 1px solid transparent;
      border-radius: 4px;
      background: none;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      line-height: 26px;
      text-align: center;
    }
    .zelle.alle {
      background: color-mix(in srgb, var(--good, #4c6b2a) 16%, transparent);
      color: var(--good, #4c6b2a);
    }
    .zelle.teil {
      background: color-mix(in srgb, var(--gold, #c8822e) 18%, transparent);
      color: var(--gold, #c8822e);
    }
    .zelle.keine {
      color: var(--dim);
    }
    .zelle.eigen {
      border-color: var(--magic, #6b3d75);
    }
    button.zelle {
      cursor: pointer;
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
    }
    .seg button {
      min-height: 28px;
      padding: 0 0.45rem;
      border: 0;
      border-right: 1px solid var(--line);
      border-radius: 0;
      background: none;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .seg button:last-child {
      border-right: 0;
    }
    .seg button[aria-pressed='true'] {
      background: var(--accent);
      color: var(--surface, #fbf6ec);
    }
    .ausnahme {
      margin-left: 0.35rem;
    }
    tr.ausnahmen td {
      background: color-mix(in srgb, var(--accent) 5%, transparent);
      white-space: normal;
    }
    .kopfzeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .kopfzeile button {
      margin-left: auto;
    }
    tr.ausnahmen ul {
      margin: 0.4rem 0;
      padding-left: 1.1rem;
    }
    tr.ausnahmen li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-height: 36px;
    }
    .meldung {
      color: var(--good, #4c6b2a);
    }
  `,
})
export class KampagnenSichtbarkeit {
  readonly kampagne = input.required<string>();

  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly stufen = STUFEN;
  protected readonly vorlagen = VORLAGEN;
  protected readonly daten = signal<SichtUebersicht | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly meldung = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  protected readonly ausnahmenVon = signal<string | null>(null);
  /* Die Kette aus der Adresse (geteilt), sonst Ebene → Art. */
  protected readonly steps = signal<TransformStep[]>(
    stepsFromString(new URLSearchParams(window.location.search).get('steps')).length
      ? stepsFromString(new URLSearchParams(window.location.search).get('steps'))
      : [{ group: 'layer' }, { group: 'type' }],
  );

  constructor() {
    effect(() => {
      const c = this.kampagne();
      const w = stepsToString(this.steps());
      untracked(() => void this.laden(c, w));
    });
  }

  protected readonly darf = computed(() => this.daten()?.may === 'manage');

  /** Die sichtbaren Zeilen: aufgeklappt, was in `offen` steht. */
  protected readonly zeilen = computed(() => {
    const aus: SichtKnoten[] = [];
    const offen = this.offen();
    const geh = (l: readonly SichtKnoten[]) => {
      for (const n of l) {
        aus.push(n);
        if (offen.has(n.key)) geh(n.children);
      }
    };
    geh(this.daten()?.nodes ?? []);
    return aus;
  });

  private async laden(c: string, steps: string): Promise<void> {
    try {
      const d = await this.api.campaignVisibility(c, steps);
      this.daten.set(d);
      this.fehler.set(null);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not count the visibility.');
    }
  }

  protected neueKette(st: TransformStep[]): void {
    this.offen.set(new Set());
    this.ausnahmenVon.set(null);
    this.steps.set(st);
  }

  protected umschalten(key: string): void {
    const s = new Set(this.offen());
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.offen.set(s);
  }

  protected dimName(k: string): string {
    return this.daten()?.dimensions.find((d) => d.key === k)?.label ?? k;
  }

  /** Woher die Stufen der Gruppe kommen — „layer default · 2 own". */
  protected herkunft(z: SichtKnoten): string {
    const teile: string[] = [];
    const q = z.sources;
    if (z.rule?.audience) teile.push(`campaign: ${STUFE_NAME[z.rule.audience]}`);
    else if (q.campaign) teile.push(`campaign rule${q.campaign < z.count ? ` (${q.campaign})` : ''}`);
    if (q.layer) teile.push(`layer default${q.layer < z.count ? ` (${q.layer})` : ''}`);
    if (q.default && !q.layer && !q.campaign) teile.push('no default: public');
    if (z.rule?.show?.length || z.rule?.hide?.length) teile.push('per player');
    return teile.join(' · ');
  }

  protected stufenText(z: SichtKnoten): string {
    return (Object.entries(z.levels) as [Audience, number][])
      .map(([k, n]) => (n === z.count ? STUFE_NAME[k] : `${STUFE_NAME[k]} ${n}`))
      .join(' · ');
  }

  /** Welche Stufe der Wähler zeigt: die Regel hier, sonst die einzige, die alle haben. */
  protected gewaehlt(z: SichtKnoten): Audience | null {
    if (z.rule?.audience) return z.rule.audience;
    const ls = Object.keys(z.levels) as Audience[];
    return ls.length === 1 ? ls[0]! : null;
  }

  protected zellText(z: SichtKnoten, s: SichtSpalte): string {
    const n = z.cells[s.key] ?? 0;
    return n === z.count ? `✓ ${n}` : n === 0 ? '—' : `${n}/${z.count}`;
  }
  protected zellKlasse(z: SichtKnoten, s: SichtSpalte): string {
    const n = z.cells[s.key] ?? 0;
    return 'zelle ' + (n === z.count ? 'alle' : n === 0 ? 'keine' : 'teil');
  }

  /** Steht für diese Spielerin eine Regel genau an dieser Gruppe? */
  protected spielerRegel(z: SichtKnoten, s: SichtSpalte): 'show' | 'hide' | null {
    const b = s.bearers ?? [];
    if (!b.length) return null;
    if (b.some((x) => z.rule?.hide?.includes(x))) return 'hide';
    if (b.some((x) => z.rule?.show?.includes(x))) return 'show';
    return null;
  }

  protected zellTitel(z: SichtKnoten, s: SichtSpalte): string {
    const n = z.cells[s.key] ?? 0;
    const basis = `${s.label}: ${n} of ${z.count}`;
    if (s.kind !== 'player' || !this.darf()) return basis;
    if (!s.bearers?.length) return `${basis} · no character to show or hide`;
    const r = this.spielerRegel(z, s);
    return `${basis} · click: ${r === 'hide' ? 'follow the group' : r === 'show' ? `hide from ${s.label}` : `show to ${s.label}`}`;
  }

  protected spaltenTitel(s: SichtSpalte): string {
    switch (s.kind) {
      case 'public':
        return 'every account';
      case 'table':
        return 'anyone with a role in this campaign, spectators included';
      case 'gm':
        return 'you and the co-GM';
      default:
        return `${s.label} (player)`;
    }
  }

  protected ansehbar(s: SichtSpalte): boolean {
    return s.kind === 'player' && this.darf();
  }

  /** „View as" (REQ-241): die Sicht dieser Spielerin, am Server gerechnet. */
  protected async ansehen(s: SichtSpalte): Promise<void> {
    await this.session.viewAsUser(s.key.slice(2));
    await this.router.navigateByUrl('/compendium');
  }

  protected async stufeSetzen(z: SichtKnoten, stufe: Audience | null): Promise<void> {
    const c = this.kampagne();
    await this.tun(async () => {
      await this.api.setVisibilityRule(c, { id: z.key, audience: stufe });
      this.meldung.set(stufe ? `${z.label}: ${STUFE_NAME[stufe]}.` : `${z.label} follows the layer default again.`);
    });
  }

  /** Klick auf eine Zelle: zeigen → verbergen → der Gruppe folgen. */
  protected async spielerUmschalten(z: SichtKnoten, s: SichtSpalte): Promise<void> {
    const b = s.bearers ?? [];
    if (!b.length) {
      this.meldung.set(`${s.label} plays no character yet — assign one under Members.`);
      return;
    }
    const jetzt = this.spielerRegel(z, s);
    const ohne = (l: readonly string[] | undefined) => (l ?? []).filter((x) => !b.includes(x));
    const show = ohne(z.rule?.show);
    const hide = ohne(z.rule?.hide);
    if (jetzt === null) show.push(...b);
    else if (jetzt === 'show') hide.push(...b);
    await this.tun(async () => {
      await this.api.setVisibilityRule(this.kampagne(), { id: z.key, show, hide });
      this.meldung.set(
        jetzt === null ? `${z.label}: shown to ${s.label}.` : jetzt === 'show' ? `${z.label}: hidden from ${s.label}.` : `${z.label}: ${s.label} follows the group again.`,
      );
    });
  }

  protected alleIds(z: SichtKnoten): string[] {
    return z.exceptions.items.map((e) => e.id);
  }

  protected async folgen(z: SichtKnoten, ids: string[]): Promise<void> {
    await this.tun(async () => {
      const r = await this.api.followGroup(this.kampagne(), ids);
      this.meldung.set(
        `${r.done.length} now follow${r.done.length === 1 ? 's' : ''} the group` +
          (r.refused.length ? `; ${r.refused.length} not changed (${r.refused[0]!.error})` : '') +
          '.',
      );
    });
  }

  private async tun(f: () => Promise<void>): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await f();
      await this.laden(this.kampagne(), stepsToString(this.steps()));
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'That did not work.');
    } finally {
      this.laeuft.set(false);
    }
  }
}
