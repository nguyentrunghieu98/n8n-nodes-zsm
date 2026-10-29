# n8n-nodes-zsm

Node cộng đồng cho n8n để làm việc với một workspace quản lý nhiều tài khoản chat bán hàng.

- Đăng nhập một lần bằng tài khoản quản trị (username/password), không cần quét QR cho từng sale.
- Liệt kê toàn bộ tài khoản sale mà tài khoản quản trị được phép dùng.
- Chọn tài khoản sale để tìm khách theo số điện thoại, kiểm tra quan hệ bạn bè, gửi lời mời kết bạn và gửi tin nhắn.

> ⚠️ **Không chính thức.** Không liên kết với nhà cung cấp workspace. API có thể thay đổi không báo trước; tự chịu trách nhiệm khi dùng.

## Cài đặt

Trong n8n: **Settings → Community nodes → Install** → nhập `n8n-nodes-zsm`.

Hoặc cài thủ công trong môi trường n8n:

```sh
npm install n8n-nodes-zsm
```

Yêu cầu Node.js >= 20.

## Credential

Tạo credential **ZSM Workspace API** với các trường:

| Trường | Ý nghĩa |
| --- | --- |
| Workspace URL | Host workspace, dùng cho API sau đăng nhập |
| Login URL | Host trang đăng nhập username/password |
| Login Target | Giá trị `target` của form đăng nhập do workspace quy định |
| Username | Tài khoản quản trị |
| Password | Mật khẩu, được n8n mã hóa khi lưu |
| Timeout (ms) | Timeout mỗi request, mặc định 30000 |

Node đăng nhập lại mỗi lần workflow chạy. Mật khẩu và token không được ghi ra output.

## Node ZSM

| Resource | Operation | Kết quả |
| --- | --- | --- |
| Account | Get Many | Mỗi item là một tài khoản sale: `accountId`, `name`, `status` |
| Contact | Find by Phone | `found`, `userId`, `name`, `avatar`, `conversationId` |
| Friend Request | Get Status | `status`: `ALREADY_FRIENDS`, `INVITED`, `NONE`, `UNKNOWN` |
| Friend Request | Send | Tra cứu SĐT rồi gửi lời mời; trả `INVITED`, `ALREADY_FRIENDS`, `NOT_FOUND`, `DRY_RUN` |
| Message | Send | Gửi tin nhắn văn bản tới `toId`, trả `messageId` |

### Dry Run

Hai operation ghi dữ liệu (**Friend Request → Send**, **Message → Send**) có tùy chọn **Dry Run**, mặc định **bật**. Khi bật, node chỉ tra cứu và trả kết quả dự kiến, không gửi thật.

### Map sale code với account

Mỗi dòng khách trong workflow thường có `Mã Nhân Viên`. Thêm cột `zsm_account_id` vào Data Table Sales và map:

```text
{{ $json.zsm_account_id }}
```

rồi truyền vào trường **Sale Account**. Node không tự đoán tài khoản theo tên để tránh gửi nhầm sale.

## Ghi chú an toàn

- Không bật Dry Run = false cho tới khi đã chạy thử một khách và đối soát log.
- SDK không tự retry thao tác gửi lời mời; caller cần chống trùng và giới hạn tần suất.
- Giữ credential ở quyền quản trị n8n; không đưa mật khẩu/token vào Code node hoặc log.

## Phát triển

```sh
npm install --legacy-peer-deps
npm test
```

Test dùng HTTP server giả, không gọi mạng thật và không cần credential thật.

## Giấy phép

MIT.
