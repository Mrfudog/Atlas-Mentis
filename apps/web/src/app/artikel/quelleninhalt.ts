import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, type Quelleninhalt as Inhalt } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Stapel } from '../kern/stapel';

type Art = NonNullable<Inhalt['types']>[number];
type Eintrag = Art['articles'][number];

/** Über wie vielen Artikeln die Suche im Baum erscheint. */
const SUCHE_AB = 40;

/**
 * **Der Inhalt einer Quelle** (T-189), das Element `contents` an einer
 * Ebene: je Art ihre Artikel, jeder verlinkt, und Häkchen, die zeigen,
 * was die laufende Kampagne davon im Spiel hat — bei einer Gruppe ihre
 * Ebenen. Die Leitung ändert hier dieselbe Wahl wie auf der
 * Kampagnenseite: die Ebene an oder aus (`activates`), welche Arten sie
 * bringt (`activates.props.types`), und einzelne Artikel (`enables`,
 * T-187). Gerechnet wird am Server (`GET /api/layers/:layer/contents`).
 */
@Component({
  selector: 'nw-quelleninhalt',
  imports: [RouterLink, KurzLink, FormsModule],
  template: `
    @if (daten(); as d) {
      <section class="inhalt" aria-label="Contents">
        <h2>Contents</h2>
        @if (d.layers) {
          <p class="dim">{{ d.layers.length }} {{ d.layers.length === 1 ? 'layer' : 'layers' }} in this group.</p>
          <ul class="ebenen">
            @for (m of d.layers; track m.id) {
              <li>
                <a [routerLink]="['/artikel', m.id]" [nwQuick]="m.id">{{ m.name }}</a>
                <span class="dim">{{ m.group ? 'group' : m.articles + ' articles' }}</span>
                @if (d.campaign) { <span class="marke" [class.an]="m.inPlay">{{ m.inPlay ? 'in play' : 'not in play' }}</span> }
              </li>
            }
          </ul>
        } @else {
          <p class="zahlen">
            @for (a of arten(); track a.type) {
              @if (!$first) { <span class="dim"> · </span> }
              <span>{{ a.label }} {{ a.articles.length }}</span>
            } @empty {
              <span class="dim">{{ d.onlyInPlay ? 'Nothing from this source is in play.' : 'No articles in this layer.' }}</span>
            }
            @if (d.removes) { <span class="dim"> · takes out {{ d.removes }} from other layers</span> }
          </p>
        }
        @if (d.campaign) {
          <div class="lage">
            <label class="ebene">
              <input type="checkbox" [checked]="d.state.inPlay" [disabled]="!darf() || laeuft()" (change)="ebeneSchalten()" />
              In play in <a [routerLink]="['/artikel', d.campaign.id]">{{ d.campaign.name }}</a>
            </label>
            <span class="dim">{{ lageText() }}</span>
          </div>
        }
        @if (!d.layers && arten().length) {
          @if (alleArtikel() > suchAb) {
            <input class="suche" type="search" placeholder="Find in this source" [ngModel]="suche()" (ngModelChange)="suche.set($event)" />
          }
          <ul class="baum">
            @for (a of gefiltert(); track a.type) {
              <li>
                <details [open]="offen().has(a.type) || !!suche()" (toggle)="umschalten(a.type, $any($event.target).open)">
                  <summary>
                    <input type="checkbox" [checked]="a.on" [disabled]="!artSchaltbar()" [title]="artTitel()"
                           (click)="$event.stopPropagation()" (change)="artSchalten(a)" />
                    <span class="art">{{ a.label }}</span>
                    <span class="dim">{{ a.articles.length }}</span>
                  </summary>
                  @if (offen().has(a.type) || suche()) {
                    <ul class="artikel">
                      @for (x of a.articles; track x.id) {
                        <li>
                          <input type="checkbox" [checked]="x.state !== 'off'" [disabled]="!artikelSchaltbar(x)"
                                 [title]="artikelTitel(x)" (change)="artikelSchalten(x)" />
                          <a [routerLink]="['/artikel', x.id]" [nwQuick]="x.id">{{ x.name }}</a>
                          @if (x.state === 'enabled') { <span class="marke an" [title]="x.blocked ? 'Enabled, but a more specific layer takes it out' : 'Enabled on its own'">{{ x.blocked ? 'enabled · taken out' : 'enabled' }}</span> }
                          @if (x.replaced) { <span class="marke" title="A version from another layer stands in its place">replaced</span> }
                        </li>
                      }
                    </ul>
                  }
                </details>
              </li>
            }
          </ul>
        }
        @if (d.onlyInPlay) { <p class="dim">You see what is in play; the rest of this source shows once it is turned on.</p> }
        @if (fehler(); as f) { <p class="fehler" role="alert">{{ f }}</p> }
      </section>
    } @else if (fehler(); as f) {
      <p class="fehler" role="alert">{{ f }}</p>
    }
  `,
  styles: `
    .inhalt { display: flex; flex-direction: column; gap: 0.5rem; }
    .inhalt h2 { margin: 0; }
    .zahlen { margin: 0; }
    .lage { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.8rem; }
    .lage .ebene { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; }
    .suche { max-width: 22rem; min-height: 32px; }
    ul { list-style: none; margin: 0; padding: 0; }
    .baum > li + li { margin-top: 0.2rem; }
    summary { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; min-height: 32px; }
    summary { list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::before { content: '▸'; width: 0.8rem; color: var(--dim); }
    details[open] > summary::before { content: '▾'; }
    summary .art { font-weight: 600; }
    .artikel { padding-left: 1.6rem; columns: 16rem auto; column-gap: 1.5rem; }
    .artikel li, .ebenen li { display: flex; align-items: center; gap: 0.4rem; break-inside: avoid; min-height: 28px; flex-wrap: wrap; }
    input[type='checkbox'] { width: 18px; height: 18px; margin: 0; flex: none; }
    .marke { font-size: 0.8rem; border: 1px solid var(--rule, currentColor); border-radius: 3px; padding: 0 0.3rem; color: var(--dim); }
    .marke.an { color: inherit; }
    .dim { color: var(--dim); }
    .fehler { color: var(--warn); }
  `,
})
export class Quelleninhalt {
  readonly layer = input.required<string>();

