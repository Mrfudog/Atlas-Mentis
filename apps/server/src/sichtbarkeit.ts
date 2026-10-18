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
import {
  applyTransform,
  articleVisible,
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
  VISIBILITY_COMPONENT,
  VISIBILITY_RULES_COMPONENT,
  type Audience,
  type AudienceSource,
  type CampaignVisibility,
  type Entity,
  type Registry,
  type TransformNode,
  type TransformStep,
  type Viewer,
  type VisibilityRule,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
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

  app.get<{ Params: { c: string }; Querystring: { steps?: string } }>('/api/campaigns/:c/visibility', async (request, reply) => {
    const z = await zugang(request, reply, false);
    if (!z) return;
    const { user, map, kampagne } = z;
    const c = kampagne.id;
    const registry = await repo.getRegistry();
    const dims = visibilityDimensions(map, registry);
    const rules = visibilityRulesOf(kampagne);
    const ctx: CampaignVisibility = { campaign: c, rules, dims };
    const steps: TransformStep[] = stepsFromString(request.query.steps);
    const kette = steps.length ? steps : [{ group: 'layer' }, { group: 'type' }];

    /* **Die Spalten**: wer ohne Rolle schaut (Public), wer zuschaut (Table:
       jede Rolle), jede Spielerin mit ihrem Betrachter, wie das Sieb ihn
       baut, und die Leitung. */
    const konten = (await repo.listUsers()).filter((u) => isTableRole(u.roles?.[c]) && !u.disabledAt);
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

    /* Was die Leitung ohnehin sieht, und nur, was diese Kampagne spielt —
       ohne Instanzen und Buchteile, die in keiner Liste stehen. */
    const imSpiel = deps.imSpiel(map, kampagne, registry);
    const selbst = user.isAdmin ? undefined : { ...(await deps.augeVon(user, map, registry)), campaignRules: ctx };
    const zeilen = [...map.values()].filter(
      (e) => imSpiel(e) && !isInstance(e) && !isBookPart(e) && articleVisible(map, e, selbst),
    );

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
      const regeln = visibilityRulesOf(z.kampagne);
      const alt = regeln.find((r) => r.id === b.id);
      const neu: VisibilityRule = { ...(alt ?? { id: b.id }) };
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
        ...z.kampagne,
        components: { ...(z.kampagne.components ?? {}), [VISIBILITY_RULES_COMPONENT]: { visibilityRules: danach } },
      };
      const issues = validateEntity(await repo.getRegistry(), geschrieben, {});
      if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      await repo.putEntity(geschrieben);
      await repo.appendEvent('campaign.visibility', z.kampagne.id, { rule: b.id, ...(sagt ? { set: neu } : { removed: true }), by: z.user.id });
      return { ok: true, rules: danach };
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
}
