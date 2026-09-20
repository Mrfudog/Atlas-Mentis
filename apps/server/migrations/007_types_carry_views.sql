-- Die Anordnung wohnt am Typ.
--
-- Sie stand an der Ansicht (`view_def.by_interface`), und das hiess: wer
-- wissen wollte, wie eine Artikelart gezeichnet wird, musste drei Ansichten
-- aufmachen und in jeder nach ihr suchen. Eine Kreatur ordnet ihre `full`
-- anders als ein Rezept — und das gehört zur Kreatur.
--
-- Die Spieleransicht fällt dabei weg. Sie war die zweite Stelle, an der
-- stand, was ein Spieler nicht sehen darf; zurückgehalten wird am Server
-- (`redactEntity`), und wer weniger sehen darf, sieht dieselbe Ansicht mit
-- weniger darin.

alter table interface_def add column if not exists views jsonb;

-- Was an den Ansichten lag, zieht an die Typen.
update interface_def d
set views = coalesce(d.views, '{}'::jsonb) || jsonb_build_object(v.name, v.layout)
from (
  select vd.name, key as iface, value as layout
  from view_def vd, jsonb_each(coalesce(vd.by_interface, '{}'::jsonb))
) v
where d.name = v.iface;

alter table view_def drop column if exists by_interface;
delete from view_def where name = 'player';
