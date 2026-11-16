import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { auth, esRol } from '../middleware/auth.js';
import { validarRegistro, normEmail, normTelefono, esDuplicado } from '../utils/validate.js';
import { logActividad, codigo6 } from '../utils/actividad.js';
import { enviarCodigo } from '../utils/correo.js';

const r = Router();
const firmar = (u) =>
  jwt.sign({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre }, process.env.JWT_SECRET || 'dev', { expiresIn: '12h' });

const publico = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono || '', rol: u.rol, email_verificado: !!u.email_verificado });
// El código visible solo en demo local (ALLOW_DEMO_CODES) o fuera de producción.
// En producción real configura SMTP_* y el código viaja solo por correo.
const mostrarCodigoDemo = () => process.env.ALLOW_DEMO_CODES === 'true' || process.env.NODE_ENV !== 'production';

// ---- Registro de DUEÑO con verificación por correo ----
r.post('/register', async (req, res) => {
  try {
    const { nombre, email, telefono, password, confirm, terminos } = req.body || {};
    const errores = validarRegistro({ nombre, email, telefono, password, confirm, terminos });
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const hash = await bcrypt.hash(password, 10);
    const codigo = codigo6();
    const expira = new Date(Date.now() + 15 * 60000).toISOString();
    try {
      const { rows } = await query(
        `INSERT INTO users (nombre, email, telefono, password_hash, rol, email_verificado, codigo_verificacion, codigo_expira, terminos_aceptado, terminos_fecha)
         VALUES ($1,$2,$3,$4,'owner',false,$5,$6,true,now()) RETURNING id,nombre,email,telefono,rol,email_verificado`,
        [String(nombre).trim(), normEmail(email), normTelefono(telefono), hash, codigo, expira]
      );
      let envio;
      try {
        envio = await enviarCodigo(rows[0].email, codigo, rows[0].nombre);
      } catch (mailErr) {
        console.error('[registro correo]', mailErr.message);
        // La cuenta quedó creada: el usuario pide Reenviar código
        return res.status(201).json({ ok: true, email: rows[0].email, mensaje: 'Cuenta creada, pero el correo tardó. Usa Reenviar código.' });
      }
      await logActividad(rows[0].id, 'registro', `Dueño registrado ${rows[0].email}`);
      // El código demo SOLO se expone si lo permites (nunca en producción real)
      res.status(201).json({
        ok: true, email: rows[0].email,
        mensaje: envio.modo === 'smtp' ? 'Te enviamos un código de 6 dígitos a tu correo.' : 'Modo demo: usa el código mostrado.',
        ...(mostrarCodigoDemo() && envio.modo === 'demo' ? { dev_code: envio.dev_code } : {}),
      });
    } catch (e) {
      if (esDuplicado(e)) return res.status(409).json({ error: 'Ese email ya está registrado. Usa Entrar.' });
      throw e;
    }
  } catch (e) {
    console.error('[auth register]', e.message);
    res.status(500).json({ error: 'No se pudo registrar. Intenta de nuevo.' });
  }
});

// ---- Confirmar código de 6 dígitos ----
r.post('/verificar', async (req, res) => {
  try {
    const { email, codigo } = req.body || {};
    if (!email || !codigo) return res.status(400).json({ error: 'Email y código requeridos' });
    const { rows } = await query(`SELECT * FROM users WHERE email=$1`, [normEmail(email)]);
    const u = rows[0];
    if (!u) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (u.email_verificado) return res.json({ user: publico(u), token: firmar(u), ya_verificado: true });
    if (!u.codigo_verificacion || String(u.codigo_verificacion) !== String(codigo).trim())
      return res.status(400).json({ error: 'Código incorrecto' });
    if (u.codigo_expira && new Date(u.codigo_expira) < new Date())
      return res.status(400).json({ error: 'Código vencido. Pide uno nuevo.' });
    const upd = (await query(`UPDATE users SET email_verificado=true, codigo_verificacion=NULL, codigo_expira=NULL WHERE id=$1 RETURNING id,nombre,email,telefono,rol,email_verificado`, [u.id])).rows[0];
    await logActividad(u.id, 'verificacion', 'Correo verificado');
    res.json({ user: publico(upd), token: firmar(upd) });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo verificar' });
  }
});

