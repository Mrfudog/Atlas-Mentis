/**
 * **Figuren je Kampagne** (T-412, Entscheid der Leitung 23.10.: „Die
 * Charaktere sollten dem Nutzer pro Kampagne zugewiesen werden.").
 *
 * Gespeichert steht die Kampagne neben der Zuteilung
 * (`app_user_actor.campaign_id`, `User.actorCampaigns`). Gefragt wird
 * immer in einer Kampagne: eine Anfrage in der laufenden (`inKampagne` beim
 * Ermitteln des Betrachters), die Mitgliederliste in ihrer. Eine Figur ohne
 * bekannte Kampagne gilt wie bisher überall — die Migration zählt sie auf,
 * und die nächste Zuteilung auf der Kampagnenseite ordnet sie zu.
 */
import type { User } from './auth.js';

/** Die Figuren dieses Kontos in dieser Kampagne, samt denen ohne bekannte Kampagne. */
export function figurenIn(user: Pick<User, 'actorIds' | 'actorCampaigns'>, kampagne: string | null): string[] {
  const k = user.actorCampaigns ?? {};
  return (user.actorIds ?? []).filter((a) => !k[a] || !kampagne || k[a] === kampagne);
}

/** Das Konto, wie es in dieser Kampagne fragt: `actorIds` nur ihre Figuren. */
export function inKampagne<U extends Pick<User, 'actorIds' | 'actorCampaigns'>>(user: U, kampagne: string | null): U {
  return { ...user, actorIds: figurenIn(user, kampagne) };
}

/**
 * Die Figuren in dieser Kampagne ersetzen: die anderer Kampagnen bleiben,
 * die genannten gehören danach dieser. Was nur hier stand und nicht mehr
 * genannt ist, geht.
 */
export function mitFiguren<U extends Pick<User, 'actorIds' | 'actorCampaigns'>>(user: U, kampagne: string, ids: readonly string[]): U {
  const hier = new Set(figurenIn(user, kampagne));
  const neu = new Set(ids);
  const actorIds = [...(user.actorIds ?? []).filter((a) => !hier.has(a) || neu.has(a)), ...[...neu].filter((a) => !(user.actorIds ?? []).includes(a))];
  const actorCampaigns: Record<string, string> = {};
  for (const [a, c] of Object.entries(user.actorCampaigns ?? {})) if (actorIds.includes(a) && !neu.has(a)) actorCampaigns[a] = c;
  for (const a of neu) actorCampaigns[a] = kampagne;
  return { ...user, actorIds, actorCampaigns };
}

/** Eine Figur dazu, in dieser Kampagne — die übrigen bleiben, wie sie sind. */
export function figurDazu<U extends Pick<User, 'actorIds' | 'actorCampaigns'>>(user: U, kampagne: string | null, id: string): U {
  const actorIds = (user.actorIds ?? []).includes(id) ? [...user.actorIds] : [...(user.actorIds ?? []), id];
  const actorCampaigns = { ...(user.actorCampaigns ?? {}) };
  if (kampagne) actorCampaigns[id] = kampagne;
  return { ...user, actorIds, actorCampaigns };
}
