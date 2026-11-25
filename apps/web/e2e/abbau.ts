/**
 * Abbau eines E2E-Laufs (T-356): die Testkampagne und was darin entstand.
 *
 * Im CI ist die Datenbank nach dem Lauf ohnehin weg; lokal läuft dieselbe
 * mehrmals, und eine Kampagne je Lauf sammelt sich sonst an. Geleert wird
 * wie in der Oberfläche (`POST /api/layers/:layer/empty`, Vorschau und
 * Zahl), danach gehen Gruppe, Kampagne und Ebenen. Scheitert ein Schritt,
 * sagt der Abbau es und lässt den Lauf grün — geprüft wurde vorher.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { request, type FullConfig } from '@playwright/test';
import { KONTEN, leseLauf, sitzungDatei } from './stand';

const nutzerSkript = fileURLToPath(new URL('../../server/dist/user.js', import.meta.url));

export default async function abbau(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  let lauf;
  try {
    lauf = leseLauf();
  } catch {
    return;
  }
  const verwaltung = await request.newContext({ baseURL, storageState: sitzungDatei('verwaltung') });
  const spielerin = await request.newContext({ baseURL, storageState: sitzungDatei('spielerin') });
  try {
    const ebenen = [lauf.campaign.layer];
    const vorgabe = await spielerin.get('/api/layers/default');
    if (vorgabe.ok()) {
      const id = ((await vorgabe.json()) as { layer?: { id?: string } | null }).layer?.id;
      if (id && id !== lauf.campaign.layer) ebenen.unshift(id);
    }
    for (const ebene of ebenen) {
      const probe = await verwaltung.post(`/api/layers/${ebene}/empty`, { data: { dryRun: true, limit: 5000 } });
      const zahl = probe.ok() ? ((await probe.json()) as { count?: number }).count : undefined;
      if (zahl) await verwaltung.post(`/api/layers/${ebene}/empty`, { data: { confirmDelete: zahl, limit: 5000 } });
    }
    for (const id of [`pt_${lauf.campaign.id}`, lauf.campaign.id, ...ebenen]) await verwaltung.delete(`/api/entities/${id}`);
    /* Die Figur ging mit der Spielerebene; die Zuteilung am Konto auch. */
    if (lauf.figur) {
      execFileSync(process.execPath, [nutzerSkript, 'actor', KONTEN.spielerin, 'remove', '--actor', lauf.figur.id], { stdio: 'pipe' });
    }
  } catch (fehler) {
    console.warn(`E2E-Abbau unvollständig: ${String(fehler)}`);
  } finally {
    await verwaltung.dispose();
    await spielerin.dispose();
  }
}
