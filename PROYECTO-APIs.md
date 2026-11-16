# Proyectos fin II Unidad

## Proyecto 1: ParkeoPe (Gestión Inteligente de Cocheras con Disponibilidad en Tiempo Real)

Una aplicación web gratuita para dueños y operadores de cocheras en Perú que registra la
entrada y salida de vehículos, cobra de forma automática según el tarifario que cada cochera
define y muestra los ingresos, el historial de movimientos y la ficha de cada cochera en
tiempo real. Inicialmente nace como un gestor de cocheras, pero una vez captados los
primeros dueños se transforma en un Waze de las cocheras: un mapa en vivo donde el
conductor encuentra qué cocheras tienen espacios disponibles ahora mismo, a qué distancia se
encuentran, a qué precio y cuánto demora el trayecto, con aviso automático cuando se
libera un espacio cerca.

• API 1 (OpenStreetMap API): Para ubicar cada cochera en un mapa interactivo, convertir la
dirección en coordenadas, calcular la distancia entre el conductor y las cocheras cercanas y
mostrar los espacios disponibles de cada una en tiempo real.

• API 2 (Brevo API): Para enviar por correo el código de verificación de 6 dígitos que
activa la cuenta del dueño de la cochera, y también los avisos de la plataforma como el
cierre de un ticket con su monto y el resumen diario de ingresos.

• API 3 (Twilio API): Para verificar el número de celular del dueño de la cochera mediante
SMS y enviarle avisos instantáneos cuando un vehículo registra su salida, de modo que
pueda cobrar el ticket a tiempo.

• API complementaria (OpenAI API): Para generar textos promocionales para el dueño de la
cochera a partir de sus datos reales de operación, como publicaciones para redes sociales.

---

## Detalle de las APIs utilizadas

### API 1. OpenStreetMap (Nominatim, tiles y Leaflet)

| Dato | Detalle |
|---|---|
| Endpoints | `https://nominatim.openstreetmap.org/search?format=json&countrycodes=pe&q=...`<br>`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=...&lon=...`<br>`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Libreria de mapa | Leaflet 1.9.4, auto-alojada en la carpeta publica del frontend |
| Funcion en el sistema | Geocodificacion de la direccion (direccion a coordenadas) y geocodificacion inversa (coordenadas a direccion legible) dentro del modal de ubicacion del formulario de cochera |
| Datos almacenados | latitud, longitud y direccion en la tabla de cocheras |
| Autenticacion | No requiere, es un servicio publico |
| Costo | Gratuito, con limite de uso justo de 1 peticion por segundo, por lo que las consultas se realizan desde el servidor con cache |
| Atribucion | Debe mostrarse la mencion OpenStreetMap en el mapa |

### API 2. Brevo (correo electronico transaccional)

| Dato | Detalle |
|---|---|
| Endpoint | `POST https://api.brevo.com/v3/smtp/email` |
| Autenticacion | Cabecera `api-key` con el valor de la variable de entorno `BREVO_API_KEY`, nunca expuesto en el frontend |
| Funcion en el sistema | Envio del codigo de verificacion de 6 digitos, con vigencia de 15 minutos, opcion de reenvio y limite de intentos por direccion IP |
| Alternativas | API de SendGrid como respaldo y SMTP clasico con Nodemailer como ultima opcion |
| Costo | Gratuito hasta 300 correos por dia |

### API 3. Twilio (SMS y WhatsApp)

| Dato | Detalle |
|---|---|
| Endpoint | `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json` |
| Autenticacion | Basic Auth con `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` guardados como variables de entorno |
| Funcion en el sistema | Verificacion del celular como segunda via de confirmacion de cuenta y avisos instantaneos de salida de vehiculo con el monto a cobrar |
| Costo | Aproximadamente 0.12 soles por mensaje SMS y 0.25 soles por conversacion de WhatsApp |
| Estado | Integracion preparada, requiere cuenta en Twilio con numero verificado |

### API complementaria. OpenAI (generacion de contenido)

| Dato | Detalle |
|---|---|
| Endpoint | `POST https://api.openai.com/v1/responses` |
| Funcion en el sistema | Genera publicaciones promocionales para el dueno de la cochera usando sus datos reales de operacion, por ejemplo el nombre, la ciudad, la tarifa por hora y el porcentaje de ocupacion |
| Costo | Modelo de pago por tokens, con costo marginal muy bajo para textos cortos |

