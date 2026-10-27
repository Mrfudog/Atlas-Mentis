import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { contrastRatio, elementStyle, TOKEN_SLOTS, tokenContrast, tokenVars } from '../src/tokens.js';
import { RegistrySchema } from '../src/validate.js';
import type { Registry, ViewDef } from '../src/types.js';

/**
 * **Design-Tokens** (T-425, REQ-437, E-170 a): Farben sind Registerzeilen
 * mit Rolle, Wert hell und dunkel; ein Element nennt je Stelle ein Token,
 * die Ansicht gibt je Elementart vor. Der Kontrast wird geprüft.
 */
const mit = (tokens: Registry['tokens']): Registry => ({ ...seedRegistry, tokens: { ...seedRegistry.tokens, ...tokens } });

describe('contrastRatio', () => {
  it('Schwarz auf Weiss ist 21, gleich auf gleich 1, kurze Hex-Werte gehen', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
  });
  it('kein Hex-Wert gibt null — gerechnet wird nur, was sich rechnen lässt', () => {
    expect(contrastRatio('var(--x)', '#fff')).toBeNull();
  });
});

describe('die Tokens im Register', () => {
  it('das Register bringt die Farben der Seite mit, hell und dunkel wie in styles.scss', () => {
    expect(seedRegistry.tokens?.['paper']).toMatchObject({ role: 'surface', light: '#fdf1dc', dark: '#2a2119' });
    expect(seedRegistry.tokens?.['ink']).toMatchObject({ role: 'text', light: '#2b1d12', dark: '#eadfca' });
    expect(seedRegistry.tokens?.['accent']).toMatchObject({ light: '#8c1c13', dark: '#d0675a' });
  });
  it('der Kontrast der Vorgaben hält, hell und dunkel', () => {
    expect(tokenContrast(seedRegistry)).toEqual([]);
  });
  it('ein Text auf seiner Fläche unter 4.5 wird gemeldet, mit Modus und Wert', () => {
    const r = mit({ blass: { label: 'Pale text', role: 'text', on: 'paper', light: '#f0e0c0', dark: '#eadfca' } });
    expect(tokenContrast(r)).toEqual([{ token: 'blass', on: 'paper', mode: 'light', ratio: expect.any(Number) }]);
    expect(tokenContrast(r)[0]!.ratio).toBeLessThan(4.5);
  });
  it('tokenVars: je Token eine CSS-Variable, je Modus', () => {
    const v = tokenVars(seedRegistry, 'dark');
    expect(v['--tok-paper']).toBe('#2a2119');
    expect(tokenVars(seedRegistry, 'light')['--tok-paper']).toBe('#fdf1dc');
  });
  it('die Prüfung behält Tokens, Stellen am Element und Vorgaben der Ansicht', () => {
    const r = RegistrySchema.parse({
      ...seedRegistry,
      views: { ...seedRegistry.views, probe: { label: 'P', fields: 'all', styles: { section: { head: 'accent' } }, layout: [{ id: 's', el: 'section', style: { surface: 'paper' } }] } },
    });
    expect(r.views['probe']).toMatchObject({ styles: { section: { head: 'accent' } }, layout: [{ style: { surface: 'paper' } }] });
    expect(r.tokens?.['paper']?.light).toBe('#fdf1dc');
    expect(() => RegistrySchema.parse({ ...seedRegistry, tokens: { x: { label: 'X', role: 'loud', light: '#000', dark: '#000' } } })).toThrow();
  });
});

describe('elementStyle', () => {
  const view: ViewDef = { label: 'Quick', fields: 'all', styles: { section: { head: 'accent', surface: 'paper' } } };
  it('die Ansicht gibt je Elementart vor, das Element überschreibt je Stelle', () => {
    expect(elementStyle(seedRegistry, view, { id: 's', el: 'section', style: { surface: 'surface' } })).toEqual({ head: 'accent', surface: 'surface' });
  });
  it('ein Token, das es nicht gibt, gilt nicht — die Stelle fällt auf die Seite zurück', () => {
    expect(elementStyle(seedRegistry, view, { id: 's', el: 'section', style: { head: 'gibtsnicht' } })).toEqual({ head: 'accent', surface: 'paper' });
    expect(elementStyle(seedRegistry, undefined, { id: 't', el: 'text' })).toEqual({});
  });
  it('vier Stellen', () => {
    expect(TOKEN_SLOTS).toEqual(['head', 'surface', 'frame', 'text']);
  });
});

describe('die Vorgabe der Ansicht kommt in die Elemente (pickView)', () => {
  it('jedes Element einer Art bekommt die Vorgabe, was es selbst sagt, bleibt', async () => {
    const { pickView } = await import('../src/viewScope.js');
    const r: Registry = {
      ...seedRegistry,
      views: {
        ...seedRegistry.views,
        quick: { ...seedRegistry.views['quick']!, styles: { description: { surface: 'paper', text: 'dim' } } },
      },
    };
    const e = { id: 'x', interfaces: ['Item'], name: 'x', components: {} };
    const d = pickView(e, r, 'quick').layout.find((x) => x.el === 'description');
    expect(d?.style).toEqual({ surface: 'paper', text: 'dim' });
    const ohne = pickView(e, seedRegistry, 'quick').layout.find((x) => x.el === 'description');
    expect(ohne?.style).toBeUndefined();
  });
  it('withViewStyles geht auch in Behälter und Reiter, und das Element schlägt die Vorgabe', async () => {
    const { withViewStyles } = await import('../src/tokens.js');
    const l = withViewStyles(
      [{ id: 's', el: 'section', style: { head: 'heading' }, children: [{ id: 't', el: 'text' }] }],
      { styles: { section: { head: 'accent', frame: 'line' }, text: { text: 'dim' } } },
    );
    expect(l[0]!.style).toEqual({ head: 'heading', frame: 'line' });
    expect(l[0]!.children![0]!.style).toEqual({ text: 'dim' });
  });
});

describe('Werkbank: Token contrast (T-425, E-170)', () => {
  it('meldet ein zu schwaches Token mit dem Weg ins Register', async () => {
    const { CHECKS } = await import('../src/checks.js');
    const c = CHECKS.find((x) => x.key === 'tokenContrast')!;
    expect(c.run({ registry: seedRegistry, entities: [], exists: new Map() })).toEqual([]);
    const r = mit({ blass: { label: 'Pale text', role: 'text', on: 'paper', light: '#f0e0c0', dark: '#eadfca' } });
    expect(c.run({ registry: r, entities: [], exists: new Map() })).toEqual([
      expect.objectContaining({ id: 'token:blass:light', type: 'token', registry: { tab: 'tokens', token: 'blass' } }),
    ]);
  });
});
