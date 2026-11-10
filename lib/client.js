'use strict';

// The SDK build is vendored under `vendor/` so the published tarball is
// self-contained. Fall back to a top-level install when developing the two
// repositories side by side.
const { ZsmClient } = require('../vendor/zsm-sdk.js');

function createClient(credentials) {
  const timeoutMs = Number(credentials.timeoutMs);
  return new ZsmClient({
    baseUrl: credentials.baseUrl,
    loginUrl: credentials.loginUrl,
    loginTarget: credentials.loginTarget,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1000 ? timeoutMs : 30000,
  });
}

async function authenticatedClient(credentials) {
  const client = createClient(credentials);
  await client.login({ username: credentials.username, password: credentials.password });
  return client;
}

module.exports = { createClient, authenticatedClient };
