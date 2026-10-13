import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { choiceText, choicesOf, classTable, entityName, levelFeatures, linkIndex, proficiencyBonus } from '@nw/model';
import type { Entity, LevelFeature, VarScopes } from '@nw/model';
import { Api, ApiError, type KlassenBuendel } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Text } from '../artikel/text';
import { Merkmal } from './merkmal';
import { Klassentabelle, type KlassenTabelle } from './klassentabelle';

interface Unterklasse {
  e: Entity;
  name: string;
  quelle: string;
  merkmale: LevelFeature[];
  tabelle: Entity | undefined;
}

/** Die Bücher, die zuerst stehen — wie im Kompendium von 5e.tools. */
const KERN = ['PHB', 'DMG', 'MM'];

/**
 * **Eine Klasse wie in 5e.tools** (W6): die Stufentabelle, die Merkmale je
 * Stufe ausgeschrieben, die Unterklassen als Leiste zum Filtern und
 * Vergleichen.
 *
 * Geladen wird **eine** Antwort (`GET /api/classes/:id`): die Klasse, ihre
 * Unterklassen, ihre Tabellen und die Merkmale, die eine davon gewährt
 * oder einbettet. Die Kurzfassung trägt keinen Regeltext, und siebzig
 * Merkmale einzeln zu öffnen wären siebzig Anfragen.
 *
 * **Die Auswahl steht in der Adresse** (`?sub=…&opt=1`): eine verglichene
 * Auswahl lässt sich weitergeben, und Zurück stellt sie wieder her. Ein
 * zweiter Speicher dafür wäre die Stelle, an der Link und Seite
 * auseinanderlaufen.
 *
 * Optionale Merkmale und Variantenregeln (Marke `optional`) stehen erst auf
 * den Schalter hin da — so liest sich die Klasse wie im Grundbuch, und wer
 * mit Tasha spielt, schaltet sie dazu.
 */
@Component({
  selector: 'nw-klasse',
  imports: [RouterLink, Text, Merkmal, Klassentabelle],
  templateUrl: './klasse.html',
  styleUrl: './klasse.scss',
})
export class Klasse {
  readonly id = input.required<string>();
  /** `?sub=a,b` — die gewählten Unterklassen. */
  readonly sub = input<string | undefined>();
  /** `?opt=1` — optionale Merkmale und Varianten zeigen. */
  readonly opt = input<string | undefined>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly bestand = inject(Bestand);

  protected readonly daten = signal<KlassenBuendel | null>(null);
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
        .klasse(id)
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

  protected readonly klasse = computed(() => this.daten()?.class ?? null);
  /** Der Name steht nicht an jedem Artikel oben, aber immer in `Identity`. */
  protected readonly name = computed(() => entityName(this.klasse() ?? undefined));
  protected readonly index = computed(() => {
    const d = this.daten();
    return d
      ? linkIndex([d.class, ...d.subclasses, ...d.tables, ...d.features])
      : new Map<string, Entity>();
  });
  protected readonly scopes = computed<VarScopes>(() => ({
    campaign: this.bestand.registry()?.vars,
  }));

  protected readonly zeigeOptional = computed(() => this.opt() === '1');

  private tabelleVon(e: Entity): Entity | undefined {
    const t = (e.relations ?? []).find((r) => r.type === 'tableFor');
    return t ? this.index().get(t.to) : undefined;
  }
  private quelleVon(e: Entity): string {
    return String(e.components?.['Source']?.['publication'] ?? '');
  }

  /** Die Merkmale der Klasse, optionale nur auf den Schalter hin. */
  protected readonly klassenMerkmale = computed(() => {
    const k = this.klasse();
    if (!k) return [];
    return this.sichtbar(levelFeatures(k, this.index()));
  });
  protected readonly anzahlOptional = computed(() => {
    const k = this.klasse();
    if (!k) return 0;
    const unter = this.unterklassen().flatMap((u) => u.merkmale);
    return [...levelFeatures(k, this.index()), ...unter].filter(
      (f) => f.optional || f.names.some((n) => n.optional),
    ).length;
  });

  // ------------------------------------------------------------ Unterklassen

  protected readonly unterklassen = computed<Unterklasse[]>(() => {
    const d = this.daten();
    if (!d) return [];
    const index = this.index();
    const rang = (q: string) => (KERN.includes(q) ? KERN.indexOf(q) : KERN.length);
    return d.subclasses
      .map((e) => ({
        e,
        name: entityName(e),
        quelle: this.quelleVon(e),
        merkmale: levelFeatures(e, index),
        tabelle: this.tabelleVon(e),
      }))
      .sort((a, b) => rang(a.quelle) - rang(b.quelle) || a.name.localeCompare(b.name));
  });

