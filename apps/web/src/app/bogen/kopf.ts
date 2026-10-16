import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  applyDamage,
  applyHeal,
  castBlock,
  cleanAmount,
  concentrationDc,
  goldText,
  grantTemp,
  pipToggle,
  setSlotsUsed,
  signedBook,
  wheelAmount,
} from '@nw/model';
import type { Entity } from '@nw/model';
import { Api } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { BegriffLink, Glossar } from '../kern/glossar';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { FigurDaten, fehlerText } from './daten';

/** Unter dieser Breite startet der Kopf eingeklappt (T-247, Telefon). */
export const SCHMAL = 760;

/** Ein Eintrag der Statuszeile. */
interface Chip {
  id: string;
  label: string;
  note: string;
  farbe: string;
  /** Strichliert: wartet (auf die Leitung) oder sperrt. */
  strich?: boolean;
  /** Der Artikel dahinter (Zustand, Zauber) für Kurzansicht und Glossar. */
  artikel?: string;
  /** × entfernt; ohne × steht er nur da. */
  weg?: () => void;
  /** Ein Klick führt in einen Reiter. */
  reiter?: string;
}

/**
 * **Der Kopf der Spielerseite** (T-247, Element `sheet`; REQ-051, REQ-063):
 * Trefferpunkte mit Betrag (Eingabe, − / +, Mausrad), Schaden zuerst von
 * den zeitweiligen, Heilen, zeitweilige setzen; das Karussell Vitals ↔
 * Spellcasting; Trefferwürfel, Plätze und Inspiration als Punkte; das
 * Gold; die Attribute; darunter die Statuszeile mit Konzentration,
 * Zuständen und ihrer Dauer, „Versteckt" und der Konzentrationsprobe nach
 * Schaden. Einklappbar über „▴ Less" in der Statuszeile — nicht in der
 * Navigation (Rückmeldung der Leitung); schmal startet er eingeklappt.
 *
 * REQ-343 (Statuszeile, Konzentration). Gerechnet wird im Modell (`sheetHeader`, `applyDamage` …), gespeichert
 * in `Vitals` der Figur; wer nicht schreiben darf, sieht die Werte.
 */
