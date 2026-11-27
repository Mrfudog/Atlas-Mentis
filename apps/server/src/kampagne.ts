/**
 * **Die laufende Kampagne einer Anfrage** (T-496, REQ-395). Seit jedes
 * Konto seine Kampagne wählt, ist „die laufende Kampagne" keine Frage an
 * die Einstellung allein mehr: `kontoKampagne` nimmt die des fragenden
 * Kontos (aus dem Anfrage-Speicher, gesetzt von `werIst`), sonst die
 * Vorgabe der Installation (`settings.campaign`), sonst die erste.
 *
 * Wer das Konto in der Hand hat und **ausserhalb** einer Anfrage rechnet
 * (das Sieb für den Live-Kanal), gibt `chosen` ausdrücklich mit; `null`
 * heisst dann „keine Wahl, die Vorgabe", nicht „frag den Speicher".
 */
import { currentCampaign, type Entity } from '@nw/model';
import { anfrageKonto } from './zeitmessung.js';

export function kontoKampagne(
  entities: ReadonlyMap<string, Entity>,
  settings?: Record<string, string> | null,
  chosen: string | null | undefined = anfrageKonto()?.campaign,
): Entity | null {
  return currentCampaign(entities, settings, chosen);
}
