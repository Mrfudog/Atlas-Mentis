-- Wissen für Gruppen (T-285, REQ-350/351):
--  1. `Information.applies` — für welche Artikel eine Information gilt
--     (in der Form der Ansichten). Ohne Angabe wie bisher.
--  2. `knownBy` darf auch auf Herkunft, Hintergrund, Klasse, Unterklasse
--     und Talent zeigen: jede Figur, die das ist oder gewählt hat, weiss es.
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Geändert wird nur das Register; nichts fällt weg.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,applies}',
         '{"type":"object","title":"Applies to","description":"A group of articles this information holds for — types and conditions, like a view. Empty: only the article that lists it."}'::jsonb
       )::json
 where name = 'Information'
   and (schema::jsonb -> 'properties') ? 'fields'
   and not (schema::jsonb -> 'properties') ? 'applies';

update relation_def
   set to_ifaces = array_cat(to_ifaces, array(
         select x from unnest(array['Ancestry', 'Background', 'Class', 'Subclass', 'Feat']) x
          where not x = any(to_ifaces)
       )),
       means = 'Information or knowledge is known by a creature, party or faction (from a rank) — or by every character with an ancestry, background, class, subclass or feat; they list what they know.'
 where type = 'knownBy';
