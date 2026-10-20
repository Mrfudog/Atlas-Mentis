import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { itemBook, primaryInterface } from '@nw/model';
import type { Entity, ItemBook } from '@nw/model';
import { Api } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { AbwMarken, zeilenVergleich, type Abweichung, type Vergleichsfassung } from './fassungen';
import { Text } from './text';

/**
 * **Der Gegenstand wie im Spielleiterhandbuch** (W2): Art, Seltenheit und
 * Einstimmung kursiv unter dem Namen; Rüstungsklasse, Schaden, Ladungen,
 * Preis und Gewicht als Kopfzeilen, das Gewicht in der Einheit der
 * Einstellung. Waffe, Rüstung und Material erben die Anordnung von `Item`.
 */
@Component({
  selector: 'nw-gegenstand',
  imports: [Text, AbwMarken, RouterLink],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <nw-abw [liste]="an(KOPF)" />
      <div class="linie" aria-hidden="true"></div>
      @if (b.lines.length || b.extra.length || vgl().nurDort.length) {
        <div class="zeilen">
          @for (z of b.lines; track z.label) {
            <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
          @for (z of b.extra; track z.label) {
            <p class="zusatz"><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
          <!-- Zeilen, die nur eine andere Fassung hat (T-103): „hier —". -->
          @for (z of vgl().nurDort; track z.label) {
            <p class="zusatz leer"><strong>{{ z.label }}</strong> —<nw-abw [liste]="z.abw" /></p>
          }
        </div>
      }
    }
    <!-- Enhancements an einem Stück (T-300): +1, versilbert … -->
    @if (aufw(); as a) {
      @if (a.piece && (dran().length || a.may)) {
        <section class="aufw" aria-label="Enhancements">
          <h4>Enhancements</h4>
          @if (dran().length) {
            <ul>
              @for (p of dran(); track p.id) {
                <li>
                  <a [routerLink]="['/artikel', p.id]">{{ p.name }}</a>
                  @if (p.surcharge) { <span class="leise">{{ p.surcharge }}</span> }
                  @if (!p.fits) { <span class="warn" title="Its “Variant applies to” does not name this item">doesn’t fit</span> }
                  @if (a.may) {
                    <button type="button" class="ab" (click)="ab(p.id)" [attr.aria-label]="'Remove ' + p.name">×</button>
                  }
                </li>
              }
            </ul>
            @if (artikel().enhanced; as en) {
              <p class="leise preis">Price: {{ en.priceNote }}</p>
            }
          }
          @if (a.may) {
            <label class="dazu">
              <span>Add enhancement</span>
              <select #wahl (change)="dazu(wahl.value); wahl.value = ''">
                <option value="">Choose …</option>
                @for (o of a.options; track o.id) {
                  <option [value]="o.id">{{ o.name }}{{ o.surcharge ? ' (' + o.surcharge + ')' : '' }}{{ o.fits ? '' : ' — doesn’t fit' }}</option>
                }
              </select>
            </label>
          }
          @if (hinweis()) { <p class="warn" role="status">{{ hinweis() }}</p> }
        </section>
      }
    }
  `,
  styleUrl: './buch.scss',
})
export class Gegenstand {
  readonly artikel = input.required<Entity>();
  /** Die verglichenen Fassungen (T-103): an jeder Zeile steht, was sie anders sagen. */
  readonly fassungen = input<readonly Vergleichsfassung[]>([]);

  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);
  /** Was sich anhängen liesse und ob man darf — vom Server (T-300). */
  protected readonly aufw = signal<{ may: boolean; piece: boolean; options: { id: string; name: string; fits: boolean; surcharge?: string }[] } | null>(null);
  protected readonly hinweis = signal('');
  /** Die angehängten, wie das Lesen sie rechnet (`enhanced`). */
  protected readonly dran = computed(() => this.artikel().enhanced?.properties ?? []);
  protected readonly KOPF = 'byline';

  constructor() {
    /* Nur an einem Stück (einer Instanz) gibt es Enhancements; der Server
       sagt, was passt und wer darf. */
    effect(() => {
      const e = this.artikel();
      const stueck = !!e.fromTemplate || !!e.enhanced;
      const id = e.id;
      untracked(() => {
        if (!stueck) return this.aufw.set(null);
        this.api.enhancements(id).then((a) => this.aufw.set(a), () => this.aufw.set(null));
      });
    });
    /* Die Munition ist ein Verweis (T-078); ohne Namen aus `refs` holt der
       Gegenstand sie selbst, wie der Statblock seine Zustände. */
    effect(() => {
      const w = this.artikel().components?.['Weapon'] as Record<string, unknown> | undefined;
      const id = w?.['ammoType'];
      if (typeof id === 'string' && id && !this.bestand.name()(id)) untracked(() => void this.bestand.holen([id]));
    });
  }

  protected readonly buch = computed<ItemBook | null>(() => this.bauen(this.artikel()));

  protected async dazu(id: string): Promise<void> {
    if (!id) return;
    await this.aendern(() => this.api.addEnhancement(this.artikel().id, id));
  }

  protected async ab(id: string): Promise<void> {
    await this.aendern(() => this.api.removeEnhancement(this.artikel().id, id));
  }

  private async aendern(tun: () => Promise<unknown>): Promise<void> {
    this.hinweis.set('');
    try {
      await tun();
      const id = this.artikel().id;
      await this.bestand.oeffnen(id, true);
      this.aufw.set(await this.api.enhancements(id));
    } catch (e) {
      this.hinweis.set(String((e as { body?: { error?: string } }).body?.error ?? 'That did not work.'));
    }
  }

  private bauen(roh: Entity): ItemBook | null {
    const r = this.bestand.registry();
    if (!r) return null;
    /* Ein Stück mit Enhancements zeigt die gerechneten Werte (T-300) —
       nur für die Anzeige, gespeichert wird davon nichts (D8). */
    const en = roh.enhanced;
    const e: Entity = en
      ? {
          ...roh,
          components: {
            ...roh.components,
            Item: {
              ...(roh.components?.['Item'] ?? {}),
              copperPrice: en.price,
              priceNote: en.price !== undefined ? 'with enhancements' : en.priceNote,
              ...(en.rarity ? { rarity: en.rarity } : {}),
              ...(en.attunement ? { attunement: true } : {}),
              ...(en.bonusWeapon !== undefined ? { bonusWeapon: en.bonusWeapon } : {}),
              ...(en.bonusAc !== undefined ? { bonusAc: en.bonusAc } : {}),
              ...(en.bonusSpellAttack !== undefined ? { bonusSpellAttack: en.bonusSpellAttack } : {}),
              ...(en.bonusSave !== undefined ? { bonusSave: en.bonusSave } : {}),
            },
          },
        }
      : roh;
    const typ = primaryInterface(e);
    const name = this.bestand.name();
    /* Die Namen der Verweisziele bringt der Artikel mit (`refs`, W7). */
    return itemBook(r, e, r.interfaces[typ]?.label ?? typ, (id) => name(id));
  }

  /** Die Zeilen gegen die der Fassungen, nach Beschriftung (T-103). */
  protected readonly vgl = computed(() => {
    const b = this.buch();
    const zeilen = (x: ItemBook) => [{ label: this.KOPF, text: x.byline }, ...x.lines, ...x.extra];
    const andere = this.fassungen().flatMap((f) => {
      const o = this.bauen(f.entity);
      return o ? [{ f, zeilen: zeilen(o) }] : [];
    });
    return zeilenVergleich(b ? zeilen(b) : [], andere);
  });

  protected an(label: string): Abweichung[] {
    return this.vgl().an.get(label.trim().toLowerCase()) ?? [];
  }
}
