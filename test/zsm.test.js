'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const stub = path.join(__dirname, 'stub-n8n-workflow.js');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === 'n8n-workflow') return stub;
  return originalResolve.call(this, request, ...args);
};

const { Zsm } = require('../nodes/Zsm.node.js');
const { ZsmApi } = require('../credentials/ZsmApi.credentials.js');
const { startFakeWorkspace, createContext } = require('./helpers/fake-workspace.js');

function credentialsFor(workspace, password = 'good-pass') {
  return {
    baseUrl: workspace.url,
    loginUrl: workspace.url,
    loginTarget: 'test',
    username: 'admin',
    password,
    timeoutMs: 5000,
  };
}

async function withWorkspace(fn) {
  const workspace = await startFakeWorkspace();
  try {
    return await fn(workspace);
  } finally {
    await workspace.close();
  }
}

test('package and node description are valid', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.name, 'n8n-nodes-zsm');
  for (const file of pkg.n8n.nodes) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', file)), `missing ${file}`);
  }
  for (const file of pkg.n8n.credentials) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', file)), `missing ${file}`);
  }

  const node = new Zsm();
  assert.equal(node.description.name, 'zsm');
  assert.equal(node.description.version, 1);
  assert.ok(node.description.credentials.some((credential) => credential.name === 'zsmApi'));

  const icon = node.description.icon;
  assert.ok(icon.startsWith('file:'));
  const iconPath = path.resolve(path.dirname(path.join(__dirname, '..', 'nodes/Zsm.node.js')), icon.slice(5));
  assert.ok(fs.existsSync(iconPath), `missing icon ${iconPath}`);

  for (const property of node.description.properties) {
    assert.ok(property.name, 'property without name');
    assert.ok(property.type, `${property.name} without type`);
    if (property.displayOptions?.show) {
      for (const value of Object.values(property.displayOptions.show)) {
        assert.ok(Array.isArray(value), `${property.name}.displayOptions.show values must be arrays`);
      }
    }
  }

  const credential = new ZsmApi();
  assert.equal(credential.name, 'zsmApi');
  const password = credential.properties.find((property) => property.name === 'password');
  assert.equal(password.typeOptions?.password, true);
});

test('Account: Get Many returns one item per sale account', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: { resource: 'account', operation: 'list' },
      credentials: credentialsFor(workspace),
    });
    const result = await node.execute.call(context);
    assert.equal(result.length, 1);
    assert.deepEqual(
      result[0].map((item) => item.json),
      [
        { accountId: 'acc-1', name: 'Sale One', status: 'ACTIVE' },
        { accountId: 'acc-2', name: 'Sale Two', status: 'OFF' },
      ],
    );
  });
});

test('Contact: Find by Phone normalizes the phone', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: {
        resource: 'contact',
        operation: 'findByPhone',
        accountId: 'acc-1',
        phone: '0900000001',
      },
      credentials: credentialsFor(workspace),
    });
    const [[item]] = await node.execute.call(context);
    assert.equal(item.json.found, true);
    assert.equal(item.json.userId, 'user-1');
    assert.equal(item.json.name, 'Khách Test');
    assert.equal(item.json.conversationId, 'conv-1');
  });
});

test('Friend Request: Get Status maps the workspace response', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: {
        resource: 'friendRequest',
        operation: 'getStatus',
        accountId: 'acc-1',
        userId: 'user-1',
      },
      credentials: credentialsFor(workspace),
    });
    const [[item]] = await node.execute.call(context);
    assert.deepEqual(item.json, { accountId: 'acc-1', userId: 'user-1', status: 'INVITED' });
  });
});

test('Friend Request: Send defaults to dry run and does not call the write endpoint', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: {
        resource: 'friendRequest',
        operation: 'send',
        accountId: 'acc-1',
        phone: '0900000001',
        message: 'Xin chào',
        options: {},
      },
      credentials: credentialsFor(workspace),
    });
    const [[item]] = await node.execute.call(context);
    assert.equal(item.json.status, 'DRY_RUN');
    assert.equal(item.json.userId, 'user-1');
    assert.equal(workspace.state.friendRequests.length, 0);
  });
});

test('Friend Request: Send with Dry Run off sends once', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: {
        resource: 'friendRequest',
        operation: 'send',
        accountId: 'acc-1',
        phone: '0900000001',
        message: 'Xin chào',
        options: { dryRun: false },
      },
      credentials: credentialsFor(workspace),
    });
    const [[item]] = await node.execute.call(context);
    assert.equal(item.json.status, 'INVITED');
    assert.equal(workspace.state.friendRequests.length, 1);
    assert.deepEqual(workspace.state.friendRequests[0], {
      accountId: 'acc-1',
      userId: 'user-1',
      msg: 'Xin chào',
    });
  });
});

test('Friend Request: unknown phone returns NOT_FOUND without writing', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: {
        resource: 'friendRequest',
        operation: 'send',
        accountId: 'acc-1',
        phone: '0900009999',
        message: 'Xin chào',
        options: { dryRun: false },
      },
      credentials: credentialsFor(workspace),
    });
    const [[item]] = await node.execute.call(context);
    assert.equal(item.json.status, 'NOT_FOUND');
    assert.equal(workspace.state.friendRequests.length, 0);
  });
});

test('Message: Send defaults to dry run, then sends when disabled', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const params = {
      resource: 'message',
      operation: 'send',
      accountId: 'acc-1',
      toId: 'user-1',
      message: 'hello',
      options: {},
    };
    {
      const context = createContext({ params: { ...params }, credentials: credentialsFor(workspace) });
      const [[item]] = await node.execute.call(context);
      assert.equal(item.json.status, 'DRY_RUN');
      assert.equal(workspace.state.messages.length, 0);
    }
    {
      const context = createContext({
        params: { ...params, options: { dryRun: false } },
        credentials: credentialsFor(workspace),
      });
      const [[item]] = await node.execute.call(context);
      assert.equal(item.json.status, 'SENT');
      assert.equal(item.json.messageId, 'msg-1');
      assert.deepEqual(workspace.state.messages[0], { accountId: 'acc-1', toId: 'user-1', message: 'hello' });
    }
  });
});

test('login failure surfaces NodeOperationError without the password', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = createContext({
      params: { resource: 'account', operation: 'list' },
      credentials: credentialsFor(workspace, 'wrong-password'),
    });
    await assert.rejects(
      () => node.execute.call(context),
      (error) => {
        assert.equal(error.name, 'NodeOperationError');
        assert.doesNotMatch(error.message, /wrong-password/);
        return true;
      },
    );
  });
});

test('loadOptions.getAccounts returns sale accounts', async () => {
  await withWorkspace(async (workspace) => {
    const node = new Zsm();
    const context = {
      getCredentials: async () => credentialsFor(workspace),
    };
    const options = await node.methods.loadOptions.getAccounts.call(context);
    assert.deepEqual(options, [
      { name: 'Sale One (acc-1)', value: 'acc-1' },
      { name: 'Sale Two (acc-2)', value: 'acc-2' },
    ]);
  });
});
