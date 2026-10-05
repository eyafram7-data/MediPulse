const http = require('http'), fs = require('fs'), crypto = require('crypto'), path = require('path');
const PORT = process.env.PORT || 3000, DB = process.env.DATA_FILE || path.join(__dirname, '..', 'data.json');
let db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : null;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const check = (pw, h) => { const [s, x] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(hash(pw, s).split(':')[1], 'hex'), Buffer.from(x, 'hex')); };
const meds = () => [{ id: 'm1', n: 'Baclofen 10 mg', w: '08:00', d: false }, { id: 'm2', n: 'Amlodipine 5 mg', w: '13:00', d: false }, { id: 'm3', n: 'Vitamin D3', w: '20:00', d: false }];
const BASE = { hr: 75, spo2: 97, t: 36.8, sys: 118 };

if (!db) { // seed demo data (all demo passwords: demo1234)
  db = { secret: crypto.randomBytes(32).toString('hex'), users: [] };
  const mk = (name, email, role, x) => { const u = { id: crypto.randomUUID(), name, email, role, pw: hash('demo1234'), ...x }; db.users.push(u); return u; };
  const a = mk('Akosua Boateng', 'akosua@demo.gh', 'patient', { age: 34, cond: 'Spinal cord injury', nhis: 'NHIS 0412 7781', hospital: 'Korle Bu Teaching Hospital, Accra', code: 'AKO-482', meds: meds() });
  mk('Kwame Asante', 'kwame@demo.gh', 'patient', { age: 67, cond: 'Post-stroke recovery', nhis: 'NHIS 0398 2204', hospital: 'Komfo Anokye Teaching Hospital, Kumasi', code: 'KWA-731', meds: meds(), base: { ...BASE, sys: 134 } });
  mk('Yaw Boateng', 'yaw@demo.gh', 'caregiver', { links: [a.id] });
  save();
}

// ---- vitals simulator (in memory) ----
const lvl = (k, x) => k === 'hr' ? (x < 50 || x > 120 ? 2 : x < 60 || x > 100 ? 1 : 0) : k === 'spo2' ? (x < 91 ? 2 : x < 95 ? 1 : 0)
  : k === 't' ? (x >= 38.5 || x < 35 ? 2 : x > 37.5 || x < 36.1 ? 1 : 0) : (x >= 160 || x < 90 ? 2 : x >= 130 ? 1 : 0);
const SC = { normal: {}, hypoxia: { spo2: 88, hr: 108 }, fever: { t: 39, hr: 102 }, tachycardia: { hr: 132 } };
const fmt = (k, x) => k === 't' ? x.toFixed(1) : Math.round(x);
const sims = {};
const sim = (p) => sims[p.id] ||= { v: { ...(p.base || BASE) }, h: { hr: [], spo2: [], t: [], sys: [] }, st: { hr: 0, spo2: 0, t: 0, sys: 0 }, scn: 'normal', alerts: [] };
function tick() {
  for (const p of db.users.filter(u => u.role === 'patient')) {
    const s = sim(p), tg = { ...(p.base || BASE), ...SC[s.scn] }, ns = { hr: 3, spo2: .5, t: .08, sys: 4 };
    for (const k in s.v) {
      s.v[k] += (tg[k] - s.v[k]) * .3 + (Math.random() - .5) * ns[k]; if (k === 'spo2') s.v[k] = Math.min(100, s.v[k]);
      const l = lvl(k, s.v[k]); s.st[k] = l ? s.st[k] + 1 : 0;
      const ex = s.alerts.find(a => a.k === k && a.s !== 'done');
      if (!l && ex) ex.s = 'done';
      else if (l && s.st[k] >= 2 && (!ex || l > ex.l)) { if (ex) ex.s = 'done'; s.alerts.unshift({ id: crypto.randomBytes(4).toString('hex'), k, l, val: fmt(k, s.v[k]), time: new Date().toLocaleTimeString('en-GB'), s: 'open' }); }
      s.h[k].push(s.v[k]); if (s.h[k].length > 60) s.h[k].shift();
    }
  }
}
for (let i = 0; i < 40; i++) tick(); db.users.forEach(u => u.role === 'patient' && (sim(u).alerts = []));
setInterval(tick, 3000);

