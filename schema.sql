CREATE SEQUENCE IF NOT EXISTS movements_registro_orden_seq;

CREATE TABLE IF NOT EXISTS movements (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('sale', 'order', 'purchase', 'production')),
  movement_date DATE NOT NULL,
  registro_orden BIGINT NOT NULL DEFAULT nextval('movements_registro_orden_seq'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_colors (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_colors_unique UNIQUE (product_id, color)
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ci TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  movement_id BIGINT PRIMARY KEY REFERENCES movements(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  color TEXT,
  price_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  location TEXT,
  executed_by TEXT NOT NULL DEFAULT 'Rossell',
  observations TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  movement_id BIGINT PRIMARY KEY REFERENCES movements(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  location TEXT,
  executed_by TEXT NOT NULL DEFAULT 'Rossell',
  commission NUMERIC(12,2),
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_movement_id BIGINT NOT NULL REFERENCES sales(movement_id) ON DELETE CASCADE,
  product_color_id BIGINT REFERENCES product_colors(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  color TEXT NOT NULL,
  size TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  movement_id BIGINT PRIMARY KEY REFERENCES movements(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  location TEXT,
  executed_by TEXT NOT NULL DEFAULT 'Rossell',
  commission NUMERIC(12,2),
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_movement_id BIGINT NOT NULL REFERENCES orders(movement_id) ON DELETE CASCADE,
  product_color_id BIGINT REFERENCES product_colors(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  color TEXT NOT NULL,
  size TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productions (
  movement_id BIGINT PRIMARY KEY REFERENCES movements(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS production_items (
  id BIGSERIAL PRIMARY KEY,
  production_movement_id BIGINT NOT NULL REFERENCES productions(movement_id) ON DELETE CASCADE,
  product_color_id BIGINT REFERENCES product_colors(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  color TEXT NOT NULL,
  size TEXT
);

CREATE INDEX IF NOT EXISTS movements_kind_date_idx ON movements(kind, movement_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS product_colors_product_idx ON product_colors(product_id);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(sale_movement_id);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_movement_id);
CREATE INDEX IF NOT EXISTS production_items_production_idx ON production_items(production_movement_id);
