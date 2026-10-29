'use strict';

const http = require('node:http');

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const ACCESS_TOKEN = jwt({ exp: 4102444800, sub: 'admin' });

/**
 * Fake workspace: login form, cookie handoff, verify, accounts, search and
 * the two write endpoints. Records every request for assertions.
 */
async function startFakeWorkspace() {
  const state = {
    requests: [],
    friendRequests: [],
    messages: [],
    logins: 0,
    accountId: 'acc-1',
    knownPhone: '+84900000001',
    failAddFriend: false,
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      state.requests.push({ method: req.method, path: url.pathname, search: url.search, body, headers: req.headers });

      const json = (status, payload, headers = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(JSON.stringify(payload));
      };

      if (req.method === 'GET' && url.pathname === '/login') {
        res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'sid=pre; Path=/; HttpOnly' });
        res.end('<form action="/login?target=test" method="post"></form>');
        return;
      }

      if (req.method === 'POST' && url.pathname === '/login') {
        state.logins += 1;
        const form = new URLSearchParams(body);
        if (form.get('password') !== 'good-pass') {
          res.writeHead(302, { location: '/login?error=true&target=test' });
          res.end();
          return;
        }
        res.writeHead(302, { location: '/', 'set-cookie': 'sid=auth; Path=/; HttpOnly' });
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html>spa</html>');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/auth/verify') {
        if (!String(req.headers.cookie || '').includes('sid=auth')) {
          json(500, { status: 'error', error: { message: 'not authenticated' } });
          return;
        }
        json(200, { data: { accessToken: ACCESS_TOKEN, sessionId: 'session-1' } });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/account/getAll') {
        json(200, {
          data: [
            { accountId: 'acc-1', displayName: 'Sale One', status: 'ACTIVE' },
            { accountId: 'acc-2', displayName: 'Sale Two', status: 'OFF' },
          ],
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/search/searchByPhoneAndAccount') {
        if (url.searchParams.get('searchKey') === state.knownPhone) {
          json(200, { data: { profile: { userId: 'user-1', name: 'Khách Test' }, conversation: { id: 'conv-1' } } });
          return;
        }
        json(200, { data: {} });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/conversation/friendRequestStatus') {
        json(200, { data: { is_requested: true } });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/contact/addFriend') {
        if (state.failAddFriend) {
          json(500, { status: 'error', error: { message: 'upstream exploded', code: 'E_UPSTREAM' } });
          return;
        }
        state.friendRequests.push({
          accountId: url.searchParams.get('accountId'),
          userId: url.searchParams.get('userId'),
          msg: url.searchParams.get('msg'),
        });
        json(200, { data: { error_code: 0, is_requested: true } });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/message/sms') {
        state.messages.push(JSON.parse(body));
        json(200, { data: { cliMsgId: 'msg-1' } });
        return;
      }

      json(404, { message: 'not found' });
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    server,
    state,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function createContext({ params, credentials, items = [{ json: {} }], continueOnFail = false }) {
  return {
    getCredentials: async () => credentials,
    getInputData: () => items,
    getNodeParameter: (name, index = 0, fallback) => {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        const value = params[name];
        return typeof value === 'function' ? value(index) : value;
      }
      return fallback;
    },
    getNode: () => ({ name: 'ZSM', type: 'n8n-nodes-zsm.zsm', typeVersion: 1 }),
    continueOnFail: () => continueOnFail,
  };
}

module.exports = { startFakeWorkspace, createContext, ACCESS_TOKEN };
