import { EnvironmentInjector, Injectable, computed, effect, inject, untracked, type Signal } from '@angular/core';
import { castRelations, characterStats, entityName, handState, hasProficiency, heldPlaceOf, itemFeaturesOf, primaryInterface, proficienciesOf, sheetHeader, linkedTypes, spellcastingOf, turnActions, turnRows, wieldItemOf } from '@nw/model';
import type { CharacterStats, Entity, HandState, HeldItem, KnownSpell, ProficiencyList, Relation, SheetHeader, TurnRow, WieldItem } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';

/** Was die Spielerseite über eine Figur weiss — einmal gerechnet, von Kopf, Zug und Zaubern gelesen. */
export interface FigurLage {
  figur: Signal<Entity | undefined>;
  statblock: Signal<Entity | undefined>;
  /** Hängt kein Statblock an (und ist die Rückfrage beantwortet)? */
  ohneStatblock: Signal<boolean>;
  kopf: Signal<SheetHeader | null>;
  gehalten: Signal<HeldItem[]>;
  haende: Signal<HandState>;
  /** Jedes Stück im Inventar der Figur, wie das Ausrüsten es braucht — je `holds`-Kante (T-244). */
  ausruestbar: Signal<Map<string, WieldItem>>;
  /** Hat die Figur den hinterhältigen Angriff (eine Aktion des Statblocks so genannt)? */
  hinterhaeltig: Signal<boolean>;
  /** Die Zauber der Figur als Kanten `casts` (eigene und gerechnete, T-309), mit dem Zauber, wo er da ist. */
  zauber: Signal<{ kante: Relation; spell: Entity | undefined }[]>;
  /** Gold bei der Figur und bei der Gruppe, in Kupfer (T-245 baut weiter). */
  kupfer: Signal<{ beiDir: number | null; gruppe: number | null }>;
  /** „Your turn": jede Aktion mit ihrer Sperre (T-247). */
  zug: Signal<TurnRow[]>;
  /** Jede Übung mit Herkunft (T-239, `proficienciesOf`). */
  uebungen: Signal<ProficiencyList>;
  /**
   * Die gerechneten Werte mit ihren Teilen (T-272, `characterStats`) und der
   * gelesene Statblock darin — Endwerte statt der gespeicherten Grundwerte.
   */
  werte: Signal<CharacterStats | null>;
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
    const holdsKanten = computed(() => (inventar()?.relations ?? []).filter((k) => k.type === 'holds'));
    const handKanten = computed(() => holdsKanten().filter((k) => heldPlaceOf(k.props) !== null));

    /* Die Gruppe (`memberOfParty`) und ihr Inventar — nur für das Gold. */
    const gruppeId = computed(() => (figur()?.relations ?? []).find((k) => k.type === 'memberOfParty')?.to);
    const gruppenInventarId = computed(() => {
      const g = gruppeId();
      return g ? (b.voll().get(g)?.relations ?? []).find((k) => k.type === 'carries')?.to : undefined;
    });

    /* Die Zauber aus allen Quellen (T-309): Klasse, Herkunft, Talente,
       Gegenstände und Wahlen, dazu was von Hand an Figur und Statblock
       steht — gerechnet, als Kanten `casts` gelesen. */
    const castsKanten = computed(() => {
      const e = figur();
      return e ? castRelations(spellcastingOf(e, statblock(), b.voll())) : [];
    });

    const klassenIds = computed(() => (figur()?.relations ?? []).filter((k) => k.type === 'hasClass').map((k) => k.to));

