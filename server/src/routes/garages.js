import { Router } from 'express';
import { query } from '../db.js';
import { auth, esRol } from '../middleware/auth.js';
import { validarGaraje } from '../utils/validate.js';
import { asegurarEspacios, espaciosDe } from '../utils/espacios.js';
import { logActividad } from '../utils/actividad.js';

const r = Router();
r.use(auth);

async function conOcupacion(g) {
  let ocupados = 0;
  try {
    const c = await query(`SELECT COUNT(*) AS n FROM tickets WHERE garage_id=$1 AND estado='activo'`, [g.id]);
    ocupados = Number(c.rows[0]?.n || 0);
  } catch { ocupados = 0; }
  return { ...g, ocupados, disponibles: (g.total_espacios ?? 0) - ocupados };
}

// Lista según rol
r.get('/', async (req, res) => {
  try {
    const { id, rol } = req.user;
    const sql =
      rol === 'superadmin'
        ? `SELECT * FROM garages ORDER BY id DESC`
        : rol === 'owner'
        ? `SELECT * FROM garages WHERE owner_id=$1 ORDER BY id DESC`
        : `SELECT g.* FROM garages g JOIN users_garages ug ON ug.garage_id=g.id WHERE ug.user_id=$1 ORDER BY g.id DESC`;
    const params = rol === 'superadmin' ? [] : [id];
    const { rows } = await query(sql, params);
    res.json(await Promise.all(rows.map(conOcupacion)));
  } catch (e) {
    console.error('[garages GET /]', e.message);
    res.status(500).json({ error: 'No se pudo listar garajes. Recarga la página.' });
  }
});

