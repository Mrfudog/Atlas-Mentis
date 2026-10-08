-- `Identity.key` wird `Identity.id`.
--
-- Der Schlüssel hiess `npc/volo-geddarm`: ein Name, der ein zweites Mal
-- derselbe Name war. Beim Umbenennen musste er entweder mitwandern — dann
-- war er kein fester Bezeichner — oder nicht, und dann log er. Eine Nummer
-- sagt nichts und bleibt deshalb richtig; wie der Artikel heisst, steht
-- daneben.
--
-- Vergeben wird `art-nnnn`, je Artikelart durchgezählt, in der Reihenfolge,
-- in der die Artikel angelegt wurden. Ausgegeben, nicht gerechnet: ein
-- `derived` entstünde bei jedem Lesen neu (D8), und dann hiesse derselbe
-- Artikel morgen anders, sobald jemand vor ihm einen anderen anlegt.

-- Die Nummern, je Art durchgezählt. `__meta.interfaces[0]` sagt die Art —
-- dieselbe Stelle, die auch sonst entscheidet, was ein Artikel ist.
with art as (
  select c.entity_id,
         lower(regexp_replace(
           coalesce(m.payload -> 'interfaces' ->> 0, 'article'),
           '[^A-Za-z0-9]+', '-', 'g')) as prefix,
         e.created_at
  from component c
  join entity e on e.id = c.entity_id
  left join component m on m.entity_id = c.entity_id and m.type = '__meta'
  where c.type = 'Identity'
), nummeriert as (
  select entity_id, prefix,
         row_number() over (partition by prefix order by created_at, entity_id) as n
  from art
)
update component c
set payload = (c.payload - 'key')
  || jsonb_build_object('id', n.prefix || '-' || lpad(n.n::text, 4, '0'))
from nummeriert n
where c.entity_id = n.entity_id and c.type = 'Identity';

-- Und die Freigaben, die auf den alten Verweis zeigen. Ohne das stünde der
-- Name offen da, und niemand fände den Grund.
update component
set payload = jsonb_set(
      payload, '{fields}',
      (select coalesce(jsonb_agg(case when f = '"Identity.key"'::jsonb
                                      then '"Identity.id"'::jsonb else f end), '[]'::jsonb)
       from jsonb_array_elements(payload -> 'fields') f))
where type = 'Information'
  and jsonb_typeof(payload -> 'fields') = 'array'
  and payload -> 'fields' @> '["Identity.key"]'::jsonb;
