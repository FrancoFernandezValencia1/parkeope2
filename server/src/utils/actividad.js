import { query } from '../db.js';

// Registro de actividad para el panel admin (quién hizo qué, cuándo, en qué garaje)
export async function logActividad(userId, accion, detalle = '', garageId = null) {
  try {
    await query(`INSERT INTO activity (user_id, accion, detalle, garage_id) VALUES ($1,$2,$3,$4)`,
      [userId || null, accion, String(detalle || '').slice(0, 500), garageId]);
  } catch { /* auditoría best-effort: nunca rompe la operación */ }
}

export const codigo6 = () => String(Math.floor(100000 + Math.random() * 900000));
