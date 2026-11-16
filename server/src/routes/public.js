import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

// Listado público de garajes para el mapa de usuarios
// Sin autenticación, solo lectura, sin datos sensibles
r.get('/garages', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre, direccion, ciudad, zona, lat, lng, precio_hora, precio_dia, precio_mes, total_espacios, tipos_permitidos
       FROM garages
       WHERE lat IS NOT NULL AND lng IS NOT NULL AND activo = true
       ORDER BY id ASC`
    );

    const ocupacion = await query(
      `SELECT garage_id, COUNT(*) AS n FROM tickets WHERE estado = 'activo' GROUP BY garage_id`
    );
    const ocupadosPorGaraje = new Map(ocupacion.rows.map((t) => [Number(t.garage_id), Number(t.n)]));

    const garajes = rows.map((g) => {
      const ocupados = ocupadosPorGaraje.get(Number(g.id)) || 0;
      const total = Number(g.total_espacios || 0);
      return {
        id: g.id,
        nombre: g.nombre,
        direccion: g.direccion || '',
        ciudad: g.ciudad || 'Lima',
        zona: g.zona || '',
        lat: Number(g.lat),
        lng: Number(g.lng),
        precio_hora: Number(g.precio_hora || 0),
        precio_dia: Number(g.precio_dia || 0),
        precio_mes: Number(g.precio_mes || 0),
        total_espacios: total,
        ocupados,
        libres: Math.max(0, total - ocupados),
        tipos_permitidos: g.tipos_permitidos || ['auto'],
      };
    });

    res.json({ garajes, total: garajes.length });
  } catch (e) {
    console.error('[public/garages]', e.message);
    res.status(500).json({ error: 'No se pudieron cargar los garajes' });
  }
});

r.get('/garages/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre, direccion, ciudad, zona, lat, lng, precio_hora, precio_dia, precio_mes, total_espacios, tipos_permitidos
       FROM garages
       WHERE id = $1 AND lat IS NOT NULL AND lng IS NOT NULL AND activo = true`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Garaje no encontrado' });

    const ocupados = Number((await query(`SELECT COUNT(*) AS n FROM tickets WHERE garage_id = $1 AND estado = 'activo'`, [req.params.id])).rows[0]?.n || 0);
    const g = rows[0];
    const total = Number(g.total_espacios || 0);

    res.json({
      ...g,
      lat: Number(g.lat),
      lng: Number(g.lng),
      precio_hora: Number(g.precio_hora || 0),
      precio_dia: Number(g.precio_dia || 0),
      precio_mes: Number(g.precio_mes || 0),
      total_espacios: total,
      ocupados,
      libres: Math.max(0, total - ocupados),
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar el garaje' });
  }
});

export default r;
