/**
 * **Was „New article" an den Assistenten weitergibt** (T-095, Prüfung der
 * Leitung 20.10.): wer eine Figur im Dialog anfängt und dort schon Name,
 * Ebene oder Pflichtfelder einträgt, findet sie im Assistenten wieder —
 * nichts wird doppelt gefragt. Weitergegeben wird über die Adresse:
 * `name`, `layer` (nur, wenn sie von der Schreibebene abweicht) und je Feld
 * `f.<Typ.feld>`.
 */
export interface Mitnahme {
  name: string;
  layer: string;
  felder: Record<string, string>;
}

/** Die Adresse aus dem, was im Dialog steht. */
export function mitnahmeParams(
  name: string,
  ebene: string,
  schreibebene: string | undefined,
  felder: readonly { ref: string }[],
  werte: Partial<Record<string, string>>,
): Record<string, string> {
  const raus: Record<string, string> = {};
  if (name.trim()) raus['name'] = name.trim();
  if (ebene && ebene !== schreibebene) raus['layer'] = ebene;
  for (const { ref } of felder) {
    const w = werte[ref];
    if (w !== undefined && w !== '') raus[`f.${ref}`] = w;
  }
  return raus;
}

/** Zurückgelesen im Assistenten; fehlt alles, ist alles leer. */
export function mitnahmeLesen(q: { keys: readonly string[]; get(k: string): string | null }): Mitnahme {
  const felder: Record<string, string> = {};
  for (const k of q.keys) {
    const w = q.get(k);
    if (k.startsWith('f.') && k.length > 2 && w) felder[k.slice(2)] = w;
  }
  return { name: q.get('name')?.trim() ?? '', layer: q.get('layer') ?? '', felder };
}
