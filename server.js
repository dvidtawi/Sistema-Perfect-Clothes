import 'dotenv/config';
import express from 'express';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { query, transaction } from './db.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

async function ensureSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS movements (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('sale', 'order', 'purchase', 'production')),
      movement_date DATE NOT NULL,
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
      commission_mode TEXT NOT NULL DEFAULT 'total',
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
      commission_mode TEXT NOT NULL DEFAULT 'total',
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
  `;

  await query(schema);
  await query(`ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS commission_mode TEXT NOT NULL DEFAULT 'total'`);
  await query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS commission_mode TEXT NOT NULL DEFAULT 'total'`);
}

function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function asMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
}

function movementLabel(kind) {
  switch (kind) {
    case 'sale':
      return 'venta';
    case 'order':
      return 'pedido';
    case 'purchase':
      return 'compra';
    case 'production':
      return 'producción';
    default:
      return kind;
  }
}

function mapProductRows(rows) {
  const families = new Map();
  for (const row of rows) {
    if (!families.has(row.id)) {
      families.set(row.id, { id: row.id, name: row.name, variants: [] });
    }
    if (row.color_id) {
      families.get(row.id).variants.push({
        id: row.color_id,
        color: row.color,
        price: row.price,
      });
    }
  }
  return [...families.values()];
}

async function getProducts() {
  const { rows } = await query(`
    SELECT
      p.id,
      p.name,
      pc.id AS color_id,
      pc.color,
      pc.price
    FROM products p
    LEFT JOIN product_colors pc ON pc.product_id = p.id
    ORDER BY p.name ASC, pc.color ASC
  `);
  return mapProductRows(rows);
}

async function getClients() {
  const { rows } = await query(
    `SELECT id, name, ci, phone, created_at FROM clients ORDER BY created_at DESC, id DESC`
  );
  return rows;
}

