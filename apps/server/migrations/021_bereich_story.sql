-- Der Bereich `history` heisst `story` (Entscheidung der Leitung, 13.10.).
--
-- „History" mischte zwei Dinge: was in der Kampagne geschah (Sitzungen,
-- Szenen, Aufträge) und die Geschichte der Welt. Was nur die Kampagne
-- betrifft, steht jetzt unter `story`; die Weltgeschichte (`Event`) unter
-- `world`, wo die Welt selbst schon steht. `area` ist eine Registerzeile —
-- hier wird nur der Wert umgeschrieben, kein Artikel ändert sich.
update interface_def set area = 'world' where name = 'Event' and area = 'history';
update interface_def set area = 'story' where area = 'history';