@Component({
  selector: 'nw-bogen',
  imports: [RouterLink, KurzLink, BegriffLink],
  template: `
    @if (kopf(); as k) {
      <section class="bogen" aria-label="Character sheet header" [class.klein]="klein()">
        @if (!klein()) {
          <div class="zeile">
            <!-- Trefferpunkte -->
            <div class="hp block" aria-label="Hit points">
              <span class="lbl">Hit points</span>
              <div class="hpwert">
                <b>{{ k.hp ?? '—' }}</b>
                @if (k.max !== null) {
                  <span class="max">/ {{ k.max }}</span>
                }
              </div>
              <div class="balken" aria-hidden="true"><i [style.width.%]="anteil()"></i></div>
              <label class="temp">
                <span class="lbl">Temp</span>
                <input
                  type="number"
                  min="0"
                  [value]="k.temp"
                  [disabled]="!darf()"
                  (change)="setzeTemp($any($event.target).value)"
                  aria-label="Temporary hit points"
                />
                @if (darf() && k.temp) {
                  <button type="button" class="x" (click)="setzeTemp(0)" aria-label="Clear temporary hit points">×</button>
                }
              </label>
            </div>
            @if (darf()) {
              <div class="block betrag">
                <div class="stepper" (wheel)="rad($event)" title="Type the amount, scroll over it or use − and +">
                  <button type="button" (click)="betrag.set(max1(betrag() - 1))" aria-label="Less">−</button>
                  <input type="number" min="1" [value]="betrag()" (input)="betrag.set(max1($any($event.target).value))" aria-label="Amount" />
                  <button type="button" (click)="betrag.set(betrag() + 1)" aria-label="More">+</button>
                </div>
                <span class="lbl">amount</span>
                <div class="knoepfe">
                  <button type="button" class="dmg" (click)="schaden()">− Damage</button>
                  <button type="button" class="heal" (click)="heilen()">+ Heal</button>
                  <button type="button" class="tmp" (click)="temp()" title="Temporary hit points don't stack: the higher value stays">Temp</button>
                </div>
              </div>
            }
            <!-- Karussell: Vitals ↔ Spellcasting (T-246) -->
            <div class="block karussell" aria-roledescription="carousel" [attr.aria-label]="seite().titel">
              <div class="kar-kopf">
                @if (seiten().length > 1) {
                  <button type="button" class="pfeil" (click)="blaettern(-1)" aria-label="Previous">‹</button>
                }
                <span class="lbl">{{ seite().titel }}</span>
                @if (seiten().length > 1) {
                  <span class="punkte">
                    @for (s of seiten(); track s.titel; let i = $index) {
                      <button type="button" class="punkt" [class.an]="i === seiteI()" (click)="seiteNr.set(i)" [attr.aria-label]="s.titel" [attr.aria-current]="i === seiteI()"></button>
                    }
                  </span>
                  <button type="button" class="pfeil" (click)="blaettern(1)" aria-label="Next">›</button>
                }
              </div>
              <dl class="zellen">
                @for (c of seite().zellen; track c.key) {
                  <div class="zelle" [attr.title]="c.why ?? null">
                    <dt>{{ c.label }}</dt>
                    <dd>{{ c.value }}</dd>
                    @if (c.why) {
                      <small>{{ c.why }}</small>
                    }
                  </div>
                } @empty {
                  <p class="leer">No statblock yet.</p>
                }
              </dl>
            </div>
            <!-- Punkte und Gold -->
            <div class="block mittel">
              @if (k.hitDice; as hd) {
                <div class="res">
                  <span class="lbl">Hit dice {{ hd.die }}</span>
                  <span class="pips">
                    @for (i of reihe(hd.max); track i) {
                      <button
                        type="button"
                        class="pip eckig"
                        [class.weg]="i >= hd.left"
                        [disabled]="!darf()"
                        [attr.aria-pressed]="i >= hd.left"
                        [attr.aria-label]="'Hit die ' + (i + 1)"
                        (click)="trefferwuerfel(i, hd.max, hd.left)"
                      ></button>
                    }
                  </span>
                </div>
              }
              @for (s of k.slots; track s.level) {
                <div class="res">
                  <span class="lbl">Slots {{ ordinal(s.level) }}</span>
                  <span class="pips">
                    @for (i of reihe(s.max); track i) {
                      <button
                        type="button"
                        class="pip"
                        [class.weg]="i < s.used"
                        [disabled]="!darf()"
                        [attr.aria-pressed]="i < s.used"
                        [attr.aria-label]="'Spell slot ' + (i + 1)"
                        (click)="platz(s.level, s.used, i)"
                      ></button>
                    }
                  </span>
                </div>
              }
              <div class="res">
                <span class="lbl">Inspiration</span>
                <button
                  type="button"
                  class="pip"
                  [class.weg]="!k.inspiration"
                  [disabled]="!darf()"
                  [attr.aria-pressed]="k.inspiration"
                  aria-label="Inspiration"
                  (click)="inspiration(!k.inspiration)"
                ></button>
              </div>
              <div class="res">
                <span class="lbl gold">Gold</span>
                <a class="goldwert" [routerLink]="[]" [queryParams]="{ tab: 'gear' }" queryParamsHandling="merge" title="On you · the party's — open Gear">
                  <b>{{ gold().onYou }}</b>
                  @if (gold().party; as p) {
                    <span class="dim">· party {{ p }}</span>
                  }
                </a>
              </div>
            </div>
          </div>
          <!-- Attribute: Modifikator gross, Wert, Rettungswurf -->
          <div class="attribute" aria-label="Abilities">
            @for (a of k.abilities; track a.key) {
              <button type="button" class="attr" [disabled]="a.mod === null" (click)="probe(a.key, a.mod)" [attr.title]="a.label + ' — click to roll a check'">
                <span class="links">
                  <b>{{ a.label }}</b>
                  <small>{{ a.score ?? '—' }} · save {{ a.save === null ? '—' : signed(a.save) }}{{ a.saveProficient ? ' ●' : '' }}</small>
                </span>
                <span class="mod">{{ a.mod === null ? '—' : signed(a.mod) }}</span>
              </button>
            }
          </div>
        } @else {
          <!-- Eingeklappt: HP, Betrag mit Dmg/Heal, RK/Init/Tempo -->
          <div class="kompakt">
            <span class="khp"><b>{{ k.hp ?? '—' }}</b>@if (k.max !== null) {<span class="max">/{{ k.max }}</span>}
              @if (k.temp) {<span class="ktemp">+{{ k.temp }} temp</span>}</span>
            @if (darf()) {
              <span class="stepper klein" (wheel)="rad($event)">
                <button type="button" (click)="betrag.set(max1(betrag() - 1))" aria-label="Less">−</button>
                <input type="number" min="1" [value]="betrag()" (input)="betrag.set(max1($any($event.target).value))" aria-label="Amount" />
                <button type="button" (click)="betrag.set(betrag() + 1)" aria-label="More">+</button>
              </span>
              <button type="button" class="dmg" (click)="schaden()">− Dmg</button>
              <button type="button" class="heal" (click)="heilen()">+ Heal</button>
            }
            <span class="kzahlen">
              @for (c of kurzZahlen(); track c.key) {
                <span><b>{{ c.label }}</b> {{ c.value }}</span>
              }
            </span>
          </div>
        }
        <!-- Die Statuszeile, auch eingeklappt -->
        <div class="status" aria-label="Status and conditions">
          <span class="lbl">Status</span>
          @for (c of chips(); track c.id) {
            <span class="chip" [class.strich]="c.strich" [style.--farbe]="c.farbe">
              @if (c.artikel) {
                <a [routerLink]="['/artikel', c.artikel]" [nwQuick]="c.artikel" [nwBegriff]="begriff(c.artikel, c.label)">{{ c.label }}</a>
              } @else if (c.reiter) {
                <a [routerLink]="[]" [queryParams]="{ tab: c.reiter }" queryParamsHandling="merge">{{ c.label }}</a>
              } @else {
                <span>{{ c.label }}</span>
              }
              @if (c.note) {
                <small>{{ c.note }}</small>
              }
              @if (c.weg && darf()) {
                <button type="button" class="x" (click)="c.weg()" [attr.aria-label]="'Remove ' + c.label">×</button>
              }
            </span>
          }
          @if (darf()) {
            @if (waehlt()) {
              <span class="neu">
                <select #wahl aria-label="Condition">
                  <option value="">Condition…</option>
                  <option value="hidden">Hidden</option>
                  @for (z of zustaende(); track z.id) {
                    <option [value]="z.id">{{ z.name }}</option>
                  }
                </select>
                <input #dauer type="text" placeholder="for how long" aria-label="Duration" />
                <button type="button" (click)="zustandDazu(wahl.value, dauer.value)">Add</button>
                <button type="button" (click)="waehlt.set(false)">Cancel</button>
              </span>
            } @else {
              <button type="button" class="dazu" (click)="waehlen()">+ Condition</button>
            }
          }
          <span class="rechts">
            <button type="button" class="umschalten" (click)="klein.set(!klein())" [attr.aria-expanded]="!klein()" [attr.title]="klein() ? 'Show the full header' : 'Collapse the header'">
              {{ klein() ? '▾ More' : '▴ Less' }}
            </button>
          </span>
        </div>
        @if (probeOffen(); as p) {
          <div class="probe" role="alert">
            <b>Concentration check</b>
            <span>You took {{ p.schaden }} damage — CON save DC {{ p.dc }}{{ conSave() !== null ? ' (you: ' + signed(conSave()!) + ')' : '' }} or {{ konzName() || 'the spell' }} ends.</span>
            @if (p.wurf !== null) {
              <span class="wurf">Rolled {{ p.wurf }}</span>
            }
            <span class="knoepfe">
              <button type="button" (click)="konzWurf()">Roll{{ conSave() !== null ? ' ' + signed(conSave()!) : '' }}</button>
              <button type="button" class="heal" (click)="probeOffen.set(null)">Passed</button>
              <button type="button" class="dmg" (click)="konzVerloren()">Failed</button>
            </span>
          </div>
        }
        @if (fehler()) {
          <p class="fehler" role="alert">{{ fehler() }}</p>
        }
      </section>
    }
  `,
  styleUrl: './bogen.scss',
  host: { '[class.klein]': 'klein()' },
})
export class Bogen {
  readonly artikel = input.required<Entity>();

