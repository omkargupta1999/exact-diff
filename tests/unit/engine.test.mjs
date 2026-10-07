// Unit tests for the diff engine embedded in src/index.html (run: npm run test:unit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../src/index.html', import.meta.url), 'utf8');
const start = html.indexOf('function DiffEngineFactory()');
const end = html.indexOf('const Engine = DiffEngineFactory();');
assert.ok(start > 0 && end > start, 'diff engine not found in src/index.html');
// The engine is a pure function with no DOM access; evaluate it in isolation.
const E = new Function(html.slice(start, end) + '\nreturn DiffEngineFactory;')()();

function split(t) {
  const lines = [], eols = [];
  if (!t) return { lines, eols };
  const re = /\r\n|\r|\n/g; let last = 0, m;
  while ((m = re.exec(t))) { lines.push(t.slice(last, m.index)); eols.push(m[0]); last = re.lastIndex; }
  if (last < t.length) { lines.push(t.slice(last)); eols.push(''); }
  return { lines, eols };
}
const STRICT = { ignoreWhitespace: false, ignoreCase: false, compareEol: true, algorithm: 'patience', ignoreBlank: false, ignoreRegex: '' };
const cmp = (a, b, o = {}) => { const A = split(a), B = split(b); return E.computeDiff(A.lines, A.eols, B.lines, B.eols, { ...STRICT, ...o }); };
const sections = (r) => r.hunks.length / 2;
const intra = (a, b, o = {}) => E.intraLine(a, b, { word: true, char: true, ignoreWhitespace: false, ignoreCase: false, ignoreRegex: '', ...o });

test('two spaces instead of one is a difference, and the extra space is highlighted', () => {
  const r = cmp('hello world', 'hello  world');
  assert.equal(r.stats.changed, 1);
  assert.ok(intra('hello world', 'hello  world').b.some(([s, e, lvl]) => lvl === 2 && s >= 5 && e <= 7));
});

test('leading indentation differences are detected', () => {
  assert.equal(cmp('    hello', '  hello').stats.changed, 1);
});

test('a trailing space is detected and is the only highlighted character', () => {
  assert.equal(cmp('hello', 'hello ').stats.changed, 1);
  assert.deepEqual(intra('hello', 'hello ').b, [[5, 6, 2]]);
});

test('character-level highlight inside a changed number', () => {
  const ia = intra('paymentAmount = 1000;', 'paymentAmount = 1500;');
  assert.deepEqual(ia.a.filter((x) => x[2] === 1), [[16, 20, 1]]);
  assert.ok(ia.b.some(([s, e, lvl]) => lvl === 2 && s === 17 && e === 18));
});

test('word-level highlight does not touch unchanged words', () => {
  const a = 'The payment transaction was successful.';
  const ia = intra(a, 'The payment transaction failed.');
  assert.ok(ia.a.map(([s, e]) => a.slice(s, e)).join('').includes('successful'));
  assert.ok(!ia.a.some(([s, e]) => a.slice(s, e).includes('payment')));
});

test('strict mode distinguishes every whitespace variant', () => {
  const v = ['abc', 'abc ', 'abc \t\t', ' abc', 'abc\t'];
  for (const x of v) for (const y of v) if (x !== y) assert.equal(sections(cmp(x, y)), 1, JSON.stringify([x, y]));
});

test('added, removed and blank lines', () => {
  assert.equal(cmp('a\nb\nc', 'a\n\nb\nc').stats.added, 1);
  assert.equal(cmp('a\nb\nc', 'a\nc').stats.removed, 1);
  const r = cmp('', 'hello\nworld\ntest');
  assert.equal(r.stats.added, 3); assert.equal(sections(r), 1);
});

test('identical input has zero difference sections', () => {
  const r = cmp('x\ny\n', 'x\ny\n');
  assert.equal(sections(r), 0); assert.equal(r.stats.equal, 2);
});

test('line endings: CRLF vs LF, CR-only, missing final newline', () => {
  assert.equal(cmp('a\r\nb\r\n', 'a\nb\n').stats.changed, 2);
  const off = cmp('a\r\nb\r\n', 'a\nb\n', { compareEol: false });
  assert.equal(sections(off), 0); assert.equal(off.stats.minor, 2);
  assert.equal(cmp('a\rb', 'a\rb').n, 2);
  const nf = cmp('a\nb', 'a\nb\n');
  assert.equal(nf.stats.changed, 1); assert.equal(nf.n, 2);
});