---

## VISION DE PRODUCTO: DEL GESTOR DE COCHERAS AL WAZE DE LAS COCHERAS

### Fase 1. Gestion de cocheras (estado actual, en produccion)

El dueno de la cochera ingresa desde el celular, crea su cochera y define como cobra: por
hora, por tramos, por dia o mixto, con tolerancia de cortesia, monto minimo del ticket,
tarifa nocturna y recargo de fin de semana. Luego registra entradas y salidas por numero de
placa sobre el mapa de espacios de su cochera y el motor de cobro calcula el monto de forma
automatica. Cada movimiento queda registrado y el panel muestra los ingresos del dia, el
historial de tickets y la ficha de cada cochera.

El dato que ya se genera en esta fase y que alimentara la segunda fase es la disponibilidad
en tiempo real: espacio libre u ocupado, con ubicacion, precio y tarifa de cada cochera.

### Fase 2. Waze de las cocheras (el conductor encuentra cochera)

| Funcionalidad | Descripcion | API que se incorpora |
|---|---|---|
| Mapa de disponibilidad en vivo | Muestra todas las cocheras cercanas con los espacios libres que tienen en ese momento, no un dato de ayer | OpenStreetMap y Leaflet, ya disponibles, mas Server Sent Events o WebSocket para refrescar el estado sin recargar la pagina |
| Busqueda de cochera | El conductor escribe una direccion o permite el acceso a su ubicacion y ve las cocheras ordenadas por distancia | Nominatim, ya disponible, y la API de geolocalizacion nativa del navegador |
| Tiempo estimado de llegada | Muestra los minutos de trayecto, la distancia en kilometros y la cantidad de espacios libres con su precio | OSRM, motor de rutas de codigo abierto, o Valhalla; como alternativa la API de Google Directions, que requiere tarjeta de credito |
| Aviso de espacio libre | Envia una notificacion al conductor cuando se libera un espacio cerca de su posicion | Web Push con FCM o VAPID, gratuito y sin tarjeta, o SMS con Twilio si el usuario lo solicita |
| Precio en tiempo real | Permite que el dueno baje el precio en las horas de menor ocupacion y el conductor lo vea de inmediato | WebSocket y base de datos Neon, ya disponibles |

El proyecto puede llegar a esta segunda fase porque la mayor parte de la infraestructura
critica ya existe: mapa, geocodificacion, base de datos con el estado de cada espacio, API
con manejo de tiempo real y la logica de tarifas por zona. Lo que se agrega es una capa de
descubrimiento, un endpoint que devuelva los espacios libres dentro de un radio con su
precio y distancia, y la interfaz del conductor. Ademas, cada cochera registrada es oferta
disponible, por lo que el valor de la plataforma crece a medida que se suman mas duenos y
mas conductores, igual que ocurre con Waze.

---

## INFRAESTRUCTURA PROPIA DEL PROYECTO

| Capa | Tecnologia | Plan |
|---|---|---|
| Base de datos | Neon con PostgreSQL | Capa gratuita |
| API y backend | Render con Node 22, Express y el controlador pg | Capa gratuita |
| Frontend del dueno | Vercel con React y Vite | Plan gratuito |
| Panel de administracion | Vercel en un proyecto separado | Plan gratuito |
| Codigo fuente | GitHub en repositorio privado | Sin costo |
| Monitoreo | UptimeRobot, que consulta el endpoint de salud para que el servicio no se suspenda | Gratuito |

---

## SEGURIDAD IMPLEMENTADA

- Consultas SQL parametrizadas en su totalidad, sin concatenar datos del usuario.
- Contrasenas almacenadas con bcrypt y sesiones gestionadas con JWT firmado.
- Limites de peticiones: 30 intentos de inicio de sesion cada 15 minutos y 20 registros por hora.
- CORS cerrado, solo responde a los dominios declarados en la variable `FRONT_URL`.
- Claves de servicios de terceros unicamente en variables de entorno del servidor.
- Sin mapas de codigo fuente en produccion y errores internos genericos.
