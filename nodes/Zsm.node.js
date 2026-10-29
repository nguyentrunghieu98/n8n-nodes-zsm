'use strict';

const { NodeOperationError } = require('n8n-workflow');
const { authenticatedClient } = require('../lib/client');
const operations = require('../lib/operations');

class Zsm {
  constructor() {
    this.description = {
      displayName: 'ZSM',
      name: 'zsm',
      group: ['transform'],
      icon: 'file:../icons/zsm.svg',
      version: 1,
      description:
        'Quản lý tài khoản sale và tương tác khách qua workspace chat: liệt kê tài khoản, tìm khách theo SĐT, kiểm tra quan hệ bạn bè, gửi lời mời và gửi tin nhắn.',
      defaults: {
        name: 'ZSM',
      },
      inputs: ['main'],
      outputs: ['main'],
      credentials: [
        {
          name: 'zsmApi',
          required: true,
        },
      ],
      properties: [
        {
          displayName: 'Resource',
          name: 'resource',
          type: 'options',
          noDataExpression: true,
          options: [
            { name: 'Account', value: 'account' },
            { name: 'Contact', value: 'contact' },
            { name: 'Friend Request', value: 'friendRequest' },
            { name: 'Message', value: 'message' },
          ],
          default: 'account',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          displayOptions: { show: { resource: ['account'] } },
          options: [
            {
              name: 'Get Many',
              value: 'list',
              description: 'Liệt kê toàn bộ tài khoản sale dưới tài khoản quản trị',
              action: 'List sale accounts',
            },
          ],
          default: 'list',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          displayOptions: { show: { resource: ['contact'] } },
          options: [
            {
              name: 'Find by Phone',
              value: 'findByPhone',
              description: 'Tìm hồ sơ khách theo số điện thoại',
              action: 'Find a contact by phone',
            },
          ],
          default: 'findByPhone',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          displayOptions: { show: { resource: ['friendRequest'] } },
          options: [
            {
              name: 'Get Status',
              value: 'getStatus',
              description: 'Xem trạng thái bạn bè / lời mời hiện tại',
              action: 'Get friend request status',
            },
            {
              name: 'Send',
              value: 'send',
              description: 'Gửi lời mời kết bạn từ tài khoản sale',
              action: 'Send a friend request',
            },
          ],
          default: 'send',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          displayOptions: { show: { resource: ['message'] } },
          options: [
            {
              name: 'Send',
              value: 'send',
              description: 'Gửi tin nhắn văn bản tới một người dùng',
              action: 'Send a message',
            },
          ],
          default: 'send',
        },
        {
          displayName: 'Sale Account',
          name: 'accountId',
          type: 'options',
          typeOptions: {
            loadOptionsMethod: 'getAccounts',
          },
          default: '',
          required: true,
          displayOptions: { show: { resource: ['contact', 'friendRequest', 'message'] } },
          description: 'Tài khoản sale dùng để thao tác. Danh sách tải từ credential.',
        },
        {
          displayName: 'Phone Number',
          name: 'phone',
          type: 'string',
          default: '',
          required: true,
          displayOptions: {
            show: {
              resource: ['contact', 'friendRequest'],
              operation: ['findByPhone', 'send'],
            },
          },
          description: 'Số điện thoại khách, ví dụ 0900000000.',
        },
        {
          displayName: 'User ID',
          name: 'userId',
          type: 'string',
          default: '',
          required: true,
          displayOptions: {
            show: {
              resource: ['friendRequest'],
              operation: ['getStatus'],
            },
          },
          description: 'ID người dùng trên workspace chat.',
        },
        {
          displayName: 'Message',
          name: 'message',
          type: 'string',
          typeOptions: { rows: 3 },
          default: '',
          required: true,
          displayOptions: {
            show: {
              resource: ['friendRequest', 'message'],
              operation: ['send'],
            },
          },
          description: 'Nội dung lời mời hoặc tin nhắn.',
        },
        {
          displayName: 'Recipient ID',
          name: 'toId',
          type: 'string',
          default: '',
          required: true,
          displayOptions: {
            show: {
              resource: ['message'],
              operation: ['send'],
            },
          },
          description: 'ID người nhận. Dùng node Contact → Find by Phone để lấy trước.',
        },
        {
          displayName: 'Options',
          name: 'options',
          type: 'collection',
          placeholder: 'Thêm tùy chọn',
          default: {},
          displayOptions: {
            show: {
              resource: ['friendRequest', 'message'],
              operation: ['send'],
            },
          },
          options: [
            {
              displayName: 'Dry Run',
              name: 'dryRun',
              type: 'boolean',
              default: true,
              description:
                'Bật để chỉ tra cứu và trả kết quả, KHÔNG gửi lời mời hoặc tin nhắn thật.',
            },
          ],
        },
      ],
    };

    this.methods = {
      loadOptions: {
        async getAccounts() {
          const credentials = await this.getCredentials('zsmApi');
          const client = await authenticatedClient(credentials);
          const accounts = await client.listAccounts();
          return accounts.map((account) => ({
            name: account.name ? `${account.name} (${account.accountId})` : account.accountId,
            value: account.accountId,
          }));
        },
      },
    };
  }

  async execute() {
    const resource = this.getNodeParameter('resource', 0);
    const operation = this.getNodeParameter('operation', 0);

    let client;
    try {
      const credentials = await this.getCredentials('zsmApi');
      client = await authenticatedClient(credentials);
    } catch (error) {
      throw new NodeOperationError(this.getNode(), error);
    }

    if (resource === 'account' && operation === 'list') {
      try {
        const accounts = await operations.listAccounts(client);
        return [accounts.map((json) => ({ json }))];
      } catch (error) {
        throw new NodeOperationError(this.getNode(), error);
      }
    }

    const items = this.getInputData();
    const results = [];
    for (let i = 0; i < items.length; i += 1) {
      try {
        const json = await runItem(this, client, { resource, operation, itemIndex: i });
        results.push({ json, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          results.push({ json: { error: error.message }, pairedItem: { item: i } });
          continue;
        }
        if (error instanceof NodeOperationError) throw error;
        throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
      }
    }
    return [results];
  }


}


async function runItem(context, client, { resource, operation, itemIndex }) {
    if (resource === 'contact' && operation === 'findByPhone') {
      return operations.findContact(client, {
        accountId: context.getNodeParameter('accountId', itemIndex),
        phone: context.getNodeParameter('phone', itemIndex),
      });
    }

    if (resource === 'friendRequest' && operation === 'getStatus') {
      return operations.getFriendStatus(client, {
        accountId: context.getNodeParameter('accountId', itemIndex),
        userId: context.getNodeParameter('userId', itemIndex),
      });
    }

    if (resource === 'friendRequest' && operation === 'send') {
      const options = context.getNodeParameter('options', itemIndex, {});
      return operations.sendFriendRequest(client, {
        accountId: context.getNodeParameter('accountId', itemIndex),
        phone: context.getNodeParameter('phone', itemIndex),
        message: context.getNodeParameter('message', itemIndex),
        dryRun: options.dryRun !== false,
      });
    }

    if (resource === 'message' && operation === 'send') {
      const options = context.getNodeParameter('options', itemIndex, {});
      return operations.sendMessage(client, {
        accountId: context.getNodeParameter('accountId', itemIndex),
        toId: context.getNodeParameter('toId', itemIndex),
        message: context.getNodeParameter('message', itemIndex),
        dryRun: options.dryRun !== false,
      });
    }

    throw new NodeOperationError(context.getNode(), `Unsupported operation: ${resource}/${operation}`);
}

module.exports = { Zsm };
