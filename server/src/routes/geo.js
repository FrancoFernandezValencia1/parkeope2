import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

/*
 * Modulo de mapas de ParkeoPe.
 *
 * Todas las consultas salen del servidor, nunca del navegador:
 *   - Nominatim (OpenStreetMap) exige maximo 1 peticion por segundo y un
 *     User-Agent identificable. Aqui se cumple con una cola de 1.1 s y cache.
 *   - Los resultados se guardan 7 dias en memoria para no golpear el servicio.
 */

const r = Router();

const UA = 'ParkeoPe/1.0 (+https://parkeope-parkeo-pe.vercel.app; contacto@parkeope.pe)';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org';

/* ---------------- cache en memoria ---------------- */
const cache = new Map();
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias
const MAX_ENTRADAS = 800;
let aciertos = 0;
let externas = 0;

function leerCache(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.t > TTL) { cache.delete(k); return null; }
  aciertos++;
  return e.v;
}
function guardarCache(k, v) {
  if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value);
  cache.set(k, { t: Date.now(), v });
}

/* ---------------- cola de 1 peticion/segundo ---------------- */
let cola = Promise.resolve();
function enCola(fn) {
  const p = cola.then(fn);
  cola = p.catch(() => {}).then(() => new Promise((ok) => setTimeout(ok, 1100)));
  return p;
}

async function pedirJson(url, ms = 9000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-PE,es;q=0.9', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Servicio de mapas respondio ' + res.status);
  externas++;
  return res.json();
}

/* ---------------- utilidades ---------------- */
const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Peru: lat -18.35 .. -0.04 | lng -81.33 .. -68.65
const LAT = [-18.5, 0];
const LNG = [-81.5, -68.5];

export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function normalizarAddress(a = {}) {
  const calle = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ');
  const distrito = a.suburb || a.neighbourhood || a.city_district || a.district || '';
  const ciudad = a.city || a.town || a.village || a.municipality || '';
  return {
    calle: calle || '',
    distrito,
    ciudad,
    region: a.state || a.region || '',
    pais: a.country || '',
    codigo_pais: a.country_code || '',
  };
}

/* ================= GET /api/geo/buscar?q=...&limite=5 ================= */
r.get('/buscar', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 160);
  if (q.length < 3) return res.status(400).json({ error: 'Escribe al menos 3 caracteres.' });
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 5, 1), 10);
  const clave = 'buscar:' + q.toLowerCase() + ':' + limite;

  const guardado = leerCache(clave);
  if (guardado) return res.json({ fuente: 'cache', resultados: guardado });

  try {
    const params = new URLSearchParams({
      q, format: 'jsonv2', addressdetails: '1', limit: String(limite),
      countrycodes: 'pe', 'accept-language': 'es',
    });
    const datos = await enCola(() => pedirJson(`${NOMINATIM}/search?${params}`));
    const resultados = (Array.isArray(datos) ? datos : []).map((d) => ({
      nombre: String(d.display_name || '').split(',')[0],
      direccion: d.display_name || '',
      lat: +d.lat,
      lng: +d.lon,
      tipo: d.type || d.class || '',
      importancia: +d.importance || 0,
      direccion_partes: normalizarAddress(d.address),
    }));
    guardarCache(clave, resultados);
    res.json({ fuente: 'nominatim', resultados });
  } catch (e) {
    console.error('[geo buscar]', e.message);
    res.status(502).json({ error: 'No se pudo consultar el buscador de direcciones. Intenta otra vez.' });
  }
});

