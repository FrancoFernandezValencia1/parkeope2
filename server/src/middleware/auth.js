import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token. Vuelve a entrar.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
  } catch {
    return res.status(401).json({ error: 'Sesión vencida. Sal y vuelve a entrar.' });
  }
  // El usuario debe existir (si el server se reinició en demo, los tokens viejos mueren aquí)
  try {
    const { rows } = await query(`SELECT id,nombre,email,rol FROM users WHERE id=$1`, [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Sesión antigua. Sal y vuelve a entrar.' });
    req.user = rows[0];
  } catch {
    req.user = payload; // si la BD falla, no bloquear por este chequeo
  }
  next();
}

export const esRol = (...roles) => (req, res, next) =>
  roles.includes(req.user?.rol) ? next() : res.status(403).json({ error: 'Sin permiso' });
