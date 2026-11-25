import type { TokenDef } from '@nw/model';

/**
 * **Die Design-Tokens** (T-425, REQ-437, E-170 a): die Farben der Seite als
 * Registerzeilen, mit denselben Werten wie `apps/web/src/styles.scss` (hell
 * und dunkel). Ein Element nennt ein Token, nie eine Farbe; die Oberfläche
 * setzt je Token `--tok-<name>`. Ein Text oder Akzent nennt die Fläche, auf
 * der er steht (`on`, Vorgabe `paper`), und die Werkbank prüft den Kontrast.
 * Was Zierde ist (Gold, Linien), hat die Rolle `line` und keine Prüfung.
 */
export const tokens: Record<string, TokenDef> = {
  paper: { label: 'Paper', role: 'surface', light: '#fdf1dc', dark: '#2a2119', description: 'The sheet of an article.' },
  surface: { label: 'Surface', role: 'surface', light: '#fbf6ec', dark: '#251e17', description: 'Tables and boxes.' },
  page: { label: 'Page', role: 'surface', light: '#efe4cc', dark: '#1c1712', description: 'The page behind the sheets.' },
  chip: { label: 'Chip', role: 'surface', light: '#eadcc0', dark: '#3a2e22', description: 'Small badges and chips.' },
  'accent-soft': { label: 'Accent, soft', role: 'surface', light: 'rgba(140, 28, 19, 0.08)', dark: 'rgba(208, 103, 90, 0.14)', description: 'A faint wash of the accent behind something marked.' },
  ink: { label: 'Ink', role: 'text', light: '#2b1d12', dark: '#eadfca', description: 'Body text.' },
  dim: { label: 'Dim', role: 'text', light: '#6a5642', dark: '#b09c80', description: 'Secondary text: labels, notes.' },
  heading: { label: 'Heading', role: 'text', light: '#7a200d', dark: '#e08a74', description: 'Headings.' },
  accent: { label: 'Accent', role: 'accent', light: '#8c1c13', dark: '#d0675a', description: 'The red of buttons and marks.' },
  blue: { label: 'Blue', role: 'accent', light: '#2f5d7c', dark: '#7fb0d4' },
  green: { label: 'Green', role: 'accent', light: '#4c6b2a', dark: '#9cc070' },
  purple: { label: 'Purple', role: 'accent', light: '#6b3d75', dark: '#c49ad0' },
  teal: { label: 'Teal', role: 'accent', light: '#2e6e64', dark: '#74c2b5' },
  gold: { label: 'Gold', role: 'line', light: '#c8822e', dark: '#b77a33', description: 'Ornament: rules and frames, not text.' },
  line: { label: 'Line', role: 'line', light: '#cdbb98', dark: '#4a3d2e', description: 'Frames and dividers.' },
};
