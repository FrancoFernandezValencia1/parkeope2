// Constantes Perú - NO cambiar sin migración
export const PERU = {
  TIMEZONE: 'America/Lima', // UTC-5 todo el año, sin horario verano
  CURRENCY: 'PEN',
  CURRENCY_SYMBOL: 'S/',
  LOCALE: 'es-PE',
  // Placas Perú: ABC-123 (particular), AB-1234 / T1A-123 (moto), etc. Validación flexible.
  PLACA_REGEX: /^[A-Z0-9]{2,3}-?[A-Z0-9]{3,4}$/,
  DNI_REGEX: /^\d{8}$/,
  RUC_REGEX: /^(\d{11})$/,
  TIPOS_VEHICULO: ['moto', 'auto', 'camioneta', 'van', 'camion', 'bus', 'otro'],
};

// Formatea monto en soles: S/ 12.50
export const soles = (n) =>
  `S/ ${Number(n || 0).toFixed(2)}`;

// Normaliza placa peruana: quita espacios/guiones extra, mayúsculas
export function normalizarPlaca(placa) {
  if (!placa) return '';
  const p = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Re-inserta guion estilo PE si tiene 6 chars: ABC123 -> ABC-123
  if (p.length === 6) return `${p.slice(0, 3)}-${p.slice(3)}`;
  return p;
}

export function validarPlaca(placa) {
  const p = String(placa || '').toUpperCase().trim();
  return PERU.PLACA_REGEX.test(p);
}

// Hora actual en Lima como Date (se guarda UTC en timestamptz)
export const ahoraLima = () => new Date();

export function minutosEntre(entrada, salida = new Date()) {
  return Math.max(0, Math.ceil((new Date(salida) - new Date(entrada)) / 60000));
}

/**
 * Cálculo de tarifa estilo cochera Perú:
 * - toleranciaMin: minutos de gracia antes de cobrar hora extra (ej. 10)
 * - Si totalMin <= tolerancia y es salida rápida: cobra 0 (cortesía). Si no, mínimo 1 hora.
 * - Por hora o fracción: ceil(totalMin / 60) * precioHora
 * - Si supera diaDesdeHoras (ej. 8h): cobra por día: ceil(totalMin / 1440) * precioDia
 * - precioMes solo referencial para abonos (no auto en ticket eventual).
 */
export function calcularMonto({ entrada, salida = new Date(), precioHora, precioDia, toleranciaMin = 10, diaDesdeHoras = 8 }) {
  const totalMin = minutosEntre(entrada, salida);
  if (totalMin <= toleranciaMin) return { totalMin, monto: 0, tramo: 'cortesia', horas: 0, dias: 0 };

  const horasExactas = totalMin / 60;
  if (horasExactas <= diaDesdeHoras) {
    const horas = Math.ceil(horasExactas);
    return { totalMin, monto: +(horas * precioHora).toFixed(2), tramo: 'hora', horas, dias: 0 };
  }
  const dias = Math.ceil(totalMin / 1440);
  return { totalMin, monto: +(dias * precioDia).toFixed(2), tramo: 'dia', horas: Math.ceil(horasExactas), dias };
}

// ---------- Motor V2: modos de cobro por garaje ----------
const aMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};
function partesLima(fecha) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(fecha));
  const get = (t) => +parts.find((p) => p.type === t).value;
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') };
}
function diaServicio(fecha, corteMin) {
  const p = partesLima(fecha);
  const ms = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return Math.floor((ms - corteMin * 60000) / 86400000);
}
function enVentana(minActual, desde, hasta) {
  if (desde == null || hasta == null) return false;
  return desde <= hasta ? (minActual >= desde && minActual <= hasta) : (minActual >= desde || minActual <= hasta);
}

/**
 * regla: fila de garages (modo_cobro, tramo_min, tope_dia_horas, minimo_ticket,
 *   dia_tipo, dia_corte, noche_desde, noche_hasta, precio_noche, recargo_finde_pct, tolerancia_min, precios base)
 * tarifa: fila de tariffs del tipo de vehículo (precio_hora, precio_tramo, precio_dia)
 */
