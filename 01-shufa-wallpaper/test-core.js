// node test-core.js
const assert = require('assert');
const { retryUntil } = require('./core.js');
(async () => {
  let n = 0;
  const seq = r => { let i = 0; return { calls: () => i, step: async () => r[Math.min(i++, r.length - 1)] }; };
  let s = seq([true]);           assert.strictEqual(await retryUntil(s.step, 5), true);  assert.strictEqual(s.calls(), 1); n++;
  s = seq([false, false, true]); assert.strictEqual(await retryUntil(s.step, 5), true);  assert.strictEqual(s.calls(), 3); n++;
  s = seq([false]);              assert.strictEqual(await retryUntil(s.step, 4), false); assert.strictEqual(s.calls(), 4); n++;
  s = seq([true]);               assert.strictEqual(await retryUntil(s.step, 0), false); assert.strictEqual(s.calls(), 0); n++;
  await assert.rejects(retryUntil(async () => { throw new Error('x'); }, 3)); n++;
  console.log('ok - ' + n + ' retryUntil cases');
})();
