/* eslint-disable no-alert */

const qs = new URLSearchParams(location.search);
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// Only these go into the URL (no api key!)
const URL_CFG_KEYS = ['scid','siteid','gmaid','env','leadtype','dryrun'];

const DEFAULTS = {
  scid: "3871830",
  siteid: "427e4e5f-5317-42d8-825c-765b49e43028",
  gmaid: "USA_172716",
  env: "qa",
  leadtype: "web",
  dryrun: "1",
  apiKey: ""  // local-only
};

// Lead type -> event_type mapping for LIPS
const leadtypeToEventType = {
  web:     'form',
  call:    'call',
  chatbot: 'chat',
};

// ===== Helper: Capture status text =====
const setCaptureStatus = (text, cls = 'warn') => {
  const el = $('#captureStatus');
  if (!el) return;
  el.textContent = text;
  el.className = `status ${cls}`;
};

// ===== Read/write config from UI =====
const getCfg = () => ({
  scid: $('#cfg-scid')?.value.trim() || '',
  siteid: $('#cfg-siteid')?.value.trim(),
  gmaid: $('#cfg-gmaid')?.value.trim(),
  env: $('#cfg-env')?.value,
  leadtype: document.querySelector('[data-leadtype][aria-pressed="true"]')?.dataset.leadtype || 'web',
  dryrun: $('#dryRun')?.checked ? '1' : '0',
  apiKey: $('#cfg-apikey')?.value.trim() || ''
});

const applyCfgToURL = cfg => {
  const newQs = new URLSearchParams(location.search);
  URL_CFG_KEYS.forEach(k => {
    if (cfg[k] !== undefined && cfg[k] !== null) {
      newQs.set(k, cfg[k]);
    }
  });
  history.replaceState({}, "", `${location.pathname}?${newQs.toString()}`);
};

// ===== Hydrate from query string =====
const hydrateFormFromQS = () => {
  const cfg = { ...DEFAULTS };
  URL_CFG_KEYS.forEach(k => {
    if (qs.get(k)) cfg[k] = qs.get(k);
  });

  $('#cfg-scid').value   = cfg.scid;
  $('#cfg-siteid').value = cfg.siteid;
  $('#cfg-gmaid').value  = cfg.gmaid;
  $('#cfg-env').value    = cfg.env;
  $('#dryRun').checked   = cfg.dryrun === '1';

  $$('.seg .btn[data-leadtype]').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.leadtype === cfg.leadtype ? 'true' : 'false');
  });

  applyCfgToURL(cfg);
};

// ===== Mirror hidden XHR form fields =====
const wireMirrors = () => {
  const pairs = [
    ['#email', '#xhr_form_email'],
    ['#phone', '#xhr_form_phone'],
  ];
  pairs.forEach(([srcSel, dstSel]) => {
    const src = $(srcSel);
    const dst = $(dstSel);
    if (!src || !dst) return;
    src.addEventListener('input', () => { dst.value = src.value; });
  });
};

// ===== Build payload for dry-run logging =====
const buildPayload = () => {
  const cfg = getCfg();
  return {
    meta: { ...cfg, ts: new Date().toISOString() },
    lead: {
      first_name: $('#first_name').value.trim(),
      last_name: $('#last_name').value.trim(),
      email: $('#email').value.trim(),
      phone: $('#phone').value.trim(),
      address1: $('#address1').value.trim(),
      address2: $('#address2').value.trim(),
      city: $('#city').value.trim(),
      state: $('#state').value.trim(),
      postal_code: $('#postal_code').value.trim(),
      notes: $('#notes').value.trim(),
      channel: cfg.leadtype,
    }
  };
};

const validateLead = payload => {
  const hasEmail = !!payload.lead.email;
  const hasPhone = !!payload.lead.phone;
  if (!hasEmail && !hasPhone) {
    alert("Please provide at least an Email OR a Phone number.");
    return false;
  }
  return true;
};

