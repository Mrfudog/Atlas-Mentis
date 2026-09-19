/* Das Rechenwerk des Prototyps, direkt geprüft.
   Bis hierher lief es nur über die Oberfläche mit — und genau dort fiel nicht
   auf, dass die Umbenennung `breite(rows)` zu `width(rows)` gemacht hatte,
   während die Funktion `breite` hiess. Breite und Felder rechneten seither
   nichts; die Zelle blieb einfach leer, was in einer Ansicht wie ein leeres
   Feld aussieht. Ein Ausdruck gehört gegen Zahlen geprüft, nicht gegen die
   Abwesenheit einer Fehlermeldung. */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const seite = readFileSync(join(process.cwd(), 'nebelwacht-artikel.html'), 'utf8');
const js = [...seite.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const von = js.indexOf('function evalArith');
const bis = js.indexOf('function fmtVal');
if (von < 0 || bis < 0) throw new Error('evalArith/fmtVal nicht gefunden — Datei umgebaut?');
const tmp = join(process.cwd(), '_calc.tmp.mjs');
writeFileSync(tmp, `${js.slice(von, bis)}\nexport { derivedValue, evalArith };\n`);
const { derivedValue, evalArith } = await import(`file://${tmp}`);
unlinkSync(tmp);

let fehler = 0;
const ist = (name, wert, soll) => {
  const ok = Object.is(wert, soll);
  if (!ok) fehler++;
  console.log(`${ok ? '  ok  ' : 'FEHLT '} ${name}${ok ? '' : ` — ${wert} statt ${soll}`}`);
};

/* Arithmetik */
ist('2*-3 ist -6, nicht -3', evalArith('2*-3'), -6);   // unäres Minus bindet enger
ist('-(2+3) ist -5', evalArith('-(2+3)'), -5);
ist('10+2*3 ist 16', evalArith('10+2*3'), 16);
ist('Unsinn gibt null, nicht 0', evalArith('((1+'), null);

/* Rasterfunktionen gegen die echte Startbelegung */
const comps = JSON.parse(readFileSync(join(process.cwd(), 'dbdump/registry/components.json'), 'utf8'));
const fp = comps.Footprint.schema.properties;
const kreuz = { rows: ['0X0', 'XXX', '0X0', '0X0', '0X0'] };
const balken = { rows: Array(4).fill('X'.repeat(16)) };
ist('Bastardschwert ist 3 breit', derivedValue(fp.width, kreuz), 3);
ist('Bastardschwert ist 5 hoch', derivedValue(fp.height, kreuz), 5);
ist('Bastardschwert besetzt 7 Felder', derivedValue(fp.cells, kreuz), 7);
ist('Holzbalken ist 16 breit', derivedValue(fp.width, balken), 16);
ist('Holzbalken besetzt 64 Felder', derivedValue(fp.cells, balken), 64);

/* 5e-Modifikatoren */
const sb = comps.StatblockInfo.schema.properties;
ist('passive Wahrnehmung bei WIS 12', derivedValue(sb.passivePerception, { wis: 12 }), 11);
ist('STR-Mod bei 18', derivedValue(sb.strMod, { str: 18 }), 4);
ist('INT-Mod bei 3 ist -4', derivedValue(sb.intMod, { int: 3 }), -4);
/* Ein halb gefüllter Statblock soll trotzdem darstellbar bleiben: ein
   fehlender Wert trägt 0 bei, statt den ganzen Ausdruck scheitern zu lassen. */
ist('fehlender Wert traegt 0 bei', derivedValue(sb.strMod, {}), 0);
ist('unaeres Minus in einem Ausdruck', evalArith('1-2*-3'), 7);

console.log(fehler ? `\n${fehler} check(s) failed.` : '\nAll checks passed.');
process.exit(fehler ? 1 : 0);
