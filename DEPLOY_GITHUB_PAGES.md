# Deploy lên GitHub Pages

Bản web này là static site nên phù hợp với GitHub Pages.

1. Đăng nhập GitHub và tạo repository mới, ví dụ `an-dau-day`.
2. Upload tất cả file/thư mục trong `food-finder-sg` lên repository.
3. Vào `Settings` của repository.
4. Chọn `Pages` ở thanh bên.
5. Tại `Build and deployment`, chọn `Deploy from a branch`.
6. Branch: `main`. Folder: `/(root)`.
7. Bấm `Save`.
8. Sau khi deployment hoàn tất, bấm `Visit site` trong phần GitHub Pages.

URL thông thường sẽ là:

`https://USERNAME.github.io/REPOSITORY/`

## Sau khi host

- Trang chính: `/index.html` hoặc `/`
- Trang quản lý data: `/admin.html`
- Nếu bật Google Sheet trong `config.js`, các thay đổi trên Sheet sẽ được đọc khi tải lại web.

## Lưu ý bảo mật

`admin.html` là công cụ chỉnh data local/export JSON, không phải admin backend có đăng nhập. Đừng đặt mật khẩu, token hay API key bí mật trong file HTML/JS của site tĩnh.