// ===== Capture init / reinit =====
const reinitCapture = async () => {
  const cfg = getCfg();
  applyCfgToURL(cfg);

  try {
    if (window.Capture && typeof window.Capture.init === 'function') {
      await window.Capture.init({ scid: cfg.scid, siteid: cfg.siteid, gmaid: cfg.gmaid, env: cfg.env });
      setCaptureStatus("Capture initialized", "ok");
    } else if (window.Capture && typeof window.Capture.reinitialize === 'function') {
      await window.Capture.reinitialize({ scid: cfg.scid, siteid: cfg.siteid, gmaid: cfg.gmaid, env: cfg.env });
      setCaptureStatus("Capture reinitialized", "ok");
    } else if (window.rl_siteid) {
      setCaptureStatus("Capture script loaded", "ok");
    } else {
      setCaptureStatus("Capture SDK not found — dry-run mode", "warn");
    }
  } catch (e) {
    console.error("Capture init error", e);
    setCaptureStatus("Capture init failed — check console", "err");
  }
};

// ===== Submit handler =====
const submitLead = async evt => {
  evt.preventDefault();
  window.setStatusBadge('pending', 'Submitting…', 'Sending payload to Capture');

  const cfg = getCfg();

  // HARD STOP for prod for now
  if ((cfg.env || '').toLowerCase() === 'prod') {
    window.setStatusBadge('err', 'Blocked', 'Prod submissions are disabled on this test page');
    alert('Submission blocked.\n\nThis page only allows QA/Stage. Set environment to "qa" or "stage".');
    return;
  }

  const first = $('#first_name').value.trim();
  const last  = $('#last_name').value.trim();
  const email = $('#email').value.trim();
  const phone = $('#phone').value.trim();
  const eventType = leadtypeToEventType[cfg.leadtype] || 'form';

  if (cfg.dryrun === '1') {
    const demo = buildPayload();
    demo.meta.event_type = eventType;
    window.setStatusBadge('ok', 'Dry-run only', 'Payload logged; no network request made');
    (window.__dbglog || console.log)('[dry-run payload]', demo);
    return;
  }

  if (!email && !phone) {
    alert("Please provide at least an Email OR a Phone number.");
    return;
  }

  const postbody = new URLSearchParams({
    company___required: "",
    address1___required: $('#address1').value.trim(),
    email___required: email,
    first_name___required: first,
    title___required: "",
    last_name___required: last,
    phone___required: phone,
    phone_work___required: "",
    phone_mobile___required: "",
    phone_home___required: "",
    address_2: $('#address2').value.trim(),
    city___required: $('#city').value.trim(),
    state: $('#state').value.trim(),
    country: "",
    postal___required: $('#postal_code').value.trim(),
    message: $('#notes').value.trim(),
    campaign_id: "",
    campaign_name: "",
    submit_button: "SUBMIT",
    event_type: eventType,
    lead_type:  cfg.leadtype,
  }).toString();

  const captureVersion = "4fed22fa9901d7d6a11e2f92f6fb1bbd593dd039";
  const nowHref = location.href;
  const ref = document.referrer || nowHref;

  const payload = {
    global_master_advertiser_id: cfg.gmaid || "USA_172716",
    page_name: "",
    fname: nowHref,
    referrer: ref,
    capture_version: captureVersion,
    utm_data: "",
    ecid: "",
    ohid: "",
    scid: cfg.scid,
    tc: "",
    kw: "",
    pub_cr_id: "",
    campaign_id: "",
    master_campaign_id: "",
    referrer_source: "DIRECT",
    vendor_transaction_id: "",
    id_creative_resource: "",
    visitor_id: (window.Capture && window.Capture.getVisitorId && window.Capture.getVisitorId()) || "",
    visit_id: (window.Capture && window.Capture.getVisitId && window.Capture.getVisitId()) || "",
    referrer_type: "DIRECT",
    formUri: nowHref,
    postbody,
    hidden_fields: "campaign_id,campaign_name,submit_button",
    rl_eid: "trackPost-" + Math.random().toString(36).slice(2, 10),
    version: captureVersion,
    event_type_hint: eventType
  };

  const host = `${cfg.siteid}.qa15.rlets.com`;
  const url = `https://${host}/api/v1/posts`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      window.setStatusBadge('ok', 'Success', 'Capture accepted the lead (HTTP ' + res.status + ')');
      rememberPresets();
    } else {
      window.setStatusBadge('err', 'Failed', 'See console for details');
      const text = await res.text().catch(() => "");
      console.error("Capture submit non-OK", res.status, text);
      alert(`Submit returned ${res.status} — check console for details.`);
    }
  } catch (e) {
    console.error("Capture submit failed", e);
    alert("Submit failed — check console for details.");
    window.setStatusBadge('err', 'Failed', 'Network or JS error — see console');
  }
};

