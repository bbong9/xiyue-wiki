(() => {
  'use strict';
  const script = document.currentScript;
  const anchor = document.querySelector(script?.dataset.trialMount || '[data-trial-mount]');
  if (!anchor) return;
  const appId = script.dataset.trialApp || 'lumatrace';
  const endpoint = script.dataset.trialApi || 'https://license.bbong9.cn/api/v1/trial/claim';
  const storageKey = `license-trial-v2:${appId}`;
  const read = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) { return null; }
  };
  const write = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(record)); } catch (_) { /* Session still works. */ }
  };
  const clear = () => {
    try { localStorage.removeItem(storageKey); } catch (_) { /* Storage is optional. */ }
  };
  try { localStorage.removeItem(`license-trial-v1:${appId}`); } catch (_) { /* Discard the former claim identity. */ }
  let record = read();

  const card = document.createElement('section');
  card.className = 'trial-card';
  card.id = 'trial';
  card.setAttribute('aria-labelledby', 'trial-title');
  // Fixed, original markup only. Server values are always assigned as text.
  card.innerHTML = '<div class="trial-heading"><p class="trial-eyebrow">LumaTrace</p><h2 id="trial-title">生成 3 天试用码</h2></div>' +
    '<p class="trial-summary">请在 5 分钟内到 App 激活，激活后可用 3 天。每台设备只能试用一次。</p>' +
    '<p class="trial-status" role="status" aria-live="polite"></p>' +
    '<div class="trial-result" hidden><div class="trial-code-row"><code class="trial-code" tabindex="0" aria-label="试用授权码"></code>' +
    '<button type="button" class="trial-copy">复制</button></div><p class="trial-countdown"></p><p class="trial-expiry"></p>' +
    '<ol class="trial-steps"><li>打开 LumaTrace，进入「设置 → 授权」。</li><li>粘贴试用码，点击激活。</li><li>激活成功后，3 天试用立即开始。</li></ol></div>' +
    '<button type="button" class="trial-claim">点击生成试用码</button><noscript>请启用 JavaScript 后生成试用码。</noscript>';
  anchor.insertAdjacentElement('afterend', card);
  const status = card.querySelector('.trial-status');
  const claimButton = card.querySelector('.trial-claim');
  const result = card.querySelector('.trial-result');
  const code = card.querySelector('.trial-code');
  const copyButton = card.querySelector('.trial-copy');
  const countdown = card.querySelector('.trial-countdown');
  let busy = false;
  let expiryTimer;

  function render(state, message) {
    card.dataset.state = state;
    card.setAttribute('aria-busy', String(state === 'loading'));
    status.textContent = message;
    result.hidden = state !== 'generated' && state !== 'expired';
    claimButton.disabled = state === 'loading';
    copyButton.disabled = state === 'expired';
    claimButton.textContent = state === 'loading' ? '生成中…' : state === 'expired' ? '重新生成'
      : state === 'generated' ? '再生成一个' : state === 'error' ? '重试' : '点击生成试用码';
  }

  function tick() {
    const seconds = Math.max(0, Math.ceil((Date.parse(record.expiresAt) - Date.now()) / 1000));
    countdown.textContent = `激活剩余时间：${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (!seconds) {
      clearInterval(expiryTimer);
      clear();
      render('expired', '这个试用码的激活窗口已过期，请重新生成。');
    }
  }

  function showGenerated() {
    clearInterval(expiryTimer);
    code.textContent = record.licenseKey;
    card.querySelector('.trial-expiry').textContent = `请于 ${new Date(record.expiresAt).toLocaleString('zh-CN', { hour12: false })} 前激活`;
    render('generated', '试用码已生成，请在倒计时结束前完成激活。');
    tick();
    if (card.dataset.state === 'generated') expiryTimer = setInterval(tick, 1000);
  }

  async function claim() {
    if (busy) return;
    busy = true;
    clearInterval(expiryTimer);
    render('loading', '正在生成试用码，请稍候…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        cache: 'no-store', signal: controller.signal,
        body: JSON.stringify({ appId })
      });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('服务器响应异常，请稍后重试'); }
      if (!response.ok) {
        if (response.status === 429 && data.error === 'trial_ip_rate') throw new Error('生成太频繁，请稍后再试');
        if (response.status === 429 && data.error === 'trial_hourly_cap') throw new Error('服务繁忙，请稍后再试');
        throw new Error(typeof data.message === 'string' ? data.message : `生成失败（HTTP ${response.status}），请稍后重试`);
      }
      const expires = Date.parse(data.expiresAt);
      if (typeof data.licenseKey !== 'string' || !data.licenseKey || !Number.isFinite(expires)) {
        throw new Error('服务器返回的试用信息不完整，请稍后重试');
      }
      record = { licenseKey: data.licenseKey, expiresAt: data.expiresAt };
      write();
      showGenerated();
    } catch (error) {
      const message = error.name === 'AbortError' ? '连接服务器超时，请稍后重试' : error instanceof TypeError ? '连不上服务器，请检查网络后重试' : error.message;
      render('error', message || '生成失败，请稍后重试');
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }

  copyButton.addEventListener('click', async () => {
    if (card.dataset.state !== 'generated') return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      status.textContent = '已复制试用码。';
    } catch (_) {
      code.focus();
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent = '已选中试用码，请手动复制。';
    }
  });
  claimButton.addEventListener('click', claim);
  render('unclaimed', '准备好 App 后再生成，让 3 天试用从激活时开始。');
  if (record && typeof record.licenseKey === 'string' && record.licenseKey && Date.parse(record.expiresAt) > Date.now()) {
    showGenerated();
  } else {
    record = null;
    clear();
  }
})();
