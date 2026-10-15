import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { choiceLabel, choiceText, choicesOf, entityName, grantedFeatures, linkIndex, primaryInterface } from '@nw/model';
import type { Entity, VarScopes } from '@nw/model';
import { Api, ApiError, type HerkunftBuendel } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Quellen } from '../kern/quellen';
import { Text } from '../artikel/text';
import { sindZeilen, tabelleAlsText } from '../artikel/felder';
import { Merkmal } from './merkmal';
import { HERKUNFT_WEG } from './ansicht-weg';

/** Die Bücher, die zuerst stehen — wie in der Klassenansicht. */
const KERN = ['PHB', 'XPHB', 'DMG', 'MM'];

interface Eckdatum {
  label: string;
  wert: string;
  /** Mit Verweisen — gezeichnet über `nw-text`. */
  lang?: boolean;
}

interface Spielart {
  e: Entity;
  name: string;
  quelle: string;
  eckdaten: Eckdatum[];
  merkmale: Entity[];
}

/**
 * **Eine Herkunft oder ein Hintergrund wie die Klassenansicht** (T-166):
 * Eckdaten, die Wahlen als Satz (`choiceText`, mit Verweisen), die
 * Merkmale ausgeschrieben (`nw-merkmal`), die Spielarten als Leiste zum
 * Umschalten und Vergleichen, die Tabellen eines Hintergrunds als
 * Würfeltabellen.
 *
 * Geladen wird **eine** Antwort (`GET /api/origins/:id`), gesiebt am
 * Server; die Auswahl steht in der Adresse (`?sub=…`) wie bei den
 * Unterklassen. Herkunft und Hintergrund teilen die Seite — sie
 * unterscheiden sich in ihren Eckdaten, nicht in ihrer Bauart.
 */
@Component({
  selector: 'nw-herkunft',
  imports: [RouterLink, Text, Merkmal],
  templateUrl: './herkunft.html',
  styleUrl: './klasse.scss',
})
export class Herkunft {
  readonly id = input.required<string>();
  /** `?sub=a,b` — die gewählten Spielarten. */
  readonly sub = input<string | undefined>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly bestand = inject(Bestand);
  private readonly quellenTitel = inject(Quellen);

  protected readonly daten = signal<HerkunftBuendel | null>(null);
  protected readonly fehlt = signal(false);
  protected readonly fehler = signal<string | null>(null);

  constructor() {
    void this.bestand.load();
    effect(() => {
      const id = this.id();
      this.daten.set(null);
      this.fehlt.set(false);
      this.fehler.set(null);
      this.api
        .herkunft(id)
        .then((d) => {
          if (this.id() === id) this.daten.set(d);
        })
        .catch((error: unknown) => {
          if (this.id() !== id) return;
          if (error instanceof ApiError && error.status === 404) this.fehlt.set(true);
          else this.fehler.set(error instanceof Error ? error.message : String(error));
        });
    });
  }

  protected quellTitel(kuerzel: string): string {
    return this.quellenTitel.titel(kuerzel);
  }

  protected readonly haupt = computed(() => this.daten()?.origin ?? null);
  protected readonly art = computed(() => {
    const h = this.haupt();
    return h ? primaryInterface(h) : 'Ancestry';
  });
  protected readonly liste = computed(() => HERKUNFT_WEG[this.art()] ?? HERKUNFT_WEG['Ancestry']!);
  protected readonly name = computed(() => entityName(this.haupt() ?? undefined));
  protected readonly index = computed(() => {
    const d = this.daten();
    return d ? linkIndex([d.origin, ...d.variants, ...d.tables, ...d.features]) : new Map<string, Entity>();
  });
  protected readonly scopes = computed<VarScopes>(() => ({ campaign: this.bestand.registry()?.vars }));

  private quelleVon(e: Entity): string {
    return String(e.components?.['Source']?.['publication'] ?? '');
  }

  protected readonly untertitel = computed(() => {
    const h = this.haupt();
    if (!h) return '';
    const s = h.components?.['Source'] ?? {};
    const q = this.quelleVon(h);
    return [q ? `${q}${s['page'] ? ` p. ${String(s['page'])}` : ''}` : '', this.art() === 'Background' ? 'Background' : 'Ancestry']
      .filter(Boolean)
      .join(' · ');
  });

