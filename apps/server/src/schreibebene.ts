/**
 * **Die Schreibebene** (T-161): die Ebene, in die ein Konto in der
 * laufenden Kampagne anlegt, wenn es keine nennt. Ohne Wahl ist es die
 * Vorgabe (`vorgabeEbene`, T-164: als `player` die eigene Spielerebene,
 * als Leitung die Ebene der Kampagne); gewählt wird im Popup der
 * Kopfleiste unter den Zielebenen (`zielEbenen`).
 *
 *  - **Gespeichert am Server, je Konto und Kampagne** — in den
 *    Einstellungen des Kontos (`writeLayer`: Kampagne → Ebene), nicht im
 *    Browser: sonst schriebe der Laptop woanders hin als das Telefon.
 *  - **Gelesen wird immer gegen die Zielebenen.** Fällt die gewählte aus
 *    dem Stapel oder entfällt das Recht, gilt die Vorgabe und die Antwort
 *    sagt es (`dropped`). Die Wahl bleibt stehen — schaltet die Leitung
 *    die Ebene wieder auf, gilt sie wieder.
 *  - **Die Maske schlägt vor, der Server prüft**: geschrieben wird die Wahl
 *    nur über `PUT /api/layers/write` (oder Account › Layers,
 *    `PUT /api/layers/:layer/default`, T-176), nicht über `/api/me/prefs`.
 */

import { WRITE_LAYER_PREF } from '@nw/model';

/** Die gewählte Ebene in dieser Kampagne, wie sie in den Einstellungen steht. */
export function gewaehlteEbene(prefs: Record<string, unknown>, campaignId: string): string | null {
  const wahl = prefs[WRITE_LAYER_PREF];
  if (!wahl || typeof wahl !== 'object' || Array.isArray(wahl)) return null;
  const id = (wahl as Record<string, unknown>)[campaignId];
  return typeof id === 'string' && id ? id : null;
}

/** Die Einstellung mit dieser Wahl — `null` nimmt sie für die Kampagne weg. */
export function mitWahl(prefs: Record<string, unknown>, campaignId: string, layerId: string | null): Record<string, string> | null {
  const alt = prefs[WRITE_LAYER_PREF];
  const neu: Record<string, string> = {};
  if (alt && typeof alt === 'object' && !Array.isArray(alt)) {
    for (const [k, v] of Object.entries(alt as Record<string, unknown>)) if (typeof v === 'string') neu[k] = v;
  }
  if (layerId) neu[campaignId] = layerId;
  else delete neu[campaignId];
  return Object.keys(neu).length ? neu : null;
}
