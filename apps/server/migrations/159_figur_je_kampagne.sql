-- Figuren je Kampagne (T-412).
--
-- Die Leitung entschied am 23.10.: „Die Charaktere sollten dem Nutzer pro
-- Kampagne zugewiesen werden." Bisher galt eine Zuteilung
-- (`app_user_actor`) für jede Kampagne des Kontos — in einer neuen Runde
-- stand „Test Barbar" als eigene Figur da.
--
-- 1. Die Zuteilung bekommt ihre Kampagne (`campaign_id`, leer = unbekannt;
--    dann gilt sie wie bisher überall).
-- 2. Der Bestand wird zugeordnet, nur wo es eindeutig ist, und nur einer
--    Kampagne, an deren Tisch das Konto sitzt (`campaign_member`). Gefragt
--    wird in dieser Reihenfolge, die erste Stufe mit genau einer Kampagne
--    gilt:
--    a. die Figur liegt in einer Spielerebene einer Kampagne
--       (`app_user_layer.campaign_id`);
--    b. sie liegt in der Ebene einer Kampagne (`ly_<kampagne>`);
--    c. sie steht in der Gruppe einer Kampagne (`memberOfParty` → `partyOf`);
--    d. das Konto sitzt an genau einem Tisch.
-- 3. Was danach ohne Kampagne bleibt, wird aufgezählt — die Leitung ordnet
--    es auf der Kampagnenseite zu (Members, eine Figur zuteilen).
--
-- Gelöscht wird nichts.

alter table app_user_actor add column if not exists campaign_id text;
create index if not exists app_user_actor_campaign on app_user_actor(campaign_id) where campaign_id is not null;

create temp table t412_kandidat on commit drop as
select a.user_id, a.actor_id, g.campaign_id as campaign, 1 as stufe
  from app_user_actor a
  join relation r on r.from_id = a.actor_id and r.type = 'inLayer'
  join app_user_layer g on g.layer_id = r.to_id and g.campaign_id is not null
  join campaign_member m on m.user_id = a.user_id and m.campaign_id = g.campaign_id
 where a.campaign_id is null
union
select a.user_id, a.actor_id, m.campaign_id, 2
  from app_user_actor a
  join campaign_member m on m.user_id = a.user_id
  join relation r on r.from_id = a.actor_id and r.type = 'inLayer' and r.to_id = 'ly_' || m.campaign_id
 where a.campaign_id is null
union
select a.user_id, a.actor_id, m.campaign_id, 3
  from app_user_actor a
  join relation r on r.from_id = a.actor_id and r.type = 'memberOfParty'
  join relation p on p.from_id = r.to_id and p.type = 'partyOf'
  join campaign_member m on m.user_id = a.user_id and m.campaign_id = p.to_id
 where a.campaign_id is null
union
select a.user_id, a.actor_id, min(m.campaign_id), 4
  from app_user_actor a
  join campaign_member m on m.user_id = a.user_id
 where a.campaign_id is null
 group by a.user_id, a.actor_id
having count(distinct m.campaign_id) = 1;

create temp table t412_wahl on commit drop as
with je_stufe as (
  select user_id, actor_id, stufe, min(campaign) as campaign, count(distinct campaign) as n
    from t412_kandidat
   group by user_id, actor_id, stufe
)
select distinct on (user_id, actor_id) user_id, actor_id, campaign
  from je_stufe
 where n = 1
 order by user_id, actor_id, stufe;

update app_user_actor a
   set campaign_id = w.campaign
  from t412_wahl w
 where a.user_id = w.user_id and a.actor_id = w.actor_id and a.campaign_id is null;

do $$
declare
  z record;
  n int := 0;
begin
  for z in
    select u.name, a.actor_id
      from app_user_actor a join app_user u on u.id = a.user_id
     where a.campaign_id is null
     order by u.name, a.actor_id
  loop
    raise notice 'ohne Kampagne: % spielt %', z.name, z.actor_id;
    n := n + 1;
  end loop;
  raise notice 'Figuren je Kampagne: % Zuteilung(en) ohne Kampagne (gelten überall, bis sie auf der Kampagnenseite zugeteilt werden)', n;
end $$;
