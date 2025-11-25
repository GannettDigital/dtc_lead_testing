(function () {
  const qs = new URLSearchParams(location.search);
  const DEFAULTS = {
    siteid: "427e4e5f-5317-42d8-825c-765b49e43028",
    scid: "3871830",
    gmaid: "USA_172716",
    e: "qa"
  };
  const cfg = {
    siteid: qs.get("siteid") || DEFAULTS.siteid,
    scid:   qs.get("scid")   || DEFAULTS.scid,
    gmaid:  qs.get("gmaid")  || DEFAULTS.gmaid,
    e:      (qs.get("e") || DEFAULTS.e).toLowerCase()
  };

  // Legacy Capture globals
  window.rl_siteid = cfg.siteid;
  window.rl_scid   = cfg.scid;
  window.rl_gmaid  = cfg.gmaid;

  const s = document.createElement("script");
  const host = (cfg.e === "qa" || cfg.e === "stage") ? "cdn-qa.rlets.com" : "cdn.rlets.com";
  s.src = "https://" + host + "/capture_static/mms/mms.js?e=" + (cfg.e || "QA").toUpperCase();
  s.async = true;
  s.onload = () => console.log("[Capture SDK] loaded:", s.src);
  s.onerror = () => console.warn("[Capture SDK] failed to load:", s.src);
  document.head.appendChild(s);

  window.__captureBootstrap = { cfg, sdkSrc: s.src };
  console.log("[Capture bootstrap]", window.__captureBootstrap);
})();
