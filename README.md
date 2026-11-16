# BKK Swipe

Web app chạy trên trình duyệt điện thoại: cả nhóm **vuốt trái/phải** để chọn địa điểm ở Bangkok, app gộp lựa chọn, **xếp lịch 8–12/12/2026** và **chỉ đường từ vị trí hiện tại** (mở Google Maps).

Không cần backend, không cần build. Chỉ có HTML, CSS và JavaScript thuần nên host miễn phí được trên GitHub Pages.

## Chạy thử trên máy

```bash
cd bkk-swipe
python3 -m http.server 8000
# mở http://localhost:8000 (định vị chỉ hoạt động trên https hoặc localhost)
```

## Đưa lên GitHub Pages

1. Tạo repo tên `bkk-swipe`, đẩy toàn bộ thư mục này lên nhánh `main`.
2. Vào **Settings → Pages**, chọn *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`.
3. Sau ít phút trang có địa chỉ `https://<tên-bạn>.github.io/bkk-swipe/`. Gửi link này vào nhóm chat.

GitHub Pages dùng HTTPS nên trình duyệt cho phép xin vị trí.

## Chỉnh cho chuyến đi của bạn

| Muốn đổi | Sửa ở đâu |
|---|---|
| Ngày đi, số người, giờ bay | `config.js` |
| Khách sạn | Cài đặt ⚙️ trong app (nhập tọa độ), hoặc điền cứng trong `config.js` |
| Thêm/bớt địa điểm | `data/places.js` (mỗi nơi một khối, giữ nguyên các trường) |
| Link TikTok/Facebook do nhóm chọn | `data/curated.js` |

Tọa độ khách sạn: mở khách sạn trên Google Maps, nhấn giữ vào ghim, chép hai số ở đầu màn hình (ví dụ `13.75633, 100.50177`). Link rút gọn `maps.app.goo.gl` không chứa tọa độ nên app không đọc được.

## Dữ liệu "mới nhất" hoạt động thế nào

Ba nền tảng khác nhau nhiều về mức độ cho lấy dữ liệu, nên app dùng hai lớp:

1. **Luôn có, không cần khóa:** trong mỗi địa điểm có nút mở thẳng trang tìm kiếm **TikTok, YouTube (sắp xếp mới nhất), Facebook, Google Maps**. Bấm là ra bài mới nhất tại thời điểm đó.
2. **Tự động, cần khóa API (tùy chọn):** GitHub Actions chạy mỗi ngày (`scripts/refresh-data.mjs`), lấy
   - **YouTube Data API:** 3 video review mới nhất mỗi nơi,
   - **Google Places API:** điểm đánh giá, số lượt đánh giá, trạng thái (đóng cửa hẳn thì app tự ẩn địa điểm đó),

   rồi ghi vào `data/live.json`.

   Cách bật: tạo khóa ở Google Cloud, thêm vào **Settings → Secrets and variables → Actions** hai secret `YT_API_KEY` và `GOOGLE_PLACES_KEY`, rồi vào tab **Actions → Cập nhật dữ liệu địa điểm → Run workflow**. Đừng dán khóa vào mã nguồn hay vào chat. Hãy kiểm tra bảng giá và hạn mức miễn phí của Google trước khi bật.

**TikTok và Facebook:** không có API công khai để tìm bài của người lạ, và việc cào dữ liệu vi phạm điều khoản. Cách làm ổn là cả nhóm dán link bài hay vào `data/curated.js`.

## Gộp lựa chọn cả nhóm

Mỗi người vuốt trên máy mình. Ở tab **Top nhóm** bấm **Chia sẻ lựa chọn của tôi**, gửi link vào nhóm chat. Ai mở link sẽ tự được gộp vào bảng xếp hạng. Mọi dữ liệu nằm trên điện thoại, không có máy chủ.

## Giới hạn nên biết

- Giờ mở cửa, giá và tình trạng hoạt động có thể thay đổi. Mỗi địa điểm đã ghi nguồn và ngày kiểm tra (16/11/2026), các điểm còn thông tin trái chiều có cảnh báo ⚠️.
- Thời gian di chuyển là **ước tính** từ đường chim bay, không phải dữ liệu giao thông thật. Bấm nút Google Maps để có thời gian chính xác.
- Tuyến "ngắn nhất" tính theo đường chim bay giữa các điểm. Ở Bangkok, đi BTS/MRT thường nhanh hơn đường ngắn nhất.
- Tọa độ các nơi đánh dấu `approx: true` là gần đúng. Nút chỉ đường dùng **tên địa điểm** nên vẫn ra đúng ghim.

## Kiểm thử

```bash
node test/lib.test.js        # logic: khoảng cách, tuyến ngắn nhất, xếp lịch
python3 -I test/ui.test.py   # giao diện trên Chrome giả lập điện thoại (cần playwright)
```
