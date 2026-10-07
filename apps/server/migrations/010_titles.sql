-- Ein Typ darf ein geerbtes Feld umbenennen.
--
-- Derselbe `Time.until` ist an einem Ereignis, wann es aufhört, und an
-- einem Auftrag, wann es zu spät ist. Bis hierher hätte man dafür `Time`
-- verdoppeln müssen: zwei Bestandteile mit denselben Feldern, damit einer
-- von beiden anders beschriftet ist.
--
-- Ab hier trägt die Artikelart eine Karte `Typ.feld` → Beschriftung, die
-- wie `area` und `units` die `extends`-Kette hoch geerbt wird. Es ist
-- **keine** zweite Feldliste: der Bestandteil bleibt einer, und ein Feld,
-- das morgen dazukommt, bringt seinen eigenen Namen mit.

alter table interface_def add column if not exists titles jsonb;