// ---- helpers ----
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', db.secret).update(b).digest('base64url'); };
const unsign = t => { if (!t) return; const [b, s] = t.split('.'); if (!s) return; const e = crypto.createHmac('sha256', db.secret).update(b).digest('base64url');
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : undefined; };
const cookie = u => `sid=${u ? sign({ uid: u.id, exp: Date.now() + 6048e5 }) : ''}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${u ? 604800 : 0}`;
const readBody = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e4) { no(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { no(Object.assign(new Error('Bad JSON'), { code: 400 })); } }); });
const fails = {}, throttled = e => fails[e] && fails[e].n >= 5 && Date.now() - fails[e].t < 3e5;
const pub = (p, own) => { const s = sim(p); return { id: p.id, name: p.name, age: p.age, cond: p.cond, nhis: p.nhis, hospital: p.hospital, v: s.v, h: s.h, scn: s.scn, meds: p.meds, alerts: s.alerts.filter(a => a.s !== 'done').slice(0, 6), call: p.call && Date.now() - p.call.at < 36e5 ? p.call : null, code: own ? p.code : undefined }; };
const canSee = (me, pid) => me.role === 'patient' ? me.id === pid : (me.links || []).includes(pid);
async function zoomMeeting(topic) {
  const { ZOOM_ACCOUNT_ID: a, ZOOM_CLIENT_ID: c, ZOOM_CLIENT_SECRET: s } = process.env;
  const fallback = { url: process.env.ZOOM_LINK || 'https://zoom.us/test', demo: true };
  if (!a || !c || !s) return fallback;
  try {
    const t = await (await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${a}`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c + ':' + s).toString('base64') } })).json();
    const m = await (await fetch('https://api.zoom.us/v2/users/me/meetings', { method: 'POST', headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, type: 1 }) })).json();
    return m.join_url ? { url: m.join_url, demo: false } : fallback;
  } catch { return fallback; }
}

http.createServer(async (req, res) => {
  const send = (c, o, h = {}) => { res.writeHead(c, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...h }); res.end(JSON.stringify(o)); };
  try {
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'))); }
    if (!url.startsWith('/api/')) return send(404, { error: 'Not found' });
    const b = req.method === 'POST' ? await readBody(req) : {};
    const sess = unsign((req.headers.cookie || '').match(/sid=([^;]+)/)?.[1]), me = sess && db.users.find(u => u.id === sess.uid), r = req.method + ' ' + url;
    const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';

    if (r === 'POST /api/signup') {
      const name = str(b.name, 60), email = str(b.email, 120).toLowerCase(), pw = typeof b.password === 'string' ? b.password : '', role = b.role;
      if (name.length < 2) return send(400, { error: 'Enter your full name.' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(400, { error: 'Enter a valid email address.' });
      if (pw.length < 8) return send(400, { error: 'Password must be at least 8 characters.' });
      if (!['patient', 'caregiver'].includes(role)) return send(400, { error: 'Choose patient or caregiver.' });
      if (db.users.some(u => u.email === email)) return send(409, { error: 'An account with this email already exists.' });
      const u = { id: crypto.randomUUID(), name, email, role, pw: hash(pw) };
      if (role === 'patient') Object.assign(u, { code: name.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X') + '-' + (100 + crypto.randomInt(900)), meds: meds(), cond: 'Not specified' });
      else { const p = db.users.find(x => x.role === 'patient' && x.code === str(b.code, 12).toUpperCase()); if (!p) return send(400, { error: 'Care code not found. Ask the patient for their code.' }); u.links = [p.id]; }
      db.users.push(u); save(); return send(201, { ok: true }, { 'Set-Cookie': cookie(u) });
    }
    if (r === 'POST /api/login') {
      const email = str(b.email, 120).toLowerCase();
      if (throttled(email)) return send(429, { error: 'Too many attempts. Wait 5 minutes.' });
      const u = db.users.find(x => x.email === email);
      if (!u || typeof b.password !== 'string' || !check(b.password, u.pw)) { const f = fails[email] ||= { n: 0, t: 0 }; f.n++; f.t = Date.now(); return send(401, { error: 'Email or password is incorrect.' }); }
      delete fails[email]; return send(200, { ok: true }, { 'Set-Cookie': cookie(u) });
    }
    if (r === 'POST /api/logout') return send(200, { ok: true }, { 'Set-Cookie': cookie(null) });
    if (!me) return send(401, { error: 'Please sign in.' });
    if (r === 'GET /api/dashboard') {
      const list = me.role === 'patient' ? [me] : db.users.filter(u => me.links.includes(u.id));
      return send(200, { user: { name: me.name, role: me.role }, patients: list.map(p => pub(p, me.role === 'patient')) });
    }
    if (r === 'POST /api/meds' && me.role === 'patient') { const m = me.meds.find(x => x.id === b.id); if (m) { m.d = !m.d; save(); } return send(200, { ok: true }); }
    if (r === 'POST /api/scenario' && me.role === 'patient' && SC[b.scn]) { sim(me).scn = b.scn; return send(200, { ok: true }); }
    if (r === 'POST /api/ack') { const p = db.users.find(u => u.id === b.pid); const a = p && canSee(me, p.id) && sim(p).alerts.find(x => x.id === b.id); if (a) a.s = 'ack'; return send(200, { ok: true }); }
    if (r === 'POST /api/call') {
      const p = db.users.find(u => u.id === b.pid); if (!p || !canSee(me, p.id)) return send(403, { error: 'Not allowed.' });
      if (!p.call || Date.now() - p.call.at > 36e5) { const z = await zoomMeeting('MediPulse call: ' + p.name); p.call = { ...z, by: me.name, at: Date.now() }; save(); }
      return send(200, p.call);
    }
    return send(404, { error: 'Not found' });
  } catch (e) { send(e.code === 413 || e.code === 400 ? e.code : 500, { error: e.code ? e.message : 'Server error' }); }
}).listen(PORT, () => console.log(`MediPulse running at http://localhost:${PORT}`));
