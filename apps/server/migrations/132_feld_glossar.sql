-- Felder nennen ihren Glossarbegriff (T-347): `glossary` an den Feldern,
-- die die Seite am häufigsten erklärt (Trefferpunkte, Rüstungsklasse,
-- Rettungswürfe, Konzentration …). Feldname gepunktet, Titel die
-- Definition; der Eintrag ist ein Artikel der Installation.
--
-- Nur, wo das Feld steht und noch keinen Begriff nennt — was jemand im
-- Register gesetzt hat, bleibt. Kein Artikel wird geändert, entfernt wird
-- nichts. Die Nummer ist beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,initiative,glossary}', '"Initiative"'::jsonb)::json
 where name = 'Abilities'
   and schema::jsonb #> '{properties,initiative}' is not null
   and schema::jsonb #> '{properties,initiative,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,hp,glossary}', '"Hit points"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,hp}' is not null
   and schema::jsonb #> '{properties,hp,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,hpTemp,glossary}', '"Temporary hit points"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,hpTemp}' is not null
   and schema::jsonb #> '{properties,hpTemp,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,hitDiceLeft,glossary}', '"Hit Dice"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,hitDiceLeft}' is not null
   and schema::jsonb #> '{properties,hitDiceLeft,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,deathSuccess,glossary}', '"Death saving throw"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,deathSuccess}' is not null
   and schema::jsonb #> '{properties,deathSuccess,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,deathFail,glossary}', '"Death saving throw"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,deathFail}' is not null
   and schema::jsonb #> '{properties,deathFail,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,inspiration,glossary}', '"Inspiration"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,inspiration}' is not null
   and schema::jsonb #> '{properties,inspiration,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,slotsUsed,glossary}', '"Spell slot"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,slotsUsed}' is not null
   and schema::jsonb #> '{properties,slotsUsed,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,concentration,glossary}', '"Concentration"'::jsonb)::json
 where name = 'Vitals'
   and schema::jsonb #> '{properties,concentration}' is not null
   and schema::jsonb #> '{properties,concentration,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,saves,glossary}', '"Saving throw"'::jsonb)::json
 where name = 'Proficiencies'
   and schema::jsonb #> '{properties,saves}' is not null
   and schema::jsonb #> '{properties,saves,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,speed,glossary}', '"Speed"'::jsonb)::json
 where name = 'Ancestry'
   and schema::jsonb #> '{properties,speed}' is not null
   and schema::jsonb #> '{properties,speed,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,concentration,glossary}', '"Concentration"'::jsonb)::json
 where name = 'Spell'
   and schema::jsonb #> '{properties,concentration}' is not null
   and schema::jsonb #> '{properties,concentration,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,ritual,glossary}', '"Ritual"'::jsonb)::json
 where name = 'Spell'
   and schema::jsonb #> '{properties,ritual}' is not null
   and schema::jsonb #> '{properties,ritual,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,ac,glossary}', '"Armor Class"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,ac}' is not null
   and schema::jsonb #> '{properties,ac,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,hp,glossary}', '"Hit points"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,hp}' is not null
   and schema::jsonb #> '{properties,hp,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,speed,glossary}', '"Speed"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,speed}' is not null
   and schema::jsonb #> '{properties,speed,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,prof,glossary}', '"Proficiency bonus"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,prof}' is not null
   and schema::jsonb #> '{properties,prof,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,resistances,glossary}', '"Damage resistance"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,resistances}' is not null
   and schema::jsonb #> '{properties,resistances,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,vulnerabilities,glossary}', '"Damage vulnerability"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,vulnerabilities}' is not null
   and schema::jsonb #> '{properties,vulnerabilities,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,immunities,glossary}', '"Damage immunity"'::jsonb)::json
 where name = 'Statblock'
   and schema::jsonb #> '{properties,immunities}' is not null
   and schema::jsonb #> '{properties,immunities,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,attunement,glossary}', '"Attunement"'::jsonb)::json
 where name = 'Item'
   and schema::jsonb #> '{properties,attunement}' is not null
   and schema::jsonb #> '{properties,attunement,glossary}' is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,ac,glossary}', '"Armor Class"'::jsonb)::json
 where name = 'Armor'
   and schema::jsonb #> '{properties,ac}' is not null
   and schema::jsonb #> '{properties,ac,glossary}' is null;
