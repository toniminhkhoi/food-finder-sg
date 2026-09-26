window.FOOD_FINDER_CONFIG = {
  siteName: "Ăn Đâu Đây?",
  tagline: "Ăn gì, uống gì ở Sài Gòn?",

  // Sau khi deploy Google Apps Script, đổi thành "api" và dán URL web app bên dưới.
  // Nếu chưa cấu hình cloud, web vẫn chạy bằng data/restaurants.json.
  dataSource: "api", // "local" | "api"
  apiUrl: "https://script.google.com/macros/s/AKfycbxUZkp7Mnud3EN9VXQXUiZI5SpyBXVyQ8rYul_TgE3Q8-qJQtOMwIb_IOI-ebOdRUr1/exec",
  localDataUrl: "./data/restaurants.json",

  // Khi dùng API, web sẽ tự kiểm tra dữ liệu mới mỗi 60 giây.
  cloudRefreshMs: 60000,
  adminEnabled: true
};