// ---- Reenviar código ----
r.post('/reenviar', async (req, res) => {
  try {
    const { email } = req.body || {};
    const { rows } = await query(`SELECT * FROM users WHERE email=$1`, [normEmail(email)]);
    const u = rows[0];
    if (!u) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (u.email_verificado) return res.status(400).json({ error: 'Tu correo ya está verificado. Entra normal.' });
    const codigo = codigo6();
    const expira = new Date(Date.now() + 15 * 60000).toISOString();
    await query(`UPDATE users SET codigo_verificacion=$1, codigo_expira=$2 WHERE id=$3`, [codigo, expira, u.id]);
    const envio = await enviarCodigo(u.email, codigo, u.nombre);
    res.json({ ok: true, mensaje: 'Código reenviado.', ...(mostrarCodigoDemo() && envio.modo === 'demo' ? { dev_code: envio.dev_code } : {}) });
  } catch (e) {
    console.error('[reenviar]', e.message);
    res.status(500).json({ error: 'No se pudo enviar el correo. Revisa tu conexión o pide otro código en unos minutos.' });
  }
});

// ---- Login (dueños y operadores verificados; superadmin siempre) ----
r.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const { rows } = await query(`SELECT * FROM users WHERE email=$1`, [normEmail(email)]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    if (u.rol !== 'superadmin' && !u.email_verificado)
      return res.status(403).json({ error: 'Confirma tu correo con el código de 6 dígitos para entrar.', necesita_verificacion: true, email: u.email });
    let garages = [];
    if (u.rol === 'owner') {
      garages = (await query(`SELECT id,nombre FROM garages WHERE owner_id=$1 ORDER BY id DESC`, [u.id])).rows;
    } else if (u.rol === 'operador') {
      garages = (await query(
        `SELECT g.id,g.nombre FROM garages g JOIN users_garages ug ON ug.garage_id=g.id WHERE ug.user_id=$1 ORDER BY g.id DESC`, [u.id]
      )).rows;
    }
    await logActividad(u.id, 'login', `Entró (${u.rol})`);
    res.json({ user: publico(u), garages, token: firmar(u) });
  } catch (e) {
    console.error('[auth login]', e.message);
    res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
  }
});

r.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT id,nombre,email,telefono,rol,email_verificado FROM users WHERE id=$1`, [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Sesión inválida. Vuelve a entrar.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Error de sesión' });
  }
});

// ---- Operadores (los crea el dueño: verificados automáticamente) ----
r.get('/operadores/:garage_id', auth, esRol('owner', 'superadmin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id,u.nombre,u.email,u.telefono FROM users u JOIN users_garages ug ON ug.user_id=u.id WHERE ug.garage_id=$1 AND u.rol='operador' ORDER BY u.id`,
      [req.params.garage_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo listar operadores' });
  }
});

r.post('/operador', auth, esRol('owner', 'superadmin'), async (req, res) => {
  try {
    const { nombre, email, telefono = '', password, garage_id } = req.body || {};
    const errores = [];
    if (!nombre || String(nombre).trim().length < 3) errores.push('Nombre (mín 3)');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''))) errores.push('Email inválido');
    if (telefono && !/^9\d{8}$/.test(normTelefono(telefono))) errores.push('Celular inválido');
    if (!password || String(password).length < 8) errores.push('Contraseña mínimo 8');
    if (!garage_id) errores.push('garage_id requerido');
    if (errores.length) return res.status(400).json({ error: errores.join('. ') });
    const hash = await bcrypt.hash(password, 10);
    let u;
    try {
      const { rows } = await query(
        `INSERT INTO users (nombre, email, telefono, password_hash, rol, email_verificado) VALUES ($1,$2,$3,$4,'operador',true) RETURNING id,nombre,email,telefono,rol,email_verificado`,
        [String(nombre).trim(), normEmail(email), telefono ? normTelefono(telefono) : '', hash]
      );
      u = rows[0];
    } catch (e) {
      if (esDuplicado(e)) return res.status(409).json({ error: 'Ese email ya existe como usuario' });
      throw e;
    }
    try {
      await query(`INSERT INTO users_garages (user_id, garage_id) VALUES ($1,$2)`, [u.id, garage_id]);
    } catch { /* ya asignado */ }
    await logActividad(req.user.id, 'operador_creado', `${u.nombre} (${u.email})`, garage_id);
    res.status(201).json({ user: publico(u) });
  } catch (e) {
    console.error('[auth operador]', e.message);
    res.status(500).json({ error: 'No se pudo crear el operador' });
  }
});

r.delete('/operador/:id', auth, esRol('owner', 'superadmin'), async (req, res) => {
  try {
    await query(`DELETE FROM users_garages WHERE user_id=$1`, [req.params.id]);
    const { rows } = await query(`DELETE FROM users WHERE id=$1 AND rol='operador' RETURNING id`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Operador no encontrado' });
    await logActividad(req.user.id, 'operador_eliminado', `id ${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
});

export default r;
