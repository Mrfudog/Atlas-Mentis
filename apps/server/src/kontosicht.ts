/**
 * **Kampagne und Globalfilter je Konto** — die Routen (REQ-408, REQ-412,
 * T-496). Die Rechnung steht in `@nw/model` (`kontosicht.ts`) und
 * `kampagnenwahl.ts`; hier wird gewählt, geprüft und gespeichert.
 *
 * - `PUT /api/me/campaign` `{ id }` — in welcher Kampagne ich gerade bin.
 *   Wählbar ist jede mit einer Rolle (`campaign_member`), für die
 *   Verwaltung jede; `null` nimmt die Wahl weg (die Vorgabe gilt). Das
 *   wirkt nur für dieses Konto.
 * - `GET /api/me/layer-view` — meine Sicht in dieser Kampagne: der Stapel
 *   der Kampagne (zum Engerfiltern) und die Ebenen, die ich lesen darf
 *   (für My view).
 * - `PUT /api/me/layer-view` `{ mode, off?, layers? }` — speichern;
 *   `DELETE` ist „Reset“: der Stapel der Kampagne gilt wieder.
 *
 * Den Stapel der Kampagne selbst ändert keine dieser Routen: das bleibt
 * `PUT /api/campaigns/:c/layers` mit seiner Rollenprüfung.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CAMPAIGN_PREF,
  CAMPAIGN_TYPE,
  LAYER_VIEW_PREF,
  campaignLayer,
  cleanLayerView,
  entityName,
  isDefaultView,
  isGroupLayer,
  isLayer,
  mayChooseCampaign,
  resolvedStack,
  type Entity,
  type LayerView,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { currentCampaign, ladeWahl, merkeWahl } from './kampagnenwahl.js';

export interface KontosichtDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  /** Der ganze Bestand dieses Stands. */
  bestand: () => Promise<Map<string, Entity>>;
  /** Das Sieb der Anfrage — welche Ebenen dieser Betrachter überhaupt sieht. */
  sieve: (request: FastifyRequest, entities: Entity[], bestand: Map<string, Entity>) => Promise<Entity[]>;
}

function nein(reply: FastifyReply, code: number, error: string) {
  return reply.code(code).send({ error });
}

const istKampagne = (e: Entity | undefined): e is Entity => !!e && (e.interfaces ?? [])[0] === CAMPAIGN_TYPE;

