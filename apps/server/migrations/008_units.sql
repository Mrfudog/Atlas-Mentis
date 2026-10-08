-- Einheiten als Zeilen.
--
-- Der Vault ist imperial, weil die Regeln es sind: vierzig Fuss Bewegung,
-- dreissig Pfund Gepäck. Am Tisch sitzen Leute, für die das nichts
-- bedeutet. Beides in die Daten zu schreiben hiesse, zwei Zahlen zu haben,
-- die sich widersprechen können — also steht eine da, und die andere wird
-- beim Lesen gerechnet (D8).
--
-- `base` ist, wie viel eine Einheit in der Grundeinheit ihrer Grösse ist:
-- ein Fuss sind 0,3048 Meter. Damit ist jede Umrechnung eine Division, und
-- eine neue Einheit ist ein `insert` und keine Codeänderung.

create table if not exists unit_def (
  code      text primary key,
  label     text not null,
  quantity  text not null,
  system    text not null check (system in ('imperial','metric')),
  base      double precision not null check (base > 0),
  aliases   text[] not null default '{}',
  decimals  int
);

-- Welches System eine Artikelart zeigt. Ohne Angabe gilt die Einstellung
-- der Kampagne (`settings.units`) — eine Kreatur darf imperial bleiben,
-- weil ihre Zahlen aus dem Regelwerk kommen.
alter table interface_def add column if not exists units text;
alter table interface_def drop constraint if exists interface_def_units_check;
alter table interface_def add constraint interface_def_units_check
  check (units is null or units in ('imperial','metric','both'));
