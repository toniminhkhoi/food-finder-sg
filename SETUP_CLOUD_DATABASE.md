# Bật database chung để mọi người thấy quán mới

## Vì sao bản cũ không cập nhật cho người khác?

Bản cũ lưu thay đổi bằng `localStorage`. `localStorage` chỉ nằm trong trình duyệt của chính bạn, nên khi bạn thêm Mixue thì máy bạn thấy nhưng người khác không thấy.

Bản V4 dùng:

- GitHub Pages: giao diện web.
- Google Sheet: database chung.
- Google Apps Script: API đọc/ghi database.
- `ADMIN_TOKEN`: khóa để chỉ bạn có thể sửa dữ liệu.

---

## Bước 1 — Tạo Google Sheet database

1. Vào Google Sheets và tạo spreadsheet mới.
2. Đặt tên ví dụ: `An Dau Day - Database`.
3. Đổi tên tab đầu tiên thành **Restaurants**.
4. Vào **File → Import → Upload**.
5. Upload file `data/restaurants_seed.csv` trong project này.
6. Chọn import vào sheet hiện tại / replace current sheet.

Dòng đầu phải có đúng các cột:

`id, brandId, name, branch, address, district, mainGroup, foodTypes, cuisines, desserts, drinks, status, note, source`

---

## Bước 2 — Gắn Apps Script vào Sheet

1. Trong Google Sheet chọn **Extensions → Apps Script**.
2. Xóa code mẫu đang có.
3. Mở file `google-apps-script/Code.gs` trong project này.
4. Copy toàn bộ code rồi paste vào Apps Script.
5. Save.
6. Ở danh sách function phía trên, chọn **setupDatabase**.
7. Bấm **Run**.
8. Google sẽ hỏi quyền → cho phép script truy cập spreadsheet của bạn.

Chỉ cần chạy `setupDatabase()` một lần.

---

## Bước 3 — Tạo ADMIN_TOKEN

Không bao giờ ghi token này vào GitHub hoặc `config.js`.

1. Trong Apps Script mở **Project Settings**.
2. Tìm **Script Properties**.
3. Chọn **Add script property**.
4. Property: `ADMIN_TOKEN`
5. Value: tự đặt một chuỗi dài, ví dụ một mật khẩu ngẫu nhiên 30–50 ký tự.
6. Save.

Ví dụ minh họa (KHÔNG dùng y nguyên):

`ADd-9xP2-kJ7-Vm4-2026-secret`

---

## Bước 4 — Deploy Apps Script thành Web App

1. Apps Script → **Deploy → New deployment**.
2. Type → **Web app**.
3. Execute as → **Me**.
4. Who has access → **Anyone**.
5. Deploy.
6. Copy URL kết thúc bằng `/exec`.

Ví dụ:

`https://script.google.com/macros/s/XXXXXXXX/exec`

Không dùng URL `/dev`.

---

## Bước 5 — Nối website vào database chung

Mở `config.js` và sửa:

```js
window.FOOD_FINDER_CONFIG = {
  siteName: "Ăn Đâu Đây?",
  tagline: "Ăn gì, uống gì ở Sài Gòn?",
  dataSource: "api",
  apiUrl: "DAN_URL_WEB_APP_/exec_VAO_DAY",
  localDataUrl: "./data/restaurants.json",
  cloudRefreshMs: 60000,
  adminEnabled: true
};
```

Quan trọng:

- `dataSource` phải là `"api"`.
- `apiUrl` phải là URL `/exec`.
- Không đặt `ADMIN_TOKEN` vào file này.

Sau đó commit/push `config.js` lên GitHub.

---

## Bước 6 — Cập nhật quán từ admin.html

1. Mở website online: `/admin.html`.
2. Ở phần **Admin token**, nhập token bạn đã tạo ở Script Properties.
3. Bấm **Lưu token**.
4. Thêm hoặc sửa quán.
5. Bấm **Lưu / cập nhật**.
6. Trang sẽ gửi dữ liệu lên Google Sheet và tải lại để xác minh.

Sau khi thành công:

- Máy bạn thấy dữ liệu mới.
- Người khác refresh website sẽ thấy dữ liệu mới.
- Trang chính tự kiểm tra dữ liệu mới mỗi 60 giây nếu đang mở.

---

# Rule nhiều chi nhánh

Mỗi chi nhánh vẫn là **một dòng riêng** trong Google Sheet.

Ví dụ KOI Thé:

| brandId | name | branch | district | address |
|---|---|---|---|---|
| koi-the | KOI Thé | Hồ Tùng Mậu | Quận 1 | 108 Hồ Tùng Mậu |
| koi-the | KOI Thé | Pasteur | Quận 1 | 120 Pasteur |
| koi-the | KOI Thé | Riviera Point | Quận 7 | A-13 Riviera Point... |

Điều quan trọng là tất cả chi nhánh phải có cùng `brandId`.

Website sẽ tự biến chúng thành:

`KOI Thé — 3 chi nhánh — [Xem chi nhánh]`

và không hiện 3 card KOI Thé riêng biệt.

## Khi thêm chi nhánh mới

Nếu để trống `Mã thương hiệu`, admin tự tạo từ tên quán.

Ví dụ:

- `KOI Thé` → `koi-the`
- `Mixue` → `mixue`
- `Highlands Coffee` → `highlands-coffee`

Nếu một thương hiệu đang có sẵn, tốt nhất copy đúng `brandId` của các chi nhánh cũ.

---

# Khi sửa Code.gs sau này

Mỗi lần thay đổi code Apps Script:

1. Deploy → **Manage deployments**.
2. Edit deployment.
3. Chọn **New version**.
4. Deploy lại.

URL `/exec` có thể giữ nguyên nếu bạn cập nhật deployment hiện tại.

---

# Bảo mật

- Website public chỉ cần quyền **đọc** danh sách quán.
- Mọi request thêm/sửa/xóa phải có `ADMIN_TOKEN`.
- Token chỉ được nhập trong `admin.html` và lưu bằng `sessionStorage`, đóng tab trình duyệt là mất.
- Không commit token lên GitHub.

Đây là mức bảo vệ phù hợp cho một website cá nhân nhỏ. Nếu sau này cần nhiều admin/tài khoản người dùng, nên chuyển sang Supabase/Firebase Auth hoặc backend riêng.
