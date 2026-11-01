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

GitHub Pages provides the entry URL. Google Apps Script serves the application and runs authenticated spreadsheet operations. The deployed web app is restricted to its owner. No spreadsheet contents, IMEI fixtures, credentials, or desktop databases are published here.

`site/app.html` contains the English UI. `apps-script/Code.gs` contains the server logic. The published server file uses configuration placeholders; set them to the source spreadsheet ID, history spreadsheet ID, and usage sheet ID in your own private Apps Script project. The history sheet's first row must be `Request ID`, `Used at (UTC)`, `Model ID`, `Model`, `IMEI 1`, `IMEI 2`.

Run `node tools/bundle.mjs` to create `outputs/Deploy.gs`, paste that into Apps Script, and deploy as a web app executing as the owner with access restricted to the owner. Update `index.html` with the resulting deployment URL. `apps-script/appsscript.json` documents the intended runtime and spreadsheet scope.

## Reliability

A script lock serializes extraction. A single history row records each request and its pair before the pair is returned. Persisted request IDs make retries idempotent after a lost response. Deduplication is global across visible models. Reloading restores the previous result without extracting a new pair. A truncated or malformed history fails closed.

Run `node tests/backend.test.mjs` for parser, global deduplication, retry, concurrency, write-failure, and history-integrity tests. Optional private test fixtures live in ignored `outputs/` and are never required by the deployed app.