/* ================= GET /api/geo/reverse?lat=..&lng=.. ================= */
r.get('/reverse', async (req, res) => {
  const lat = num(req.query.lat, LAT[0], LAT[1]);
  const lng = num(req.query.lng, LNG[0], LNG[1]);
  if (lat == null || lng == null) return res.status(400).json({ error: 'Coordenadas invalidas o fuera del Peru.' });

  const clave = `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const guardado = leerCache(clave);
  if (guardado) return res.json({ fuente: 'cache', ...guardado });

  try {
    const params = new URLSearchParams({
      format: 'jsonv2', lat: String(lat), lon: String(lng),
      zoom: '18', addressdetails: '1', 'accept-language': 'es',
    });
    const d = await enCola(() => pedirJson(`${NOMINATIM}/reverse?${params}`));
    const partes = normalizarAddress(d.address);
    const salida = {
      direccion: d.display_name || '',
      lat: +d.lat || lat,
      lng: +d.lon || lng,
      ...partes,
    };
    guardarCache(clave, salida);
    res.json({ fuente: 'nominatim', ...salida });
  } catch (e) {
    console.error('[geo reverse]', e.message);
    res.status(502).json({ error: 'No se pudo obtener la direccion del punto.' });
  }
});

/* ================= GET /api/geo/distancia?lat1&lng1&lat2&lng2 ================= */
r.get('/distancia', (req, res) => {
  const a = { lat: num(req.query.lat1, LAT[0], LAT[1]), lng: num(req.query.lng1, LNG[0], LNG[1]) };
  const b = { lat: num(req.query.lat2, LAT[0], LAT[1]), lng: num(req.query.lng2, LNG[0], LNG[1]) };
  if ([a.lat, a.lng, b.lat, b.lng].some((v) => v == null)) {
    return res.status(400).json({ error: 'Coordenadas invalidas o fuera del Peru.' });
  }
  const km = distanciaKm(a, b);
  res.json({ km: +km.toFixed(3), metros: Math.round(km * 1000), metodo: 'haversine' });
});

/* ================= GET /api/geo/ruta?lat1&lng1&lat2&lng2 ================= */
// Tiempo y distancia real por calle (OSRM, motor de rutas de OpenStreetMap)
r.get('/ruta', async (req, res) => {
  const a = { lat: num(req.query.lat1, LAT[0], LAT[1]), lng: num(req.query.lng1, LNG[0], LNG[1]) };
  const b = { lat: num(req.query.lat2, LAT[0], LAT[1]), lng: num(req.query.lng2, LNG[0], LNG[1]) };
  if ([a.lat, a.lng, b.lat, b.lng].some((v) => v == null)) {
    return res.status(400).json({ error: 'Coordenadas invalidas o fuera del Peru.' });
  }
  const clave = `ruta:${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  const guardado = leerCache(clave);
  if (guardado) return res.json({ fuente: 'cache', ...guardado });

  try {
    const url = `${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false`;
    const d = await pedirJson(url);
    const ruta = d?.routes?.[0];
    if (!ruta) throw new Error('Sin ruta');
    const salida = {
      km: +(ruta.distance / 1000).toFixed(2),
      minutos: Math.max(1, Math.round(ruta.duration / 60)),
      metodo: 'osrm',
    };
    guardarCache(clave, salida);
    res.json({ fuente: 'osrm', ...salida });
  } catch (e) {
    // Si OSRM falla, la linea recta sirve igual para ordenar por cercania
    const km = distanciaKm(a, b);
    res.json({ fuente: 'fallback', km: +km.toFixed(2), minutos: Math.round((km / 25) * 60), metodo: 'haversine' });
  }
});

/* ================= GET /api/geo/cercanas?lat&lng&radio_km=5 ================= */
// Cocheras con coordenadas, ordenadas por distancia (base del "Waze de cocheras")
r.get('/cercanas', auth, async (req, res) => {
  const lat = num(req.query.lat, LAT[0], LAT[1]);
  const lng = num(req.query.lng, LNG[0], LNG[1]);
  if (lat == null || lng == null) return res.status(400).json({ error: 'Coordenadas invalidas o fuera del Peru.' });
  const radio = Math.min(Math.max(Number(req.query.radio_km) || 5, 0.2), 50);
  const soloLibres = req.query.solo_libres !== '0';
  // Por defecto solo las cocheras del usuario. Con ?alcance=todas se usa el modo "Waze".
  const { id: usuarioId, rol } = req.user;
  const alcance = req.query.alcance === 'todas' ? 'todas' : 'mias';

  try {
    let sql = `SELECT g.id, g.nombre, g.direccion, g.ciudad, g.zona, g.lat, g.lng,
                      g.precio_hora, g.total_espacios
                 FROM garages g
                WHERE g.lat IS NOT NULL AND g.lng IS NOT NULL`;
    const params = [];
    if (alcance === 'mias' && rol === 'owner') {
      sql += ' AND g.owner_id = $1'; params.push(usuarioId);
    } else if (alcance === 'mias' && rol !== 'superadmin') {
      sql += ' AND EXISTS (SELECT 1 FROM users_garages ug WHERE ug.garage_id = g.id AND ug.user_id = $1)';
      params.push(usuarioId);
    }
    const { rows } = await query(sql, params);
    const ocupacion = await query(
      `SELECT garage_id, COUNT(*) AS n FROM tickets WHERE estado = 'activo' GROUP BY garage_id`
    );
    const ocupadosPorGaraje = new Map(ocupacion.rows.map((t) => [Number(t.garage_id), Number(t.n)]));
    const cocheras = rows
      .map((g) => {
        const km = distanciaKm({ lat, lng }, { lat: +g.lat, lng: +g.lng });
        const ocupados = ocupadosPorGaraje.get(Number(g.id)) || 0;
        return {
          id: g.id,
          nombre: g.nombre,
          direccion: g.direccion || '',
          ciudad: g.ciudad || '',
          zona: g.zona || '',
          lat: +g.lat,
          lng: +g.lng,
          total: g.total_espacios,
          ocupados,
          libres: (g.total_espacios || 0) - ocupados,
          precio_hora: +(g.precio_hora || 0),
          distancia_km: +km.toFixed(2),
          minutos_aprox: Math.max(1, Math.round((km / 25) * 60)),
        };
      })
      .filter((g) => g.distancia_km <= radio)
      .filter((g) => (soloLibres ? g.libres > 0 : true))
      .sort((x, y) => x.distancia_km - y.distancia_km);

    res.json({ origen: { lat, lng }, radio_km: radio, total: cocheras.length, cocheras });
  } catch (e) {
    console.error('[geo cercanas]', e.message);
    res.status(500).json({ error: 'No se pudieron cargar las cocheras cercanas.' });
  }
});

/* ================= GET /api/geo/estado ================= */
// Diagnostico del modulo (util en la sustentacion: muestra cache y peticiones)
r.get('/estado', (_req, res) => {
  res.json({
    servicio: 'ParkeoPe geo',
    apis: {
      nominatim: NOMINATIM,
      osrm: OSRM,
      tiles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    },
    cache: { entradas: cache.size, aciertos, peticiones_externas: externas },
    reglas: { max_peticiones_por_segundo: 1, ttl_cache_dias: 7 },
  });
});

export default r;
