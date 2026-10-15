/**
 * **Die Leseansicht** (T-091, REQ-247): eine Ebene als Buch — ein
 * Abenteuer (T-082) heute, die Bücher, sobald ihr Text hereinkommt (E-024).
 *
 * Gelesen wird über vier Routen:
 *
 * - `GET /api/read/:layer` — das Inhaltsverzeichnis (`readingOrder`) und
 *   der Lesestand dieses Kontos;
 * - `GET /api/read/:layer/unit/:unit` — ein Stück (ein Kapitel) am Stück,
 *   mit dem, was an seinen Abschnitten hängt (Karten, Begegnungen), und
 *   den Namen und Verweiszielen, die der Text braucht;
 * - `GET /api/read/:layer/search?q=` — die Suche im Buch;
 * - `PUT /api/read/:layer/position` — den Lesestand merken.
 *
 * **Gesiebt wird wie überall** (`sieve`): was nicht im Stapel steht, was
 * jemand nicht sehen darf, steht auch hier nicht — ein Abenteuer
 * (`audience: 'gm'`) bleibt für Spielende leer, bis die Leitung etwas
 * freigibt. **Eine Fassung gilt** (E-018): hat die Kampagne ein Kapitel
 * angepasst, steht ihre Fassung an seiner Stelle; der Baum bleibt der des
 * Originals, darum nennen Inhaltsverzeichnis und Lesestand die Ids der
 * Originale.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  entityName,
  groupMembers,
  isGroupLayer,
  isReadingNode,
  layersInGroup,
  partsIndex,
  primaryInterface,
  readingOrder,
  READING_TYPES,
  replacedIds,
  type ReadingNode,
} from '@nw/model';
import type { Entity } from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

/** Was an einem Abschnitt hängt und mit ihm gezeigt wird: seine Karten, seine Begegnungen. */
/* `describedIn`: ein Ort aus dem Buch zeigt auf den Abschnitt, der ihn beschreibt (T-175). */
const EINGEBETTET = new Set(['mapOf', 'partOf', 'describedIn']);
/** Die Karten, deren Text gesucht wird — die übrigen sind Zahlen und Kanten. */
const TEXTKARTEN = ['Prose', 'ReadAloud', 'Description'];
const TREFFER_HOECHSTENS = 50;

interface Stand {
  stempel: string;
  alle: Entity[];
  map: Map<string, Entity>;
  /** Was eine Fassung ersetzt — nur dafür lohnt `geltend` die Frage. */
  ersetzt?: Set<string>;
}

export interface LeseDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  /** Mit `vorschau` (T-167) auch, was nur fehlt, weil eine dieser Ebenen nicht aufgeschaltet ist. */
  sieve: (
    request: FastifyRequest,
    entities: Entity[],
    bestand?: Map<string, Entity>,
    vorschau?: ReadonlySet<string>,
  ) => Promise<Entity[]>;
  /** Die Ebenen, die die laufende Kampagne aufschaltet (Gruppen aufgelöst). */
  aufgeschaltet: (map: Map<string, Entity>) => Promise<ReadonlySet<string>>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  bezuegeVon: (
    request: FastifyRequest,
    e: Entity,
  ) => Promise<{ names: Record<string, string>; links: Record<string, { id: string; name: string }[]> }>;
}

/** Wohin „im Buch lesen" von einem Artikel führt (`refs.reading`). */
export interface LeseZiel {
  layer: string;
  /** Der Abschnitt selbst, wenn der Artikel Text dieser Ebene ist. */
  at?: string;
  /** Sonst seine Seite („XGE p. 12"). */
  page?: string;
  /** An einer Ebene ohne Buchtext (T-167): der Knopf steht ausgegraut da. */
  empty?: true;
}

/** Ein Eintrag im Inhaltsverzeichnis, wie er hinausgeht. */
interface Zeile {
  id: string;
  /** Die Fassung, die in dieser Kampagne gilt, wenn es nicht das Original ist (E-018). */
  article?: string;
  name: string;
  type: string;
  depth: number;
  unit: string;
  page?: string;
}

/**
 * Die Seite eines Artikels: `Source.page`, und wo die Art keine `Source`
 * trägt (`Story`, `Scene`), die Notiz, in die der Importer die Fundstelle
 * dann schreibt („Source: LMoP, p. 6", `werkbank.quelle`).
 */
