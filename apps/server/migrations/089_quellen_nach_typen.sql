-- Quellen nach Typen und einzelne Artikel (T-187).
--
-- Zwei neue Kantenarten an der Kampagne und eine Eigenschaft an
-- `activates`, nachgezogen auf bestehende Datenbanken (der Seed schreibt
-- Kantenarten nur in eine leere):
--
-- - `layerRule` (Campaign → Layer): eine Typ-Regel an einer Gruppe — was
--   jede Ebene darin bringt, wo sie im Spiel ist und selbst nichts sagt.
-- - `enables` (Campaign → *): ein einzelner Artikel ist im Spiel, auch wenn
--   seine Ebene es nicht ist (Extra-Inhalt aus einer Vergleichsebene).
-- - `activates.props.exempt`: die Ebene ist von den Typ-Regeln ausgenommen.
--
-- Ergänzt wird nur; kein Artikel und keine Kante wird geändert.

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select v.* from (values
  ('layerRule', 'Type rule for', 'Type rule in', '{Campaign}'::text[], '{Layer}'::text[], false, 'many',
   '{"type":"object","properties":{"areas":{"type":"array","items":{"type":"string"},"title":"Areas"},"types":{"type":"array","items":{"type":"string"},"title":"Types"}}}'::jsonb,
   'A campaign says what every layer in a group brings when that layer says nothing itself; the group lists the campaigns with such a rule.'),
  ('enables', 'Extra content', 'Enabled in', '{Campaign}'::text[], '{*}'::text[], false, 'many',
   '{}'::jsonb,
   'A campaign puts a single article in play although its layer is not; the article lists the campaigns that enabled it.')
) as v(type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
where exists (select 1 from relation_def)
on conflict (type) do nothing;

update relation_def
   set props = jsonb_set(
         coalesce(props, '{"type":"object"}'::jsonb),
         '{properties}',
         coalesce(props -> 'properties', '{}'::jsonb)
           || '{"exempt":{"type":"boolean","title":"Exempt from type rules"}}'::jsonb)
 where type = 'activates'
   and not (coalesce(props -> 'properties', '{}'::jsonb) ? 'exempt');
