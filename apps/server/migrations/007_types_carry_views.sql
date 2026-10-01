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

-- **Berichtigt am 2026-10-01, bevor diese Datei irgendwo gelaufen ist.**
-- Sie las `view_def.name` und `view_def.by_interface` — Spalten, die es nie
-- gab: `view_def` hat seit 001 `key`, `label`, `ord` und `config`, und die
-- Anordnungen je Art standen in `config->'byInterface'`. Auf einer frischen
-- Datenbank brach die Kette deshalb hier ab, und kein Server kam hoch. Eine
-- gelaufene Migration wird nie geändert; diese ist nie gelaufen, denn sie
-- scheitert in ihrer Transaktion und steht darum in keiner
-- `schema_migrations`. Das Gerüst hatte noch nie ein Postgres gesehen.

alter table interface_def add column if not exists views jsonb;

-- Was an den Ansichten lag, zieht an die Typen.
update interface_def d
set views = coalesce(d.views, '{}'::jsonb) || jsonb_build_object(v.vname, v.layout)
from (
  select vd.key as vname, e.key as iface, e.value as layout
  from view_def vd, jsonb_each(coalesce(vd.config->'byInterface', '{}'::jsonb)) e
) v
where d.name = v.iface;

update view_def set config = config - 'byInterface';
delete from view_def where key = 'player';
