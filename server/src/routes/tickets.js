import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';
import { normalizarPlaca, validarPlaca, calcularMontoV2, soles } from '../utils/peru.js';
import { asegurarEspacios } from '../utils/espacios.js';
import { logActividad } from '../utils/actividad.js';

const r = Router();
r.use(auth);

r.post('/in', async (req, res) => {
  try {
    let { garage_id, placa, tipo_vehiculo = 'auto', espacio = null, espacio_id = null } = req.body || {};
    if (!garage_id) return res.status(400).json({ error: 'Elige un garaje primero' });
    if (!placa || !String(placa).trim()) return res.status(400).json({ error: 'Escribe la placa (ej. ABC-123)' });
    placa = normalizarPlaca(placa);
    if (!validarPlaca(placa)) return res.status(400).json({ error: `Placa inválida (${placa}). Formato Perú ej. ABC-123` });

    const g = (await query(`SELECT * FROM garages WHERE id=$1`, [garage_id])).rows[0];
    if (!g) return res.status(404).json({ error: 'Garaje no existe. Recarga la página.' });
    if (!g.activo) return res.status(400).json({ error: 'Garaje desactivado por el administrador' });
    const permitidos = g.tipos_permitidos || [];
    if (!permitidos.includes(tipo_vehiculo))
      return res.status(400).json({ error: `No acepta ${tipo_vehiculo}. Permite: ${permitidos.join(', ') || '—'}` });
    if (g.exclusivo_camiones && tipo_vehiculo !== 'camion')
      return res.status(400).json({ error: 'Garaje exclusivo para camiones' });

    const ocup = Number((await query(`SELECT COUNT(*) AS n FROM tickets WHERE garage_id=$1 AND estado='activo'`, [garage_id])).rows[0]?.n || 0);
    if (ocup >= g.total_espacios) return res.status(409).json({ error: `Sin espacios: ${ocup}/${g.total_espacios} ocupados` });

    const dup = (await query(`SELECT id FROM tickets WHERE garage_id=$1 AND placa=$2 AND estado='activo'`, [garage_id, placa])).rows[0];
    if (dup) return res.status(409).json({ error: `La placa ${placa} ya está dentro (ticket #${dup.id})` });

    // Asignar espacio físico: el elegido o el primero libre
    await asegurarEspacios(garage_id, g.total_espacios);
    let sp = null;
    if (espacio_id) {
      sp = (await query(`SELECT * FROM spaces WHERE id=$1 AND garage_id=$2`, [espacio_id, garage_id])).rows[0];
      if (!sp) return res.status(404).json({ error: 'Espacio no existe' });
      if (sp.estado === 'ocupado') return res.status(409).json({ error: `Espacio ${sp.codigo} ya está ocupado` });
    } else if (espacio) {
      sp = (await query(`SELECT * FROM spaces WHERE garage_id=$1 AND codigo=$2`, [garage_id, String(espacio).toUpperCase().trim()])).rows[0];
      if (sp && sp.estado === 'ocupado') return res.status(409).json({ error: `Espacio ${sp.codigo} ya está ocupado` });
    }
    if (!sp) {
      sp = (await query(`SELECT * FROM spaces WHERE garage_id=$1 AND estado='libre' ORDER BY id LIMIT 1`, [garage_id])).rows[0];
    }
    if (!sp) return res.status(409).json({ error: 'Sin espacios libres en el mapa' });

    const { rows } = await query(
      `INSERT INTO tickets (garage_id,placa,tipo_vehiculo,espacio,operario_entrada) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [garage_id, placa, tipo_vehiculo, sp.codigo, req.user.nombre]
    );
    await query(`UPDATE spaces SET estado='ocupado', ticket_id=$1 WHERE id=$2`, [rows[0].id, sp.id]);
    await logActividad(req.user.id, 'entrada', `${placa} en ${sp.codigo} (#${rows[0].id})`, garage_id);
    res.status(201).json({ ticket: rows[0], espacio: sp.codigo, ocupados: ocup + 1, disponibles: g.total_espacios - ocup - 1 });
  } catch (e) {
    console.error('[tickets in]', e.message);
    res.status(500).json({ error: 'No se pudo registrar la entrada' });
  }
});

r.post('/out', async (req, res) => {
  try {
    const { ticket_id, garage_id, placa } = req.body || {};
    let t;
    if (ticket_id) t = (await query(`SELECT * FROM tickets WHERE id=$1 AND estado='activo'`, [ticket_id])).rows[0];
    else if (garage_id && placa)
      t = (await query(`SELECT * FROM tickets WHERE garage_id=$1 AND placa=$2 AND estado='activo'`, [garage_id, normalizarPlaca(placa)])).rows[0];
    if (!t) return res.status(404).json({ error: 'Ticket activo no encontrado. Quizá ya salió.' });

    const g = (await query(`SELECT * FROM garages WHERE id=$1`, [t.garage_id])).rows[0];
    const tarifa = (await query(`SELECT * FROM tariffs WHERE garage_id=$1 AND tipo_vehiculo=$2`, [t.garage_id, t.tipo_vehiculo])).rows[0] || {
      precio_hora: g.precio_hora, precio_tramo: null, precio_dia: g.precio_dia,
    };
    const salida = new Date();
    const calc = calcularMontoV2({ entrada: t.hora_entrada, salida, regla: g, tarifa });
    const { rows } = await query(
      `UPDATE tickets SET hora_salida=$2, estado='finalizado', monto_total=$3, tramo=$4, operario_salida=$5 WHERE id=$1 RETURNING *`,
      [t.id, salida.toISOString(), calc.monto, calc.tramo, req.user.nombre]
    );
    // Liberar el espacio en el mapa
    try {
      await query(`UPDATE spaces SET estado='libre', ticket_id=NULL WHERE ticket_id=$1`, [t.id]);
    } catch { /* no crítico */ }
    await logActividad(req.user.id, 'salida_cobro', `${t.placa} S/ ${calc.monto.toFixed(2)} (${calc.tramo})`, t.garage_id);
    res.json({ ticket: rows[0], calculo: { ...calc, monto_fmt: soles(calc.monto), moneda: 'PEN' } });
  } catch (e) {
    console.error('[tickets out]', e.message);
    res.status(500).json({ error: 'No se pudo cobrar la salida' });
  }
});

r.get('/activos/:garage_id', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM tickets WHERE garage_id=$1 AND estado='activo' ORDER BY hora_entrada`, [req.params.garage_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo listar vehículos dentro' });
  }
});

// Vista previa del cobro sin cerrar el ticket (para el modal del espacio)
r.get('/preview/:id', async (req, res) => {
  try {
    const t = (await query(`SELECT * FROM tickets WHERE id=$1 AND estado='activo'`, [req.params.id])).rows[0];
    if (!t) return res.status(404).json({ error: 'Ticket activo no encontrado' });
    const g = (await query(`SELECT * FROM garages WHERE id=$1`, [t.garage_id])).rows[0];
    const tarifa = (await query(`SELECT * FROM tariffs WHERE garage_id=$1 AND tipo_vehiculo=$2`, [t.garage_id, t.tipo_vehiculo])).rows[0] || {
      precio_hora: g.precio_hora, precio_tramo: null, precio_dia: g.precio_dia,
    };
    const calc = calcularMontoV2({ entrada: t.hora_entrada, salida: new Date(), regla: g, tarifa });
    res.json({ ticket: t, calculo: { ...calc, monto_fmt: soles(calc.monto), moneda: 'PEN' } });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo calcular' });
  }
});

r.get('/historial/:garage_id', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { rows } = await query(`SELECT * FROM tickets WHERE garage_id=$1 ORDER BY hora_entrada DESC LIMIT 300`, [req.params.garage_id]);
    const f = rows.filter((t) => {
      const dia = new Date(t.hora_entrada).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      return true;
    });
    res.json(f);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar historial' });
  }
});

r.get('/:id/ticket', async (req, res) => {
  try {
    const t = (await query(`SELECT t.*, g.nombre AS garaje, g.direccion, g.ciudad FROM tickets t JOIN garages g ON g.id=t.garage_id WHERE t.id=$1`, [req.params.id])).rows[0];
    if (!t) return res.status(404).send('Ticket no existe');
    const fmt = (d) => d ? new Date(d).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    res.send(`<html><head><meta charset="utf-8"><title>Ticket #${t.id}</title><style>body{font-family:monospace;width:280px;margin:0 auto;text-align:center}hr{border-top:1px dashed #000}</style></head><body>
      <h3>${t.garaje}</h3><div>${t.direccion || ''} - ${t.ciudad || 'Perú'}</div>
      <hr><div style="text-align:left">
      Ticket #${t.id}<br>Placa: <b>${t.placa}</b><br>Tipo: ${t.tipo_vehiculo}<br>Espacio: ${t.espacio || '-'}<br>
      Entrada (Lima): ${fmt(t.hora_entrada)}<br>Salida (Lima): ${fmt(t.hora_salida)}<br>Estado: ${t.estado}<br>
      Total: <b>S/ ${Number(t.monto_total).toFixed(2)}</b></div><hr>
      <div>Gracias por su preferencia</div>
      <script>window.print()</script></body></html>`);
  } catch (e) {
    res.status(500).send('Error al generar ticket');
  }
});

export default r;
