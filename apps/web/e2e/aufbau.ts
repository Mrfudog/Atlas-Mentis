/**
 * Aufbau eines E2E-Laufs (T-356): Konten, Testkampagne, Sitzungen.
 *
 * Konten legt die Kommandozeile an, wie auf einer echten Installation
 * (`user add`, CLAUDE.md › Bauen und prüfen) — über HTTP gibt es dafür
 * absichtlich keinen Weg. Alles Weitere geht über die API, mit denselben
 * Regeln wie in der Oberfläche: die Verwaltung legt die Kampagne an und
 * schaltet sie auf, die Leitung bekommt `gm`, die Spielerin `player`.
 *
 * Keine 5e.tools-Daten, kein Kampagneninhalt: was ein Spec braucht, legt
 * er selbst als kleinen Testartikel an (`hilfen.ts › anlegen`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { request, type FullConfig } from '@playwright/test';
import { KONTEN, ORDNER, PASSWORT, laufDatei, sitzungDatei, type Lauf, type Rolle } from './stand';

const nutzerSkript = fileURLToPath(new URL('../../server/dist/user.js', import.meta.url));

function konto(name: string, ...flags: string[]): void {
  const env = { ...process.env, NW_PASSWORD: PASSWORT };
  try {
    execFileSync(process.execPath, [nutzerSkript, 'add', name, ...flags], { env, stdio: 'pipe' });
  } catch (fehler) {
    /* Lokal läuft dieselbe Datenbank mehrmals: dann gibt es das Konto
       schon, und es bekommt nur das Passwort neu. */
    const text = String((fehler as { stderr?: Buffer }).stderr ?? fehler);
    if (!text.includes('gibt es schon')) throw new Error(`user add ${name}: ${text}`);
    execFileSync(process.execPath, [nutzerSkript, 'password', name], { env, stdio: 'pipe' });
  }
}

async function anmelden(baseURL: string, rolle: Rolle) {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/login', { data: { name: KONTEN[rolle], password: PASSWORT } });
  if (!res.ok()) throw new Error(`Anmeldung ${rolle}: ${res.status()} ${await res.text()}`);
  await ctx.storageState({ path: sitzungDatei(rolle) });
  return ctx;
}

async function pruefe(res: { ok(): boolean; status(): number; text(): Promise<string> }, was: string) {
  if (!res.ok()) throw new Error(`${was}: ${res.status()} ${await res.text()}`);
}

export default async function aufbau(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('baseURL fehlt in der Playwright-Konfiguration.');
  mkdirSync(ORDNER, { recursive: true });

  konto(KONTEN.verwaltung, '--admin');
  konto(KONTEN.leitung);
  konto(KONTEN.spielerin);

  const verwaltung = await anmelden(baseURL, 'verwaltung');
  const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const name = `E2E ${id}`;
  const angelegt = await verwaltung.post('/api/campaigns', { data: { name } });
  await pruefe(angelegt, 'Kampagne anlegen');
  const campaign = (await angelegt.json()) as { id: string };
  await pruefe(await verwaltung.put('/api/campaigns/current', { data: { id: campaign.id } }), 'Kampagne aufschalten');
  for (const [rolle, role] of [['leitung', 'gm'], ['spielerin', 'player']] as const) {
    await pruefe(
      await verwaltung.post(`/api/campaigns/${campaign.id}/members`, { data: { name: KONTEN[rolle], role } }),
      `${rolle} in die Kampagne`,
    );
  }
  await verwaltung.dispose();

  /* Erst nach den Rollen anmelden: die Sitzung liest sie bei jeder
     Anfrage, aber so steht in den Dateien, was die Specs erwarten. */
  for (const rolle of ['leitung', 'spielerin'] as const) await (await anmelden(baseURL, rolle)).dispose();

  /* Die Figur der Spielerin: sie legt sie selbst an (in ihre Spielerebene),
     in die Gruppe der Kampagne (`memberOfParty`, T-100); zugeteilt wird
     sie wie auf einer echten Installation über `user actor`. */
  const spielerin = await request.newContext({ baseURL, storageState: sitzungDatei('spielerin') });
  const figurName = `Wren ${id}`;
  const neu = await spielerin.post('/api/entities', {
    data: {
      type: 'PlayerCharacter',
      name: figurName,
      fields: { 'Status.status': 'ready' },
      relations: [{ type: 'memberOfParty', to: `pt_${campaign.id}` }],
    },
  });
  await pruefe(neu, 'Figur der Spielerin anlegen');
  const figur = { id: ((await neu.json()) as { id: string }).id, name: figurName };
  await spielerin.dispose();
  execFileSync(process.execPath, [nutzerSkript, 'actor', KONTEN.spielerin, '--actor', figur.id], { env: process.env, stdio: 'pipe' });

  const lauf: Lauf = { id, campaign: { id: campaign.id, name, layer: `ly_${campaign.id}` }, figur };
  writeFileSync(laufDatei, JSON.stringify(lauf, null, 2));
}
