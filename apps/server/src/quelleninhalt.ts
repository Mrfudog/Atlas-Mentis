/**
 * **Der Inhalt einer Quelle** (T-189): was eine Ebene in eine Kampagne
 * bringt, als Baum — Art → Artikel, bei einer Gruppe ihre Ebenen —, und je
 * Eintrag, ob er in der laufenden Kampagne im Spiel ist.
 *
 * `GET /api/layers/:layer/contents` rechnet nur; geändert wird über die
 * Routen, die es schon gibt (`activates`, `activates.props.types`,
 * `enables`, T-187) — der Baum ist eine zweite Ansicht derselben Wahl,
 * keine zweite Stelle dafür.
 *
 * **Gesiebt wird wie in der Leseansicht** (`vorschauEbenen`, T-167): wer
 * eine Ebene vor dem Aufschalten lesen darf, sieht auch ihre Artikel, die
 * übrigen nur, was im Spiel ist. Sichtbarkeit und Wissen gelten danach wie
 * überall — was hier ankommt, darf angezeigt werden.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ACTIVATES_RELATION,
  areaOf,
  compareLayers,
  enabledArticles,
  entityName,
  filterOf,
  groupMembers,
  isBookPart,
  isCompareEdge,
  isGroupLayer,
  isInstance,
  LAYER_RELATION,
  offLayers,
  passesFilter,
  playStack,
  primaryInterface,
  resolvedEntries,
  type Entity,
  type LayerFilter,
  type Registry,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { vorschauEbenen } from './lesen.js';
import { rechtAn } from './verwaltung.js';

export interface InhaltDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<{ alle: Entity[]; map: Map<string, Entity> }>;
  /** Wie in der Leseansicht: mit `vorschau` auch, was nur fehlt, weil diese Ebenen nicht aufgeschaltet sind. */
  sieve: (request: FastifyRequest, entities: Entity[], bestand: Map<string, Entity>, vorschau?: ReadonlySet<string>) => Promise<Entity[]>;
  kampagne: (map: Map<string, Entity>, registry: Registry) => Entity | null;
}

/** Ein Artikel im Baum: wie er in der Kampagne steht. */
export interface InhaltArtikel {
  id: string;
  name: string;
  /** `layer`: kommt mit der Ebene; `enabled`: einzeln freigegeben (T-187); `off`: nicht im Spiel. */
  state: 'layer' | 'enabled' | 'off';
  /** Im Stapel, aber eine Fassung gilt an seiner Stelle. */
  replaced?: true;
  /** Freigegeben, aber eine spezifischere Ebene nimmt ihn heraus. */
  blocked?: true;
}

export interface InhaltArt {
  type: string;
  label: string;
  area: string;
  /** Bringt die Ebene diese Art in der Kampagne (im Spiel und von ihrer Auswahl gedeckt)? */
  on: boolean;
  articles: InhaltArtikel[];
}

/** Ein Weg vom Artikel zu den Ebenen, in denen er liegt (ohne Herausnahmen). */
const bringtEbene = (e: Entity, layer: string): boolean =>
  (e.relations ?? []).some(
    (r) => r.type === LAYER_RELATION && r.to === layer && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes',
  );
const nimmtHeraus = (e: Entity, layer: string): boolean =>
  (e.relations ?? []).some(
    (r) => r.type === LAYER_RELATION && r.to === layer && (r.props as { mode?: unknown } | undefined)?.mode === 'removes',
  );

