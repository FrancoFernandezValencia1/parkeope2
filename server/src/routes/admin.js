import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { auth, esRol } from '../middleware/auth.js';
import { validarRegistro, normEmail, normTelefono, esDuplicado } from '../utils/validate.js';
import { logActividad } from '../utils/actividad.js';

const r = Router();
// Todo aquí es SOLO para el superadmin (tú). Los dueños usan /api/auth y /api/garages.
r.use(auth, esRol('superadmin'));

r.get('/stats', async (req, res) => {
  try {
    const owners = (await query(`SELECT COUNT(*) AS n FROM users WHERE rol='owner'`)).rows[0];
    const ops = (await query(`SELECT COUNT(*) AS n FROM users WHERE rol='operador'`)).rows[0];
    const garages = (await query(`SELECT COUNT(*) AS n FROM garages`)).rows[0];
    const activos = (await query(`SELECT COUNT(*) AS n FROM tickets WHERE estado='activo'`)).rows[0];
    const ingresos = (await query(`SELECT COALESCE(SUM(monto_total),0) AS s FROM tickets WHERE estado='finalizado'`)).rows[0];
    res.json({
      owners: Number(owners?.n || 0),
      operadores: Number(ops?.n || 0),
      garajes: Number(garages?.n || 0),
      vehiculos_dentro: Number(activos?.n || 0),
      ingresos_pen: Number(ingresos?.s || 0),
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo calcular stats' });
  }
});

r.get('/owners', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id,nombre,email,telefono,email_verificado,created_at FROM users WHERE rol='owner' ORDER BY id DESC`
    );
    const out = [];
    for (const o of rows) {
      const g = await query(`SELECT id,nombre,total_espacios,activo FROM garages WHERE owner_id=$1`, [o.id]);
      out.push({ ...o, garajes: g.rows });
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo listar dueños' });
  }
});

// Crear usuario desde el panel admin (dueño u operador, ya verificado)
r.post('/users', async (req, res) => {
  try {
    const { nombre, email, telefono = '', password, rol = 'owner', garage_id = null } = req.body || {};
    const errores = [];
    if (!nombre || String(nombre).trim().length < 3) errores.push('Nombre (mín 3)');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''))) errores.push('Email inválido');
    if (telefono && !/^9\d{8}$/.test(normTelefono(telefono))) errores.push('Celular inválido');
    if (!password || String(password).length < 8) errores.push('Contraseña mínimo 8');
    if (!['owner', 'operador'].includes(rol)) errores.push('Rol inválido');
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const hash = await bcrypt.hash(password, 10);
    let u;
    try {
      const { rows } = await query(
        `INSERT INTO users (nombre, email, telefono, password_hash, rol, email_verificado) VALUES ($1,$2,$3,$4,$5,true) RETURNING id,nombre,email,telefono,rol,email_verificado`,
        [String(nombre).trim(), normEmail(email), telefono ? normTelefono(telefono) : '', hash, rol]
      );
      u = rows[0];
    } catch (e) {
      if (esDuplicado(e)) return res.status(409).json({ error: 'Email ya registrado' });
      throw e;
    }
    if (rol === 'operador' && garage_id) {
      try { await query(`INSERT INTO users_garages (user_id, garage_id) VALUES ($1,$2)`, [u.id, garage_id]); } catch { /* ya asignado */ }
    }
    await logActividad(req.user.id, 'usuario_creado', `${u.nombre} (${u.email}, ${u.rol})`);
    res.status(201).json(u);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
});

// Todos los usuarios con conteos (para ver actividad por separado)
r.get('/users', async (req, res) => {
  try {
    const { rol } = req.query;
    const { rows } = await query(
      rol ? `SELECT id,nombre,email,telefono,rol,email_verificado,created_at FROM users WHERE rol=$1 ORDER BY id DESC`
          : `SELECT id,nombre,email,telefono,rol,email_verificado,created_at FROM users ORDER BY id DESC`,
      rol ? [rol] : []
    );
    const out = [];
    for (const u of rows) {
      let extra = {};
      if (u.rol === 'owner') {
        const g = await query(`SELECT id,nombre,ciudad,zona FROM garages WHERE owner_id=$1`, [u.id]);
        extra = { garajes: g.rows };
      } else if (u.rol === 'operador') {
        const g = await query(`SELECT g.id,g.nombre,g.ciudad,g.zona FROM garages g JOIN users_garages ug ON ug.garage_id=g.id WHERE ug.user_id=$1`, [u.id]);
        extra = { garajes: g.rows };
      }
      const act = (await query(`SELECT COUNT(*) AS n FROM activity WHERE user_id=$1`, [u.id])).rows[0];
      out.push({ ...u, ...extra, eventos: Number(act?.n || 0) });
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo listar usuarios' });
  }
});

// Ficha completa de un usuario: perfil + garajes + ingresos + actividad
r.get('/users/:id/resumen', async (req, res) => {
  try {
    const u = (await query(`SELECT id,nombre,email,telefono,rol,email_verificado,created_at FROM users WHERE id=$1`, [req.params.id])).rows[0];
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    let garajes = [];
    if (u.rol === 'owner') {
      garajes = (await query(`SELECT * FROM garages WHERE owner_id=$1 ORDER BY id`, [u.id])).rows;
    } else if (u.rol === 'operador') {
      garajes = (await query(`SELECT g.* FROM garages g JOIN users_garages ug ON ug.garage_id=g.id WHERE ug.user_id=$1 ORDER BY g.id`, [u.id])).rows;
    }
    // Ocupación actual por garaje
    for (const g of garajes) {
      const c = await query(`SELECT COUNT(*) AS n FROM tickets WHERE garage_id=$1 AND estado='activo'`, [g.id]);
      g.ocupados = Number(c.rows[0]?.n || 0);
      g.disponibles = (g.total_espacios ?? 0) - g.ocupados;
    }
    const gids = garajes.map((g) => g.id);
    let tickets = [];
    if (gids.length) {
      const marks = gids.map((_, i) => `$${i + 1}`).join(',');
      tickets = (await query(`SELECT hora_salida,monto_total,garage_id FROM tickets WHERE estado='finalizado' AND garage_id IN (${marks})`, gids)).rows;
    }
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' });
    const porMes = {};
    for (const t of tickets) {
      if (!t.hora_salida) continue;
      const k = fmt.format(new Date(t.hora_salida));
      porMes[k] = porMes[k] || { mes: k, ingresos: 0, tickets: 0 };
      porMes[k].ingresos += Number(t.monto_total || 0);
      porMes[k].tickets += 1;
    }
    const serie = [];
    const hoy = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      serie.push(porMes[k] || { mes: k, ingresos: 0, tickets: 0 });
    }
    serie.forEach((s) => { s.ingresos = +s.ingresos.toFixed(2); });
    const actividad = (await query(`SELECT * FROM activity WHERE user_id=$1 ORDER BY id DESC LIMIT 100`, [u.id])).rows;
    res.json({
      usuario: u, garajes,
      ingresos_total: +serie.reduce((a, s) => a + s.ingresos, 0).toFixed(2),
      tickets_total: tickets.length,
      serie, actividad,
    });
  } catch (e) {
    console.error('[resumen]', e.message);
    res.status(500).json({ error: 'No se pudo cargar la ficha' });
  }
});

// Actividad (feed global o por usuario)
r.get('/actividad', async (req, res) => {
  try {
    const { user_id, limit = 150 } = req.query;
    const n = Math.min(Math.max(+limit || 150, 1), 500);
    const { rows } = user_id
      ? await query(`SELECT a.*, u.nombre AS usuario, u.rol FROM activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id=$1 ORDER BY a.id DESC LIMIT $2`, [user_id, n])
      : await query(`SELECT a.*, u.nombre AS usuario, u.rol FROM activity a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT $1`, [n]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar actividad' });
  }
});

// Ingresos por mes (zona Lima): serie global + por garaje, con crecimiento %
r.get('/ingresos', async (req, res) => {
  try {
    const meses = Math.min(+(req.query.meses || 12), 24);
    const { garage_id, ciudad, zona } = req.query;
    let base;
    if (garage_id) {
      base = (await query(`SELECT hora_salida,monto_total,garage_id FROM tickets WHERE garage_id=$1 AND estado='finalizado'`, [garage_id])).rows;
    } else if (ciudad || zona) {
      let sql = `SELECT t.hora_salida,t.monto_total,t.garage_id FROM tickets t JOIN garages g ON g.id=t.garage_id WHERE t.estado='finalizado'`;
      const p = [];
      if (ciudad) { p.push(ciudad); sql += ` AND g.ciudad=$${p.length}`; }
      if (zona) { p.push(zona); sql += ` AND g.zona=$${p.length}`; }
      base = (await query(sql, p)).rows;
    } else {
      base = (await query(`SELECT hora_salida,monto_total,garage_id FROM tickets WHERE estado='finalizado'`)).rows;
    }
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' });
    const porMes = {};
    for (const t of base) {
      if (!t.hora_salida) continue;
      const k = fmt.format(new Date(t.hora_salida)); // YYYY-MM
      porMes[k] = porMes[k] || { mes: k, ingresos: 0, tickets: 0 };
      porMes[k].ingresos += Number(t.monto_total || 0);
      porMes[k].tickets += 1;
    }
    // últimos N meses con ceros incluidos
    const serie = [];
    const hoy = new Date();
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      serie.push(porMes[k] || { mes: k, ingresos: 0, tickets: 0 });
    }
    serie.forEach((s) => { s.ingresos = +s.ingresos.toFixed(2); });
    for (let i = 1; i < serie.length; i++) {
      const ant = serie[i - 1].ingresos;
      serie[i].crec_pct = ant > 0 ? +(((serie[i].ingresos - ant) / ant) * 100).toFixed(1) : (serie[i].ingresos > 0 ? 100 : 0);
    }
    if (serie.length) serie[0].crec_pct = 0;
    res.json({ serie, total: +serie.reduce((a, s) => a + s.ingresos, 0).toFixed(2) });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo calcular ingresos' });
  }
});

r.get('/garages', async (req, res) => {
  try {
    const { ciudad, zona } = req.query;
    let sql = `SELECT g.*, u.nombre AS owner_nombre, u.email AS owner_email FROM garages g LEFT JOIN users u ON u.id=g.owner_id`;
    const p = [];
    if (ciudad) { p.push(ciudad); sql += ` WHERE g.ciudad=$${p.length}`; }
    if (zona) { p.push(zona); sql += `${p.length > 1 ? ' AND' : ' WHERE'} g.zona=$${p.length}`; }
    sql += ` ORDER BY g.id DESC`;
    res.json((await query(sql, p)).rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo listar garajes' });
  }
});

// Ciudades y zonas existentes (para filtros)
r.get('/ubicaciones', async (req, res) => {
  try {
    const { rows } = await query(`SELECT DISTINCT ciudad, zona FROM garages ORDER BY ciudad, zona`);
    const out = {};
    for (const r of rows) {
      const c = r.ciudad || 'Sin ciudad';
      out[c] = out[c] || [];
      if (r.zona && !out[c].includes(r.zona)) out[c].push(r.zona);
    }
    res.json({ ciudades: Object.keys(out), zonas: out });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar ubicaciones' });
  }
});

r.put('/garages/:id/estado', async (req, res) => {
  try {
    const { rows } = await query(`UPDATE garages SET activo=$2 WHERE id=$1 RETURNING *`, [req.params.id, !!req.body.activo]);
    if (!rows[0]) return res.status(404).json({ error: 'Garaje no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cambiar estado' });
  }
});

export default r;
