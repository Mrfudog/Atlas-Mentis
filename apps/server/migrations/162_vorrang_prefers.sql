-- Vorrang an der Kampagne (T-403, E-111 a).
--
-- Eine neue Kantenart, nachgezogen auf bestehende Datenbanken (der Seed
-- schreibt Kantenarten nur in eine leere):
--
-- - `prefers` (Campaign → *): welche Fassung derselben Sache Listen und
--   Verweise zeigen — ein Artikel, oder eine Ebene für einzelne Arten
--   (`props.types`); `props.over` nennt, worüber.
--
-- Ergänzt wird nur; kein Artikel und keine Kante wird geändert.
-- Nummer beim Anlegen nachgesehen: 162.

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'prefers', 'Prefers', 'Preferred in', '{Campaign}'::text[], '{*}'::text[], false, 'many',
       '{"type":"object","properties":{"over":{"type":"string","title":"Over"},"types":{"type":"array","items":{"type":"string"},"title":"Types"}}}'::jsonb,
       'A campaign shows this version first among the versions of the same thing — a single article, or a layer for some types; the article or layer lists the campaigns that prefer it.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;
