function json(code, payload) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Vary', 'Origin');
  return new Response(JSON.stringify(payload), { status: code, headers });
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

const FIELD_LIMITS = { name: 80, phone: 40, email: 120, message: 2000 };
const RL_WINDOW = 600;
const RL_MAX = 5;
const hits = new Map();

function clientIp(request) {
  const fwd = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
  return fwd.split(',')[0].trim() || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now() / 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW);
  if (list.length >= RL_MAX) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clean(data) {
  const out = {};
  for (const [key, limit] of Object.entries(FIELD_LIMITS)) {
    let value = data[key];
    if (typeof value !== 'string') value = '';
    out[key] = value.replace(/\r\n/g, '\n').trim().slice(0, limit);
  }
  return out;
}

function telegramPayload(env, fields, ip) {
  const lines = ['<b>Новая заявка с сайта</b>', ''];
  const labels = [['name', 'Имя'], ['phone', 'Телефон'], ['email', 'E-mail'], ['message', 'Сообщение']];
  for (const [key, label] of labels) {
    if (fields[key]) lines.push('<b>' + label + ':</b> ' + esc(fields[key]));
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = pad(now.getDate()) + '.' + pad(now.getMonth() + 1) + '.' + now.getFullYear() + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  lines.push('');
  lines.push('<i>' + stamp + ' · ' + esc(ip) + '</i>');
  return JSON.stringify({
    chat_id: env.TG_CHAT_ID,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
}

async function sendToTelegram(env, fields, ip) {
  const res = await fetch('https://api.telegram.org/bot' + env.TG_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: telegramPayload(env, fields, ip)
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.description || 'telegram error');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json(405, { ok: false, error: 'not found' });

  if (!env.TG_TOKEN || !env.TG_CHAT_ID) {
    return json(500, { ok: false, error: 'Приём заявок не настроен. Позвоните нам.' });
  }

  let raw;
  try {
    raw = await request.text();
  } catch (e) {
    return json(400, { ok: false, error: 'bad body' });
  }
  if (raw.length > 8192) return json(400, { ok: false, error: 'bad size' });

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return json(400, { ok: false, error: 'bad body' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json(400, { ok: false, error: 'bad body' });
  }

  const fields = clean(data);
  if (fields.name.length < 2) return json(400, { ok: false, error: 'Укажите имя.' });
  if (fields.phone.replace(/\D/g, '').length < 7) return json(400, { ok: false, error: 'Укажите телефон.' });
  if (fields.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return json(400, { ok: false, error: 'Проверьте e-mail.' });
  }

  const ip = clientIp(request);
  if (rateLimited(ip)) return json(429, { ok: false, error: 'Слишком много заявок подряд. Попробуйте позже.' });

  try {
    await sendToTelegram(env, fields, ip);
  } catch (e) {
    return json(502, { ok: false, error: 'Не удалось отправить заявку. Позвоните нам.' });
  }
  return json(200, { ok: true });
}
