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
| Contact | Find by Phone | `found`, `userId`, `globalId`, `isFriend`, `name`, `avatar`, `conversationId` |
| Contact | List Friends | Toàn bộ danh sách bạn của một tài khoản: `count`, `complete`, `friends[]` với `uid`, `globalId`, `displayName` |
| Friend Request | Get Status | `status`: `ALREADY_FRIENDS`, `INVITED`, `NONE`, `UNKNOWN` |
| Friend Request | Send | Tra cứu SĐT rồi gửi lời mời; trả `INVITED`, `ALREADY_FRIENDS`, `NOT_FOUND`, `DRY_RUN` |
| Group | Get from Link | Đọc nhóm từ link mời: `groupId`, `name`, `memberCount`, `memberIds` |
| Group | Check Member | Trả `inGroup` (true/false) và `complete` (danh sách thành viên có bị phân trang) |
| Group | Invite | Tra cứu SĐT rồi mời vào nhóm; trả `INVITED`, `ALREADY_IN_GROUP`, `FAILED`, `GROUP_NOT_FOUND`, `NOT_FOUND`, `DRY_RUN` |
| Message | Send | Gửi tin nhắn văn bản tới `toId`, trả `messageId` |

### `globalId` và `uid`

- `uid` là id của một người **trong từng tài khoản sale** — cùng một khách, mỗi sale giữ một `uid` khác nhau. Mọi thao tác (gửi tin, kết bạn, mời nhóm) phải dùng `uid` của đúng tài khoản đang thao tác; dùng `uid` của sale khác sẽ bị lỗi `code 114`.
- `globalId` là id **toàn cục** của người đó, giống nhau ở mọi tài khoản. Dùng nó để ghép một khách giữa nhiều sale, ví dụ: tải `Contact → List Friends` của cả 8 sale về một bảng, rồi mỗi khách chỉ cần một lần `Contact → Find by Phone` để lấy `globalId` và tra ra sale nào đã là bạn.
- `Contact → Find by Phone` trả thêm `isFriend` — đúng/sai cho **chính tài khoản vừa tìm**, không cần gọi thêm `Friend Request → Get Status`.

### Dry Run

Ba operation ghi dữ liệu (**Friend Request → Send**, **Group → Invite**, **Message → Send**) có tùy chọn **Dry Run**, mặc định **bật**. Khi bật, node chỉ tra cứu và trả kết quả dự kiến, không gửi thật.

### Mời nhóm Zalo

```text
Contact → Find by Phone  (phone)
        → Friend Request → Get Status  (userId)   # chỉ mời khi ALREADY_FRIENDS
        → Group → Invite  (accountId, groupLink, phone)
```

Điều kiện mời được:

- Tài khoản sale trong **Sale Account** phải đang là thành viên của nhóm.
- Nhóm không bật `joinAppr` (phê duyệt thành viên) thì mời là vào ngay.
- Nếu số chưa kết bạn với tài khoản đó, Zalo thường từ chối — gửi lời mời kết bạn trước.

Lưu ý: **một SĐT có thể không tìm thấy bằng account này nhưng tìm thấy bằng account khác**
(do cài đặt quyền riêng tư của người dùng). Khi `Group → Invite` trả `NOT_FOUND`, nên
thử lại bằng account khác trước khi kết luận khách không dùng Zalo.

### Map sale code với account

Mỗi dòng khách trong workflow thường có `Mã Nhân Viên`. Thêm cột `zsm_account_id` vào Data Table Sales và map:

```text
{{ $json.zsm_account_id }}
```

rồi truyền vào trường **Sale Account**. Node không tự đoán tài khoản theo tên để tránh gửi nhầm sale.

## Lỗi có cấu trúc

Khi node được đặt `Continue On Fail` / `onError = continueRegularOutput`, mỗi item lỗi trả thêm:

| Field | Ý nghĩa |
| --- | --- |
| `error` | Thông báo ngắn |
| `errorName` | Loại lỗi (`HttpError`, `ApiError`, `AuthenticationError`...) |
| `errorCode` | Mã lỗi API nếu có |
| `errorStatus` | HTTP status nếu có |
| `errorBody` | Body rút gọn 500 ký tự để chẩn đoán |

Dùng các field này để ghi log DB; không cần parse chuỗi.

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
