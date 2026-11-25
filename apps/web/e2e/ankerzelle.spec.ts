/**
 * Ankerzelle im Rasterinventar (REQ-402, T-406): wer ein liegendes Stück an
 * einer seiner Zellen wählt und dann auf ein freies Feld tippt, legt es so
 * ab, dass genau diese Zelle dort liegt — Leitung und Spielerin, jede in
 * ihrem eigenen Inventar, auf dem Desktop wie am Telefon.
 */
import { test, expect } from './hilfen';

test('the cell you pick a piece by lands on the cell you tap', async ({ leitung, spielerin, api, eindeutig }) => {
  for (const [rolle, seite] of [['leitung', leitung], ['spielerin', spielerin]] as const) {
    const t = await api.anlegen(rolle, 'Item', eindeutig('T-Bar'), { fields: { 'Item.rows': ['.#.', '###'], 'Item.stackSize': 1 } });
    const inv = await api.anlegen(rolle, 'Inventory', eindeutig('Pack'), {
      relations: [{ type: 'holds', to: t.id, props: { qty: 1, tier: 'pack', gx: 2, gy: 1, rot: 0 } }],
    });

    await seite.goto(`/artikel/${inv.id}`);
    const raster = seite.locator(`.raster[data-inv="${inv.id}"]`);
    await expect(raster).toBeVisible();
    const zelle = (x: number, y: number) => raster.locator(`[data-x="${x}"][data-y="${y}"]`);

    /* Angefasst an der rechten Zelle des Balkens (Form-Zelle 2,1 bei Lage 2,1 → Raster 4,2) — sobald das Stück liegt. */
    await expect(zelle(4, 2)).toHaveClass(/belegt/);
    await zelle(4, 2).click();
    await expect(zelle(4, 2)).toHaveAttribute('data-halt', '');
    /* Abgelegt auf 7,4: die Ankerzelle liegt dort, das Stück also bei 5,3. */
    await zelle(7, 4).click();
    await expect(zelle(7, 4)).toHaveClass(/belegt/);
    await expect(zelle(5, 4)).toHaveClass(/belegt/);
    await expect(zelle(6, 3)).toHaveClass(/belegt/);
    await expect(zelle(3, 2)).not.toHaveClass(/belegt/);

    const gelesen = (await (await (await api.als(rolle)).get(`/api/entities/${inv.id}`)).json()) as { relations: { type: string; props?: Record<string, unknown> }[] };
    expect(gelesen.relations.find((r) => r.type === 'holds')?.props).toMatchObject({ gx: 5, gy: 3 });
  }
});
