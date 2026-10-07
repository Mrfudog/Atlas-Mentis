-- Der Bereich einer Artikelart gehört an ihre Zeile (CLAUDE.md, D19): `area`
-- sagt, ob etwas unter Story, World, Game oder Play auftaucht, und steht
-- ausdrücklich nicht im Code, damit eine neue Artikelart ohne Codeänderung
-- auffindbar ist.
--
-- In Postgres gab es die Spalte nicht. Gelesen wurde der Bereich damit nie,
-- geschrieben auch nicht — wer das Register über den Server speicherte, bekam
-- es ohne Bereiche zurück, und jede Art lag danach unter „alle". Der Fehler
-- war still: im Speicher stimmte alles, und der Seed brachte die Bereiche bei
-- jedem Start neu mit.

alter table interface_def add column if not exists area text;
