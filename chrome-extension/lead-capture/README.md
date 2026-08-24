# Direct Optimize Chrome Lead Capture

This Chrome extension captures the current website and creates a lead in the Direct Optimize dashboard.
The dashboard also tries to match the captured website to a Google Business Profile and saves the Maps URL, rating, reviews, category, and phone when a confident match is found.

## Required app setting

Set this environment variable in the dashboard app:

```bash
LEAD_CAPTURE_API_KEY=use-a-long-random-secret
```

Use the same value in the extension popup.

Google Business Profile matching runs on the dashboard server and uses the existing `GOOGLE_PLACES_API_KEY`; do not add Google API keys to the extension.

## Load in Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder:
   `chrome-extension/lead-capture`
6. Pin the Direct Optimize extension from Chrome's extension menu.

## Use

1. Visit a website you want to capture.
2. Click the Direct Optimize extension icon.
3. Add your dashboard URL and capture API key.
4. Select the country/region.
5. Review extracted company, email, phone, category, city, and website.
6. Click `Create lead`.

The lead will appear in the selected region in Direct Optimize.
If the dashboard finds a matching Google Business Profile, the popup confirms it and the lead detail page will include the GMB data.

## Portable use

For development, Chrome keeps unpacked extensions installed as long as the source folder stays in the same location.
For a truly portable/signed extension, package and publish it through the Chrome Web Store or an enterprise policy.
