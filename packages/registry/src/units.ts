import type { UnitDef } from '@nw/model';

/**
 * Einheiten als Zeilen.
 *
 * Der Vault ist imperial, weil die Regeln es sind: vierzig Fuss Bewegung,
 * dreissig Pfund Gepäck, hundertzwanzig Fuss Reichweite. Am Tisch sitzen
 * Leute, für die das nichts bedeutet. Beides in die Daten zu schreiben
 * hiesse, zwei Zahlen zu haben, die sich widersprechen können — also steht
 * eine da, und die andere wird beim Lesen gerechnet (D8).
 *
 * `base` ist die Grundeinheit der jeweiligen Grösse: Meter, Kilogramm,
 * Liter. Damit ist jede Umrechnung eine Division, und in welcher Einheit
 * ein Wert im Zielsystem dasteht, entscheidet die Grössenordnung — drei
 * Meilen sind knapp fünf Kilometer und nicht 4828 Meter.
 *
 * Die `aliases` sind die Schreibweisen, die im Fliesstext vorkommen. Sie
 * stehen hier und nicht im Code, weil der Vault deutsch schreibt und
 * niemand vorhersagt, wie jemand „Fuss" abkürzt.
 */
export const units: Record<string, UnitDef> = {
  /* ---- Länge. Grundeinheit: Meter ---- */
  ft: {
    code: 'ft',
    label: 'Feet',
    quantity: 'length',
    system: 'imperial',
    base: 0.3048,
    /* Schweizer Rechtschreibung, auch hier: `ss`. Wer „Fuß" schreibt,
       schreibt es im Vault nicht. */
    aliases: ['feet', 'foot', 'fuss', "'"],
    decimals: 0,
  },
  in: {
    code: 'in',
    label: 'Inches',
    quantity: 'length',
    system: 'imperial',
    base: 0.0254,
    aliases: ['inch', 'inches', 'zoll', '"'],
    decimals: 0,
  },
  mi: {
    code: 'mi',
    label: 'Miles',
    quantity: 'length',
    system: 'imperial',
    base: 1609.344,
    aliases: ['mile', 'miles', 'meile', 'meilen'],
    decimals: 1,
  },
  cm: { code: 'cm', label: 'Centimetres', quantity: 'length', system: 'metric', base: 0.01, decimals: 0 },
  m: {
    code: 'm',
    label: 'Metres',
    quantity: 'length',
    system: 'metric',
    base: 1,
    aliases: ['meter', 'metre', 'meters', 'metres'],
    decimals: 1,
  },
  km: {
    code: 'km',
    label: 'Kilometres',
    quantity: 'length',
    system: 'metric',
    base: 1000,
    aliases: ['kilometer', 'kilometre'],
    decimals: 1,
  },

  /* ---- Gewicht. Grundeinheit: Kilogramm ---- */
  lb: {
    code: 'lb',
    label: 'Pounds',
    quantity: 'weight',
    system: 'imperial',
    base: 0.45359237,
    aliases: ['lbs', 'pound', 'pounds', 'pfund'],
    decimals: 1,
  },
  oz: {
    code: 'oz',
    label: 'Ounces',
    quantity: 'weight',
    system: 'imperial',
    base: 0.0283495231,
    aliases: ['ounce', 'ounces', 'unze'],
    decimals: 1,
  },
  g: { code: 'g', label: 'Grams', quantity: 'weight', system: 'metric', base: 0.001, decimals: 0 },
  kg: {
    code: 'kg',
    label: 'Kilograms',
    quantity: 'weight',
    system: 'metric',
    base: 1,
    aliases: ['kilo', 'kilogramm'],
    decimals: 1,
  },

  /* ---- Rauminhalt. Grundeinheit: Liter ---- */
  gal: {
    code: 'gal',
    label: 'Gallons',
    quantity: 'volume',
    system: 'imperial',
    base: 3.785411784,
    aliases: ['gallon', 'gallons'],
    decimals: 1,
  },
  pt: {
    code: 'pt',
    label: 'Pints',
    quantity: 'volume',
    system: 'imperial',
    base: 0.473176473,
    aliases: ['pint', 'pints'],
    decimals: 1,
  },
  ml: { code: 'ml', label: 'Millilitres', quantity: 'volume', system: 'metric', base: 0.001, decimals: 0 },
  l: {
    code: 'l',
    label: 'Litres',
    quantity: 'volume',
    system: 'metric',
    base: 1,
    aliases: ['liter', 'litre', 'liters', 'litres'],
    decimals: 1,
  },
};
