-- Eine Gruppe je Kampagne, und die Figuren der Spieler darin (T-100, E-007).
--
-- Die Leitung entschied am 14.10.: je Kampagne wird automatisch eine Party
-- angelegt, und die Spieler werden darin festgehalten — anpassbar, aber
-- der häufigste Fall. Neue Kampagnen bekommen sie beim Anlegen
-- (`POST /api/campaigns`), neue Zuteilungen kommen beim Zuteilen hinein
-- (`inDieGruppe`). Hier dasselbe für den Bestand:
--
-- 1. Jede Kampagne ohne Party (keine `partyOf`-Kante auf sie) bekommt
--    `pt_<kampagne>`, fertig (`ready`), in der Ebene der Kampagne, wenn
--    sie `ly_<kampagne>` hat (Migration 035).
-- 2. Jede Figur eines Kontos mit Rolle `player` in einer Kampagne kommt in
--    die erste Party dieser Kampagne (nach Nummer) — wenn sie noch in
--    keiner Party dieser Kampagne steht und eine Kreatur ist.
--
-- Gelöscht und umgehängt wird nichts: eine Figur, die schon in einer
-- Gruppe der Kampagne steht, bleibt dort.

create temp table t100_ohne on commit drop as
select c.entity_id as campaign,
       coalesce(nullif(btrim(i.payload->>'name'), ''), c.entity_id) as name
  from component c
  left join component i on i.entity_id = c.entity_id and i.type = 'Identity'
 where c.type = '__meta'
   and c.payload->'interfaces'->>0 = 'Campaign'
   and not exists (select 1 from relation r where r.type = 'partyOf' and r.to_id = c.entity_id)
   and not exists (select 1 from entity e where e.id = 'pt_' || c.entity_id);

create temp table t100_neu on commit drop as
select o.campaign,
       o.name || ' party' as name,
       'pt_' || o.campaign as party,
       'party-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^party-(\d+)$')::int)
                                     from component x where x.type = 'Identity'), 0)
                         + row_number() over (order by o.name, o.campaign))::text, 4, '0') as nummer,
       exists (select 1 from entity e where e.id = 'ly_' || o.campaign) as hat_ebene
  from t100_ohne o;

insert into entity(id) select party from t100_neu;

insert into component(entity_id, type, payload)
select n.party, k.type, k.payload
  from t100_neu n
  cross join lateral (values
    ('Identity', jsonb_build_object('name', n.name, 'id', n.nummer, 'aliases', '[]'::jsonb)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('__meta',   jsonb_build_object('interfaces', jsonb_build_array('Party'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

insert into relation(id, from_id, to_id, type, props, ord)
select n.party || '~partyOf', n.party, n.campaign, 'partyOf', '{}'::jsonb, 1
  from t100_neu n;

insert into relation(id, from_id, to_id, type, props, ord)
select n.party || '~inLayer-1', n.party, 'ly_' || n.campaign, 'inLayer', '{}'::jsonb, 2
  from t100_neu n
 where n.hat_ebene;

-- Die Figuren: Konto mit Rolle `player` → seine Figuren → erste Party der
-- Kampagne. Eine Kreatur heisst: die Art steht die `extends`-Kette unter
-- `Creature` (wie `memberOfParty.from`).
create temp table t100_mitglied on commit drop as
with recursive kette(name) as (
  select 'Creature'::text
  union
  select d.name from interface_def d join kette k on k.name = any(d.extends)
),
erste as (
  select distinct on (r.to_id) r.to_id as campaign, r.from_id as party
    from relation r
    left join component i on i.entity_id = r.from_id and i.type = 'Identity'
   where r.type = 'partyOf'
   order by r.to_id, coalesce(i.payload->>'id', ''), r.from_id
)
select distinct a.actor_id as actor, e.party
  from campaign_member m
  join app_user_actor a on a.user_id = m.user_id
  join erste e on e.campaign = m.campaign_id
  join component meta on meta.entity_id = a.actor_id and meta.type = '__meta'
  join kette k on k.name = meta.payload->'interfaces'->>0
 where m.role = 'player'
   and not exists (
     select 1
       from relation x
       join relation p on p.from_id = x.to_id and p.type = 'partyOf' and p.to_id = m.campaign_id
      where x.from_id = a.actor_id and x.type = 'memberOfParty'
   );

insert into relation(id, from_id, to_id, type, props, ord)
select t.actor || '~memberOfParty-' || t.party,
       t.actor,
       t.party,
       'memberOfParty',
       '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = t.actor), 0) + 1
  from t100_mitglied t
 where not exists (select 1 from relation x where x.id = t.actor || '~memberOfParty-' || t.party);

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select party from t100_neu) or id in (select actor from t100_mitglied);

do $$
declare
  neu int;
  namen text;
  dazu int;
begin
  select count(*), string_agg(name, ', ' order by name) into neu, namen from t100_neu;
  select count(*) into dazu from t100_mitglied;
  if neu > 0 then
    raise notice 'Gruppe angelegt für % Kampagne(n): %', neu, namen;
  end if;
  if dazu > 0 then
    raise notice '% Spielerfigur(en) in die Gruppe ihrer Kampagne genommen', dazu;
  end if;
end $$;