  /**
   * Was 5e.tools über den Merkmalen zeigt. Gelesen wird die Karte der Art
   * und die Übungen; was zu wählen ist, steht als Satz aus `choiceText`
   * (mit seinen Verweisen, T-162) — eine Liste im Code gibt es nicht.
   */
  protected eckdatenVon(e: Entity): Eckdatum[] {
    const a = (e.components?.['Ancestry'] ?? {}) as Record<string, unknown>;
    const b = (e.components?.['Background'] ?? {}) as Record<string, unknown>;
    const p = (e.components?.['Proficiencies'] ?? {}) as { proficient?: unknown; saves?: unknown };
    const liste = (l: unknown) => (Array.isArray(l) ? l.map(String).join(', ') : typeof l === 'string' ? l : '');
    const z: Eckdatum[] = [];
    const neu = (label: string, wert: unknown, lang = false) => {
      const w = liste(wert);
      if (w) z.push({ label, wert: w, lang });
    };
    neu('Creature type', a['creatureType']);
    neu('Size', Array.isArray(a['size']) ? (a['size'] as string[]).map((s) => s[0]!.toUpperCase() + s.slice(1)) : a['size']);
    neu('Speed', a['speed']);
    const bonus = a['abilityBonus'];
    if (bonus && typeof bonus === 'object') {
      neu(
        'Ability scores',
        Object.entries(bonus as Record<string, unknown>)
          .map(([k, v]) => `${k.toUpperCase()} ${Number(v) >= 0 ? '+' : ''}${String(v)}`)
          .join(', '),
      );
    }
    neu('Ability choice', a['abilityNote']);
    if (typeof a['darkvision'] === 'number' && a['darkvision']) neu('Darkvision', `${a['darkvision']} ft.`);
    neu('Resistances', a['resistances']);
    neu('Age', a['age']);
    neu('Proficiencies', p.proficient);
    for (const c of choicesOf(e).filter((c) => c.kind !== 'equipment')) {
      z.push({ label: choiceLabel(c), wert: choiceText(c), lang: true });
    }
    /* Die Ausrüstung als Text mit Verweisen; die Optionen (a)/(b) stehen
       darin wie im Buch — die Wahl selbst trifft der Assistent. */
    if (typeof b['startingEquipment'] === 'string' && b['startingEquipment']) {
      z.push({ label: 'Starting equipment', wert: b['startingEquipment'], lang: true });
    } else {
      for (const c of choicesOf(e).filter((c) => c.kind === 'equipment')) {
        z.push({ label: choiceLabel(c), wert: choiceText(c), lang: true });
      }
    }
    return z;
  }

  protected readonly eckdaten = computed(() => {
    const h = this.haupt();
    return h ? this.eckdatenVon(h) : [];
  });
  protected readonly merkmale = computed(() => {
    const h = this.haupt();
    return h ? grantedFeatures(h, this.index()) : [];
  });

  // -------------------------------------------------------------- Spielarten

  protected readonly spielarten = computed<Spielart[]>(() => {
    const d = this.daten();
    if (!d) return [];
    const rang = (q: string) => (KERN.includes(q) ? KERN.indexOf(q) : KERN.length);
    return d.variants
      .map((e) => ({
        e,
        name: entityName(e),
        quelle: this.quelleVon(e),
        eckdaten: this.eckdatenVon(e),
        merkmale: grantedFeatures(e, this.index()),
      }))
      .sort((a, b) => rang(a.quelle) - rang(b.quelle) || a.name.localeCompare(b.name));
  });

  protected readonly gewaehlt = computed(() => {
    const ids = new Set((this.sub() ?? '').split(',').filter(Boolean));
    return this.spielarten().filter((u) => ids.has(u.e.id));
  });
  protected readonly gewaehltIds = computed(() => new Set(this.gewaehlt().map((u) => u.e.id)));
  protected readonly nummer = computed(() => new Map(this.gewaehlt().map((u, i) => [u.e.id, i])));

  protected umschalten(id: string): void {
    const ids = new Set(this.gewaehltIds());
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    this.setzeAuswahl([...ids]);
  }
  protected keine(): void {
    this.setzeAuswahl([]);
  }
  private setzeAuswahl(ids: string[]): void {
    void this.router.navigate([], {
      queryParams: { sub: ids.length ? ids.join(',') : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Eine Spielart, die so heisst wie ihr Merkmal, braucht seinen Namen nicht zweimal. */
  protected nameVon(e: Entity): string {
    return entityName(e);
  }

  // ---------------------------------------------------------------- Tabellen

  /** Die Tabellen als Markdown, damit `nw-text` sie mit Würfeln und Verweisen zeichnet. */
  protected readonly tabellen = computed(() =>
    (this.daten()?.tables ?? []).map((t) => {
      const k = (t.components?.['Table'] ?? {}) as { die?: string; columns?: unknown; rows?: unknown };
      const zeilen = sindZeilen(k.rows) ? k.rows : [];
      const spalten = Array.isArray(k.columns) && k.columns.length ? k.columns : [k.die ?? '', entityName(t)];
      return { id: t.id, name: entityName(t), text: zeilen.length ? tabelleAlsText(spalten, zeilen) : '' };
    }),
  );
}
