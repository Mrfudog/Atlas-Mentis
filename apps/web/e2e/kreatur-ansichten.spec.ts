/**
 * **Erfassungsansichten „Roleplay“ und „Fight“** (T-462, REQ-461): eine
 * Kreatur wird über die eine oder die andere Maske angelegt und bearbeitet;
 * beide schreiben dieselben Felder, der Wechsel verliert nichts, und jedes
 * Feld zeigt seinen Hilfetext, sobald es den Fokus hat. Ein Statblock kennt
 * nur „Fight“. Die Masken kommen mit dem Register (Migration 168) — hier
 * wird nichts am Register geändert.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './hilfen';

async function neu(seite: Page, art: string, name: string): Promise<void> {
  await seite.goto(`/compendium?type=${art}`);
  await seite.getByRole('button', { name: 'New article', exact: true }).click();
  const dialog = seite.getByRole('dialog');
  await dialog.locator('select').first().selectOption(art);
  await dialog.getByRole('textbox').first().fill(name);
}

const formWahl = (seite: Page) => seite.getByRole('dialog').locator('label:has(span:text-is("Form")) select');
const maske = (seite: Page) => seite.getByRole('navigation', { name: 'Form' });

test('a creature is created in the Roleplay form, switched to Fight and back without losing anything', async ({ leitung, eindeutig }) => {
  await neu(leitung, 'Creature', eindeutig('Ada the innkeeper'));
  /* Zwei Masken, Roleplay vorgewählt — im Kompendium gibt es keinen Bereich, also die erste. */
  await expect(formWahl(leitung)).toHaveValue('roleplay');
  await leitung.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect(leitung).toHaveURL(/edit=create/);
  await expect(leitung).toHaveURL(/form=roleplay/);

  /* Die Prosafelder der Maske stehen da, auch leer, in ihrer Reihenfolge. */
  const erscheinung = leitung.locator('.blockmaske[data-ref="Creature.appearance"]');
  await expect(erscheinung).toBeVisible();
  await expect(leitung.locator('.blockmaske[data-ref="Creature.personality"]')).toBeVisible();
  await expect(leitung.locator('.blockmaske[data-ref="Creature.background"]')).toBeVisible();
  await expect(leitung.locator('.blockmaske[data-ref="Creature.keyInfo"]')).toBeVisible();
  const reihe = await leitung.locator('.blockmaske[data-ref]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-ref')));
  expect(reihe.slice(0, 4)).toEqual(['Creature.appearance', 'Creature.personality', 'Creature.background', 'Creature.keyInfo']);
  await expect(leitung.locator('.maske label[data-ref="Creature.agenda"]')).toBeVisible();
  /* Der Hilfetext erscheint beim Fokus, mit dem Verweis auf die Quelle. */
  await expect(erscheinung.locator('.hilfe')).toBeHidden();
  await erscheinung.locator('textarea').focus();
  await expect(erscheinung.locator('.hilfe')).toBeVisible();
  await expect(erscheinung.locator('.hilfe')).toContainText('The Alexandrian');
  await erscheinung.locator('textarea').fill('A scar across the brow');
  await leitung.locator('.maske label[data-ref="Creature.agenda"] textarea, .maske label[data-ref="Creature.agenda"] input').first().fill('Keep the inn');

  /* Fight: der Stand der Trefferpunkte kommt dazu, das Aussehen bleibt, weil es einen Wert hat. */
  await maske(leitung).getByRole('button', { name: 'Fight', exact: true }).click();
  await expect(leitung).toHaveURL(/form=fight/);
  const trefferwuerfel = leitung.locator('.maske label[data-ref="Vitals.hitDiceLeft"]');
  await expect(trefferwuerfel).toBeVisible();
  await expect(erscheinung.locator('textarea')).toHaveValue('A scar across the brow');
  await expect(leitung.locator('.blockmaske[data-ref="Creature.background"]')).toHaveCount(0);
  await trefferwuerfel.locator('input').fill('3');

  /* Zurück zu Roleplay: was einen Wert hat, bleibt sichtbar. */
  await maske(leitung).getByRole('button', { name: 'Roleplay', exact: true }).click();
  await expect(trefferwuerfel).toBeVisible();
  await expect(trefferwuerfel.locator('input')).toHaveValue('3');
  await expect(leitung.locator('.blockmaske[data-ref="Creature.background"]')).toBeVisible();

  await leitung.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(leitung.getByText('A scar across the brow').first()).toBeVisible();
  await expect(leitung.getByText('Keep the inn').first()).toBeVisible();
  /* Die Masken sind keine Leseansicht: die Leiste „Views“ bietet sie nicht an. */
  await expect(leitung.locator('nw-ansichtswahl').getByRole('button', { name: /^(Roleplay|Fight)$/ })).toHaveCount(0);
});

test('a statblock has only the Fight form, with the numbers first', async ({ leitung, api, eindeutig }) => {
  await neu(leitung, 'Statblock', eindeutig('Cult guard'));
  /* Eine Maske allein ist keine Wahl. */
  await expect(formWahl(leitung)).toHaveCount(0);
  await leitung.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect(leitung).toHaveURL(/form=fight/);
  await expect(leitung.locator('.maske label[data-ref="Statblock.ac"]')).toBeVisible();
  const reihe = await leitung.locator('.maske label[data-ref]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-ref')));
  expect(reihe.filter((r) => r !== 'layer').slice(0, 3)).toEqual(['Statblock.size', 'Statblock.ac', 'Statblock.hp']);
  await expect(leitung.locator('.blockmaske[data-ref="Tactics.tactics"]')).toBeVisible();
  await leitung.locator('.maske label[data-ref="Statblock.ac"] input').fill('15');
  await leitung.getByRole('button', { name: 'Save', exact: true }).click();
  /* Gespeichert: die Seite liest wieder (die Adresse behält ?edit=create, bis man sie verlässt). */
  await expect(leitung.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  const id = /\/artikel\/([^/?#]+)/.exec(leitung.url())?.[1] ?? '';
  const als = await api.als('leitung');
  const e = (await (await als.get(`/api/entities/${id}`)).json()) as { components: Record<string, Record<string, unknown>> };
  expect(e.components['Statblock']?.['ac']).toBe(15);
});

test('editing an existing creature offers the forms; All fields is the default', async ({ leitung, api, eindeutig }) => {
  const { id } = await api.anlegen('leitung', 'Creature', eindeutig('Old Tam'));
  await leitung.goto(`/artikel/${id}?edit=1`);
  const wahl = maske(leitung);
  await expect(wahl.getByRole('button', { name: 'All fields', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(leitung.locator('.blockmaske[data-ref="Creature.keyInfo"]')).toHaveCount(0);
  await wahl.getByRole('button', { name: 'Roleplay', exact: true }).click();
  await expect(wahl.getByRole('button', { name: 'Roleplay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(leitung.locator('.blockmaske[data-ref="Creature.keyInfo"]')).toBeVisible();
  await leitung.locator('.blockmaske[data-ref="Creature.keyInfo"] textarea').fill('Knows who paid for the inn');
  await leitung.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(leitung.getByText('Knows who paid for the inn').first()).toBeVisible();
});
