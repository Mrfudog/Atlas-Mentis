-- Das Tragblatt aus Bausteinen (REQ-356).
--
-- Die Einstellung `carrySheet` hält Basils Blatt als Bausteine mit Form,
-- Zonen und Bedingungen (JSON). Leer heisst: noch nicht gemalt — dann
-- rechnet das Inventar das Blatt weiter aus `carrySquares`/`carryZones`.
-- Die Regeloption „Basil's sheet" nennt sie, also steht sie in jeder
-- Installation, leer.
--
-- Nur, wo schon Einstellungen stehen: eine leere Tabelle füllt der Seed,
-- und eine einzelne Zeile darin hielte ihn davon ab. Nichts wird entfernt
-- oder geändert.

insert into setting_def (key, value)
select 'carrySheet', ''
 where exists (select 1 from setting_def)
on conflict (key) do nothing;