  private readonly daten = inject(FigurDaten);
  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  private readonly api = inject(Api);
  protected readonly glossar = inject(Glossar);

  private readonly lage = computed(() => this.daten.fuer(this.artikel().id));
  protected readonly kopf = computed(() => this.lage().kopf());
  protected readonly darf = computed(() => this.session.darfSchreiben()(this.artikel().id));

  /** Der Betrag für Schaden, Heilung und zeitweilige — bleibt zwischen den Klicks stehen. */
  protected readonly betrag = signal(4);
  protected readonly klein = signal(typeof window !== 'undefined' && window.innerWidth < SCHMAL);
  protected readonly seiteNr = signal(0);
  protected readonly waehlt = signal(false);
  protected readonly fehler = signal<string | null>(null);
  /** Die offene Konzentrationsprobe nach Schaden. */
  protected readonly probeOffen = signal<{ schaden: number; dc: number; wurf: number | null } | null>(null);
  /** Die `Condition`-Artikel zum Hinzufügen. */
  protected readonly zustaende = signal<{ id: string; name: string }[]>([]);

  protected readonly signed = signedBook;
  protected readonly ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || (n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10]}`;
  protected readonly max1 = (v: unknown) => Math.max(1, cleanAmount(v));
  protected reihe(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  private readonly vitals = computed(() => (this.artikel().components?.['Vitals'] ?? {}) as Record<string, unknown>);

  protected readonly anteil = computed(() => {
    const k = this.kopf();
    return k?.hp != null && k.max ? Math.max(0, Math.min(100, Math.round((k.hp / k.max) * 100))) : 0;
  });

  protected readonly seiten = computed(() => {
    const k = this.kopf();
    const s = [{ titel: 'Vitals', zellen: k?.vitals ?? [] }];
    if (k?.casting) s.push({ titel: 'Spellcasting', zellen: k.casting });
    return s;
  });
  protected readonly seiteI = computed(() => {
    const n = this.seiten().length;
    return ((this.seiteNr() % n) + n) % n;
  });
  protected readonly seite = computed(() => this.seiten()[this.seiteI()]!);
  protected blaettern(d: number): void {
    this.seiteNr.set(this.seiteI() + d);
  }

  protected readonly kurzZahlen = computed(() => (this.kopf()?.vitals ?? []).filter((c) => ['ac', 'init', 'speed'].includes(c.key)));

  protected readonly gold = computed(() => {
    const k = this.lage().kupfer();
    return goldText(k.beiDir, k.gruppe);
  });

  protected readonly konzName = computed(() => {
    const id = this.vitals()['concentration'];
    return typeof id === 'string' ? this.bestand.name()(id) ?? '' : '';
  });

  protected readonly conSave = computed(() => this.kopf()?.abilities.find((a) => a.key === 'con')?.save ?? null);

  private dauer(key: string): string {
    const d = this.vitals()['durations'];
    return d && typeof d === 'object' ? String((d as Record<string, unknown>)[key] ?? '') : '';
  }

  protected readonly chips = computed<Chip[]>(() => {
    const v = this.vitals();
    const name = this.bestand.name();
    const out: Chip[] = [];
    const konz = v['concentration'];
    if (typeof konz === 'string' && konz) {
      out.push({
        id: 'konz',
        label: `Concentrating · ${name(konz) ?? konz}`,
        note: this.dauer('concentration'),
        farbe: 'var(--magic)',
        artikel: konz,
        weg: () => void this.konzVerloren(),
      });
    }
    const zustaende = Array.isArray(v['conditions']) ? (v['conditions'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    for (const z of zustaende) {
      out.push({ id: z, label: name(z) ?? z, note: this.dauer(z), farbe: 'var(--good)', artikel: z, weg: () => void this.zustandWeg(z) });
    }
    if (v['hidden'] === true) {
      out.push({ id: 'hidden', label: 'Hidden', note: this.dauer('hidden') || 'until you attack', farbe: 'var(--dim)', weg: () => void this.schreib((w) => ({ hidden: undefined, durations: this.ohne('hidden', w) })) });
    }
    /* Die Hände sperren das Zaubern (T-244 bringt das Ausrüsten). */
    const sperre = castBlock(this.lage().haende());
    if (sperre && this.kopf()?.casting) {
      out.push({ id: 'cast', label: 'Spellcasting blocked', note: this.lage().haende().shieldUntrained ? 'shield, no training' : 'no free hand', farbe: 'var(--hp)', strich: true, reiter: 'gear' });
    }
    return out;
  });

  constructor() {
    /* Die Namen der Zustände und des Zaubers holt, wer sie zeigt. */
    effect(() => {
      const v = this.vitals();
      const name = this.bestand.name();
      const ids = [...(Array.isArray(v['conditions']) ? (v['conditions'] as string[]) : []), ...(typeof v['concentration'] === 'string' ? [v['concentration']] : [])];
      const offen = ids.filter((id) => typeof id === 'string' && !name(id));
      if (offen.length) untracked(() => void this.bestand.holen(offen));
    });
  }

  protected begriff(id: string | undefined, name: string): string | null {
    return this.glossar.begriffZu(id, name);
  }

  // ------------------------------------------------------------ schreiben

  private ohne(key: string, v: Record<string, unknown> = this.vitals()): Record<string, unknown> | undefined {
    const d = v['durations'];
    if (!d || typeof d !== 'object') return undefined;
    const n = { ...(d as Record<string, unknown>) };
    delete n[key];
    return Object.keys(n).length ? n : undefined;
  }

  private async schreib(aendern: (v: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
    this.fehler.set(null);
    try {
      await this.daten.vitals(this.artikel().id, aendern);
    } catch (error) {
      this.fehler.set(fehlerText(error));
    }
  }

  private stand(v: Record<string, unknown>) {
    const k = this.kopf();
    const hp = Number(v['hp']);
    return { hp: Number.isFinite(hp) ? hp : k?.hp ?? 0, temp: Math.max(0, Number(v['hpTemp']) || 0) };
  }

  protected rad(ev: WheelEvent): void {
    /* Über dem Betrag dreht das Rad die Zahl, statt die Seite zu schieben. */
    ev.preventDefault();
    this.betrag.set(wheelAmount(this.betrag(), ev.deltaY));
  }

  protected async schaden(): Promise<void> {
    const betrag = this.betrag();
    const konzentriert = typeof this.vitals()['concentration'] === 'string';
    await this.schreib((v) => {
      const n = applyDamage(this.stand(v), betrag);
      return { hp: n.hp, hpTemp: n.temp || undefined };
    });
    /* Schaden bei Konzentration fragt die Probe ab (PHB). */
    if (konzentriert && !this.fehler()) this.probeOffen.set({ schaden: betrag, dc: concentrationDc(betrag), wurf: null });
  }

  protected heilen(): Promise<void> {
    const betrag = this.betrag();
    const max = this.kopf()?.max ?? null;
    return this.schreib((v) => ({ hp: applyHeal(this.stand(v), betrag, max).hp }));
  }

  protected temp(): Promise<void> {
    const betrag = this.betrag();
    return this.schreib((v) => ({ hpTemp: grantTemp(this.stand(v), betrag).temp || undefined }));
  }

  protected setzeTemp(wert: unknown): Promise<void> {
    const t = cleanAmount(wert);
    return this.schreib(() => ({ hpTemp: t || undefined }));
  }

  protected trefferwuerfel(i: number, max: number, left: number): Promise<void> {
    /* Ein Punkt ist ein Würfel; verbraucht ist, was rechts von „übrig" liegt. */
    const verbraucht = pipToggle(max - left, max - 1 - i);
    return this.schreib(() => ({ hitDiceLeft: max - verbraucht }));
  }

  protected platz(level: number, used: number, i: number): Promise<void> {
    const neu = pipToggle(used, i);
    return this.schreib((v) => ({ slotsUsed: setSlotsUsed(v['slotsUsed'], level, neu) }));
  }

  protected inspiration(an: boolean): Promise<void> {
    return this.schreib(() => ({ inspiration: an || undefined }));
  }

  protected async konzVerloren(): Promise<void> {
    this.probeOffen.set(null);
    await this.schreib((v) => ({ concentration: undefined, durations: this.ohne('concentration', v) }));
  }

  protected async konzWurf(): Promise<void> {
    const p = this.probeOffen();
    if (!p) return;
    const bonus = this.conSave() ?? 0;
    try {
      const w = await this.api.roll({ expr: `1d20${bonus >= 0 ? '+' : ''}${bonus}`, subject: this.artikel().id, label: 'Concentration (CON save)' });
      this.probeOffen.set({ ...p, wurf: w.total });
    } catch (error) {
      this.fehler.set(fehlerText(error));
    }
  }

  protected async probe(key: string, mod: number | null): Promise<void> {
    if (mod === null) return;
    try {
      await this.api.roll({ expr: `1d20${mod >= 0 ? '+' : ''}${mod}`, subject: this.artikel().id, label: `${key.toUpperCase()} check` });
    } catch (error) {
      this.fehler.set(fehlerText(error));
    }
  }

  protected async waehlen(): Promise<void> {
    this.waehlt.set(true);
    if (this.zustaende().length) return;
    try {
      const l = await this.api.list({ type: 'Condition', limit: 200 });
      this.zustaende.set(l.rows.map((x) => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      this.fehler.set(fehlerText(error));
    }
  }

  protected async zustandDazu(id: string, dauer: string): Promise<void> {
    if (!id) return;
    this.waehlt.set(false);
    const d = dauer.trim();
    await this.schreib((v) => {
      const durations = { ...((v['durations'] as Record<string, unknown>) ?? {}) };
      if (d) durations[id] = d;
      if (id === 'hidden') return { hidden: true, durations: Object.keys(durations).length ? durations : undefined };
      const liste = Array.isArray(v['conditions']) ? (v['conditions'] as string[]) : [];
      return { conditions: liste.includes(id) ? liste : [...liste, id], durations: Object.keys(durations).length ? durations : undefined };
    });
  }

  protected zustandWeg(id: string): Promise<void> {
    return this.schreib((v) => {
      const liste = (Array.isArray(v['conditions']) ? (v['conditions'] as string[]) : []).filter((x) => x !== id);
      return { conditions: liste.length ? liste : undefined, durations: this.ohne(id, v) };
    });
  }
}
