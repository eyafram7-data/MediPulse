const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');

const PORT = 3200 + Math.floor(Math.random() * 500), BASE = `http://localhost:${PORT}`;
const DATA = path.join(os.tmpdir(), `medipulse-test-${process.pid}.json`);
let proc;
const post = async (p, body, cookie) => {
  const r = await fetch(BASE + '/api/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
};
const get = async (p, cookie) => { const r = await fetch(BASE + '/api/' + p, { headers: { Cookie: cookie } }); return { status: r.status, json: await r.json() }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  proc = spawn('node', [path.join(__dirname, '..', 'src', 'server.js')], { env: { ...process.env, PORT, DATA_FILE: DATA, ZOOM_ACCOUNT_ID: '', ZOOM_CLIENT_ID: '', ZOOM_CLIENT_SECRET: '' } });
  await new Promise((ok, no) => { proc.stdout.on('data', d => String(d).includes('running') && ok()); proc.on('error', no); setTimeout(() => no(new Error('server did not start')), 8000); });
});
after(() => { proc.kill(); fs.rmSync(DATA, { force: true }); });

test('rejects unauthenticated dashboard access', async () => { assert.strictEqual((await get('dashboard', '')).status, 401); });
test('rejects wrong password', async () => { assert.strictEqual((await post('login', { email: 'akosua@demo.gh', password: 'nope' })).status, 401); });
test('validates sign-up input', async () => {
  assert.strictEqual((await post('signup', { name: 'A', email: 'bad', password: 'x', role: 'patient' })).status, 400);
  assert.strictEqual((await post('signup', { name: 'Test User', email: 't@x.com', password: 'password1', role: 'doctor' })).status, 400);
});

test('patient and caregiver flow: care code, alerts, shared Zoom call', async () => {
  const pat = await post('signup', { name: 'Ama Mensah', email: 'ama@test.com', password: 'password1', role: 'patient' });
  assert.strictEqual(pat.status, 201);
  const pd = (await get('dashboard', pat.cookie)).json.patients[0];
  assert.match(pd.code, /^AMA-\d{3}$/);

  assert.strictEqual((await post('signup', { name: 'Kofi Mensah', email: 'kofi@test.com', password: 'password1', role: 'caregiver', code: 'ZZZ-000' })).status, 400);
  const care = await post('signup', { name: 'Kofi Mensah', email: 'kofi@test.com', password: 'password1', role: 'caregiver', code: pd.code });
  assert.strictEqual(care.status, 201);
  const cd = (await get('dashboard', care.cookie)).json;
  assert.strictEqual(cd.user.role, 'caregiver');
  assert.strictEqual(cd.patients[0].id, pd.id);
  assert.strictEqual(cd.patients[0].code, undefined, 'caregiver must not see the care code');
  assert.notStrictEqual((await post('meds', { id: 'm1' }, care.cookie)).status, 200, 'caregiver cannot change medication');

  await post('scenario', { scn: 'hypoxia' }, pat.cookie);
  let found = false; // SpO2 takes a few 3-second ticks to fall below 91, so poll up to 25s
  for (let i = 0; i < 25 && !found; i++) {
    await sleep(1000);
    found = (await get('dashboard', care.cookie)).json.patients[0].alerts.some(a => a.k === 'spo2' && a.l === 2);
  }
  assert.ok(found, 'caregiver sees critical SpO2 alert');

  const call = await post('call', { pid: pd.id }, care.cookie);
  assert.strictEqual(call.status, 200);
  assert.strictEqual((await get('dashboard', pat.cookie)).json.patients[0].call.url, call.json.url);
});

test('a user cannot start a call for an unlinked patient', async () => {
  const other = await post('signup', { name: 'Efua Owusu', email: 'efua@test.com', password: 'password1', role: 'patient' });
  const kwame = await post('login', { email: 'kwame@demo.gh', password: 'demo1234' });
  const kid = (await get('dashboard', kwame.cookie)).json.patients[0].id;
  assert.strictEqual((await post('call', { pid: kid }, other.cookie)).status, 403);
});
