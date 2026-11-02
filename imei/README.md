# M2 IMEI Desk

English web workspace for retrieving two unused IMEIs at a time from private Google Sheets.

Open https://harry6937.github.io/imei/ and sign in with the Google account that owns the deployment.

## Daily use

1. Open the source spreadsheet using **Open Sheet** in the app.
2. Use one worksheet per phone model; the worksheet title appears in the model dropdown.
3. Enter one IMEI per row in column A, below the optional `IMEI` header. Keep the column formatted as plain text so leading zeros are preserved.
4. Click **Refresh**, select a model, then **Get next 2 IMEIs**. Each number has its own **Copy** button.

If only one unused IMEI remains, the app returns that one. When none remain, it disables extraction and displays the empty state. The visible model worksheets contain only IMEIs. A separate private spreadsheet stores durable usage records. Do not delete or edit that history: it prevents previously issued numbers from returning, including across models and devices.

## Hosting and source

GitHub Pages serves the complete interface at the URL above. It does not redirect to Google. Google Apps Script only runs authenticated spreadsheet operations through a hidden connection frame. If browser sign-in restrictions prevent that connection, **Connect Google Sheets** opens a small connection window; leave it open and use the desk on GitHub. The Google service is still restricted to its owner. No spreadsheet contents, IMEI fixtures, credentials, or desktop databases are published here.

The connection accepts messages only from the configured GitHub origin, binds every session to a fresh channel and peer window, and exposes only three allowlisted operations. Credentials are not embedded in the website. Existing cloud usage history remains authoritative when moving between the old and new website origins.

`site/app.html` contains the English UI. `apps-script/Code.gs` contains the server logic. The published server file uses configuration placeholders; set them to the source spreadsheet ID, history spreadsheet ID, and usage sheet ID in your own private Apps Script project. The history sheet's first row must be `Request ID`, `Used at (UTC)`, `Model ID`, `Model`, `IMEI 1`, `IMEI 2`.

Run `node tools/bundle.mjs` to generate the GitHub `index.html` from `site/app.html` and create `outputs/Deploy.gs` from the server and `apps-script/Bridge.html`. Paste the bundle into the existing Apps Script project, then update its deployment to a new version, executing as the owner with access restricted to the owner. Keep its deployment URL in `service.js`. Publish `index.html` and `service.js` together. `apps-script/appsscript.json` documents the intended runtime and spreadsheet scope.

## Reliability

A script lock serializes extraction. A single history row records each request and its pair before the pair is returned. Persisted request IDs make retries idempotent after a lost response. Deduplication is global across visible models. Reloading restores the previous result without extracting a new pair. A truncated or malformed history fails closed.

Run `node tests/backend.test.mjs` for parser, global deduplication, retry, concurrency, write-failure, and history-integrity tests. Run `node tests/bridge.test.mjs` for connection origin, peer, method and retry checks. Optional private test fixtures live in ignored `outputs/` and are never required by the deployed app.
