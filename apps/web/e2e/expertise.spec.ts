/**
 * **Expertise nur auf Geübtes** (T-303): im Assistenten ist eine
 * Fertigkeit, in der die Figur noch nicht geübt ist, in der Expertise-Wahl
 * gesperrt und sagt warum; eine geübte lässt sich wählen. Klasse und Figur
 * sind eigene kleine Testartikel, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';

test('expertise offers only what the character is proficient in', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const rolle = info.project.name === 'phone' ? 'spielerin' : 'leitung';
  const seite = rolle === 'spielerin' ? spielerin : leitung;
  const klasse = await api.anlegen('leitung', 'Class', eindeutig('Cantor'), {
    fields: {
      'Status.status': 'ready',
      'Class.hitDie': 8,
      'Choices.choices': [
        { id: 'skills', kind: 'proficiency', count: 1, from: { values: ['Athletics', 'Survival'] } },
        { id: 'expertise', kind: 'proficiency', count: 1, from: { values: ['Athletics', 'Arcana'] } },
      ],
    },
  });
  const herkunft = await api.anlegen('leitung', 'Ancestry', eindeutig('Fenling'), { fields: { 'Status.status': 'ready' } });
  const hintergrund = await api.anlegen('leitung', 'Background', eindeutig('Ferryman'), { fields: { 'Status.status': 'ready' } });
  const figur = await api.anlegen(rolle, 'PlayerCharacter', eindeutig('Wren'), {
    fields: { 'Status.status': 'idea' },
    relations: [
      { type: 'hasAncestry', to: herkunft.id },
      { type: 'hasBackground', to: hintergrund.id },
      { type: 'hasClass', to: klasse.id, props: { level: 1 } },
      { type: 'chose', to: klasse.id, props: { choice: 'skills', picks: ['Athletics'] } },
    ],
  });

  await seite.goto(`/characters/${figur.id}/edit`);
  await seite.getByRole('button', { name: 'Class', exact: true }).click();
  const arcana = seite.locator('label', { hasText: 'Arcana' });
  await expect(arcana).toContainText('not proficient yet');
  await expect(arcana.locator('input')).toBeDisabled();
  /* Athletics steht in beiden Wahlen; in der Expertise ist es die zweite. */
  const athletics = seite.locator('label', { hasText: 'Athletics' }).last();
  await expect(athletics.locator('input')).toBeEnabled();
  await athletics.locator('input').check();
  await expect(athletics.locator('input')).toBeChecked();
});
