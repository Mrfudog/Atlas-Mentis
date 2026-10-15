-- Würfe auf einem Artikel (T-172): gewürfelt wird am Server, jeder Wurf ist
-- ein Eintrag `roll` im Protokoll (`event_log`, subject = der Artikel).
--
--  1. `Campaign.playerRolls` — wer die Würfe der Spielenden sieht (der Tisch
--     oder nur die Leitung). Der Seed schreibt nur in eine leere Datenbank,
--     also kommt das Feld hier nach. Geändert wird nur das Register.
--  2. Ein Index für das Log einer Sitzung: die Würfe, die während ihr
--     fielen, stehen an ihrem Artikel und nicht als `subject`.
--
-- Nichts fällt weg.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,playerRolls}',
         '{"type":"string","title":"Player rolls visible to","enum":["table","gm"],"default":"table"}'::jsonb
       )::json
 where name = 'Campaign'
   and (schema::jsonb -> 'properties') ? 'craftConfirm'
   and not (schema::jsonb -> 'properties') ? 'playerRolls';

create index if not exists event_log_roll_session_idx
    on event_log ((payload->>'session'), at desc)
 where name = 'roll';
