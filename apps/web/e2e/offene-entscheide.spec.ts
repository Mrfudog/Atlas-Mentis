/**
 * **Offene Entscheide halten eine Figur auf idea** (T-436, REQ-440, E-176):
 * die Figur entsteht gleich und trägt, was gewählt ist; solange eine Wahl
 * ihrer Klasse offen ist, verweigert der Server einen höheren Stand und
 * sagt, was zu entscheiden ist — auch der Spielerin, die ihre Figur sonst
 * selbst fertig setzt (D74).
 */
import { test, expect } from './hilfen';

test('a character with an open class choice stays an idea and the message names the choice', async ({ spielerin, api, eindeutig }) => {
  const klasse = await api.anlegen('leitung', 'Class', eindeutig('Lamplighter'), {
    fields: {
      'Status.status': 'ready',
      'Choices.choices': [{ id: 'skills', kind: 'proficiency', count: 1, from: { values: ['Athletics', 'Survival'] } }],
    },
  });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Thorin'), {
    fields: { 'Status.status': 'idea' },
    relations: [{ type: 'hasClass', to: klasse.id, props: { level: 1 } }],
  });

  await spielerin.goto(`/artikel/${figur.id}?edit=full`);
  await spielerin.locator('label[data-ref="Status.status"] select').selectOption('ready');
  await spielerin.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(spielerin.getByText(`decide: ${klasse.name} · Skill proficiencies`).first()).toBeVisible();

  const gespeichert = await (await (await api.als('spielerin')).get(`/api/entities/${figur.id}`)).json();
  expect(gespeichert.components.Status.status).toBe('idea');
});
