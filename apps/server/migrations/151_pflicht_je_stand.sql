-- Pflicht je Stand (T-425, REQ-441, E-177, E-180).
--
-- `required` gilt immer; neu darf ein Feld (`requiredFor` im Schema), eine
-- Kantenart und eine Art (`Typ.feld` bzw. `edge:<Kantenart>` → Stand) sagen,
-- dass etwas erst für `prepared` oder `ready` Pflicht ist. Das Feld steht im
-- Schema (jsonb, ohne Spalte); Art und Kante brauchen je eine Spalte.
--
-- Leer heisst: nichts ist je Stand Pflicht — so verhält sich jede
-- bestehende Installation wie bisher. Kein Artikel wird geändert.

alter table interface_def add column if not exists required_for jsonb;
alter table relation_def add column if not exists required_for text;
