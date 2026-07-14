# Direct Optimize Firefox Lead Capture

This temporary Firefox extension captures the current website and creates a lead in the Direct Optimize dashboard.

## Required app setting

Set this environment variable in the dashboard app:

```bash
LEAD_CAPTURE_API_KEY=use-a-long-random-secret
```

Use the same value in the extension popup.

## Load in Firefox

1. Open Firefox.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on`.
4. Select `manifest.json` from this folder:
   `firefox-extension/lead-capture/manifest.json`

## Use

1. Visit a website you want to capture.
2. Click the Direct Optimize extension icon.
3. Add your dashboard URL and capture API key.
4. Select the country/region.
5. Review extracted company, email, phone, category, city, and website.
6. Click `Create lead`.

The lead will appear in the selected region in Direct Optimize.
