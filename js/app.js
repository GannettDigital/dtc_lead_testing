/* ========= PRESETS ========= */
const PRESETS = {
  // ============================
  // GMAID 1 – USA_172216 (DeVere)
  // ============================

  deverePaid: {
    key: 'deverePaid',
    channel: 'Paid',
    name: 'DeVere Insulation',
    label: 'Paid Lead – DeVere Insulation',
    gmaid: 'USA_172216',
    siteid: '61a53572-cd0e-4cc5-9451-66f19243563c', // capture_code_uuid
    scid: '4584989', // picked first paid SCID
    campaignId: 'USA_4972998',
    masterCampaignId: '4392582',
    defaultReferrerType: 'PAID'
  },

  devereOrganic: {
    key: 'devereOrganic',
    channel: 'Organic',
    name: 'DeVere Insulation (Organic)',
    label: 'Organic Lead – DeVere Insulation',
    gmaid: 'USA_172216',
    siteid: '61a53572-cd0e-4cc5-9451-66f19243563c',
    // fabricate organic by reusing a stable scid
    scid: '4584990',
    campaignId: 'USA_4972998',
    masterCampaignId: '4392582',
    defaultReferrerType: 'ORGANIC'
  },

  // ==================================
  // GMAID 2 – USA_336031 (SiblingTest)
  // ==================================

  siblingPaid: {
    key: 'siblingPaid',
    channel: 'Paid',
    name: 'SiblingTestProd111',
    label: 'Paid Lead – SiblingTestProd111',
    gmaid: 'USA_336031',
    siteid: 'fef441b5-eb77-4131-a21e-52d061bb8a4f',
    scid: '4135926', // strongest paid SCID (also WPCID)
    campaignId: 'USA_3599373',
    masterCampaignId: '3599373',
    defaultReferrerType: 'PAID'
  },

  siblingOrganic: {
    key: 'siblingOrganic',
    channel: 'Organic',
    name: 'SiblingTestProd111 (Organic)',
    label: 'Organic Lead – SiblingTestProd111',
    gmaid: 'USA_336031',
    siteid: 'fef441b5-eb77-4131-a21e-52d061bb8a4f',
    // fabricate organic: pick stable scid from 3599371 list
    scid: '4135920',
    campaignId: 'USA_3599371',
    masterCampaignId: '3599371',
    defaultReferrerType: 'ORGANIC'
  }
};

/* ========= SMALL HELPERS ========= */

const qs  = new URLSearchParams(location.search);
const $   = sel => document.querySelector(sel);
const $$  = sel => Array.from(document.querySelectorAll(sel));
const dbglog = (...args) => (window.__dbglog || console.log)(...args);

// Single source of truth for the selected preset
let currentPresetKey = 'deverePaid';

/**
 * Simple tc generator (unix timestamp + 5 random digits)
 */
function generateTc () {
  const unixts = Math.floor(Date.now() / 1000).toString();
  const randig = () => Math.floor(Math.random() * 10).toString();
  return unixts + randig() + randig() + randig() + randig() + randig();
}

/**
 * Read config from UI (env, dryrun, selected preset) and
 * merge with the preset’s static values.
 *
 * IMPORTANT: preset selection comes from currentPresetKey, not the URL.
 */
function getCfg () {
  const envSel   = $('#cfg-env');
  const dryRunEl = $('#dryRun');

  const env = (envSel && envSel.value) || 'qa';

  let dryrun;
  if (dryRunEl) {
    dryrun = dryRunEl.checked ? '1' : '0';
  } else {
    // fallback if checkbox is missing
    dryrun = '1';
  }

  const presetKey = (currentPresetKey && PRESETS[currentPresetKey])
    ? currentPresetKey
    : 'deverePaid';

  const preset = PRESETS[presetKey] || PRESETS.deverePaid;

  return {
    env,
    dryrun,
    presetKey,
    ...preset
  };
}

/**
 * Keep env + preset + dryrun in the URL so you can share links.
 * Source of truth is cfg (which came from UI/currentPresetKey).
 */
