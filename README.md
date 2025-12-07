# dtc_lead_testing
Lead testing pages user by the Data Connect team

## Ownership

- *Team Multi-User Chat:* https://usatnetwork-product.slack.com/messages/dms-crm_integrations
- *Confluence:* https://confluence.gannett.com/display/LIQAP/DataConnect
- *Jira:* https://jira.gannett.com/browse/DTC

## Location

The index.html page is found at https://gannettdigital.github.io/dtc_lead_testing

Github pages deploys the latest from the main branch.  To make changes live, make them in the main branch by submitting a pull request.


# LEAD FORM ONLY VERSION
This version of the site is not handling phone or chat or other types of leads, only from post leads.
This is because we have CORS issues & because there is still some unknowns with calling the event-api for the phone & chat leads
that will be much easier to figure out and iterate thru once the CORS issues are resolved

So this version has hard coded PRESETS of Gmaids & corresponding data to use

# LIPS Lead Testing Site – Presets How-To

This document explains how to:

1. Add or update **hard-coded PRESETS** in `app.js`.
2. Manually discover **site + campaign + SCID** data via `curl`.
3. Map that data into new preset entries.

---

## 1. What a PRESET is

Each preset represents a **test account + channel** (Paid or Organic) and carries the minimum routing info you need to:

- Build visit payloads
- Build form-event payloads
- Keep Capture bootstrap aligned

Example structure:

```js
const PRESETS = {
  demoPaid: {
    key: 'demoPaid',
    channel: 'Paid',                // "Paid" or "Organic"
    name: 'DeVere Insulation',      // Friendly business name
    label: 'Paid Lead – DeVere',    // UI label for the button
    gmaid: 'USA_172716',
    siteid: '427e4e5f-5317-42d8-825c-765b49e43028',
    scid: '4584989',
    campaignId: 'USA_4972998',
    masterCampaignId: '4392582',
    defaultReferrerType: 'PAID'     // or "ORGANIC"
  },

  demoOrganic: {
    key: 'demoOrganic',
    channel: 'Organic',
    name: 'SiblingTestProd111',
    label: 'Organic Lead – SiblingTestProd111',
    gmaid: 'USA_336031',
    siteid: 'fef441b5-eb77-4131-a21e-52d061bb8a4f',
    scid: null,                     // or some organic-friendly SCID if needed
    campaignId: null,
    masterCampaignId: null,
    defaultReferrerType: 'ORGANIC'
  }
};
```

### Manually building a preset from live data (via curl)

The manual workflow is:

1.  Look up GMAID → site record using SiteService.
2. From that JSON, grab capture_code_uuid.
3. Look up config using the Config API and that uuid.
4. From the config JSON, find:
 - campaign_data entries with non-empty scids
 - referrer_type
 - google_wpcids (if you want a specific “wpcid” SCID)
5. Map those values into a new PRESET entry.

#### GMAID → Site record (SiteService curl)
QA example (no API key, but you must be on VPN):
```js
   curl --location --silent --show-error 'https://siteservice-qa-usa.localiq.com/sites/?global_master_advertiser_id=USA_172216'
```
The response looks like
```[
  {
    "id": "95843",
    "global_master_advertiser_id": "USA_172216",
    "locale": "en-US",
    "capture_code_uuid": "61a53572-cd0e-4cc5-9451-66f19243563c",
    "url": null,
    "capture_js_snippet": "<script ...>",
    "Location": "https://apgb2b-reachcodeandproxy-qa.gannettdigital.com/sites/95843"
  }
]
```
From this you care about:
 - GMAID: global_master_advertiser_id → gmaid
 - Site ID (Capture siteid): capture_code_uuid → siteid

Then, to get the rest of the preset data we need, do a config api call using that uuid
```js
curl --location --silent --show-error "https://capturejsconfigapi-qa-usa.localiq.com/site_configs/61a53572-cd0e-4cc5-9451-66f19243563c/config_file"
```
You’ll get a big JSON blob. The key pieces for presets:
 - globalMasterAdvertiserId → confirms GMAID
 - campaign_data → where campaigns and SCIDs live
 - google_wpcids → array of SCIDs explicitly used as WPCIDs (often good Paid test SCIDs)
 - replacements → email/phone replacement mappings for some campaigns

Example (trimmed):
```
{
  "id": "61a53572-cd0e-4cc5-9451-66f19243563c",
  "globalMasterAdvertiserId": "USA_172216",

  "replacements": {
    "USA_3514047": {
      "email":[{"original":"mgriffith@devereinsulation.com","replace":"formmail"}],
      "phone":[{"original":"4437701111","replace":"4435835491"}]
    }
  },

  "campaign_data": {
    "USA_2240718": {
      "marketing_policy":"true",
      "master_campaign_id":"2240718",
      "referrer_type":"PAID",
      "scids":["3514047"]
    },
    "USA_4972998": {
      "marketing_policy":"true",
      "master_campaign_id":"4392582",
      "referrer_type":"PAID",
      "scids":["4584989","4584990","4584991","4584992","4584994"]
    }
  },

  "google_wpcids": {
    "wpcids":["4584989","4584990"]
  }
}
```

#### Mapping config fields → PRESETS

For a Paid preset, do:
 - gmaid → from globalMasterAdvertiserId (or you already know it from the GMAID query).
 - siteid → from capture_code_uuid in the SiteService response (the first curl).

Choose a campaign entry in campaign_data with non-empty scids:
```"USA_4972998": {
  "master_campaign_id":"4392582",
  "referrer_type":"PAID",
  "scids":["4584989","4584990","4584991","4584992","4584994"]
}
```
 - campaignId → the key, e.g. "USA_4972998"
 - masterCampaignId → "4392582"
 - defaultReferrerType → "PAID"
 - scid → pick one SCID (often a google_wpcid is a good choice)

In this example, google_wpcids.wpcids includes "4584989" and "4584990", so choose "4584989".
So a Paid preset example from this data:
```
demoPaid: {
  key: 'demoPaid',
  channel: 'Paid',
  name: 'DeVere Insulation',
  label: 'Paid Lead – DeVere (DeVere Insulation)',
  gmaid: 'USA_172216',
  siteid: '61a53572-cd0e-4cc5-9451-66f19243563c',
  scid: '4584989',          // from campaign_data + google_wpcids
  campaignId: 'USA_4972998',
  masterCampaignId: '4392582',
  defaultReferrerType: 'PAID'
}
```
For Organic, you can:
 - Reuse the same gmaid + siteid.
 - Use defaultReferrerType: 'ORGANIC'.
 - Either:
   - Leave scid, campaignId, masterCampaignId as null, or
   -  Borrow a SCID/campaign from a PAID section but treat referrer as 'DIRECT' or 'ORGANIC' in your payload builder.
Example:
```
siblingOrganic: {
  key: 'siblingOrganic',
  channel: 'Organic',
  name: 'SiblingTestProd111',
  label: 'Organic Lead – SiblingTestProd111',
  gmaid: 'USA_336031',
  siteid: 'fef441b5-eb77-4131-a21e-52d061bb8a4f',
  scid: null,
  campaignId: null,
  masterCampaignId: null,
  defaultReferrerType: 'ORGANIC'
}
```
