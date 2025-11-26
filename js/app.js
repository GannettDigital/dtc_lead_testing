/* eslint-disable no-alert */

const qs  = new URLSearchParams(location.search);
const $   = sel => document.querySelector(sel);
const $$  = sel => Array.from(document.querySelectorAll(sel));

// Only these go into the URL (no api key!)
const URL_CFG_KEYS = ['scid','siteid','gmaid','env','leadtype','dryrun'];

const DEFAULTS = {
  scid: "3871830",
  siteid: "427e4e5f-5317-42d8-825c-765b49e43028",
  gmaid: "USA_172716",
  env: "qa",
  leadtype: "web",
  dryrun: "1",
  apiKey: ""
};

// Lead type -> event_type mapping for LIPS
const leadtypeToEventType = {
  web:     'form',
  call:    'call',
  chatbot: 'chat',
};

// Simple status text in config card
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
};

// ===== Tooltips =====
const initTooltips = () => {
  const tips = [
    ['#step1NextBtn', 'Step 1: Parse site-config (mock) and show Step 2'],
    ['#applyCfgBtn', 'Apply config & re-init Capture (optional utility)'],
    ['#resetCfgBtn', 'Reload the page with default config (clears the form).'],
    ['#cfg-scid', 'SCID (campaign/site ID).'],
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

// ========================================================================
// STEP 1 + STEP 2 FLOW (mock site-config parsing)
// ========================================================================

// ---- Mock site-config ----
const MOCK_SITE_CONFIG = {
  id: "61a53572-cd0e-4cc5-9451-66f19243563c",
  global_master_advertiser_id: "USA_172216",
  locale: "en-US",
  config: JSON.stringify({ platform: "USA" }),
  campaign_data: JSON.stringify({
    "USA_4972998": {
      marketing_policy: "true",
      master_campaign_id: "4392582",
      referrer_type: "PAID",
      scids: ["4584989","4584990"]
    },
    "USA_4914303": {
      marketing_policy: "true",
      master_campaign_id: "4963362",
      referrer_type: "PAID",
      scids: []
    }
  }),
  replacements: JSON.stringify({
    "USA_4972998": {
      email: [
        { original: "dana@dzandassociates.com", replace: "formmail" }
      ],
      phone: [
        { label: "YA2hCKfFkpAZEM6f5p8B", original: "4437701111", replace: "4433058053" }
      ],
      script: null,
      strings: null
    },
    "USA_4914303": {
      email: [
        { original: "dana@dzandassociates.com", replace: "formmail" }
      ],
      phone: [
        { original: "4437701111", replace: "4437701111" }
      ],
      script: null,
      strings: null
    }
  }),
  cvts: JSON.stringify({
    "https://devereinsulationhomeperformance.com": {
      "/thank-you/": [
        {
          campaign_id: "USA_4972998",
          cvtName: "*Get A Quote Submitted",
          cvtType: "2",
          cvtValue: "2",
          cvtid: "25148955",
          masterCampaignId: "USA_4392582",
          value: "high"
        }
      ]
    }
  })
};

// Derive segments from config objects
const deriveScidOptionsFromMock = siteConfig => {
  let parsedConfig = {};
  let campaignData = {};
  let replacements = {};
  let cvts = {};

  try { parsedConfig = JSON.parse(siteConfig.config || '{}'); } catch {}
  try { campaignData = JSON.parse(siteConfig.campaign_data || '{}'); } catch {}
  try { replacements = JSON.parse(siteConfig.replacements || '{}'); } catch {}
  try { cvts = JSON.parse(siteConfig.cvts || '{}'); } catch {}

  const campaignsWithScids = Object.entries(campaignData)
    .filter(([, c]) => Array.isArray(c.scids) && c.scids.length > 0)
    .map(([campaignId, c]) => ({
      campaignId,
      ...c
    }));

  const scidOptions = campaignsWithScids.map(camp => {
    const rep = replacements[camp.campaignId] || {};
    const phones = Array.isArray(rep.phone) ? rep.phone.slice() : [];
    const emails = Array.isArray(rep.email) ? rep.email.slice() : [];
    const strings = Array.isArray(rep.strings) ? rep.strings.slice() : [];

    return {
      campaignId: camp.campaignId,
      referrerType: camp.referrer_type,
      masterCampaignId: camp.master_campaign_id,
      scids: camp.scids || [],
      hasPhone: phones.length > 0,
      hasEmail: emails.length > 0,
      hasStrings: strings.length > 0,
      phones,
      emails,
      strings
    };
  });

  return {
    parsedConfig,
    campaignData,
    campaignsWithScids,
    scidOptions,
    cvts
  };
};

// Build list of candidate "signals" (phone/email/string) from a selected SCID row
const buildSignalsFromRow = row => {
  const signals = [];
  let idx = 0;

  // Phone signals
  (row.phones || []).forEach(p => {
    signals.push({
      id: `phone_${idx++}`,
      type: 'phone',
      campaignId: row.campaignId,
      scid: row.scid,
      masterCampaignId: row.masterCampaignId,
      referrerType: row.referrerType,
      original: p.original,
      replace: p.replace,
      label: p.label || null
    });
  });

  // Email signals
  (row.emails || []).forEach(e => {
    signals.push({
      id: `email_${idx++}`,
      type: 'email',
      campaignId: row.campaignId,
      scid: row.scid,
      masterCampaignId: row.masterCampaignId,
      referrerType: row.referrerType,
      original: e.original,
      replace: e.replace,
      label: null
    });
  });

  // String signals //TODO GSW figure out what strings/scripts are & where chatbot exists
  (row.strings || []).forEach(s => {
    signals.push({
      id: `string_${idx++}`,
      type: 'string',
      campaignId: row.campaignId,
      scid: row.scid,
      masterCampaignId: row.masterCampaignId,
      referrerType: row.referrerType,
      original: s.original,
      replace: s.replace,
      label: null
    });
  });

  return signals;
};

// Render Step 3 "Choose signal" UI from a selected SCID row
const renderStep3Card = row => {
  const body = $('#step3Body');
  const nextBtn = $('#step3NextBtn');
  if (!body || !nextBtn) return;

  const signals = buildSignalsFromRow(row);
  window.__step3Signals = signals;
  window.__step3SelectedSignalId = signals[0]?.id || null;

  if (!signals.length) {
    body.innerHTML = `
      <p class="hint">
        No phone, email, or string replacements were found for
        campaign <strong>${row.campaignId}</strong>, SCID <strong>${row.scid}</strong>.
      </p>
      <p class="hint">
        You can go back to Step 2 and choose a different SCID, or proceed later
        once more data is available.
      </p>
    `;
    nextBtn.disabled = true;
    return;
  }

  const listId = 'step3SignalList';

  body.innerHTML = `
    <p class="hint">
      Campaign <strong>${row.campaignId}</strong>, SCID <strong>${row.scid}</strong><br />
      Referrer: <strong>${row.referrerType || '—'}</strong> · Master campaign: <strong>${row.masterCampaignId || '—'}</strong>
    </p>
    <div id="${listId}" class="signal-list" role="radiogroup" aria-label="Signal choices"></div>
  `;

  const list = $(`#${listId}`);

  signals.forEach((sig, idx) => {
    const id = `signalOpt_${idx}`;
    const typeLabel =
      sig.type === 'phone' ? 'Phone lead'
        : sig.type === 'email' ? 'Email lead'
          : 'Other / string';

    const typeIcon =
      sig.type === 'phone' ? '📞'
        : sig.type === 'email' ? '✉️'
          : '🔤';

    const metaParts = [];
    metaParts.push(`${sig.type.toUpperCase()} replacement`);
    if (sig.label) metaParts.push(`label: ${sig.label}`);

    const wrapper = document.createElement('div');
    wrapper.className = 'signal-choice';

    wrapper.innerHTML = `
      <label class="signal-choice-label" for="${id}">
        <input
          type="radio"
          name="step3Signal"
          value="${sig.id}"
          id="${id}"
          ${idx === 0 ? 'checked' : ''}
          class="signal-choice-radio"
        >
        <div class="signal-choice-text">
          <div class="signal-choice-title">
            ${typeIcon} ${typeLabel}
          </div>
          <div class="signal-choice-meta">
            campaign ${sig.campaignId} · SCID ${sig.scid} · referrer ${sig.referrerType || '—'}
          </div>

          <div class="signal-type-pill">
            <span>${typeIcon}</span>
            <span>${metaParts.join(' · ')}</span>
          </div>

          <div class="signal-choice-tags">
            <span class="signal-choice-tag">
              <strong>actual</strong>&nbsp;${sig.original}
            </span>
            <span class="signal-choice-tag">
              <strong>replace</strong>&nbsp;${sig.replace}
            </span>
          </div>
        </div>
      </label>
    `;

    list.appendChild(wrapper);
  });

  // Wire radios to update selected signal id
  list.querySelectorAll('input[name="step3Signal"]').forEach(input => {
    input.addEventListener('change', () => {
      window.__step3SelectedSignalId = input.value;
    });
  });

  nextBtn.disabled = false;
};

// Render SCID options into Step 2 card
const renderStep2Card = scidOptions => {
  const step2   = $('#step2Card');
  const body    = $('#step2Body');
  const nextBtn = $('#step2NextBtn');

  if (!step2 || !body || !nextBtn) return;

  // Flatten campaigns into individual SCID rows
  const rows = [];
  scidOptions.forEach(opt => {
    (opt.scids || []).forEach(scid => {
      rows.push({
        scid,
        campaignId: opt.campaignId,
        referrerType: opt.referrerType,
        masterCampaignId: opt.masterCampaignId,
        hasPhone: opt.hasPhone,
        hasEmail: opt.hasEmail,
        hasStrings: opt.hasStrings,
        phones: opt.phones,
        emails: opt.emails,
        strings: opt.strings
      });
    });
  });

  window.__step2ScidRows = rows;

  if (!rows.length) {
    body.innerHTML = `<p class="hint">No SCIDs with replacement data were found in this config.</p>`;
    nextBtn.disabled = true;
    step2.style.display = 'block';
    return;
  }

  body.innerHTML = `
    <p class="hint">
      &nbsp;
    </p>
    <div id="step2ScidList" class="step2-list" role="radiogroup" aria-label="SCID choices"></div>`;

  const list = $('#step2ScidList');

  rows.forEach((row, idx) => {
    const id = `scidOpt_${idx}`;

    const phoneLabel = row.hasPhone
      ? `📞 ${row.phones.length} phone mapping${row.phones.length === 1 ? '' : 's'}`
      : '📞 no phone mapping';

    const emailLabel = row.hasEmail
      ? `✉️ ${row.emails.length} email mapping${row.emails.length === 1 ? '' : 's'}`
      : '✉️ no email mapping';

    const stringLabel = row.hasStrings
      ? `🔤 ${row.strings.length} string replacement${row.strings.length === 1 ? '' : 's'}`
      : '🔤 no string replacements';

    // Build replacement detail blocks
    const phoneRows = (row.phones || []).map(p => {
      const labelPart = p.label
        ? `<span class="scid-repl-label">label</span><span class="scid-repl-value">${p.label}</span> `
        : '';
      return `
        <div class="scid-repl-item">
          <span class="scid-repl-label">actual</span>
          <span class="scid-repl-value">${p.original}</span>
          &nbsp;→&nbsp;
          <span class="scid-repl-label">replace</span>
          <span class="scid-repl-value">${p.replace}</span>
          ${labelPart}
        </div>
      `;
    }).join('');

    const emailRows = (row.emails || []).map(e => `
      <div class="scid-repl-item">
        <span class="scid-repl-label">actual</span>
        <span class="scid-repl-value">${e.original}</span>
        &nbsp;→&nbsp;
        <span class="scid-repl-label">replace</span>
        <span class="scid-repl-value">${e.replace}</span>
      </div>
    `).join('');

    const stringRows = (row.strings || []).map(s => `
      <div class="scid-repl-item">
        <span class="scid-repl-label">actual</span>
        <span class="scid-repl-value">${s.original}</span>
        &nbsp;→&nbsp;
        <span class="scid-repl-label">replace</span>
        <span class="scid-repl-value">${s.replace}</span>
      </div>
    `).join('');

    const phoneBlock = row.hasPhone
      ? `
        <div class="scid-repl-group">
          <div class="scid-replacements-title">Phone replacements</div>
          ${phoneRows}
        </div>
      `
      : `
        <div class="scid-repl-group">
          <div class="scid-replacements-title">Phone replacements</div>
          <div class="scid-repl-empty">No phone replacements found for this campaign.</div>
        </div>
      `;

    const emailBlock = row.hasEmail
      ? `
        <div class="scid-repl-group">
          <div class="scid-replacements-title">Email replacements</div>
          ${emailRows}
        </div>
      `
      : `
        <div class="scid-repl-group">
          <div class="scid-replacements-title">Email replacements</div>
          <div class="scid-repl-empty">No email replacements found for this campaign.</div>
        </div>
      `;

    const stringBlock = row.hasStrings
      ? `
        <div class="scid-repl-group">
          <div class="scid-replacements-title">String replacements</div>
          ${stringRows}
        </div>
      `
      : `
        <div class="scid-repl-group">
          <div class="scid-replacements-title">String replacements</div>
          <div class="scid-repl-empty">No string replacements found for this campaign.</div>
        </div>
      `;

    const wrapper = document.createElement('div');
    wrapper.className = 'scid-choice';

    wrapper.innerHTML = `
      <label class="scid-choice-label" for="${id}">
        <input
          type="radio"
          name="step2Scid"
          value="${row.scid}"
          id="${id}"
          ${idx === 0 ? 'checked' : ''}
          class="scid-choice-radio"
        >
        <div class="scid-choice-text">
          <div class="scid-choice-title">
            SCID ${row.scid}
          </div>
          <div class="scid-choice-meta">
            ${row.referrerType || '—'} · campaign ${row.campaignId} · master ${row.masterCampaignId}
          </div>
          <div class="scid-choice-badges">
            <span class="scid-choice-badge">${phoneLabel}</span>
            <span class="scid-choice-badge">${emailLabel}</span>
            <span class="scid-choice-badge">${stringLabel}</span>
          </div>
        </div>
      </label>

      <div class="scid-choice-footer">
        <button type="button" class="scid-repl-toggle" data-repl-toggle>
          <span data-repl-label>Show replacements</span>
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      <div class="scid-replacements" data-repl-panel hidden>
        <div class="scid-replacements-title">
          Campaign: ${row.campaignId}<br />SCID: ${row.scid}
        </div>
        <div class="scid-repl-meta">
          Referrer: ${row.referrerType || '—'}<br />Master campaign: ${row.masterCampaignId || '—'}
        </div>
        ${phoneBlock}
        ${emailBlock}
        ${stringBlock}
      </div>
    `;

    list.appendChild(wrapper);

    // Wire the toggle for this row
    const toggleBtn = wrapper.querySelector('[data-repl-toggle]');
    const labelSpan = wrapper.querySelector('[data-repl-label]');
    const panel     = wrapper.querySelector('[data-repl-panel]');

    if (toggleBtn && panel && labelSpan) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = panel.hasAttribute('hidden');

        // If opening, close other panels first
        if (isHidden) {
          document.querySelectorAll('.scid-replacements[data-repl-panel]').forEach(p => {
            p.setAttribute('hidden', 'hidden');
          });
          document.querySelectorAll('.scid-repl-toggle [data-repl-label]').forEach(ls => {
            ls.textContent = 'Show replacements';
          });
        }

        if (isHidden) {
          panel.removeAttribute('hidden');
          labelSpan.textContent = 'Hide replacements';
        } else {
          panel.setAttribute('hidden', 'hidden');
          labelSpan.textContent = 'Show replacements';
        }
      });
    }
  });

  nextBtn.disabled = false;
  step2.style.display = 'block';
};

