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
    import re, base64
    PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
    def ext(route):  # chặn mạng ngoài, giả lập oEmbed và ảnh thumbnail
        u = route.request.url
        if "oembed" in u:
            route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps({"title": "Tiêu đề tự lấy <b>x</b>"}))
        elif "nominatim" in u:
            import urllib.parse
            q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query).get("q", [""])[0]
            body = json.dumps([{"lat": "13.7466", "lon": "100.5393"}] if "Tìm Được" in q else [])
            route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=body)
        elif "ytimg.com" in u:
            route.fulfill(status=200, content_type="image/png", body=PNG)
        else:
            route.abort()
    page.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), ext)
    logs = []
    def state():
        return json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
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

    # ----- mục Link: thêm link TikTok / YouTube -----
    page.click("[data-tab=links]")
    page.wait_for_selector("#linkUrl")
    page.screenshot(path=f"{OUT}/7-links-empty.png")
    page.click("[data-act=formmode][data-mode=review]")
    page.fill("#linkUrl", "https://example.com/abc")
    check("Chưa nhận ra" in page.inner_text("#linkHint"), "gợi ý báo link lạ ngay khi gõ")
    page.click("[data-act=addlink]")
    check("không hợp lệ" in page.inner_text("#toast"), "link không phải TikTok/YouTube bị từ chối")
    check(json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')")).get("links") == [], "link lạ không được lưu")

    page.fill("#linkUrl", "Xem nè bạn ơi https://youtu.be/dQw4w9WgXcQ?si=tracking123 hay lắm")
    check("YouTube" in page.inner_text("#linkHint"), "gợi ý nhận ra YouTube từ đoạn chữ chia sẻ")
    page.select_option("#linkPlaceSel", "watarun")
    page.fill("#linkTitle", "Hoàng hôn đẹp")
    page.click("[data-act=addlink]")
    page.wait_for_selector(".linkrow")
    st = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check(st["links"][0]["url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ" and st["links"][0]["place"] == "watarun", "YouTube được chuẩn hóa link, gắn đúng địa điểm")
    check(page.locator(".linkrow img").count() == 1 and "ytimg.com/vi/dQw4w9WgXcQ" in page.get_attribute(".linkrow img", "src"), "YouTube hiện ảnh thumbnail")
    check("Hoàng hôn đẹp" in page.inner_text("main"), "hiện tiêu đề do người dùng nhập")

    page.fill("#linkUrl", "https://www.tiktok.com/@naydidaunhi/video/7704723121135275284?is_from_webapp=1&sender_device=pc")
    page.select_option("#linkPlaceSel", "yaowarat")
    page.click("[data-act=addlink]")
    page.wait_for_function("document.querySelectorAll('.linkrow').length === 2")
    page.wait_for_function("document.querySelector('main').innerText.includes('Tiêu đề tự lấy')")  # oEmbed tự điền
    st = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    tk = [l for l in st["links"] if l["type"] == "tiktok"][0]
    check(tk["url"] == "https://www.tiktok.com/@naydidaunhi/video/7704723121135275284", "TikTok được bỏ tham số theo dõi")
    check("<" not in tk["title"], "tiêu đề oEmbed được làm sạch ký tự HTML")
    check(page.locator("main b >> text=<b>").count() == 0, "tiêu đề không chèn được thẻ HTML")

    page.fill("#linkUrl", "https://www.tiktok.com/@naydidaunhi/video/7704723121135275284")
    page.select_option("#linkPlaceSel", "yaowarat")
    page.click("[data-act=addlink]")
    check("đã có" in page.inner_text("#toast"), "link trùng bị báo, không lưu hai lần")
    page.screenshot(path=f"{OUT}/8-links.png", full_page=True)

    # chi tiết địa điểm hiện link và nút thêm
    page.click("button[data-act=detail][data-id=watarun]")
    page.wait_for_selector(".sheet .linkrow")
    check("Hoàng hôn đẹp" in page.inner_text(".sheet"), "chi tiết địa điểm hiện link của nhóm")
    page.click("[data-act=gotoadd]")
    page.wait_for_selector("#linkUrl")
    check(page.input_value("#linkPlaceSel") == "watarun", "nút ➕ trong chi tiết chọn sẵn đúng địa điểm")

    # chia sẻ: mã của tôi có link; mã bạn bè chứa link độc hại chỉ nhận phần hợp lệ
    code = page.evaluate("""() => { const t = JSON.parse(localStorage.getItem('bkkswipe.v1')); return t.links.filter(l=>l.mine).length }""")
    check(code == 2, "2 link của tôi sẽ được kèm khi chia sẻ")
    payload = {"n": "Lan", "l": ["mbk"], "k": [
        ["mbk", "https://www.youtube.com/watch?v=abcdefghijk", "Review MBK"],
        ["mbk", "javascript:alert(1)", "xấu"],
        ["mbk", "https://tiktok.com.evil.com/@a/video/1", "giả mạo"],
        ["khong-ton-tai", "https://www.tiktok.com/@a/video/2", "sai id"]]}
    friend = "BKK1." + page.evaluate("p => btoa(unescape(encodeURIComponent(JSON.stringify(p))))", payload)
    page.click("[data-tab=top]")
    page.fill("#importBox", friend)
    page.click("[data-act=import]")
    st = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    imported = [l for l in st["links"] if l["by"] == "Lan"]
    check(len(imported) == 1 and imported[0]["place"] == "mbk" and not imported[0]["mine"], "chỉ nhận 1 link hợp lệ từ bạn bè, bỏ link độc hại và sai địa điểm")

    # xóa link
    page.click("[data-tab=links]")
    n_before = page.locator(".linkrow").count()
    page.locator("[data-act=rmlink]").first.click()
    page.wait_for_function(f"document.querySelectorAll('.linkrow').length === {n_before - 1}")
    check(True, "xóa link hoạt động")
    check("curated.js" in page.inner_text("main"), "có hướng dẫn lưu vĩnh viễn vào data/curated.js")

    # ----- thêm ĐỊA ĐIỂM MỚI từ link -----
    page.click("[data-tab=links]")
    page.click("[data-act=formmode][data-mode=new]")
    page.fill("#linkUrl", "https://www.tiktok.com/@naydidaunhi/video/7704723121135275284?is_from_webapp=1&sender_device=pc")
    page.click("[data-act=addplace]")
    check("tên địa điểm" in page.inner_text("#toast"), "thiếu tên địa điểm thì nhắc, không thêm")
    check(state()["custom"] == [], "chưa nhập tên thì không tạo địa điểm")
    page.fill("#newName", "Quán Thử Nghiệm")
    page.click("[data-act=newcat][data-cat=night]")
    check(page.input_value("#newName") == "Quán Thử Nghiệm" and "tiktok.com" in page.input_value("#linkUrl"), "đổi loại không làm mất chữ đã gõ")
    page.fill("#newLoc", "https://maps.app.goo.gl/abc")
    page.click("[data-act=addplace]")
    check("Không đọc được vị trí" in page.inner_text("#toast") and state()["custom"] == [], "link Maps rút gọn bị từ chối rõ ràng, không tạo địa điểm")
    page.fill("#newLoc", "13.7500, 100.5000")
    page.fill("#newNote", "Chợ đêm ngon")
    page.click("[data-act=addplace]")
    page.wait_for_selector("text=Địa điểm đã thêm từ link (1)")
    st = state()
    c0 = st["custom"][0]
    check(c0["name"] == "Quán Thử Nghiệm" and c0["cat"] == "night" and c0["exact"] and c0["lat"] == 13.75, "tạo địa điểm mới đúng tên, loại, vị trí")
    pid = c0["id"]
    check(pid.startswith("u-") and st["votes"].get(pid) == 1, "địa điểm mới có mã u-… và được tự đánh dấu thích")
    check(any(l["place"] == pid and l["url"].endswith("7704723121135275284") for l in st["links"]), "link TikTok gắn vào địa điểm mới (đã bỏ tham số theo dõi)")
    page.fill("#linkUrl", "https://www.tiktok.com/@naydidaunhi/video/7704723121135275284")
    page.fill("#newName", "Quán Thử Nghiệm")
    page.click("[data-act=addplace]")
    check("đã được thêm" in page.inner_text("#toast") and len(state()["custom"]) == 1, "cùng link và cùng tên không tạo địa điểm trùng (khác tên thì được, vì một video có thể nhắc nhiều nơi)")

    page.click("[data-tab=top]")
    check("Quán Thử Nghiệm" in page.inner_text("main"), "địa điểm mới hiện trong Top nhóm")
    page.click("button[data-act=detail][data-id=%s]" % pid)
    page.wait_for_selector(".sheet")
    sheet_txt = page.inner_text(".sheet")
    check("Thêm bởi" in sheet_txt and "Xóa địa điểm này" in sheet_txt and "Chợ đêm ngon" in sheet_txt, "chi tiết địa điểm mới có người thêm, ghi chú, nút xóa")
    hrefs = page.eval_on_selector_all(".sheet a", "els => els.map(e => e.href)")
    check(any("tiktok.com/@naydidaunhi/video" in h for h in hrefs), "chi tiết có link video TikTok gốc")
    check(any("google.com/maps/dir" in h and "13.75%2C100.5" in h for h in hrefs), "chỉ đường dùng đúng tọa độ đã nhập")
    page.keyboard.press("Escape")

    # địa điểm không tìm ra vị trí
    page.click("[data-tab=links]")
    page.fill("#linkUrl", "https://youtu.be/abcdefghijk")
    page.fill("#newName", "Quán Không Có Vị Trí")
    page.click("[data-act=addplace]")
    page.wait_for_selector("text=Địa điểm đã thêm từ link (2)")
    page.wait_for_timeout(600)
    c1 = state()["custom"][1]
    check(c1["lat"] is None and "chưa có vị trí" in page.inner_text("main"), "không tìm được vị trí thì vẫn thêm, ghi rõ 'chưa có vị trí'")

    # địa điểm tự tìm được vị trí theo tên
    page.fill("#linkUrl", "https://www.tiktok.com/@a/video/111222333")
    page.fill("#newName", "Quán Tìm Được Vị Trí")
    page.click("[data-act=addplace]")
    page.wait_for_function("(() => { const s = JSON.parse(localStorage.getItem('bkkswipe.v1')); const c = s.custom.find(x => x.name.includes('Tìm Được')); return c && c.lat !== null; })()")
    c2 = [c for c in state()["custom"] if "Tìm Được" in c["name"]][0]
    check(abs(c2["lat"] - 13.7466) < 1e-6 and c2["exact"] is False, "tự tìm vị trí theo tên, đánh dấu là gần đúng")

    # lịch vẫn chạy khi có địa điểm không có tọa độ
    page.click("[data-tab=plan]")
    page.wait_for_selector(".day")
    page.select_option("#minVotes", "1")  # nhóm đã có nhiều thành viên: hạ ngưỡng để thấy địa điểm chỉ mình thích
    page.wait_for_selector(".day")
    check("Quán Không Có Vị Trí" in page.inner_text("main"), "lịch xếp được cả địa điểm chưa có vị trí, không bị lỗi")

    # chia sẻ: nhận địa điểm tự thêm từ bạn bè, loại bỏ dữ liệu xấu
    payload = {"n": "Hùng", "l": ["u-friend1", "mbk"], "k": [["u-friend1", "https://www.tiktok.com/@h/video/999", "Review của Hùng"]],
               "c": [{"id": "u-friend1", "n": "<img src=x onerror=alert(1)>Quán của Hùng", "c": "food", "la": 13.7, "ln": 100.5, "x": 1, "t": "ngon <b>lắm</b>"},
                     {"id": "BAD ID!", "n": "Sai id", "c": "food"},
                     {"id": "u-badcat1", "n": "Sai loại", "c": "hack"},
                     {"id": "u-farpos1", "n": "Vị trí vô lý", "c": "shop", "la": 91, "ln": 500, "x": 1}]}
    friend = "BKK1." + page.evaluate("p => btoa(unescape(encodeURIComponent(JSON.stringify(p))))", payload)
    page.click("[data-tab=top]")
    page.fill("#importBox", friend)
    page.click("[data-act=import]")
    st = state()
    ids = [c["id"] for c in st["custom"]]
    check("u-friend1" in ids and "u-farpos1" in ids and "BAD ID!" not in ids and "u-badcat1" not in ids, "chỉ nhận địa điểm hợp lệ từ bạn bè")
    fr = [c for c in st["custom"] if c["id"] == "u-friend1"][0]
    check("<" not in fr["name"] and "<" not in fr["note"] and fr["by"] == "Hùng" and fr["mine"] is False, "tên/ghi chú được làm sạch, ghi đúng người thêm")
    far = [c for c in st["custom"] if c["id"] == "u-farpos1"][0]
    check(far["lat"] is None, "tọa độ vô lý bị bỏ")
    check(any(l["place"] == "u-friend1" for l in st["links"]), "link của bạn bè gắn đúng vào địa điểm của họ")
    check(page.locator("main img[onerror]").count() == 0, "không chèn được HTML từ tên địa điểm")
    top_txt = page.inner_text("main")
    check("Quán của Hùng" in top_txt and "1/4 người thích" in top_txt, "phiếu thích của bạn bè cho địa điểm tự thêm được tính vào Top (1/4 người)")

    # xóa địa điểm (2 bước)
    page.click("button[data-act=detail][data-id=%s]" % pid)
    page.wait_for_selector(".sheet")
    page.click("[data-act=rmplace]")
    check(pid in [c["id"] for c in state()["custom"]], "bấm xóa lần đầu chỉ xin xác nhận")
    page.click("[data-act=rmplace]")
    st = state()
    check(pid not in [c["id"] for c in st["custom"]] and pid not in st["votes"] and not any(l["place"] == pid for l in st["links"]), "xóa địa điểm xóa luôn phiếu và link của nó")

    # phân tích video: dán caption -> gợi ý nhiều địa điểm -> thêm các nơi đã chọn
    page.keyboard.press("Escape")
    page.click("[data-tab=links]")
    page.fill("#linkUrl", "https://www.tiktok.com/@abc/video/9988776655443322110")
    page.fill("#anText", "📍 Thip Samai Pad Thai - Maha Chai Rd\nSau đó ghé Wat Arun ngắm hoàng hôn #bangkok #fyp")
    page.click("[data-act=analyze]")
    page.wait_for_selector(".cand")
    n_c = page.locator(".cand").count()
    check(n_c >= 2, f"phân tích video tìm được nhiều gợi ý ({n_c})")
    check(page.locator("#cn-0, #cn-1, #cn-2").count() >= 1, "gợi ý có ô sửa tên")
    nm_id = page.evaluate("(() => { const i = [...document.querySelectorAll('.cand input')].find(x => /Thip/.test(x.value)); return i && i.id; })()")
    check(bool(nm_id), "có gợi ý Thip Samai")
    page.fill("#" + nm_id, "Thip Samai Pad Thai (sửa tên)")
    page.click("[data-act=addcands]")
    st = state()
    check(any(c["name"] == "Thip Samai Pad Thai (sửa tên)" for c in st["custom"]), "thêm địa điểm từ phân tích với tên đã sửa")
    check(any(l["place"] == "watarun" and "9988776655443322110" in l["url"] for l in st["links"]), "nơi có sẵn (Wat Arun) được gắn link và đánh dấu thích")
    check(st["votes"].get("watarun") == 1, "nơi có sẵn được đánh dấu thích")
    check(not any(("fyp" in c["name"].lower() or c["name"].lower() == "bangkok") for c in st["custom"]), "không thêm hashtag chung chung")
    page.click("[data-tab=links]")
    page.fill("#linkUrl", "https://www.tiktok.com/@abc/video/9988776655443322110")
    page.fill("#anText", "📍 Thip Samai Pad Thai")
    page.click("[data-act=analyze]"); page.wait_for_selector(".cand")
    cnt = len(state()["custom"])
    page.fill("#cn-0", "Thip Samai Pad Thai (sửa tên)")
    page.click("[data-act=addcands]")
    check(len(state()["custom"]) == cnt, "phân tích lại cùng link/tên không tạo trùng")

    # cài đặt: tọa độ khách sạn
    page.click("[data-act=settings]")
    page.fill("#setHotel", "https://maps.app.goo.gl/f8DfC1i9sAMK4BBA8")
    page.click("[data-act=savesettings]")
    check("Không đọc được tọa độ" in page.inner_text("#toast"), "link rút gọn bị từ chối rõ ràng")
    page.fill("#setHotel", "13.7563, 100.5018")
    page.click("[data-act=savesettings]")
    saved = json.loads(page.evaluate("localStorage.getItem('bkkswipe.v1')"))
    check(saved["hotel"] and abs(saved["hotel"]["lat"] - 13.7563) < 1e-6, "lưu tọa độ khách sạn")

    page.click("[data-tab=near]")
    page.wait_for_selector("text=Tất cả địa điểm theo khoảng cách")
    near = page.inner_text("main")
    check("Chưa có vị trí" in near and "Quán Không Có Vị Trí" in near, "Gần bạn: địa điểm chưa có vị trí xếp cuối, ghi rõ")

    # không bị tràn ngang
    overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check(not overflow, "không tràn ngang trên màn 390px")

    page.close()
    # màn nhỏ 320px
    # kịch bản bộ nhớ đệm: app.js mới nhưng lib.js cũ (không có parseVideoLink)
    import subprocess
    old = subprocess.run(["git", "-C", "/home/claude/bkk-swipe-repo", "show", "c274b36:lib.js"], capture_output=True, text=True).stdout
    p3 = ctx.new_page()
    p3.route(re.compile(r"/lib\.js"), lambda r: r.fulfill(status=200, content_type="application/javascript", body=old))
    p3.goto(URL)
    p3.wait_for_selector("text=Cần tải lại trang")
    check(p3.locator("button", has_text="Tải lại bản mới").count() == 1, "lib.js cũ lẫn app.js mới: báo 'Cần tải lại trang' thay vì im lặng")
    p3.close()
    p2 = ctx.new_page(); p2.set_viewport_size({"width": 320, "height": 640}); p2.goto(URL); p2.wait_for_selector(".card.top")
    p2.screenshot(path=f"{OUT}/6-small.png")
    check(not p2.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "không tràn ngang trên màn 320px")
    b.close()

real = [l for l in logs if "favicon" not in l]
check(not real, "không có lỗi console: " + "; ".join(real))
print("\nKẾT QUẢ:", "ĐẠT" if not errors else f"{len(errors)} LỖI")
sys.exit(1 if errors else 0)
