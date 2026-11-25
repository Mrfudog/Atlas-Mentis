-- Die Listenwerte für die Arten, die T-087 aus 5e.tools hereinnimmt
-- (REQ-243, löst E4 ab): eine Aufrüstung eines Fahrzeugs, ein Raum der
-- Bastion und eine Karte sind eine `Rule` mit `kind` `upgrade`, `facility`,
-- `card`; ein Kartendeck ist eine `Table` mit `kind: 'deck'`.
--
-- Der Seed schreibt nur in eine leere Datenbank, und `--only-new` behält
-- die Registerzeilen, die schon stehen — ohne die Werte hier lehnte die
-- Prüfung jede Karte ab. Also kommen sie nach, **nur wo die Zeile steht**
-- und der Wert fehlt (wie 036). Entfernt wird nichts.

update enum_def
   set config = jsonb_set(
     config,
     '{values}',
     (config -> 'values') || coalesce(
       (select jsonb_agg(v) from (values ('upgrade'), ('facility'), ('card')) as neu(v)
         where not ((config -> 'values') ? v)),
       '[]'::jsonb
     )
   )
 where name = 'RuleKind'
   and jsonb_typeof(config -> 'values') = 'array';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,kind,enum}',
     (schema::jsonb #> '{properties,kind,enum}') || '["deck"]'::jsonb
   )::json
 where name = 'Table'
   and jsonb_typeof(schema::jsonb #> '{properties,kind,enum}') = 'array'
   and not ((schema::jsonb #> '{properties,kind,enum}') ? 'deck');
