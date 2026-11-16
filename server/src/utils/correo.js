import nodemailer from 'nodemailer';

// Envío de código de verificación (orden de prioridad):
// 1. SendGrid por API HTTP (sin restricción de IPs, remitente simple)
// 2. Brevo por API HTTP
// 3. SMTP clásico (Gmail/Resend) si hay SMTP_HOST
// 4. Modo demo: consola + código visible (solo local)
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10000, // no colgar el request si el SMTP no responde
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function viaSendGrid(email, asunto, texto) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + process.env.SENDGRID_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: process.env.SENDGRID_FROM || process.env.SMTP_USER, name: 'ParkeoPe' },
        subject: asunto,
        content: [{ type: 'text/plain', value: texto }],
      }),
    });
    if (r.status !== 202) throw new Error(`SendGrid ${r.status}: ${(await r.text()).slice(0, 200)}`);
  } finally {
    clearTimeout(to);
  }
}

async function viaBrevo(email, asunto, texto) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'ParkeoPe', email: process.env.BREVO_FROM || process.env.SMTP_USER },
        to: [{ email }],
        subject: asunto,
        textContent: texto,
      }),
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
  } finally {
    clearTimeout(to);
  }
}

export async function enviarCodigo(email, codigo, nombre = '') {
  const asunto = 'Tu código de verificación — ParkeoPe';
  const texto = `Hola ${nombre}:\n\nTu código de verificación es: ${codigo}\nVence en 15 minutos.\n\n— ParkeoPe`;
  if (process.env.SENDGRID_API_KEY) {
    await viaSendGrid(email, asunto, texto);
    return { enviado: true, modo: 'sendgrid' };
  }
  if (process.env.BREVO_API_KEY) {
    await viaBrevo(email, asunto, texto);
    return { enviado: true, modo: 'brevo' };
  }
  if (transporter) {
    await transporter.sendMail({ from: process.env.SMTP_FROM || 'ParkeoPe <no-reply@garajes.pe>', to: email, subject: asunto, text: texto });
    return { enviado: true, modo: 'smtp' };
  }
  console.log(`[correo-demo] Código para ${email}: ${codigo}`);
  return { enviado: false, modo: 'demo', dev_code: codigo };
}
