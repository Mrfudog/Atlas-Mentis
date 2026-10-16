import { EnvironmentInjector, Injectable, computed, effect, inject, untracked, type Signal } from '@angular/core';
import { handState, inHand, primaryInterface, sheetHeader, linkedTypes } from '@nw/model';
import type { Entity, HandState, HeldItem, KnownSpell, Relation, SheetHeader } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';

/** Gegenstandsarten, die als Zauberfokus in der Hand gelten (PHB „Spellcasting Focus"). */
const FOKUS = new Set(['spellcasting focus', 'staff', 'rod', 'wand']);

/** Was die Spielerseite über eine Figur weiss — einmal gerechnet, von Kopf, Zug und Zaubern gelesen. */
export interface FigurLage {
  figur: Signal<Entity | undefined>;
  statblock: Signal<Entity | undefined>;
  /** Hängt kein Statblock an (und ist die Rückfrage beantwortet)? */
  ohneStatblock: Signal<boolean>;
  kopf: Signal<SheetHeader | null>;
  gehalten: Signal<HeldItem[]>;
  haende: Signal<HandState>;
  /** Die `casts`-Kanten der Figur und ihres Statblocks, mit dem Zauber, wo er da ist. */
  zauber: Signal<{ kante: Relation; spell: Entity | undefined }[]>;
  /** Gold bei der Figur und bei der Gruppe, in Kupfer (T-245 baut weiter). */
  kupfer: Signal<{ beiDir: number | null; gruppe: number | null }>;
}

/**
 * **Die Daten der Spielerseite** (T-247): Statblock, gehaltene Stücke,
 * Zauber und Gold einer Figur, aus dem Bestand gelesen — nichts davon hält
 * die Oberfläche selbst (W7). Je Figur einmal, von allen Elementen der
 * Seite geteilt; der Bestand hält es über den Live-Kanal aktuell.
 */
