-- Wahlen als Feld (T-079, REQ-238, E-015 a).
--
-- `ProficiencyChoice` trug an Klasse, Unterklasse, Abstammung und
-- Hintergrund genau eine Wahl (`chooseFrom`, `chooseCount`, `chooseNote`);
-- jede weitere stand als Satz im Text, aus dem kein Assistent einen
-- Schritt bauen kann. Jetzt nimmt jede dieser Arten und das Talent den
-- Obertyp `Choices` mit dem Feld `choices`: je Eintrag eine Wahl
-- `{id, kind, level, when, from, count, bonus, note}`. Die Antworten einer
-- Figur stehen an der neuen Kante `chose` (Figur → Artikel, der fragt).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt das Register
-- hier nach: die Zeile `Choices`, `extends` der fünf Arten, die Kante —
-- **nur, wo schon ein Register steht**. Auf einer frischen Datenbank
-- hielte der Seed eine einzelne Zeile sonst für ein fertiges Register und
-- schriebe keines.
--
-- **Verloren geht nichts**: jede Karte `ProficiencyChoice` wird ein
-- Eintrag `proficiencies` in `Choices.choices` (Liste → `from.values`,
-- Anzahl → `count`, Satz → `note`), danach fällt die alte Karte weg. Eine
-- Karte, die noch andere Schlüssel trüge, zählt die Prüfabfrage.
--
-- verlust: select count(*) from component c, jsonb_object_keys(c.payload) k where c.type = 'ProficiencyChoice' and k not in ('chooseFrom', 'chooseCount', 'chooseNote')

insert into interface_def (name, label, abstract, extends, schema)
select
  'Choices', 'Choices', true, '{}',
  '{"type":"object","properties":{"choices":{"type":"array","many":true,"title":"Choices","items":{"type":"object"},"entry":{"type":"object","required":["id","kind"],"properties":{"id":{"type":"string","title":"Id"},"kind":{"type":"string","title":"Kind","enum":["proficiency","ability","feat","spell","equipment","feature","subclass"]},"level":{"type":"number","min":1,"max":20,"title":"From level"},"when":{"type":"string","title":"Only when","enum":["start","multiclass"]},"from":{"type":"object","title":"Choose from"},"count":{"type":"number","min":1,"title":"How many"},"bonus":{"type":"array","items":{"type":"number"},"title":"Bonus per pick"},"note":{"type":"string","title":"Note"}}}}}}'::json
where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set extends = array_replace(extends, 'ProficiencyChoice', 'Choices')
 where 'ProficiencyChoice' = any(extends);

update interface_def
   set extends = extends || array['Choices']
 where name = 'Feat' and not ('Choices' = any(extends));

-- Die Karte wird ein Eintrag. Steht schon eine Karte `Choices` da, kommt
-- der Eintrag hinten dazu.
insert into component (entity_id, type, payload)
select p.entity_id, 'Choices',
       jsonb_build_object('choices', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
         'id', 'proficiencies',
         'kind', 'proficiency',
         'count', case when jsonb_typeof(p.payload->'chooseCount') = 'number' then p.payload->'chooseCount' end,
         'from', case when jsonb_typeof(p.payload->'chooseFrom') = 'array' and jsonb_array_length(p.payload->'chooseFrom') > 0
                      then jsonb_build_object('values', p.payload->'chooseFrom') end,
         'note', case when coalesce(p.payload->>'chooseNote', '') <> '' then p.payload->'chooseNote' end
       ))))
  from component p
 where p.type = 'ProficiencyChoice' and p.payload <> '{}'::jsonb
on conflict (entity_id, type) do update
   set payload = jsonb_set(
     component.payload, '{choices}',
     coalesce(component.payload->'choices', '[]'::jsonb) || (excluded.payload->'choices'));

delete from component where type = 'ProficiencyChoice';

delete from interface_def where name = 'ProficiencyChoice';

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props)
select
  'chose', 'chose', 'chosen by', '{PlayerCharacter}', '{Choices}', false, 'many',
  '{"type":"object","required":["choice"],"properties":{"choice":{"type":"string","title":"Choice"},"picks":{"type":"array","items":{"type":"string"},"title":"Picks"}}}'::jsonb
where exists (select 1 from relation_def)
on conflict (type) do nothing;
