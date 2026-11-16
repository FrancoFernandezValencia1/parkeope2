import { query } from '../db.js';

const codigo = (i) => `E-${String(i).padStart(2, '0')}`;

// Crea los espacios faltantes hasta total_espacios. Idempotente.
export async function asegurarEspacios(garage_id, total) {
  const ex = (await query(`SELECT COUNT(*) AS n FROM spaces WHERE garage_id=$1`, [garage_id])).rows[0];
  const tiene = Number(ex?.n || 0);
  for (let i = tiene + 1; i <= total; i++) {
    try {
      await query(`INSERT INTO spaces (garage_id, codigo) VALUES ($1,$2)`, [garage_id, codigo(i)]);
    } catch { /* duplicado: ignorar */ }
  }
}

export async function espaciosDe(garage_id) {
  const { rows } = await query(
    `SELECT s.id, s.codigo, s.estado, s.ticket_id, t.placa, t.tipo_vehiculo, t.hora_entrada
     FROM spaces s LEFT JOIN tickets t ON t.id=s.ticket_id
     WHERE s.garage_id=$1 ORDER BY s.id`,
    [garage_id]
  );
  return rows;
}
