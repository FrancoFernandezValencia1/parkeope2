import { useEffect, useRef, useState } from 'react';
import { api, soles } from './lib/api.js';

const LIMA = { lat: -12.0464, lng: -77.0428 };
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function iconoPin(libres) {
  const L = window.L;
  return L.divIcon({
    className: 'gp-pin-wrap',
    html: `<div class="gp-pin ${libres > 0 ? 'ok' : 'full'}">${libres ?? 0}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export default function MapaCocheras({ garajes }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const capaRef = useRef(null);
  const origenRef = useRef(null);

  const [origen, setOrigen] = useState(null);
  const [cocheras, setCocheras] = useState([]);
  const [radio, setRadio] = useState(5);
  const [soloLibres, setSoloLibres] = useState(true);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [rutas, setRutas] = useState({});

  origenRef.current = origen;

  /* ---------- mapa base ---------- */
  useEffect(() => {
    if (!window.L || !ref.current) return;
    const map = window.L.map(ref.current, { scrollWheelZoom: true }).setView([LIMA.lat, LIMA.lng], 12);
    window.L.tileLayer(TILES, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    capaRef.current = window.L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(t); map.remove(); };
  }, []);

  /* ---------- lista visible ---------- */
  const propias = (garajes || [])
    .filter((g) => g.lat != null && g.lng != null)
    .map((g) => ({ ...g, libres: g.disponibles, total: g.total_espacios, distancia_km: null, minutos_aprox: null }));
  const lista = origen ? cocheras : propias;

  /* ---------- dibujar pines ---------- */
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !capaRef.current) return;
    capaRef.current.clearLayers();
    const puntos = [];

    if (origen) {
      L.circleMarker([origen.lat, origen.lng], {
        radius: 9, color: '#206bc4', weight: 2, fillColor: '#206bc4', fillOpacity: 0.25,
      }).addTo(capaRef.current).bindPopup('Punto de búsqueda');
      L.circle([origen.lat, origen.lng], { radius: radio * 1000, color: '#206bc4', weight: 1, fillOpacity: 0.04 })
        .addTo(capaRef.current);
      puntos.push([origen.lat, origen.lng]);
    }

    lista.forEach((g) => {
      const libres = g.libres ?? 0;
      const m = L.marker([g.lat, g.lng], { icon: iconoPin(libres) }).addTo(capaRef.current);
      m.bindPopup(
        `<b>${esc(g.nombre)}</b><br>` +
        `${esc(g.direccion || '')}<br>` +
        `<b>${libres}</b> libres de ${g.total ?? '—'} · ${soles(g.precio_hora)}/hora` +
        (g.distancia_km != null ? `<br>a ${g.distancia_km} km (${g.minutos_aprox} min aprox.)` : '') +
        `<br><a target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}">Cómo llegar</a>`
      );
      m.on('click', () => setSel(g.id));
      puntos.push([g.lat, g.lng]);
    });

    if (puntos.length === 1) map.setView(puntos[0], 15);
    else if (puntos.length > 1) map.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 });
  }, [lista.length, origen?.lat, origen?.lng, radio, cocheras]);

  /* ---------- consultar cercanas ---------- */
  useEffect(() => {
    if (!origen) { setCocheras([]); return; }
    let vivo = true;
    setCargando(true); setError('');
    api(`/api/geo/cercanas?lat=${origen.lat}&lng=${origen.lng}&radio_km=${radio}&solo_libres=${soloLibres ? 1 : 0}`)
      .then((d) => { if (vivo) setCocheras(d.cocheras || []); })
      .catch((e) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [origen?.lat, origen?.lng, radio, soloLibres]);

  /* ---------- acciones ---------- */
  const buscar = async (e) => {
    e?.preventDefault();
    const texto = q.trim();
    if (texto.length < 3) return setError('Escribe al menos 3 caracteres: calle, distrito o lugar.');
    setBuscando(true); setError(''); setResultados([]);
    try {
      const d = await api(`/api/geo/buscar?q=${encodeURIComponent(texto)}&limite=6`);
      if (!d.resultados || !d.resultados.length) setError('No se encontró esa dirección en Perú. Prueba con el distrito.');
      else setResultados(d.resultados);
    } catch (err) { setError(err.message); }
    finally { setBuscando(false); }
  };

  const elegir = (res) => {
    setResultados([]); setError('');
    setQ(res.nombre);
    setOrigen({ lat: res.lat, lng: res.lng });
  };

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return setError('Tu navegador no soporta geolocalización.');
    setCargando(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigen({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () => { setCargando(false); setError('No se pudo obtener tu ubicación. Revisa los permisos.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const enfocar = (g) => {
    setSel(g.id);
    mapRef.current?.setView([g.lat, g.lng], 16);
  };

  const pedirRuta = async (g) => {
    if (!origen) return setError('Primero elige un punto de búsqueda o usa tu ubicación.');
    try {
      const d = await api(`/api/geo/ruta?lat1=${origen.lat}&lng1=${origen.lng}&lat2=${g.lat}&lng2=${g.lng}`);
      setRutas((r) => ({ ...r, [g.id]: d }));
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="gp-card">
      <h3>🗺️ Mapa de cocheras y distancias</h3>
      <p className="gp-help">
        Busca una dirección o usa tu ubicación. El sistema consulta OpenStreetMap, calcula qué cocheras
        están cerca, cuántos espacios libres tienen y a qué precio.
      </p>

      <form onSubmit={buscar} className="gp-row" style={{ marginBottom: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar dirección o distrito (ej. Miraflores, Lima)"
          style={{ flex: 1, padding: 9, border: '1px solid #cbd5e1', borderRadius: 8, minWidth: 150 }} />
        <button className="gp-btn" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
        <button type="button" className="gp-btn ghost" onClick={usarMiUbicacion}>📌 Mi ubicación</button>
      </form>

      {!!resultados.length && (
        <div className="gp-results">
          {resultados.map((r) => (
            <button type="button" key={r.lat + ',' + r.lng} className="gp-result" onClick={() => elegir(r)}>
              <b>{r.nombre}</b><span>{r.direccion}</span>
            </button>
          ))}
        </div>
      )}
      {error && <div className="gp-alert">{error}</div>}

      <div className="gp-row gp-mapopts">
        <label style={{ fontSize: 13 }}>Radio
          <select value={radio} onChange={(e) => setRadio(+e.target.value)}
            style={{ marginLeft: 6, padding: 6, border: '1px solid #cbd5e1', borderRadius: 6 }}>
            {[1, 3, 5, 10, 20].map((k) => <option key={k} value={k}>{k} km</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloLibres} onChange={(e) => setSoloLibres(e.target.checked)} />
          Solo con espacio libre
        </label>
        {origen && <button type="button" className="gp-link" onClick={() => { setOrigen(null); setCocheras([]); setRutas({}); }}>Limpiar punto</button>}
        {cargando && <span className="sub">consultando…</span>}
      </div>

      <div ref={ref} className="gp-bigmap" />

      <div className="gp-row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <b style={{ fontSize: 14 }}>
          {origen ? `${lista.length} cochera(s) en ${radio} km` : `${lista.length} cochera(s) con ubicación`}
        </b>
        <span className="sub">© OpenStreetMap</span>
      </div>

      <div className="gp-maplist">
        {!lista.length && (
          <p className="gp-help">
            {origen ? 'No hay cocheras en ese radio.' : 'Aún no tienes cocheras con ubicación: créalas y marca el punto en el mapa.'}
          </p>
        )}
        {lista.map((g) => {
          const libres = g.libres ?? 0;
          return (
            <div key={g.id} className={`gp-maprow ${sel === g.id ? 'on' : ''}`} onClick={() => enfocar(g)}>
              <div className={`gp-mapdot ${libres > 0 ? 'ok' : 'full'}`}>{libres}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{g.nombre}</b>
                <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.direccion || [g.zona, g.ciudad].filter(Boolean).join(', ') || 'Sin dirección'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {g.distancia_km != null ? (
                  <><b>{g.distancia_km} km</b><div className="sub">{g.minutos_aprox} min</div></>
                ) : <span className="sub">{soles(g.precio_hora)}/h</span>}
                {rutas[g.id]
                  ? <div className="sub">{rutas[g.id].km} km · {rutas[g.id].minutos} min</div>
                  : <button type="button" className="gp-link" onClick={(e) => { e.stopPropagation(); pedirRuta(g); }}>Ruta</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
