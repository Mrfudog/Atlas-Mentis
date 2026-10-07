-- Marken werden ein Bestandteil.
--
-- `tags` war die einzige Eigenschaft, die keiner Artikelart gehörte: sie
-- fuhr im Umschlag `__meta` mit, neben `interfaces`, `adhoc` und `blocks`.
-- Damit war sie auch die einzige, die man an keiner Art weglassen konnte —
-- eine Ausnahme im Rückgrat, das sonst nur Zeilen kennt.
--
-- Ab hier ist es die Karte `Tags` mit dem Feld `tags`, und die Artikelarten
-- erben sie wie jeden anderen Bestandteil.
--
-- Leer heisst weg: ein Artikel ohne Marken bekommt keine leere Karte.
-- Abwesend ist „trägt keine Marken"; eine leere Karte wäre eine dritte
-- Antwort auf eine Frage mit zwei.

insert into component (entity_id, type, payload)
select c.entity_id, 'Tags', jsonb_build_object('tags', c.payload -> 'tags')
from component c
where c.type = '__meta'
  and jsonb_typeof(c.payload -> 'tags') = 'array'
  and jsonb_array_length(c.payload -> 'tags') > 0
on conflict (entity_id, type) do update set payload = excluded.payload;

update component
set payload = payload - 'tags'
where type = '__meta' and payload ? 'tags';