function applyCfgToURL (cfg) {
  const params = new URLSearchParams(location.search);

  // Core
  params.set('env', (cfg.env || 'qa').toLowerCase());
  params.set('preset', cfg.presetKey || 'deverePaid');
  params.set('dryrun', cfg.dryrun || '1');

  // Keep Capture-style params in sync, but *do not* read from them
  params.set('scid', cfg.scid);
  params.set('siteid', cfg.siteid);
  params.set('gmaid', cfg.gmaid);
  params.set('e', (cfg.env || 'qa').toLowerCase());

  // Kill legacy stuff we no longer use
  params.delete('leadtype');

  history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
}

/**
 * When a preset is selected, populate the readonly config fields
 * (gmaid, scid, siteid) so you can see which IDs are in use.
 */
function renderPresetDetail (presetKey) {
  const preset = PRESETS[presetKey] || PRESETS.deverePaid;
  const metaEl = $('#presetMeta');
  const detailEl = $('#presetDetailBody');

  if (metaEl) {
    metaEl.textContent = `Using ${preset.key} preset (${preset.gmaid} – ${preset.name}, ${preset.channel})`;
  }

  if (!detailEl) return;

  detailEl.innerHTML = `
    <div class="kv">
      <span class="kv-label">GMAID</span>
      <span class="kv-value">${preset.gmaid}</span>
    </div>
    <div class="kv">
      <span class="kv-label">Site ID</span>
      <span class="kv-value">${preset.siteid}</span>
    </div>
    <div class="kv">
      <span class="kv-label">SCID</span>
      <span class="kv-value">${preset.scid}</span>
    </div>
    <div class="kv">
      <span class="kv-label">Campaign ID</span>
      <span class="kv-value">${preset.campaignId || '—'}</span>
    </div>
    <div class="kv">
      <span class="kv-label">Master Campaign ID</span>
      <span class="kv-value">${preset.masterCampaignId || '—'}</span>
    </div>
    <div class="kv">
      <span class="kv-label">Referrer type</span>
      <span class="kv-value">${preset.defaultReferrerType || 'DIRECT'}</span>
    </div>
  `;
}

function applyPresetToUI (presetKey) {
  const key = PRESETS[presetKey] ? presetKey : 'deverePaid';

  // Update global preset state
  currentPresetKey = key;

  // Update pill states
  $$('.preset-btn').forEach(btn => {
    const isActive = btn.dataset.preset === key;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  // Update detail panel
  renderPresetDetail(key);
}

/**
 * Hydrate UI from query string: we ONLY use it to choose the *initial*
 * preset/env/dryrun. After that, UI + currentPresetKey are the source of truth.
 */
function hydrateFormFromQS () {
  const initialEnv   = qs.get('env')    || 'qa';
  const initialDry   = qs.get('dryrun') || '1';
  const initialKeyQS = qs.get('preset') || 'deverePaid';

  const initialPresetKey = PRESETS[initialKeyQS] ? initialKeyQS : 'deverePaid';

  currentPresetKey = initialPresetKey;
  applyPresetToUI(initialPresetKey);

  if ($('#cfg-env')) {
    $('#cfg-env').value = initialEnv;
  }
  if ($('#dryRun')) {
    $('#dryRun').checked = initialDry === '1';
  }

  const fullCfg = getCfg();
  applyCfgToURL(fullCfg);
}

/* ========= LEAD PAYLOAD BUILDING ========= */

function buildLeadPayload () {
  return {
    first_name: $('#first_name').value.trim(),
    last_name: $('#last_name').value.trim(),
    email: $('#email').value.trim(),
    phone: $('#phone').value.trim(),
    address1: $('#address1').value.trim(),
    address2: $('#address2').value.trim(),
    city: $('#city').value.trim(),
    state: $('#state').value.trim(),
    postal_code: $('#postal_code').value.trim(),
    notes: $('#notes').value.trim()
  };
}

function validateLead (lead) {
  const hasEmail = !!lead.email;
  const hasPhone = !!lead.phone;
  if (!hasEmail && !hasPhone) {
    alert('Please provide at least an Email OR a Phone number.');
    return false;
  }
  return true;
}

/* ========= VISIT PAYLOAD / API ========= */

function buildVisitPayload (cfg) {
  const visit_id   = crypto.randomUUID();
  const visitor_id = crypto.randomUUID();
  const tc         = generateTc();
  const rl_eid     = 'trackVisit-' + Math.random().toString(36).slice(2, 9);

  const payload = {
    visit_id,
    visitor_id,
    rl_eid,
    referrer_type: cfg.defaultReferrerType || 'DIRECT',
    visit_in_progress: false,

    global_master_advertiser_id: cfg.gmaid,
    page_name: '',
    fname: location.href,
    referrer: document.referrer || '',
    capture_version: 'LIPS_INTERIM_TEST',

    utm_data: '',
    ecid: '',
    ohid: '',

    scid: cfg.scid,
    tc,

    kw: '',
    pub_cr_id: '',

    campaign_id: cfg.campaignId || '',
    master_campaign_id: cfg.masterCampaignId || '',

    referrer_source: cfg.defaultReferrerType || 'DIRECT',

    vendor_transaction_id: '',
    id_creative_resource: ''
  };

  return { visit_id, visitor_id, tc, payload };
}

async function createVisit (cfg, visitPayload) {
  const host = `${cfg.siteid}.qa15.rlets.com`;
  const url  = `https://${host}/api/v1/visits`;

  dbglog('[visit-api] POST', url, visitPayload);

  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visitPayload)
  });

  const text = await res.text().catch(() => '');
  dbglog('[visit-api] response', res.status, text);

  if (!res.ok) {
    throw new Error(`Visit create failed: HTTP ${res.status}`);
  }

  return { ok: true };
}