  private readonly api = inject(Api);
  private readonly stapel = inject(Stapel);

  protected readonly daten = signal<Inhalt | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  protected readonly suche = signal('');
  protected readonly suchAb = SUCHE_AB;

  constructor() {
    effect(() => {
      const l = this.layer();
      untracked(() => void this.laden(l));
    });
  }

  protected readonly arten = computed(() => this.daten()?.types ?? []);
  protected readonly alleArtikel = computed(() => this.arten().reduce((n, a) => n + a.articles.length, 0));
  protected readonly gefiltert = computed(() => {
    const q = this.suche().trim().toLowerCase();
    if (!q) return this.arten();
    return this.arten()
      .map((a) => ({ ...a, articles: a.articles.filter((x) => x.name.toLowerCase().includes(q)) }))
      .filter((a) => a.articles.length);
  });
  /** Ändern darf die Leitung der laufenden Kampagne (`manage`); ein Mitleiter sieht. */
  protected readonly darf = computed(() => this.daten()?.may === 'manage');

  /** Was die Ebene in der Kampagne bringt, in einem Satz. */
  protected readonly lageText = computed(() => {
    const s = this.daten()?.state;
    if (!s) return '';
    if (s.off) return 'Turned off, though its group would bring it.';
    if (!s.inPlay) return s.compare ? 'Only for comparison; enable single articles below.' : 'Not in play; enable single articles below.';
    const b = s.brings;
    const was = b ? `Brings only ${[...(b.areas ?? []), ...(b.types ?? []).map((t) => this.label(t))].join(', ')}` : 'Brings everything';
    if (s.ruleFrom) return `${was} — the type rule of ${s.ruleFrom.name}.`;
    return s.own ? `${was}.` : `${was}, through its group.`;
  });

  private label(t: string): string {
    return this.arten().find((a) => a.type === t)?.label ?? t;
  }