    /* Die Aktionen des Statblocks (`composedOf`) und die Arten, die sie
       und die Zauber nennen (`Action.actionType`, `Spell.castingAction`). */
    const teilIds = computed(() => (statblock()?.relations ?? []).filter((k) => k.type === 'composedOf').map((k) => k.to));
    const artIds = computed(() => {
      const ids: string[] = [];
      for (const id of [...teilIds(), ...castsKanten().map((k) => k.to)]) {
        const e = b.voll().get(id);
        const a = (e?.components?.['Action'] as { actionType?: unknown } | undefined)?.actionType;
        const z = (e?.components?.['Spell'] as { castingAction?: unknown } | undefined)?.castingAction;
        for (const x of [a, z]) if (typeof x === 'string') ids.push(x);
      }
      return ids;
    });
    /* Was man mit einer Aktion benutzt: Tränke im Inventar, nicht verstaut zu Hause. */
    const verbrauchKanten = computed(() =>
      (inventar()?.relations ?? []).filter((k) => k.type === 'holds' && k.props?.['tier'] !== 'stored' && k.props?.['tier'] !== 'ground'),
    );

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
        ...teilIds(),
        ...artIds(),
        ...verbrauchKanten().map((k) => k.to),
      ].filter((x): x is string => !!x);
      if (ids.length) untracked(() => void b.holen(ids));
    }, { injector: this.injector });
    /* Die Eigenschaften jedes Stücks im Inventar (T-244): auch was noch im
       Raster liegt, muss wissen, ob es zweihändig ist. */
    effect(() => {
      const eig = holdsKanten()
        .map((k) => b.voll().get(k.to))
        .flatMap((it) => (it?.relations ?? []).filter((k) => k.type === 'hasProperty').map((k) => k.to));
      if (eig.length) untracked(() => void b.holen(eig));
    }, { injector: this.injector });

    /* Geübt ist, was Statblock, Klasse, Hintergrund, Talente und Wahlen
       zusammen bringen (T-239); was die Rechnung nennt und noch fehlt,
       wird geholt, und sie rechnet neu. */
    const uebungen = computed<ProficiencyList>(() => {
      const e = figur();
      return e ? proficienciesOf(e, statblock(), b.voll()) : { entries: [], missing: [] };
    });
    const werte = computed<CharacterStats | null>(() => {
      const e = figur();
      /* Erst rechnen, wenn feststeht, ob ein Statblock anhängt. */
      if (!e || statblockId() === undefined) return null;
      return characterStats(e, statblock(), b.voll());
    });
    effect(() => {
      const fehlt = uebungen().missing;
      if (fehlt.length) untracked(() => void b.holen(fehlt));
    }, { injector: this.injector });

    /* Jedes Stück, wie das Ausrüsten es braucht (T-244, `wieldItemOf`): die
       Wirkungen der Eigenschaften aus `hasProperty`, die Übung aus der Rechnung T-239. */
    const ausruestbar = computed(() => {
      const name = b.name();
      const p = uebungen();
      const raus = new Map<string, WieldItem>();
      for (const k of holdsKanten()) {
        const it = b.voll().get(k.to);
        /* Was die Eigenschaften bewirken, steht in ihren Daten (T-324, E-163). */
        const merkmale = itemFeaturesOf(it, (id) => b.voll().get(id));
        raus.set(k.id, wieldItemOf(it, {
          id: k.id,
          article: k.to,
          name: it ? entityName(it) : name(k.to) ?? k.to,
          mechanics: merkmale.mechanics,
          ...(merkmale.versatileDamage ? { versatileDamage: merkmale.versatileDamage } : {}),
          proficient: (w) => !!w && hasProficiency(p, w),
        }));
      }
      return raus;
    });
    /* Was in der Hand liegt — mit dem Griff von der Kante (`holds.props.grip`). */
    const gehalten = computed<HeldItem[]>(() =>
      handKanten().flatMap((k) => {
        const w = ausruestbar().get(k.id);
        const slot = heldPlaceOf(k.props);
        if (!w || !slot) return [];
        const { worn: _w, ...rest } = w;
        return [{ ...rest, slot }];
      }),
    );
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
      /* Der Kopf liest die Endwerte (T-272), nicht die Grundwerte der Karte. */
      return sheetHeader(r, e, werte()?.statblock ?? statblock(), b.voll(), { nameOf: (x) => name(x), spells });
    });

    const kupfer = computed(() => {
      const c = (i: string | undefined) => {
        if (!i) return null;
        const n = Number((b.voll().get(i)?.components?.['Inventory'] as { copper?: unknown } | undefined)?.copper);
        return Number.isFinite(n) ? n : null;
      };
      return { beiDir: c(inventarId()), gruppe: c(gruppenInventarId()) };
    });

    const zug = computed<TurnRow[]>(() => {
      const name = b.name();
      const nameVon = (id: unknown) => {
        if (typeof id !== 'string') return null;
        const e = b.voll().get(id);
        return e ? entityName(e) : name(id) ?? null;
      };
      const actions = teilIds().flatMap((id) => {
        const e = b.voll().get(id);
        const a = e?.components?.['Action'] as { actionType?: unknown } | undefined;
        return e && a ? [{ id, name: entityName(e), actionTypeName: nameVon(a.actionType) }] : [];
      });
      const spells = zauber().flatMap(({ kante, spell }) => {
        const sp = spell?.components?.['Spell'] as Record<string, unknown> | undefined;
        if (!spell || !sp) return [];
        const lvl = Number(sp['level']);
        return [{
          id: kante.to,
          name: entityName(spell),
          level: Number.isFinite(lvl) ? lvl : null,
          actionTypeName: sp['castingUnit'] ? null : nameVon(sp['castingAction']) ?? 'Action',
          components: Array.isArray(sp['components']) ? (sp['components'] as string[]) : [],
          ...(typeof sp['castingCondition'] === 'string' && sp['castingCondition'] ? { trigger: sp['castingCondition'] as string } : {}),
        }];
      });
      const consumables = verbrauchKanten().flatMap((k) => {
        const it = b.voll().get(k.to);
        const art = String((it?.components?.['Item'] as { itemType?: unknown } | undefined)?.itemType ?? '').toLowerCase();
        return it && art === 'potion' ? [{ id: k.to, name: entityName(it) }] : [];
      });
      return turnRows(turnActions({ hands: haende(), actions, spells, consumables }), haende());
    });

    return {
      zug,
      figur,
      statblock,
      ohneStatblock: computed(() => statblockId() === null),
      ausruestbar,
      hinterhaeltig: computed(() => teilIds().some((id) => /sneak attack/i.test(b.name()(id) ?? ''))),
      kopf,
      gehalten,
      haende,
      zauber,
      kupfer,
      uebungen,
      werte,
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
