-- PostgreSQL schema (initial)
-- Assumptions: nutrients stored per 100g, portions store grams for normalization.

create table users (
  id uuid primary key,
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table food_items (
  id uuid primary key,
  name text not null,
  source text not null, -- "USDA" | "OFF" | "USER"
  source_ref text, -- external id
  created_at timestamptz not null default now()
);

create table ingredients (
  id uuid primary key,
  food_item_id uuid references food_items(id),
  name text not null,
  default_unit text, -- "cup" | "bowl" | "piece"
  default_grams numeric, -- grams per default unit
  created_at timestamptz not null default now()
);

create table nutrient_profiles (
  id uuid primary key,
  food_item_id uuid references food_items(id),
  per_100g boolean not null default true,
  calories_kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  cholesterol_mg numeric,
  source text not null,
  confidence numeric, -- 0..1
  created_at timestamptz not null default now()
);

create table barcode_products (
  id uuid primary key,
  barcode text unique not null,
  name text,
  brand text,
  serving_size text,
  food_item_id uuid references food_items(id),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table meals (
  id uuid primary key,
  user_id uuid references users(id),
  meal_label text, -- "breakfast" | "lunch" | "dinner" | "snack"
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table meal_items (
  id uuid primary key,
  meal_id uuid references meals(id),
  ingredient_id uuid references ingredients(id),
  quantity numeric not null,
  unit text not null, -- "cup" | "bowl" | "piece" | "g"
  grams numeric, -- normalized grams for calculation
  assumption_text text, -- "medium bowl cooked rice"
  confidence numeric, -- 0..1
  created_at timestamptz not null default now()
);

create table portion_assumptions (
  id uuid primary key,
  user_id uuid references users(id),
  ingredient_id uuid references ingredients(id),
  preferred_unit text,
  preferred_grams numeric,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table meal_nutrients (
  id uuid primary key,
  meal_id uuid references meals(id),
  calories_kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  cholesterol_mg numeric,
  created_at timestamptz not null default now()
);

create table day_nutrients (
  id uuid primary key,
  user_id uuid references users(id),
  day date not null,
  calories_kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  cholesterol_mg numeric,
  created_at timestamptz not null default now()
);

create table nutrient_attribution (
  id uuid primary key,
  user_id uuid references users(id),
  day date not null,
  nutrient_key text not null, -- "sodium_mg" etc
  meal_id uuid references meals(id),
  meal_item_id uuid references meal_items(id),
  amount numeric not null
);
