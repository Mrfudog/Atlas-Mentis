/**
 * **Die Kampagne je Konto und die eigene Sicht auf ihren Stapel** (T-496,
 * REQ-408, REQ-412).
 *
 * Bis hierher war die laufende Kampagne eine Einstellung der Installation
 * (`settings.campaign`): wechselte die Verwaltung, wechselte sie für alle,
 * und wer in zwei Runden spielt, konnte die zweite nur über die Verwaltung
 * erreichen. Jetzt wählt jedes Konto selbst — unter den Kampagnen, in denen
 * es eine Rolle hat, die Verwaltung unter allen. Die Einstellung bleibt als
 * **Vorgabe** für Konten, die nichts gewählt haben.
 *
 * Gespeichert wird neben dem Konto (`/api/me/prefs`, Schlüssel `campaign`
 * und `stackView`), nicht in einem Artikel (REQ-199), und nur über diese
 * Routen: die allgemeine Route nimmt die beiden Schlüssel nicht.
 *
 * **Die Sicht** (`StackView`) gehört dem Konto, je Kampagne: `campaign`
 * mit ausgeblendeten Ebenen (enger filtern, die Kampagne bleibt, wie sie
 * ist; „Reset" stellt ihre Vorgabe her) oder `mine`, frei gewählte Ebenen,
 * die dieses Konto lesen darf. Gerechnet wird sie mit derselben
 * Stapelrechnung (`viewedCampaign`), am Server, für jede Liste, Suche und
 * jeden Artikel — und im Live-Kanal je Empfänger.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  CAMPAIGN_PREF,
  CAMPAIGN_TYPE,
  STACK_VIEW_PREF,
  cleanStackView,
  entityName,
  isGroupLayer,
  isLayer,
  resolvedStack,
  type Entity,
  type StackView,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

/** Was ein Konto gewählt hat, roh aus seinen Einstellungen. */
export interface KontoWahl {
  campaign: string | null;
  /** Kampagnen-Id → Sicht (ungeprüft; `cleanStackView` liest sie). */
  views: Record<string, unknown>;
}

/**
 * Die Wahl je Konto, einmal gelesen und gehalten, bis eine dieser Routen
 * sie ändert — sie wird bei jeder Anfrage gebraucht, und eine zweite Frage
 * an die Datenbank je Anfrage wäre die doppelte Frage aus P1. Geschrieben
 * wird sie nur hier (die allgemeine Route nimmt die Schlüssel nicht).
 */
export function kontoWahlen(repo: Repository): { lesen: (userId: string) => Promise<KontoWahl>; vergiss: (userId: string) => void } {
  const je = new Map<string, Promise<KontoWahl>>();
  return {
    lesen(userId) {
      let p = je.get(userId);
      if (!p) {
        p = repo.getPrefs(userId).then((prefs) => {
          const c = prefs[CAMPAIGN_PREF];
          const v = prefs[STACK_VIEW_PREF];
          return {
            campaign: typeof c === 'string' && c ? c : null,
            views: v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {},
          };
        });
        p.catch(() => je.delete(userId));
        je.set(userId, p);
      }
      return p;
    },
    vergiss(userId) {
      je.delete(userId);
    },
  };
}

/** Darf dieses Konto in dieser Kampagne fragen? Mit einer Rolle dort, die Verwaltung überall. */
export function darfWaehlen(user: Pick<User, 'isAdmin' | 'roles'>, campaignId: string): boolean {
  return user.isAdmin || !!user.roles?.[campaignId];
}

export interface KampagnenwahlDeps {
  repo: Repository;
  /** Das Konto der Anfrage, mit gerechneter Kampagne und Sicht. */
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  /** Ob gerade eine fremde Sicht eingenommen ist (`X-View-As`) — dann wird nichts gespeichert. */
  inFremderSicht: (request: FastifyRequest) => Promise<boolean>;
  /** Siebt Artikel für dieses Konto, wie jede Route (Sichtbarkeit), die Ebenen selbst ungeachtet des Stapels. */
  lesbareEbenen: (user: User, ebenen: Entity[], bestand: ReadonlyMap<string, Entity>) => Promise<Entity[]>;
  wahl: ReturnType<typeof kontoWahlen>;
}

interface EbeneKurz {
  id: string;
  name: string;
  group: boolean;
  /** Schaltet die Kampagne sie auf (aufgelöst, Gruppen inbegriffen)? */
  inCampaign: boolean;
}