export function registerKontosicht(app: FastifyInstance, deps: KontosichtDeps): void {
  const { repo, viewerOf, bestand, sieve } = deps;

  /** Die rohe Kampagne dieses Betrachters (ohne seine Sicht) — aus dem Bestand, nicht aus `currentCampaign`. */
  async function roheKampagne(): Promise<{ alle: Map<string, Entity>; kampagne: Entity | null }> {
    const alle = await bestand();
    const gelesen = currentCampaign(alle, (await repo.getRegistry()).settings ?? null);
    return { alle, kampagne: gelesen ? (alle.get(gelesen.id) ?? null) : null };
  }

  /** Was die Oberfläche für den Globalfilter braucht. */
  async function zustand(request: FastifyRequest, user: User) {
    const { alle, kampagne } = await roheKampagne();
    if (!kampagne) return { campaign: null, mode: 'campaign' as const, off: [], layers: [], fixed: null, stack: [], available: [] };
    const wahl = await ladeWahl(repo, user.id);
    const sicht: LayerView = wahl.views[kampagne.id] ?? { mode: 'campaign', off: [], layers: [] };
    const fest = campaignLayer(alle, kampagne)?.id ?? null;
    const stapel = resolvedStack(alle, kampagne);
    const imStapel = new Set(stapel.map((l) => l.id));
    /* Lesbar ist, was das Sieb diesem Betrachter von den Ebenen selbst lässt. */
    const ebenen = [...alle.values()].filter((e) => isLayer(e) && !istKampagne(e));
    const lesbar = await sieve(request, ebenen, alle);
    const eintrag = (l: Entity) => ({ id: l.id, name: entityName(l) || l.id, group: isGroupLayer(l), inCampaign: imStapel.has(l.id) });
    return {
      campaign: { id: kampagne.id, name: entityName(kampagne) },
      mode: sicht.mode,
      off: sicht.off,
      layers: sicht.layers,
      /** Die Ebene der Kampagne: sie bleibt in jeder Sicht an. */
      fixed: fest,
      /** Der Stapel der Kampagne, von oben nach unten — darin filtert Campaign view. */
      stack: [...stapel].reverse().map(eintrag),
      /** Was My view zur Wahl hat: jede lesbare Ebene, die im Stapel zuerst. */
      available: lesbar
        .map(eintrag)
        .sort((a, b) => Number(b.inCampaign) - Number(a.inCampaign) || Number(b.group) - Number(a.group) || a.name.localeCompare(b.name, 'de')),
    };
  }

  app.put<{ Body: { id?: unknown } | null }>('/api/me/campaign', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Sign in first.');
    const id = request.body?.id ?? null;
    if (id !== null && typeof id !== 'string') return nein(reply, 400, 'id: a campaign id, or null for the default.');
    if (id !== null) {
      if (!istKampagne(await repo.getEntity(id))) return nein(reply, 404, 'There is no such campaign. Pick one from the list.');
      if (!mayChooseCampaign(user, id)) {
        return nein(reply, 403, 'You have no role in this campaign. Ask its GM to add you on the campaign page.');
      }
    }
    await repo.putPref(user.id, CAMPAIGN_PREF, id);
    const wahl = await ladeWahl(repo, user.id);
    merkeWahl(user.id, { ...wahl, campaign: id });
    await repo.appendEvent('campaign.chosen', user.id, { campaign: id });
    return { ok: true, campaign: id };
  });

  app.get('/api/me/layer-view', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Sign in first.');
    return zustand(request, user);
  });

  async function speichern(user: User, kampagneId: string, sicht: LayerView | null): Promise<void> {
    const wahl = await ladeWahl(repo, user.id);
    const views = { ...wahl.views };
    if (!sicht || isDefaultView(sicht)) delete views[kampagneId];
    else views[kampagneId] = sicht;
    await repo.putPref(user.id, LAYER_VIEW_PREF, Object.keys(views).length ? views : null);
    merkeWahl(user.id, { ...wahl, views });
  }

  app.put<{ Body: unknown }>('/api/me/layer-view', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Sign in first.');
    const sicht = cleanLayerView(request.body);
    if (!sicht) return nein(reply, 400, 'mode: "campaign" or "mine"; off and layers: lists of layer ids.');
    const { alle, kampagne } = await roheKampagne();
    if (!kampagne) return nein(reply, 409, 'You are in no campaign yet. Pick one first.');
    if (sicht.mode === 'campaign') {
      /* Enger filtern heisst: nur aus dem Stapel der Kampagne herausnehmen. */
      const imStapel = new Set(resolvedStack(alle, kampagne).map((l) => l.id));
      const fremd = sicht.off.find((id) => !imStapel.has(id));
      if (fremd) return nein(reply, 400, `“${entityName(alle.get(fremd)) || fremd}” is not in this campaign’s stack; switch to My view to add other layers.`);
      await speichern(user, kampagne.id, { mode: 'campaign', off: sicht.off, layers: [] });
    } else {
      const ebenen = sicht.layers.map((id) => alle.get(id));
      const keine = sicht.layers.find((id, i) => !isLayer(ebenen[i]) || istKampagne(ebenen[i]));
      if (keine) return nein(reply, 400, `“${keine}” is not a layer.`);
      const lesbar = new Set((await sieve(request, ebenen as Entity[], alle)).map((e) => e.id));
      const verborgen = sicht.layers.find((id) => !lesbar.has(id));
      if (verborgen) return nein(reply, 403, 'One of these layers is not readable for you. Pick from the list in My view.');
      await speichern(user, kampagne.id, { mode: 'mine', off: [], layers: sicht.layers });
    }
    return zustand(request, user);
  });

  app.delete('/api/me/layer-view', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Sign in first.');
    const { kampagne } = await roheKampagne();
    if (kampagne) await speichern(user, kampagne.id, null);
    return zustand(request, user);
  });
}