// ===== Demo autofill =====
const fillDemo = () => {
  $('#first_name').value = "Casey";
  $('#last_name').value = "Tester";
  $('#email').value = "casey.tester@example.com";
  $('#phone').value = "555-867-5309";
  $('#address1').value = "123 Demo Street";
  $('#address2').value = "Apt 4B";
  $('#city').value = "Phoenix";
  $('#state').value = "AZ";
  $('#postal_code').value = "85001";
  $('#notes').value = "QA demo lead for LIPS ingestion.";
  $('#xhr_form_email').value = $('#email').value;
  $('#xhr_form_phone').value = $('#phone').value;
};

// ===== Lead type buttons =====
const wireLeadTypeToggles = () => {
  $$('.seg .btn[data-leadtype]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.seg .btn[data-leadtype]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      applyCfgToURL(getCfg());
    });
  });
};

// ===== Combo-box presets (GMAID, siteid, apiKey) =====
const SEED_PRESETS = {
  gmaid:  ['USA_172716','USA_636409'],
  siteid: ['427e4e5f-5317-42d8-825c-765b49e43028','8a0749e8-18f1-47b1-86df-64660c07e822'],
  apikey: []
};

const PRESET_KEYS = {
  gmaid:  'presets:gmaid',
  siteid: 'presets:siteid',
  apikey: 'presets:apikey'
};

const loadPresets = (key, seed = []) => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const all = [...seed, ...saved];
    return Array.from(new Set(all));
  } catch {
    return seed;
  }
};

const savePreset = (key, value) => {
  const v = (value || '').trim();
  if (!v) return;
  const cur = loadPresets(key);
  if (!cur.includes(v)) {
    cur.unshift(v);
    try { localStorage.setItem(key, JSON.stringify(cur.slice(0, 20))); } catch {}
  }
};

const rememberPresets = () => {
  const cfg = getCfg();
  savePreset(PRESET_KEYS.gmaid,  cfg.gmaid);
  savePreset(PRESET_KEYS.siteid, cfg.siteid);
  savePreset(PRESET_KEYS.apikey, cfg.apiKey);
};

const closeAllCombos = exceptEl => {
  document.querySelectorAll('.combo-list').forEach(ul => {
    if (!exceptEl || ul !== exceptEl) ul.hidden = true;
  });
};

const buildCombo = (root, initialPresets) => {
  const input = root.querySelector('.combo-input');
  const btn   = root.querySelector('.combo-btn');
  const list  = root.querySelector('.combo-list');
  const key   = root.getAttribute('data-key'); // 'gmaid' | 'siteid' | 'apikey'
  let presets = initialPresets.slice();

  const render = (filter = '') => {
    list.innerHTML = '';
    const f = filter.trim().toLowerCase();
    const items = presets.filter(p => !f || p.toLowerCase().includes(f));
    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'combo-item';
      li.textContent = 'No matches';
      li.setAttribute('aria-disabled','true');
      li.setAttribute('role','option');
      list.appendChild(li);
      return;
    }
    items.forEach((preset, i) => {
      const li = document.createElement('li');
      li.className = 'combo-item';
      li.textContent = preset;
      li.tabIndex = -1;
      li.setAttribute('role','option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      li.addEventListener('click', () => {
        input.value = preset;
        list.hidden = true;
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('change'));
        input.focus();
      });
      list.appendChild(li);
    });
  };

  const open = () => {
    presets = loadPresets(PRESET_KEYS[key], SEED_PRESETS[key] || []);
    render('');
    closeAllCombos(list);
    list.hidden = false;
  };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (list.hidden) open(); else list.hidden = true;
  });

  input.addEventListener('input', () => {
    render(input.value);
    // Do NOT put apiKey into URL
    if (key !== 'apikey') {
      applyCfgToURL(getCfg());
    }
  });

  input.addEventListener('focus', open);

  input.addEventListener('keydown', e => {
    if (list.hidden) return;
    const items = Array.from(list.querySelectorAll('.combo-item:not([aria-disabled])'));
    const idx = items.findIndex(li => li.getAttribute('aria-selected') === 'true');

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = e.key === 'ArrowDown'
        ? Math.min(idx + 1, items.length - 1)
        : Math.max(idx - 1, 0);
      items.forEach(li => li.setAttribute('aria-selected','false'));
      items[nextIndex].setAttribute('aria-selected','true');
      items[nextIndex].scrollIntoView({block:'nearest'});
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const cur = items[idx] || items[0];
      if (cur) cur.click();
      if (e.key === 'Enter') e.preventDefault();
    } else if (e.key === 'Escape') {
      list.hidden = true;
    }
  });

  document.addEventListener('click', () => { list.hidden = true; }, { passive: true });

  render('');
};

