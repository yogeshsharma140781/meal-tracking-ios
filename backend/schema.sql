-- PostgreSQL schema (initial)

create table if not exists users (
  id uuid primary key,
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists food_items (
  id uuid primary key,
  name text not null,
  source text not null,
  source_ref text,
  created_at timestamptz not null default now()
);

create table if not exists ingredients (
  id uuid primary key,
  food_item_id uuid references food_items(id),
  name text not null,
  default_unit text,
  default_grams numeric,
  created_at timestamptz not null default now()
);

create table if not exists nutrient_profiles (
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
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists barcode_products (
  id uuid primary key,
  barcode text unique not null,
  name text,
  brand text,
  serving_size text,
  food_item_id uuid references food_items(id),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists meals (
  id uuid primary key,
  user_id uuid references users(id),
  meal_label text,
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists meal_items (
  id uuid primary key,
  meal_id uuid references meals(id),
  ingredient_id uuid references ingredients(id),
  quantity numeric not null,
  unit text not null,
  grams numeric,
  assumption_text text,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists portion_assumptions (
  id uuid primary key,
  user_id uuid references users(id),
  ingredient_id uuid references ingredients(id),
  preferred_unit text,
  preferred_grams numeric,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists meal_nutrients (
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

create table if not exists day_nutrients (
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

create table if not exists nutrient_attribution (
  id uuid primary key,
  user_id uuid references users(id),
  day date not null,
  nutrient_key text not null,
  meal_id uuid references meals(id),
  meal_item_id uuid references meal_items(id),
  amount numeric not null
);

create table if not exists feedback (
  id uuid primary key,
  rating smallint not null check (rating >= 1 and rating <= 5),
  text text,
  created_at timestamptz not null default now()
);