@Injectable({ providedIn: 'root' })
export class FigurDaten {
  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);
  /* Die Wirkungen leben so lange wie die App: eine Figur, einmal offen,
     bleibt aktuell, und je Figur gibt es sie nur einmal. */
  private readonly injector = inject(EnvironmentInjector);
  private readonly lagen = new Map<string, FigurLage>();

  fuer(id: string): FigurLage {
    const da = this.lagen.get(id);
    if (da) return da;
    const lage = this.baue(id);
    this.lagen.set(id, lage);
    return lage;
  }

  private baue(id: string): FigurLage {
    const b = this.bestand;
    const figur = computed(() => b.voll().get(id));

    const statblockId = computed<string | null | undefined>(() => {
      const e = figur();
      const r = b.registry();
      if (!e || !r) return undefined;
      const l = linkedTypes(r, primaryInterface(e)).find((x) => x.type === 'Statblock');
      if (!l) return null;
      if (l.direction === 'out') return (e.relations ?? []).find((k) => k.type === l.relation)?.to ?? null;
      const rueck = b.rueckbezuege().get(id);
      if (!rueck) return undefined;
      return rueck.find((x) => x.relation.type === l.relation && x.relation.to === id)?.from.id ?? null;
    });
    const statblock = computed(() => {
      const s = statblockId();
      return s ? b.voll().get(s) : undefined;
    });

    /* Das Inventar der Figur (`carries`) und was darin in der Hand liegt. */
    const inventarId = computed(() => (figur()?.relations ?? []).find((k) => k.type === 'carries')?.to);
    const inventar = computed(() => {
      const i = inventarId();
      return i ? b.voll().get(i) : undefined;
    });
    const handKanten = computed(() =>
      (inventar()?.relations ?? []).filter((k) => k.type === 'holds' && inHand({ slot: k.props?.['slot'] as string, tier: k.props?.['tier'] as string })),
    );

    /* Die Gruppe (`memberOfParty`) und ihr Inventar — nur für das Gold. */
    const gruppeId = computed(() => (figur()?.relations ?? []).find((k) => k.type === 'memberOfParty')?.to);
    const gruppenInventarId = computed(() => {
      const g = gruppeId();
      return g ? (b.voll().get(g)?.relations ?? []).find((k) => k.type === 'carries')?.to : undefined;
    });

    const castsKanten = computed(() => [
      ...(figur()?.relations ?? []).filter((k) => k.type === 'casts'),
      ...(statblock()?.relations ?? []).filter((k) => k.type === 'casts'),
    ]);

    const klassenIds = computed(() => (figur()?.relations ?? []).filter((k) => k.type === 'hasClass').map((k) => k.to));

    /* Nachladen, was fehlt: Rückfrage (Statblock), Inventar, Gegenstände,
       ihre Eigenschaften, Zauber, Klassen, die Gruppe. */
    effect(() => {
      const e = figur();
      if (!e) return;
      untracked(() => void b.oeffnen(id, false, true));
    }, { injector: this.injector });
    effect(() => {
      const ids = [
        statblockId(),
        inventarId(),
        gruppeId(),
        gruppenInventarId(),
        ...handKanten().map((k) => k.to),
        ...castsKanten().map((k) => k.to),
        ...klassenIds(),
      ].filter((x): x is string => !!x);
      if (ids.length) untracked(() => void b.holen(ids));
    }, { injector: this.injector });
    effect(() => {
      const eig = handKanten()
        .map((k) => b.voll().get(k.to))
        .flatMap((it) => (it?.relations ?? []).filter((k) => k.type === 'hasProperty').map((k) => k.to));
      if (eig.length) untracked(() => void b.holen(eig));
    }, { injector: this.injector });

    const geuebt = computed(() => {
      const p = statblock()?.components?.['Proficiencies'] as { proficient?: unknown } | undefined;
      return new Set((Array.isArray(p?.proficient) ? p.proficient : []).map((x) => String(x).toLowerCase()));
    });

    const gehalten = computed<HeldItem[]>(() => {
      const name = b.name();
      return handKanten().map((k) => {
        const it = b.voll().get(k.to);
        const item = (it?.components?.['Item'] ?? {}) as Record<string, unknown>;
        const weapon = (it?.components?.['Weapon'] ?? {}) as Record<string, unknown>;
        const armor = (it?.components?.['Armor'] ?? {}) as Record<string, unknown>;
        const art = String(item['itemType'] ?? '').toLowerCase();
        const shield = armor['armorType'] === 'shield' || art === 'shield';
        const props = (it?.relations ?? []).filter((r) => r.type === 'hasProperty').map((r) => (name(r.to) ?? '').toLowerCase()).filter(Boolean);
        /* Der Griff mit beiden Händen (vielseitig) kommt mit T-244; bis
           dahin belegt nur eine zweihändige Waffe beide (`handState`). */
        const slot: HeldItem['slot'] = k.props?.['slot'] === 'offHand' ? 'offHand' : 'mainHand';
        const p = geuebt();
        const proficient = shield
          ? p.has('shield') || p.has('shields')
          : !it?.components?.['Weapon'] || p.has(String(weapon['category'] ?? '').toLowerCase()) || p.has((it?.name ?? '').toLowerCase());
        return {
          id: k.to,
          name: it?.name ?? name(k.to) ?? k.to,
          slot,
          properties: props,
          shield,
          focus: FOKUS.has(art),
          proficient,
          ...(typeof weapon['damage'] === 'string' ? { damage: weapon['damage'] as string } : {}),
          ...(typeof weapon['damage2'] === 'string' ? { damage2: weapon['damage2'] as string } : {}),
        };
      });
    });
    const haende = computed(() => handState(gehalten()));

    const zauber = computed(() => castsKanten().map((kante) => ({ kante, spell: b.voll().get(kante.to) })));

    const kopf = computed<SheetHeader | null>(() => {
      const e = figur();
      const r = b.registry();
      if (!e || !r) return null;
      const name = b.name();
      const spells: KnownSpell[] = zauber().map(({ kante, spell }) => {
        const lvl = Number((spell?.components?.['Spell'] as { level?: unknown } | undefined)?.level);
        return { id: kante.to, level: Number.isFinite(lvl) ? lvl : null, mode: String(kante.props?.['mode'] ?? '') };
      });
      return sheetHeader(r, e, statblock(), b.voll(), { nameOf: (x) => name(x), spells });
    });

    const kupfer = computed(() => {
      const c = (i: string | undefined) => {
        if (!i) return null;
        const n = Number((b.voll().get(i)?.components?.['Inventory'] as { copper?: unknown } | undefined)?.copper);
        return Number.isFinite(n) ? n : null;
      };
      return { beiDir: c(inventarId()), gruppe: c(gruppenInventarId()) };
    });

    return {
      figur,
      statblock,
      ohneStatblock: computed(() => statblockId() === null),
      kopf,
      gehalten,
      haende,
      zauber,
      kupfer,
    };
  }

  /**
   * **`Vitals` schreiben** (REQ-051): die Änderung wird aus dem gerade
   * gelesenen Stand gerechnet (`aendern`), und kam jemand dazwischen
   * (409), noch einmal aus dem neuen — Schaden zweimal von verschiedenen
   * Geräten zählt zweimal und überschreibt nicht.
   */
  async vitals(id: string, aendern: (v: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
    for (let versuch = 0; versuch < 2; versuch++) {
      const e = this.bestand.voll().get(id);
      if (!e) return;
      const alt = (e.components?.['Vitals'] ?? {}) as Record<string, unknown>;
      const neu = { ...alt, ...aendern(alt) };
      for (const [k, w] of Object.entries(neu)) if (w === undefined || w === null) delete neu[k];
      const { refs: _r, ...basis } = e as Entity & { refs?: unknown };
      try {
        await this.api.putEntity({ ...(basis as Entity), components: { ...(basis.components ?? {}), Vitals: neu } });
        await this.bestand.oeffnen(id, true, false);
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && versuch === 0) {
          await this.bestand.oeffnen(id, true, false);
          continue;
        }
        throw error;
      }
    }
  }
}

/** Was schiefging, als Satz. */
export function fehlerText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
