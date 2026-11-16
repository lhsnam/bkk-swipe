/*
 * Link review do cả nhóm tự chọn (TikTok / Facebook / YouTube).
 * Cách dùng: dán link bài/video vào đúng mã địa điểm (id trong data/places.js), app sẽ hiện thành nút bấm.
 * Nên dùng cách này cho TikTok và Facebook vì hai nền tảng không cho đọc dữ liệu tìm kiếm tự động.
 *
 * Ví dụ:
 *   yaowarat: [
 *     { type: "tiktok",  title: "Review ăn đêm Yaowarat",  url: "https://www.tiktok.com/@ten/video/123" },
 *     { type: "facebook", title: "Bài review của bạn A",    url: "https://www.facebook.com/..." }
 *   ]
 */
window.BKK_CURATED = {
  // yaowarat: []
};
