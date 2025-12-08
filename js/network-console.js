(function () {
  const dbg   = document.getElementById('dbg');
  const out   = document.getElementById('dbgOut');
  const btnCopy  = document.getElementById('dbgCopy');
  const btnClear = document.getElementById('dbgClear');
  const btnHide  = document.getElementById('dbgHide');
  const btnCol   = document.getElementById('dbgCollapse');
  const btnExp   = document.getElementById('dbgExpand');
  const btnToggle= document.getElementById('dbgToggle');

  const saveState = (s) => { try { localStorage.setItem('dbg.state', s); } catch {} };
  const loadState = ()   => { try { return localStorage.getItem('dbg.state') || 'open'; } catch { return 'open'; } };

  function applyState(state){
    if (!dbg) return;
    dbg.classList.remove('dbg-collapsed','dbg-hidden');
    if (state === 'hidden')   dbg.classList.add('dbg-hidden');
    if (state === 'collapsed')dbg.classList.add('dbg-collapsed');
    if (btnToggle) btnToggle.style.display = (state === 'hidden') ? 'block' : 'none';
    saveState(state);
  }

  if (btnClear) btnClear.onclick = () => { if (out) out.textContent = ''; };
  if (btnCopy) btnCopy.onclick  = async () => {
    try { await navigator.clipboard.writeText(out?.textContent || ''); alert('Console copied'); } catch {}
  };
  if (btnHide) btnHide.onclick  = () => applyState('hidden');
  if (btnCol) btnCol.onclick   = () => applyState('collapsed');
  if (btnExp) btnExp.onclick   = () => applyState('open');
  if (btnToggle) btnToggle.onclick = () => applyState('open');

  window.addEventListener('keydown', (e) => {
    if (e.key === '`' && !e.metaKey && !e.ctrlKey) {
      const cur = loadState();
      applyState(cur === 'collapsed' ? 'open' : 'collapsed');
    }
  });

  const log = (label, obj) => {
    if (!out) return;
    try {
      out.textContent += `\n${label}\n` + JSON.stringify(obj, null, 2) + '\n';
      out.scrollTop = out.scrollHeight;
    } catch(e) {
      out.textContent += `\n${label} (unserializable)\n`;
    }
  };

  // Patch fetch
  const _fetch = window.fetch;
  window.fetch = async (...args) => {
    const [input, init] = args;
    log('→ fetch request', { url: (input && input.url) || input, ...(init || {}) });
    try {
      const res = await _fetch(...args);
      const clone = res.clone();
      let bodyText = '';
      try { bodyText = await clone.text(); } catch {}
      log('← fetch response', {
        url: (input && input.url) || input,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: bodyText?.slice(0, 4000)
      });
      return res;
    } catch (e) {
      log('✖ fetch error', { url: (input && input.url) || input, error: String(e) });
      throw e;
    }
  };

  // Patch XHR
  const _xhr = window.XMLHttpRequest;
  function XHR(){
    const x = new _xhr();
    let req = { method: '', url: '', headers: {} };
    const origOpen = x.open;
    const origSend = x.send;
    const origSetHeader = x.setRequestHeader;
    x.open = function(method, url, ...rest){
      req.method = method;
      req.url = url;
      return origOpen.call(this, method, url, ...rest);
    };
    x.setRequestHeader = function(k,v){
      req.headers[k]=v;
      return origSetHeader.call(this,k,v);
    };
    x.send = function(body){
      log('→ xhr request', { ...req, body });
      this.addEventListener('loadend', function(){
        log('← xhr response', {
          url: req.url,
          status: x.status,
          response: (x.responseText||'').slice(0,4000)
        });
      });
      return origSend.call(this, body);
    };
    return x;
  }
  window.XMLHttpRequest = XHR;

  applyState(loadState());
  window.__dbglog = log;

  // ===== Status badge helper (global) =====
  let __statusHideTimer;
  window.setStatusBadge = (state, text, tooltip) => {
    const el = document.getElementById('submitStatus');
    if (!el) {
      console.warn('[status] #submitStatus not found yet');
      return;
    }

    clearTimeout(__statusHideTimer);

    const cls = ['badge', 'badge-show'];
    if (state === 'pending') cls.push('badge-pending');
    if (state === 'ok')      cls.push('badge-ok');
    if (state === 'err')     cls.push('badge-err');

    el.className = cls.join(' ');
    el.textContent = text;
    if (tooltip) el.title = tooltip;

    if (state !== 'pending') {
      __statusHideTimer = setTimeout(() => { el.classList.add('badge-hidden'); }, 6000);
    } else {
      el.classList.remove('badge-hidden');
    }
  };
})();
