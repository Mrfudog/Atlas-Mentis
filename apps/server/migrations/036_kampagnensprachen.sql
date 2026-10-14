-- Die Sprachen der Kampagne (T-095, REQ-251).
--
-- Die Kampagne nennt in `Campaign.languages`, welche Sprachen an ihrem
-- Tisch sinnvoll oder möglich sind; Sprachwahlen im Assistenten bieten
-- dann nur diese an (leer: jede). Das Feld hält Namen von
-- `Language`-Artikeln wie `Proficiencies.proficient`.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt das Feld hier
-- nach — **nur, wo die Art schon steht** und das Feld noch fehlt (wie 028,
-- 033). Die Reihenfolge der Felder richtet der Seed beim Start
-- (`ordneFelder`). Entfernt wird nichts.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,languages}',
     '{"type":"array","items":{"type":"string"},"enumRef":["Language"],"title":"Languages in play"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties' ? 'languages');
