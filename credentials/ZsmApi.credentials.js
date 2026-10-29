'use strict';

class ZsmApi {
  constructor() {
    this.name = 'zsmApi';
    this.displayName = 'ZSM Workspace API';
    this.documentationUrl = 'https://github.com/nguyentrunghieu98/zsm-sdk#readme';
    this.properties = [
      {
        displayName: 'Workspace URL',
        name: 'baseUrl',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://workspace.example',
        description: 'Host của workspace, dùng cho các API sau khi đăng nhập.',
      },
      {
        displayName: 'Login URL',
        name: 'loginUrl',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://login.example',
        description: 'Host của trang đăng nhập username/password.',
      },
      {
        displayName: 'Login Target',
        name: 'loginTarget',
        type: 'string',
        default: '',
        required: true,
        description: 'Giá trị target của form đăng nhập do workspace quy định.',
      },
      {
        displayName: 'Username',
        name: 'username',
        type: 'string',
        default: '',
        required: true,
        description: 'Tài khoản quản trị workspace.',
      },
      {
        displayName: 'Password',
        name: 'password',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
        description: 'Mật khẩu tài khoản quản trị. Được n8n mã hóa khi lưu.',
      },
      {
        displayName: 'Timeout (ms)',
        name: 'timeoutMs',
        type: 'number',
        default: 30000,
        typeOptions: { minValue: 1000 },
        description: 'Timeout cho mỗi request tới workspace.',
      },
    ];
  }
}

module.exports = { ZsmApi };
