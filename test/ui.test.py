"""Kiểm tra giao diện bằng Chrome headless ở khung điện thoại. Chạy: python3 -I test/ui.test.py"""
import json, os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = "/tmp/bkk-shots"
os.makedirs(OUT, exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
Handler.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{port}/index.html"

errors = []
def check(cond, msg):
    print(("ok   - " if cond else "FAIL - ") + msg)
    if not cond: errors.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2, has_touch=True, is_mobile=True,
                        geolocation={"latitude": 13.7466, "longitude": 100.5393}, permissions=["geolocation"], locale="vi-VN")
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
    page.goto(URL)
    page.wait_for_selector(".card.top")
    page.screenshot(path=f"{OUT}/1-swipe.png")
    check(page.locator(".card.top h2").inner_text() == "Phố ẩm thực Yaowarat (Chinatown)", "thẻ đầu tiên là Yaowarat")

    # nút Thích
    page.click("[data-act=yes]")
    page.wait_for_function("document.querySelector('.card.top h2').innerText !== 'Phố ẩm thực Yaowarat (Chinatown)'")
    saved = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check(saved["votes"].get("yaowarat") == 1, "bấm ♥ lưu phiếu thích")

    # nút bỏ qua + hoàn tác
    page.click("[data-act=no]")
    page.wait_for_timeout(400)
    page.click("[data-act=undo]")
    saved = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check("jayfai" not in saved["votes"], "hoàn tác xóa phiếu gần nhất")

    # vuốt bằng ngón tay (mô phỏng pointer)
    box = page.locator(".card.top").bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 100)
    page.mouse.down(); page.mouse.move(box["x"] + box["width"] / 2 + 200, box["y"] + 110, steps=8); page.mouse.up()
    page.wait_for_timeout(500)
    saved = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check(saved["votes"].get("jayfai") == 1, "kéo thẻ sang phải = thích")

    # bàn phím
    page.keyboard.press("ArrowLeft"); page.wait_for_timeout(500)
    saved = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check(saved["votes"].get("jokprince") == 0, "phím ← = bỏ qua")

    # chi tiết
    page.click(".card.top .more")
    page.wait_for_selector(".sheet")
    page.screenshot(path=f"{OUT}/2-detail.png")
    hrefs = page.eval_on_selector_all(".sheet a", "els => els.map(e => e.href)")
    check(any("tiktok.com/search" in h for h in hrefs), "chi tiết có link TikTok")
    check(any("youtube.com/results" in h for h in hrefs), "chi tiết có link YouTube mới nhất")
    check(any("facebook.com/search" in h for h in hrefs), "chi tiết có link Facebook")
    check(any("google.com/maps/dir" in h for h in hrefs), "chi tiết có link chỉ đường Google Maps")
    page.keyboard.press("Escape")
    check(page.locator(".sheet").count() == 0, "Esc đóng chi tiết")

    # vuốt thích thêm vài nơi để có dữ liệu cho lịch/tuyến
    for _ in range(9):
        page.click("[data-act=yes]"); page.wait_for_timeout(330)

    # tab Gần bạn: chưa có vị trí
    page.click("[data-tab=near]")
    check("Chưa có điểm xuất phát" in page.inner_text("main"), "chưa cấp vị trí thì hiện hướng dẫn, không đoán bừa")
    page.click("[data-act=locate]")
    page.wait_for_selector("text=Tuyến ngắn nhất qua các điểm đã thích")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/3-near.png", full_page=False)
    txt = page.inner_text("main")
    check("km" in txt and "Mở cả tuyến" in txt, "Gần bạn: có khoảng cách và nút mở cả tuyến")
    first = page.locator("ul.list .row small").first.inner_text()
    check(first.startswith("0.") or first.startswith("1."), "địa điểm gần nhất (CentralWorld) cách < 2 km: " + first)

    # tab Lịch
    page.click("[data-tab=plan]")
    page.wait_for_selector(".day")
    page.screenshot(path=f"{OUT}/4-plan.png", full_page=True)
    days = page.locator(".day h4").all_inner_texts()
    check(days == ["Thứ Ba 8/12", "Thứ Tư 9/12", "Thứ Năm 10/12", "Thứ Sáu 11/12", "Thứ Bảy 12/12"], "5 ngày đúng thứ: " + str(days))

    # tab Top + chia sẻ mã
    page.click("[data-tab=top]")
    page.wait_for_selector(".rank")
    page.screenshot(path=f"{OUT}/5-top.png", full_page=True)
    code = page.evaluate("""() => { const t = document.querySelector('[data-act=copycode]'); return null }""")
    # tạo mã bạn bè và import
    friend = "BKK1." + page.evaluate("btoa(unescape(encodeURIComponent(JSON.stringify({n:'Lan', l:['yaowarat','watarun','jodd']}))))")
    page.fill("#importBox", friend)
    page.click("[data-act=import]")
    page.wait_for_selector("text=2/2 người thích")
    check(page.locator(".av").count() >= 2, "gộp nhóm: hiện avatar nhiều người")

    # import qua hash
    page.goto(URL + "#" + "BKK1." + page.evaluate("btoa(unescape(encodeURIComponent(JSON.stringify({n:'Minh', l:['mbk']}))))"))
    page.wait_for_selector(".rank")
    check("Minh" in page.evaluate("localStorage.getItem('bkkswipe.v1')"), "mở link chia sẻ tự thêm thành viên")

    # cài đặt: tọa độ khách sạn
    page.click("[data-act=settings]")
    page.fill("#setHotel", "https://maps.app.goo.gl/f8DfC1i9sAMK4BBA8")
    page.click("[data-act=savesettings]")
    check("Không đọc được tọa độ" in page.inner_text("#toast"), "link rút gọn bị từ chối rõ ràng")
    page.fill("#setHotel", "13.7563, 100.5018")
    page.click("[data-act=savesettings]")
    saved = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check(saved["hotel"] and abs(saved["hotel"]["lat"] - 13.7563) < 1e-6, "lưu tọa độ khách sạn")

    # không bị tràn ngang
    overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check(not overflow, "không tràn ngang trên màn 390px")

    page.close()
    # màn nhỏ 320px
    p2 = ctx.new_page(); p2.set_viewport_size({"width": 320, "height": 640}); p2.goto(URL); p2.wait_for_selector(".card.top")
    p2.screenshot(path=f"{OUT}/6-small.png")
    check(not p2.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "không tràn ngang trên màn 320px")
    b.close()

real = [l for l in logs if "favicon" not in l]
check(not real, "không có lỗi console: " + "; ".join(real))
print("\nKẾT QUẢ:", "ĐẠT" if not errors else f"{len(errors)} LỖI")
sys.exit(1 if errors else 0)
