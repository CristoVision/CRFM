-- DU TCG PR seed data: factions, regions, cities, creatures, stages

-- ------------------------------------------------------------
-- Factions
-- ------------------------------------------------------------
insert into public.factions (name, description, color_hex, slug)
values
  ('La Generacion', 'La Generacion: energia moderna y unidad.', '#f3c86a', 'la-generacion'),
  ('Ancient', 'Ancient: legado ancestral y sabiduria.', '#7cc4ff', 'ancient'),
  ('EWSO', 'EWSO: equilibrio, servicio y orden.', '#7dd9a5', 'ewso'),
  ('Yani', 'Yani: fe, fuego y determinacion.', '#f58f8f', 'yani')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Regions (simple v1)
-- ------------------------------------------------------------
insert into public.regions (name, color, island, municipalities)
values
  ('Norte', '#7bb6ff', 'PR', array['San Juan','Bayamon','Dorado']),
  ('Sur', '#f29c7a', 'PR', array['Ponce','Guayama','Yauco']),
  ('Este', '#7dd9a5', 'PR', array['Fajardo','Humacao','Yabucoa']),
  ('Oeste', '#f3c86a', 'PR', array['Mayaguez','Aguadilla','Cabo Rojo']),
  ('Central', '#c7a6ff', 'PR', array['Caguas','Aibonito','Orocovis']),
  ('Metro', '#9bd1ff', 'PR', array['San Juan','Carolina','Guaynabo'])
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Cities (subset)
-- ------------------------------------------------------------
insert into public.cities (name, region_id)
select c.city_name, r.id
from (
  values
    ('San Juan','Norte'),
    ('Bayamon','Norte'),
    ('Ponce','Sur'),
    ('Guayama','Sur'),
    ('Fajardo','Este'),
    ('Humacao','Este'),
    ('Mayaguez','Oeste'),
    ('Aguadilla','Oeste'),
    ('Caguas','Central'),
    ('Aibonito','Central'),
    ('Carolina','Metro'),
    ('Guaynabo','Metro')
) as c(city_name, region_name)
join public.regions r on r.name = c.region_name
on conflict do nothing;

