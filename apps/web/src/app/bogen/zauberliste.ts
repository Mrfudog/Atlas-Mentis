import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { learningPaths, ordinalShort, setSlotsUsed, slotFor, spellBook, spellLock, spellsByLevel, turnTypeOf, entityName } from '@nw/model';
import type { Entity } from '@nw/model';
import { Api } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { FigurDaten, fehlerText } from './daten';

/** Eine Zeile der Zauberliste. */
interface ZauberZeile {
  id: string;
  name: string;
  level: number;
  school: string;
  zeit: string;
  weite: string;
  dauer: string;
  komponenten: string[];
  material: string;
  konzentration: boolean;
  ritual: boolean;
  quelle: string;
  sperre: string;
  /** Mit welchem Platz („1st"), `0` ohne, `null` keiner frei. */
  platz: number | null;
  /** Die Aktionsart der Wirkzeit, für „Used". */
  art: string | null;
}

/**
 * **Der Reiter Spells** (T-246, Element `spells`; REQ-067): der Zauberkopf
 * (Attribut, Angriff, SG, Plätze, Zaubertricks, bekannt, Konzentration),
 * alle Zauber nach Grad mit Zeit, Reichweite, V/S/M, C/R, Quelle und
 * „Cast" — gesperrt mit Grund, wenn die Hände oder die Plätze es nicht
 * erlauben —, die Zauberlisten mit „possible for you now" (`usable`, T-180,
 * T-212) und wie die Figur Zauber lernt: der eigene Weg offen, die anderen
 * zugeklappt (Rückmeldung der Leitung).
 *
 * „Cast" verbraucht den kleinsten freien Platz ab dem Grad, setzt die
 * Konzentration bei einem Konzentrationszauber und markiert die
 * Aktionsart in „Your turn" als verbraucht — alles in `Vitals`.
 */
