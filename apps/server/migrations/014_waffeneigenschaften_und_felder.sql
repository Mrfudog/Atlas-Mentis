-- Waffeneigenschaften werden Kanten, und fünf Felder fallen weg.
--
-- `Weapon.Properties` hielt die Eigenschaften als Text: „finesse, leicht".
-- Das kopiert, was geteilt gehört — eine Eigenschaft ist eine Regel, und
-- dieselbe Regel steht an dreissig Waffen. Genau darum ging es beim Import:
-- `[[Versatil]]` war ein Verweis und keine Zeichenkette. Als Text findet
-- der Merkzettel am Tisch sie nicht, und wer die Regel ändert, ändert sie
-- an einer Waffe. Die Wanderung der Werte macht
-- `prototype/migration/waffeneigenschaften.mjs` — sie legt für eine
-- Eigenschaft ohne Regel eine leere an (`status: idea`), statt einen
-- Regeltext zu erfinden, den niemand geprüft hat.
--
-- Dazu:
--   Place.settlementType  weg — `kind` sagt es schon (Stadt, Distrikt, …)
--   Place.since           weg — seit wann ist ein Datum, und `Time` führt Daten
--   Group.purpose         weg — wozu steht in der Beschreibung
--   Item.availability     bleibt, heisst aber „Purchase rarity": es ist die
--                         Kaufrarität und nicht die Seltenheit
--   Group                 wandert von `play` nach `rules`: eine Gruppe
--                         richtet man ein, bevor gespielt wird

update component set payload = payload - 'Properties'
where type = 'Weapon' and payload ? 'Properties';

update component set payload = payload - 'settlementType' - 'since'
where type = 'Place' and (payload ? 'settlementType' or payload ? 'since');

update component set payload = payload - 'purpose'
where type = 'Group' and payload ? 'purpose';

delete from component where payload = '{}'::jsonb;

update interface_def set area = 'rules' where name = 'Group';
