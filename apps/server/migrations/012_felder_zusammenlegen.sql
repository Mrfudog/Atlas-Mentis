-- Doppelte Felder zusammenlegen.
--
-- Vier Stellen sagten dasselbe zweimal, und jedes Mal wurde die eine
-- gefüllt und die andere gelesen:
--
--   Map.image     -> Image.image   (eine Karte hat ein Bild wie jeder
--                                   andere Artikel, und genau das ist ihr
--                                   Hintergrund)
--   Table.note    -> Notes.note    (eine Notiz ist eine Notiz)
--   Access.note   -> Notes.note
--
-- Die Wanderung der Werte macht
-- `prototype/migration/felder-zusammenlegen.mjs`; hier steht nur dasselbe
-- für die Datenbank.

-- Das Kartenbild. Steht schon eines an `Image`, gewinnt es — sonst
-- überschriebe die Wanderung, was jemand nach dem Umzug gesetzt hat.
insert into component (entity_id, type, payload)
select m.entity_id, 'Image', jsonb_build_object('image', m.payload -> 'image')
from component m
where m.type = 'Map' and m.payload ? 'image'
on conflict (entity_id, type) do update
  set payload = component.payload || jsonb_build_object('image',
        coalesce(component.payload -> 'image', excluded.payload -> 'image'));

update component set payload = payload - 'image' where type = 'Map' and payload ? 'image';

-- Die Notizen. `Notes.note` trägt Einträge `{id, value}`, weil an der Id
-- die Wissensfreigabe hängt.
insert into component (entity_id, type, payload)
select n.entity_id, 'Notes',
       jsonb_build_object('note', jsonb_build_array(
         jsonb_build_object('id', 'note-' || left(regexp_replace(lower(n.payload ->> 'note'),
                                                   '[^a-z0-9]+', '-', 'g'), 40),
                            'value', n.payload ->> 'note')))
from component n
where n.type in ('Table', 'Access')
  and jsonb_typeof(n.payload -> 'note') = 'string'
  and length(trim(n.payload ->> 'note')) > 0
on conflict (entity_id, type) do update
  set payload = jsonb_set(component.payload, '{note}',
        coalesce(component.payload -> 'note', '[]'::jsonb) || (excluded.payload -> 'note'));

update component set payload = payload - 'note' where type in ('Table', 'Access') and payload ? 'note';

-- Und die leer gewordenen Karten. „Da ist eine Karte, aber sie ist leer"
-- ist eine dritte Antwort auf eine Frage mit zwei.
delete from component where payload = '{}'::jsonb;