  /** Eine Art schalten geht an der eigenen Kante der Ebene — oder, ist sie nicht im Spiel, schaltet sie mit genau dieser Art auf. */
  protected readonly artSchaltbar = computed(() => {
    const d = this.daten();
    if (!d || !this.darf() || this.laeuft()) return false;
    if (d.state.inPlay) return d.state.own;
    return !d.state.off && !d.state.compare;
  });
  protected readonly artTitel = computed(() => {
    const d = this.daten();
    if (!d?.campaign) return '';
    if (!this.darf()) return 'The GM of the campaign chooses this';
    if (d.state.inPlay && !d.state.own) {
      return d.state.ruleFrom
        ? `Set by the type rule of ${d.state.ruleFrom.name} — change it on the campaign page`
        : 'Brought by its group — choose on the campaign page';
    }
    if (d.state.compare) return 'Only for comparison — enable single articles instead';
    return d.state.inPlay ? 'Bring this type or not' : 'Turn the layer on with only this type';
  });

  protected artikelSchaltbar(x: Eintrag): boolean {
    return this.darf() && !this.laeuft() && x.state !== 'layer';
  }
  protected artikelTitel(x: Eintrag): string {
    if (x.state === 'layer') return 'Comes with the layer';
    if (!this.darf()) return x.state === 'enabled' ? 'Enabled on its own' : 'Not in play';
    return x.state === 'enabled' ? 'Take back the single enabling' : 'Enable just this article';
  }

  protected umschalten(type: string, auf: boolean): void {
    const n = new Set(this.offen());
    if (auf) n.add(type);
    else n.delete(type);
    this.offen.set(n);
  }

  private async laden(layer: string): Promise<void> {
    try {
      const d = await this.api.layerContents(layer);
      if (layer === this.layer()) {
        this.daten.set(d);
        this.fehler.set(null);
      }
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  private async aendern(tu: (c: string) => Promise<unknown>): Promise<void> {
    const c = this.daten()?.campaign?.id;
    if (!c) return;
    this.laeuft.set(true);
    try {
      await tu(c);
      this.stapel.geaendert();
      await this.laden(this.layer());
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
      await this.laden(this.layer());
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Die Ebene an oder aus — mit dem Stapel, wie ihn die Kampagnenseite schreibt. */
  protected ebeneSchalten(): void {
    const d = this.daten();
    if (!d) return;
    const l = d.layer.id;
    void this.aendern(async (c) => {
      if (!d.state.inPlay && !d.state.off) return this.api.activateLayer(c, l);
      const k = await this.api.campaignLayers(c);
      const an = k.layers.filter((x) => x.active).map((x) => x.id);
      const aus = k.layers.filter((x) => x.off).map((x) => x.id);
      if (d.state.off) return this.api.setCampaignLayers(c, an, aus.filter((x) => x !== l));
      /* Eigene Kante: herausnehmen. Über eine Gruppe: ausdrücklich aus (T-088). */
      return d.state.own ? this.api.setCampaignLayers(c, an.filter((x) => x !== l), aus) : this.api.setCampaignLayers(c, an, [...aus, l]);
    });
  }

  /** Eine Art dazu oder weg — als Liste der Arten an der eigenen Kante; alle heisst wieder „alles". */
  protected artSchalten(a: Art): void {
    const d = this.daten();
    if (!d) return;
    const l = d.layer.id;
    if (!d.state.inPlay) {
      void this.aendern(async (c) => {
        await this.api.activateLayer(c, l);
        return this.api.setLayerOnly(c, l, { types: [a.type] });
      });
      return;
    }
    const an = new Set(this.arten().filter((x) => x.on).map((x) => x.type));
    if (a.on) an.delete(a.type);
    else an.add(a.type);
    if (!an.size) {
      this.fehler.set('A layer in play brings at least one type — to bring nothing, turn it off above.');
      void this.laden(l);
      return;
    }
    const alle = an.size === this.arten().length;
    void this.aendern((c) => this.api.setLayerOnly(c, l, alle ? null : { types: [...an] }));
  }

  protected artikelSchalten(x: Eintrag): void {
    void this.aendern((c) => this.api.setEnabled(c, x.id, x.state === 'off'));
  }
}
