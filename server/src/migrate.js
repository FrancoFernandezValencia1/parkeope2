import { query } from './db.js';

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'owner' CHECK (rol IN ('superadmin','owner','operador')),
  email_verificado BOOLEAN DEFAULT false,
  codigo_verificacion TEXT,
  codigo_expira TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS garages (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT DEFAULT 'Lima',
  zona TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  moneda TEXT DEFAULT 'PEN',
  zona_horaria TEXT DEFAULT 'America/Lima',
  total_espacios INTEGER NOT NULL DEFAULT 20,
  tipos_permitidos TEXT[] DEFAULT ARRAY['moto','auto','camioneta'],
  exclusivo_camiones BOOLEAN DEFAULT false,
  hora_apertura TIME DEFAULT '00:00',
  hora_cierre TIME DEFAULT '23:59',
  precio_hora NUMERIC(10,2) DEFAULT 5.00,
  precio_dia NUMERIC(10,2) DEFAULT 30.00,
  precio_mes NUMERIC(10,2) DEFAULT 200.00,
  tolerancia_min INTEGER DEFAULT 10,
  modo_cobro TEXT DEFAULT 'hora',
  tramo_min INTEGER DEFAULT 60,
  tope_dia_horas INTEGER DEFAULT 8,
  minimo_ticket NUMERIC(10,2) DEFAULT 0,
  dia_tipo TEXT DEFAULT 'corrido',
  dia_corte TIME DEFAULT '00:00',
  noche_desde TIME,
  noche_hasta TIME,
  precio_noche NUMERIC(10,2),
  recargo_finde_pct INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users_garages (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  garage_id INTEGER REFERENCES garages(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, garage_id)
);
CREATE TABLE IF NOT EXISTS tariffs (
  id SERIAL PRIMARY KEY,
  garage_id INTEGER REFERENCES garages(id) ON DELETE CASCADE,
  tipo_vehiculo TEXT NOT NULL,
  precio_hora NUMERIC(10,2) NOT NULL,
  precio_tramo NUMERIC(10,2),
  precio_dia NUMERIC(10,2) NOT NULL,
  precio_mes NUMERIC(10,2),
  UNIQUE (garage_id, tipo_vehiculo)
);
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  garage_id INTEGER REFERENCES garages(id) ON DELETE CASCADE,
  placa TEXT NOT NULL,
  tipo_vehiculo TEXT NOT NULL DEFAULT 'auto',
  espacio TEXT,
  hora_entrada TIMESTAMPTZ DEFAULT now(),
  hora_salida TIMESTAMPTZ,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','finalizado','anulado')),
  monto_total NUMERIC(10,2) DEFAULT 0,
  tramo TEXT,
  operario_entrada TEXT,
  operario_salida TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_activos ON tickets (garage_id, estado) WHERE estado = 'activo';
CREATE INDEX IF NOT EXISTS idx_tickets_placa ON tickets (placa);
CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  garage_id INTEGER REFERENCES garages(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  estado TEXT DEFAULT 'libre',
  ticket_id INTEGER,
  UNIQUE (garage_id, codigo)
);
CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  detalle TEXT DEFAULT '',
  garage_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

try {
  await query(DDL);
  console.log('[migrate] OK - tablas listas');
  process.exit(0);
} catch (e) {
  console.error('[migrate] ERROR', e.message);
  process.exit(1);
}