-- ------------------------------------------------------------
-- Creatures (starters + roster)
-- ------------------------------------------------------------
insert into public.creatures (name, name_locales, base_type, region, image_url, is_starter, rarity)
values
  ('Jibaro Sato', '{"es":"Jibaro Sato","en":"Jibaro Sato"}', 'Mammal', 'Central', null, true, 'starter'),
  ('Cotorra Puertorriquena', '{"es":"Cotorra Puertorriquena","en":"Puerto Rican Parrot"}', 'Bird', 'Norte', null, true, 'starter'),
  ('Iguana de Palo', '{"es":"Iguana de Palo","en":"Tree Iguana"}', 'Reptile', 'Este', null, true, 'starter'),
  ('Gallo/Gallina', '{"es":"Gallo/Gallina","en":"Rooster/Hen"}', 'Bird', 'Oeste', null, true, 'starter'),
  ('Gato Callejero', '{"es":"Gato Callejero","en":"Stray Cat"}', 'Mammal', 'Metro', null, true, 'starter'),

  ('Coqui', '{"es":"Coqui","en":"Coqui"}', 'Amphibian', 'Central', null, false, 'common'),
  ('Manati Antillano', '{"es":"Manati Antillano","en":"Antillean Manatee"}', 'Mammal', 'Sur', null, false, 'rare'),
  ('Pelicano Pardo', '{"es":"Pelicano Pardo","en":"Brown Pelican"}', 'Bird', 'Oeste', null, false, 'common'),
  ('Tinglar', '{"es":"Tinglar","en":"Leatherback Turtle"}', 'Reptile', 'Sur', null, false, 'rare'),
  ('Carey', '{"es":"Carey","en":"Hawksbill Turtle"}', 'Reptile', 'Este', null, false, 'rare'),
  ('Delfin', '{"es":"Delfin","en":"Dolphin"}', 'Mammal', 'Norte', null, false, 'rare'),
  ('Boa Puertorriquena', '{"es":"Boa Puertorriquena","en":"Puerto Rican Boa"}', 'Reptile', 'Central', null, false, 'rare'),
  ('Mucaro', '{"es":"Mucaro","en":"Puerto Rican Owl"}', 'Bird', 'Central', null, false, 'common'),
  ('Sapo Concho', '{"es":"Sapo Concho","en":"Puerto Rican Toad"}', 'Amphibian', 'Norte', null, false, 'common'),
  ('Juey', '{"es":"Juey","en":"Land Crab"}', 'Crustacean', 'Oeste', null, false, 'common'),
  ('Jicotea', '{"es":"Jicotea","en":"Freshwater Turtle"}', 'Reptile', 'Sur', null, false, 'common'),
  ('Lagartijo', '{"es":"Lagartijo","en":"Anole"}', 'Reptile', 'Metro', null, false, 'common'),
  ('Murcielago Frutero', '{"es":"Murcielago Frutero","en":"Fruit Bat"}', 'Mammal', 'Norte', null, false, 'common'),
  ('Garza Blanca', '{"es":"Garza Blanca","en":"Great Egret"}', 'Bird', 'Este', null, false, 'common'),
  ('Pez Loro', '{"es":"Pez Loro","en":"Parrotfish"}', 'Fish', 'Oeste', null, false, 'common'),
  ('Pez Leon', '{"es":"Pez Leon","en":"Lionfish"}', 'Fish', 'Sur', null, false, 'uncommon'),
  ('Cangrejo Violinista', '{"es":"Cangrejo Violinista","en":"Fiddler Crab"}', 'Crustacean', 'Este', null, false, 'common'),
  ('Zorzal Pardo', '{"es":"Zorzal Pardo","en":"Pearly-eyed Thrasher"}', 'Bird', 'Norte', null, false, 'common'),
  ('Culebra Coral', '{"es":"Culebra Coral","en":"Coral Snake"}', 'Reptile', 'Sur', null, false, 'rare'),
  ('Cangrejo Real', '{"es":"Cangrejo Real","en":"King Crab"}', 'Crustacean', 'Oeste', null, false, 'uncommon'),
  ('Perro Criollo', '{"es":"Perro Criollo","en":"Creole Dog"}', 'Mammal', 'Metro', null, false, 'common'),
  ('Caballo Criollo', '{"es":"Caballo Criollo","en":"Creole Horse"}', 'Mammal', 'Central', null, false, 'uncommon'),
  ('Cabra Cimarrona', '{"es":"Cabra Cimarrona","en":"Feral Goat"}', 'Mammal', 'Oeste', null, false, 'uncommon'),
  ('Pelicano Blanco', '{"es":"Pelicano Blanco","en":"White Pelican"}', 'Bird', 'Oeste', null, false, 'uncommon')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Region creature mapping (simple weight)
-- ------------------------------------------------------------
insert into public.region_creatures (region_id, creature_id, spawn_rate)
select r.id, c.id, 1
from public.regions r
join public.creatures c on c.region = r.name
on conflict do nothing;

-- ------------------------------------------------------------
-- Creature stages (base + shiny + faction ascended)
-- ------------------------------------------------------------
with base_stats as (
  select 'baby'::text as stage_key, 1 as stage_order, jsonb_build_object('hp',30,'atk',8,'def',6,'speed',10,'faith',8) as stats
  union all
  select 'teen', 2, jsonb_build_object('hp',50,'atk',14,'def',12,'speed',12,'faith',10)
  union all
  select 'adult', 3, jsonb_build_object('hp',80,'atk',22,'def',18,'speed',14,'faith',12)
),
creature_list as (
  select id, name from public.creatures
),
base_variants as (
  select false as is_shiny union all select true
),
faction_variants as (
  select slug from public.factions
),
insert_base as (
  insert into public.creature_stages (creature_id, stage_name, stage_order, stage_stats, image_url, variant_type, xp_required, stage_key, is_shiny)
  select c.id,
         concat(initcap(b.stage_key), ' ', c.name, case when v.is_shiny then ' (Shiny)' else '' end) as stage_name,
         b.stage_order,
         b.stats,
         null as image_url,
         'base' as variant_type,
         case when b.stage_order = 1 then 100 when b.stage_order = 2 then 200 else 0 end as xp_required,
         b.stage_key,
         v.is_shiny
  from creature_list c
  cross join base_stats b
  cross join base_variants v
  returning 1
)
insert into public.creature_stages (creature_id, stage_name, stage_order, stage_stats, image_url, variant_type, xp_required, stage_key, faction_slug, is_shiny)
select c.id,
       concat('Ascendido ', c.name, ' - ', f.slug) as stage_name,
       4,
       jsonb_build_object('hp',120,'atk',30,'def',24,'speed',18,'faith',18),
       null,
       'faction',
       0,
       'ascended',
       f.slug,
       false
from creature_list c
cross join faction_variants f;
