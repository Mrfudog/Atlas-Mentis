/**
 * **Die Kampagne gegen die gelesene Revision schreiben** (T-449, REQ-192).
 *
 * Die Routen an der Kampagne (Stapel, Auswahl je Ebene, Typ-Regeln,
 * Freigaben, Vorrang, Vergleich, Sichtbarkeitsregeln) lesen sie, ändern
 * eine Kante oder eine Karte und schreiben sie ganz zurück. Ohne Revision
 * gewinnt der zweite von zwei gleichzeitigen Schreibern und nimmt die
 * Änderung des ersten mit — Desktop und Telefon an derselben Kampagne
 * (gefunden bei T-401/T-403).
 *
 * Darum schreibt jede dieser Routen mit `expectRevision`, und kommt etwas
 * dazwischen, **rechnet sie einmal neu**: frisch lesen, dieselbe Änderung
 * noch einmal anwenden, schreiben. Das ist das Zusammenführen — eine Route
 * ändert eine Zeile, nicht die ganze Kampagne, also verträgt sich ihre
 * Änderung mit der des anderen. Wie `kanteSetzen` am Board (`abfrage.ts`).
 *
 * **Mit `If-Match`** sagt die Oberfläche, gegen welchen Stand sie gerechnet
 * hat — bei Routen, die einen ganzen Stand schicken (der Stapel als Liste,
 * die Vergleichsebenen). Dann wird nicht neu gerechnet: die Liste kam vom
 * Gerät, und sie auf den frischen Stand zu legen hiesse, die Änderung des
 * anderen still zu überschreiben. Ein Konflikt wird dann eine 409.
 *
 * Bleibt es beim Konflikt, wirft `putEntity` `RevisionConflict`, und die
 * Fehlerbehandlung in `app.ts` antwortet 409 mit „neu laden". Der
 * Live-Kanal (T-116/T-399) meldet die Kampagne danach ohnehin an jedes Gerät.
 */

import type { FastifyRequest } from "fastify";
import type { Entity } from "@nw/model";
import { RevisionConflict, type PutOptions, type Repository } from "./repo.js";

/** `If-Match: "7"`, `W/"7"` oder `7` → 7; fehlt er oder ist er Unsinn: `undefined`. */
export function ifMatchRevision(request: FastifyRequest): number | undefined {
  const roh = request.headers["if-match"];
  const wert = Array.isArray(roh) ? roh[0] : roh;
  if (typeof wert !== "string") return undefined;
  const zahl = /^\s*(?:W\/)?"?(\d+)"?\s*$/.exec(wert)?.[1];
  return zahl === undefined ? undefined : Number(zahl);
}

/**
 * `rechne` liest selbst (frisch, bei jedem Versuch) und schreibt mit
 * `gegen(kampagne)` als Option zu `putEntity`. Ohne `If-Match` ein zweiter
 * Versuch nach einem Konflikt; mit nur einer.
 */
export async function aufFrischemStand<T>(
  request: FastifyRequest,
  rechne: (gegen: (gelesen: Entity) => PutOptions) => Promise<T>,
): Promise<T> {
  const verlangt = ifMatchRevision(request);
  const gegen = (gelesen: Entity): PutOptions => ({
    expectRevision: verlangt ?? gelesen.revision ?? null,
  });
  for (let versuch = 0; ; versuch++) {
    try {
      return await rechne(gegen);
    } catch (error) {
      if (
        !(error instanceof RevisionConflict) ||
        verlangt !== undefined ||
        versuch >= 1
      )
        throw error;
    }
  }
}

/**
 * Dasselbe ausserhalb einer Route: eine Änderung an einem Artikel (hier
 * die Kampagne beim Übernehmen einer Spielerebene oder beim Aufschalten
 * einer neuen), auf den frischen Stand gelegt und gegen seine Revision
 * geschrieben, bei Konflikt einmal neu. `aendern` gibt `null`, wenn es
 * nichts zu schreiben gibt.
 */
export async function frischAendern(
  repo: Repository,
  id: string,
  aendern: (gelesen: Entity) => Entity | null,
): Promise<Entity | null> {
  for (let versuch = 0; ; versuch++) {
    const gelesen = await repo.getEntity(id);
    const neu = gelesen ? aendern(gelesen) : null;
    if (!gelesen || !neu) return null;
    try {
      return await repo.putEntity(neu, {
        expectRevision: gelesen.revision ?? null,
      });
    } catch (error) {
      if (!(error instanceof RevisionConflict) || versuch >= 1) throw error;
    }
  }
}