export function registerQuelleninhalt(app: FastifyInstance, deps: InhaltDeps): void {
  const { repo, viewerOf, roh, sieve, kampagne: kampagneIn } = deps;

  /* Welche Artikel in welcher Ebene liegen, einmal je Bestand: der Baum
     fragt je Ebene, und zwanzigtausend Artikel je Frage durchzusehen hiesse,
     jede Seite einer Quelle eine Sekunde warten zu lassen. */
  let index: { alle: Entity[]; je: Map<string, Entity[]>; weg: Map<string, number> } | null = null;
  function inhaltIndex(alle: Entity[]): { je: Map<string, Entity[]>; weg: Map<string, number> } {
    if (index?.alle === alle) return index;
    const je = new Map<string, Entity[]>();
    const weg = new Map<string, number>();
    for (const e of alle) {
      /* Teile eines Buchs stehen im Buch (Leseansicht), Instanzen an ihrer Vorlage. */
      if (isBookPart(e) || isInstance(e)) continue;
      for (const r of e.relations ?? []) {
        if (r.type !== LAYER_RELATION || !r.to) continue;
        if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') weg.set(r.to, (weg.get(r.to) ?? 0) + 1);
        else (je.get(r.to) ?? je.set(r.to, []).get(r.to)!).push(e);
      }
    }
    index = { alle, je, weg };
    return index;
  }

  app.get<{ Params: { layer: string } }>('/api/layers/:layer/contents', async (request, reply) => {
    const user = await viewerOf(request);
    const stand = await roh();
    const l = stand.map.get(request.params.layer);
    if (!l || primaryInterface(l) !== 'Layer') return reply.code(404).send({ error: 'Nicht gefunden' });
    const vorschau = vorschauEbenen(user, l, stand.map);
    if (!(await sieve(request, [l], stand.map, vorschau.size ? vorschau : undefined)).length) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }
    const registry = await repo.getRegistry();
    const kampagne = kampagneIn(stand.map, registry);
    const recht = kampagne ? rechtAn(user, kampagne.id) : null;

    /* Wie die Ebene in der Kampagne steht (T-187): eigene Kante, Gruppe, Regel, Vergleich, aus. */
    const eintraege = kampagne ? resolvedEntries(stand.map, kampagne) : [];
    const eintrag = eintraege.find((x) => x.layer.id === l.id);
    const eigene = (kampagne?.relations ?? []).find(
      (r) => r.type === ACTIVATES_RELATION && r.to === l.id && !isCompareEdge(r) && (r.props as { mode?: unknown } | undefined)?.mode !== 'off',
    );
    const vergleich = kampagne ? compareLayers(stand.map, kampagne).some((x) => x.id === l.id) : false;
    const filter: LayerFilter | null = eintrag?.filter ?? null;
    const lage = {
      inPlay: !!eintrag,
      own: !!eigene,
      ...(eigene && filterOf(eigene) ? { only: filterOf(eigene)! } : {}),
      ...(eintrag && filter ? { brings: filter } : {}),
      ...(eintrag?.ruleFrom ? { ruleFrom: { id: eintrag.ruleFrom, name: entityName(stand.map.get(eintrag.ruleFrom)) } } : {}),
      ...(vergleich ? { compare: true } : {}),
      ...(kampagne && offLayers(kampagne).has(l.id) ? { off: true } : {}),
    };

    /* Eine Gruppe: ihre Ebenen, je mit Zahl und Stand — ihre Artikel stehen an jeder einzeln. */
    if (isGroupLayer(l)) {
      const { je } = inhaltIndex(stand.alle);
      const mitglieder = await sieve(
        request,
        (groupMembers(stand.map).get(l.id) ?? []).map((id) => stand.map.get(id)!).filter(Boolean),
        stand.map,
        vorschau.size ? vorschau : undefined,
      );
      const imSpiel = new Set(eintraege.map((x) => x.layer.id));
      return {
        layer: { id: l.id, name: entityName(l), group: true },
        campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
        may: recht,
        state: lage,
        layers: mitglieder
          .map((m) => ({
            id: m.id,
            name: entityName(m),
            ...(isGroupLayer(m) ? { group: true } : {}),
            articles: je.get(m.id)?.length ?? 0,
            inPlay: imSpiel.has(m.id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
      };
    }

    const { je, weg } = inhaltIndex(stand.alle);
    const roh_ = (je.get(l.id) ?? []).filter((e) => bringtEbene(e, l.id) && !nimmtHeraus(e, l.id));
    const sichtbar = await sieve(request, roh_, stand.map, vorschau.size ? vorschau : undefined);
    const stapel = kampagne ? playStack(stand.map, kampagne, registry) : null;
    const freigegeben = enabledArticles(kampagne);
    const nachArt = new Map<string, Entity[]>();
    for (const e of sichtbar) {
      const t = primaryInterface(e);
      (nachArt.get(t) ?? nachArt.set(t, []).get(t)!).push(e);
    }
    const arten: InhaltArt[] = [...nachArt]
      .map(([type, liste]) => ({
        type,
        label: registry.interfaces[type]?.label ?? type,
        area: areaOf(registry, type),
        on: !!eintrag && passesFilter(filter, liste[0]!, registry),
        articles: liste
          .map((e): InhaltArtikel => {
            const original = stand.map.get(e.id) ?? e;
            const imStapel = stapel?.inStack(original) ?? false;
            /* Kommt er mit einer Ebene, zählt die Freigabe nicht (`enabled`). */
            const freiGewollt = freigegeben.has(e.id);
            const state: InhaltArtikel['state'] = imStapel
              ? stapel!.enabled(original)
                ? 'enabled'
                : 'layer'
              : freiGewollt
                ? 'enabled'
                : 'off';
            return {
              id: e.id,
              name: entityName(e),
              state,
              ...(imStapel && stapel && !stapel.inPlay(original) ? { replaced: true as const } : {}),
              ...(freiGewollt && !imStapel ? { blocked: true as const } : {}),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en'));
    return {
      layer: { id: l.id, name: entityName(l) },
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      may: recht,
      state: lage,
      types: arten,
      /* Was diese Ebene aus anderen herausnimmt — gezählt, nicht aufgezählt. */
      ...(weg.get(l.id) ? { removes: weg.get(l.id) } : {}),
      /* Liest jemand ohne Vorschau, sieht er nur, was im Spiel ist — und die Seite sagt es. */
      ...(vorschau.size ? {} : { onlyInPlay: true }),
    };
  });
}
