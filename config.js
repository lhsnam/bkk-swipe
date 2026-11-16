/* Cấu hình chuyến đi — sửa file này là đủ, không cần đụng vào app.js */
window.BKK_CONFIG = {
  appName: "BKK Swipe",

  trip: {
    start: "2026-12-08",      // Thứ Ba, đến Bangkok khoảng trưa
    end: "2026-12-12",        // Thứ Bảy, ngày về
    people: 4,
    // Khung giờ dùng được mỗi ngày. Ngày đầu: đến trưa nên bắt đầu từ chiều.
    // Ngày cuối: chưa rõ giờ bay, tạm chỉ xếp buổi sáng. Sửa lại khi có vé.
    firstDaySlots: ["afternoon", "evening", "night"],
    lastDaySlots: ["morning"]
  },

  // Khách sạn: để null thì app dùng vị trí GPS hoặc tọa độ bạn nhập trong phần Cài đặt.
  // Có thể điền cứng ở đây, ví dụ: { name: "Khách sạn ABC", lat: 13.7563, lng: 100.5018 }
  hotel: { name: "Khách sạn của nhóm", lat: null, lng: null }
};
