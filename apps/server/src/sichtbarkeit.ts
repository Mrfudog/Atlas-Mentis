/**
 * **Die Sichtbarkeit je Gruppe an der Kampagne** (T-252, E-098): die
 * Übersicht im Reiter „Visibility" der Kampagnenseite und das Setzen
 * einer Regel je Gruppe.
 *
 * Die Übersicht rechnet am Server, mit derselben Rechnung wie jede Route
 * (`articleVisible`): je Spalte — Public, Table, je Spielende/r, GM — ein
 * Betrachter, wie er am Server entsteht, und je Gruppe die Zahl dessen,
 * was er sähe. Gruppiert wird mit den Transformationen (T-253) über die
 * Dimensionen der Sichtbarkeit (`visibilityDimensions`) — dieselben, gegen
 * die eine Regel beim Lesen prüft. Gezeigt wird nur, was die Leitung
 * ohnehin sieht.
 *
 * Die Regeln stehen an der Kampagne (`VisibilityRules.visibilityRules`),
 * nicht in den Artikeln: eine Regel gilt auch für den Artikel von morgen,
 * und eine geteilte Ebene bleibt geteilt (E-098).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { inKampagne } from './figurenzuteilung.js';
import {
  AUDIENCE_ORDER,
  applyTransform,
  applyVisibilityChange,
  articleVisible,
  filterArticleRows,
  GROUP_RELATION,
  layersOf,
  playerSetting,
  playStack,
  preferencesOf,
  versionGroups,
  effectiveAudience,
  entityName,
  isBookPart,
  isInstance,
  isTableRole,
  primaryInterface,
  stepsFromString,
  validateEntity,
  visibilityDimensions,
  visibilityRulesOf,
  withArticleRule,
  articleRuleKey,
  VISIBILITY_COMPONENT,
  VISIBILITY_RULES_COMPONENT,
  type Audience,
  type AudienceSource,
  type CampaignVisibility,
  type Entity,
  type Registry,
  type TransformNode,
  type TransformStep,
  type ArticleVisibilityQuery,
  type ArticleVisibilityRow,
  type VisibilityChange,
  type VisibilityFields,
  type Viewer,
  type VisibilityRule,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { aufFrischemStand } from './kampagnenrevision.js';
import { rechtAn } from './verwaltung.js';

export interface SichtbarkeitDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  /** Der Bestand, wie jede Route ihn liest. */
  roh: () => Promise<{ map: Map<string, Entity> }>;
  /** Steht der Artikel im Stapel dieser Kampagne? (E2) */
  imSpiel: (map: Map<string, Entity>, kampagne: Entity, registry: Registry) => (e: Entity) => boolean;
  /** Der Betrachter eines Kontos, wie das Sieb ihn baut (Rollen, Figuren, Eigenes). */
  augeVon: (user: User, map: Map<string, Entity>, registry: Registry) => Promise<Viewer>;
  /** Einen Artikel schreiben, mit allen Regeln von `PUT /api/entities/:id`. */
  schreiben: (request: FastifyRequest, entity: Entity) => Promise<{ code: number; body: unknown } | { konflikt: number | null }>;
  /** Was dieses Konto schreibt (`mayWrite`), einmal je Anfrage gerechnet (T-387). */
  schreibbar: (user: User) => Promise<(id: string) => boolean>;
  /** Der Herausgeber einer Ebene (`publisherOf`, T-094/T-109). */
  verlag: (map: Map<string, Entity>) => (layer: string) => string;
}

/** Eine Spalte der Übersicht. */
interface Spalte {
  key: string;
  label: string;
  kind: 'public' | 'table' | 'player' | 'gm';
  /** Bei Spielenden: ihre Figuren — wer eine Zelle umschaltet, schreibt sie in `show`/`hide`. */
  bearers?: string[];
}

