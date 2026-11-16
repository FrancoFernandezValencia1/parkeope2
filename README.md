# ParkeoPe — Gestión de cocheras con mapa en tiempo real

Aplicación web para dueños y operadores de cocheras en Perú. Registra entrada/salida de vehículos por placa, calcula el cobro automáticamente según el tarifario de cada cochera, imprime el ticket de 80 mm y muestra un mapa con los garajes y sus espacios disponibles en tiempo real.

## Perú fijo
- Moneda `PEN (S/)`, locale `es-PE`, zona `America/Lima` UTC-5 sin DST. Se guarda `timestamptz` UTC y se muestra en Lima.
- Placa PE validada (`ABC-123`), tolerancia configurable, cobro por hora/fracción, día desde 8 h.

## Estructura
- `server/` — Node + Express + PostgreSQL (nube-ready: Neon/Supabase/Render). `npm run migrate` crea las tablas.
- `client/` — React + Vite. App del dueño/operador (login, garajes, espacios, tickets y mapa).
- `admin/` — React + Vite. Panel de administración.
- `render.yaml` — blueprint de despliegue del backend en Render.

## Módulo de mapas
- Backend: `server/src/routes/geo.js` — `/api/geo/buscar`, `/reverse`, `/distancia`, `/ruta`, `/cercanas`, `/estado`.
- Frontend: pestaña **Mapa** (`client/src/MapaCocheras.jsx`) y modal de ubicación en el formulario de cochera.
- APIs: Nominatim (direcciones), OSM Tiles (mapa), Leaflet local (sin CDN) y OSRM (ruta en auto).

## Correr local
```
# DB nube gratis: Neon.tech -> DATABASE_URL
cd server && cp .env.example .env && npm i && npm run migrate && npm run dev
cd ../client && npm i && npm run dev
cd ../admin  && npm i && npm run dev
```
- API `http://localhost:4000/api/health`
- Web `http://localhost:5173`
- Admin `http://localhost:5174`

## Deploy en la nube
- **Server**: Render/Fly/Railway con `DATABASE_URL` + `JWT_SECRET` + `TZ=America/Lima`.
- **Client / Admin**: Vercel/Netlify con `VITE_API_URL=https://tu-api`.
- **DB**: Neon o Supabase Postgres gratis.

Detalle paso a paso y checklist de seguridad en [`DEPLOY.md`](DEPLOY.md).

## Flujo
1. Registrar dueño → Wizard nuevo garaje (¿cuánto la hora? ¿día? ¿mes? ¿cuántos entran? ¿qué tipos?).
2. Crear operador (`POST /api/auth/operador`).
3. Entrada `POST /api/tickets/in`, salida `POST /api/tickets/out` calcula S/ automáticamente.
4. Ticket `GET /api/tickets/:id/ticket` se imprime.
