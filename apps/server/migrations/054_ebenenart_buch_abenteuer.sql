-- Die Ebenenarten `book` und `adventure` am Register nachtragen (T-087).
--
-- T-081 (026) legte je Buch eine Ebene mit `Layer.kind: 'book'` an, T-082
-- (029) die Abenteuer mit `adventure` — per SQL, an der Prüfung vorbei.
-- In die Registerzeile `Layer` kamen die beiden Werte nie; 034 trug nur
-- `group` nach. Solange keine neue Buchebene durch `validateEntity` ging,
-- fiel das nicht auf. Der erste Lauf `only-new` mit 2024 (T-087) brachte
-- 58 neue Ebenen und scheiterte an genau diesen beiden Werten, ohne etwas
-- zu schreiben.
--
-- Wie 034: nur wo die Zeile steht und der Wert fehlt. Entfernt wird nichts.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,kind,enum}',
     (schema::jsonb #> '{properties,kind,enum}') || coalesce(
       (select jsonb_agg(v) from (values ('book'), ('adventure')) as neu(v)
         where not ((schema::jsonb #> '{properties,kind,enum}') ? v)),
       '[]'::jsonb
     )
   )::json
 where name = 'Layer'
   and jsonb_typeof(schema::jsonb #> '{properties,kind,enum}') = 'array';
