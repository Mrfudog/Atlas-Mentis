-- Ein Abenteuer ist eine eigene Ebenenart (T-082, REQ-240).
--
-- T-081 legte je Buch aus 5e.tools eine Ebene an, `kind: 'book'`, und
-- unterschied Abenteuer nur an der Marke `adventure` (die Gruppe auf der
-- Kampagnenseite). Seit T-082 bringt ein Abenteuer mehr als Regeln —
-- Kapitel, Abschnitte, Begegnungen, Karten —, und seine Ebene heisst so:
-- `kind: 'adventure'`. Wie jedes `kind` ist das Beschreibung: die
-- Kampagnenseite gruppiert danach, die Ausfuhr lässt es als Buchtext weg.
--
-- Gelöscht wird nichts; es wechselt nur das Wort an den Ebenen, die der
-- Importer oder die Migration 026 als Abenteuer markiert hat.

update component
   set payload = jsonb_set(payload, '{kind}', '"adventure"')
 where type = 'Layer'
   and payload->>'kind' = 'book'
   and entity_id in (
     select t.entity_id
       from component t
      where t.type = 'Tags'
        and jsonb_typeof(t.payload->'tags') = 'array'
        and t.payload->'tags' ? 'adventure'
   );

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select entity_id from component where type = 'Layer' and payload->>'kind' = 'adventure');
