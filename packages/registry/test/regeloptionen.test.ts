import { describe, expect, it } from 'vitest';
import { RULE_OPTIONS } from '@nw/model';
import { seedRegistry, settings } from '../src/index.js';

/* Die Seite „Rules & options" (T-190) zeigt jedes Feld der Kampagne und
   jede Variante, die das Register kennt — kommt ein Wert dazu, bricht
   dieser Test und nicht die Seite, die ihn still verschweigt. */
describe('Regeloptionen und Register (T-190)', () => {
  const props = seedRegistry.interfaces['Campaign']!.schema!.properties as Record<string, { enum?: unknown[]; type?: string }>;
  const eigene = Object.keys(props);

  it('nennt jedes Feld von CampaignInfo', () => {
    const genannt = RULE_OPTIONS.flatMap((o) => ('field' in o.source ? [o.source.field] : []));
    expect([...genannt].sort()).toEqual([...eigene].sort());
  });

  it('hat für jeden Aufzählungswert eine Variante', () => {
    for (const o of RULE_OPTIONS) {
      if (!('field' in o.source) || !o.variants) continue;
      const p = props[o.source.field]!;
      const werte = p.type === 'boolean' ? ['true', 'false'] : (p.enum ?? []).map(String);
      expect(o.variants.map((v) => v.key).sort(), o.key).toEqual([...werte].sort());
    }
  });

  it('nennt nur Einstellungen, die es gibt', () => {
    for (const o of RULE_OPTIONS) {
      if (!('settings' in o.source)) continue;
      for (const k of o.source.settings) {
        if (k.endsWith('*')) expect(Object.keys(settings).some((s) => s.startsWith(k.slice(0, -1))), k).toBe(true);
        else expect(Object.keys(settings), k).toContain(k);
      }
    }
  });
});