// Crear (owner/superadmin) con validación clara
r.post('/', esRol('owner', 'superadmin'), async (req, res) => {
  try {
    const { id: owner_id, rol } = req.user;
    const g = req.body || {};
    const errores = validarGaraje(g);
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const {
      nombre, direccion = '', ciudad = 'Lima', zona = '',
      total_espacios = 20, tipos_permitidos = ['auto'],
      exclusivo_camiones = false, precio_hora = 5, precio_dia = 30, precio_mes = 200,
      tolerancia_min = 10, lat = null, lng = null,
      modo_cobro = 'hora', tramo_min = 30, tope_dia_horas = 8, minimo_ticket = 0,
      dia_tipo = 'corrido', dia_corte = '00:00', noche_desde = null, noche_hasta = null,
      precio_noche = null, recargo_finde_pct = 0,
    } = g;
    const { rows } = await query(
      `INSERT INTO garages (owner_id,nombre,direccion,ciudad,zona,lat,lng,total_espacios,tipos_permitidos,exclusivo_camiones,precio_hora,precio_dia,precio_mes,tolerancia_min,modo_cobro,tramo_min,tope_dia_horas,minimo_ticket,dia_tipo,dia_corte,noche_desde,noche_hasta,precio_noche,recargo_finde_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [rol === 'superadmin' && g.owner_id ? g.owner_id : owner_id,
       String(nombre).trim(), String(direccion || '').trim(), String(ciudad || 'Lima').trim(), String(zona || '').trim(),
       lat === '' || lat == null ? null : +lat, lng === '' || lng == null ? null : +lng,
       +total_espacios, tipos_permitidos, !!exclusivo_camiones,
       +precio_hora, +precio_dia, +precio_mes, +(tolerancia_min ?? 10),
       modo_cobro, +tramo_min, +(tope_dia_horas ?? 0), +(minimo_ticket || 0), dia_tipo, dia_corte || '00:00',
       noche_desde || null, noche_hasta || null,
       precio_noche == null || precio_noche === '' ? null : +precio_noche, +(recargo_finde_pct || 0)]
    );
    const creado = rows[0];
    await asegurarEspacios(creado.id, +total_espacios);
    await logActividad(rol === 'superadmin' && g.owner_id ? g.owner_id : owner_id, 'garaje_creado', `${creado.nombre} (${creado.total_espacios} espacios)`, creado.id);
    const pTramoBase = +((+precio_hora) * ((+tramo_min || 60) / 60)).toFixed(2);
    for (const t of tipos_permitidos) {
      try {
        await query(
          `INSERT INTO tariffs (garage_id,tipo_vehiculo,precio_hora,precio_tramo,precio_dia,precio_mes) VALUES ($1,$2,$3,$4,$5,$6)`,
          [creado.id, t, +precio_hora, pTramoBase, +precio_dia, +precio_mes]
        );
      } catch { /* duplicado: ignorar */ }
    }
    res.status(201).json(await conOcupacion(creado));
  } catch (e) {
    console.error('[garages POST]', e.message);
    res.status(500).json({ error: 'No se pudo guardar el garaje: ' + e.message });
  }
});

r.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM garages WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Garaje no encontrado' });
    const tarifas = (await query(`SELECT * FROM tariffs WHERE garage_id=$1 ORDER BY tipo_vehiculo`, [req.params.id])).rows;
    res.json({ ...(await conOcupacion(rows[0])), tarifas });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar el garaje' });
  }
});

r.put('/:id', esRol('owner', 'superadmin'), async (req, res) => {
  try {
    const g = req.body || {};
    if (g.nombre != null && String(g.nombre).trim().length < 3)
      return res.status(400).json({ error: 'Nombre mínimo 3 caracteres' });
    if (g.total_espacios != null && (+g.total_espacios < 1 || +g.total_espacios > 5000))
      return res.status(400).json({ error: 'Espacios entre 1 y 5000' });
    const { rows } = await query(
      `UPDATE garages SET nombre=COALESCE($2,nombre), direccion=COALESCE($3,direccion), ciudad=COALESCE($4,ciudad), zona=COALESCE($14,zona),
       lat=COALESCE($12,lat), lng=COALESCE($13,lng),
       total_espacios=COALESCE($5,total_espacios), tipos_permitidos=COALESCE($6,tipos_permitidos),
       exclusivo_camiones=COALESCE($7,exclusivo_camiones), precio_hora=COALESCE($8,precio_hora),
       precio_dia=COALESCE($9,precio_dia), precio_mes=COALESCE($10,precio_mes), tolerancia_min=COALESCE($11,tolerancia_min),
       modo_cobro=COALESCE($15,modo_cobro), tramo_min=COALESCE($16,tramo_min), tope_dia_horas=COALESCE($17,tope_dia_horas),
       minimo_ticket=COALESCE($18,minimo_ticket), dia_tipo=COALESCE($19,dia_tipo), dia_corte=COALESCE($20,dia_corte),
       noche_desde=COALESCE($21,noche_desde), noche_hasta=COALESCE($22,noche_hasta), precio_noche=COALESCE($23,precio_noche),
       recargo_finde_pct=COALESCE($24,recargo_finde_pct)
       WHERE id=$1 RETURNING *`,
      [req.params.id, g.nombre ?? null, g.direccion ?? null, g.ciudad ?? null, g.total_espacios ?? null,
       g.tipos_permitidos ?? null, g.exclusivo_camiones ?? null, g.precio_hora ?? null,
       g.precio_dia ?? null, g.precio_mes ?? null, g.tolerancia_min ?? null,
       g.lat === '' || g.lat == null ? null : +g.lat, g.lng === '' || g.lng == null ? null : +g.lng,
       g.zona ?? null,
       g.modo_cobro ?? null, g.tramo_min ?? null, g.tope_dia_horas ?? null, g.minimo_ticket ?? null,
       g.dia_tipo ?? null, g.dia_corte ?? null, g.noche_desde ?? null, g.noche_hasta ?? null,
       g.precio_noche === '' || g.precio_noche == null ? null : +g.precio_noche, g.recargo_finde_pct ?? null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Garaje no encontrado' });
    if (g.total_espacios != null) {
      try { await asegurarEspacios(rows[0].id, rows[0].total_espacios); } catch { /* no crítico */ }
    }
    res.json(await conOcupacion(rows[0]));
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar: ' + e.message });
  }
});

r.delete('/:id', esRol('owner', 'superadmin'), async (req, res) => {
  try {
    const g = (await query(`SELECT * FROM garages WHERE id=$1`, [req.params.id])).rows[0];
    if (!g) return res.status(404).json({ error: 'Garaje no encontrado' });
    if (req.user.rol === 'owner' && g.owner_id !== req.user.id)
      return res.status(403).json({ error: 'No es tu garaje' });
    const activos = Number((await query(`SELECT COUNT(*) AS n FROM tickets WHERE garage_id=$1 AND estado='activo'`, [req.params.id])).rows[0]?.n || 0);
    if (activos > 0) return res.status(409).json({ error: `Hay ${activos} vehículo(s) dentro. Cobra las salidas primero.` });
    await query(`DELETE FROM garages WHERE id=$1`, [req.params.id]);
    await logActividad(req.user.id, 'garaje_eliminado', `${g.nombre} (id ${g.id})`, null);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
});

// Tarifas por tipo de vehículo
r.put('/:id/tarifas', esRol('owner', 'superadmin'), async (req, res) => {
  try {
    const lista = req.body?.tarifas;
    if (!Array.isArray(lista) || !lista.length) return res.status(400).json({ error: 'Envía tarifas: [{tipo_vehiculo, precio_hora, precio_dia, precio_mes}]' });
    for (const t of lista) {
      if (t.precio_hora == null || t.precio_dia == null) return res.status(400).json({ error: `Tarifa ${t.tipo_vehiculo}: hora y día requeridos` });
      const ex = (await query(`SELECT id FROM tariffs WHERE garage_id=$1 AND tipo_vehiculo=$2`, [req.params.id, t.tipo_vehiculo])).rows[0];
      if (ex) await query(`UPDATE tariffs SET precio_hora=$1, precio_dia=$2, precio_mes=$3, precio_tramo=$4 WHERE id=$5`, [+t.precio_hora, +t.precio_dia, t.precio_mes ?? null, t.precio_tramo ?? null, ex.id]);
      else await query(`INSERT INTO tariffs (garage_id,tipo_vehiculo,precio_hora,precio_dia,precio_mes,precio_tramo) VALUES ($1,$2,$3,$4,$5,$6)`, [req.params.id, t.tipo_vehiculo, +t.precio_hora, +t.precio_dia, t.precio_mes ?? null, t.precio_tramo ?? null]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo guardar tarifas' });
  }
});

// Mapa de espacios en vivo: libres y ocupados con placa
r.get('/:id/espacios', async (req, res) => {
  try {
    const g = (await query(`SELECT * FROM garages WHERE id=$1`, [req.params.id])).rows[0];
    if (!g) return res.status(404).json({ error: 'Garaje no encontrado' });
    await asegurarEspacios(g.id, g.total_espacios);
    const espacios = await espaciosDe(g.id);
    const libres = espacios.filter((e) => e.estado !== 'ocupado').length;
    res.json({ total: espacios.length, libres, ocupados: espacios.length - libres, espacios });
  } catch (e) {
    console.error('[espacios]', e.message);
    res.status(500).json({ error: 'No se pudo cargar el mapa de espacios' });
  }
});

// Reporte del día (Lima): ingresos + movimientos
r.get('/:id/reporte', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM tickets WHERE garage_id=$1 ORDER BY hora_entrada DESC LIMIT 500`, [req.params.id]);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
    const deHoy = rows.filter((t) => {
      const f = new Date(t.hora_entrada).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      return f === hoy;
    });
    const ingresosHoy = deHoy.filter((t) => t.estado === 'finalizado').reduce((a, t) => a + Number(t.monto_total || 0), 0);
    res.json({
      total_tickets: rows.length,
      hoy_movimientos: deHoy.length,
      hoy_ingresos_pen: +ingresosHoy.toFixed(2),
      activos: rows.filter((t) => t.estado === 'activo').length,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo generar reporte' });
  }
});

export default r;
