-- ════════════════════════════════════════════════════════════════════════
--  5sFindr — Seed data: popular Cape Town 5-a-side venues
--  Runs after 0001_init.sql.  is_seeded = true, created_by_id = null.
--  NOTE: lat/lng are approximate launch-seed coordinates — refine against the
--  real venue pins before go-live. Mix of paid official courts + free open areas.
-- ════════════════════════════════════════════════════════════════════════

insert into public.locations (name, type, address, neighborhood, latitude, longitude, is_seeded) values
  -- ── Official paid courts ──────────────────────────────────────────────
  ('Fives Futbol Century City', 'official_court', 'Century City, Cape Town',                 'Century City',   -33.89160, 18.51060, true),
  ('Discovery Soccer Park',     'official_court', 'Ndabeni, Cape Town',                       'Ndabeni',        -33.93540, 18.50300, true),
  ('Stadium on Main',           'official_court', 'Main Rd, Claremont, Cape Town',            'Claremont',      -33.98330, 18.46500, true),
  ('Old Mutual Sports Club',    'official_court', 'Jan Smuts Dr, Pinelands, Cape Town',       'Pinelands',      -33.93800, 18.51200, true),
  ('Bellville Velodrome 5s',    'official_court', 'Carl Cronje Dr, Bellville, Cape Town',     'Bellville',      -33.88200, 18.63400, true),
  ('Sports Science Institute',  'official_court', 'Boundary Rd, Newlands, Cape Town',         'Newlands',       -33.97100, 18.46300, true),
  ('Goal Diggers Indoor (Footy)','official_court','Montague Gardens, Cape Town',             'Montague Gardens',-33.86700, 18.53800, true),

  -- ── Free open / community areas (drop-in pickup) ──────────────────────
  ('Green Point Urban Park',    'open_area',      'Bay Rd, Green Point, Cape Town',           'Green Point',    -33.90200, 18.40900, true),
  ('Sea Point Promenade Field', 'open_area',      'Beach Rd, Sea Point, Cape Town',           'Sea Point',      -33.91400, 18.38400, true),
  ('Rondebosch Common',         'open_area',      'Campground Rd, Rondebosch, Cape Town',     'Rondebosch',     -33.95900, 18.47600, true),
  ('Wynberg Park',              'open_area',      'Trovato Link St, Wynberg, Cape Town',      'Wynberg',        -34.00100, 18.46300, true),
  ('Athlone Stadium Outer Field','open_area',     'Klipfontein Rd, Athlone, Cape Town',       'Athlone',        -33.96400, 18.50800, true);
