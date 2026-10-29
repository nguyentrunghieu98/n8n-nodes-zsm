'use strict';

const { ZsmClient } = require('zsm-sdk');

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
