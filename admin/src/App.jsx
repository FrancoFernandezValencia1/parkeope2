import { useEffect, useState } from 'react';
import { api, fmtLima, soles } from './lib/api.js';

const MESES = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', 10: 'Oct', 11: 'Nov', 12: 'Dic' };
const nomMes = (ym) => { const [y, m] = ym.split('-'); return `${MESES[m] || m} ${y.slice(2)}`; };

/* Gráfico de barras SVG: ingresos por mes */
function Barras({ serie }) {
  if (!serie?.length) return <p style={{ color: '#64748b' }}>Sin datos aún.</p>;
  const max = Math.max(...serie.map((s) => s.ingresos), 1);
  const W = 640, H = 220, pad = 34, bw = (W - pad * 2) / serie.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W - 10} y1={H - pad - (H - pad * 2) * f} y2={H - pad - (H - pad * 2) * f} stroke="#e2e8f0" />
          <text x={4} y={H - pad - (H - pad * 2) * f + 4} fontSize="10" fill="#94a3b8">{Math.round(max * f)}</text>
        </g>
      ))}
      {serie.map((s, i) => {
        const h = Math.max(3, ((H - pad * 2) * s.ingresos) / max);
        const x = pad + i * bw + bw * 0.18;
        return (
          <g key={s.mes}>
            <rect x={x} y={H - pad - h} width={bw * 0.64} height={h} rx="4" fill={s.ingresos > 0 ? '#206bc4' : '#e2e8f0'}>
              <title>{nomMes(s.mes)}: S/ {s.ingresos} ({s.tickets} tickets)</title>
            </rect>
            <text x={x + bw * 0.32} y={H - pad - h - 5} fontSize="10" textAnchor="middle" fill="#334155" fontWeight="700">
              {s.ingresos > 0 ? s.ingresos : ''}
            </text>
            <text x={x + bw * 0.32} y={H - 14} fontSize="10" textAnchor="middle" fill="#64748b">{nomMes(s.mes)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* Captura errores de render en vez de página en blanco */
import React from 'react';
function Limite({ children }) {
  const [err, setErr] = useState(null);
  if (err) return <div className="gp-toast error">No se pudo mostrar esta ficha: {String(err.message || err)}</div>;
  return <Atrapa onErr={setErr}>{children}</Atrapa>;
}
class Atrapa extends React.Component {
  componentDidCatch(e) { this.props.onErr(e); }
  render() { return this.props.children; }
}

/* Filtros ciudad / zona (interactivos) */
function FiltrosUbi({ ubic, fCiudad, setFCiudad, fZona, setFZona }) {
  return (<>
    <select value={fCiudad} onChange={(e) => { setFCiudad(e.target.value); setFZona(''); }} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <option value="">Todas las ciudades</option>
      {ubic.ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
    <select value={fZona} onChange={(e) => setFZona(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <option value="">Todas las zonas</option>
      {(fCiudad ? (ubic.zonas[fCiudad] || []) : [...new Set(Object.values(ubic.zonas).flat())]).map((z) => <option key={z} value={z}>{z}</option>)}
    </select>
  </>);
}

function Login({ onEntrar, avisar }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [cargando, setCargando] = useState(false);
  return (
    <div className="gp-login" style={{ background: 'linear-gradient(135deg,#0f172a,#7c2d12)' }}>
      <form className="gp-loginbox" onSubmit={async (e) => {
        e.preventDefault(); setCargando(true);
        try {
          const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(f) });
          if (d.user.rol !== 'superadmin') { avisar('Esta zona es solo para el administrador.', 'error'); localStorage.clear(); return; }
          localStorage.setItem('token', d.token);
          localStorage.setItem('admin', JSON.stringify(d.user));
          onEntrar(d.user);
        } catch (err) { avisar(err.message, 'error'); }
        finally { setCargando(false); }
      }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>🔐 Admin · ParkeoPe</div>
        <p style={{ fontSize: 12, color: '#64748b' }}>Acceso restringido a la plataforma. Demo: admin@garajes.pe / Admin123!</p>
        <label className="gp-field"><span>Email admin</span><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="gp-field"><span>Contraseña</span><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <button className="gp-btn" style={{ width: '100%' }} disabled={cargando}>{cargando ? 'Verificando…' : 'Entrar al admin'}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('admin') || 'null'); } catch { return null; } });
  const [toast, setToast] = useState(null);
  const avisar = (texto, tipo = 'ok') => setToast({ texto, tipo });
  const [vista, setVista] = useState('resumen');
  const [stats, setStats] = useState(null);
  const [ing, setIng] = useState(null);
  const [users, setUsers] = useState([]);
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroUser, setFiltroUser] = useState('');
  const [acts, setActs] = useState([]);
  const [garajes, setGarajes] = useState([]);
  const [filtroGaraje, setFiltroGaraje] = useState('');
  const [ubic, setUbic] = useState({ ciudades: [], zonas: {} });
  const [fCiudad, setFCiudad] = useState('');
  const [fZona, setFZona] = useState('');
  const [ficha, setFicha] = useState(null); // detalle de un usuario
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', telefono: '', password: '', rol: 'owner', garage_id: '' });

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => {
    const salir = () => { setUser(null); setToast({ texto: 'Sesión vencida.', tipo: 'error' }); };
    window.addEventListener('auth-expired', salir);
    return () => window.removeEventListener('auth-expired', salir);
  }, []);

  const cargarTodo = async () => {
    try {
      const [s, u, g, ub] = await Promise.all([api('/api/admin/stats'), api('/api/admin/users'), api('/api/admin/garages'), api('/api/admin/ubicaciones')]);
      setStats(s); setUsers(u); setGarajes(g); setUbic(ub);
    } catch (e) { avisar(e.message, 'error'); }
  };
  const cargarIngresos = async (gid = filtroGaraje, ciu = fCiudad, zon = fZona) => {
    try {
      let q = `/api/admin/ingresos?meses=12`;
      if (gid) q += `&garage_id=${gid}`;
      if (ciu) q += `&ciudad=${encodeURIComponent(ciu)}`;
      if (zon) q += `&zona=${encodeURIComponent(zon)}`;
      setIng(await api(q));
    }
    catch (e) { avisar(e.message, 'error'); }
  };
  const cargarActs = async (uid = filtroUser) => {
    try { setActs(await api(`/api/admin/actividad?limit=150${uid ? `&user_id=${uid}` : ''}`)); }
    catch (e) { avisar(e.message, 'error'); }
  };

  useEffect(() => { if (user) { cargarTodo(); cargarIngresos('', '', ''); cargarActs(''); } }, [user]);
  useEffect(() => { if (user && vista === 'ingresos') cargarIngresos(); }, [filtroGaraje, fCiudad, fZona]);
  useEffect(() => { if (user && vista === 'actividad') cargarActs(); }, [filtroUser]);

  if (!user) return (<>
    <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>{toast && <div className={`gp-toast ${toast.tipo}`}>{toast.texto}</div>}</div>
    <Login onEntrar={setUser} avisar={avisar} />
  </>);

  const verFicha = async (id) => {
    try { setFicha(await api(`/api/admin/users/${id}/resumen`)); }
    catch (e) { avisar(e.message, 'error'); }
  };

  const nav = [['resumen', '📊 Resumen'], ['ingresos', '📈 Ingresos'], ['usuarios', '👥 Usuarios'], ['actividad', '🧾 Actividad'], ['garajes', '🏢 Garajes']];
  const enUbi = (u) => {
    if (!fCiudad && !fZona) return true;
    const gs = u.garajes || [];
    if (!gs.length) return false;
    return gs.some((g) => (!fCiudad || g.ciudad === fCiudad) && (!fZona || g.zona === fZona));
  };
  const usuariosF = users.filter((u) => (!filtroRol || u.rol === filtroRol) && enUbi(u));
  const garajesF = garajes.filter((g) => (!fCiudad || g.ciudad === fCiudad) && (!fZona || g.zona === fZona));

  return (
    <div className="gp-shell">
      <aside className="gp-side">
        <div className="gp-brand"><img src="/logo.png" alt="ParkeoPe" style={{ height: 34, verticalAlign: -10, marginRight: 8, borderRadius: 6 }} />Admin<small>ParkeoPe · plataforma</small></div>
        <nav className="gp-nav">
          {nav.map(([k, l]) => <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>)}
        </nav>
        <div className="gp-sidefoot">{user.nombre}</div>
      </aside>
      <nav className="gp-mobilebar">
        {nav.map(([k, l]) => (
          <button key={k} className={vista === k ? 'on' : ''} onClick={() => { setVista(k); window.scrollTo(0, 0); }}>{l}</button>
        ))}
      </nav>
      <div className="gp-main">
        <div className="gp-top"><h1>{(nav.find(([k]) => k === vista) || ['', '👤 Ficha de usuario'])[1]}</h1>
          <div className="gp-user"><div className="gp-avatar">{user.nombre[0]}</div>
            <button className="gp-link" onClick={() => { localStorage.clear(); setUser(null); }}>Salir</button></div></div>
        <div className="gp-body">
          {toast && <div className={`gp-toast ${toast.tipo}`}>{toast.texto}</div>}

          {vista === 'resumen' && <>
            {stats && <div className="gp-stats">
              {[['👥', stats.owners, 'dueños'], ['👷', stats.operadores, 'operadores'], ['🏢', stats.garajes, 'garajes'], ['🚗', stats.vehiculos_dentro, 'dentro ahora'], ['💰', `S/ ${stats.ingresos_pen}`, 'ingresos totales']].map(([i, v, l], ix) => (
                <div key={ix} className="gp-stat"><div className="ic" style={{ background: '#e7f1fd' }}>{i}</div><div><b>{v}</b><span>{l}</span></div></div>
              ))}
            </div>}
            <div className="gp-card">
              <h3>📈 Ingresos últimos 12 meses (S/)</h3>
              <Barras serie={ing?.serie} />
              <p style={{ fontSize: 13, color: '#64748b' }}>Total período: <b>{soles(ing?.total || 0)}</b> · {ing?.serie[ing.serie.length - 1] && <>último mes: <b>{soles(ing.serie[ing.serie.length - 1].ingresos)}</b> ({ing.serie[ing.serie.length - 1].crec_pct >= 0 ? '+' : ''}{ing.serie[ing.serie.length - 1].crec_pct}% vs anterior)</>}</p>
            </div>
            <div className="gp-card"><h3>🧾 Actividad reciente</h3>
              {acts.slice(0, 10).map((a) => (
                <div key={a.id} className="gp-item"><div><b>{a.usuario || '—'}</b> <span className="gp-badge info">{a.accion}</span><br /><small style={{ color: '#64748b' }}>{a.detalle} · {fmtLima(a.created_at)}</small></div></div>
              ))}
            </div>
          </>}

          {vista === 'ingresos' && <div className="gp-card">
            <div className="gp-row" style={{ justifyContent: 'space-between' }}>
              <h3>📈 Ganancias por mes{fCiudad ? ` · ${fCiudad}` : ''}{fZona ? ` · ${fZona}` : ''}</h3>
              <div className="gp-row">
                <FiltrosUbi ubic={ubic} fCiudad={fCiudad} setFCiudad={setFCiudad} fZona={fZona} setFZona={setFZona} />
                <select value={filtroGaraje} onChange={(e) => setFiltroGaraje(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                  <option value="">Todos los garajes</option>
                  {garajesF.map((g) => <option key={g.id} value={g.id}>#{g.id} {g.nombre}</option>)}
                </select>
              </div>
            </div>
            <Barras serie={ing?.serie} />
            <p>Total período: <b>{soles(ing?.total || 0)}</b></p>
            {[...(ing?.serie || [])].reverse().map((s) => (
              <div key={s.mes} className="gp-item">
                <div><b>{nomMes(s.mes)}</b> · {s.tickets} tickets</div>
                <div className="gp-row"><b>{soles(s.ingresos)}</b>
                  <span className={`gp-badge ${s.crec_pct >= 0 ? 'ok' : 'out'}`}>{s.crec_pct >= 0 ? '▲' : '▼'} {s.crec_pct}%</span></div>
              </div>
            ))}
          </div>}

          {vista === 'usuarios' && <>
            <div className="gp-grid2">
              <form className="gp-card" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ ...nuevo, garage_id: nuevo.garage_id || null }) });
                  setNuevo({ nombre: '', email: '', telefono: '', password: '', rol: 'owner', garage_id: '' });
                  avisar('Usuario creado'); cargarTodo();
                } catch (err) { avisar(err.message, 'error'); }
              }}>
                <h3>➕ Crear usuario</h3>
                <label className="gp-field"><span>Nombre *</span><input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></label>
                <label className="gp-field"><span>Email *</span><input value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></label>
                <label className="gp-field"><span>Celular (+51)</span><input maxLength="9" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })} /></label>
                <label className="gp-field"><span>Contraseña * (mín 8)</span><input type="password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} /></label>
                <label className="gp-field"><span>Rol</span>
                  <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                    <option value="owner">Dueño</option><option value="operador">Operador</option>
                  </select></label>
                {nuevo.rol === 'operador' && (
                  <label className="gp-field"><span>Asignar a garaje</span>
                    <select value={nuevo.garage_id} onChange={(e) => setNuevo({ ...nuevo, garage_id: e.target.value })}>
                      <option value="">—</option>
                      {garajes.map((g) => <option key={g.id} value={g.id}>#{g.id} {g.nombre}</option>)}
                    </select></label>)}
                <button className="gp-btn">Guardar usuario</button>
              </form>
              <div className="gp-card">
                <div className="gp-row" style={{ justifyContent: 'space-between' }}>
                  <h3>👥 Usuarios ({usuariosF.length})</h3>
                  <div className="gp-row">
                    <FiltrosUbi ubic={ubic} fCiudad={fCiudad} setFCiudad={setFCiudad} fZona={fZona} setFZona={setFZona} />
                    <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                      <option value="">Todos</option><option value="owner">Dueños</option><option value="operador">Operadores</option><option value="superadmin">Admins</option>
                    </select>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#64748b' }}>👆 Toca un usuario para ver su ficha completa.</p>
                <div className="gp-scroll">
                  {usuariosF.map((u) => (
                    <div key={u.id} className="gp-item" style={{ cursor: 'pointer' }} onClick={() => verFicha(u.id)}>
                      <div><b>{u.nombre}</b> <span className="gp-badge info">{u.rol}</span> {u.email_verificado ? <span className="gp-badge ok">✓ verificado</span> : <span className="gp-badge busy">sin verificar</span>}<br />
                        <small style={{ color: '#64748b' }}>{u.email} · +51 {u.telefono || '—'} · {u.eventos} eventos{u.garajes ? ` · ${u.garajes.map((g) => g.nombre).join(', ') || 'sin garaje'}` : ''}</small></div>
                      <span style={{ fontSize: 18 }}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>}

          {vista === 'actividad' && <div className="gp-card">
            <div className="gp-row" style={{ justifyContent: 'space-between' }}>
              <h3>🧾 Actividad {filtroUser ? 'del usuario seleccionado' : 'de todos'}</h3>
              <select value={filtroUser} onChange={(e) => setFiltroUser(e.target.value)}>
                <option value="">Todos los usuarios</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
              </select>
            </div>
            <div className="gp-scroll">
              {acts.map((a) => (
                <div key={a.id} className="gp-item">
                  <div><b>{a.usuario || 'sistema'}</b> <span className="gp-badge info">{a.accion}</span><br />
                    <small style={{ color: '#64748b' }}>{a.detalle} · {fmtLima(a.created_at)}</small></div>
                </div>
              ))}
              {acts.length === 0 && <p style={{ color: '#94a3b8' }}>Sin actividad registrada.</p>}
            </div>
          </div>}

          {ficha && (
            <div className="gp-modalback" onClick={() => setFicha(null)}>
              <div className="gp-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
                <Limite>
                  <div className="gp-row" style={{ justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>👤 {ficha.usuario?.nombre} <span className="gp-badge info">{ficha.usuario?.rol}</span> {ficha.usuario?.email_verificado ? <span className="gp-badge ok">✓ verificado</span> : <span className="gp-badge busy">sin verificar</span>}</h3>
                    <button className="gp-btn ghost" onClick={() => setFicha(null)}>✕ Cerrar</button>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748b' }}>✉️ {ficha.usuario?.email} · 📱 +51 {ficha.usuario?.telefono || '—'} · desde {fmtLima(ficha.usuario?.created_at)}</p>
                  <div className="gp-stats">
                    <div className="gp-stat"><div className="ic" style={{ background: '#e7f1fd' }}>🏢</div><div><b>{(ficha.garajes || []).length}</b><span>garajes</span></div></div>
                    <div className="gp-stat"><div className="ic" style={{ background: '#f3e8ff' }}>💰</div><div><b>{soles(ficha.ingresos_total)}</b><span>ingresos 12m</span></div></div>
                    <div className="gp-stat"><div className="ic" style={{ background: '#fff4e5' }}>🧾</div><div><b>{ficha.tickets_total ?? 0}</b><span>cobros 12m</span></div></div>
                    <div className="gp-stat"><div className="ic" style={{ background: '#ebfbee' }}>📌</div><div><b>{(ficha.actividad || []).length}</b><span>eventos</span></div></div>
                  </div>
                  <h3>📈 Sus ingresos por mes (igual que el general, solo él)</h3>
                  <Barras serie={ficha.serie} />
                  <h3>🏢 Sus garajes ({(ficha.garajes || []).length})</h3>
                  {(ficha.garajes || []).map((g) => (
                    <div key={g.id} className="gp-item"><div><b>#{g.id} {g.nombre}</b><br />
                      <small style={{ color: '#64748b' }}>📍 {g.ciudad}{g.zona ? ` · ${g.zona}` : ''} · 🟢{g.disponibles ?? '?'} libres · 🔴{g.ocupados ?? '?'} dentro · S/ {g.precio_hora}/h</small></div></div>
                  ))}
                  {(ficha.garajes || []).length === 0 && <p style={{ color: '#94a3b8' }}>Sin garajes.</p>}
                  <h3>🧾 Su actividad ({(ficha.actividad || []).length})</h3>
                  <div className="gp-scroll">
                    {(ficha.actividad || []).map((a) => (
                      <div key={a.id} className="gp-item"><div><span className="gp-badge info">{a.accion}</span><br />
                        <small style={{ color: '#64748b' }}>{a.detalle} · {fmtLima(a.created_at)}</small></div></div>
                    ))}
                    {(ficha.actividad || []).length === 0 && <p style={{ color: '#94a3b8' }}>Sin actividad.</p>}
                  </div>
                </Limite>
              </div>
            </div>
          )}

          {vista === 'garajes' && <div className="gp-card">
            <div className="gp-row" style={{ justifyContent: 'space-between' }}>
              <h3>🏢 Garajes ({garajesF.length})</h3>
              <div className="gp-row"><FiltrosUbi ubic={ubic} fCiudad={fCiudad} setFCiudad={setFCiudad} fZona={fZona} setFZona={setFZona} /></div>
            </div>
            {garajesF.map((g) => (
              <div key={g.id} className="gp-item">
                <div><b>#{g.id} {g.nombre}</b> · {g.owner_nombre || '?'} ({g.owner_email || ''})<br />
                  <small style={{ color: '#64748b' }}>📍 {g.ciudad}{g.zona ? ` · ${g.zona}` : ''} · {g.direccion || 'sin dirección'} · {g.total_espacios} espacios</small> <span className={`gp-badge ${g.activo ? 'ok' : 'out'}`}>{g.activo ? 'activo' : 'desactivado'}</span></div>
                <button className="gp-btn ghost" style={{ padding: '6px 12px' }} onClick={async () => {
                  try { await api(`/api/admin/garages/${g.id}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !g.activo }) }); avisar('Estado cambiado'); cargarTodo(); }
                  catch (e) { avisar(e.message, 'error'); }
                }}>{g.activo ? 'Desactivar' : 'Activar'}</button>
                <button className="gp-btn ghost" style={{ padding: '6px 12px', color: '#d63939', borderColor: '#ffc9c9' }} onClick={async () => {
                  if (!confirm(`¿Eliminar "${g.nombre}" con todo su historial?`)) return;
                  if (prompt('Escribe ELIMINAR para confirmar') !== 'ELIMINAR') return;
                  try { await api(`/api/garages/${g.id}`, { method: 'DELETE' }); avisar('Garaje eliminado'); cargarTodo(); }
                  catch (e) { avisar(e.message, 'error'); }
                }}>🗑️</button>
              </div>
            ))}
          </div>}
        </div>
      </div>
    </div>
  );
}