const initCombos = () => {
  const combos = document.querySelectorAll('.combo');
  combos.forEach(root => {
    const key = root.getAttribute('data-key');
    if (!key) return;
    const presets = loadPresets(PRESET_KEYS[key], SEED_PRESETS[key] || []);
    buildCombo(root, presets);
  });

  $('#applyCfgBtn')?.addEventListener('click', rememberPresets);
};

// ===== NEW: GMAID lookup → SCID dropdown =====

let lastSites = []; // cache sites for current GMAID

const apiBaseForEnv = env => {
  const e = (env || 'stage').toLowerCase();

  // QA + Stage share the same host
  if (e === 'qa' || e === 'stage') {
    return 'https://api-stage.gcion.com/apgb2b-reachcodeandproxy';
  }

  if (e === 'prod') {
    return 'https://api.gcion.com/apgb2b-reachcodeandproxy';
  }

  return 'https://api-stage.gcion.com/apgb2b-reachcodeandproxy';
};


/**
 * Fetch sites by GMAID and populate the SCID <select>.
 * NOTE: header name x-api-key / base URLs may need tweaking to match real API.
 */
const lookupGmaidAndPopulateScids = async () => {
  const { gmaid, env, apiKey } = getCfg();
  const scidSelect = $('#cfg-scid');

  if (!gmaid) {
    scidSelect.innerHTML = '<option value="">– enter GMAID first –</option>';
    lastSites = [];
    return;
  }

  if (!apiKey) {
    alert('Please enter an API key before looking up GMAID.');
    return;
  }

  const base = apiBaseForEnv(env);
  const url = `${base}/sites?global_master_advertiser_id=${encodeURIComponent(gmaid)}`;

  setCaptureStatus('Looking up sites for GMAID…', 'warn');

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey    // <-- adjust if your API uses a different header name
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('GMAID lookup failed', res.status, text);
      alert(`GMAID lookup failed with status ${res.status}. See console for details.`);
      setCaptureStatus('GMAID lookup failed', 'err');
      return;
    }

    const data = await res.json();
    lastSites = Array.isArray(data) ? data : [];

    scidSelect.innerHTML = '';

    if (!lastSites.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No sites found for this GMAID';
      scidSelect.appendChild(opt);
      setCaptureStatus('No sites found for this GMAID', 'warn');
      return;
    }

    // Build options: use id as SCID, show id + URL
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '– select SCID –';
    scidSelect.appendChild(placeholder);

    lastSites.forEach(site => {
      const opt = document.createElement('option');
      opt.value = site.id;
      opt.textContent = `${site.id} — ${site.url || 'no URL'}`;
      scidSelect.appendChild(opt);
    });

    setCaptureStatus(`Loaded ${lastSites.length} site(s) for GMAID`, 'ok');

  } catch (err) {
    console.error('GMAID lookup error', err);
    alert('GMAID lookup failed — check console for details.');
    setCaptureStatus('GMAID lookup error', 'err');
  }
};