export function seiteVon(e: Entity): string | undefined {
  const p = (e.components?.['Source'] as { page?: unknown } | undefined)?.page;
  if (p !== undefined && p !== null && p !== '') return String(p);
  const notizen = (e.components?.['Notes'] as { note?: unknown } | undefined)?.note;
  if (!Array.isArray(notizen)) return undefined;
  for (const n of notizen as { id?: unknown; value?: unknown }[]) {
    const m = n?.id === 'source' && typeof n.value === 'string' ? /,\s*p\.\s*(\S+)\s*$/.exec(n.value) : null;
    if (m) return m[1];
  }
  return undefined;
}

/** `[[npc-0042|Volo]]` → Volo, `{{1d6}}` → 1d6: was jemand im Treffer liest. */
function klartext(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{([^}]+)\}\}/g, '$1')
    .replace(/[*_#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function texteIn(wert: unknown, raus: string[]): void {
  if (typeof wert === 'string') raus.push(wert);
  else if (Array.isArray(wert)) for (const w of wert) texteIn(w, raus);
  /* Die Id eines Eintrags (`{ id: 'text', value }`) ist kein Text. */
  else if (wert && typeof wert === 'object') for (const [k, w] of Object.entries(wert)) if (k !== 'id') texteIn(w, raus);
}

/**
 * **Darf dieser Betrachter die Ebene lesen, bevor sie aufgeschaltet
 * ist?** (T-167) Dann die Ebenen, deren Artikel das Sieb dazu fragt —
 * die Ebene selbst, bei einer Gruppe auch ihre Mitglieder; sonst eine
 * leere Menge, und es gilt der Stapel wie überall.
 *
 * Immer: die Verwaltung, wer irgendwo leitet, und wer die Ebene besitzt
 * oder bearbeitet. Spielende nur, wenn die Ebene ausdrücklich
 * `audience: 'public'` trägt — die Vorgabe `public` ohne Angabe reicht
 * nicht, sonst wäre jedes Buch der Installation vor dem Aufschalten
 * offen. Was im Spiel ist, lesen sie ohnehin. Welche Felder und Artikel
 * danach ankommen, sagt das Sieb wie immer (`redactEntity`). Der
 * Inhaltsbaum einer Quelle (T-189) fragt dasselbe.
 */
export function vorschauEbenen(user: User | null, l: Entity, map: Map<string, Entity>): ReadonlySet<string> {
  const ebenen = (): Set<string> => new Set([l.id, ...(isGroupLayer(l) ? layersInGroup(map, l.id, groupMembers(map)) : [])]);
  if (!user || user.isAdmin) return ebenen();
  if (Object.values(user.roles ?? {}).some((r) => r === 'gm' || r === 'co-gm')) return ebenen();
  if ((user.layerIds ?? []).includes(l.id) || (user.ownedLayerIds ?? []).includes(l.id)) return ebenen();
  const vis = l.components?.['Visibility'] as { audience?: unknown } | undefined;
  return vis?.audience === 'public' ? ebenen() : new Set();
}

export function registerLesen(
  app: FastifyInstance,
  deps: LeseDeps,
): { leseZiel: (e: Entity) => Promise<LeseZiel | undefined>; lesbar: () => Promise<Set<string>> } {
  const { repo, viewerOf, roh, sieve, geltend, bezuegeVon, aufgeschaltet } = deps;

  /* Das Inhaltsverzeichnis je Ebene, einmal je Bestand-Stempel: der Baum
     hängt nicht am Betrachter, nur das Sieb danach. */
  let ordnungen: { stempel: string; je: Map<string, ReadingNode[]>; mitText: Set<string> } | null = null;
  async function ordnung(layer: string): Promise<{ stand: Stand; order: ReadingNode[] }> {
    const stand = await roh();
    await lesbar();
    let order = ordnungen!.je.get(layer);
    if (!order) {
      order = readingOrder(stand.alle, layer);
      ordnungen!.je.set(layer, order);
    }
    return { stand, order };
  }
  /** Die Ebenen, die überhaupt Text haben — nur zu ihnen führt „im Buch lesen". */
  function ebenenMitText(stand: Stand): Set<string> {
    const raus = new Set<string>();
    for (const e of stand.alle) {
      if (!READING_TYPES.includes(primaryInterface(e))) continue;
      for (const r of e.relations ?? []) if (r.type === 'inLayer' && r.to) raus.add(r.to);
    }
    return raus;
  }

  /** Die Ebene, wenn es sie gibt und dieser Betrachter sie sehen darf. */
  async function ebene(request: FastifyRequest, id: string, stand: Stand): Promise<Entity | undefined> {
    const l = stand.map.get(id);
    if (!l || primaryInterface(l) !== 'Layer') return undefined;
    return (await sieve(request, [l], stand.map))[0];
  }

  async function vorschauFuer(request: FastifyRequest, l: Entity, stand: Stand): Promise<ReadonlySet<string>> {
    return vorschauEbenen(await viewerOf(request), l, stand.map);
  }

  /**
   * Die Abschnitte, wie dieser Betrachter sie bekommt: je Original die
   * Fassung, die gilt, gesiebt. Was durchs Sieb fällt, fehlt in der Karte.
   */
  async function gesiebt(
    request: FastifyRequest,
    knoten: Entity[],
    stand: Stand,
    vorschau?: ReadonlySet<string>,
  ): Promise<Map<string, Entity>> {
    /* Nur was eine Fassung ersetzt, fragt nach ihr: zehntausend Absätze
       sind sonst zehntausend Fragen an den Bestand (T-108). */
    const gilt = await Promise.all(
      knoten.map(async (k) => [k.id, stand.ersetzt && !stand.ersetzt.has(k.id) ? k : await geltend(k, stand.map)] as const),
    );
    const durch = new Map(
      (await sieve(request, [...new Map(gilt.map(([, g]) => [g.id, g])).values()], stand.map, vorschau)).map((e) => [e.id, e]),
    );
    const raus = new Map<string, Entity>();
    for (const [orig, g] of gilt) {
      const e = durch.get(g.id);
      if (e) raus.set(orig, e);
    }
    return raus;
  }

  /**
   * **Das Regal einer Gruppe** (T-167): ihre direkten Mitglieder in der
   * Reihenfolge des Stapels, je mit der Angabe, ob es Text zu lesen gibt —
   * ein Buch ohne Text steht ausgegraut da, statt zu fehlen. Gesiebt wie
   * jede Ebene.
   */
  async function regal(request: FastifyRequest, g: Entity, stand: Stand, imSpiel: ReadonlySet<string>) {
    const mitText = await lesbar();
    const ids = groupMembers(stand.map).get(g.id) ?? [];
    const ebenen = await sieve(request, ids.map((id) => stand.map.get(id)!).filter(Boolean), stand.map);
    return ebenen.map((e) => {
      const kind = (e.components?.['Layer'] as { kind?: unknown } | undefined)?.kind;
      return {
        id: e.id,
        name: entityName(e),
        kind: typeof kind === 'string' ? kind : '',
        ...(isGroupLayer(e) ? { group: true } : {}),
        hasText: mitText.has(e.id),
        active: imSpiel.has(e.id),
      };
    });
  }

  app.get<{ Params: { layer: string } }>('/api/read/:layer', async (request, reply) => {
    const { stand, order } = await ordnung(request.params.layer);
    const l = await ebene(request, request.params.layer, stand);
    if (!l) return reply.code(404).send({ error: 'Nicht gefunden' });
    const vorschau = await vorschauFuer(request, l, stand);
    /* Gesiebt wird, was im Verzeichnis steht — die Absätze eines Buchs
       (T-108) sind Zehntausende und kommen erst mit ihrem Stück. */
    const sichtbar = await gesiebt(
      request,
      order.filter((n) => n.toc !== false).map((n) => stand.map.get(n.id)!),
      stand,
      vorschau,
    );
    const toc: Zeile[] = [];
    for (const n of order) {
      /* Absätze, Vorlesetexte, Verweise stehen im Stück, nicht im Verzeichnis (T-108). */
      if (n.toc === false) continue;
      const e = sichtbar.get(n.id);
      if (!e) continue;
      const seite = seiteVon(e) ?? seiteVon(stand.map.get(n.id)!);
      toc.push({
        id: n.id,
        ...(e.id !== n.id ? { article: e.id } : {}),
        name: entityName(e),
        type: primaryInterface(e),
        depth: n.depth,
        unit: n.unit,
        ...(seite ? { page: seite } : {}),
      });
    }
    /* `unit` bleibt die Id des Kapitels, auch wenn sein Kopf durchs Sieb
       fiel: die Seite fragt das Stück danach, und seine sichtbaren
       Abschnitte kommen trotzdem. */
    const user = await viewerOf(request);
    const merk = user ? await repo.readingPosition(user.id, l.id) : undefined;
    const layerKind = (l.components?.['Layer'] as { kind?: unknown } | undefined)?.kind;
    const imSpiel = await aufgeschaltet(stand.map);
    return {
      layer: { id: l.id, name: entityName(l), kind: typeof layerKind === 'string' ? layerKind : '' },
      toc,
      position: merk && toc.some((z) => z.id === merk) ? merk : null,
      /* Nicht aufgeschaltet (T-167): gelesen wird eine Vorschau, und die
         Seite sagt es — oder, ohne Recht dazu, warum sie leer bleibt. */
      ...(imSpiel.has(l.id) ? {} : { inactive: true, ...(vorschau.size ? { preview: true } : {}) }),
      /* Eine Gruppe liest sich als Regal ihrer Bücher (T-167). */
      ...(isGroupLayer(l) ? { shelf: await regal(request, l, stand, imSpiel) } : {}),
      /* Hat die Ebene gar keinen Buchtext, sagt die Seite das (T-126) —
         statt „vielleicht nur für die Leitung" auch der Verwaltung, bei der
         das nie der Grund ist. Verrät nichts: ob ein Buch eingelesen ist,
         ist kein Geheimnis; was gesiebt wurde, bleibt ungesagt. */
      ...(order.some((n) => n.toc !== false) || isGroupLayer(l) ? {} : { empty: 'noText' as const }),
    };
  });

  app.get<{ Params: { layer: string; unit: string } }>('/api/read/:layer/unit/:unit', async (request, reply) => {
    const { stand, order } = await ordnung(request.params.layer);
    const l = await ebene(request, request.params.layer, stand);
    if (!l) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Ein Stück ist sein Kopf und alles, was ihm zugeschlagen ist; nennt
       jemand einen Abschnitt, gilt sein Stück. Den Kopf muss er nicht
       sehen — die Abschnitte, die er sieht, kommen trotzdem. */
    const unit = order.find((n) => n.id === request.params.unit)?.unit ?? request.params.unit;
    const glieder = order.filter((n) => n.unit === unit);
    if (!glieder.length) return reply.code(404).send({ error: 'Nicht gefunden' });
    const vorschau = await vorschauFuer(request, l, stand);
    const sichtbar = await gesiebt(request, glieder.map((n) => stand.map.get(n.id)!), stand, vorschau);

    /* Was an einem Abschnitt hängt — an ihm oder an seiner Fassung. */
    const anKnoten = new Map<string, string>();
    for (const n of glieder) {
      anKnoten.set(n.id, n.id);
      const f = sichtbar.get(n.id);
      if (f) anKnoten.set(f.id, n.id);
    }
    const haengt = new Map<string, Entity[]>();
    /* Was selbst im Text steht (ein Teil eines Kapitels, T-108), ist kein
       Anhang seines Abschnitts. */
    const imText = new Set(order.map((n) => n.id));
    for (const e of stand.alle) {
      if (READING_TYPES.includes(primaryInterface(e)) || imText.has(e.id)) continue;
      const r = (e.relations ?? []).find((x) => EINGEBETTET.has(x.type) && anKnoten.has(x.to));
      if (!r) continue;
      const k = anKnoten.get(r.to)!;
      (haengt.get(k) ?? haengt.set(k, []).get(k)!).push(e);
    }
    const eingebettet = await gesiebt(request, [...haengt.values()].flat(), stand, vorschau);
    /* Ein Verweis-Teil (`Embed`, T-108) zeigt auf einen Artikel, der für
       sich steht — einen Zauber, ein Monster. Er kommt mit, gesiebt wie
       alles: wer das Ziel nicht sehen darf, sieht an der Stelle nichts. */
    const zielVon = new Map<string, Entity>();
    for (const n of glieder) {
      const e = sichtbar.get(n.id);
      const ziel = e && primaryInterface(e) === 'Embed' ? (e.components?.['Embed'] as { target?: unknown } | undefined)?.target : undefined;
      const z = typeof ziel === 'string' ? stand.map.get(ziel) : undefined;
      if (z) zielVon.set(n.id, z);
    }
    const ziele = await gesiebt(request, [...zielVon.values()], stand, vorschau);

    const sections = glieder
      .filter((n) => sichtbar.has(n.id))
      .map((n) => {
        const ziel = zielVon.has(n.id) ? ziele.get(zielVon.get(n.id)!.id) : undefined;
        return {
          id: n.id,
          depth: n.depth,
          ...(n.toc === false ? { toc: false } : {}),
          entity: sichtbar.get(n.id)!,
          embeds: (haengt.get(n.id) ?? []).map((e) => eingebettet.get(e.id)).filter((e): e is Entity => !!e),
          ...(ziel ? { target: ziel } : {}),
        };
      })
      /* Ein Verweis, dessen Ziel der Betrachter nicht sieht, ist eine leere Stelle. */
      .filter((x) => primaryInterface(x.entity) !== 'Embed' || x.target);
    /* Namen und Verweisziele für alles auf einmal: ein Artikel aus allen
       Karten und Kanten des Stücks, nur zum Fragen — zwanzig Abschnitte
       sind sonst zwanzigmal das Sieb über die Kandidaten. */
    const alles = sections.flatMap((s) => [s.entity, ...s.embeds, ...(s.target ? [s.target] : [])]);
    const refs = await bezuegeVon(request, {
      id: `read:${unit}`,
      name: '',
      interfaces: [],
      components: { Read: { texts: alles.map((e) => e.components ?? {}) } },
      relations: alles.flatMap((e) => e.relations ?? []),
    });
    for (const e of alles) refs.names[e.id] = entityName(e);
    return { layer: l.id, unit, sections, refs };
  });

  app.get<{ Params: { layer: string }; Querystring: { q?: string } }>('/api/read/:layer/search', async (request, reply) => {
    const q = String(request.query.q ?? '').trim().toLowerCase();
    if (q.length < 2) return reply.code(400).send({ error: 'Mindestens zwei Zeichen.' });
    const { stand, order } = await ordnung(request.params.layer);
    const l = await ebene(request, request.params.layer, stand);
    if (!l) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Gesucht wird im Gesiebten: ein Treffer in einem Geheimnis verriete
       es, auch ohne den Text zu zeigen. */
    const sichtbar = await gesiebt(request, order.map((n) => stand.map.get(n.id)!), stand, await vorschauFuer(request, l, stand));
    const hits: { id: string; unit: string; name: string; snippet: string }[] = [];
    for (const n of order) {
      const e = sichtbar.get(n.id);
      if (!e) continue;
      const name = entityName(e);
      const roh: string[] = [];
      for (const k of TEXTKARTEN) texteIn(e.components?.[k], roh);
      const text = klartext(roh.join(' '));
      const i = text.toLowerCase().indexOf(q);
      if (i < 0 && !name.toLowerCase().includes(q)) continue;
      const von = Math.max(0, i - 60);
      const snippet = i < 0 ? text.slice(0, 120) : `${von ? '…' : ''}${text.slice(von, i + q.length + 80)}${i + q.length + 80 < text.length ? '…' : ''}`;
      hits.push({ id: n.id, unit: n.unit, name, snippet });
      if (hits.length >= TREFFER_HOECHSTENS) break;
    }
    return { q, hits };
  });

  /* Die Teile je Ganzem, einmal je Bestand-Stempel (T-108). */
  let teileJe: { stempel: string; index: ReturnType<typeof partsIndex> } | null = null;

  /**
   * **Die Teile eines Artikels in ihrer Reihenfolge** (T-108, E14):
   * `GET /api/entities/:id/parts` — was mit Rang an einem Kapitel, einer
   * Szene oder einem Arc hängt, für dessen Artikelseite. Eine Fassung (E-018)
   * hat die Teile ihres Originals dazu: die Teile eines angepassten
   * Kapitels hängen weiter am Original. Je Teil die Fassung, die gilt,
   * gesiebt; ein Verweis-Teil bringt sein Ziel mit.
   */
  app.get<{ Params: { id: string } }>('/api/entities/:id/parts', async (request, reply) => {
    const stand = await roh();
    const gefunden = stand.map.get(request.params.id);
    const ganzes = gefunden ? await geltend(gefunden, stand.map) : undefined;
    if (!ganzes || !(await sieve(request, [ganzes], stand.map)).length) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (teileJe?.stempel !== stand.stempel) teileJe = { stempel: stand.stempel, index: partsIndex(stand.alle) };
    const auch = [ganzes.id, ...replacedIds(stand.map, ganzes)];
    const roh2 = auch.flatMap((id) => teileJe!.index.get(id) ?? []).sort((a, b) => a.rank - b.rank);
    /* Ein Teil, der als Original und als Fassung dasteht, einmal. */
    const gesehen = new Set<string>();
    const knoten = roh2.map((t) => t.entity).filter((e) => !gesehen.has(e.id) && gesehen.add(e.id));
    const sichtbar = await gesiebt(request, knoten, stand);
    const zielVon = new Map<string, Entity>();
    for (const e of sichtbar.values()) {
      const ziel = primaryInterface(e) === 'Embed' ? (e.components?.['Embed'] as { target?: unknown } | undefined)?.target : undefined;
      const z = typeof ziel === 'string' ? stand.map.get(ziel) : undefined;
      if (z) zielVon.set(e.id, z);
    }
    const ziele = await gesiebt(request, [...zielVon.values()], stand);
    const parts = knoten
      .filter((k) => sichtbar.has(k.id))
      .map((k) => {
        const e = sichtbar.get(k.id)!;
        const z = zielVon.get(e.id);
        const ziel = z ? ziele.get(z.id) : undefined;
        return { id: k.id, entity: e, ...(ziel ? { target: ziel } : {}) };
      })
      .filter((x) => primaryInterface(x.entity) !== 'Embed' || x.target);
    const alles = parts.flatMap((x) => [x.entity, ...(x.target ? [x.target] : [])]);
    const refs = await bezuegeVon(request, {
      id: `parts:${ganzes.id}`,
      name: '',
      interfaces: [],
      components: { Read: { texts: alles.map((e) => e.components ?? {}) } },
      relations: alles.flatMap((e) => e.relations ?? []),
    });
    for (const e of alles) refs.names[e.id] = entityName(e);
    return { id: ganzes.id, parts, refs };
  });

  app.put<{ Params: { layer: string }; Body: { id?: unknown } | null }>('/api/read/:layer/position', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const id = typeof request.body?.id === 'string' ? request.body.id : '';
    const { stand, order } = await ordnung(request.params.layer);
    const l = await ebene(request, request.params.layer, stand);
    if (!l) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Gemerkt wird nur ein Abschnitt dieses Buchs, den er sieht — sonst
       wäre der Lesestand eine Ablage für beliebige Ids. */
    if (
      !order.some((n) => n.id === id) ||
      !(await gesiebt(request, [stand.map.get(id)!], stand, await vorschauFuer(request, l, stand))).size
    ) {
      return reply.code(400).send({ error: 'Kein Abschnitt dieses Buchs.' });
    }
    await repo.keepReadingPosition(user.id, request.params.layer, id);
    return reply.code(204).send();
  });

  /**
   * „Im Buch lesen" für einen Artikel (`refs.reading`): ist er selbst Text
   * einer Ebene, sein Abschnitt; sonst, wenn seine Ebene Text hat, seine
   * Seite. Ohne Text in der Ebene nichts — eine Leseansicht ohne Text wäre
   * ein Versprechen, das die Seite nicht hält.
   */
  async function leseZiel(e: Entity): Promise<LeseZiel | undefined> {
    const stand = await roh();
    const mitText = await lesbar();
    /* Die Ebene selbst liest man von vorn — auch ohne Text (T-167): die
       Seite sagt dann „No text imported yet", statt dass der Knopf fehlt,
       und eine Gruppe ist ein Regal. */
    if (primaryInterface(e) === 'Layer') return { layer: e.id, ...(mitText.has(e.id) || isGroupLayer(e) ? {} : { empty: true }) };
    /* Eine Fassung (E-018) liest man an der Stelle ihres Originals. */
    const original = (e.relations ?? []).find((r) => r.type === 'overrides')?.to;
    const quelle = (original && stand.map.get(original)) || e;
    for (const r of quelle.relations ?? []) {
      if (r.type !== 'inLayer' || !mitText.has(r.to)) continue;
      if (isReadingNode(quelle, r.to)) {
        const { order } = await ordnung(r.to);
        if (order.some((n) => n.id === quelle.id)) return { layer: r.to, at: quelle.id };
        /* Ein Arc liest sich als sein Kapitel (E-029, `chapterOf`). */
        const kapitel = stand.alle.find((k) => (k.relations ?? []).some((x) => x.type === 'chapterOf' && x.to === quelle.id));
        if (kapitel && order.some((n) => n.id === kapitel.id)) return { layer: r.to, at: kapitel.id };
      }
      const seite = seiteVon(quelle);
      return seite ? { layer: r.to, page: seite } : { layer: r.to };
    }
    return undefined;
  }

  /** Hat diese Ebene Text? Für die Kampagnenseite („Read" an einem Buch). */
  async function lesbar(): Promise<Set<string>> {
    const stand = await roh();
    if (ordnungen?.stempel !== stand.stempel) ordnungen = { stempel: stand.stempel, je: new Map(), mitText: ebenenMitText(stand) };
    return ordnungen.mitText;
  }

  return { leseZiel, lesbar };
}