export function registerKampagnenwahl(app: FastifyInstance, deps: KampagnenwahlDeps): void {
  const { repo, viewerOf, wahl } = deps;

  async function alleKampagnen(): Promise<Map<string, Entity>> {
    return new Map([...(await repo.entityMap()).values()].filter((e) => e.interfaces?.[0] === CAMPAIGN_TYPE).map((e) => [e.id, e]));
  }

  /**
   * **Die Kampagne wählen** (REQ-408): `{ id }` setzt sie für dieses Konto,
   * auf jedem Gerät; `{ id: null }` nimmt die Wahl weg — dann gilt wieder
   * die Vorgabe der Installation. Die Vorgabe selbst setzt weiter die
   * Verwaltung (`PUT /api/campaigns/current`).
   */
  app.put<{ Body: { id?: unknown } | null }>('/api/me/campaign', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Not signed in.' });
    if (await deps.inFremderSicht(request)) return reply.code(403).send({ error: 'You are viewing as someone else. Leave “View as” to change your own campaign.' });
    const id = request.body?.id;
    if (id === null) {
      await repo.putPref(user.id, CAMPAIGN_PREF, null);
      wahl.vergiss(user.id);
      return { ok: true, current: null };
    }
    if (typeof id !== 'string' || !id) return reply.code(400).send({ error: 'Send { id } with a campaign id, or { id: null } to follow the default.' });
    if (!(await alleKampagnen()).has(id)) return reply.code(400).send({ error: 'This campaign does not exist. Pick one from the list.' });
    if (!darfWaehlen(user, id)) {
      return reply.code(403).send({ error: 'You have no role in this campaign. Ask its GM for an invitation.' });
    }
    await repo.putPref(user.id, CAMPAIGN_PREF, id);
    wahl.vergiss(user.id);
    return { ok: true, current: id };
  });

  /** Die Ebenen zur Wahl, und die Sicht, die gilt. */
  async function sichtStand(user: User) {
    const alle = await repo.entityMap();
    const kampagne = user.campaign ? (alle.get(user.campaign) ?? null) : null;
    const imStapel = kampagne ? resolvedStack(alle, kampagne) : [];
    const imStapelIds = new Set(imStapel.map((l) => l.id));
    const ebenen = [...alle.values()].filter((e) => isLayer(e) && e.interfaces?.[0] !== CAMPAIGN_TYPE);
    const lesbar = await deps.lesbareEbenen(user, ebenen, alle);
    const lesbarIds = new Set(lesbar.map((l) => l.id));
    const kurz = (l: Entity): EbeneKurz => ({ id: l.id, name: entityName(l), group: isGroupLayer(l), inCampaign: imStapelIds.has(l.id) });
    const v = user.stackView ?? null;
    return {
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      mode: v?.mode ?? 'campaign',
      hide: v?.hide ?? [],
      mine: v?.mine ?? [],
      /* Die Ebenen der Kampagne, von unten nach oben — zum Enger-Filtern. */
      stack: imStapel.filter((l) => lesbarIds.has(l.id)).map(kurz),
      /* Jede Ebene, die dieses Konto lesen darf — zum freien Wählen. Was die
         Kampagne aufschaltet, zuerst; danach nach Namen. */
      layers: lesbar
        .map(kurz)
        .sort((a, b) => Number(b.inCampaign) - Number(a.inCampaign) || a.name.localeCompare(b.name, 'en')),
      lesbarIds,
    };
  }

  app.get('/api/me/view', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Not signed in.' });
    const { lesbarIds: _l, ...stand } = await sichtStand(user);
    return stand;
  });

  /**
   * **Die eigene Sicht setzen** (REQ-412): `{ mode: 'campaign', hide }`
   * filtert den Stapel der Kampagne enger, `{ mode: 'mine', mine }` wählt
   * eigene Ebenen. Eine eigene Ebene muss dieses Konto lesen dürfen; eine
   * ausgeblendete muss es nicht — was nicht da ist, kann man ausblenden.
   * `DELETE` ist „Reset": die Vorgabe der Kampagne.
   */
  app.put<{ Body: { mode?: unknown; hide?: unknown; mine?: unknown } | null }>('/api/me/view', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Not signed in.' });
    if (await deps.inFremderSicht(request)) return reply.code(403).send({ error: 'You are viewing as someone else. Leave “View as” to change your own view.' });
    if (!user.campaign) return reply.code(409).send({ error: 'There is no campaign to view yet. Create or join one first.' });
    const b = request.body ?? {};
    if (b.mode !== 'campaign' && b.mode !== 'mine') return reply.code(400).send({ error: 'mode: “campaign” or “mine”.' });
    for (const k of ['hide', 'mine'] as const) {
      if (b[k] !== undefined && !(Array.isArray(b[k]) && (b[k] as unknown[]).every((x) => typeof x === 'string'))) {
        return reply.code(400).send({ error: `${k}: a list of layer ids.` });
      }
    }
    const stand = await sichtStand(user);
    const v = cleanStackView({ mode: b.mode, hide: b.hide ?? stand.hide, mine: b.mine ?? stand.mine });
    if (v?.mode === 'mine') {
      const fremd = v.mine.filter((id) => !stand.lesbarIds.has(id));
      if (fremd.length) return reply.code(400).send({ error: `You cannot read these layers, so they cannot be in your view: ${fremd.join(', ')}.` });
    }
    await speichere(user, v);
    const { lesbarIds: _l, ...danach } = await sichtStand({ ...user, stackView: v });
    return danach;
  });

  app.delete('/api/me/view', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Not signed in.' });
    if (await deps.inFremderSicht(request)) return reply.code(403).send({ error: 'You are viewing as someone else. Leave “View as” to reset your own view.' });
    if (user.campaign) await speichere(user, null);
    return { ok: true };
  });

  /** Je Kampagne eine Sicht; die Vorgabe steht gar nicht da. */
  async function speichere(user: User, v: StackView | null): Promise<void> {
    const alt = (await wahl.lesen(user.id)).views;
    const neu: Record<string, unknown> = { ...alt };
    if (v) neu[user.campaign!] = v;
    else delete neu[user.campaign!];
    await repo.putPref(user.id, STACK_VIEW_PREF, Object.keys(neu).length ? neu : null);
    wahl.vergiss(user.id);
  }
}
