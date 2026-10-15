/**
 * **Handwerk im Web** (T-128, REQ-184): der Fertigungsauftrag.
 *
 * Ein Auftrag ist eine **Instanz des Rezepts** (`CraftingOrder`,
 * `instanceOf` aufs Rezept): er liest Werkzeug, SG, Zeit, Material und
 * Ertrag beim Rezept und hält selbst Ausgang, gearbeitete Tage und die
 * Proben als **Kreise** (T-165, `checks`) — was sie bewirken, rechnet
 * `tallyChecks` beim Lesen, darum nimmt ein Zurückklicken eine Regel
 * zurück, solange der Auftrag läuft; abgerechnet wird bei `finish`. Wer
 * fertigt, sagt die Kante `crafting` vom Fertigenden zum Auftrag. Das
 * Material bleibt in den Inventaren von Figur und Gruppe und ist für den
 * Auftrag **reserviert** (`holds.props.reservedFor`, T-127).
 *
 * Geschrieben wird nur hier und nicht über `PUT`: ein Ausgang, den jemand
 * in der Maske setzt, hätte kein Material abgerechnet. Die Routen prüfen
 * selbst, wer darf — die eigene Figur fertigt, die Leitung bestätigt und
 * entscheidet; die Regeln stehen an der Kampagne (`craftRulesOf`).
 * Was sich ändert, geht über das Repository und damit über den Live-Kanal
 * (T-116) an jeden, der es sehen darf.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  baseArticle,
  applySettlement,
  coverage,
  craftCheck,
  craftRuleSentences,
  enumOptions,
  MATERIAL_GROUP,
  materialFit,
  materialGroupOf,
  materialProfile,
  substitutionsOf,
  substitutionText,
  craftRulesOf,
  CRAFTING_RELATION,
  currentCampaign,
  entityName,
  insideOf,
  knows,
  materialsOf,
  nextId,
  ORDER_COMPONENT,
  orderChecks,
  orderNeed,
  RECIPE_COMPONENT,
  recipeLearned,
  recipeTools,
  recipeTrade,
  recipesOfTool,
  recipesOfTrade,
  reserveIn,
  reservedPieces,
  resolveInstance,
  rollResult,
  setCheck,
  settlePieces,
  STATUS_COMPONENT,
  tableRole,
  tallyChecks,
  templateOf,
  TRADE_COMPONENT,
  tradeOfRecipe,
  tradesOfTool,
  tradeTools,
  typeChain,
  primaryInterface,
  type CraftRules,
  type Entity,
  type FitContext,
  type OrderCheck,
  type OrderOutcome,
  type ReservedPiece,
  type Return,
  type RollPayload,
  type RollResult,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { stueckWerkstatt } from './stueck.js';

const ORDER_TYPE = 'CraftingOrder';
const PARTY_RELATION = 'memberOfParty';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface HandwerkDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  kampagnenEbene: (map: Map<string, Entity>, kampagne: Entity | null) => Promise<Entity | null>;
  /** Eine eingetragene Probe ins Log des Auftrags (T-172, `wurfEintragen`). */
  wurf?: (subject: Entity, payload: RollPayload) => Promise<unknown>;
}


const carriesOf = (e: Entity | undefined): string | null => (e?.relations ?? []).find((r) => r.type === 'carries')?.to ?? null;
const partiesOf = (e: Entity): string[] => (e.relations ?? []).filter((r) => r.type === PARTY_RELATION).map((r) => r.to);
const neueKante = (inv: string, art: string) => `${inv}~${art}-${randomUUID().slice(0, 8)}`;