async function fetchPurchaseRows(from, to, id) {
  const params = [];
  const filters = [];
  if (id !== undefined) {
    params.push(id);
    filters.push(`m.id = $${params.length}`);
  }
  if (from && to) {
    params.push(from, to);
    filters.push(`m.movement_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await query(
    `
      SELECT
        m.id,
        m.kind,
        m.movement_date,
        p.material_name AS product_name_snapshot,
        p.quantity,
        p.price_total AS total_price,
        NULL::bigint AS product_family_id,
        NULL::bigint AS client_id,
        NULL::text AS client_name_snapshot,
        p.location,
        p.executed_by,
        NULL::numeric AS commission,
        p.observations,
        CASE
          WHEN p.color IS NULL OR p.color = '' THEN '[]'::json
          ELSE json_build_array(
            json_build_object(
              'id', NULL,
              'variant_id', NULL,
              'quantity', p.quantity,
              'color', p.color,
              'size', NULL,
              'unit_price', CASE WHEN p.quantity > 0 THEN round(p.price_total / p.quantity, 2) ELSE 0 END
            )
          )
        END AS items
      FROM movements m
      JOIN purchases p ON p.movement_id = m.id
      ${where}
      ORDER BY m.movement_date DESC, m.id DESC
    `,
    params
  );
  return rows;
}

async function fetchSaleLikeRows(kind, from, to, id) {
  const table = kind === 'sale' ? 'sales' : 'orders';
  const itemsTable = kind === 'sale' ? 'sale_items' : 'order_items';
  const itemFk = kind === 'sale' ? 'sale_movement_id' : 'order_movement_id';
  const params = [kind];
  const filters = [`m.kind = $1`];
  if (id !== undefined) {
    params.push(id);
    filters.push(`m.id = $${params.length}`);
  }
  if (from && to) {
    params.push(from, to);
    filters.push(`m.movement_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  const where = `WHERE ${filters.join(' AND ')}`;

  const { rows } = await query(
    `
      SELECT
        m.id,
        m.kind,
        m.movement_date,
        pr.name AS product_name_snapshot,
        COALESCE(SUM(i.quantity), 0)::int AS quantity,
        s.total_price,
        s.product_id AS product_family_id,
        s.client_id,
        COALESCE(c.name, '') AS client_name_snapshot,
        s.location,
        s.executed_by,
        s.commission_mode,
        s.commission,
        s.observations,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'variant_id', i.product_color_id,
              'quantity', i.quantity,
              'color', i.color,
              'size', i.size,
              'unit_price', i.unit_price
            )
            ORDER BY i.id
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM movements m
      JOIN ${table} s ON s.movement_id = m.id
      LEFT JOIN products pr ON pr.id = s.product_id
      LEFT JOIN clients c ON c.id = s.client_id
      LEFT JOIN ${itemsTable} i ON i.${itemFk} = s.movement_id
      ${where}
      GROUP BY
        m.id, m.kind, m.movement_date, pr.name, s.total_price, s.product_id,
        s.client_id, c.name, s.location, s.executed_by, s.commission, s.observations
        , s.commission_mode
      ORDER BY m.movement_date DESC, m.id DESC
    `,
    params
  );
  return rows;
}

async function fetchProductionRows(from, to, id) {
  const params = [];
  const filters = [];
  if (id !== undefined) {
    params.push(id);
    filters.push(`m.id = $${params.length}`);
  }
  if (from && to) {
    params.push(from, to);
    filters.push(`m.movement_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await query(
    `
      SELECT
        m.id,
        m.kind,
        m.movement_date,
        pr.name AS product_name_snapshot,
        COALESCE(SUM(i.quantity), 0)::int AS quantity,
        p.total_price,
        p.product_id AS product_family_id,
        NULL::bigint AS client_id,
        NULL::text AS client_name_snapshot,
        NULL::text AS location,
        NULL::text AS executed_by,
        NULL::numeric AS commission,
        p.observations,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'variant_id', i.product_color_id,
              'quantity', i.quantity,
              'color', i.color,
              'size', i.size,
              'unit_price', NULL
            )
            ORDER BY i.id
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM movements m
      JOIN productions p ON p.movement_id = m.id
      LEFT JOIN products pr ON pr.id = p.product_id
      LEFT JOIN production_items i ON i.production_movement_id = p.movement_id
      ${where}
      GROUP BY m.id, m.kind, m.movement_date, pr.name, p.total_price, p.product_id, p.observations
      ORDER BY m.movement_date DESC, m.id DESC
    `,
    params
  );
  return rows;
}

async function getMovementKind(id) {
  const { rows } = await query(`SELECT id, kind FROM movements WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function getMovementById(id) {
  const kindRow = await getMovementKind(id);
  if (!kindRow) return null;
  if (kindRow.kind === 'purchase') return (await fetchPurchaseRows(null, null, id))[0] || null;
  if (kindRow.kind === 'sale' || kindRow.kind === 'order') return (await fetchSaleLikeRows(kindRow.kind, null, null, id))[0] || null;
  if (kindRow.kind === 'production') return (await fetchProductionRows(null, null, id))[0] || null;
  return null;
}

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [products, clients, sales, purchases, productions] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM products'),
      query('SELECT COUNT(*)::int AS count FROM clients'),
      query("SELECT COUNT(*)::int AS count FROM movements WHERE kind IN ('sale', 'order')"),
      query("SELECT COUNT(*)::int AS count FROM movements WHERE kind = 'purchase'"),
      query("SELECT COUNT(*)::int AS count FROM movements WHERE kind = 'production'"),
    ]);

    res.json({
      products: products.rows[0].count,
      clients: clients.rows[0].count,
      sales: sales.rows[0].count,
      purchases: purchases.rows[0].count,
      production: productions.rows[0].count,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    res.json(await getProducts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const familyName = cleanText(req.body.familyName || req.body.name);
    const color = cleanText(req.body.color);
    const price = asMoney(req.body.price);
    if (!familyName || !color || price === null) {
      return res.status(400).json({ error: 'Nombre, color y precio son requeridos.' });
    }

    const result = await transaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM products WHERE lower(name) = lower($1) LIMIT 1`,
        [familyName]
      );
      let productId = existing.rows[0]?.id;
      if (!productId) {
        const inserted = await client.query(
          `INSERT INTO products (name) VALUES ($1) RETURNING id`,
          [familyName]
        );
        productId = inserted.rows[0].id;
      } else {
        await client.query(`UPDATE products SET name = $1 WHERE id = $2`, [familyName, productId]);
      }

      const variant = await client.query(
        `
          INSERT INTO product_colors (product_id, color, price)
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, color)
          DO UPDATE SET price = EXCLUDED.price
          RETURNING id
        `,
        [productId, color, price]
      );
      return { productId, colorId: variant.rows[0].id };
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const colorId = Number(req.params.id);
    const familyName = cleanText(req.body.familyName);
    const color = cleanText(req.body.color);
    const price = asMoney(req.body.price);
    if (!colorId || !familyName || !color || price === null) {
      return res.status(400).json({ error: 'Datos invalidos.' });
    }

    const result = await transaction(async (client) => {
      const variant = await client.query(`SELECT id, product_id FROM product_colors WHERE id = $1`, [colorId]);
      if (!variant.rows[0]) throw new Error('Color de producto no encontrado.');
      await client.query(`UPDATE products SET name = $1 WHERE id = $2`, [familyName, variant.rows[0].product_id]);
      await client.query(`UPDATE product_colors SET color = $1, price = $2 WHERE id = $3`, [color, price, colorId]);
      return { ok: true };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const colorId = Number(req.params.id);
    if (!colorId) return res.status(400).json({ error: 'ID invalido.' });
    await query(`DELETE FROM product_colors WHERE id = $1`, [colorId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clients', async (_req, res) => {
  try {
    res.json(await getClients());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const name = cleanText(req.body.name);
    const ci = cleanText(req.body.ci);
    const phone = cleanText(req.body.phone);
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    const { rows } = await query(
      `INSERT INTO clients (name, ci, phone) VALUES ($1, $2, $3) RETURNING *`,
      [name, ci || null, phone || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = cleanText(req.body.name);
    const ci = cleanText(req.body.ci);
    const phone = cleanText(req.body.phone);
    if (!id || !name) return res.status(400).json({ error: 'Datos invalidos.' });
    const { rows } = await query(
      `UPDATE clients SET name = $1, ci = $2, phone = $3 WHERE id = $4 RETURNING *`,
      [name, ci || null, phone || null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalido.' });
    await query(`DELETE FROM clients WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/movements', async (req, res) => {
  try {
    const group = req.query.group || 'sales';
    if (group === 'purchase') {
      return res.json(await fetchPurchaseRows());
    }
    if (group === 'production') {
      return res.json(await fetchProductionRows());
    }
    const [sales, orders] = await Promise.all([
      fetchSaleLikeRows('sale'),
      fetchSaleLikeRows('order'),
    ]);
    res.json([...sales, ...orders].sort((a, b) => {
      if (a.movement_date === b.movement_date) return Number(b.id) - Number(a.id);
      return a.movement_date < b.movement_date ? 1 : -1;
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/movements/:id', async (req, res) => {
  try {
    const movement = await getMovementById(Number(req.params.id));
    if (!movement) return res.status(404).json({ error: 'Movimiento no encontrado.' });
    res.json(movement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/movements/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalido.' });
    await query(`DELETE FROM movements WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/movements', async (req, res) => {
  try {
    const payload = req.body;
    const kind = cleanText(payload.kind);
    const movementDate = parseDate(payload.movementDate);
    const observations = cleanText(payload.observations) || null;
    if (!['sale', 'order', 'purchase', 'production'].includes(kind)) {
      return res.status(400).json({ error: 'Tipo de movimiento invalido.' });
    }
    if (!movementDate) return res.status(400).json({ error: 'La fecha es obligatoria.' });

    const result = await transaction(async (client) => {
      const movement = await client.query(
        `INSERT INTO movements (kind, movement_date) VALUES ($1, $2) RETURNING id, kind, movement_date`,
        [kind, movementDate]
      );
      const movementId = movement.rows[0].id;

      if (kind === 'purchase') {
        const materialName = cleanText(payload.materialName);
        const quantity = asPositiveInt(payload.quantity);
        const color = cleanText(payload.color) || null;
        const priceTotal = asMoney(payload.totalPrice);
        const location = cleanText(payload.location) || null;
        const executedBy = cleanText(payload.executedBy) || 'Rossell';
        if (!materialName || !quantity || priceTotal === null) {
          throw new Error('Datos invalidos en compra.');
        }
        await client.query(
          `INSERT INTO purchases (movement_id, material_name, quantity, color, price_total, location, executed_by, observations)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [movementId, materialName, quantity, color, priceTotal, location, executedBy, observations]
        );
        return { movementId };
      }

      const productId = payload.productFamilyId ? Number(payload.productFamilyId) : null;
      const items = Array.isArray(payload.items) ? payload.items : [];
      const productName = cleanText(payload.productFamilyName);
      const totalPrice = asMoney(payload.totalPrice);
      if (!productId || !productName || !items.length) {
        throw new Error('Faltan datos obligatorios.');
      }

      const normalizedItems = items
        .map((item) => ({
          variantId: item.variantId ? Number(item.variantId) : null,
          quantity: asPositiveInt(item.quantity),
          color: cleanText(item.color),
          size: cleanText(item.size) || null,
          unitPrice: asMoney(item.unitPrice),
        }))
        .filter((item) => item.variantId && item.quantity && item.color);
      if (!normalizedItems.length) {
        throw new Error('Debes completar al menos un detalle valido.');
      }
      const quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

      if (kind === 'sale' || kind === 'order') {
        const clientId = payload.clientId ? Number(payload.clientId) : null;
        const clientNameSnapshot = cleanText(payload.clientName) || null;
        const location = cleanText(payload.location) || null;
        const executedBy = cleanText(payload.executedBy) || 'Rossell';
        const commission =
          payload.commission === '' || payload.commission === null || payload.commission === undefined
            ? null
            : asMoney(payload.commission);
        const commissionMode = payload.commissionMode === 'unit' ? 'unit' : 'total';
        if (kind === 'sale' && totalPrice === null) throw new Error('El precio total es requerido.');

        await client.query(
          `
            INSERT INTO ${kind === 'sale' ? 'sales' : 'orders'} (
              movement_id, product_id, client_id, location, executed_by, commission_mode, commission, total_price, observations
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [movementId, productId, clientId, location, executedBy, commissionMode, commission, totalPrice || 0, observations]
        );

        const itemsTable = kind === 'sale' ? 'sale_items' : 'order_items';
        const movementFk = kind === 'sale' ? 'sale_movement_id' : 'order_movement_id';
        for (const item of normalizedItems) {
          await client.query(
            `INSERT INTO ${itemsTable} (${movementFk}, product_color_id, quantity, color, size, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [movementId, item.variantId, item.quantity, item.color, item.size, item.unitPrice || 0]
          );
        }
        return { movementId };
      }

      if (kind === 'production') {
        await client.query(
          `INSERT INTO productions (movement_id, product_id, total_price, observations) VALUES ($1, $2, $3, $4)`,
          [movementId, productId, 0, observations]
        );
        for (const item of normalizedItems) {
          await client.query(
            `INSERT INTO production_items (production_movement_id, product_color_id, quantity, color, size)
             VALUES ($1, $2, $3, $4, $5)`,
            [movementId, item.variantId, item.quantity, item.color, item.size]
          );
        }
        return { movementId };
      }

      return { movementId };
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/movements/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await getMovementKind(id);
    if (!existing) return res.status(404).json({ error: 'Movimiento no encontrado.' });

    const payload = req.body;
    const movementDate = parseDate(payload.movementDate);
    const observations = cleanText(payload.observations) || null;
    if (!movementDate) return res.status(400).json({ error: 'La fecha es obligatoria.' });

    await transaction(async (client) => {
      await client.query(`UPDATE movements SET movement_date = $1 WHERE id = $2`, [movementDate, id]);

      if (existing.kind === 'purchase') {
        const materialName = cleanText(payload.materialName);
        const quantity = asPositiveInt(payload.quantity);
        const color = cleanText(payload.color) || null;
        const priceTotal = asMoney(payload.totalPrice);
        const location = cleanText(payload.location) || null;
        const executedBy = cleanText(payload.executedBy) || 'Rossell';
        if (!materialName || !quantity || priceTotal === null) throw new Error('Datos invalidos en compra.');
        await client.query(
          `
            UPDATE purchases
            SET material_name = $1, quantity = $2, color = $3, price_total = $4,
                location = $5, executed_by = $6, observations = $7
            WHERE movement_id = $8
          `,
          [materialName, quantity, color, priceTotal, location, executedBy, observations, id]
        );
        return;
      }

      if (existing.kind === 'sale' || existing.kind === 'order') {
        const table = existing.kind === 'sale' ? 'sales' : 'orders';
        const itemsTable = existing.kind === 'sale' ? 'sale_items' : 'order_items';
        const movementFk = existing.kind === 'sale' ? 'sale_movement_id' : 'order_movement_id';
        const productId = payload.productFamilyId ? Number(payload.productFamilyId) : null;
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalPrice = asMoney(payload.totalPrice) || 0;
        const clientId = payload.clientId ? Number(payload.clientId) : null;
        const location = cleanText(payload.location) || null;
        const executedBy = cleanText(payload.executedBy) || 'Rossell';
        const commission =
          payload.commission === '' || payload.commission === null || payload.commission === undefined
            ? null
            : asMoney(payload.commission);
        const commissionMode = payload.commissionMode === 'unit' ? 'unit' : 'total';
        if (!productId || !items.length) throw new Error('Faltan datos del movimiento.');

        await client.query(
          `
            UPDATE ${table}
            SET product_id = $1, client_id = $2, location = $3, executed_by = $4,
                commission_mode = $5, commission = $6, total_price = $7, observations = $8
            WHERE movement_id = $9
          `,
          [productId, clientId, location, executedBy, commissionMode, commission, totalPrice, observations, id]
        );
        await client.query(`DELETE FROM ${itemsTable} WHERE ${movementFk} = $1`, [id]);

        const normalizedItems = items
          .map((item) => ({
            variantId: item.variantId ? Number(item.variantId) : null,
            quantity: asPositiveInt(item.quantity),
            color: cleanText(item.color),
            size: cleanText(item.size) || null,
            unitPrice: asMoney(item.unitPrice),
          }))
          .filter((item) => item.variantId && item.quantity && item.color);

        for (const item of normalizedItems) {
          await client.query(
            `INSERT INTO ${itemsTable} (${movementFk}, product_color_id, quantity, color, size, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, item.variantId, item.quantity, item.color, item.size, item.unitPrice || 0]
          );
        }
        return;
      }

      if (existing.kind === 'production') {
        const productId = payload.productFamilyId ? Number(payload.productFamilyId) : null;
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalPrice = asMoney(payload.totalPrice) || 0;
        if (!productId || !items.length) throw new Error('Faltan datos de produccion.');
        await client.query(
          `UPDATE productions SET product_id = $1, total_price = $2, observations = $3 WHERE movement_id = $4`,
          [productId, totalPrice, observations, id]
        );
        await client.query(`DELETE FROM production_items WHERE production_movement_id = $1`, [id]);
        const normalizedItems = items
          .map((item) => ({
            variantId: item.variantId ? Number(item.variantId) : null,
            quantity: asPositiveInt(item.quantity),
            color: cleanText(item.color),
            size: cleanText(item.size) || null,
          }))
          .filter((item) => item.variantId && item.quantity && item.color);
        for (const item of normalizedItems) {
          await client.query(
            `INSERT INTO production_items (production_movement_id, product_color_id, quantity, color, size)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, item.variantId, item.quantity, item.color, item.size]
          );
        }
      }
    });

    const updated = await getMovementById(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (!from || !to) return res.status(400).json({ error: 'Debes indicar fecha de inicio y fin.' });

    const [sales, orders, purchases, productions] = await Promise.all([
      fetchSaleLikeRows('sale', from, to),
      fetchSaleLikeRows('order', from, to),
      fetchPurchaseRows(from, to),
      fetchProductionRows(from, to),
    ]);

    const rows = [...sales, ...orders, ...purchases, ...productions].sort((a, b) => {
      if (a.movement_date === b.movement_date) return Number(a.id) - Number(b.id);
      return a.movement_date < b.movement_date ? -1 : 1;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Movimientos');
    worksheet.columns = [
      { header: 'Nro', key: 'nro', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Tipo de movimiento', key: 'tipo_movimiento', width: 18 },
      { header: 'Tipo de producto', key: 'tipo_producto', width: 24 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Color', key: 'color', width: 24 },
      { header: 'Talla', key: 'talla', width: 18 },
      { header: 'Precio', key: 'precio', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 22 },
      { header: 'Lugar', key: 'lugar', width: 24 },
      { header: 'Ejecutante', key: 'ejecutante', width: 18 },
      { header: 'Comisión', key: 'comision', width: 14 },
      { header: 'Observaciones', key: 'observaciones', width: 32 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    rows.forEach((row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const color = items
        .map((item) => (item.color ? `${item.color}${item.quantity ? ` x${item.quantity}` : ''}` : ''))
        .filter(Boolean)
        .join(' | ');
      const talla = items
        .map((item) => (item.size ? `${item.size}${item.quantity ? ` x${item.quantity}` : ''}` : ''))
        .filter(Boolean)
        .join(' | ');

      const commission = row.commission_mode === 'unit'
        ? Number(row.commission || 0) * Number(row.quantity || 0)
        : Number(row.commission || 0);
      worksheet.addRow({
        nro: row.id,
        fecha: row.movement_date,
        tipo_movimiento: movementLabel(row.kind),
        tipo_producto: row.product_name_snapshot,
        cantidad: row.quantity,
        color,
        talla,
        precio: Number(row.total_price || 0),
        cliente: row.client_name_snapshot || '',
        lugar: row.location || '',
        ejecutante: row.executed_by || 'Rossell',
        comision: commission || '',
        observaciones: row.observations || '',
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=movimientos_${from}_a_${to}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const [products, clients] = await Promise.all([getProducts(), getClients()]);
    res.json({ products, clients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (_req, res) => {
  const indexPath = fileURLToPath(new URL('./public/index.html', import.meta.url));
  res.sendFile(indexPath);
});

await ensureSchema();

app.listen(port, () => {
  console.log(`Rosel Sis listo en http://localhost:${port}`);
});
