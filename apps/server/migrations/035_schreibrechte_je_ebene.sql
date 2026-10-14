-- Schreibrechte je Ebene (T-098, E-001).
--
-- Die Leitung entschied am 14.10.: je Konto ist verwaltbar, welche Ebenen
-- es bearbeiten darf; eigene Ebenen legt jede und jeder an und bearbeitet
-- darin alles; jede Kampagne hat eine eigene Ebene, die `gm` und `co-gm`
-- bearbeiten.
--
-- 1. **Wer in welcher Ebene schreibt, steht neben dem Konto**, nicht an der
--    Ebene — aus demselben Grund wie `app_user_article` und
--    `campaign_member`: eine Konto-Id in einem Artikel wandert beim Export
--    mit, und Zugänge wandern nicht (REQ-199). `owner` heisst: besitzt die
--    Ebene (angelegt oder übertragen) und sagt, wer sonst darin schreibt.
--    Die Ebene der Kampagne steht hier nicht: die schreiben `gm` und
--    `co-gm` von selbst, aus ihrer Rolle.
--
--    `layer_id` ohne Fremdschlüssel wie `app_user_article.entity_id`: eine
--    Ebene kann gelöscht und neu eingelesen werden, und eine Zeile, die
--    daran zerbricht, nimmt jemandem sein Recht.
--
-- 2. **Jede Kampagne bekommt ihre Ebene**, wenn sie keine hat: eine
--    aufgeschaltete Ebene, die keine andere Kampagne aufschaltet und keine
--    Gruppe ist (`campaignLayer`). Neue Kampagnen bekommen sie beim
--    Anlegen (`POST /api/campaigns`). Gelöscht und umgehängt wird nichts —
--    was ohne Ebene war, bleibt ohne Ebene.

create table if not exists app_user_layer (
  user_id  text not null references app_user(id) on delete cascade,
  layer_id text not null,
  owner    boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (user_id, layer_id)
);
create index if not exists app_user_layer_layer on app_user_layer(layer_id);

-- Kampagnen ohne eigene Ebene: keine aufgeschaltete Ebene (ohne Vergleich
-- und Abschaltung), die keine Gruppe ist und die keine andere Kampagne
-- aufschaltet.
create temp table t098_ohne on commit drop as
select c.entity_id as campaign,
       coalesce(nullif(btrim(i.payload->>'name'), ''), c.entity_id) as name
  from component c
  left join component i on i.entity_id = c.entity_id and i.type = 'Identity'
 where c.type = '__meta'
   and c.payload->'interfaces'->>0 = 'Campaign'
   and not exists (
     select 1
       from relation a
       join component lm on lm.entity_id = a.to_id and lm.type = '__meta' and lm.payload->'interfaces'->>0 = 'Layer'
       left join component lk on lk.entity_id = a.to_id and lk.type = 'Layer'
      where a.from_id = c.entity_id
        and a.type = 'activates'
        and coalesce(a.props->>'mode', '') not in ('compare', 'off')
        and coalesce(lk.payload->>'kind', '') <> 'group'
        and not exists (
          select 1
            from relation b
            join component bm on bm.entity_id = b.from_id and bm.type = '__meta' and bm.payload->'interfaces'->>0 = 'Campaign'
           where b.type = 'activates'
             and b.to_id = a.to_id
             and b.from_id <> a.from_id
             and coalesce(b.props->>'mode', '') not in ('compare', 'off')
        )
   );

-- Die neue Ebene: `ly_<kampagne>`, Nummer weiterzählen, ganz oben im
-- Stapel (spezifischer als alles, was die Kampagne schon aufschaltet).
create temp table t098_neu on commit drop as
select o.campaign,
       o.name,
       'ly_' || o.campaign as layer,
       'layer-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component x where x.type = 'Identity'), 0)
                         + row_number() over (order by o.name, o.campaign))::text, 4, '0') as nummer,
       coalesce((select max(coalesce(
                   case when (a.props->>'order') ~ '^-?\d+(\.\d+)?$' then (a.props->>'order')::numeric end,
                   case when (l.payload->>'order') ~ '^-?\d+(\.\d+)?$' then (l.payload->>'order')::numeric end,
                   10))
                   from relation a
                   left join component l on l.entity_id = a.to_id and l.type = 'Layer'
                  where a.from_id = o.campaign and a.type = 'activates'), 0) + 10 as stufe
  from t098_ohne o
 where not exists (select 1 from entity e where e.id = 'ly_' || o.campaign);

insert into entity(id) select layer from t098_neu;

insert into component(entity_id, type, payload)
select n.layer, k.type, k.payload
  from t098_neu n
  cross join lateral (values
    ('Identity', jsonb_build_object('name', n.name, 'id', n.nummer, 'aliases', '[]'::jsonb)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('Layer',    jsonb_build_object('kind', 'campaign', 'order', 100)),
    ('Prose',    jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
                   'id', 'text',
                   'value', 'The layer of the campaign ' || n.name || '. Its GM and co-GMs edit what is in it; a version of an article from another layer lands here.')))),
    ('__meta',   jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

insert into relation(id, from_id, to_id, type, props, ord)
select n.campaign || '~activates-' || n.layer,
       n.campaign,
       n.layer,
       'activates',
       jsonb_build_object('order', n.stufe),
       coalesce((select max(x.ord) from relation x where x.from_id = n.campaign), 0) + 1
  from t098_neu n;

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select campaign from t098_neu) or id in (select layer from t098_neu);

do $$
declare
  neu int;
  namen text;
begin
  select count(*), string_agg(name, ', ' order by name) into neu, namen from t098_neu;
  if neu > 0 then
    raise notice 'Eigene Ebene angelegt für % Kampagne(n): %', neu, namen;
  end if;
end $$;
