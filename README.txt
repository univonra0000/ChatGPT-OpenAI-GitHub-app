COLBAS WSS - PROPER DEPLOYMENT PACKAGE

Files:
  src/index.js       Cloudflare Worker + Durable Object
  wrangler.toml      Durable Object binding and SQLite migration
  test.html          optional HTTPS browser WSS test

FINAL WSS ENDPOINT:
  wss://colbas.univonra.workers.dev/ws

IMPORTANT:
This is a Durable Object Worker, not a static-assets-only upload.
Use Wrangler/Cloudflare Workers code deployment and configure the
Durable Object binding.

Binding:
  Variable: NEURO_SYNC_ROOM
  Class:    NeuroSyncRoom

If the existing colbas Worker already has Durable Objects or migrations,
merge the configuration instead of creating a duplicate migration tag.

For the first test, leave ALLOWED_ORIGIN unset. Once the HTTPS URL
hosting Neuro Sync is known, set ALLOWED_ORIGIN to that exact origin,
for example:
  https://example.pages.dev

WSS encrypts traffic in transit (TLS). It is not end-to-end encryption.