// When SCID changes, auto-fill siteid from capture_code_uuid
const wireScidChangeToSiteid = () => {
  const scidSelect = $('#cfg-scid');
  if (!scidSelect) return;

  scidSelect.addEventListener('change', () => {
    const scid = scidSelect.value;
    const site = lastSites.find(s => String(s.id) === String(scid));
    if (site && site.capture_code_uuid && $('#cfg-siteid')) {
      $('#cfg-siteid').value = site.capture_code_uuid;
    }
    applyCfgToURL(getCfg());
  });
};

// ===== Tooltips (same as before, but slimmer) =====
const initTooltips = () => {
  const tips = [
    ['#applyCfgBtn', 'Update the page URL with current config and re-initialize Capture. Does NOT submit a lead.'],
    ['#resetCfgBtn', 'Reload the page with default config (clears the form).'],
    ['#cfg-scid', 'SCID (campaign/site ID) loaded from the selected GMAID.'],
    ['#cfg-siteid', 'Site identifier (rl_siteid) recognized by Capture.'],
    ['#cfg-gmaid', 'GMAID mapping used for routing (pick a test account).'],
    ['#cfg-env', 'Target backend environment: qa, stage, or prod.'],
    ['#cfg-apikey', 'API key used for GCION REST calls. Stored in this browser only, never in the URL.'],
    ['#dryRun', 'When ON, no lead is created—payload only logs in the console.'],
    ['.seg .btn[data-leadtype="web"]', 'Send as a Web Form lead.'],
    ['.seg .btn[data-leadtype="call"]', 'Send as a Call lead.'],
    ['.seg .btn[data-leadtype="chatbot"]', 'Send as a Chatbot lead.'],
    ['#fillDemo', 'Autofill the form with demo values (no submit).'],
    ['#leadForm .btn.primary', 'Validate and submit the lead (respects Dry-run setting).'],
    ['#dbgCollapse', 'Collapse (shrink) the network console.'],
    ['#dbgExpand', 'Expand the network console.'],
    ['#dbgCopy', 'Copy the console output to your clipboard.'],
    ['#dbgClear', 'Clear the console output.'],
    ['#dbgHide', 'Hide the network console. Use the backtick (`) key to show it again.'],
    ['#dbgToggle', 'Show the network console.']
  ];

  tips.forEach(([sel, title]) => {
    document.querySelectorAll(sel).forEach(el => {
      el.setAttribute('title', title);
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', title);
    });
  });
};

// ===== Wire everything up =====
const init = () => {
  hydrateFormFromQS();
  wireMirrors();
  wireLeadTypeToggles();
  initCombos();
  wireScidChangeToSiteid();
  initTooltips();

  $('#leadForm')?.addEventListener('submit', submitLead);
  $('#fillDemo')?.addEventListener('click', fillDemo);
  $('#applyCfgBtn')?.addEventListener('click', reinitCapture);

  $('#resetCfgBtn')?.addEventListener('click', () => {
    URL_CFG_KEYS.forEach(k => qs.set(k, DEFAULTS[k]));
    location.search = '?' + qs.toString();
  });

  $('#dryRun')?.addEventListener('change', () => {
    applyCfgToURL(getCfg());
  });

  // Trigger GMAID lookup on blur or when env changes
  $('#cfg-gmaid')?.addEventListener('blur', lookupGmaidAndPopulateScids);
  $('#cfg-env')?.addEventListener('change', () => {
    applyCfgToURL(getCfg());
    lookupGmaidAndPopulateScids();
  });

  // Initial Capture init, and optionally auto-lookup if GMAID is present
  reinitCapture();
  if ($('#cfg-gmaid')?.value) {
    lookupGmaidAndPopulateScids();
  }

  // Extra mirrors
  $('#email')?.addEventListener('input', () => $('#xhr_form_email').value = $('#email').value);
  $('#phone')?.addEventListener('input', () => $('#xhr_form_phone').value = $('#phone').value);
};

document.addEventListener('DOMContentLoaded', init);
