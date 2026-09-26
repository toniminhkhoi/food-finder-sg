# Ăn Đâu Đây? — Food Finder Sài Gòn

Website tĩnh để tìm quán ăn, quán nước và nhà hàng tại TP.HCM.

## Có gì trong bản này

- 139 địa điểm từ dataset v2 hiện tại.
- Bộ lọc theo khu vực, loại món, ẩm thực, bánh/tráng miệng và đồ uống.
- Search theo tên quán, món, địa chỉ.
- Random quán.
- Yêu thích bằng Local Storage.
- Chatbot "Măm Măm Bot" chạy ngay trên trình duyệt, không cần API key.
- Trang `admin.html` để thêm / sửa / xóa quán và export JSON.
- Hỗ trợ đọc dữ liệu tự động từ Google Sheet được publish dạng CSV.
- Responsive cho desktop và mobile.

## Cấu trúc file

```text
food-finder-sg/
├── index.html
├── admin.html
├── style.css
├── admin.css
├── app.js
├── admin.js
├── config.js
├── .nojekyll
├── assets/
│   └── favicon.svg
└── data/
    ├── restaurants.json
    ├── restaurants_google_sheet.csv
    └── dataset_quan_an_tphcm_v2.xlsx
```

## Chạy thử trên máy

Do web dùng `fetch()` để đọc JSON, đừng mở `index.html` trực tiếp bằng `file://`.

Nếu máy có Python, mở terminal trong thư mục và chạy:

```bash
python -m http.server 8080
```

Sau đó vào:

```text
http://localhost:8080
```

## Cách cập nhật quán mới

### Cách A — Google Sheet (khuyên dùng cho web online)

1. Upload `data/dataset_quan_an_tphcm_v2.xlsx` hoặc import `data/restaurants_google_sheet.csv` vào Google Sheets.
2. Giữ nguyên hàng tiêu đề.
3. Publish sheet dữ liệu ra web ở định dạng CSV.
4. Mở `config.js` và sửa:

```js
dataSource: "google-sheet",
googleSheetCsvUrl: "DAN_URL_CSV_VAO_DAY",
```

Từ đó về sau chỉ cần thêm/sửa dòng trong Google Sheet. Khi khách tải lại trang, web sẽ đọc data mới.

### Cách B — Trang quản lý data

1. Vào `/admin.html`.
2. Thêm/sửa/xóa quán.
3. Bấm **Export JSON**.
4. Thay file `data/restaurants.json` trên hosting bằng file vừa export.

Lưu ý: thay đổi trong `admin.html` trước khi export chỉ được lưu trong Local Storage của chính trình duyệt đó, không tự ghi lên server.

## Host miễn phí bằng GitHub Pages

1. Tạo một repository mới trên GitHub, ví dụ `an-dau-day`.
2. Upload **toàn bộ nội dung bên trong thư mục này** lên root của repository.
3. Vào **Settings → Pages**.
4. Ở **Build and deployment → Source**, chọn **Deploy from a branch**.
5. Chọn branch `main`, folder `/(root)` và bấm **Save**.
6. GitHub sẽ cấp URL dạng:

```text
https://TEN-GITHUB.github.io/an-dau-day/
```

File `.nojekyll` đã được thêm sẵn để GitHub Pages phục vụ site tĩnh trực tiếp.

## Chatbot hiện tại hoạt động thế nào?

Chatbot hiện tại không gọi ChatGPT/OpenAI API. Nó đọc dataset trên trình duyệt và hiểu các intent phổ biến như:

- `đồ Hàn ở Bình Thạnh`
- `ramen Tân Bình`
- `trà sữa Quận 10`
- `random một quán`
- `ăn gì ở Quận 7`

Ưu điểm: miễn phí, nhanh, không lộ API key và host GitHub Pages được ngay.

Nếu sau này muốn chatbot AI thật sự hiểu câu hỏi phức tạp hơn, cần thêm backend/serverless function để giữ API key an toàn. Không nên đặt API key trực tiếp trong `app.js`.
