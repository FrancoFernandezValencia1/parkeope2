import { useEffect, useRef, useState } from 'react';
import { api, ticketUrl, fmtLima, soles } from './lib/api.js';
import MapaCocheras from './MapaCocheras.jsx';

const TIPOS = ['moto', 'auto', 'camioneta', 'van', 'camion', 'bus'];
const CIUDADES = ['Lima', 'Callao', 'Arequipa', 'Cusco', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Huancayo', 'Tacna', 'Puno', 'Ayacucho', 'Cajamarca', 'Ica', 'Chimbote', 'Huánuco', 'Tarapoto', 'Pucallpa', 'Tumbes', 'Moquegua', 'Huaraz', 'Abancay', 'Huancavelica', 'Pasco', 'Madre de Dios', 'Amazonas', 'San Martín', 'Ucayali', 'Lambayeque', 'La Libertad', 'Junín', 'Loreto'];
const DISTRITOS_POR_CIUDAD = {
  Lima: ['Miraflores', 'San Isidro', 'Surco', 'La Molina', 'San Borja', 'Jesús María', 'Lince', 'Magdalena', 'Pueblo Libre', 'Breña', 'Lima Cercado', 'Rímac', 'San Juan de Lurigancho', 'San Martín de Porres', 'Comas', 'Los Olivos', 'Independencia', 'Villa El Salvador', 'Villa María del Triunfo', 'San Juan de Miraflores', 'Chorrillos', 'Barranco', 'Surquillo', 'Ate', 'Santa Anita', 'El Agustino', 'San Miguel', 'La Victoria', 'San Luis'],
  Callao: ['Callao', 'Bellavista', 'La Perla', 'La Punta', 'Ventanilla', 'Mi Perú', 'Carmen de la Legua'],
  Arequipa: ['Arequipa Cercado', 'Cayma', 'Yanahuara', 'Miraflores', 'Mariano Melgar', 'Paucarpata', 'José Luis Bustamante y Rivero', 'Sachaca', 'Socabaya', 'Cerro Colorado', 'Hunter', 'Tiabaya'],
  Cusco: ['Cusco', 'Wanchaq', 'San Sebastián', 'San Jerónimo', 'Santiago', 'Saylla'],
  Trujillo: ['Trujillo', 'Víctor Larco', 'Florencia de Mora', 'El Porvenir', 'La Esperanza', 'Huanchaco', 'Moche', 'Salaverry'],
  'La Libertad': ['Trujillo', 'Víctor Larco', 'Florencia de Mora', 'El Porvenir', 'La Esperanza', 'Huanchaco', 'Moche', 'Chepén', 'Pacasmayo'],
  Chiclayo: ['Chiclayo', 'La Victoria', 'José Leonardo Ortiz', 'Pimentel', 'Monsefú', 'Reque'],
  Lambayeque: ['Chiclayo', 'La Victoria', 'José Leonardo Ortiz', 'Pimentel', 'Lambayeque', 'Ferreñafe'],
  Piura: ['Piura', 'Castilla', 'Catacaos', 'Veintiséis de Octubre', 'Tambogrande', 'Sullana', 'Paita'],
  Iquitos: ['Iquitos', 'Belén', 'Punchana', 'San Juan Bautista'],
  Loreto: ['Iquitos', 'Belén', 'Punchana', 'San Juan Bautista', 'Yurimaguas', 'Nauta'],
  Huancayo: ['Huancayo', 'El Tambo', 'Chilca', 'Pilcomayo', 'Huancán'],
  Junín: ['Huancayo', 'El Tambo', 'Chilca', 'Tarma', 'La Oroya', 'Jauja'],
  Tacna: ['Tacna', 'Alto de la Alianza', 'Ciudad Nueva', 'Pocollay', 'Calana', 'Gregorio Albarracín'],
  Puno: ['Puno', 'Juliaca', 'Ilave', 'Azángaro', 'Huancané', 'Ayaviri'],
  Ayacucho: ['Ayacucho', 'San Juan Bautista', 'Carmen Alto', 'Jesús Nazareno', 'Huanta'],
  Cajamarca: ['Cajamarca', 'Baños del Inca', 'Llacanora', 'Jaén', 'Chota'],
  Ica: ['Ica', 'Parcona', 'La Tinguiña', 'Subtanjalla', 'Pisco', 'Chincha Alta', 'Nazca'],
  Chimbote: ['Chimbote', 'Nuevo Chimbote', 'Coishco', 'Santa', 'Huaraz', 'Independencia'],
  Huaraz: ['Huaraz', 'Independencia'],
  Huánuco: ['Huánuco', 'Amarilis', 'Pillco Marca', 'Tingo María'],
  Tarapoto: ['Tarapoto', 'Morales', 'Banda de Shilcayo', 'Moyobamba', 'Rioja'],
  'San Martín': ['Tarapoto', 'Morales', 'Banda de Shilcayo', 'Moyobamba', 'Rioja', 'Juanjuí'],
  Pucallpa: ['Callería', 'Yarinacocha', 'Manantay'],
  Ucayali: ['Callería', 'Yarinacocha', 'Manantay', 'Atalaya', 'Padre Abad'],
  Tumbes: ['Tumbes', 'Corrales', 'Zarumilla', 'Aguas Verdes'],
  Moquegua: ['Moquegua', 'Samegua', 'Ilo', 'Pacocha'],
  Abancay: ['Abancay', 'Tamburco', 'Andahuaylas'],
  Huancavelica: ['Huancavelica', 'Ascensión', 'Yauli'],
  Pasco: ['Cerro de Pasco', 'Yanacancha', 'Chaupimarca', 'Oxapampa'],
  'Madre de Dios': ['Puerto Maldonado', 'Tambopata', 'Las Piedras'],
  Amazonas: ['Chachapoyas', 'Bagua', 'Utcubamba', 'Jaén'],
};
const zonasDe = (ciudad) => DISTRITOS_POR_CIUDAD[ciudad] || [];
const LIMA = { lat: -12.0464, lng: -77.0428 };
const osmLink = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
const gmapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

/* ============ modal mapa: elegir ubicación exacta ============ */
function MapaModal({ inicial, direccionActual, onGuardar, onCerrar }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const mkRef = useRef(null);
  const timers = useRef({});
  const [pos, setPos] = useState(inicial && inicial.lat != null ? { lat: +inicial.lat, lng: +inicial.lng } : LIMA);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [direccion, setDireccion] = useState(direccionActual || '');
  const [partes, setPartes] = useState(null);
  const [cargandoDir, setCargandoDir] = useState(false);
  const [guardandoUbi, setGuardandoUbi] = useState(false);

  // Geocodificación inversa: coordenada -> dirección (vía nuestro servidor, con caché)
  const pedirDireccion = (ll) => {
    clearTimeout(timers.current.dir);
    timers.current.dir = setTimeout(async () => {
      setCargandoDir(true); setError('');
      try {
        const d = await api(`/api/geo/reverse?lat=${ll.lat}&lng=${ll.lng}`);
        setDireccion(d.direccion || '');
        setPartes(d || null);
      } catch (e) { setError(e.message); }
      finally { setCargandoDir(false); }
    }, 500);
  };

  const mover = (ll, zoom) => {
    const p = { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) };
    setPos(p);
    mkRef.current?.setLatLng(p);
    if (zoom) mapRef.current?.setView(p, zoom);
    pedirDireccion(p);
  };

  useEffect(() => {
    if (!window.L) return;
    const map = window.L.map(ref.current).setView([pos.lat, pos.lng], 15);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(map);
    const mk = window.L.marker([pos.lat, pos.lng], { draggable: true }).addTo(map);
    map.on('click', (e) => mover(e.latlng));
    mk.on('dragend', () => mover(mk.getLatLng()));
    mapRef.current = map; mkRef.current = mk;
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(t); clearTimeout(timers.current.dir); map.remove(); };
  }, []);

  const buscar = async (e) => {
    e?.preventDefault();
    const q = busqueda.trim();
    if (q.length < 3) return setError('Escribe al menos 3 caracteres: calle, distrito o lugar.');
    setBuscando(true); setError(''); setResultados([]);
    try {
      const d = await api(`/api/geo/buscar?q=${encodeURIComponent(q)}&limite=6`);
      if (!d.resultados || !d.resultados.length) setError('No se encontró esa dirección en Perú. Prueba con el distrito o toca el mapa.');
      else setResultados(d.resultados);
    } catch (err) { setError(err.message); }
    finally { setBuscando(false); }
  };

  const elegir = (res) => {
    setResultados([]); setError('');
    setDireccion(res.direccion || '');
    setPartes(res.direccion_partes || null);
    setPos({ lat: res.lat, lng: res.lng });
    mkRef.current?.setLatLng({ lat: res.lat, lng: res.lng });
    mapRef.current?.setView({ lat: res.lat, lng: res.lng }, 17);
  };

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return setError('Tu navegador no soporta geolocalización.');
    setCargandoDir(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => mover({ lat: p.coords.latitude, lng: p.coords.longitude }, 17),
      () => { setCargandoDir(false); setError('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const guardar = async () => {
    setGuardandoUbi(true);
    let dir = direccion;
    if (!dir) {
      try { dir = (await api(`/api/geo/reverse?lat=${pos.lat}&lng=${pos.lng}`)).direccion || ''; } catch { /* quedan las coordenadas */ }
    }
    onGuardar({ lat: pos.lat, lng: pos.lng, direccion: dir, partes });
    setGuardandoUbi(false);
  };

  if (!window.L) return (
    <div className="gp-modalback" onClick={onCerrar}><div className="gp-modal" onClick={(e) => e.stopPropagation()}>
      <h3>📍 Ubicación</h3><p>No se pudo cargar el mapa. Escribe las coordenadas manuales en el formulario.</p>
      <button className="gp-btn ghost" onClick={onCerrar}>Cerrar</button>
    </div></div>
  );

  return (
    <div className="gp-modalback" onClick={onCerrar}>
      <div className="gp-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>📍 Ubica tu cochera en el mapa</h3>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: -6 }}>
          Busca la dirección o toca el mapa. Guardamos las coordenadas exactas y la dirección.
        </p>

        <div className="gp-row" style={{ marginBottom: 8 }}>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
            placeholder="Ej. Av. Arequipa 123, Miraflores, Lima"
            style={{ flex: 1, padding: 9, border: '1px solid #cbd5e1', borderRadius: 8, minWidth: 150 }} />
          <button type="button" className="gp-btn" disabled={buscando} onClick={buscar}>{buscando ? 'Buscando…' : 'Buscar'}</button>
          <button type="button" className="gp-btn ghost" onClick={usarMiUbicacion}>📌 Mi ubicación</button>
        </div>

        {!!resultados.length && (
          <div className="gp-results">
            {resultados.map((res) => (
              <button type="button" key={res.lat + ',' + res.lng} className="gp-result" onClick={() => elegir(res)}>
                <b>{res.nombre}</b>
                <span>{res.direccion}</span>
              </button>
            ))}
          </div>
        )}
        {error && <div className="gp-alert">{error}</div>}

        <div ref={ref} className="gp-mapbox" />

        <div className="gp-dirbox">
          {cargandoDir ? 'Buscando la dirección del punto…'
            : direccion ? <><b>Dirección:</b> {direccion}</>
            : <span style={{ color: '#64748b' }}>Toca el mapa o arrastra el pin para fijar el punto.</span>}
        </div>
        <div className="gp-coords">
          📌 <b>{pos.lat}, {pos.lng}</b>
          {partes && (partes.distrito || partes.ciudad) ? ` · ${[...new Set([partes.distrito, partes.ciudad].filter(Boolean))].join(' · ')}` : ''}
          {' · '}puedes ajustar el pin antes de guardar
        </div>
        <div className="gp-row" style={{ marginTop: 10 }}>
          <button type="button" className="gp-btn" disabled={guardandoUbi} onClick={guardar}>{guardandoUbi ? 'Guardando…' : 'Usar esta ubicación'}</button>
          <button type="button" className="gp-btn ghost" onClick={onCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ============ términos y condiciones (lectura obligatoria disponible) ============ */
function TerminosModal({ onCerrar }) {
  return (
    <div className="gp-modalback" onClick={onCerrar}>
      <div className="gp-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="gp-row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>📄 Términos y Condiciones · ParkeoPe</h3>
          <button className="gp-btn ghost" onClick={onCerrar}>✕ Cerrar</button>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
          <p><b>1. El servicio.</b> ParkeoPe es una plataforma para administrar cocheras en el Perú: control de entradas y salidas, espacios, tarifas en soles (S/ PEN) y reportes. Opera en zona horaria America/Lima.</p>
          <p><b>2. Cuentas.</b> El dueño registra su cochera con datos verdaderos (nombre, correo, celular). Debe confirmar su correo con el código de 6 dígitos. Es responsable de sus operadores y de su contraseña.</p>
          <p><b>3. Datos personales (Ley N.º 29733).</b> Recabamos nombre, correo, celular y placas para operar el servicio. Al registrarte das tu consentimiento libre e informado. Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición (ARCO) escribiendo al administrador de la plataforma. No vendemos tus datos. Los correos de verificación y los registros de actividad se conservan por seguridad.</p>
          <p><b>4. Tarifas y cobros.</b> Cada dueño define sus precios por hora, día y mes. ParkeoPe calcula el monto según el tiempo de permanencia y la tolerancia configurada. Los comprobantes de pago los emite cada cochera según la ley peruana.</p>
          <p><b>5. Obligaciones del dueño.</b> Brindar el servicio ofrecido, cuidar los vehículos recibidos según el Código Civil, y no usar la plataforma para fines ilícitos.</p>
          <p><b>6. Disponibilidad.</b> Buscamos servicio continuo, pero pueden existir mantenimientos o fallas de terceros (internet, nube). No garantizamos operación ininterrumpida.</p>
          <p><b>7. Suspensión.</b> Podemos suspender cuentas con datos falsos, fraude o uso indebido, previo aviso cuando sea posible.</p>
          <p><b>8. Ley aplicable.</b> Estos términos se rigen por las leyes del Perú. Cualquier controversia se somete a los jueces de Lima.</p>
          <p style={{ color: '#64748b' }}>Última actualización: octubre 2026. Al marcar la casilla declaras haber leído y aceptado este documento.</p>
        </div>
        <button className="gp-btn" style={{ width: '100%', marginTop: 10 }} onClick={onCerrar}>Entendido</button>
      </div>
    </div>
  );
}

/* ============ login + registro + verificación ============ */
function Login({ onEntrar, avisar }) {
  const [modo, setModo] = useState('entrar'); // entrar | registro | verificar
  const [f, setF] = useState({ nombre: '', email: '', telefono: '', password: '', confirm: '', terminos: false });
  const [codigo, setCodigo] = useState('');
  const [devCode, setDevCode] = useState('');
  const [verTerminos, setVerTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email, password: f.password }) });
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      onEntrar(d.user);
    } catch (err) {
      if (/confirma tu correo/i.test(err.message)) { setModo('verificar'); }
      avisar(err.message, 'error');
    }
    finally { setCargando(false); }
  };

  const registrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const d = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(f) });
      setDevCode(d.dev_code || '');
      setCodigo('');
      setModo('verificar');
      avisar(d.mensaje || 'Revisa tu correo');
    } catch (err) { avisar(err.message, 'error'); }
    finally { setCargando(false); }
  };

  const verificar = async (e) => {
    e?.preventDefault?.();
    if (codigo.trim().length !== 6) return avisar('El código tiene 6 dígitos', 'error');
    setCargando(true);
    try {
      const d = await api('/api/auth/verificar', { method: 'POST', body: JSON.stringify({ email: f.email, codigo: codigo.trim() }) });
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      avisar('Correo verificado. ¡Bienvenido!');
      onEntrar(d.user);
    } catch (err) { avisar(err.message, 'error'); }
    finally { setCargando(false); }
  };
  // Envía solo al completar los 6 dígitos
  useEffect(() => { if (modo === 'verificar' && codigo.length === 6 && !cargando) verificar(); }, [codigo]);

  const reenviar = async () => {
    setCargando(true);
    try {
      const d = await api('/api/auth/reenviar', { method: 'POST', body: JSON.stringify({ email: f.email }) });
      setDevCode(d.dev_code || '');
      avisar(d.mensaje || 'Código reenviado');
    } catch (err) { avisar(err.message, 'error'); }
    finally { setCargando(false); }
  };

  if (modo === 'verificar') return (
    <div className="gp-login">
      <form onSubmit={verificar} className="gp-loginbox">
        <div style={{ fontSize: 26, fontWeight: 800 }}>✉️ Verifica tu correo</div>
        <p style={{ fontSize: 13, color: '#64748b' }}>Enviamos un código de 6 dígitos a <b>{f.email}</b>. Vence en 15 minutos.</p>
        {devCode && <div className="gp-toast ok">Modo demo — tu código: <b style={{ fontSize: 18, letterSpacing: 4 }}>{devCode}</b></div>}
        <label className="gp-field"><span>Código de 6 dígitos</span>
          <input inputMode="numeric" maxLength="6" placeholder="••••••" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }} /></label>
        <button className="gp-btn" style={{ width: '100%' }} disabled={cargando}>{cargando ? 'Verificando…' : 'Confirmar y entrar'}</button>
        <div className="gp-row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <button type="button" className="gp-link" onClick={reenviar}>Reenviar código</button>
          <button type="button" className="gp-link" onClick={() => setModo('entrar')}>Volver al login</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="gp-login">
      <form onSubmit={modo === 'registro' ? registrar : entrar} className="gp-loginbox">
        <div style={{ fontSize: 26, fontWeight: 800 }}>🅿️ ParkeoPe</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Cochera admin · S/ PEN · America/Lima</div>
        <div className="gp-tabs">
          <button type="button" className={modo === 'entrar' ? 'on' : ''} onClick={() => setModo('entrar')}>Entrar</button>
          <button type="button" className={modo === 'registro' ? 'on' : ''} onClick={() => setModo('registro')}>Crear cuenta</button>
        </div>
        {modo === 'registro' && (
          <>
            <label className="gp-field"><span>Nombre completo *</span><input placeholder="Juan Pérez Quispe" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label className="gp-field"><span>Correo electrónico *</span><input type="email" placeholder="correo@ejemplo.pe" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="gp-field"><span>Celular Perú * (te valida por correo)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f1f5f9', fontWeight: 700 }}>+51</span>
                <input inputMode="numeric" maxLength="9" placeholder="987654321" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
              </div></label>
            <label className="gp-field"><span>Contraseña * (mín 8, no solo números)</span><input type="password" placeholder="••••••••" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
            <label className="gp-field"><span>Repite la contraseña *</span><input type="password" placeholder="••••••••" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></label>
            <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={f.terminos} onChange={(e) => setF({ ...f, terminos: e.target.checked })} style={{ marginTop: 3 }} />
              <span>Acepto los <button type="button" className="gp-link" onClick={() => setVerTerminos(true)}>términos y condiciones</button> y el uso de mis datos (Ley N.º 29733) para operar mi cochera.</span></label>
          </>
        )}
        {modo === 'entrar' && (
          <>
            <label className="gp-field"><span>Email</span><input placeholder="correo@ejemplo.pe" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="gp-field"><span>Contraseña</span><input type="password" placeholder="••••••••" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
          </>
        )}
        <button className="gp-btn" style={{ width: '100%', marginTop: 10 }} disabled={cargando}>
          {cargando ? 'Verificando…' : modo === 'registro' ? 'Crear cuenta y enviar código' : 'Entrar'}</button>
        {verTerminos && <TerminosModal onCerrar={() => setVerTerminos(false)} />}
      </form>
    </div>
  );
}

