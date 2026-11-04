// 纯逻辑：可在 node 下测试（node test-core.js）
(function (root) {
  // 反复调用 step()（返回 Promise<boolean>，true=本次绘制未被新的设置作废），直到成功或用完 max 次。
  // 返回 true 表示最终画面是最新的；false 表示重试用尽（调用方仍可继续导出，但画面可能不是最新）。
  async function retryUntil(step, max) {
    for (let i = 0; i < max; i++) if (await step()) return true;
    return false;
  }
  const api = { retryUntil: retryUntil };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShufaCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
