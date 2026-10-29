'use strict';

/**
 * Pure operation helpers. They take an authenticated SDK client so tests can
 * exercise the full chain without n8n.
 */

async function listAccounts(client) {
  const accounts = await client.listAccounts();
  return accounts.map((account) => ({
    accountId: account.accountId,
    name: account.name ?? '',
    status: account.status ?? '',
  }));
}

async function findContact(client, { accountId, phone }) {
  const profile = await client.findUserByPhone(accountId, phone);
  if (!profile) {
    return { accountId, phone, found: false };
  }
  return {
    accountId,
    phone,
    found: true,
    userId: profile.userId,
    name: profile.name ?? '',
    avatar: profile.avatar ?? '',
    conversationId: profile.conversationId ?? '',
  };
}

async function getFriendStatus(client, { accountId, userId }) {
  const result = await client.getFriendRequestStatus(accountId, userId);
  return { accountId, userId, status: result.status };
}

async function sendFriendRequest(client, { accountId, phone, message, dryRun }) {
  const contact = await findContact(client, { accountId, phone });
  if (!contact.found) {
    return { ...contact, status: 'NOT_FOUND' };
  }
  if (dryRun) {
    return {
      accountId,
      phone,
      userId: contact.userId,
      name: contact.name,
      status: 'DRY_RUN',
    };
  }
  const result = await client.sendFriendRequest(accountId, contact.userId, message);
  return {
    accountId,
    phone,
    userId: contact.userId,
    name: contact.name,
    status: result.status,
    code: result.code ?? 0,
    message: result.message ?? '',
  };
}

async function sendMessage(client, { accountId, toId, message, dryRun }) {
  if (dryRun) {
    return { accountId, toId, status: 'DRY_RUN' };
  }
  const result = await client.sendMessage({ accountId, toId, message });
  return { accountId, toId, status: 'SENT', messageId: result.messageId ?? '' };
}

module.exports = { listAccounts, findContact, getFriendStatus, sendFriendRequest, sendMessage };