interface KnotenAus {
  key: string;
  dim: string;
  value: string;
  label: string;
  depth: number;
  count: number;
  /** Je Spalte: wie viele Artikel der Gruppe dort sichtbar sind. */
  cells: Record<string, number>;
  /** Je Stufe: wie viele Artikel der Gruppe sie haben. */
  levels: Partial<Record<Audience, number>>;
  /** Woher die Stufe kommt, gezählt. */
  sources: Partial<Record<AudienceSource, number>>;
  /** Die Regel genau an dieser Gruppe. */
  rule?: VisibilityRule;
  /** Artikel mit eigenem Feld (Stufe, Freigabe, Verbot), die erste Handvoll mit Namen. */
  exceptions: { count: number; items: { id: string; name: string; own: string }[] };
  children: KnotenAus[];
}

const AUSNAHMEN_ZEIGEN = 50;
const STUFEN: readonly Audience[] = ['public', 'campaign', 'players', 'gm'];

function nein(reply: FastifyReply, code: number, error: string) {
  return reply.code(code).send({ error });
}

/** Was ein Artikel selbst sagt — leer, wenn er der Gruppe folgt. */
function eigenesFeld(e: Entity): string {
  const v = (e.components?.[VISIBILITY_COMPONENT] ?? {}) as { audience?: unknown; revealedTo?: unknown; hiddenFrom?: unknown };
  const teile: string[] = [];
  if (typeof v.audience === 'string') teile.push(v.audience);
  if (Array.isArray(v.revealedTo) && v.revealedTo.length) teile.push(`revealed to ${v.revealedTo.length}`);
  if (Array.isArray(v.hiddenFrom) && v.hiddenFrom.length) teile.push(`hidden from ${v.hiddenFrom.length}`);
  return teile.join(' · ');
}

