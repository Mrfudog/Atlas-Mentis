/**
 * **Die Spalten einer Übersicht als Vorgabe der Kampagne** (T-343):
 * `GET /api/list-columns`, `PUT /api/list-columns` (`{ key, columns }`).
 *
 * Welche Spalten eine Tabelle zeigt, wählt jedes Konto selbst (gespeichert
 * in seinen Einstellungen, `listColumns.<seite>[.<Art>]`). Die Leitung
 * darf eine Wahl als **Vorgabe der Kampagne** setzen: sie gilt für jedes
 * Konto, das selbst nichts gewählt hat. Ohne beides zeigt eine Tabelle die
 * Felder der `overview` ihrer Art, wie immer.
 *
 * Gesiebt wird hier nichts: eine Wahl nennt Felder, keine Werte, und die
 * Liste dahinter (`/api/list?cols=`) siebt wie jede andere.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { cleanColumns, currentCampaign, tableRole, type Entity } from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

/** `world`, `compendium|Spell` — die Seite und, wenn gewählt, die Art. */
const SCHLUESSEL = /^[a-z][a-z0-9-]{0,31}(\|[A-Za-z][A-Za-z0-9_]{0,63})?$/;

export interface SpaltenDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<{ map: Map<string, Entity> }>;
}

export function registerSpaltenwahl(app: FastifyInstance, deps: SpaltenDeps): void {
  const { repo, viewerOf, roh } = deps;

  async function kampagne(): Promise<Entity | null> {
    const registry = await repo.getRegistry();
    return currentCampaign((await roh()).map, registry.settings ?? null);
  }

  /** Wie bei den Filtergruppen: die Leitung (`gm`, `co-gm`) und die Verwaltung. */
  function leitet(user: User, campaignId: string): boolean {
    if (user.isAdmin) return true;
    const rolle = tableRole({ roles: user.roles ?? {} }, campaignId);
    return rolle === 'gm' || rolle === 'co-gm';
  }

  app.get('/api/list-columns', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const k = await kampagne();
    return {
      campaign: k?.id ?? null,
      canManage: !!k && leitet(user, k.id),
      defaults: k ? await repo.listColumnDefaults(k.id) : {},
    };
  });

  app.put<{ Body: { key?: unknown; columns?: unknown } | null }>('/api/list-columns', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const key = String(request.body?.key ?? '');
    if (!SCHLUESSEL.test(key)) return reply.code(400).send({ error: 'Unbekannte Tabelle.' });
    const k = await kampagne();
    if (!k) return reply.code(409).send({ error: 'Es läuft keine Kampagne.' });
    if (!leitet(user, k.id)) return reply.code(403).send({ error: 'Die Vorgabe der Kampagne setzt die Leitung.' });
    const roh_ = request.body?.columns;
    const columns = roh_ === null || roh_ === undefined ? null : cleanColumns(roh_);
    if (roh_ !== null && roh_ !== undefined && !columns) return reply.code(400).send({ error: 'Spalten als Liste.' });
    await repo.putListColumnDefault(k.id, key, columns);
    return { ok: true, key, columns };
  });
}