/* ============ mapa de espacios ============ */
function MapaEspacios({ mapa, selEspacio, onOperar }) {
  if (!mapa) return <p style={{ color: '#64748b' }}>Cargando mapa…</p>;
  const pct = mapa.total ? Math.round((mapa.ocupados / mapa.total) * 100) : 0;
  return (
    <div>
      <div className="gp-row" style={{ justifyContent: 'space-between' }}>
        <div className="gp-legend">
          <span><i className="gp-dot" style={{ background: '#2fb344' }} />Libre ({mapa.libres})</span>
          <span><i className="gp-dot" style={{ background: '#206bc4' }} />Ocupado ({mapa.ocupados})</span>
        </div>
        <b>{pct}% ocupado</b>
      </div>
      <div className="gp-occ" style={{ marginTop: 8 }}><div style={{ width: pct + '%' }} /></div>
      <p style={{ fontSize: 12, color: '#64748b' }}>👆 Toca cualquier espacio para abrir su operación: registrar entrada si está libre, o cobrar salida si está ocupado.</p>
      <div className="gp-map">
        {mapa.espacios.map((e) => {
          const oc = e.estado === 'ocupado';
          return (
            <div key={e.id}
              className={`gp-sp ${oc ? 'ocupado' : 'libre'} ${selEspacio === e.id ? 'sel' : ''}`}
              onClick={() => onOperar(e)} title={oc ? `${e.codigo} · ${e.placa} · operar` : `${e.codigo} · operar`}>
              <div className="car">{oc ? '🚗' : '🅿️'}</div>
              <div className="cod">{e.codigo}</div>
              {oc ? <><div className="placa">{e.placa}</div><div className="hora">{fmtLima(e.hora_entrada)}</div></>
                : <div className="hora">tocar →</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ modal operación del espacio ============ */
function EspacioModal({ espacio, tipos, onCerrar, onEntrada, onSalida }) {
  const oc = espacio.estado === 'ocupado';
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState(tipos[0] || 'auto');
  const [prev, setPrev] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargarPrev = async () => {
    if (!oc || !espacio.ticket_id) return;
    try { setPrev(await api(`/api/tickets/preview/${espacio.ticket_id}`)); }
    catch { /* se muestra sin estimado */ }
  };
  useEffect(() => {
    cargarPrev();
    const t = setInterval(cargarPrev, 15000);
    return () => clearInterval(t);
  }, []);

  const entrar = async () => {
    if (!placa.trim()) return alert('Escribe la placa');
    setCargando(true);
    try { await onEntrada({ placa: placa.toUpperCase(), tipo_vehiculo: tipo, espacio_id: espacio.id }); }
    finally { setCargando(false); }
  };

  return (
    <div className="gp-modalback" onClick={onCerrar}>
      <div className="gp-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        {oc ? (
          <>
            <h3 style={{ marginTop: 0 }}>🚗 Espacio {espacio.codigo} <span className="gp-badge busy">ocupado</span></h3>
            <div className="gp-coords">
              Placa: <b>{espacio.placa}</b> · {espacio.tipo_vehiculo}<br />
              Entrada: {fmtLima(espacio.hora_entrada)} (Lima)<br />
              {prev ? <>Tiempo: <b>{prev.calculo.totalMin} min</b> · Tramo: <b>{prev.calculo.tramo}</b><br />{prev.calculo.detalle && <><small style={{ color: '#64748b' }}>{prev.calculo.detalle}</small><br /></>}
                A cobrar ahora: <b style={{ fontSize: 20 }}>{prev.calculo.monto_fmt}</b></>
                : 'Calculando…'}
            </div>
            <div className="gp-row">
              <button className="gp-btn green" disabled={cargando} onClick={() => onSalida()}>💰 Cobrar salida{prev ? ` (${prev.calculo.monto_fmt})` : ''}</button>
              <button className="gp-btn ghost" onClick={() => window.open(ticketUrl(espacio.ticket_id), '_blank')}>🎫 Ticket</button>
              <button className="gp-btn ghost" onClick={onCerrar}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>🅿️ Espacio {espacio.codigo} <span className="gp-badge ok">libre</span></h3>
            <label className="gp-field"><span>Placa * (ej. ABC-123)</span>
              <input autoFocus placeholder="ABC-123" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} /></label>
            <label className="gp-field"><span>Tipo de vehículo</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
            <div className="gp-row">
              <button className="gp-btn green" disabled={cargando} onClick={entrar}>{cargando ? 'Guardando…' : `✅ Entrada en ${espacio.codigo}`}</button>
              <button className="gp-btn ghost" onClick={onCerrar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ panel dueño / operador ============ */
function OwnerPanel({ user, avisar }) {
  const esDueno = user.rol === 'owner';
  const [vista, setVista] = useState('espacios'); // espacios|historial|tarifas|operadores|garajes
  const [garajes, setGarajes] = useState([]);
  const [sel, setSel] = useState(null);
  const [activos, setActivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [mapa, setMapa] = useState(null);
  const [operadores, setOperadores] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevoOp, setNuevoOp] = useState({ nombre: '', email: '', password: '' });
  const [opEspacio, setOpEspacio] = useState(null); // espacio con modal de operación abierto
  const timer = useRef(null);

  const cargarGarajes = async (elegirId) => {
    const g = await api('/api/garages');
    setGarajes(g);
    if (g.length) setSel(elegirId ? g.find((x) => x.id === elegirId) || g[0] : g.find((x) => x.id === sel?.id) || g[0]);
    else setSel(null);
    return g;
  };
  const cargarDetalle = async (id, silencioso) => {
    if (!id) return;
    try {
      const [a, h, rp, m] = await Promise.all([
        api(`/api/tickets/activos/${id}`),
        api(`/api/tickets/historial/${id}`),
        api(`/api/garages/${id}/reporte`),
        api(`/api/garages/${id}/espacios`),
      ]);
      setActivos(a); setHistorial(h); setReporte(rp); setMapa(m);
      const det = await api(`/api/garages/${id}`);
      setTarifas(det.tarifas || []);
      setSel((s) => (s && s.id === id ? { ...det, ocupados: det.ocupados, disponibles: det.disponibles } : s));
      if (esDueno) { try { setOperadores(await api(`/api/auth/operadores/${id}`)); } catch { /* opcional */ } }
    } catch (e) { if (!silencioso) avisar(e.message, 'error'); }
  };

  useEffect(() => { cargarGarajes().catch((e) => avisar(e.message, 'error')); }, []);
  useEffect(() => {
    if (sel) {
      cargarDetalle(sel.id);
      clearInterval(timer.current);
      timer.current = setInterval(() => cargarDetalle(sel.id, true), 8000); // refresco en vivo
    }
    return () => clearInterval(timer.current);
  }, [sel?.id]);

  const guardarGaraje = async (f) => {
    setGuardando(true);
    try {
      if (editando) {
        const g = await api(`/api/garages/${sel.id}`, { method: 'PUT', body: JSON.stringify(f) });
        avisar('Garaje actualizado'); setEditando(false); await cargarGarajes(g.id);
      } else {
        const g = await api('/api/garages', { method: 'POST', body: JSON.stringify(f) });
        avisar(`Garaje "${g.nombre}" creado con ${g.total_espacios} espacios`);
        setMostrarNuevo(false); await cargarGarajes(g.id);
      }
    } catch (e) { avisar(e.message, 'error'); }
    finally { setGuardando(false); }
  };

  const cobrar = async (ticketId, placa) => {
    let id = ticketId;
    if (!id && placa) {
      const t = activos.find((x) => x.placa === placa);
      id = t?.id;
    }
    if (!id) return;
    try {
      const d = await api('/api/tickets/out', { method: 'POST', body: JSON.stringify({ ticket_id: id }) });
      avisar(`Salida ${d.ticket.placa} (${d.ticket.espacio || ''}): ${soles(d.ticket.monto_total)} · espacio liberado ✅`);
      cargarGarajes(sel.id); cargarDetalle(sel.id);
    } catch (e) { avisar(e.message, 'error'); }
  };

  const eliminarGaraje = async (g) => {
    if (!confirm(`¿Eliminar "${g.nombre}"? Se borra su mapa, tarifas e historial. No se puede deshacer.`)) return;
    if (prompt('Para confirmar escribe ELIMINAR') !== 'ELIMINAR') return avisar('Eliminación cancelada', 'error');
    try {
      await api(`/api/garages/${g.id}`, { method: 'DELETE' });
      avisar(`Garaje "${g.nombre}" eliminado`);
      if (sel?.id === g.id) setSel(null);
      setEditando(false);
      cargarGarajes();
    } catch (e) { avisar(e.message, 'error'); }
  };

  const nav = [
    ['espacios', '🅿️ Espacios', mapa ? `${mapa.libres} libres` : null],
    ['mapa', '🗺️ Mapa', null],
    ['historial', '📜 Historial', null],
    ...(esDueno ? [['tarifas', '💰 Tarifas', null], ['operadores', '👷 Operadores', null], ['garajes', '⚙️ Garajes', null]] : []),
  ];

  return (
    <div className="gp-shell">
      <aside className="gp-side">
        <div className="gp-brand"><img src="/logo.png" alt="ParkeoPe" style={{ height: 34, verticalAlign: -10, marginRight: 8, borderRadius: 6 }} />ParkeoPe<small>Cochera admin · PEN</small></div>
        <nav className="gp-nav">
          {nav.map(([k, l, c]) => (
            <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}{c && <span className="cnt">{c}</span>}</button>
          ))}
        </nav>
        <div className="gp-sidefoot">Zona America/Lima · {new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
      </aside>
      <nav className="gp-mobilebar">
        {nav.map(([k, l]) => (
          <button key={k} className={vista === k ? 'on' : ''} onClick={() => { setVista(k); window.scrollTo(0, 0); }}>{l}</button>
        ))}
      </nav>
      <div className="gp-main">
        <div className="gp-top">
          <div>
            <h1>{sel ? sel.nombre : 'Sin garaje'}</h1>
            <div className="sub">{sel ? `${sel.disponibles} libres · ${sel.ocupados} dentro · ${nombreModo(sel.modo_cobro)}` : 'Crea tu primer garaje'}
              {sel?.lat != null && <> · <a href={osmLink(sel.lat, sel.lng)} target="_blank" rel="noreferrer">📍 ubicación</a></>}</div>
          </div>
          <select value={sel?.id || ''} onChange={(e) => { const g = garajes.find((x) => x.id === +e.target.value); if (g) setSel(g); }}>
            {garajes.map((g) => <option key={g.id} value={g.id}>{g.nombre} ({g.disponibles} libres)</option>)}
          </select>
          <div className="gp-user">
            <div className="gp-avatar">{user.nombre[0]?.toUpperCase()}</div>
            <div><b>{user.nombre}</b><div className="sub">{user.rol}</div></div>
            <button className="gp-link" onClick={() => { localStorage.clear(); location.reload(); }}>Salir</button>
          </div>
        </div>
        <div className="gp-body">
          {reporte && (
            <div className="gp-stats">
              <div className="gp-stat"><div className="ic" style={{ background: '#e7f1fd' }}>🚗</div><div><b>{reporte.activos}</b><span>dentro ahora</span></div></div>
              <div className="gp-stat"><div className="ic" style={{ background: '#ebfbee' }}>🟢</div><div><b>{sel?.disponibles ?? '—'}</b><span>espacios libres</span></div></div>
              <div className="gp-stat"><div className="ic" style={{ background: '#fff4e5' }}>🧾</div><div><b>{reporte.hoy_movimientos}</b><span>movimientos hoy</span></div></div>
              <div className="gp-stat"><div className="ic" style={{ background: '#f3e8ff' }}>💰</div><div><b>{soles(reporte.hoy_ingresos_pen)}</b><span>ingresos hoy</span></div></div>
            </div>
          )}

          {vista === 'espacios' && (
            <div className="gp-card">
              <h3>🅿️ Mapa de espacios {sel ? `— ${sel.nombre}` : ''}</h3>
              {!sel ? <p style={{ color: '#64748b' }}>Crea un garaje primero.</p> :
                <MapaEspacios mapa={mapa} selEspacio={null} onOperar={(e) => setOpEspacio(e)} />}
            </div>
          )}
          {opEspacio && (
            <EspacioModal espacio={mapa?.espacios.find((x) => x.id === opEspacio.id) || opEspacio}
              tipos={sel?.tipos_permitidos || ['auto']}
              onCerrar={() => setOpEspacio(null)}
              onEntrada={async ({ placa, tipo_vehiculo, espacio_id }) => {
                try {
                  const d = await api('/api/tickets/in', { method: 'POST', body: JSON.stringify({ garage_id: sel.id, placa, tipo_vehiculo, espacio_id }) });
                  avisar(`Entrada #${d.ticket.id} · ${d.ticket.placa} en ${d.espacio} · quedan ${d.disponibles}`);
                  setOpEspacio(null);
                  cargarGarajes(sel.id); cargarDetalle(sel.id);
                } catch (e) { avisar(e.message, 'error'); throw e; }
              }}
              onSalida={async () => {
                const t = activos.find((x) => x.id === opEspacio.ticket_id);
                if (!t) { avisar('Ese espacio ya se liberó', 'error'); setOpEspacio(null); return; }
                await cobrar(t.id);
                setOpEspacio(null);
              }} />
          )}

          {vista === 'mapa' && <MapaCocheras garajes={garajes} />}

          {vista === 'historial' && (
            <div className="gp-card">
              <h3>📜 Historial ({historial.length})</h3>
              <div className="gp-scroll">
                {historial.map((t) => (
                  <div key={t.id} className="gp-item">
                    <div><b>{t.placa}</b> · {t.tipo_vehiculo} · {t.espacio || ''} · ent. {fmtLima(t.hora_entrada)} · sal. {fmtLima(t.hora_salida)} <span className={`gp-badge ${t.estado === 'activo' ? 'busy' : 'ok'}`}>{t.estado}</span></div>
                    <div className="gp-row"><b>{soles(t.monto_total)}</b>
                      <button className="gp-btn ghost" style={{ padding: '4px 8px' }} onClick={() => window.open(ticketUrl(t.id), '_blank')}>🎫</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vista === 'tarifas' && esDueno && (
            <div className="gp-card">
              <h3>💰 Tarifas por tipo (S/)</h3>
              {!sel ? <p>Crea un garaje primero.</p> : <>
                {(sel.tipos_permitidos || []).map((tipo) => {
                  const ex = tarifas.find((t) => t.tipo_vehiculo === tipo) || { precio_hora: sel.precio_hora, precio_dia: sel.precio_dia, precio_mes: sel.precio_mes };
                  return (
                    <div key={tipo} className="gp-item">
                      <b style={{ minWidth: 90 }}>{tipo}</b>
                      <label style={{ fontSize: 12 }}>Hora <input type="number" min="0" step="0.5" style={{ width: 70, padding: 6, border: '1px solid #cbd5e1', borderRadius: 6 }} defaultValue={ex.precio_hora} id={`h-${tipo}`} /></label>
                      <label style={{ fontSize: 12 }}>Tramo <input type="number" min="0" step="0.5" style={{ width: 70, padding: 6, border: '1px solid #cbd5e1', borderRadius: 6 }} defaultValue={ex.precio_tramo ?? ''} placeholder="auto" id={`t-${tipo}`} /></label>
                      <label style={{ fontSize: 12 }}>Día <input type="number" min="0" step="1" style={{ width: 70, padding: 6, border: '1px solid #cbd5e1', borderRadius: 6 }} defaultValue={ex.precio_dia} id={`d-${tipo}`} /></label>
                      <label style={{ fontSize: 12 }}>Mes <input type="number" min="0" step="1" style={{ width: 80, padding: 6, border: '1px solid #cbd5e1', borderRadius: 6 }} defaultValue={ex.precio_mes || ''} id={`m-${tipo}`} /></label>
                    </div>
                  );
                })}
                <button className="gp-btn" style={{ marginTop: 10 }} onClick={async () => {
                  try {
                    const lista = (sel.tipos_permitidos || []).map((tipo) => {
                      const tv = document.getElementById(`t-${tipo}`).value;
                      return {
                        tipo_vehiculo: tipo,
                        precio_hora: +document.getElementById(`h-${tipo}`).value,
                        precio_tramo: tv === '' ? null : +tv,
                        precio_dia: +document.getElementById(`d-${tipo}`).value,
                        precio_mes: +document.getElementById(`m-${tipo}`).value || null,
                      };
                    });
                    await api(`/api/garages/${sel.id}/tarifas`, { method: 'PUT', body: JSON.stringify({ tarifas: lista }) });
                    avisar('Tarifas guardadas'); cargarDetalle(sel.id);
                  } catch (e) { avisar(e.message, 'error'); }
                }}>Guardar tarifas</button>
              </>}
            </div>
          )}

          {vista === 'operadores' && esDueno && (
            <div className="gp-grid2">
              <form className="gp-card" onSubmit={async (e) => {
                e.preventDefault();
                if (!sel) return avisar('Elige un garaje', 'error');
                try {
                  await api('/api/auth/operador', { method: 'POST', body: JSON.stringify({ ...nuevoOp, garage_id: sel.id }) });
                  setNuevoOp({ nombre: '', email: '', password: '' });
                  avisar('Operador creado'); cargarDetalle(sel.id);
                } catch (err) { avisar(err.message, 'error'); }
              }}>
                <h3>👷 Nuevo operador</h3>
                <label className="gp-field"><span>Nombre</span><input value={nuevoOp.nombre} onChange={(e) => setNuevoOp({ ...nuevoOp, nombre: e.target.value })} /></label>
                <label className="gp-field"><span>Email</span><input value={nuevoOp.email} onChange={(e) => setNuevoOp({ ...nuevoOp, email: e.target.value })} /></label>
                <label className="gp-field"><span>Contraseña</span><input type="password" value={nuevoOp.password} onChange={(e) => setNuevoOp({ ...nuevoOp, password: e.target.value })} /></label>
                <button className="gp-btn">Guardar operador</button>
              </form>
              <div className="gp-card">
                <h3>Operadores ({operadores.length})</h3>
                {operadores.map((o) => (
                  <div key={o.id} className="gp-item"><span><b>{o.nombre}</b> · {o.email}</span>
                    <button className="gp-link" style={{ color: '#d63939' }} onClick={async () => {
                      if (!confirm(`Eliminar a ${o.nombre}?`)) return;
                      try { await api(`/api/auth/operador/${o.id}`, { method: 'DELETE' }); avisar('Eliminado'); cargarDetalle(sel.id); }
                      catch (err) { avisar(err.message, 'error'); }
                    }}>Eliminar</button></div>
                ))}
              </div>
            </div>
          )}

          {vista === 'garajes' && esDueno && (
            <div className="gp-card">
              <div className="gp-row" style={{ justifyContent: 'space-between' }}>
                <h3>Mis garajes ({garajes.length})</h3>
                <button className="gp-btn" onClick={() => { setMostrarNuevo(!mostrarNuevo); setEditando(false); }}>{mostrarNuevo ? 'Cerrar' : '+ Nuevo garaje'}</button>
              </div>
              {mostrarNuevo && <GarajeForm guardando={guardando} onGuardar={guardarGaraje} onCancelar={() => setMostrarNuevo(false)} />}
              {garajes.map((g) => (
                <div key={g.id} className="gp-item">
                  <div><b>#{g.id} {g.nombre}</b> <span className="gp-badge info">{nombreModo(g.modo_cobro)}</span><br /><small style={{ color: '#64748b' }}>{g.direccion}{g.zona ? ` · ${g.zona}` : ''} · {g.ciudad} · {g.total_espacios} espacios · 🟢{g.disponibles} · S/ {g.precio_hora}/h</small></div>
                  <div className="gp-row">
                    <button className="gp-btn ghost" style={{ padding: '6px 12px' }} onClick={() => { setSel(g); setEditando(true); setMostrarNuevo(false); setVista('garajes'); window.scrollTo(0, 0); avisar('Editando ' + g.nombre + ': completa el formulario abajo'); }}>✏️</button>
                    <button className="gp-btn ghost" style={{ padding: '6px 12px', color: '#d63939', borderColor: '#ffc9c9' }} onClick={() => eliminarGaraje(g)}>🗑️</button>
                  </div>
                </div>
              ))}
              {editando && sel && (
                <div style={{ marginTop: 12 }}><h3>Editando: {sel.nombre}</h3>
                  <GarajeForm inicial={sel} guardando={guardando} onGuardar={guardarGaraje} onCancelar={() => setEditando(false)} /></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MODOS = [
  { id: 'hora', icono: '⏱️', nombre: 'Por hora o fracción', desc: 'Cada hora empezada se cobra completa. Ej.: 1 h y 20 min = 2 horas. Es lo más común.' },
  { id: 'tramos', icono: '✂️', nombre: 'Por tramos (30/15 min)', desc: 'Más justo para estadías cortas. Ej.: 1 h y media en tramos de 30 min = 3 tramos. Si es por media hora, elige tramo 30.' },
  { id: 'dia', icono: '📅', nombre: 'Solo por día', desc: 'No se cobra por horas. Ideal si tu cochera es por días: el auto paga 1 día aunque esté 2 horas. Elige día corrido (24 h) o calendario con corte.' },
  { id: 'mixto', icono: '🔀', nombre: 'Mixto hora → día', desc: 'Cobra por hora hasta un tope que tú defines (ej. 6 h); si el auto pasa ese tope, se cobra 1 día completo. Protege tus días largos.' },
];
const nombreModo = (m) => ({ hora: 'Por hora', tramos: 'Por tramos', dia: 'Por día', mixto: 'Mixto' }[m] || m);

function GarajeForm({ inicial, onGuardar, onCancelar, guardando }) {
  const [f, setF] = useState(inicial || { nombre: '', direccion: '', ciudad: 'Lima', zona: '', total_espacios: 20, tipos_permitidos: ['auto', 'moto'], exclusivo_camiones: false, precio_hora: 5, precio_dia: 30, precio_mes: 200, tolerancia_min: 10, lat: null, lng: null, modo_cobro: 'hora', tramo_min: 30, tope_dia_horas: 6, minimo_ticket: 0, dia_tipo: 'corrido', dia_corte: '00:00', con_noche: false, noche_desde: '22:00', noche_hasta: '06:00', precio_noche: '', recargo_finde_pct: 0 });
  const [paso, setPaso] = useState(1);
  const [verMapa, setVerMapa] = useState(false);
  const tieneUbi = f.lat != null && f.lng != null && f.lat !== '' && f.lng !== '';
  const preparar = () => {
    const g = { ...f };
    if (!g.con_noche || g.precio_noche === '' || g.precio_noche == null) { g.precio_noche = null; g.noche_desde = null; g.noche_hasta = null; }
    else g.precio_noche = +g.precio_noche;
    delete g.con_noche;
    return g;
  };
  const pasos = ['1. Datos', '2. ¿Cómo cobras?', '3. Extras', '4. Resumen'];
  return (
    <form style={{ border: '1px solid #e2e8f0', padding: 14, borderRadius: 10, background: '#f8fafc', marginTop: 10 }}
      onSubmit={(e) => { e.preventDefault(); onGuardar(preparar()); }}>
      <div className="gp-row" style={{ marginBottom: 12 }}>
        {pasos.map((p, i) => (
          <span key={p} className="gp-badge" style={{ background: paso === i + 1 ? '#206bc4' : '#e2e8f0', color: paso === i + 1 ? '#fff' : '#475569', padding: '6px 12px' }}>{p}</span>
        ))}
      </div>

      {paso === 1 && (
        <div className="gp-grid2">
          <label className="gp-field"><span>Nombre cochera *</span><input placeholder="Cochera Central" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          <label className="gp-field"><span>Dirección (se llena sola desde el mapa 📍)</span><input placeholder="Av. Arequipa 123, Lima" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></label>
          <div className="gp-field"><span>Ubicación exacta (mapa)</span>
            <button type="button" className="gp-btn ghost" style={{ width: '100%' }} onClick={() => setVerMapa(true)}>📍 {tieneUbi ? 'Cambiar ubicación en mapa' : 'Elegir ubicación en mapa'}</button>
            {tieneUbi
              ? <div className="gp-ubi">📌 {f.lat}, {f.lng} <a href={osmLink(f.lat, f.lng)} target="_blank" rel="noreferrer">ver</a>
                  <button type="button" className="gp-link" style={{ color: '#d63939' }} onClick={() => setF({ ...f, lat: null, lng: null })}>quitar</button></div>
              : <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Sin ubicación marcada (opcional pero recomendado).</div>}
          </div>
          <label className="gp-field"><span>Ciudad *</span>
            <select value={CIUDADES.includes(f.ciudad) ? f.ciudad : (f.ciudad || '')} onChange={(e) => setF({ ...f, ciudad: e.target.value, zona: '' })}>
              <option value="" disabled>Selecciona ciudad…</option>
              {!CIUDADES.includes(f.ciudad) && f.ciudad ? <option value={f.ciudad}>{f.ciudad} (actual)</option> : null}
              {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <small style={{ color: '#64748b' }}>Al cambiar de ciudad se reinicia la zona y verás sus distritos.</small></label>
          <label className="gp-field"><span>Zona / distrito {f.ciudad ? `de ${f.ciudad}` : ''}</span>
            <input list="zonas-sugeridas" placeholder={zonasDe(f.ciudad).length ? `Ej. ${zonasDe(f.ciudad)[0]}` : 'Ej. Centro'} value={f.zona || ''} onChange={(e) => setF({ ...f, zona: e.target.value })} />
            <datalist id="zonas-sugeridas">{zonasDe(f.ciudad).map((z) => <option key={z} value={z} />)}</datalist>
            <small style={{ color: '#64748b' }}>{zonasDe(f.ciudad).length ? `Distritos de ${f.ciudad}: toca para elegir o escribe otra zona.` : 'Escribe la zona o barrio de tu cochera.'}</small></label>
          <label className="gp-field"><span>Espacios (1-5000) * — se dibujan en el mapa</span><input type="number" min="1" max="5000" value={f.total_espacios} onChange={(e) => setF({ ...f, total_espacios: +e.target.value })} />
            <small style={{ color: '#64748b' }}>Cuántos autos entran a la vez. Cada uno aparece en el mapa como E-01, E-02…</small></label>
          <div className="gp-field"><span>¿Qué vehículos guardas? *</span>
            <div className="gp-row">
              {TIPOS.map((t) => (
                <label key={t} className="gp-badge" style={{ border: '1px solid #cbd5e1', cursor: 'pointer', padding: '6px 12px', background: f.tipos_permitidos.includes(t) ? '#d0ebff' : '#fff' }}>
                  <input type="checkbox" checked={f.tipos_permitidos.includes(t)} onChange={() => setF({ ...f, tipos_permitidos: f.tipos_permitidos.includes(t) ? f.tipos_permitidos.filter((x) => x !== t) : [...f.tipos_permitidos, t] })} /> {t}
                </label>
              ))}
            </div>
            <label style={{ fontSize: 13, marginTop: 6, display: 'block' }}><input type="checkbox" checked={f.exclusivo_camiones} onChange={(e) => setF({ ...f, exclusivo_camiones: e.target.checked })} /> Exclusivo para camiones</label>
          </div>
        </div>
      )}

      {paso === 2 && (<>
        <p style={{ fontSize: 14, fontWeight: 700 }}>¿Cómo cobras en tu cochera?</p>
        <div className="gp-grid2">
          {MODOS.map((m) => (
            <div key={m.id} onClick={() => setF({ ...f, modo_cobro: m.id })}
              style={{ border: f.modo_cobro === m.id ? '2px solid #206bc4' : '1px solid #cbd5e1', borderRadius: 10, padding: 12, cursor: 'pointer', background: f.modo_cobro === m.id ? '#e7f1fd' : '#fff' }}>
              <div style={{ fontSize: 22 }}>{m.icono}</div>
              <b>{m.nombre}</b>
              <div style={{ fontSize: 12, color: '#64748b' }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <div className="gp-grid2" style={{ marginTop: 10 }}>
          {(f.modo_cobro === 'hora' || f.modo_cobro === 'mixto') && (
            <label className="gp-field"><span>S/ por hora *</span><input type="number" min="0" step="0.5" value={f.precio_hora} onChange={(e) => setF({ ...f, precio_hora: +e.target.value })} /></label>)}
          {f.modo_cobro === 'tramos' && (<>
            <label className="gp-field"><span>Tamaño del tramo</span>
              <select value={f.tramo_min} onChange={(e) => setF({ ...f, tramo_min: +e.target.value })}>
                <option value={15}>15 minutos (cuartos de hora)</option><option value={30}>30 minutos (media hora)</option><option value={60}>60 minutos</option>
              </select>
              <small style={{ color: '#64748b' }}>Si pasas la media hora se cobra el tramo extra. Ej.: 40 min en tramos de 30 = 2 tramos.</small></label>
            <label className="gp-field"><span>S/ por tramo de {f.tramo_min} min *</span><input type="number" min="0" step="0.5" value={f.precio_hora ? +(f.precio_hora * (f.tramo_min / 60)).toFixed(2) : ''} onChange={(e) => setF({ ...f, precio_hora: +((+e.target.value) / (f.tramo_min / 60)).toFixed(2) })} />
              <small style={{ color: '#64748b' }}>Si tu hora vale S/ 6, la media hora sale S/ 3. Escríbelo directo.</small></label>
          </>)}
          {f.modo_cobro === 'dia' && (<>
            <label className="gp-field"><span>Tipo de día</span>
              <select value={f.dia_tipo} onChange={(e) => setF({ ...f, dia_tipo: e.target.value })}>
                <option value="corrido">Día corrido (24 h desde la entrada)</option>
                <option value="calendario">Día calendario (con hora de corte)</option>
              </select>
              <small style={{ color: '#64748b' }}>{f.dia_tipo === 'corrido' ? 'Entra lunes 10 am y sale martes 9 am = 1 día. Si sale martes 11 am = 2 días.' : 'Se cuenta por fecha: entra y sale el mismo día = 1 día, aunque sean 2 horas.'}</small></label>
            {f.dia_tipo === 'calendario' && (
              <label className="gp-field"><span>Hora de corte</span><input type="time" value={f.dia_corte} onChange={(e) => setF({ ...f, dia_corte: e.target.value })} />
                <small style={{ color: '#64748b' }}>El "día" cambia a esta hora. Ej. corte 12:00 (mediodía): entra 11 am y sale 1 pm = 2 días.</small></label>)}
          </>)}
          {(f.modo_cobro === 'mixto' || f.modo_cobro === 'tramos') && (
            <label className="gp-field"><span>Desde cuántas horas se vuelve día (tope, 0 = nunca)</span><input type="number" min="0" max="24" value={f.tope_dia_horas} onChange={(e) => setF({ ...f, tope_dia_horas: +e.target.value })} />
              <small style={{ color: '#64748b' }}>Ej. tope 6: un auto de 7 horas paga 1 día en vez de 7 horas. Con 0 nunca se convierte.</small></label>)}
          {f.modo_cobro !== 'dia' && (
            <label className="gp-field"><span>S/ por día (para topes) *</span><input type="number" min="0" step="1" value={f.precio_dia} onChange={(e) => setF({ ...f, precio_dia: +e.target.value })} /></label>)}
          {f.modo_cobro === 'dia' && (
            <label className="gp-field"><span>S/ por día *</span><input type="number" min="0" step="1" value={f.precio_dia} onChange={(e) => setF({ ...f, precio_dia: +e.target.value })} /></label>)}
          <label className="gp-field"><span>S/ por mes (abono)</span><input type="number" min="0" step="1" value={f.precio_mes} onChange={(e) => setF({ ...f, precio_mes: +e.target.value })} />
            <small style={{ color: '#64748b' }}>Para clientes fijos que pagan el mes por adelantado. Referencial para abonos.</small></label>
        </div>
      </>)}

      {paso === 3 && (
        <div className="gp-grid2">
          <label className="gp-field"><span>Cortesía: minutos gratis al inicio</span><input type="number" min="0" max="60" value={f.tolerancia_min} onChange={(e) => setF({ ...f, tolerancia_min: +e.target.value })} />
            <small style={{ color: '#64748b' }}>Si el auto sale antes de estos minutos, no paga nada. Ej. 10: entró y salió en 8 min = S/ 0.</small></label>
          <label className="gp-field"><span>Monto mínimo por ticket S/ (0 = sin mínimo)</span><input type="number" min="0" step="0.5" value={f.minimo_ticket} onChange={(e) => setF({ ...f, minimo_ticket: +e.target.value })} />
            <small style={{ color: '#64748b' }}>El cobro nunca baja de este monto. Ej. mínimo S/ 5: un auto de 10 min que saldría S/ 2 paga S/ 5. No aplica si está en cortesía (sale gratis).</small></label>
          <label className="gp-field"><span>Recargo fin de semana % (0 = igual)</span><input type="number" min="0" max="100" value={f.recargo_finde_pct} onChange={(e) => setF({ ...f, recargo_finde_pct: +e.target.value })} />
            <small style={{ color: '#64748b' }}>Si la salida cae sábado o domingo se suma este %. Ej. 20%: un ticket de S/ 10 sale S/ 12.</small></label>
          <div className="gp-field"><span>Tarifa nocturna plana</span>
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!f.con_noche} onChange={(e) => setF({ ...f, con_noche: e.target.checked })} /> Cobrar plano de noche</label>
            <small style={{ color: '#64748b' }}>Si el auto entra Y sale dentro del horario nocturno, paga este monto fijo en vez de horas. Ej. 10 pm–6 am = S/ 15 la noche.</small>
            {f.con_noche && <div className="gp-row" style={{ marginTop: 6 }}>
              <input type="time" value={f.noche_desde} onChange={(e) => setF({ ...f, noche_desde: e.target.value })} />
              <input type="time" value={f.noche_hasta} onChange={(e) => setF({ ...f, noche_hasta: e.target.value })} />
              <input type="number" min="0" step="1" placeholder="S/" value={f.precio_noche} onChange={(e) => setF({ ...f, precio_noche: e.target.value })} style={{ width: 90, padding: 8, border: '1px solid #cbd5e1', borderRadius: 8 }} />
            </div>}
          </div>
        </div>
      )}

      {paso === 4 && (
        <div className="gp-card">
          <h3 style={{ marginTop: 0 }}>📋 Así cobrará "{f.nombre || 'tu cochera'}"</h3>
          <ul style={{ fontSize: 14, lineHeight: 1.9 }}>
            <li>🧾 Modo: <b>{nombreModo(f.modo_cobro)}</b>
              {f.modo_cobro === 'tramos' && ` (tramos de ${f.tramo_min} min)`}
              {f.modo_cobro === 'dia' && (f.dia_tipo === 'calendario' ? ` (calendario, corte ${f.dia_corte})` : ' (24 h corridas)')}
              {f.modo_cobro === 'mixto' && ` (tope ${f.tope_dia_horas} h → día)`}</li>
            <li>💰 Precios: hora S/ {f.precio_hora} · día S/ {f.precio_dia} · mes S/ {f.precio_mes}</li>
            <li>🎁 Cortesía {f.tolerancia_min} min · mínimo S/ {f.minimo_ticket || 0}{f.recargo_finde_pct ? ` · finde +${f.recargo_finde_pct}%` : ''}</li>
            {f.con_noche && f.precio_noche !== '' && <li>🌙 Noche {f.noche_desde}–{f.noche_hasta}: S/ {f.precio_noche} plano</li>}
            <li>🅿️ {f.total_espacios} espacios · {f.ciudad}{f.zona ? ` · ${f.zona}` : ''} · {(f.tipos_permitidos || []).join(', ')}</li>
          </ul>
          <p style={{ fontSize: 12, color: '#64748b' }}>Ej.: un auto 1 h y media {f.modo_cobro === 'tramos' ? `= ${Math.ceil(90 / f.tramo_min)} tramos` : f.modo_cobro === 'dia' ? '= 1 día' : `= ${Math.ceil(90 / 60)} hora(s)`}.</p>
        </div>
      )}

      <div className="gp-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <div className="gp-row">
          {paso > 1 && <button type="button" className="gp-btn ghost" onClick={() => setPaso(paso - 1)}>← Atrás</button>}
          {onCancelar && <button type="button" className="gp-btn ghost" onClick={onCancelar}>Cancelar</button>}
        </div>
        {paso < 4
          ? <button type="button" className="gp-btn" onClick={() => setPaso(paso + 1)}>Siguiente →</button>
          : <button className="gp-btn green" disabled={guardando}>{guardando ? 'Guardando…' : '✅ Guardar garaje'}</button>}
      </div>
      {verMapa && <MapaModal inicial={{ lat: f.lat, lng: f.lng }} direccionActual={f.direccion}
        onCerrar={() => setVerMapa(false)}
        onGuardar={({ lat, lng, direccion }) => {
          setF((prev) => ({ ...prev, lat, lng, direccion: direccion || prev.direccion }));
          setVerMapa(false);
        }} />}
    </form>
  );
}

/* ============ app ============ */
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } });
  const [toast, setToast] = useState(null);
  const avisar = (texto, tipo = 'ok') => setToast({ texto, tipo });
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => {
    const salir = () => { setUser(null); setToast({ texto: 'Sesión vencida. Vuelve a entrar.', tipo: 'error' }); };
    window.addEventListener('auth-expired', salir);
    return () => window.removeEventListener('auth-expired', salir);
  }, []);

  if (!user) return (<><div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>{toast && <div className={`gp-toast ${toast.tipo}`}>{toast.texto}</div>}</div><Login onEntrar={setUser} avisar={avisar} /></>);

  return (
    <>
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 50, maxWidth: 360 }}>{toast && <div className={`gp-toast ${toast.tipo}`}>{toast.texto}</div>}</div>
      {user.rol === 'superadmin'
        ? <div className="gp-login"><div className="gp-loginbox" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>🔐 Zona administrador</div>
            <p style={{ fontSize: 14, color: '#64748b' }}>El panel admin vive en su propio enlace:</p>
            <p><a href="http://localhost:5174" style={{ fontWeight: 800, fontSize: 18 }}>http://localhost:5174</a></p>
            <button className="gp-btn ghost" onClick={() => { localStorage.clear(); setUser(null); }}>Salir</button>
          </div></div>
        : <OwnerPanel user={user} avisar={avisar} />}
    </>
  );
}