test('ignore whitespace and ignore case modes', () => {
  assert.equal(sections(cmp('hello world', 'hello   world', { ignoreWhitespace: true, compareEol: false })), 0);
  assert.equal(sections(cmp('HELLO', 'hello', { ignoreCase: true })), 0);
  assert.equal(sections(cmp('HELLO ', 'hello', { ignoreCase: true })), 1);
  assert.equal(sections(cmp('HELLO ', 'hello', { ignoreCase: true, ignoreWhitespace: true })), 0);
});

test('Unicode is compared without normalisation and never split inside a code point', () => {
  const s = 'नमस्ते 😀 日本 مرحبا Привет';
  assert.equal(sections(cmp(s, s)), 0);
  assert.deepEqual(intra('a😀b', 'a😃b', { word: false }).a, [[1, 3, 2]]);
  assert.equal(sections(cmp('a b', 'a b')), 1);       // space vs no-break space
  assert.equal(sections(cmp('café', 'café')), 1);    // NFC vs NFD
});

test('ignore blank lines marks them unimportant but keeps real changes', () => {
  const r = cmp('a\nb\n', 'a\n\n  \nb\n', { ignoreBlank: true });
  assert.equal(sections(r), 0); assert.deepEqual(Array.from(r.types), [0, 6, 6, 0]);
  assert.equal(cmp('a\n\nb\nc\n', 'a\nB\n\nc\n', { ignoreBlank: true }).stats.changed, 1);
});

test('ignore-pattern rule (e.g. log timestamps)', () => {
  const o = { ignoreRegex: '\\d{4}-\\d\\d-\\d\\dT[\\d:.]+Z' };
  assert.equal(sections(cmp('2026-10-07T10:00:01.123Z INFO started\n', '2026-10-07T11:22:33.999Z INFO started\n', o)), 0);
  const a = '2026-10-07T10:00:01Z INFO started';
  const ia = intra(a, '2026-10-07T11:22:33Z WARN started', o);
  assert.deepEqual(ia.a.map(([s, e]) => a.slice(s, e)), ['INFO']);
});

test('all algorithms agree on simple counts', () => {
  for (const algorithm of ['patience', 'myers', 'positional']) {
    const r = cmp('a\nb\nc\nd\n', 'a\nB\nc\nd\ne\n', { algorithm });
    assert.equal(r.stats.changed, 1, algorithm); assert.equal(r.stats.added, 1, algorithm);
  }
});

test('fuzz: every line appears once, in order; equal rows are byte-identical; no difference is missed', () => {
  const pool = ['a', 'b', 'c', ' a', 'a ', '\t', '', 'x y', 'x  y', 'B'];
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let it = 0; it < 1500; it++) {
    const mk = () => { let s = ''; const n = rnd(15); for (let i = 0; i < n; i++) s += pool[rnd(pool.length)] + ['\n', '\r\n', '\r'][rnd(3)]; if (rnd(2)) s += pool[rnd(pool.length)]; return s; };
    const a = mk(), b = mk(), A = split(a), B = split(b);
    for (const algorithm of ['patience', 'myers', 'positional']) for (const ignoreBlank of [false, true]) {
      const r = E.computeDiff(A.lines, A.eols, B.lines, B.eols, { ...STRICT, algorithm, ignoreBlank });
      let la = 0, lb = 0;
      for (let i = 0; i < r.n; i++) {
        const x = r.rowL[i], y = r.rowR[i];
        if (x >= 0) assert.equal(x, la++);
        if (y >= 0) assert.equal(y, lb++);
        if (r.types[i] === 0) assert.ok(A.lines[x] === B.lines[y] && A.eols[x] === B.eols[y]);
      }
      assert.equal(la, A.lines.length); assert.equal(lb, B.lines.length);
      if (!ignoreBlank) assert.equal(r.hunks.length === 0, a === b, JSON.stringify([a, b, algorithm]));
    }
  }
});

test('performance: 100,000 lines with 2,000 changes in well under 5 s', () => {
  const L = Array.from({ length: 100000 }, (_, i) => 'line ' + i + ' value=' + (i * 7 % 1000));
  const R = L.slice();
  for (let i = 0; i < 2000; i++) { const k = (i * 4999) % 100000; R[k] += ' changed'; }
  R.splice(500, 0, 'inserted'); R.splice(70000, 30);
  const t0 = Date.now();
  const r = E.computeDiff(L, L.map(() => '\n'), R, R.map(() => '\n'), STRICT);
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(r.stats.changed, 2000); assert.equal(r.stats.added, 1); assert.equal(r.stats.removed, 30);
});
