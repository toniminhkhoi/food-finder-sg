window.FOOD_FINDER_CONFIG = {
  siteName: "Ăn Đâu Đây?",
  tagline: "Ăn gì, uống gì ở Sài Gòn?",

  // Sau khi deploy Google Apps Script, đổi thành "api" và dán URL web app bên dưới.
  // Nếu chưa cấu hình cloud, web vẫn chạy bằng data/restaurants.json.
  dataSource: "local", // "local" | "api"
  apiUrl: "",
  localDataUrl: "./data/restaurants.json",

  // Khi dùng API, web sẽ tự kiểm tra dữ liệu mới mỗi 60 giây.
  cloudRefreshMs: 60000,
  adminEnabled: true
};
