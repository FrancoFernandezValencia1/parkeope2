export const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
export const normEmail = (e) => String(e || '').toLowerCase().trim();

// Celular Perú: 9 dígitos empezando en 9 (acepta +51, espacios y guiones)
export function normTelefono(t) {
  const d = String(t || '').replace(/\D/g, '').replace(/^51/, '');
  return d;
}
export const telefonoOk = (t) => /^9\d{8}$/.test(normTelefono(t));

export function validarRegistro({ nombre, email, telefono, password, confirm, terminos }) {
  const errores = [];
  if (!nombre || String(nombre).trim().length < 3) errores.push('Nombre completo (mín 3 caracteres)');
  if (!emailOk(email)) errores.push('Email inválido');
  if (!telefonoOk(telefono)) errores.push('Celular Perú inválido (9 dígitos, ej. 987654321)');
  if (!password || String(password).length < 8) errores.push('Contraseña mínimo 8 caracteres');
  if (/^\d+$/.test(String(password || ''))) errores.push('La contraseña no puede ser solo números');
  if (confirm !== undefined && password !== confirm) errores.push('Las contraseñas no coinciden');
  if (terminos !== undefined && !terminos) errores.push('Debes aceptar los términos');
  return errores;
}

export function validarGaraje(g = {}) {
  const errores = [];
  if (!g.nombre || String(g.nombre).trim().length < 3) errores.push('Nombre del garaje mínimo 3 caracteres');
  if (!g.ciudad || !String(g.ciudad).trim()) errores.push('Selecciona la ciudad');
  if (!Number.isInteger(+g.total_espacios) || +g.total_espacios < 1 || +g.total_espacios > 5000)
    errores.push('Total de espacios debe ser entero entre 1 y 5000');
  if (!Array.isArray(g.tipos_permitidos) || g.tipos_permitidos.length === 0)
    errores.push('Elige al menos un tipo de vehículo');
  for (const k of ['precio_hora', 'precio_dia', 'precio_mes']) {
    if (g[k] == null || isNaN(+g[k]) || +g[k] < 0) errores.push(`${k} debe ser número ≥ 0`);
  }
  const MODOS = ['hora', 'tramos', 'dia', 'mixto'];
  if (g.modo_cobro != null && !MODOS.includes(g.modo_cobro)) errores.push('Modo de cobro inválido');
  if (g.tramo_min != null && (![15, 30, 60].includes(+g.tramo_min))) errores.push('Tramo debe ser 15, 30 o 60 min');
  if (g.tope_dia_horas != null && (isNaN(+g.tope_dia_horas) || +g.tope_dia_horas < 0 || +g.tope_dia_horas > 24)) errores.push('Tope diario entre 0 y 24 h (0 = sin tope)');
  if (g.minimo_ticket != null && (isNaN(+g.minimo_ticket) || +g.minimo_ticket < 0)) errores.push('Mínimo debe ser ≥ 0');
  if (g.dia_tipo != null && !['corrido', 'calendario'].includes(g.dia_tipo)) errores.push('Día inválido');
  if (g.recargo_finde_pct != null && (isNaN(+g.recargo_finde_pct) || +g.recargo_finde_pct < 0 || +g.recargo_finde_pct > 100)) errores.push('Recargo finde 0–100%');
  if (g.lat != null && g.lat !== '' && (isNaN(+g.lat) || +g.lat < -90 || +g.lat > 90))
    errores.push('Latitud inválida');
  if (g.lng != null && g.lng !== '' && (isNaN(+g.lng) || +g.lng < -180 || +g.lng > 180))
    errores.push('Longitud inválida');
  return errores;
}

export const esDuplicado = (e) =>
  e?.code === '23505' || /duplicate|unique|ya existe/i.test(e?.message || '');