  /** Die Bücher, aus denen Unterklassen kommen — die Chips zum Filtern. */
  protected readonly quellen = computed(() => {
    const zahl = new Map<string, number>();
    for (const u of this.unterklassen()) zahl.set(u.quelle, (zahl.get(u.quelle) ?? 0) + 1);
    const rang = (q: string) => (KERN.includes(q) ? KERN.indexOf(q) : KERN.length);
    return [...zahl.entries()]
      .map(([q, n]) => ({ q: q || '—', n }))
      .sort((a, b) => rang(a.q) - rang(b.q) || a.q.localeCompare(b.q));
  });

  protected readonly suche = signal('');
  protected readonly quellFilter = signal<ReadonlySet<string>>(new Set());

  protected readonly gefiltert = computed(() => {
    const s = this.suche().trim().toLowerCase();
    const q = this.quellFilter();
    return this.unterklassen().filter(
      (u) => (!s || u.name.toLowerCase().includes(s)) && (!q.size || q.has(u.quelle || '—')),
    );
  });

  protected quelleUmschalten(q: string): void {
    this.quellFilter.update((alt) => {
      const n = new Set(alt);
      if (n.has(q)) n.delete(q);
      else n.add(q);
      return n;
    });
  }

  /** Die gewählten Unterklassen in der Reihenfolge der Leiste. */
  protected readonly gewaehlt = computed<Unterklasse[]>(() => {
    const ids = new Set((this.sub() ?? '').split(',').filter(Boolean));
    return this.unterklassen().filter((u) => ids.has(u.e.id));
  });
  protected readonly gewaehltIds = computed(() => new Set(this.gewaehlt().map((u) => u.e.id)));
  /** Id → Nummer der Vergleichsspalte, wie sie in Tabelle und Spaltenkopf steht. */
  protected readonly nummer = computed(() => new Map(this.gewaehlt().map((u, i) => [u.e.id, i])));

