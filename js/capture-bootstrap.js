(function () {
  // Hardcoded defaults (match orangePaidA preset)
  const PRESET_DEFAULT = {
    siteid: "427e4e5f-5317-42d8-825c-765b49e43028",
    scid:   "3836844",             // from PRESETS.orangePaidA.scid
    gmaid:  "USA_172716"          // from PRESETS.orangePaidA.gmaid
  };

  const qs = new URLSearchParams(location.search);
  const env = (qs.get("env") || "qa").toLowerCase();

  const cfg = {
    siteid: PRESET_DEFAULT.siteid,
    scid:   PRESET_DEFAULT.scid,
    gmaid:  PRESET_DEFAULT.gmaid,
    e:      env
  };

  // Legacy Capture globals (if Capture still uses them)
  window.rl_siteid = cfg.siteid;
  window.rl_scid   = cfg.scid;
  window.rl_gmaid  = cfg.gmaid;

  const s = document.createElement("script");
  const host = (cfg.e === "qa" || cfg.e === "stage")
    ? "cdn-qa.rlets.com"
    : "cdn.rlets.com";

  s.src = "https://" + host + "/capture_static/mms/mms.js?e=" + (cfg.e || "QA").toUpperCase();
  s.async = true;
  s.onload = () => console.log("[Capture SDK] loaded:", s.src);
  s.onerror = () => console.warn("[Capture SDK] failed to load:", s.src);
  document.head.appendChild(s);

  window.__captureBootstrap = { cfg, sdkSrc: s.src };
  console.log("[Capture bootstrap]", window.__captureBootstrap);
})();
