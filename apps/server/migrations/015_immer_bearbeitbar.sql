-- Ein Typ sagt, ob seine Felder immer bearbeitet werden.
--
-- Der Stand der Trefferpunkte wird mitten im Zug gesetzt, und erst
-- „Bearbeiten" zu sagen sind drei Klicks für eine Zahl. `always_edit` steht
-- am Typ und gilt für die Felder, die **er** erklärt — vererbt wird es
-- nicht, sonst machte ein Haken an einem Obertyp die ganze Kreatur zum
-- Formular. Am einzelnen Feld steht dasselbe im Schema (`alwaysEdit`), und
-- das liegt ohnehin als JSON in `schema`.
--
-- Ohne diese Spalte stimmte im Speicher alles, der Seed brachte den Haken
-- bei jedem Start mit, und erst wer das Register über den Server speicherte,
-- hatte ihn nicht mehr. Genau so ging `area` einmal verloren.

alter table interface_def
  add column if not exists always_edit boolean not null default false;
