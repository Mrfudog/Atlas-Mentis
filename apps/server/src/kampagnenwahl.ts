/**
 * **Die Kampagne des Betrachters** (REQ-408, REQ-412, T-496).
 *
 * Bis T-496 las jede Route die laufende Kampagne aus der Einstellung der
 * Installation (`currentCampaign(map, settings)`): wechselte die
 * Verwaltung, wechselten alle. Jetzt hat jedes Konto seine Wahl (Einstellung
 * `campaign` am Konto) und je Kampagne seine Sicht (`layerView`), und
 * dieselbe Frage antwortet je Betrachter.
 *
 * Damit nicht hundert Aufrufe den Betrachter mitreichen müssen, steht er
 * im Zusammenhang der Anfrage (`AsyncLocalStorage`): ein Haken setzt ihn
 * beim Eingang, `ermittle` trägt das Konto ein, sobald es bekannt ist.
 * `currentCampaign` hier hat dieselbe Gestalt wie die aus `@nw/model` und
 * fragt diesen Zusammenhang; ohne Konto (Start, Migrationen, Skripte) gilt
 * die Einstellung wie bisher.
 *
 * Der **Live-Kanal** siebt je Empfänger ausserhalb von dessen Anfrage —
 * dort setzt `mitKonto` den Empfänger, sonst siebte er mit dem Konto, das
 * gerade geschrieben hat.
 *
 * Gelesen wird aus einem Zwischenspeicher je Konto (`ladeWahl`), den jede
 * Anmeldung füllt und jedes Schreiben (`merkeWahl`) nachführt: die Rechnung
 * in `currentCampaign` ist synchron und darf keine Datenbank fragen.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance } from 'fastify';
import {
  CAMPAIGN_PREF,
  LAYER_VIEW_PREF,
  chosenCampaign,
  layerViewKey,
  layerViewsOf,
  viewedCampaign,
  type CampaignChooser,
  type Entity,
  type LayerView,
} from '@nw/model';
import type { Repository } from './repo.js';

/** Was die Wahl braucht: wer, und welche Kampagnen er hat. */
export interface Konto extends CampaignChooser {
  id: string;
}

export interface Wahl {
  /** Die gewählte Kampagne, `null`: keine Wahl (die Vorgabe gilt). */
  campaign: string | null;
  /** Die Sicht je Kampagne; fehlt eine, gilt der Stapel der Kampagne. */
  views: Record<string, LayerView>;
}

const LEER: Wahl = { campaign: null, views: {} };

interface Zusammenhang {
  konto: Konto | null;
}

const speicher = new AsyncLocalStorage<Zusammenhang>();
const wahlen = new Map<string, Wahl>();

/** Ein Zusammenhang je Anfrage — vor jedem anderen Haken. */
export function kampagneJeAnfrage(app: FastifyInstance): void {
  app.addHook('onRequest', (_request, _reply, done) => {
    speicher.run({ konto: null }, done);
  });
}

/** Das Konto dieser Anfrage eintragen (in `ermittle`, sobald es feststeht). */
export function setzeKonto(konto: Konto | null): void {
  const z = speicher.getStore();
  if (z) z.konto = konto ? { id: konto.id, isAdmin: !!konto.isAdmin, roles: { ...(konto.roles ?? {}) } } : null;
}

/** Eine Rechnung im Namen eines Kontos — der Live-Kanal für seinen Empfänger. */
export function mitKonto<T>(konto: Konto | null, fn: () => T): T {
  return speicher.run({ konto: konto ? { id: konto.id, isAdmin: !!konto.isAdmin, roles: { ...(konto.roles ?? {}) } } : null }, fn);
}

/** Wer gerade fragt, oder `null`. */
export function kontoJetzt(): Konto | null {
  return speicher.getStore()?.konto ?? null;
}

/** Die Wahl eines Kontos — einmal aus den Einstellungen gelesen, danach aus dem Speicher. */
export async function ladeWahl(repo: Repository, userId: string): Promise<Wahl> {
  const da = wahlen.get(userId);
  if (da) return da;
  const prefs = await repo.getPrefs(userId);
  const c = prefs[CAMPAIGN_PREF];
  const wahl: Wahl = { campaign: typeof c === 'string' && c ? c : null, views: layerViewsOf(prefs[LAYER_VIEW_PREF]) };
  wahlen.set(userId, wahl);
  return wahl;
}

/** Was gerade gespeichert wurde, gleich auch im Speicher. */
export function merkeWahl(userId: string, wahl: Wahl): void {
  wahlen.set(userId, wahl);
}

/** Die Wahl aus dem Speicher, ohne zu laden (leer, wenn noch nichts da ist). */
export function wahlVon(userId: string): Wahl {
  return wahlen.get(userId) ?? LEER;
}

/** Für Tests: alles vergessen. */
export function vergissWahlen(): void {
  wahlen.clear();
}

/* Die Sicht je Bestand, Kampagne und Sicht einmal gerechnet: `campaignLayer`
   geht über den Bestand, und Zwischenspeicher weiter hinten vergleichen
   die Kampagne nach Identität. */
const gesehen = new WeakMap<ReadonlyMap<string, Entity>, Map<string, Entity>>();
const schluessel = new WeakMap<Entity, string>();

/**
 * **Die laufende Kampagne dieses Betrachters** — dieselbe Gestalt wie
 * `currentCampaign` aus `@nw/model`, für ein Konto: seine Wahl (oder die
 * Vorgabe, `chosenCampaign`), gelesen mit seiner Sicht (`viewedCampaign`).
 */
export function kampagneFuer(
  entities: ReadonlyMap<string, Entity>,
  settings: Record<string, string> | null | undefined,
  konto: Konto | null,
): Entity | null {
  const wahl = konto ? wahlVon(konto.id) : LEER;
  const kampagne = chosenCampaign(entities, settings, konto, wahl.campaign);
  if (!kampagne) return null;
  const sicht = wahl.views[kampagne.id];
  const key = layerViewKey(sicht);
  if (!key) return kampagne;
  let je = gesehen.get(entities);
  if (!je) {
    je = new Map();
    gesehen.set(entities, je);
  }
  const k = `${kampagne.id}|${key}`;
  let e = je.get(k);
  if (!e) {
    e = viewedCampaign(entities, kampagne, sicht);
    schluessel.set(e, k);
    je.set(k, e);
  }
  return e;
}

/** Wie `currentCampaign` aus `@nw/model`, aber für den Betrachter dieser Anfrage. */
export function currentCampaign(entities: ReadonlyMap<string, Entity>, settings?: Record<string, string> | null): Entity | null {
  return kampagneFuer(entities, settings, kontoJetzt());
}

/**
 * Ein Schlüssel für Zwischenspeicher, die je Kampagne rechnen: die Id, und
 * wenn es eine Sicht ist, die Sicht dazu. Zwei Konten mit verschiedener
 * Sicht teilen sich so keinen Stapel.
 */
export function kampagneSchluessel(kampagne: Entity | null | undefined): string {
  if (!kampagne) return '';
  return schluessel.get(kampagne) ?? kampagne.id;
}

/** Ein Schlüssel für Wahl und Sichten eines Kontos — ändert er sich, gilt kein Zwischenstand mehr. */
export function wahlSchluessel(userId: string): string {
  const w = wahlVon(userId);
  return `${w.campaign ?? ''}|${Object.keys(w.views)
    .sort()
    .map((c) => `${c}=${layerViewKey(w.views[c])}`)
    .join(';')}`;
}