export function registerSichtbarkeit(app: FastifyInstance, deps: SichtbarkeitDeps): void {
  const { repo } = deps;

  /** Leitung und Mitleitung sehen die Übersicht, ändern tut die Leitung (wie bei den Mitgliedern). */
  async function zugang(request: FastifyRequest<{ Params: { c: string } }>, reply: FastifyReply, aendern: boolean) {
    const user = await deps.viewerOf(request);
    const recht = rechtAn(user, request.params.c);
    if (!user || !recht) {
      await nein(reply, 403, 'Die Sichtbarkeit der Kampagne sieht ihre Leitung.');
      return null;
    }
    if (aendern && recht !== 'manage') {
      await nein(reply, 403, 'Die Sichtbarkeit ändert die Leitung; ein Mitleiter sieht sie nur.');
      return null;
    }
    const { map } = await deps.roh();
    const kampagne = map.get(request.params.c);
    if (!kampagne || primaryInterface(kampagne) !== 'Campaign') {
      await nein(reply, 404, 'Keine solche Kampagne.');
      return null;
    }
    return { user, recht, map, kampagne };
  }

  /**
   * **Was beide Übersichten brauchen**: die Spalten samt ihren Betrachtern,
   * wie das Sieb sie baut, und die Zeilen — was diese Kampagne spielt und
   * die Leitung ohnehin sieht, ohne Instanzen und Buchteile, die in keiner
   * Liste stehen. Je Gruppe (T-252) und je Artikel (T-387) dieselbe
   * Rechnung, sonst zählte die eine Liste anders als die andere.
   */
  async function grundlage(z: { user: User; map: Map<string, Entity>; kampagne: Entity }) {
    const { user, map, kampagne } = z;
    const c = kampagne.id;
    const registry = await repo.getRegistry();
    const dims = visibilityDimensions(map, registry);
    const rules = visibilityRulesOf(kampagne);
    const ctx: CampaignVisibility = { campaign: c, rules, dims };

    /* **Die Spalten**: wer ohne Rolle schaut (Public), wer zuschaut (Table:
       jede Rolle), jede Spielerin mit ihrem Betrachter, wie das Sieb ihn
       baut, und die Leitung. */
    /* Je Spielerin nur ihre Figuren dieser Kampagne (T-412). */
    const konten = (await repo.listUsers()).filter((u) => isTableRole(u.roles?.[c]) && !u.disabledAt).map((u) => inKampagne(u, c));
    const spieler = konten.filter((u) => u.roles[c] === 'player').sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const spalten: Spalte[] = [
      { key: 'public', label: 'Public', kind: 'public' },
      { key: 'table', label: 'Table', kind: 'table' },
      ...spieler.map((u) => ({
        key: 'u:' + u.id,
        label: (u.actorIds ?? []).map((a) => entityName(map.get(a))).filter(Boolean).join(', ') || u.name,
        kind: 'player' as const,
        bearers: [...(u.actorIds ?? [])],
      })),
      { key: 'gm', label: 'GM', kind: 'gm' },
    ];
    const augen = new Map<string, Viewer>([
      ['public', { actors: [], roles: {}, campaignRules: ctx }],
      ['table', { actors: [], roles: { [c]: 'spectator' }, campaignRules: ctx }],
      ['gm', { actors: [], roles: { [c]: 'gm' }, campaignRules: ctx }],
    ]);
    for (const u of spieler) {
      const v = await deps.augeVon(u, map, registry);
      /* Die Regeln **dieser** Kampagne, auch wenn gerade eine andere läuft. */
      augen.set('u:' + u.id, { ...v, campaignRules: ctx });
    }

    const imSpiel = deps.imSpiel(map, kampagne, registry);
    const selbst = user.isAdmin ? undefined : { ...(await deps.augeVon(user, map, registry)), campaignRules: ctx };
    const zeilen = [...map.values()].filter(
      (e) => imSpiel(e) && !isInstance(e) && !isBookPart(e) && articleVisible(map, e, selbst),
    );
    return { registry, dims, rules, ctx, spalten, augen, zeilen };
  }

  app.get<{ Params: { c: string }; Querystring: { steps?: string } }>('/api/campaigns/:c/visibility', async (request, reply) => {
    const z = await zugang(request, reply, false);
    if (!z) return;
    const { map, kampagne } = z;
    const c = kampagne.id;
    const { dims, rules, ctx, spalten, augen, zeilen } = await grundlage(z);
    const steps: TransformStep[] = stepsFromString(request.query.steps);
    const kette = steps.length ? steps : [{ group: 'layer' }, { group: 'type' }];

    const sicht = new Map<string, Set<string>>();
    for (const [k, v] of augen) {
      const s = new Set<string>();
      for (const e of zeilen) if (articleVisible(map, e, v)) s.add(e.id);
      sicht.set(k, s);
    }
    const stufe = new Map(zeilen.map((e) => [e.id, effectiveAudience(map, e, ctx)]));
    const eigen = new Map(zeilen.map((e) => [e.id, eigenesFeld(e)]));
    const regel = new Map(rules.map((r) => [r.id, r]));

    const aus = (n: TransformNode<Entity>): KnotenAus => {
      const cells: Record<string, number> = {};
      for (const s of spalten) {
        const set = sicht.get(s.key)!;
        cells[s.key] = n.rows.reduce((x, e) => x + (set.has(e.id) ? 1 : 0), 0);
      }
      const levels: KnotenAus['levels'] = {};
      const sources: KnotenAus['sources'] = {};
      const ausnahmen: KnotenAus['exceptions']['items'] = [];
      let nAusnahmen = 0;
      for (const e of n.rows) {
        const st = stufe.get(e.id)!;
        levels[st.audience] = (levels[st.audience] ?? 0) + 1;
        sources[st.source] = (sources[st.source] ?? 0) + 1;
        const own = eigen.get(e.id)!;
        if (own) {
          nAusnahmen++;
          if (ausnahmen.length < AUSNAHMEN_ZEIGEN) ausnahmen.push({ id: e.id, name: entityName(e), own });
        }
      }
      const r = regel.get(n.key);
      return {
        key: n.key,
        dim: n.dim,
        value: n.value,
        label: n.label,
        depth: n.depth,
        count: n.count,
        cells,
        levels,
        sources,
        ...(r ? { rule: r } : {}),
        exceptions: { count: nAusnahmen, items: ausnahmen },
        children: n.children.map(aus),
      };
    };
    const baum = applyTransform(zeilen, kette, dims);
    return {
      campaign: { id: c, name: entityName(kampagne) },
      may: z.recht,
      columns: spalten,
      dimensions: dims.filter((d) => d.key !== 'name').map((d) => ({ key: d.key, label: d.label })),
      steps: kette,
      unknown: baum.unknown,
      total: zeilen.length,
      levels: STUFEN,
      rules,
      nodes: baum.nodes.map(aus),
    };
  });

  /**
   * **Eine Regel setzen** — `{ id, audience?, show?, hide? }`: `id` ist der
   * Schlüssel der Gruppe; `audience: null` nimmt die Stufe weg, leere
   * Listen die Freigaben. Sagt eine Regel danach nichts mehr, fällt sie
   * weg („zurück zur Vorgabe der Ebene").
   */
  app.put<{ Params: { c: string }; Body: { id?: unknown; audience?: unknown; show?: unknown; hide?: unknown; revision?: unknown } }>(
    '/api/campaigns/:c/visibility/rules',
    async (request, reply) => {
      const z = await zugang(request, reply, true);
      if (!z) return;
      const b = request.body ?? {};
      if (typeof b.id !== 'string' || !b.id || b.id.length > 500) return nein(reply, 400, 'id: der Schlüssel der Gruppe.');
      const liste = (x: unknown): string[] | undefined =>
        x === undefined ? undefined : Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : [];
      if (b.audience !== undefined && b.audience !== null && !STUFEN.includes(b.audience as Audience)) {
        return nein(reply, 400, `audience: eine von ${STUFEN.join(', ')} oder null.`);
      }
      /* T-449: auf den frischen Stand gerechnet und gegen seine Revision
         geschrieben; kommt eine zweite Regel dazwischen, einmal neu. */
      const regelId = b.id;
      return aufFrischemStand(request, async (gegen) => {
        const kampagne = (await repo.getEntity(z.kampagne.id)) ?? z.kampagne;
        const regeln = visibilityRulesOf(kampagne);
        const alt = regeln.find((r) => r.id === regelId);
        const neu: VisibilityRule = { ...(alt ?? { id: regelId }) };
        if (b.audience === null) delete neu.audience;
        else if (b.audience !== undefined) neu.audience = b.audience as Audience;
        const show = liste(b.show);
        const hide = liste(b.hide);
        if (show !== undefined) {
          if (show.length) neu.show = show;
          else delete neu.show;
        }
        if (hide !== undefined) {
          if (hide.length) neu.hide = hide;
          else delete neu.hide;
        }
        const sagt = !!(neu.audience || neu.show?.length || neu.hide?.length);
        const danach = [...regeln.filter((r) => r.id !== b.id), ...(sagt ? [neu] : [])];
        const geschrieben: Entity = {
          ...kampagne,
          components: { ...(kampagne.components ?? {}), [VISIBILITY_RULES_COMPONENT]: { visibilityRules: danach } },
        };
        const issues = validateEntity(await repo.getRegistry(), geschrieben, {});
        if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
        await repo.putEntity(geschrieben, gegen(kampagne));
        await repo.appendEvent('campaign.visibility', z.kampagne.id, { rule: regelId, ...(sagt ? { set: neu } : { removed: true }), by: z.user.id });
        return { ok: true, rules: danach };
      });
    },
  );

  /**
   * **Der Gruppe folgen** — `{ ids }`: nimmt Stufe, Freigaben und Verbote
   * aus den genannten Artikeln. Geschrieben wird wie jedes Schreiben
   * (`schreiben`): was die Leitung nicht schreibt — ein Artikel im
   * geteilten Regelwerk —, bleibt und wird gezählt.
   */
  app.post<{ Params: { c: string }; Body: { ids?: unknown } }>('/api/campaigns/:c/visibility/follow', async (request, reply) => {
    const z = await zugang(request, reply, true);
    if (!z) return;
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
    if (!ids.length) return nein(reply, 400, 'ids: die Artikel, die der Gruppe folgen sollen.');
    const done: string[] = [];
    const refused: { id: string; error: string }[] = [];
    for (const id of ids) {
      const e = await repo.getEntity(id);
      if (!e) {
        refused.push({ id, error: 'Kein solcher Artikel.' });
        continue;
      }
      const { audience: _a, revealedTo: _r, hiddenFrom: _h, ...rest } = (e.components?.[VISIBILITY_COMPONENT] ?? {}) as Record<string, unknown>;
      const components = { ...(e.components ?? {}) };
      if (Object.keys(rest).length) components[VISIBILITY_COMPONENT] = rest;
      else delete components[VISIBILITY_COMPONENT];
      const r = await deps.schreiben(request, { ...e, components });
      if ('konflikt' in r) refused.push({ id, error: 'Inzwischen geändert.' });
      else if (r.code >= 300) refused.push({ id, error: String((r.body as { error?: unknown })?.error ?? r.code) });
      else done.push(id);
    }
    return { ok: true, done, refused };
  });

  /**
   * **Jeder Artikel mit seiner Ebene** (T-387, REQ-368): die Liste unter
   * Layers und Visibility der Kampagnenseite. Je Zeile die Ebenen mit Namen,
   * Gruppe und Herausgeber, die geltende Stufe und woher sie kommt, was der
   * Artikel selbst sagt, welche Spalten ihn sehen und ob die Leitung ihn
   * schreibt — gerechnet wie die Übersicht je Gruppe (`grundlage`).
   * Gefiltert und sortiert wird hier (`filterArticleRows`), geblättert in
   * Seiten: ein Regelwerk bringt Tausende.
   */
  app.get<{ Params: { c: string }; Querystring: Record<string, string | undefined> }>(
    '/api/campaigns/:c/visibility/articles',
    async (request, reply) => {
      const z = await zugang(request, reply, false);
      if (!z) return;
      const { map, user } = z;
      const { registry, ctx, spalten, augen, zeilen } = await grundlage(z);
      const q = request.query ?? {};
      const stufe = AUDIENCE_ORDER.includes(q['level'] as Audience) ? (q['level'] as Audience) : undefined;
      const quelle = ['article', 'campaign', 'layer', 'default'].includes(q['source'] ?? '') ? (q['source'] as AudienceSource) : undefined;
      const sort = ['name', 'layer', 'type', 'level'].includes(q['sort'] ?? '') ? (q['sort'] as ArticleVisibilityQuery['sort']) : 'name';
      const frage: ArticleVisibilityQuery = {
        layer: q['layer'] || undefined,
        type: q['type'] || undefined,
        level: stufe,
        source: quelle,
        q: q['q']?.slice(0, 200) || undefined,
        sort,
        dir: q['dir'] === 'desc' ? 'desc' : 'asc',
      };
      const offset = Math.max(0, Number.parseInt(q['offset'] ?? '0', 10) || 0);
      const limit = Math.min(200, Math.max(1, Number.parseInt(q['limit'] ?? '50', 10) || 50));

      const verlag = deps.verlag(map);
      const ebene = new Map<string, { id: string; name: string; publisher: string; groups: { id: string; name: string }[] }>();
      const ebeneVon = (id: string) => {
        let l = ebene.get(id);
        if (!l) {
          const e = map.get(id);
          const groups = (e?.relations ?? [])
            .filter((r) => r.type === GROUP_RELATION)
            .map((r) => ({ id: r.to, name: entityName(map.get(r.to)) || r.to }));
          l = { id, name: entityName(e) || id, publisher: verlag(id), groups };
          ebene.set(id, l);
        }
        return l;
      };
      const typName = (t: string) => registry.interfaces[t]?.label ?? t;
      type Zeile = ArticleVisibilityRow & { entity: Entity; rule?: string };
      const alle: Zeile[] = zeilen.map((e) => {
        const st = effectiveAudience(map, e, ctx);
        return {
          id: e.id,
          name: entityName(e) || e.id,
          type: primaryInterface(e),
          typeLabel: typName(primaryInterface(e)),
          layers: layersOf(e).map((l) => ({ id: l, name: ebeneVon(l).name })),
          audience: st.audience,
          source: st.source,
          ...(st.rule ? { rule: st.rule } : {}),
          entity: e,
        };
      });

      /* Die Facetten zählen alles im Spiel, nicht nur den Filter — sonst
         verschwände eine Ebene aus der Auswahl, sobald man eine andere wählt. */
      const nEbene = new Map<string, number>();
      const nArt = new Map<string, number>();
      const nStufe: Partial<Record<Audience, number>> = {};
      for (const r of alle) {
        if (!r.layers.length) nEbene.set('none', (nEbene.get('none') ?? 0) + 1);
        for (const l of r.layers) nEbene.set(l.id, (nEbene.get(l.id) ?? 0) + 1);
        nArt.set(r.type, (nArt.get(r.type) ?? 0) + 1);
        nStufe[r.audience] = (nStufe[r.audience] ?? 0) + 1;
      }

      const eintraege = new Map(
        visibilityRulesOf(z.kampagne)
          .filter((x) => x.id.startsWith('article:'))
          .map((x) => [decodeURIComponent(x.id.slice('article:'.length)), x] as const),
      );
      const treffer = filterArticleRows(alle, frage);
      const seite = treffer.slice(offset, offset + limit);
      /* **Fassungen derselben Sache** (T-403): wie viele es gibt, welche
         Listen und Verweise zeigen (der höchste Rang, mit dem Vorrang der
         Kampagne) und welche die Leitung bevorzugt — dort steht „Prefer
         this version". */
      const gruppe = versionGroups(zeilen);
      const rang = playStack(map, z.kampagne, registry);
      const kopf = new Map<string, { id: string; r: number }>();
      const zahl = new Map<string, number>();
      for (const e of zeilen) {
        const g = gruppe.get(e.id);
        if (!g) continue;
        zahl.set(g, (zahl.get(g) ?? 0) + 1);
        const r = rang.rank(e);
        const k = kopf.get(g);
        if (!k || r > k.r) kopf.set(g, { id: e.id, r });
      }
      const bevorzugt = new Set(preferencesOf(z.kampagne).map((p) => p.to));
      const fassungen = (id: string) => {
        const g = gruppe.get(id);
        if (!g || (zahl.get(g) ?? 0) < 2) return {};
        return { versions: { n: zahl.get(g)!, shown: kopf.get(g)?.id === id, ...(bevorzugt.has(id) ? { preferred: true } : {}) } };
      };
      const darf = await deps.schreibbar(user);
      return {
        may: z.recht,
        columns: spalten,
        total: treffer.length,
        all: alle.length,
        offset,
        limit,
        query: frage,
        facets: {
          layers: [...nEbene]
            .map(([id, n]) => (id === 'none' ? { id, name: 'No layer', publisher: '', groups: [], n } : { ...ebeneVon(id), n }))
            .sort((a, b) => (a.id === 'none' ? 1 : b.id === 'none' ? -1 : a.name.localeCompare(b.name, 'de'))),
          types: [...nArt].map(([key, n]) => ({ key, label: typName(key), n })).sort((a, b) => a.label.localeCompare(b.label, 'de')),
          levels: nStufe,
        },
        rows: seite.map((r) => {
          const e = r.entity;
          /* Sagt der Artikel selbst nichts, steht hier sein Eintrag im Regelwerk (T-401). */
          const feld = (e.components?.[VISIBILITY_COMPONENT] ?? {}) as VisibilityFields;
          const eintrag = eintraege.get(e.id);
          const ausEintrag = !feld.audience && !feld.revealedTo?.length && !feld.hiddenFrom?.length && !!eintrag;
          const v: VisibilityFields = ausEintrag
            ? { ...(eintrag!.audience ? { audience: eintrag!.audience } : {}), ...(eintrag!.show ? { revealedTo: [...eintrag!.show] } : {}), ...(eintrag!.hide ? { hiddenFrom: [...eintrag!.hide] } : {}) }
            : feld;
          const seenBy = spalten.filter((s) => articleVisible(map, e, augen.get(s.key)!)).map((s) => s.key);
          const players: Record<string, 'show' | 'hide'> = {};
          for (const s of spalten) {
            const p = s.kind === 'player' ? playerSetting(v, s.bearers ?? []) : null;
            if (p) players[s.key] = p;
          }
          return {
            id: r.id,
            name: r.name,
            type: r.type,
            typeLabel: r.typeLabel,
            layers: layersOf(e).map(ebeneVon),
            audience: r.audience,
            source: r.source,
            ...(r.rule ? { rule: r.rule } : {}),
            own: {
              ...(typeof v.audience === 'string' ? { audience: v.audience } : {}),
              revealedTo: Array.isArray(v.revealedTo) ? v.revealedTo.length : 0,
              hiddenFrom: Array.isArray(v.hiddenFrom) ? v.hiddenFrom.length : 0,
            },
            players,
            seenBy,
            writable: user.isAdmin || darf(r.id),
            /* Setzen lässt sich jede Zeile (T-401): ins Feld, wo die Leitung schreibt, sonst als Eintrag im Regelwerk. */
            settable: z.recht === 'manage',
            ...(ausEintrag ? { via: 'rule' as const } : {}),
            ...fassungen(r.id),
          };
        }),
      };
    },
  );

  /**
   * **Sichtbarkeit je Artikel setzen** (T-387) — `{ ids, audience }` (eine
   * Stufe, `null`: der Gruppe folgen), `{ ids, player: { key, mode } }` (je
   * Spielende/r zeigen, verbergen, folgen — `key` ist die Spalte) oder
   * `{ ids, follow: true }`. Geschrieben ins eigene Feld des Artikels, wie
   * jedes Schreiben (`schreiben`); was die Leitung nicht schreibt, bleibt
   * und kommt mit Grund zurück — für eine ganze Auswahl auf einmal.
   */
  app.post<{ Params: { c: string }; Body: { ids?: unknown; audience?: unknown; player?: unknown; follow?: unknown } }>(
    '/api/campaigns/:c/visibility/articles',
    async (request, reply) => {
      const z = await zugang(request, reply, true);
      if (!z) return;
      const b = request.body ?? {};
      const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((x): x is string => typeof x === 'string'))] : [];
      if (!ids.length) return nein(reply, 400, 'ids: choose at least one article.');
      if (ids.length > 500) return nein(reply, 400, 'ids: at most 500 articles at once — narrow the filter and do it in parts.');
      let aenderung: VisibilityChange;
      if (b.follow === true) aenderung = { follow: true };
      else if (b.audience !== undefined) {
        if (b.audience !== null && !STUFEN.includes(b.audience as Audience)) {
          return nein(reply, 400, `audience: one of ${STUFEN.join(', ')}, or null to follow the group.`);
        }
        aenderung = { audience: b.audience as Audience | null };
      } else if (b.player && typeof b.player === 'object') {
        const p = b.player as { key?: unknown; mode?: unknown };
        if (typeof p.key !== 'string' || !['show', 'hide', 'follow'].includes(p.mode as string)) {
          return nein(reply, 400, 'player: { key: the player column, mode: show | hide | follow }.');
        }
        const { spalten } = await grundlage(z);
        const s = spalten.find((x) => x.key === p.key && x.kind === 'player');
        if (!s) return nein(reply, 400, 'player.key: not a player of this campaign — reload the page.');
        if (!s.bearers?.length) return nein(reply, 400, `${s.label} plays no character yet — assign one under Members first.`);
        aenderung = { player: { bearers: s.bearers, mode: p.mode as 'show' | 'hide' | 'follow' } };
      } else {
        return nein(reply, 400, 'Say what to set: audience, player or follow.');
      }

      const darf = await deps.schreibbar(z.user);
      const done: string[] = [];
      const unchanged: string[] = [];
      const refused: { id: string; name: string; error: string }[] = [];
      /* **Was die Leitung nicht schreibt, kommt ins Regelwerk** (T-401,
         E-162 a): ein Eintrag `article:<id>` an der Kampagne — kein Buch
         wird beschrieben, und er gilt nur in dieser Kampagne. Gesammelt und
         einmal geschrieben. „Der Gruppe folgen" nimmt Feld **und** Eintrag. */
      let regeln = visibilityRulesOf(z.kampagne);
      const regelnVorher = JSON.stringify(regeln);
      const eintragIds: string[] = [];
      const folgt = 'follow' in aenderung || ('audience' in aenderung && aenderung.audience === null);
      for (const id of ids) {
        const e = await repo.getEntity(id);
        if (!e) {
          refused.push({ id, name: id, error: 'No such article.' });
          continue;
        }
        const schreibt = z.user.isAdmin || darf(id);
        const hatEintrag = regeln.some((r) => r.id === articleRuleKey(id));
        if (!schreibt || (folgt && hatEintrag)) {
          const davor = JSON.stringify(regeln);
          regeln = withArticleRule(regeln, id, aenderung);
          eintragIds.push(id);
          if (!schreibt) {
            if (JSON.stringify(regeln) === davor) unchanged.push(id);
            else done.push(id);
            continue;
          }
        }
        const name = entityName(e) || id;
        const alt = e.components?.[VISIBILITY_COMPONENT] as VisibilityFields | undefined;
        const neu = applyVisibilityChange(alt, aenderung);
        if (JSON.stringify(neu ?? null) === JSON.stringify(alt ?? null)) {
          if (folgt && hatEintrag) done.push(id);
          else unchanged.push(id);
          continue;
        }
        const components = { ...(e.components ?? {}) };
        if (neu) components[VISIBILITY_COMPONENT] = neu;
        else delete components[VISIBILITY_COMPONENT];
        const r = await deps.schreiben(request, { ...e, components });
        if ('konflikt' in r) refused.push({ id, name, error: 'Changed in the meantime — reload and try again.' });
        else if (r.code >= 300) refused.push({ id, name, error: String((r.body as { error?: unknown })?.error ?? r.code) });
        else done.push(id);
      }
      if (JSON.stringify(regeln) !== regelnVorher) {
        /* Auf den frischen Stand der Kampagne gerechnet, nicht auf den vom
           Anfang: eine zweite Leitung, die gerade eine andere Zeile setzt,
           verlöre sonst ihren Eintrag. Und gegen dessen Revision
           geschrieben (T-449): auch zwischen Lesen und Schreiben. */
        const fertig = await aufFrischemStand(request, async (gegen) => {
          const k = (await repo.getEntity(z.kampagne.id)) ?? z.kampagne;
          let frisch = visibilityRulesOf(k);
          for (const id of eintragIds) frisch = withArticleRule(frisch, id, aenderung);
          const geschrieben: Entity = {
            ...k,
            components: { ...(k.components ?? {}), [VISIBILITY_RULES_COMPONENT]: { visibilityRules: frisch } },
          };
          const issues = validateEntity(await repo.getRegistry(), geschrieben, {});
          if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
          await repo.putEntity(geschrieben, gegen(k));
          return null;
        });
        if (fertig) return fertig;
        await repo.appendEvent('campaign.visibility', z.kampagne.id, { articles: ids, by: z.user.id });
      }
      return { ok: true, done, unchanged, refused };
    },
  );
}
