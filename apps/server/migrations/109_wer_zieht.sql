-- Wer Tokens zieht (T-290, E-040, REQ-135).
--
-- `Campaign.tokenMove`: welche Tokens Spielende ziehen — keine (`none`),
-- die eigenen Figuren (`own`, die Vorgabe und was bisher galt), die der
-- Gruppe (`party`), dazu die Verbündeten (`allies`) oder jedes (`all`).
-- Ob ein Zug sofort gilt, sagt weiter `Campaign.moves`.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,tokenMove}',
         '{"type":"string","title":"Who moves tokens","description":"Which tokens players may move on a map: none, their own characters, the party, the party and its allies, or every token. The GM always moves everything.","enum":["none","own","party","allies","all"],"default":"own"}'::jsonb
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'tokenMove');
