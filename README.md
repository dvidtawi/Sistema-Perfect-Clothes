# Rosel Sis

Prototipo persistente con PostgreSQL para ventas, compras, produccion, pedidos, productos y clientes.

## Requisitos

- Node.js 18+
- PostgreSQL 16+ instalado y en ejecucion en tu equipo

## Configuracion

1. Instala dependencias:

```bash
npm install
```

2. Crea un archivo `.env` si quieres personalizar la conexion:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rosel_sis
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=rosel_sis
PORT=3000
```

Si tu servidor local usa otra clave, cambia `PGPASSWORD`. Cuando estan definidas las variables `PG*`, la app las usa por encima de `DATABASE_URL`.

3. Inicializa la base de datos y el esquema:

```bash
npm run init-db
```

## Ejecutar

```bash
npm start
```

Luego abre `http://localhost:3000`.

## Notas

- Los movimientos de venta, pedido, compra y produccion se guardan en PostgreSQL.
- La exportacion a Excel usa las columnas solicitadas por el usuario.
- La base visual es HTML/CSS/JS puro, sin framework.
