-- Aufzählungen und Einstellungen am Server.
--
-- Das Register hatte zwei Teile, die nur der Prototyp kannte: `enums` (die
-- Zeilen, aus denen Felder mit `enumRef` ihre Werte holen — Size, Ability,
-- DamageType, DrawTime …) und `settings` (die Einstellungen der Kampagne —
-- carrySquares, slotDraw, gmFields …). Am Server gab es dafür keine
-- Tabelle; die Auswahllisten der Oberfläche blieben leer, und jede
-- Einstellung galt mit ihrer eingebauten Vorgabe. Der Ladebefehl sagte es
-- („Nicht gespeichert … enums, settings“), aber es fehlte trotzdem.
--
-- Eine Zeile je Aufzählung, die ganze Zeile als JSON: eine Aufzählung
-- trägt ausser `values` noch Beschriftungen und Gruppen, und eine Spalte
-- je Eigenschaft wäre die Stelle, an der die nächste verloren geht
-- (pg-registry.test.ts erzählt, wie das bei `area` war).

create table if not exists enum_def (
  name    text primary key,
  config  jsonb not null
);

create table if not exists setting_def (
  key    text primary key,
  value  text not null
);