/* ========= FORM-POST PAYLOAD / API ========= */

function buildFormPostBody (lead) {
  return new URLSearchParams({
    // Basic identity → contact_info
    firstname: lead.first_name,      // contact_info.first_name
    lastname:  lead.last_name,       // contact_info.last_name
    email:     lead.email,           // contact_info.email
    phone:     lead.phone,           // contact_info.phone_work

    // Address / contact_info
    address:   lead.address1,        // contact_info.address1
    suite:     lead.address2,        // contact_info.address2
    city:      lead.city,            // contact_info.city
    state:     lead.state,           // contact_info.state
    postal:    lead.postal_code,     // contact_info.zip
    country:   'USA',                // contact_info.country
    message:   lead.notes,

    // Hidden/technical fields
    campaign_id:   '',
    campaign_name: '',
    submit_button: 'SUBMIT',
    event_type:    'form',
    lead_type:     'form'
  }).toString();
}

function buildFormPostPayload (cfg, lead, visitMeta) {
  const postbody         = buildFormPostBody(lead);
  const captureVersion   = 'LIPS_INTERIM_TEST';
  const nowHref          = location.href;
  const ref              = document.referrer || nowHref;

  return {
    global_master_advertiser_id: cfg.gmaid,
    page_name: '',
    fname: nowHref,
    referrer: ref,
    capture_version: captureVersion,
    utm_data: '',
    ecid: '',
    ohid: '',
    scid: cfg.scid,
    tc: visitMeta.tc,
    kw: '',
    pub_cr_id: '',
    campaign_id: cfg.campaignId || '',
    master_campaign_id: cfg.masterCampaignId || '',
    referrer_type: cfg.defaultReferrerType || 'DIRECT',
    referrer_source: cfg.defaultReferrerType || 'DIRECT',
    vendor_transaction_id: '',
    id_creative_resource: '',

    visitor_id: visitMeta.visitor_id,
    visit_id: visitMeta.visit_id,

    formUri: nowHref,
    postbody,
    hidden_fields: 'campaign_id,campaign_name,submit_button',
    rl_eid: 'trackPost-' + Math.random().toString(36).slice(2, 10),
    version: captureVersion,
    event_type_hint: 'form'
  };
}

async function createFormLead (cfg, formPayload) {
  const host = `${cfg.siteid}.qa15.rlets.com`;
  const url  = `https://${host}/api/v1/posts`;

  dbglog('[form-post] POST', url, formPayload);

  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formPayload)
  });

  const text = await res.text().catch(() => '');
  dbglog('[form-post] response', res.status, text);

  if (!res.ok) {
    throw new Error(`Form post failed: HTTP ${res.status}`);
  }

  return { ok: true };
}