// Step 1 "Next": apply config, parse mock, log, then show Step 2
const handleStep1Next = () => {
  const cfg = getCfg();
  rememberPresets();
  applyCfgToURL(cfg);

  (window.__dbglog || console.log)('Step1: current UI config', cfg);

  const {
    parsedConfig,
    campaignData,
    campaignsWithScids,
    scidOptions,
    cvts
  } = deriveScidOptionsFromMock(MOCK_SITE_CONFIG);

  window.__mockSiteConfig         = MOCK_SITE_CONFIG;
  window.__mockCampaignData       = campaignData;
  window.__mockCampaignsWithScids = campaignsWithScids;
  window.__mockScidOptions        = scidOptions;
  window.__mockCvts               = cvts;

  (window.__dbglog || console.log)('Step1: parsed config', parsedConfig);
  (window.__dbglog || console.log)('Step1: raw campaign_data', campaignData);
  (window.__dbglog || console.log)('Step1: campaigns with SCIDs only', campaignsWithScids);
  (window.__dbglog || console.log)('Step1: derived SCID options', scidOptions);
  (window.__dbglog || console.log)('Step1: parsed cvts', cvts);

  renderStep2Card(scidOptions);
  setCaptureStatus('Step 1 complete: mock config parsed', 'ok');

  // Scroll Step 2 into view
  $('#step2Card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Step 2 "Back"
const handleStep2Back = () => {
  const step2 = $('#step2Card');
  if (step2) {
    step2.style.display = 'none';
  }
  $('#configCard')?.scrollIntoView({ behavior: 'smooth' });
};

// Step 2 "Next": log selected SCID row and show Step 3
const handleStep2Next = () => {
  const selected = document.querySelector('input[name="step2Scid"]:checked');
  if (!selected) {
    alert('Please select an SCID option.');
    return;
  }

  const scidValue = selected.value;
  const rows = window.__step2ScidRows || [];
  const row = rows.find(r => String(r.scid) === String(scidValue));

  (window.__dbglog || console.log)(
    'Step2: selected SCID row',
    row || { scid: scidValue, note: 'not found in rows' }
  );

  if (!row) {
    alert('Could not find the selected SCID details. Please try again.');
    return;
  }

  // Persist the chosen SCID row for later steps
  window.__step2SelectedRow = row;

  // Build & show Step 3 UI
  renderStep3Card(row);

  // Move user to Step 3 in the flow
  const step2 = $('#step2Card');
  const step3 = $('#step3Card');
  if (step2 && step3) {
    step2.style.display = 'none';
    step3.style.display = 'block';
    step3.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setCaptureStatus('Step 2 complete: SCID selected', 'ok');
};

// Step 3 "Back": return to Step 2, keep selection
const handleStep3Back = () => {
  const step2 = $('#step2Card');
  const step3 = $('#step3Card');
  if (step2 && step3) {
    step3.style.display = 'none';
    step2.style.display = 'block';
    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Step 3 "Next": for now, just log the chosen signal (placeholder for visit/event)
const handleStep3Next = () => {
  const signals = window.__step3Signals || [];
  const selectedId = window.__step3SelectedSignalId;
  const signal = signals.find(s => s.id === selectedId);

  if (!signal) {
    alert('Please choose which signal you want to send.');
    return;
  }

  (window.__dbglog || console.log)(
    'Step3: selected signal',
    signal
  );

  alert(
    'Step 3 selection captured.\n\n' +
    'Check the Network Console for the "Step3: selected signal" entry.\n' +
    'Next step is wiring this into visit + event APIs.'
  );

  setCaptureStatus('Step 3 complete: signal selected', 'ok');
};

// ========================================================================
// ORIGINAL GMAID → SCID LOOKUP (kept, but not used right now)
// ========================================================================

/*
let lastSites = []; // cache sites for current GMAID

const apiBaseForEnv = env => {
  const e = (env || 'stage').toLowerCase();

  if (e === 'qa' || e === 'stage') {
    return 'https://api-stage.gcion.com/apgb2b-reachcodeandproxy';
  }

  if (e === 'prod') {
    return 'https://api.gcion.com/apgb2b-reachcodeandproxy';
  }

  return 'https://api-stage.gcion.com/apgb2b-reachcodeandproxy';
};

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
        'x-api-key': apiKey
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
*/

// ========================================================================
// INIT
// ========================================================================
const init = () => {
  hydrateFormFromQS();
  wireMirrors();
  wireLeadTypeToggles();
  initCombos();
  initTooltips();

  $('#leadForm')?.addEventListener('submit', submitLead);
  $('#fillDemo')?.addEventListener('click', fillDemo);

  // Step 1: dedicated Next button
  $('#step1NextBtn')?.addEventListener('click', handleStep1Next);

  // Keep Apply as "re-init Capture with current config" // TODO GSW  obsolete??
  $('#applyCfgBtn')?.addEventListener('click', () => {
    rememberPresets();
    reinitCapture();
  });

  $('#resetCfgBtn')?.addEventListener('click', () => {
    URL_CFG_KEYS.forEach(k => qs.set(k, DEFAULTS[k]));
    location.search = '?' + qs.toString();
  });

  $('#dryRun')?.addEventListener('change', () => {
    applyCfgToURL(getCfg());
  });

  // Step 2 buttons
  $('#step2BackBtn')?.addEventListener('click', handleStep2Back);
  $('#step2NextBtn')?.addEventListener('click', handleStep2Next);

  // Step 3 buttons
  $('#step3BackBtn')?.addEventListener('click', handleStep3Back);
  $('#step3NextBtn')?.addEventListener('click', handleStep3Next);

  reinitCapture();

  $('#email')?.addEventListener('input', () => $('#xhr_form_email').value = $('#email').value);
  $('#phone')?.addEventListener('input', () => $('#xhr_form_phone').value = $('#phone').value);
};

document.addEventListener('DOMContentLoaded', init);
