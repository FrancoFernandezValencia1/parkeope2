# Publicar GRATIS (Neon + Render + Vercel) y checklist de seguridad

## 0. Sube el código a GitHub (privado recomendado)
```
cd garaje-peru
git init && git add -A && git commit -m "sistema cocheras"
# crea repo PRIVADO en github.com y:
git remote add origin https://github.com/TU_USER/garaje-peru.git
git push -u origin main
```
Repo privado = nadie ve tu código ni plantillas.

## 1. Base de datos gratis — Neon (https://neon.tech)
1. Crea proyecto Postgres (región US-East).
2. Copia la `DATABASE_URL` (`postgres://...?sslmode=require`).
3. Las tablas se crean solas al arrancar el server (`migrate` automático).
4. Activa backups (Neon los incluye) y no compartas esa URL.

## 2. Backend gratis — Render (usa `render.yaml`)
1. https://render.com → New → Blueprint → conecta tu repo (lee `garaje-peru/render.yaml`).
2. Completa variables: `DATABASE_URL` (Neon), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (nueva, el arranque falla con la default), `FRONT_URL` (las 2 URLs de Vercel del paso 3), SMTP (paso 4).
3. Plan **free**. Ojo: se duerme tras inactividad (~50 s en despertar); si molesta, UptimeRobot gratis lo mantiene vivo.

## 3. Frontends gratis — Vercel (2 proyectos)
1. https://vercel.com → Add New Project → mismo repo:
   - Proyecto `garaje-sistema`: Root Directory `garaje-peru/client`, env `VITE_API_URL=https://TU-API.onrender.com`
   - Proyecto `garaje-admin`: Root Directory `garaje-peru/admin`, misma env.
2. Cada deploy genera build minificado **sin source maps** (verificado: no hay `.map` en `dist/`), el código queda ilegible en la práctica.

## 4. Correos de verificación gratis — Resend (https://resend.com, 3000/mes)
1. Crea API key → en Render: `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_PASS=tu-key`, `SMTP_FROM=Garajes Perú <no-reply@tudominio>`.
2. Con SMTP real + `ALLOW_DEMO_CODES=false`, el código de 6 dígitos viaja **solo por correo**, nunca en la API.

## Blindaje aplicado en el código
- **SQL injection**: 100% consultas parametrizadas (`$1...`), `LIMIT` parametrizado, sin concatenar input. Verificado por auditoría.
- **Contraseñas**: bcrypt (hash + sal por usuario). Nunca se devuelven ni se loguean.
- **Sesiones**: JWT 12 h; en producción se exige `JWT_SECRET` ≥ 32 caracteres o el server no arranca.
- **Fuerza bruta**: rate-limit en login/verificar (30/15 min) y registro (20/hora).
- **Cabeceras**: `helmet` (HSTS, anti-clickjacking, anti-MIME-sniff, XSS), sin `X-Powered-By`.
- **CORS cerrado**: solo tus dominios (`FRONT_URL`); `*` solo en dev.
- **Errores genéricos**: ningún 500 expone SQL ni stack. Tablas de auditoría (`activity`) para rastrear quién hizo qué.
- **Admin**: contraseña default bloquea el arranque en producción.

## Límites honestos (importante)
- El JS del navegador **siempre** se puede descargar (así funciona la web). Lo que sí queda protegido: tu backend, tu BD, tus claves y tu lógica de negocio — nada de eso viaja al front. Con build minificado + sin maps + repo privado, copiar el sistema deja de ser trivial.
- "Implacable" al 100% no existe; con esto quedas al nivel de un SaaS profesional: ni inyección SQL, ni lectura de claves, ni fuerza bruta viable.
- HTTPS lo ponen Render/Vercel/Neon automáticamente. No aceptes conexiones sin `https://` en producción.
- Rota `JWT_SECRET` y `ADMIN_PASSWORD` cada 6–12 meses.
