/**
 * Was die Token-Maske rechnet (T-112) — ohne Angular, damit es sich prüfen
 * lässt. Der Server prüft dasselbe noch einmal (`tokenExpiryAt`); hier geht
 * es nur darum, dass die Maske nichts anbietet, was er ablehnt.
 */

/** Vorgabe und Grenze wie am Server (`TOKEN_DAYS_DEFAULT`, `TOKEN_DAYS_MAX`). */
export const TOKEN_TAGE_VORGABE = 30;
export const TOKEN_TAGE_MAX = 365;

const TAG = 24 * 60 * 60 * 1000;

/** Ein Tag als `YYYY-MM-DD` (UTC — so liest ihn der Server). */
export function tagAus(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Die Spanne für das Datumsfeld: frühestens morgen, spätestens in 365 Tagen. */
export function ablaufSpanne(jetzt: Date = new Date()): {
  min: string;
  max: string;
  vorgabe: string;
} {
  const t = jetzt.getTime();
  return {
    min: tagAus(new Date(t + TAG)),
    max: tagAus(new Date(t + (TOKEN_TAGE_MAX - 1) * TAG)),
    vorgabe: tagAus(new Date(t + TOKEN_TAGE_VORGABE * TAG)),
  };
}

/**
 * **Was in die Cloud-Umgebung gehört** (Betrieb › Werkzeugzugang, Weg B):
 * der Proxy hängt `Authorization: Bearer …` an jede Anfrage an diesen Host,
 * und die Sitzung sieht das Token nie. Der Host ist der, unter dem diese
 * Seite läuft — ein Token gilt nur für die Installation, die es ausgab.
 */
export function netzwerkSecret(host: string): { host: string; header: string; prefix: string } {
  return { host, header: 'Authorization', prefix: 'Bearer' };
}
