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
    // Same human on every account; use it to join across sale accounts.
    globalId: profile.globalId ?? '',
    // Authoritative for THIS account: is this sale already a friend?
    isFriend: profile.isFriend === true,
    name: profile.name ?? '',
    avatar: profile.avatar ?? '',
    conversationId: profile.conversationId ?? '',
  };
}

async function listFriends(client, { accountId }) {
  const result = await client.listFriends(accountId);
  return {
    accountId,
    count: result.friends.length,
    complete: result.complete,
    totalElements: result.totalElements ?? result.friends.length,
    friends: result.friends.map((friend) => ({
      uid: friend.uid,
      globalId: friend.globalId,
      displayName: friend.displayName ?? '',
      zaloName: friend.zaloName ?? '',
    })),
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

async function getGroup(client, { accountId, groupLink }) {
  const info = await client.getGroupInfoByLink(accountId, groupLink);
  if (!info) {
    return { accountId, groupLink, found: false };
  }
  return {
    accountId,
    groupLink,
    found: true,
    groupId: info.groupId,
    name: info.name ?? '',
    creatorId: info.creatorId ?? '',
    memberCount: info.memberCount ?? 0,
    memberIds: (info.members ?? []).map((member) => String(member.id)),
  };
}

async function checkGroupMember(client, { accountId, groupLink, userId }) {
  const result = await client.getGroupMembers(accountId, groupLink, [userId]);
  return {
    accountId,
    groupLink,
    userId,
    inGroup: result.memberIds.includes(String(userId)),
    complete: result.complete !== false,
  };
}

async function inviteToGroup(client, { accountId, groupLink, phone, userId, dryRun }) {
  let resolvedId = userId ? String(userId) : '';
  let name = '';

  if (!resolvedId) {
    const contact = await findContact(client, { accountId, phone });
    if (!contact.found) {
      return { accountId, groupLink, phone, status: 'NOT_FOUND' };
    }
    resolvedId = contact.userId;
    name = contact.name;
  }

  if (dryRun) {
    return { accountId, groupLink, phone, userId: resolvedId, name, status: 'DRY_RUN' };
  }

  const group = await client.getGroupInfoByLink(accountId, groupLink);
  if (!group) {
    return { accountId, groupLink, phone, userId: resolvedId, name, status: 'GROUP_NOT_FOUND' };
  }

  const result = await client.inviteMembers({
    accountId,
    groupId: group.groupId,
    memberIds: [resolvedId],
  });
  return {
    accountId,
    groupLink,
    groupId: group.groupId,
    phone,
    userId: resolvedId,
    name,
    status: result.status,
    code: result.code ?? 0,
    message: result.message ?? '',
  };
}

module.exports = {
  listAccounts,
  findContact,
  listFriends,
  getFriendStatus,
  sendFriendRequest,
  sendMessage,
  getGroup,
  checkGroupMember,
  inviteToGroup,
};
