-- Design-Tokens als Registerteil (T-425, REQ-437, E-170 a).
--
-- Die Farben der Seite standen nur in `apps/web/src/styles.scss`. Ein
-- Element im Ansichtsdesigner soll eine Farbe nennen können, ohne einen
-- Farbcode zu tippen: ein Token mit Rolle (Fläche, Text, Akzent, Linie)
-- und je einem Wert hell und dunkel. Eine Zeile je Token, ganz als JSON —
-- wie `enum_def` (Migration 019), damit eine neue Eigenschaft nicht an
-- einer Spalte verloren geht.
--
-- Vorbelegt mit denselben Werten wie `styles.scss` und
-- `packages/registry/src/tokens.ts`; eine Zeile, die es schon gibt, bleibt.
-- Kein Artikel wird geändert; bis jemand ein Token an ein Element setzt,
-- sieht die Seite aus wie vorher.

create table if not exists token_def (
  name    text primary key,
  config  jsonb not null
);

insert into token_def (name, config) values
  ('paper', '{"label":"Paper","role":"surface","light":"#fdf1dc","dark":"#2a2119","description":"The sheet of an article."}'::jsonb),
  ('surface', '{"label":"Surface","role":"surface","light":"#fbf6ec","dark":"#251e17","description":"Tables and boxes."}'::jsonb),
  ('page', '{"label":"Page","role":"surface","light":"#efe4cc","dark":"#1c1712","description":"The page behind the sheets."}'::jsonb),
  ('chip', '{"label":"Chip","role":"surface","light":"#eadcc0","dark":"#3a2e22","description":"Small badges and chips."}'::jsonb),
  ('accent-soft', '{"label":"Accent, soft","role":"surface","light":"rgba(140, 28, 19, 0.08)","dark":"rgba(208, 103, 90, 0.14)","description":"A faint wash of the accent behind something marked."}'::jsonb),
  ('ink', '{"label":"Ink","role":"text","light":"#2b1d12","dark":"#eadfca","description":"Body text."}'::jsonb),
  ('dim', '{"label":"Dim","role":"text","light":"#6a5642","dark":"#b09c80","description":"Secondary text: labels, notes."}'::jsonb),
  ('heading', '{"label":"Heading","role":"text","light":"#7a200d","dark":"#e08a74","description":"Headings."}'::jsonb),
  ('accent', '{"label":"Accent","role":"accent","light":"#8c1c13","dark":"#d0675a","description":"The red of buttons and marks."}'::jsonb),
  ('blue', '{"label":"Blue","role":"accent","light":"#2f5d7c","dark":"#7fb0d4"}'::jsonb),
  ('green', '{"label":"Green","role":"accent","light":"#4c6b2a","dark":"#9cc070"}'::jsonb),
  ('purple', '{"label":"Purple","role":"accent","light":"#6b3d75","dark":"#c49ad0"}'::jsonb),
  ('teal', '{"label":"Teal","role":"accent","light":"#2e6e64","dark":"#74c2b5"}'::jsonb),
  ('gold', '{"label":"Gold","role":"line","light":"#c8822e","dark":"#b77a33","description":"Ornament: rules and frames, not text."}'::jsonb),
  ('line', '{"label":"Line","role":"line","light":"#cdbb98","dark":"#4a3d2e","description":"Frames and dividers."}'::jsonb)
on conflict (name) do nothing;