  protected umschalten(id: string): void {
    const ids = new Set(this.gewaehltIds());
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    this.setzeAuswahl([...ids]);
  }
  protected alleGefilterten(): void {
    this.setzeAuswahl([
      ...new Set([...this.gewaehltIds(), ...this.gefiltert().map((u) => u.e.id)]),
    ]);
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
  protected optionalUmschalten(an: boolean): void {
    void this.router.navigate([], {
      queryParams: { opt: an ? '1' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Ohne den Schalter fallen optionale Merkmale weg — und optionale Teile eines Kopfes. */
  private sichtbar(l: LevelFeature[]): LevelFeature[] {
    if (this.zeigeOptional()) return l;
    return l
      .filter((f) => !f.optional)
      .map((f) => ({ ...f, names: f.names.filter((n) => !n.optional) }));
  }

  // --------------------------------------------------------------- Tabelle

  /**
   * Die Stufentabelle: Stufe, Übungsbonus, Merkmale, die Spalten der Klasse
   * und — je gewählter Unterklasse, die eigene bringt — deren Spalten
   * dahinter, mit ihrem Namen darüber.
   */
  protected readonly tabelle = computed<KlassenTabelle | null>(() => {
    const k = this.klasse();
    if (!k) return null;
    const eigene = this.tabelleVon(k);
    const basis = classTable(this.klassenMerkmale(), eigene ? [eigene] : []);
    const gruppen = this.gewaehlt()
      .map((u, nr) => ({ u, nr }))
      .filter(({ u }) => u.tabelle)
      .map(({ u, nr }) => ({ name: u.name, nr, t: classTable([], [u.tabelle!]) }));
    const unter = this.gewaehlt().map((u, i) => ({ i, merkmale: this.sichtbar(u.merkmale) }));
    return {
      spalten: basis.columns,
      gruppen: gruppen.map((g) => ({ name: g.name, nr: g.nr, spalten: g.t.columns })),
      zeilen: basis.rows.map((z, i) => ({
        ...z,
        unter: unter.flatMap((u) =>
          u.merkmale
            .filter((f) => f.level === z.level)
            .flatMap((f) => f.names.map((n) => ({ ...n, nr: u.i }))),
        ),
        gruppen: gruppen.flatMap((g) => g.t.rows[i]?.extra ?? []),
      })),
    };
  });

  // -------------------------------------------------------- Merkmale je Stufe

  /**
   * Die Stufen, auf denen etwas kommt: je Stufe die Merkmale der Klasse und,
   * je gewählter Unterklasse, eine Spalte mit ihren — nebeneinander, damit
   * sich zwei Unterklassen Stufe für Stufe vergleichen lassen.
   */
  protected readonly stufen = computed(() => {
    const klasse = this.klassenMerkmale();
    const gewaehlt = this.gewaehlt().map((u) => ({ u, merkmale: this.sichtbar(u.merkmale) }));
    const out: {
      level: number;
      pb: number;
      klasse: LevelFeature[];
      unter: { u: Unterklasse; merkmale: LevelFeature[] }[] | null;
    }[] = [];
    for (let level = 1; level <= 20; level++) {
      const k = klasse.filter((f) => f.level === level);
      const unter = gewaehlt.map((g) => ({
        u: g.u,
        merkmale: g.merkmale.filter((f) => f.level === level),
      }));
      const hatUnter = unter.some((x) => x.merkmale.length);
      if (!k.length && !hatUnter) continue;
      out.push({ level, pb: proficiencyBonus(level), klasse: k, unter: hatUnter ? unter : null });
    }
    return out;
  });

  protected nameVon(e: Entity): string {
    return entityName(e);
  }

  protected anker(level: number, id: string): string {
    return `l${level}-${id}`;
  }
  protected springe(anker: string): void {
    document.getElementById(anker)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------ Übersicht

  protected readonly untertitel = computed(() => {
    const k = this.klasse();
    if (!k) return '';
    const c = (k.components?.['Class'] ?? {}) as { hitDie?: number; primaryAbility?: string[] };
    const teile: string[] = [];
    if (c.hitDie) teile.push(`Hit Die d${c.hitDie}`);
    if (c.primaryAbility?.length)
      teile.push(`Primary ability ${c.primaryAbility.map((a) => a.toUpperCase()).join(', ')}`);
    const q = this.quelleVon(k);
    if (q) teile.push(q);
    return teile.join(' · ');
  });

  /** Was 5e.tools über der Tabelle zeigt: Übungen, Rettungswürfe, Mehrklassen. */
  protected readonly eckdaten = computed(() => {
    const k = this.klasse();
    if (!k) return [];
    const c = (k.components?.['Class'] ?? {}) as Record<string, unknown>;
    const p = (k.components?.['Proficiencies'] ?? {}) as {
      proficient?: string[];
      saves?: string[];
    };
    /* Was zu wählen ist, steht als Wahl am Artikel (REQ-238). Hier stehen
       die Übungswahlen; Unterklasse, Talente und Zusatzmerkmale stehen
       mit ihrer Stufe in der Tabelle, die Ausrüstung im Text darunter. */
    const wahlen = choicesOf(k).filter((x) => x.kind === 'proficiency');
    const zeilen: { label: string; wert: string; lang?: boolean }[] = [];
    const liste = (l?: unknown) => (Array.isArray(l) ? l.map(String).join(', ') : '');
    if (p.saves?.length)
      zeilen.push({ label: 'Saving throws', wert: p.saves.map((s) => s.toUpperCase()).join(', ') });
    if (p.proficient?.length) zeilen.push({ label: 'Proficiencies', wert: liste(p.proficient) });
    for (const x of wahlen.filter((x) => x.when !== 'multiclass')) {
      zeilen.push({ label: x.id === 'skills' ? 'Skills' : 'Choose', wert: choiceText(x) });
    }
    if (c['multiclassRequirement']) {
      const mit = [
        liste(c['multiclassProficient']),
        ...wahlen.filter((x) => x.when === 'multiclass').map(choiceText),
      ].filter(Boolean).join('; ');
      zeilen.push({
        label: 'Multiclassing',
        wert: `${String(c['multiclassRequirement'])}${mit ? ` · gains ${mit}` : ''}`,
      });
    }
    if (typeof c['startingEquipment'] === 'string' && c['startingEquipment']) {
      zeilen.push({ label: 'Starting equipment', wert: c['startingEquipment'], lang: true });
    }
    return zeilen;
  });

  protected readonly unterTitel = computed(() => {
    const t = this.klasse()?.components?.['Class']?.['subclassTitle'];
    return typeof t === 'string' && t ? t : 'Subclasses';
  });
}
