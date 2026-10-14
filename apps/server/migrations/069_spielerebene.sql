-- Spielerebenen (T-164).
--
-- Die Leitung entschied am 14.10.: jede Spielerin, jeder Spieler bekommt
-- eine eigene Ebene als Vorgabe zum Schreiben. Bisher legte ein Konto mit
-- Rolle `player` in die Ebene der Kampagne an.
--
-- 1. **Wessen Spielerebene es ist, steht neben dem Konto**
--    (`app_user_layer.campaign_id`), nicht an der Ebene (REQ-199).
--    `Layer.kind: 'player'` ist Beschreibung.
-- 2. **Das Register:** `Layer.kind` kennt das Wort `player`. Der Seed
--    schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- 3. **Je `player` in `campaign_member` eine Spielerebene**, wenn es noch
--    keine gibt: `<Konto> · <Kampagne>`, besessen vom Konto, von der
--    Kampagne dicht unter ihrer eigenen Ebene aufgeschaltet.
-- 4. **Was die Spielerin angelegt hat** (`app_user_article`) **und ihre
--    Figuren** (`app_user_actor`), die in der Ebene ihrer Kampagne liegen,
--    wandern in die Spielerebene — nur, was sich eindeutig einem Konto
--    zuordnen lässt. Der Rest bleibt und wird gezählt.
--
-- Gelöscht wird nichts; eine Kante `inLayer` zeigt danach auf eine andere
-- Ebene derselben Kampagne.

alter table app_user_layer add column if not exists campaign_id text;
create index if not exists app_user_layer_campaign on app_user_layer(campaign_id) where campaign_id is not null;

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,kind,enum}',
         '["system","expansion","book","adventure","world","pack","campaign","player","overrides","group"]'::jsonb
       )::json
 where name = 'Layer'
   and (schema::jsonb #> '{properties,kind,enum}') is not null
   and not (schema::jsonb #> '{properties,kind,enum}') ? 'player';

-- Die Ebene der Kampagne wie `campaignLayer`: die spezifischste
-- aufgeschaltete, keine Gruppe, von keiner anderen Kampagne aufgeschaltet,
-- keinem Konto gehörend.
create temp table t164_kebene on commit drop as
select distinct on (a.from_id)
       a.from_id as campaign,
       a.to_id as layer,
       coalesce(
         case when (a.props->>'order') ~ '^-?\d+(\.\d+)?$' then (a.props->>'order')::numeric end,
         case when (lk.payload->>'order') ~ '^-?\d+(\.\d+)?$' then (lk.payload->>'order')::numeric end,
         10) as stufe
  from relation a
  join component cm on cm.entity_id = a.from_id and cm.type = '__meta' and cm.payload->'interfaces'->>0 = 'Campaign'
  join component lm on lm.entity_id = a.to_id and lm.type = '__meta' and lm.payload->'interfaces'->>0 = 'Layer'
  left join component lk on lk.entity_id = a.to_id and lk.type = 'Layer'
 where a.type = 'activates'
   and coalesce(a.props->>'mode', '') not in ('compare', 'off')
   and coalesce(lk.payload->>'kind', '') <> 'group'
   and not exists (select 1 from app_user_layer g where g.layer_id = a.to_id and g.owner)
   and not exists (
     select 1 from relation b
       join component bm on bm.entity_id = b.from_id and bm.type = '__meta' and bm.payload->'interfaces'->>0 = 'Campaign'
      where b.type = 'activates' and b.to_id = a.to_id and b.from_id <> a.from_id
        and coalesce(b.props->>'mode', '') not in ('compare', 'off'))
 order by a.from_id, stufe desc;

-- Wer eine bekommt: `player` einer Kampagne, die es gibt, ohne Spielerebene dort.
create temp table t164_neu on commit drop as
select m.campaign_id as campaign,
       m.user_id,
       left(u.name || ' · ' || coalesce(nullif(btrim(i.payload->>'name'), ''), 'Campaign'), 80) as name,
       'ly_' || substr(md5('t164|' || m.campaign_id || '|' || m.user_id), 1, 12) as layer,
       'layer-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component x where x.type = 'Identity'), 0)
                         + row_number() over (order by m.campaign_id, u.name))::text, 4, '0') as nummer,
       coalesce(k.stufe - 1,
                (select max(case when (a.props->>'order') ~ '^-?\d+(\.\d+)?$' then (a.props->>'order')::numeric else 10 end)
                   from relation a where a.from_id = m.campaign_id and a.type = 'activates'),
                0) + case when k.stufe is null then 10 else 0 end as stufe
  from campaign_member m
  join app_user u on u.id = m.user_id
  join component cm on cm.entity_id = m.campaign_id and cm.type = '__meta' and cm.payload->'interfaces'->>0 = 'Campaign'
  left join component i on i.entity_id = m.campaign_id and i.type = 'Identity'
  left join t164_kebene k on k.campaign = m.campaign_id
 where m.role = 'player'
   and not exists (
     select 1 from app_user_layer g join entity e on e.id = g.layer_id
      where g.user_id = m.user_id and g.campaign_id = m.campaign_id and g.owner)
   and not exists (select 1 from entity e where e.id = 'ly_' || substr(md5('t164|' || m.campaign_id || '|' || m.user_id), 1, 12));