/* ========= SUBMIT HANDLER ========= */

async function submitLead (evt) {
  evt.preventDefault();

  const cfg  = getCfg();
  const lead = buildLeadPayload();

  if ((cfg.env || '').toLowerCase() === 'prod') {
    setStatusBadge('err', 'Blocked', 'Prod submissions are disabled on this test page');
    alert('Submission blocked.\n\nThis page only allows QA. Set environment to "qa".');
    return;
  }

  if (!validateLead(lead)) {
    setStatusBadge('err', 'Validation failed', 'Email or phone is required');
    return;
  }

  const { visit_id, visitor_id, tc, payload: visitPayload } = buildVisitPayload(cfg);
  const visitMeta = { visit_id, visitor_id, tc };

  const formPayload = buildFormPostPayload(cfg, lead, visitMeta);

  if (cfg.dryrun === '1') {
    setStatusBadge('ok', 'Dry-run only', 'Visit + Form payloads logged; no network calls');
    dbglog('[dry-run] visit payload', visitPayload);
    dbglog('[dry-run] form-post payload', formPayload);
    alert('Dry-run only.\n\nSee Network Console for visit + form-post payloads.');
    return;
  }

  try {
    setStatusBadge('pending', 'Creating visit…', 'Calling /api/v1/visits');

    await createVisit(cfg, visitPayload);

    setStatusBadge(
      'pending',
      'Visit created, posting form…',
      visit_id ? `visit_id: ${visit_id}` : 'Visit created'
    );

    await createFormLead(cfg, formPayload);

    setStatusBadge(
      'ok',
      'Form lead created',
      visit_id ? `visit_id: ${visit_id}` : 'Visit + form-post completed'
    );

    alert(
      'Form lead created via Visit + /api/v1/posts.\n\n' +
      (visit_id ? `visit_id: ${visit_id}\n\n` : '') +
      'Check Network Console for details.'
    );
  } catch (err) {
    console.error('[submitLead] error', err);
    setStatusBadge('err', 'Submit failed', 'Visit or form-post error — see console');
    alert('Lead submit failed — see console for details. Note, VPN required');
  }
}

/* ========= OTHER WIRES ========= */

function fillDemo () {
  $('#first_name').value = 'LocaliQ';
  $('#last_name').value  = 'Tester';
  $('#email').value      = 'localiq.tester@example.com';
  $('#phone').value      = '555-888-1234';
  $('#address1').value   = '123 Demo Street';
  $('#address2').value   = 'Apt 4B';
  $('#city').value       = 'Boston';
  $('#state').value      = 'MA';
  $('#postal_code').value = '02118';
  $('#notes').value      = 'QA form post lead for LIPS testing.';
  $('#xhr_form_email').value = $('#email').value;
  $('#xhr_form_phone').value = $('#phone').value;
}

function wireMirrors () {
  const pairs = [
    ['#email', '#xhr_form_email'],
    ['#phone', '#xhr_form_phone']
  ];
  pairs.forEach(([srcSel, dstSel]) => {
    const src = $(srcSel);
    const dst = $(dstSel);
    if (!src || !dst) return;
    src.addEventListener('input', () => { dst.value = src.value; });
  });
}

function wirePresetButtons () {
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset;
      applyPresetToUI(key);
      const cfg = getCfg();
      applyCfgToURL(cfg);
      dbglog('[preset-click]', cfg);
    });
  });
}

function init () {
  hydrateFormFromQS();
  wireMirrors();
  wirePresetButtons();

  // Keep URL in sync on env/dryrun change
  $('#cfg-env')?.addEventListener('change', () => applyCfgToURL(getCfg()));
  $('#dryRun')?.addEventListener('change', () => applyCfgToURL(getCfg()));

  // Lead form + demo
  $('#leadForm')?.addEventListener('submit', submitLead);
  $('#fillDemo')?.addEventListener('click', fillDemo);

  // Mirrors on initial load
  $('#email')?.addEventListener('input', () => $('#xhr_form_email').value = $('#email').value);
  $('#phone')?.addEventListener('input', () => $('#xhr_form_phone').value = $('#phone').value);
}

document.addEventListener('DOMContentLoaded', init);