@Component({
  selector: 'nw-zauberliste',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="zauber" aria-label="Spells">
      @if (kopf(); as cells) {
        <dl class="kopf">
          @for (c of cells; track c.key) {
            <div [attr.title]="c.why ?? null"><dt>{{ c.label }}</dt><dd>{{ c.value }}</dd>@if (c.why) {<small>{{ c.why }}</small>}</div>
          }
          <div>
            <dt>Concentration</dt>
            <dd>{{ konzentration() || '—' }}</dd>
            <small>{{ konzentration() ? konzDauer() || 'running' : 'free' }}</small>
          </div>
        </dl>
      }
      <div class="karte">
        <div class="titel">
          <h2>Your spells</h2>
          <small>Cast uses a slot · rituals and cantrips don't</small>
        </div>
        @for (g of grade(); track g.level) {
          <h3>{{ g.level === 0 ? 'Cantrips' : ordinal(g.level) + ' level' }} <small>{{ gradNotiz(g.level) }}</small></h3>
          @for (z of g.rows; track z.id) {
            <div class="zeile">
              <span class="name">
                <a [routerLink]="['/artikel', z.id]" [nwQuick]="z.id">{{ z.name }}</a>
                <small>{{ unterzeile(z) }}</small>
              </span>
              <span class="zeit">{{ z.zeit }}</span>
              <span class="weite">{{ z.weite }}</span>
              <span class="tags">
                @for (k of z.komponenten; track k) {
                  <span class="tag" [attr.title]="k === 'M' && z.material ? z.material : null">{{ k }}</span>
                }
                @if (z.konzentration) {
                  <span class="tag konz" title="Concentration">C</span>
                }
                @if (z.ritual) {
                  <span class="tag ritual" title="Ritual">R</span>
                }
              </span>
              @if (darf()) {
                <button
                  type="button"
                  class="wirken"
                  [class.gesperrt]="!!z.sperre"
                  [disabled]="!!z.sperre"
                  [attr.title]="z.sperre || null"
                  (click)="wirken(z)"
                >
                  @if (z.sperre) {
                    🔒 Blocked
                  } @else if (z.level === 0) {
                    Cast
                  } @else if (z.platz === null) {
                    Ritual
                  } @else {
                    Cast {{ ordinal(z.platz) }}
                  }
                </button>
              }
              @if (z.sperre) {
                <small class="sperre">🔒 {{ z.sperre }}</small>
              }
            </div>
          }
        } @empty {
          <p class="leer">No spells yet.</p>
        }
        <p class="fuss">Somatic and material components follow your hands: {{ haendeText() }}</p>
      </div>
      <div class="unten">
        <div class="karte">
          <h2>Spell lists</h2>
          @for (k of klassen(); track k.id) {
            <p><a [routerLink]="['/artikel', k.id]">{{ k.name }} spell list</a> <small>your source list</small></p>
          } @empty {
            <p class="leer">No class with a spell list.</p>
          }
          @if (moeglich(); as m) {
            <p><b>Possible for you now</b> <small>{{ m.total }} spell{{ m.total === 1 ? '' : 's' }} up to your highest level</small></p>
            <p class="pillen">
              @for (z of m.rows; track z.id) {
                <a class="pille" [routerLink]="['/artikel', z.id]" [nwQuick]="z.id">{{ z.name }}</a>
              }
              <a [routerLink]="['/rules']" [queryParams]="{ type: 'Spell', usable: artikel().id }">all {{ m.total }} →</a>
            </p>
          }
        </div>
        <div class="karte">
          <h2>How you learn spells</h2>
          @for (p of lernen().own; track p.mode) {
            <div class="weg">
              <b>{{ p.label }}</b> <span class="deins">yours</span>
              <p>{{ p.text }}</p>
            </div>
          } @empty {
            <p class="leer">No spells with a way of learning yet.</p>
          }
          @if (lernen().other.length) {
            <details>
              <summary>Other ways in this campaign ({{ lernen().other.length }})</summary>
              @for (p of lernen().other; track p.mode) {
                <div class="weg anders"><b>{{ p.label }}</b><p>{{ p.text }}</p></div>
              }
            </details>
          }
        </div>
      </div>
      @if (fehler()) {
        <p class="fehler" role="alert">{{ fehler() }}</p>
      }
    </section>
  `,
  styleUrl: './zauberliste.scss',
})
export class Zauberliste {
  readonly artikel = input.required<Entity>();

  private readonly daten = inject(FigurDaten);
  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  private readonly api = inject(Api);

  private readonly lage = computed(() => this.daten.fuer(this.artikel().id));
  protected readonly darf = computed(() => this.session.darfSchreiben()(this.artikel().id));
  protected readonly fehler = signal<string | null>(null);
  protected readonly moeglich = signal<{ total: number; rows: { id: string; name: string }[] } | null>(null);
  protected readonly ordinal = ordinalShort;

  private readonly vitals = computed(() => (this.artikel().components?.['Vitals'] ?? {}) as Record<string, unknown>);
  protected readonly kopf = computed(() => this.lage().kopf()?.casting ?? null);
  private readonly slots = computed(() => this.lage().kopf()?.slots ?? []);

  protected readonly konzentration = computed(() => {
    const id = this.vitals()['concentration'];
    return typeof id === 'string' ? this.bestand.name()(id) ?? '' : '';
  });
  protected readonly konzDauer = computed(() => {
    const d = this.vitals()['durations'];
    return d && typeof d === 'object' ? String((d as Record<string, unknown>)['concentration'] ?? '') : '';
  });

  private readonly zeilen = computed<ZauberZeile[]>(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const name = this.bestand.name();
    const nameOf = (id: string) => {
      const e = this.bestand.voll().get(id);
      return e ? entityName(e) : name(id);
    };
    const haende = this.lage().haende();
    const slots = this.slots();
    const eigene = new Set((this.artikel().relations ?? []).map((k) => k.id));
    return this.lage()
      .zauber()
      .flatMap(({ kante, spell }) => {
        if (!spell) return [];
        const sp = (spell.components?.['Spell'] ?? {}) as Record<string, unknown>;
        const buch = spellBook(r, spell, nameOf);
        const zeile = (label: string) => buch.lines.find((l) => l.label === label)?.text ?? '';
        const level = Number(sp['level']) || 0;
        const komponenten = (Array.isArray(sp['components']) ? (sp['components'] as string[]) : []).map((x) => x.toUpperCase());
        const ritual = sp['ritual'] === true;
        const mode = String(kante.props?.['mode'] ?? '');
        const quelle = [mode, eigene.has(kante.id) ? '' : 'statblock'].filter(Boolean).join(' · ');
        return [
          {
            id: kante.to,
            name: entityName(spell),
            level,
            school: String(sp['school'] ?? ''),
            zeit: zeile('Casting Time'),
            weite: zeile('Range'),
            dauer: zeile('Duration'),
            komponenten,
            material: String(sp['material'] ?? ''),
            konzentration: sp['concentration'] === true,
            ritual,
            quelle,
            sperre: spellLock(haende, { level, components: komponenten, ritual }, slots),
            platz: slotFor(level, slots),
            art: typeof sp['castingAction'] === 'string' ? nameOf(sp['castingAction']) ?? null : null,
          },
        ];
      });
  });
  protected readonly grade = computed(() => spellsByLevel(this.zeilen()));

  protected unterzeile(z: ZauberZeile): string {
    return [z.school, z.quelle].filter(Boolean).join(' · ');
  }

  protected gradNotiz(level: number): string {
    if (level === 0) return 'at will';
    const s = this.slots().find((x) => x.level === level);
    return s ? `${s.max - s.used} of ${s.max} slots left` : 'no slots of this level';
  }

  protected readonly haendeText = computed(() => {
    const h = this.lage().haende();
    if (h.shieldUntrained) return 'blocked — a shield without training.';
    if (h.freeHand || h.focus) return 'a hand is free (or holds your focus), so they work.';
    return 'blocked — no free hand.';
  });

  protected readonly klassen = computed(() => {
    const name = this.bestand.name();
    return (this.artikel().relations ?? [])
      .filter((k) => k.type === 'hasClass')
      .map((k) => {
        const e = this.bestand.voll().get(k.to);
        return { id: k.to, name: e ? entityName(e) : name(k.to) ?? k.to };
      });
  });

  protected readonly lernen = computed(() => learningPaths(this.lage().zauber().map((z) => String(z.kante.props?.['mode'] ?? ''))));

  constructor() {
    /* „Possible for you now": dieselbe Liste wie „Usable by" im Kompendium (T-180, T-212). */
    effect(() => {
      const id = this.artikel().id;
      untracked(() => {
        this.api
          .list({ type: 'Spell', usable: id, limit: 6 })
          .then((l) => this.moeglich.set({ total: l.total, rows: l.rows.map((z) => ({ id: z.id, name: z.name })) }))
          .catch(() => this.moeglich.set(null));
      });
    });
  }

  protected async wirken(z: ZauberZeile): Promise<void> {
    if (z.sperre) return;
    this.fehler.set(null);
    const typ = turnTypeOf(z.art);
    try {
      await this.daten.vitals(this.artikel().id, (v) => {
        const neu: Record<string, unknown> = {};
        /* Der kleinste freie Platz ab dem Grad; ein Ritual ohne Platz verbraucht keinen. */
        if (z.level > 0 && z.platz) {
          const s = this.slots().find((x) => x.level === z.platz);
          neu['slotsUsed'] = setSlotsUsed(v['slotsUsed'], z.platz, (s?.used ?? 0) + 1);
        }
        if (z.konzentration) {
          neu['concentration'] = z.id;
          const d = { ...((v['durations'] as Record<string, unknown>) ?? {}) };
          if (z.dauer) d['concentration'] = z.dauer.replace(/^Concentration, /, '');
          else delete d['concentration'];
          neu['durations'] = Object.keys(d).length ? d : undefined;
        }
        if (typ === 'action' || typ === 'bonus' || typ === 'reaction') {
          const u = Array.isArray(v['turnUsed']) ? (v['turnUsed'] as string[]) : [];
          if (!u.includes(typ)) neu['turnUsed'] = [...u, typ];
        }
        return neu;
      });
    } catch (error) {
      this.fehler.set(fehlerText(error));
    }
  }
}
