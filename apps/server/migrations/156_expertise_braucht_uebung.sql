-- Expertise verlangt die Übung (T-303).
--
-- `Choices.choices[].needsProficiency`: bei einer Expertise-Wahl hebt
-- `false` auf, dass nur Geübtes gewählt werden darf. Ohne Angabe gilt die
-- Regel — also ändert sich an keiner bestehenden Wahl etwas, ausser dass
-- der Assistent Ungeübtes sperrt.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,choices,entry,properties,needsProficiency}',
         '{"type":"boolean","title":"Needs proficiency"}'::jsonb
       )::json
 where name = 'Choices'
   and jsonb_typeof(schema::jsonb #> '{properties,choices,entry,properties}') = 'object'
   and not ((schema::jsonb #> '{properties,choices,entry,properties}') ? 'needsProficiency');