export function calcularMontoV2({ entrada, salida = new Date(), regla = {}, tarifa = {} }) {
  const totalMin = minutosEntre(entrada, salida);
  const tol = +(regla.tolerancia_min ?? 10);
  if (totalMin <= tol) return { totalMin, monto: 0, tramo: 'cortesia', detalle: `Cortesía (${tol} min)` };

  const precioHora = +(tarifa.precio_hora ?? regla.precio_hora ?? 0);
  const precioDia = +(tarifa.precio_dia ?? regla.precio_dia ?? 0);
  const modo = regla.modo_cobro || 'hora';
  const pE = partesLima(entrada);
  const pS = partesLima(salida);
  const minE = pE.h * 60 + pE.mi;
  const minS = pS.h * 60 + pS.mi;

  // Trasnoche plana: toda la estadía dentro de la ventana nocturna
  const nD = regla.noche_desde ? aMin(String(regla.noche_desde).slice(0, 5)) : null;
  const nH = regla.noche_hasta ? aMin(String(regla.noche_hasta).slice(0, 5)) : null;
  if (regla.precio_noche != null && enVentana(minE, nD, nH) && enVentana(minS, nD, nH)) {
    return aplicarExtras({ totalMin, monto: +regla.precio_noche, tramo: 'noche', detalle: `Tarifa nocturna plana S/ ${(+regla.precio_noche).toFixed(2)}` }, regla, salida);
  }

  let monto = 0, tramo = modo, detalle = '';
  if (modo === 'dia') {
    let dias;
    if ((regla.dia_tipo || 'corrido') === 'calendario') {
      const corte = aMin(String(regla.dia_corte || '00:00').slice(0, 5)) ?? 0;
      dias = Math.max(1, diaServicio(salida, corte) - diaServicio(entrada, corte) + 1);
      detalle = `${dias} día(s) calendario`;
    } else {
      dias = Math.max(1, Math.ceil(totalMin / 1440));
      detalle = `${dias} día(s) de 24 h`;
    }
    monto = dias * precioDia;
  } else if (modo === 'tramos') {
    const tm = Math.min(Math.max(+(regla.tramo_min || 30), 5), 240);
    const pTramo = tarifa.precio_tramo != null ? +tarifa.precio_tramo : +(precioHora * (tm / 60)).toFixed(2);
    const tope = +(regla.tope_dia_horas ?? 0);
    if (tope > 0 && totalMin / 60 > tope) {
      const dias = Math.ceil(totalMin / 1440);
      monto = dias * precioDia;
      tramo = 'dia';
      detalle = `Supera tope (${tope} h): ${dias} día(s)`;
    } else {
      const n = Math.ceil(totalMin / tm);
      monto = n * pTramo;
      detalle = `${n} tramo(s) de ${tm} min × S/ ${pTramo.toFixed(2)}`;
    }
  } else { // hora | mixto
    const tope = modo === 'mixto' ? +(regla.tope_dia_horas ?? 8) : 0;
    const horasExactas = totalMin / 60;
    if (tope > 0 && horasExactas > tope) {
      const dias = Math.ceil(totalMin / 1440);
      monto = dias * precioDia;
      tramo = 'dia';
      detalle = `Supera tope (${tope} h): ${dias} día(s)`;
    } else {
      const horas = Math.ceil(horasExactas);
      monto = horas * precioHora;
      detalle = `${horas} hora(s) × S/ ${precioHora.toFixed(2)}`;
    }
  }
  return aplicarExtras({ totalMin, monto, tramo, detalle }, regla, salida);
}

function aplicarExtras(base, regla, salida) {
  let { monto, detalle } = base;
  const min = +(regla.minimo_ticket || 0);
  if (min > 0 && monto > 0 && monto < min) {
    detalle += ` · mínimo S/ ${min.toFixed(2)}`;
    monto = min;
  }
  const rec = +(regla.recargo_finde_pct || 0);
  if (rec > 0 && monto > 0) {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'short' }).format(new Date(salida));
    if (wd === 'Sat' || wd === 'Sun') {
      monto = +((monto * (1 + rec / 100)).toFixed(2));
      detalle += ` · fin de semana +${rec}%`;
    }
  } else {
    monto = +monto.toFixed(2);
  }
  return { ...base, monto, detalle };
}
