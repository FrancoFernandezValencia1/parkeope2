import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
dotenv.config();

import authRoutes from './routes/auth.js';
import garageRoutes from './routes/garages.js';
import ticketRoutes from './routes/tickets.js';
import adminRoutes from './routes/admin.js';
import geoRoutes from './routes/geo.js';
import publicRoutes from './routes/public.js';
import { query } from './db.js';

const ES_PROD = process.env.NODE_ENV === 'production';

// En producción se exige secreto JWT largo (las sesiones dependen de él)
if (ES_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('[seguridad] FATAL: define JWT_SECRET (mín 32 caracteres) en producción.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  // El ticket imprimible usa window.print en HTML propio: se permite contenido inline del mismo origen
  contentSecurityPolicy: ES_PROD ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
// CORS cerrado: solo tus frontends (coma-separados en FRONT_URL). Vacío = abierto (solo dev).
const permitidos = (process.env.FRONT_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: permitidos.length ? permitidos : true,
  credentials: false,
}));
app.use(express.json({ limit: '200kb' }));
app.set('trust proxy', 1);
process.env.TZ = 'America/Lima';

// Anti fuerza bruta en autenticación
const limLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espera 15 minutos.' } });
const limRegistro = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas cuentas creadas. Intenta en una hora.' } });
// Mapas: protege el proxy de Nominatim (1 peticion/segundo hacia OpenStreetMap)
const limGeo = rateLimit({ windowMs: 60 * 1000, max: 90, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas busquedas. Espera un momento.' } });
app.use('/api/auth/login', limLogin);
app.use('/api/auth/register', limRegistro);
app.use('/api/auth/verificar', limLogin);
app.use('/api/auth/reenviar', limLogin);
app.use('/api/geo', limGeo);

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try {
    await query('SELECT 1');
  } catch (e) {
    db = 'error';
  }
  res.json({
    ok: db === 'ok', zona: 'America/Lima', moneda: 'PEN (S/)', db,
    hora_lima: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/garages', garageRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/public', publicRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
// eslint-disable-next-line
app.use((err, req, res, next) => {
  console.error('[api]', err?.message);
  res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
});

const PORT = process.env.PORT || 4000;

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'owner',
  email_verificado BOOLEAN DEFAULT false,
  codigo_verificacion TEXT,
  codigo_expira TIMESTAMPTZ,
  terminos_aceptado BOOLEAN DEFAULT false,
  terminos_fecha TIMESTAMPTZ,
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
  estado TEXT DEFAULT 'activo',
  monto_total NUMERIC(10,2) DEFAULT 0,
  tramo TEXT,
  operario_entrada TEXT,
  operario_salida TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
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
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity (user_id);
`;

await query(DDL);
console.log('[db] tablas listas');
// Columnas de ubicación para BDs ya creadas (nuevas van en el DDL)
for (const col of [
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS zona TEXT DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono TEXT DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS codigo_verificacion TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS codigo_expira TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS terminos_aceptado BOOLEAN DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS terminos_fecha TIMESTAMPTZ`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS modo_cobro TEXT DEFAULT 'hora'`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS tramo_min INTEGER DEFAULT 60`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS tope_dia_horas INTEGER DEFAULT 8`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS minimo_ticket NUMERIC(10,2) DEFAULT 0`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS dia_tipo TEXT DEFAULT 'corrido'`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS dia_corte TIME DEFAULT '00:00'`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS noche_desde TIME`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS noche_hasta TIME`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS precio_noche NUMERIC(10,2)`,
  `ALTER TABLE garages ADD COLUMN IF NOT EXISTS recargo_finde_pct INTEGER DEFAULT 0`,
  `ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS precio_tramo NUMERIC(10,2)`,
]) {
  try { await query(col); } catch { /* ya existe o no soportado: ignorar */ }
}

// Seed superadmin (tu cuenta). Define ADMIN_EMAIL/ADMIN_PASSWORD en .env en nube.
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@garajes.pe').toLowerCase().trim();
const adminPass = process.env.ADMIN_PASSWORD || 'Admin123!';
if (ES_PROD && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'Admin123!')) {
  console.error('[seguridad] FATAL: cambia ADMIN_PASSWORD en producción.');
  process.exit(1);
}
try {
  const ex = (await query(`SELECT id FROM users WHERE email=$1`, [adminEmail])).rows[0];
  if (!ex) {
    const hash = await bcrypt.hash(adminPass, 10);
    await query(`INSERT INTO users (nombre, email, telefono, password_hash, rol, email_verificado) VALUES ('Administrador',$1,'',$2,'superadmin',true)`, [adminEmail, hash]);
    console.log(`[seed] superadmin creado: ${adminEmail}`);
  } else {
    console.log(`[seed] superadmin existe: ${adminEmail}`);
  }
} catch (e) {
  console.error('[seed] no se pudo crear admin:', e.message);
}

app.listen(PORT, () => console.log(`[server] http://localhost:${PORT} | Lima ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`));