export function registerHandwerk(app: FastifyInstance, deps: HandwerkDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, kampagnenEbene } = deps;

  /** Wer am Tisch leitet: Verwaltung, `gm` und `co-gm` der laufenden Kampagne. */
  function leitet(user: User, kampagne: Entity | null): boolean {
    if (user.isAdmin) return true;
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    return rolle === 'gm' || rolle === 'co-gm';
  }

  /**
   * **Die Inventare, aus denen eine Figur Material nimmt:** ihr eigenes und
   * das ihrer Gruppen (T-127), dazu die Behälter darin. Ein Stück im
   * Rucksack der Gruppe ist so gut wie eines lose in der Truhe.
   */
  function inventareVon(actor: Entity, map: Map<string, Entity>): string[] {
    const traeger = [actor, ...partiesOf(actor).map((p) => map.get(p)).filter((x): x is Entity => !!x)];
    const raus = new Set<string>();
    for (const t of traeger) {
      const inv = carriesOf(t);
      if (!inv) continue;
      raus.add(inv);
      for (const h of map.get(inv)?.relations ?? []) if (h.type === 'holds') for (const i of insideOf(h.to, map)) raus.add(i);
    }
    return [...raus];
  }

  /** Wem ein Inventar gehört (der Träger), mit Namen. */
  function besitzer(map: Map<string, Entity>): Map<string, { id: string; name: string }> {
    const raus = new Map<string, { id: string; name: string }>();
    for (const e of map.values()) {
      for (const r of e.relations ?? []) if (r.type === 'carries') raus.set(r.to, { id: e.id, name: entityName(e) });
    }
    return raus;
  }

  /**
   * Was das Rezept braucht: je Bestandteil Menge und ob er verbraucht wird.
   * `key` ist die `needs`-Kante — unter ihr wird reserviert (T-197);
   * `group`, wenn sie auf eine Materialgruppe zeigt statt auf einen Gegenstand.
   */
  function bedarf(rezept: Entity, map: Map<string, Entity>) {
    return (rezept.relations ?? [])
      .filter((r) => r.type === 'needs')
      .map((r, i) => ({
        key: r.id || `needs-${i}`,
        item: r.to,
        name: entityName(map.get(r.to)) || r.to,
        group: (map.get(r.to)?.interfaces ?? []).includes(MATERIAL_GROUP),
        qty: Math.max(1, Number(r.props?.['qty']) || 1),
        consumed: r.props?.['consumed'] !== false,
      }));
  }

  type Bedarf = ReturnType<typeof bedarf>[number];

  /** Für welchen Bestandteil ein reserviertes Stück steht: genannt (T-197), sonst nach Grundartikel. */
  function bestandteil(bed: readonly Bedarf[], piece: ReservedPiece, map: Map<string, Entity>): Bedarf | undefined {
    return (piece.forNeed ? bed.find((b) => b.key === piece.forNeed) : undefined) ?? bed.find((b) => b.item === baseArticle(map, piece.item));
  }

  /** Was die Passprüfung braucht: die Seltenheiten des Registers und die Ersatzregeln der Kampagne. */
  async function passKontext(kampagne: Entity | null, map: Map<string, Entity>): Promise<FitContext> {
    const registry = await repo.getRegistry();
    const prop = registry.interfaces['Item']?.schema?.properties?.['rarity'] as Parameters<typeof enumOptions>[1];
    return { rarities: enumOptions(registry, prop) ?? [], substitutions: substitutionsOf(kampagne, (id) => map.get(id)) };
  }

  /** Der Auftrag aufgelöst, sein Rezept, wer fertigt. */
  function auftrag(order: Entity, map: Map<string, Entity>) {
    const aufgeloest = resolveInstance(map, order);
    const rezept = templateOf(map, order);
    const actor = [...map.values()].find((e) => (e.relations ?? []).some((r) => r.type === CRAFTING_RELATION && r.to === order.id)) ?? null;
    const karte = order.components?.[ORDER_COMPONENT] ?? {};
    return {
      aufgeloest,
      rezept,
      actor,
      /** Gearbeitete Tage (nur bei Rezepten in Tagen). */
      worked: Math.max(0, Number(karte['progress']) || 0),
      outcome: (typeof karte['outcome'] === 'string' ? karte['outcome'] : 'open') as OrderOutcome,
      started: typeof karte['started'] === 'string' ? karte['started'] : '',
      checks: orderChecks(karte),
    };
  }

  /** Was die Kreise eines Auftrags nach den Regeln der Kampagne bewirken (T-165). */
  function zaehlen(a: ReturnType<typeof auftrag>, rules: CraftRules) {
    const need = orderNeed(a.aufgeloest);
    return { need, tally: tallyChecks(a.checks, need, rules, need.unit === 'days' ? a.worked : 0) };
  }

  /** Die Kampagne, an der die Regeln stehen — für den Link „Campaign rules". */
  function regelSicht(kampagne: Entity | null) {
    const rules = craftRulesOf(kampagne);
    return { ...rules, sentences: craftRuleSentences(rules), campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null };
  }

  /** Die für diesen Auftrag reservierten Stücke, in allen Inventaren. */
  function reserviert(orderId: string, map: Map<string, Entity>): ReservedPiece[] {
    const raus: ReservedPiece[] = [];
    for (const e of map.values()) if (primaryInterface(e) === 'Inventory') raus.push(...reservedPieces(e, orderId));
    return raus;
  }

  async function istAuftrag(e: Entity | undefined): Promise<boolean> {
    if (!e) return false;
    return typeChain(await repo.getRegistry(), primaryInterface(e)).includes(ORDER_TYPE);
  }

  /** Der Auftrag mit allem, was die Seite zeigt. */
  function auftragsSicht(order: Entity, stand: Stand, user: User, kampagne: Entity | null) {
    const a = auftrag(order, stand.map);
    const { need, tally } = zaehlen(a, craftRulesOf(kampagne));
    const check = craftCheck(a.aufgeloest, { get: (id) => stand.map.get(id), campaign: kampagne, actor: a.actor });
    const namen = besitzer(stand.map);
    const bed = bedarf(a.aufgeloest, stand.map);
    const leitung = leitet(user, kampagne);
    const eigen = !!a.actor && (user.actorIds ?? []).includes(a.actor.id);
    const offen = a.outcome === 'open';
    const ertrag = (a.aufgeloest.relations ?? []).find((r) => r.type === 'yields');
    const stuecke = reserviert(order.id, stand.map);
    /* Was die Regel mit dem Material täte (T-165): angewandt wird beim Abschluss, gezeigt sofort. */
    const vorschau = offen && tally.settle
      ? settlePieces(stuecke, (_, p) => bestandteil(bed, p, stand.map)?.consumed ?? true, tally.settle)
      : [];
    const darf = offen && (leitung || eigen);
    return {
      id: order.id,
      name: entityName(order),
      actor: a.actor ? { id: a.actor.id, name: entityName(a.actor) } : null,
      recipe: a.rezept ? { id: a.rezept.id, name: entityName(a.rezept) } : null,
      progress: tally.progress,
      needed: need.needed,
      unit: need.unit,
      daysLeft: tally.daysLeft,
      outcome: a.outcome,
      /** Wie er beim Abschluss ausginge, solange er läuft. */
      result: offen ? tally.outcome : a.outcome,
      settle: offen ? tally.settle : null,
      started: a.started,
      circles: tally.circles.map((c) => ({
        index: c.index,
        mark: c.mark,
        pending: c.pending,
        ignored: c.ignored,
        open: c.open,
        ...(c.check ? { by: c.check.by ?? '', total: c.check.total, nat: c.check.nat, dc: c.check.dc } : {}),
      })),
      lines: tally.lines,
      waiting: tally.waiting,
      check: { tool: check.tool, ability: check.ability, dc: check.dc },
      yields: ertrag
        ? { id: ertrag.to, name: entityName(stand.map.get(ertrag.to)) || ertrag.to, count: Math.max(1, Number(a.aufgeloest.components?.[RECIPE_COMPONENT]?.['yieldCount']) || 1) }
        : null,
      reserved: stuecke.map((p) => {
        const v = vorschau.find((x) => x.piece.edge === p.edge);
        const b = bestandteil(bed, p, stand.map);
        return {
          ...p,
          name: entityName(stand.map.get(p.item)) || p.item,
          owner: namen.get(p.inventory)?.name ?? '',
          consumed: b?.consumed ?? true,
          /* Steht für einen anderen Bestandteil (Gruppe oder Ersatz, T-197): dessen Name. */
          ...(b && b.item !== baseArticle(stand.map, p.item) ? { for: b.name } : {}),
          /** Was beim Abschluss verloren ginge (verbraucht oder nach der Regel). */
          ...(v ? { lost: p.qty - v.keep } : {}),
        };
      }),
      sourceFailure: typeof a.aufgeloest.components?.[RECIPE_COMPONENT]?.['onFailure'] === 'string' ? String(a.aufgeloest.components[RECIPE_COMPONENT]['onFailure']) : '',
      may: {
        mark: darf,
        roll: darf && tally.outcome === 'open' && tally.circles.some((c) => c.open && !c.mark),
        work: darf && need.unit === 'days' && tally.daysLeft > 0 && tally.outcome === 'open',
        confirm: offen && tally.waiting > 0 && leitung,
        finish: darf && tally.outcome !== 'open',
        abort: darf,
        fail: offen && leitung,
      },
    };
  }

  /**
   * **Was an einem Rezept oder Auftrag zum Handwerk gehört.** Am Rezept:
   * die Regeln, wer es fertigen kann (eigene Figuren; die Leitung jede
   * Figur ihrer Gruppen), ob gelernt, und das freie Material je Figur in
   * ihren Inventaren und denen ihrer Gruppe; dazu die Aufträge darauf. Am
   * Auftrag: Fortschritt, Proben, Reserviertes und was jetzt geht.
   */
  app.get<{ Params: { id: string } }>('/api/crafting/:id', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roh1 = stand.map.get(request.params.id);
    const [e] = roh1 ? await sieve(request, [roh1], stand.map) : [];
    if (!e || !roh1) return reply.code(404).send({ error: 'Nicht gefunden' });
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const rules = regelSicht(kampagne);
    const leitung = leitet(user, kampagne);
    if (await istAuftrag(roh1)) {
      return { kind: 'order', rules, leitet: leitung, order: auftragsSicht(roh1, stand, user, kampagne) };
    }
    const kette = typeChain(registry, primaryInterface(roh1));
    /* Beruf, Werkzeug und Figur (T-196): was man womit fertigt. */
    if (kette.includes(TRADE_COMPONENT)) return { kind: 'trade', ...(await berufSicht(request, roh1, stand, registry)) };
    if (kette.includes('Item')) return await werkzeugSicht(request, roh1, stand, registry);
    if (kette.includes('Creature')) return { kind: 'actor', ...(await figurSicht(request, roh1, stand, registry, user, leitung)) };
    if (!kette.includes(RECIPE_COMPONENT)) {
      return reply.code(404).send({ error: 'Kein Rezept.' });
    }
    const bed = bedarf(roh1, stand.map);
    const need = orderNeed(roh1);
    /* Wer fertigen kann: die eigenen Figuren; die Leitung dazu jede Figur in einer Gruppe der Kampagne. */
    const ids = new Set(user.actorIds ?? []);
    if (leitung && kampagne) {
      const gruppen = new Set(
        stand.alle.filter((g) => (g.relations ?? []).some((r) => r.type === 'partyOf' && r.to === kampagne.id)).map((g) => g.id),
      );
      for (const f of stand.alle) if (partiesOf(f).some((p) => gruppen.has(p))) ids.add(f.id);
    }
    const figuren = await sieve(request, [...ids].map((i) => stand.map.get(i)).filter((x): x is Entity => !!x), stand.map);
    const namen = besitzer(stand.map);
    const items = new Set(bed.map((b) => b.item));
    const actors = figuren.map((f) => {
      const roheFigur = stand.map.get(f.id) ?? f;
      const stock = inventareVon(roheFigur, stand.map).flatMap((inv) =>
        (stand.map.get(inv)?.relations ?? [])
          /* Gezählt nach Grundartikel (T-150): der gekaufte Barren ist eine Instanz des Barrens. */
          .filter((r) => r.type === 'holds' && items.has(baseArticle(stand.map, r.to)) && !r.props?.['reservedFor'])
          .map((r) => ({
            item: baseArticle(stand.map, r.to),
            inventory: inv,
            owner: namen.get(inv)?.name ?? '',
            edge: r.id,
            qty: Math.max(1, Number(r.props?.['qty']) || 1),
          })),
      );
      const check = craftCheck(roh1, { get: (id) => stand.map.get(id), campaign: kampagne, actor: roheFigur });
      return {
        id: f.id,
        name: entityName(f),
        learned: recipeLearned(stand.map, roh1, (info) => knows(stand.map, info, roheFigur.id)),
        check: { tool: check.tool, ability: check.ability, dc: check.dc },
        stock,
      };
    });
    /* Die Aufträge auf dieses Rezept, die dieser Betrachter sieht. */
    const auftraege = stand.alle.filter((o) => (o.relations ?? []).some((r) => r.type === 'instanceOf' && r.to === roh1.id));
    const sichtbar = (await sieve(request, auftraege, stand.map)).filter((o) => primaryInterface(o) === ORDER_TYPE);
    const orders = sichtbar.map((o) => {
      const a = auftrag(stand.map.get(o.id) ?? o, stand.map);
      const { tally } = zaehlen(a, rules);
      return { id: o.id, name: entityName(o), actor: a.actor ? entityName(a.actor) : '', progress: tally.progress, outcome: a.outcome };
    });
    const ertrag = (roh1.relations ?? []).find((r) => r.type === 'yields');
    return {
      kind: 'recipe',
      rules,
      leitet: leitung,
      recipe: {
        id: roh1.id,
        name: entityName(roh1),
        unit: need.unit,
        needed: need.needed,
        sourceFailure: typeof roh1.components?.[RECIPE_COMPONENT]?.['onFailure'] === 'string' ? String(roh1.components[RECIPE_COMPONENT]['onFailure']) : '',
        yields: ertrag ? { id: ertrag.to, name: entityName(stand.map.get(ertrag.to)) || ertrag.to } : null,
      },
      needs: bed,
      actors,
      orders,
    };
  });

  // ---------------------------------------------------------- Übersicht (T-196)

  type Registry = Awaited<ReturnType<Repository['getRegistry']>>;

  /** Rezepte und Berufe im Bestand, roh — ohne Aufträge und Instanzen. */
  function handwerksArtikel(stand: Stand, registry: Registry) {
    const rezepte: Entity[] = [];
    const berufe: Entity[] = [];
    for (const e of stand.alle) {
      const kette = typeChain(registry, primaryInterface(e));
      if (kette.includes(TRADE_COMPONENT)) berufe.push(e);
      else if (kette.includes(RECIPE_COMPONENT) && !kette.includes(ORDER_TYPE) && !(e.relations ?? []).some((r) => r.type === 'instanceOf')) {
        rezepte.push(e);
      }
    }
    return { rezepte, berufe };
  }

  /**
   * **Die Zeilen einer Rezeptliste** — gebaut aus dem **Gesiebten**: was
   * eine Information zurückhält (Beruf, SG, Material eines unbekannten
   * Rezepts), steht hier nicht, und Material oder Ertrag, die dieser
   * Betrachter nicht sieht, fehlen ganz. `learned` rechnet die Figur am
   * Rohbestand — ob sie es kann, ist ihr Wissen, nicht das des Betrachters.
   */
  async function rezeptZeilen(
    request: FastifyRequest,
    rezepte: Entity[],
    berufe: Entity[],
    stand: Stand,
    gelernt?: (rezept: Entity) => boolean,
  ) {
    const ziele = new Set<string>();
    for (const r of rezepte) for (const k of r.relations ?? []) if (k.type === 'needs' || k.type === 'yields') ziele.add(k.to);
    const sichtbar = new Map(
      (await sieve(request, [...ziele].map((i) => stand.map.get(i)).filter((x): x is Entity => !!x), stand.map)).map((e) => [e.id, e]),
    );
    const name = (id: string) => entityName(sichtbar.get(id));
    return rezepte
      .map((r) => {
        const karte = r.components?.[RECIPE_COMPONENT] ?? {};
        const ertrag = (r.relations ?? []).find((k) => k.type === 'yields' && sichtbar.has(k.to));
        const beruf = tradeOfRecipe(berufe, r);
        const zahlOder = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        const roh_ = stand.map.get(r.id);
        return {
          id: r.id,
          name: entityName(r),
          trade: recipeTrade(r),
          ...(beruf ? { tradeId: beruf.id } : {}),
          tools: recipeTools(r, berufe),
          ability: typeof karte['ability'] === 'string' ? karte['ability'] : '',
          dc: zahlOder(karte['dc']),
          time: typeof karte['time'] === 'string' ? karte['time'] : '',
          days: zahlOder(karte['days']),
          checks: zahlOder(karte['checks']),
          yields: ertrag
            ? { id: ertrag.to, name: name(ertrag.to) || ertrag.to, rarity: String(sichtbar.get(ertrag.to)?.components?.['Item']?.['rarity'] ?? '') }
            : null,
          needs: (r.relations ?? [])
            .filter((k) => k.type === 'needs' && sichtbar.has(k.to))
            .map((k) => ({ item: k.to, name: name(k.to) || k.to, qty: Math.max(1, Number(k.props?.['qty']) || 1) })),
          ...(gelernt && roh_ ? { learned: gelernt(roh_) } : {}),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Werkzeuge beim Namen, mit Id, wo dieser Betrachter einen Artikel dazu sieht. */
  async function werkzeugVerweise(request: FastifyRequest, namen: string[], stand: Stand, registry: Registry) {
    const gesucht = new Set(namen.map((n) => n.toLowerCase()));
    const treffer = stand.alle.filter(
      (e) => gesucht.has(entityName(e).toLowerCase()) && typeChain(registry, primaryInterface(e)).includes('Item'),
    );
    const sichtbar = await sieve(request, treffer, stand.map);
    return namen.map((n) => {
      const t = sichtbar.find((e) => entityName(e).toLowerCase() === n.toLowerCase());
      return { name: n, ...(t ? { id: t.id } : {}) };
    });
  }

  /** **Ein Beruf:** seine Werkzeuge, seine Rezepte und was sie an Material brauchen. */
  async function berufSicht(request: FastifyRequest, beruf: Entity, stand: Stand, registry: Registry) {
    const { rezepte, berufe } = handwerksArtikel(stand, registry);
    const gesiebt = await sieve(request, recipesOfTrade(rezepte, beruf), stand.map);
    const zeilen = await rezeptZeilen(request, recipesOfTrade(gesiebt, beruf), berufe, stand);
    /* Das Material aus dem, was die Zeilen zeigen — nicht aus dem Rohbestand. */
    const namen = new Map(zeilen.flatMap((z) => z.needs.map((n) => [n.item, n.name] as const)));
    const materials = materialsOf(gesiebt)
      .filter((m) => namen.has(m.item))
      .map((m) => ({ ...m, name: namen.get(m.item) ?? m.item }));
    return {
      trade: { id: beruf.id, name: entityName(beruf), tools: await werkzeugVerweise(request, tradeTools(beruf), stand, registry) },
      recipes: zeilen,
      materials,
    };
  }

  /**
   * **Ein Werkzeug:** seine Berufe und die Rezepte, die es möglich macht.
   * An jedem anderen Gegenstand `none` — und zwar bevor gesiebt wird: wenn
   * kein Rezept und kein Beruf den Namen nennt, ist nichts zu zeigen.
   */
  async function werkzeugSicht(request: FastifyRequest, werkzeug: Entity, stand: Stand, registry: Registry) {
    const name = entityName(werkzeug);
    const { rezepte, berufe } = handwerksArtikel(stand, registry);
    const roheRezepte = recipesOfTool(rezepte, berufe, name);
    if (!roheRezepte.length && !tradesOfTool(berufe, name).length) return { kind: 'none' as const };
    /* Gerechnet über die Berufe, die er sieht — ein verborgener Beruf
       verrät sich nicht über seine Rezepte. */
    const sichtbareBerufe = await sieve(request, berufe, stand.map);
    const gesiebt = await sieve(request, roheRezepte, stand.map);
    return {
      kind: 'tool' as const,
      tool: { id: werkzeug.id, name },
      trades: tradesOfTool(sichtbareBerufe, name).map((b) => ({ id: b.id, name: entityName(b) })),
      recipes: await rezeptZeilen(request, recipesOfTool(gesiebt, sichtbareBerufe, name), sichtbareBerufe, stand),
    };
  }

  /**
   * **Eine Figur:** je Werkzeug, in dem ihr Statblock geübt ist
   * (`Proficiencies.proficient`, `expertise`), die Rezepte, die es möglich
   * macht — und ob sie sie gelernt hat (REQ-218). Gelernt zeigt sich nur
   * der Leitung und dem, der die Figur führt.
   */
  async function figurSicht(request: FastifyRequest, figur: Entity, stand: Stand, registry: Registry, user: User, leitung: boolean) {
    const block = stand.alle.find((e) => (e.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === figur.id));
    const [gesiebterBlock] = block ? await sieve(request, [block], stand.map) : [];
    const karte = gesiebterBlock?.components?.['Proficiencies'] ?? {};
    const geuebt = [...new Set([karte['proficient'], karte['expertise']].flatMap((v) => (Array.isArray(v) ? v.map(String) : [])))];
    const { rezepte, berufe } = handwerksArtikel(stand, registry);
    const sichtbareBerufe = await sieve(request, berufe, stand.map);
    const gesiebt = await sieve(request, rezepte, stand.map);
    const darf = leitung || (user.actorIds ?? []).includes(figur.id);
    const gelernt = darf ? (r: Entity) => recipeLearned(stand.map, r, (info) => knows(stand.map, info, figur.id)) : undefined;
    const tools = [];
    for (const w of geuebt) {
      const liste = recipesOfTool(gesiebt, sichtbareBerufe, w);
      if (!liste.length && !tradesOfTool(sichtbareBerufe, w).length) continue;
      const [verweis] = await werkzeugVerweise(request, [w], stand, registry);
      tools.push({
        ...verweis!,
        trades: tradesOfTool(sichtbareBerufe, w).map((b) => ({ id: b.id, name: entityName(b) })),
        recipes: await rezeptZeilen(request, liste, sichtbareBerufe, stand, gelernt),
      });
    }
    return { actor: { id: figur.id, name: entityName(figur) }, statblock: !!gesiebterBlock, tools };
  }

  /** Schreiben, oder mit den Gründen abweisen. */
  async function schreib(e: Entity): Promise<string | null> {
    const r = await schreibeGeprueft(e);
    return 'issues' in r ? r.issues.map((i) => i.message).join('; ') : null;
  }

  /**
   * **Die Materialwahl** (T-197): je Bestandteil des Rezepts die freien
   * Stücke in den Inventaren der Figur und ihrer Gruppe, die passen — der
   * genannte Gegenstand, ein Stück der Gruppe, ein Ersatz nach einer Regel
   * der Kampagne (`materialFit`) —, und die naheliegenden, die nicht
   * passen, mit dem Grund. Naheliegend heisst: dieselbe Materialart (ein
   * Reagenz anderer Seltenheit) oder eine, die nach einer Regel der
   * Kampagne einspringen dürfte; bei einer Gruppe ohne Materialart jedes
   * Material. Was der Betrachter nicht sieht, steht nicht da.
   */
  async function materialWahl(request: FastifyRequest, rezept: Entity, actor: Entity, stand: Stand, kampagne: Entity | null) {
    const registry = await repo.getRegistry();
    const ctx = await passKontext(kampagne, stand.map);
    const bed = bedarf(rezept, stand.map);
    const namen = besitzer(stand.map);
    const istMaterial = (e: Entity) => typeChain(registry, primaryInterface(e)).includes('Material');
    const frei = inventareVon(actor, stand.map).flatMap((inv) =>
      (stand.map.get(inv)?.relations ?? [])
        .filter((r) => r.type === 'holds' && !r.props?.['reservedFor'])
        .map((r) => ({ inventory: inv, owner: namen.get(inv)?.name ?? '', edge: r.id, item: baseArticle(stand.map, r.to), qty: Math.max(1, Number(r.props?.['qty']) || 1) })),
    );
    const grund = new Map<string, Entity>();
    for (const f of frei) {
      const e = stand.map.get(f.item);
      if (e) grund.set(e.id, e);
    }
    const sichtbar = new Map((await sieve(request, [...grund.values()], stand.map)).map((e) => [e.id, e]));
    return {
      needs: bed.map((b) => {
        const ziel = stand.map.get(b.item);
        const options: (typeof frei[number] & { name: string; ratio: number; via?: { id: string; name: string } })[] = [];
        const rejected: (typeof frei[number] & { name: string; reason: string })[] = [];
        if (ziel) {
          const original = materialProfile(ziel);
          const arten = b.group ? materialGroupOf(ziel).materialTypes : [original.materialType];
          /* Naheliegend: dieselbe Materialart oder eine, die nach einer Regel einspringen dürfte. */
          const nahe = new Set(arten.filter(Boolean));
          for (const r of ctx.substitutions) if (r.replaces.some((t) => arten.includes(t))) for (const t of r.with) nahe.add(t);
          const marken = ctx.substitutions.filter((r) => r.replaces.some((t) => arten.includes(t))).flatMap((r) => r.withTags);
          for (const f of frei) {
            const e = sichtbar.get(f.item);
            if (!e) continue;
            const fit = materialFit(ziel, e, ctx, b.group);
            if (fit.ok) {
              options.push({ ...f, name: entityName(e), ratio: fit.ratio, ...(fit.via ? { via: fit.via } : {}) });
              continue;
            }
            const p = materialProfile(e);
            const nah = (b.group && !arten.length) ? istMaterial(e) : nahe.has(p.materialType) || marken.some((t) => p.tags.includes(t));
            if (nah) rejected.push({ ...f, name: entityName(e), reason: fit.reason });
          }
        }
        return { ...b, options, rejected };
      }),
      substitutions: ctx.substitutions.map((s) => ({ id: s.id, name: s.name, does: substitutionText(s) })),
    };
  }

  /** Darf dieser Betrachter für diese Figur fertigen? Die eigene; die Leitung jede. */
  function fuerFigur(user: User, actor: Entity, leitung: boolean): boolean {
    return leitung || (user.actorIds ?? []).includes(actor.id);
  }

  /**
   * **Die Materialwahl beim Start** (T-197): `GET /api/crafting/:id/materials?actor=`.
   * Erst „Start crafting" fragt, welche Stücke genommen werden — vorher ist
   * nichts gewählt und nichts reserviert.
   */
  app.get<{ Params: { id: string }; Querystring: { actor?: string } }>('/api/crafting/:id/materials', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const stand = await roh();
    const registry = await repo.getRegistry();
    const rezept = stand.map.get(request.params.id);
    const [sichtbar] = rezept ? await sieve(request, [rezept], stand.map) : [];
    if (!rezept || !sichtbar || !typeChain(registry, primaryInterface(rezept)).includes(RECIPE_COMPONENT) || (await istAuftrag(rezept))) {
      return reply.code(404).send({ error: 'Kein Rezept.' });
    }
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const actor = stand.map.get(String(request.query.actor ?? ''));
    if (!actor) return reply.code(404).send({ error: 'Diese Figur gibt es nicht.' });
    if (!fuerFigur(user, actor, leitet(user, kampagne))) return reply.code(403).send({ error: 'Nur für die eigene Figur.' });
    return { actor: { id: actor.id, name: entityName(actor) }, ...(await materialWahl(request, rezept, actor, stand, kampagne)) };
  });

  /**
   * **Einen Auftrag starten** (T-128): `recipe`, `actor`, `materials` als
   * `{ inventory, edge, qty, need? }` — `need` ist die `needs`-Kante, für
   * die das Stück steht (T-197; ohne: die, deren Gegenstand es ist). Jedes
   * Stück muss zu seinem Bestandteil passen (`materialFit`), ein Ersatz
   * zählt nach seiner Regel (`coverage`). Spielende starten für ihre Figur und nur
   * gelernte Rezepte (REQ-218), mit allem Material, das verbraucht wird;
   * die Leitung startet für jede Figur und auch mit Lücken (D55).
   */
  app.post<{ Body: { recipe?: unknown; actor?: unknown; materials?: unknown } | null }>('/api/crafting', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const stand = await roh();
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const leitung = leitet(user, kampagne);
    const rezept = stand.map.get(String(request.body?.recipe ?? ''));
    const [sichtbar] = rezept ? await sieve(request, [rezept], stand.map) : [];
    if (!rezept || !sichtbar || !typeChain(registry, primaryInterface(rezept)).includes(RECIPE_COMPONENT) || (await istAuftrag(rezept))) {
      return reply.code(404).send({ error: 'Kein Rezept.' });
    }
    const actor = stand.map.get(String(request.body?.actor ?? ''));
    if (!actor) return reply.code(404).send({ error: 'Diese Figur gibt es nicht.' });
    if (!fuerFigur(user, actor, leitung)) return reply.code(403).send({ error: 'Nur für die eigene Figur.' });
    if (!leitung && !recipeLearned(stand.map, rezept, (info) => knows(stand.map, info, actor.id))) {
      return reply.code(403).send({ error: 'Dieses Rezept hat die Figur noch nicht gelernt.' });
    }

    const roh2 = Array.isArray(request.body?.materials) ? (request.body.materials as unknown[]) : [];
    const wahl = roh2
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({
        inventory: String(m['inventory'] ?? ''),
        edge: String(m['edge'] ?? ''),
        qty: Math.trunc(Number(m['qty']) || 0),
        need: typeof m['need'] === 'string' ? m['need'] : '',
      }))
      .filter((m) => m.qty > 0);
    const erlaubt = new Set(inventareVon(actor, stand.map));
    const bed = bedarf(rezept, stand.map);
    const ctx = await passKontext(kampagne, stand.map);
    /* Je Stück: für welchen Bestandteil, und wie viele ein Original ersetzen (T-197). */
    const geprueft: { m: (typeof wahl)[number]; need: string; ratio: number }[] = [];
    for (const m of wahl) {
      if (!erlaubt.has(m.inventory)) return reply.code(403).send({ error: 'Material nur aus dem Inventar der Figur und ihrer Gruppe.' });
      const kante = (stand.map.get(m.inventory)?.relations ?? []).find((r) => r.id === m.edge && r.type === 'holds');
      const stueck = kante ? stand.map.get(baseArticle(stand.map, kante.to)) : undefined;
      if (!kante || !stueck) return reply.code(409).send({ error: 'Das Stück ist weg — neu laden.' });
      /* Ohne genannten Bestandteil: der, dessen Gegenstand es ist (wie vor T-197). */
      const b = m.need ? bed.find((x) => x.key === m.need) : bed.find((x) => x.item === stueck.id);
      if (!b) return reply.code(422).send({ error: 'Das braucht dieses Rezept nicht.' });
      const ziel = stand.map.get(b.item);
      const fit = ziel ? materialFit(ziel, stueck, ctx, b.group) : ({ ok: false, reason: 'the recipe’s material is missing' } as const);
      if (!fit.ok) return reply.code(422).send({ error: `${entityName(stueck)} passt nicht zu ${b.name}: ${fit.reason}.` });
      geprueft.push({ m, need: b.key, ratio: fit.ratio });
    }
    const deckung = coverage(bed, geprueft.map((g) => ({ need: g.need, qty: g.m.qty, ratio: g.ratio })));
    const fehlt = bed.filter((b) => b.consumed && (deckung.find((d) => d.key === b.key)?.short ?? 0) > 0);
    if (fehlt.length && !leitung) {
      return reply.code(422).send({ error: `Es fehlt: ${fehlt.map((b) => `${+(deckung.find((d) => d.key === b.key)?.short ?? 0).toFixed(2)} × ${b.name}`).join(', ')}.` });
    }
    const zuViel = bed.find((b) => deckung.find((d) => d.key === b.key)?.over);
    if (zuViel) return reply.code(422).send({ error: `Mehr ${zuViel.name} als das Rezept braucht.` });

    const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    let id = neueId();
    while (stand.map.has(id)) id = neueId();

    /* Zuerst reservieren (im Speicher): sagt ein Stück nein, ist noch nichts geschrieben. */
    const inventare = new Map<string, Entity>();
    for (const { m, need } of geprueft) {
      const inv = inventare.get(m.inventory) ?? stand.map.get(m.inventory);
      if (!inv) return reply.code(404).send({ error: 'Dieses Inventar gibt es nicht.' });
      const r = reserveIn(inv, m.edge, m.qty, id, neueKante(inv.id, 'holds'), need);
      if ('refused' in r) {
        const warum = { missing: 'Das Stück ist weg — neu laden.', reserved: 'Das Stück ist schon reserviert.', short: 'So viele liegen dort nicht.' };
        return reply.code(409).send({ error: warum[r.refused] });
      }
      inventare.set(inv.id, r.inventory);
    }

    const name = `${entityName(rezept)} (${entityName(actor)})`;
    const ebene = await kampagnenEbene(stand.map, kampagne);
    const order: Entity = {
      id,
      interfaces: [ORDER_TYPE],
      name,
      components: {
        Identity: { name, id: nextId(stand.alle, ORDER_TYPE) },
        [ORDER_COMPONENT]: { progress: 0, outcome: 'open', started: new Date().toISOString().slice(0, 10), checks: [] },
        /* Ein Auftrag ist ein Stand am Tisch, keine Vorbereitung. */
        [STATUS_COMPONENT]: { status: 'ready' },
      },
      relations: [
        { id: `${id}~instanceOf`, type: 'instanceOf', to: rezept.id, props: {} },
        ...(ebene ? [{ id: `${id}~inLayer`, type: 'inLayer', to: ebene.id, props: {} }] : []),
      ],
    };
    const fehler = await schreib(order);
    if (fehler) return reply.code(422).send({ error: fehler });
    if (!user.isAdmin && !leitung) await repo.addAuthored(user.id, id);
    for (const inv of inventare.values()) {
      const f = await schreib(inv);
      if (f) return reply.code(422).send({ error: f });
    }
    const f2 = await schreib({
      ...actor,
      relations: [...(actor.relations ?? []), { id: neueKante(actor.id, CRAFTING_RELATION), type: CRAFTING_RELATION, to: id, props: {} }],
    });
    if (f2) return reply.code(422).send({ error: f2 });
    await repo.appendEvent('crafting.started', id, { recipe: rezept.id, actor: actor.id, materials: wahl, by: user.id });
    return { id };
  });

  /**
   * **Abrechnen** (T-128): das reservierte Material nach `how` — bei Erfolg
   * verbraucht (was nicht verbraucht wird, kommt zurück) und der Ertrag ins
   * Inventar der Figur (sonst ihrer Gruppe); beim Abbruch alles zurück;
   * beim Misserfolg nach der Regel.
   */
  async function abrechnen(order: Entity, map: Map<string, Entity>, how: 'success' | Return, kampagne: Entity | null): Promise<string | null> {
    const a = auftrag(order, map);
    const bed = bedarf(a.aufgeloest, map);
    const stuecke = reserviert(order.id, map);
    const ergebnis = settlePieces(stuecke, (_, p) => bestandteil(bed, p, map)?.consumed ?? true, how);
    const jeInventar = new Map<string, Map<string, number>>();
    for (const { piece, keep } of ergebnis) {
      const m = jeInventar.get(piece.inventory) ?? new Map<string, number>();
      m.set(piece.edge, keep);
      jeInventar.set(piece.inventory, m);
    }
    const neu = new Map<string, Entity>();
    const werkstatt = stueckWerkstatt(
      { repo, schreibeGeprueft: (e) => schreibeGeprueft(e), kampagnenEbene },
      { alle: [...map.values()], map },
      kampagne,
    );
    for (const [inv, keep] of jeInventar) {
      const e = map.get(inv);
      if (e) neu.set(inv, applySettlement(e, keep));
    }
    if (how === 'success' && a.actor) {
      const ertrag = (a.aufgeloest.relations ?? []).find((r) => r.type === 'yields');
      const anzahl = Math.max(1, Number(a.aufgeloest.components?.[RECIPE_COMPONENT]?.['yieldCount']) || 1);
      const ziel = carriesOf(a.actor) ?? partiesOf(a.actor).map((p) => carriesOf(map.get(p))).find((x) => !!x) ?? null;
      const inv = ziel ? (neu.get(ziel) ?? map.get(ziel)) : undefined;
      /* Der Ertrag entsteht als Instanz (T-150), wie ein gekauftes Stück. */
      if (ertrag && inv) {
        const r = await werkstatt.geben(inv, ertrag.to, anzahl);
        if ('issues' in r) return r.issues.map((i) => i.message).join('; ');
        neu.set(inv.id, r.inventory);
      }
    }
    for (const inv of neu.values()) {
      const f = await schreib(inv);
      if (f) {
        await werkstatt.zuruecknehmen();
        return f;
      }
    }
    await repo.appendEvent('crafting.settled', order.id, { how, pieces: ergebnis.map((x) => ({ item: x.piece.item, qty: x.piece.qty, keep: x.keep })) });
    return null;
  }

  /** Den Auftrag mit neuer Karte schreiben (nur die eigene Karte ändert sich). */
  async function setzeAuftrag(order: Entity, karte: Record<string, unknown>): Promise<string | null> {
    return schreib({ ...order, components: { ...(order.components ?? {}), [ORDER_COMPONENT]: { ...(order.components?.[ORDER_COMPONENT] ?? {}), ...karte } } });
  }

  /** Für die Aktionen: der Auftrag, wer fragt, ob er leitet oder fertigt. */
  async function vorbereiten(request: FastifyRequest<{ Params: { id: string } }>) {
    const user = await viewerOf(request);
    if (!user) return { ok: false, code: 401, error: 'Nicht angemeldet' } as const;
    const stand = await roh();
    const registry = await repo.getRegistry();
    const order = stand.map.get(request.params.id);
    const [sichtbar] = order ? await sieve(request, [order], stand.map) : [];
    if (!order || !sichtbar || !(await istAuftrag(order))) return { ok: false, code: 404, error: 'Kein Auftrag.' } as const;
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const a = auftrag(order, stand.map);
    const leitung = leitet(user, kampagne);
    const eigen = !!a.actor && (user.actorIds ?? []).includes(a.actor.id);
    if (!leitung && !eigen) return { ok: false, code: 403, error: 'Das ist nicht dein Auftrag.' } as const;
    if (a.outcome !== 'open') return { ok: false, code: 409, error: 'Dieser Auftrag ist abgeschlossen.' } as const;
    return { ok: true, user, stand, order, kampagne, a, leitung, rules: craftRulesOf(kampagne) } as const;
  }

  /**
   * **Einen Kreis setzen** (T-165) und zurückgeben, was jetzt gilt. Wer
   * nicht leitet, setzt unter `craftConfirm: 'gm'` einen wartenden Kreis.
   * Gesetzt werden darf jeder Kreis, den die Seite zeigt, auch einer, der
   * nach dem Ende nicht mehr zählt (zum Leeren).
   */
  async function setzeKreis(
    v: Extract<Awaited<ReturnType<typeof vorbereiten>>, { ok: true }>,
    index: number,
    wert: Omit<OrderCheck, 'by' | 'at' | 'pending'> | null,
  ): Promise<{ error: string; code: number } | { tally: ReturnType<typeof tallyChecks> }> {
    const { tally } = zaehlen(v.a, v.rules);
    const kreis = tally.circles[index];
    if (!kreis) return { code: 409, error: 'Diesen Kreis gibt es nicht (mehr) — neu laden.' };
    if (wert && !kreis.open) return { code: 409, error: 'Erst die Tage arbeiten.' };
    const eintrag: OrderCheck | null = wert
      ? { ...wert, by: v.user.name, at: new Date().toISOString(), ...(!v.leitung && v.rules.confirm === 'gm' ? { pending: true } : {}) }
      : null;
    const checks = setCheck(v.a.checks, index, eintrag);
    const f = await setzeAuftrag(v.order, { checks });
    if (f) return { code: 422, error: f };
    const nach = zaehlen({ ...v.a, checks }, v.rules).tally;
    await repo.appendEvent('crafting.check', v.order.id, { index, mark: eintrag?.mark ?? null, pending: !!eintrag?.pending, by: v.user.id });
    return { tally: nach };
  }

  /**
   * **Ein Kreis per Klick** (T-165): `mark` ist `success`, `failure` oder
   * `null` (leer). Die Oberfläche rechnet den Zyklus (`nextMark`) und
   * schickt den Zielstand — zwei schnelle Klicks sind so zwei Stände und
   * nicht zweimal „weiter".
   */
  app.put<{ Params: { id: string; index: string }; Body: { mark?: unknown } | null }>('/api/crafting/:id/checks/:index', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const index = Number(request.params.index);
    if (!Number.isInteger(index) || index < 0) return reply.code(400).send({ error: 'Kein Kreis.' });
    const m = request.body?.mark ?? null;
    if (m !== null && m !== 'success' && m !== 'failure') return reply.code(400).send({ error: 'Ein Kreis ist leer, ✓ oder ✗.' });
    const r = await setzeKreis(v, index, m ? { mark: m as RollResult } : null);
    if ('error' in r) return reply.code(r.code).send({ error: r.error });
    return { outcome: r.tally.outcome, progress: r.tally.progress };
  });

  /**
   * **Eine Probe würfeln** (`total`, `nat` für die natürliche 20 oder 1):
   * setzt den ersten freien Kreis, mit Summe und SG daran. Wartet unter
   * `craftConfirm: 'gm'` auf die Leitung wie ein Klick.
   */
  app.post<{ Params: { id: string }; Body: { total?: unknown; nat?: unknown } | null }>('/api/crafting/:id/roll', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const total = Number(request.body?.total);
    if (!Number.isFinite(total)) return reply.code(400).send({ error: 'Das Ergebnis der Probe fehlt.' });
    const natRoh = Number(request.body?.nat);
    const nat = natRoh === 1 || natRoh === 20 ? natRoh : undefined;
    const { tally } = zaehlen(v.a, v.rules);
    if (tally.outcome !== 'open') return reply.code(409).send({ error: 'Der Auftrag ist entschieden — abschliessen.' });
    const frei = tally.circles.find((c) => !c.mark && c.open);
    if (!frei) return reply.code(409).send({ error: need0(tally) });
    const dc = craftCheck(v.a.aufgeloest, { get: (id) => v.stand.map.get(id), campaign: v.kampagne, actor: v.a.actor }).dc;
    const result = rollResult(total, dc, nat);
    const r = await setzeKreis(v, frei.index, { mark: result, total, ...(nat ? { nat } : {}), dc });
    if ('error' in r) return reply.code(r.code).send({ error: r.error });
    /* Die Probe steht auch im Log des Auftrags (T-172) — am Tisch
       gewürfelt und eingetragen (`entered`), nicht hier. */
    await deps.wurf?.(v.order, {
      expr: String(total),
      total,
      rolls: [{ flat: total }],
      modifier: 0,
      ...(nat ? { nat, crit: nat === 20 ? 'crit' : 'fumble' } : {}),
      label: `Crafting check${dc !== undefined ? ` vs DC ${dc}` : ''}`,
      by: { id: v.user.id, name: v.user.name },
      ...(v.a.actor ? { actor: { id: v.a.actor.id, name: entityName(v.a.actor) } } : {}),
      campaign: v.kampagne?.id ?? null,
      session: null,
      entered: true,
    });
    return { pending: !v.leitung && v.rules.confirm === 'gm', result };
  });

  /** Warum kein Kreis frei ist. */
  function need0(t: ReturnType<typeof tallyChecks>): string {
    if (t.daysLeft > 0) return 'Erst die Tage arbeiten.';
    if (t.waiting > 0) return 'Eine Probe wartet noch auf die Leitung.';
    return 'Kein Kreis ist frei.';
  }

  /**
   * **Die Leitung nimmt die wartenden Kreise an** (`accept: true`) oder
   * verwirft sie (sie werden leer).
   */
  app.post<{ Params: { id: string }; Body: { accept?: unknown } | null }>('/api/crafting/:id/confirm', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    if (!v.leitung) return reply.code(403).send({ error: 'Proben bestätigt die Leitung.' });
    if (!v.a.checks.some((c) => c?.pending)) return reply.code(409).send({ error: 'Keine Probe wartet.' });
    const annehmen = request.body?.accept !== false;
    const checks = v.a.checks.map((c): OrderCheck | null => {
      if (!c?.pending) return c;
      if (!annehmen) return null;
      const { pending: _weg, ...rest } = c;
      return rest;
    });
    /* Verworfene am Ende fallen weg; die leeren Kreise stehen ohnehin da. */
    while (checks.length && checks[checks.length - 1] === null) checks.pop();
    const f = await setzeAuftrag(v.order, { checks });
    if (f) return reply.code(422).send({ error: f });
    await repo.appendEvent('crafting.confirmed', v.order.id, { accept: annehmen, by: v.user.id });
    return { ok: true };
  });

  /**
   * **Abschliessen** (T-165): wenn die Kreise den Auftrag entschieden
   * haben — bei Erfolg kommt der Ertrag ins Inventar, beim Misserfolg
   * wird das Material nach der Regel abgerechnet. Erst hier ist es
   * endgültig; bis dahin nimmt ein Zurückklicken alles zurück.
   */
  app.post<{ Params: { id: string } }>('/api/crafting/:id/finish', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const { tally } = zaehlen(v.a, v.rules);
    if (tally.outcome === 'open' || !tally.settle) return reply.code(409).send({ error: 'Der Auftrag läuft noch.' });
    const f = (await abrechnen(v.order, v.stand.map, tally.settle, v.kampagne)) ?? (await setzeAuftrag(v.order, { outcome: tally.outcome }));
    return f ? reply.code(422).send({ error: f }) : { ok: true, outcome: tally.outcome };
  });

  /** **Einen Arbeitstag** (oder mehrere) eintragen — nur, wo das Rezept in Tagen zählt. */
  app.post<{ Params: { id: string }; Body: { days?: unknown } | null }>('/api/crafting/:id/work', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const { need, tally } = zaehlen(v.a, v.rules);
    if (need.unit !== 'days') return reply.code(409).send({ error: 'Dieses Rezept zählt Proben, nicht Tage.' });
    if (tally.daysLeft <= 0) return reply.code(409).send({ error: 'Die Tage sind gearbeitet — jetzt die Probe.' });
    /* Gezählt werden die Tage insgesamt: ein Verlust des Fortschritts verlangt einen neuen Anlauf (`tallyChecks`). */
    const tage = Math.min(tally.daysLeft, Math.max(1, Math.trunc(Number(request.body?.days) || 1)));
    const f = await setzeAuftrag(v.order, { progress: v.a.worked + tage });
    return f ? reply.code(422).send({ error: f }) : { ok: true };
  });

  /** **Abbrechen:** alles Reservierte kommt zurück. */
  app.post<{ Params: { id: string } }>('/api/crafting/:id/abort', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const f = (await abrechnen(v.order, v.stand.map, 'all', v.kampagne)) ?? (await setzeAuftrag(v.order, { outcome: 'aborted' }));
    return f ? reply.code(422).send({ error: f }) : { ok: true };
  });

  /**
   * **Die Leitung erklärt den Auftrag für misslungen** — für die Regel
   * `custom` und für alles, was am Tisch anders kam: `return` sagt, was
   * zurückkommt (`all`, `half`, `none`).
   */
  app.post<{ Params: { id: string }; Body: { return?: unknown } | null }>('/api/crafting/:id/fail', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    if (!v.leitung) return reply.code(403).send({ error: 'Das entscheidet die Leitung.' });
    const r = String(request.body?.return ?? 'none');
    const how: Return = r === 'all' || r === 'half' ? r : 'none';
    const f = (await abrechnen(v.order, v.stand.map, how, v.kampagne)) ?? (await setzeAuftrag(v.order, { outcome: 'failed' }));
    return f ? reply.code(422).send({ error: f }) : { ok: true };
  });
}