insert into entity(id) select layer from t164_neu;

insert into component(entity_id, type, payload)
select n.layer, k.type, k.payload
  from t164_neu n
  cross join lateral (values
    ('Identity', jsonb_build_object('name', n.name, 'id', n.nummer, 'aliases', '[]'::jsonb)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('Layer',    jsonb_build_object('kind', 'player', 'order', 90)),
    ('__meta',   jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

insert into relation(id, from_id, to_id, type, props, ord)
select 'activates-' || n.layer,
       n.campaign,
       n.layer,
       'activates',
       jsonb_build_object('order', n.stufe),
       coalesce((select max(x.ord) from relation x where x.from_id = n.campaign), 0)
         + row_number() over (partition by n.campaign order by n.layer)
  from t164_neu n;

insert into app_user_layer(user_id, layer_id, owner, campaign_id)
select user_id, layer, true, campaign from t164_neu
on conflict (user_id, layer_id) do update set owner = true, campaign_id = excluded.campaign_id;

-- Was wandert: angelegt oder geführt von genau einem Konto, das in der
-- Kampagne dieser Ebene `player` ist und dort seine Spielerebene hat.
create temp table t164_anspruch on commit drop as
select x.entity_id, x.user_id
  from (select entity_id, user_id from app_user_article
        union
        select actor_id, user_id from app_user_actor) x;

create temp table t164_zug on commit drop as
select r.id as rel, r.from_id as article, r.to_id as von, g.layer_id as nach, count(*) over (partition by r.id) as anspruch
  from relation r
  join t164_kebene k on k.layer = r.to_id
  join t164_anspruch a on a.entity_id = r.from_id
  join campaign_member m on m.user_id = a.user_id and m.campaign_id = k.campaign and m.role = 'player'
  join app_user_layer g on g.user_id = a.user_id and g.campaign_id = k.campaign and g.owner
 where r.type = 'inLayer';

-- Liegt der Artikel schon in der Spielerebene, bleibt die Kante zur
-- Kampagnenebene stehen: wegnehmen hiesse löschen, und das tut diese
-- Migration nicht.
update relation r
   set to_id = z.nach
  from t164_zug z
 where r.id = z.rel and z.anspruch = 1
   and not exists (select 1 from relation d where d.from_id = z.article and d.type = 'inLayer' and d.to_id = z.nach);

update entity set updated_at = now()
 where id in (select article from t164_zug where anspruch = 1)
    or id in (select campaign from t164_neu)
    or id in (select layer from t164_neu);

do $$
declare
  neu int;
  namen text;
  gezogen int;
  offen int;
  offenNamen text;
begin
  select count(*), string_agg(name, ', ' order by name) into neu, namen from t164_neu;
  if neu > 0 then
    raise notice 'Spielerebene angelegt für % Konto/Kampagne: %', neu, namen;
  end if;
  select count(distinct article) into gezogen from t164_zug where anspruch = 1;
  if gezogen > 0 then
    raise notice '% Artikel in die Spielerebene ihres Kontos verschoben', gezogen;
  end if;
  select count(distinct z.article), string_agg(distinct coalesce(i.payload->>'name', z.article), ', ')
    into offen, offenNamen
    from t164_zug z left join component i on i.entity_id = z.article and i.type = 'Identity'
   where z.anspruch > 1;
  if offen > 0 then
    raise notice '% Artikel mehreren Konten zugeordnet, bleiben in der Kampagnenebene: %', offen, offenNamen;
  end if;
end $$;
