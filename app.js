(function () {
  "use strict";

  var C = window.BKK_CONFIG;
  var L = window.BKK;
  var ALL = window.BKK_PLACES;

  // Nếu trình duyệt giữ lẫn file cũ và mới (bộ nhớ đệm), báo rõ thay vì im lặng không chạy.
  if (!C || !L || !ALL || typeof L.parseVideoLink !== "function") {
    document.getElementById("app").innerHTML =
      '<div style="padding:28px 20px;font-family:system-ui,sans-serif"><h2>Cần tải lại trang</h2>' +
      "<p>Trình duyệt đang giữ một phần bản cũ của BKK Swipe. Bấm nút dưới để tải bản mới nhất.</p>" +
      '<button style="padding:12px 18px;border-radius:12px;border:0;background:#e8317a;color:#fff;font-weight:700;font-size:16px" ' +
      'onclick="location.href=location.pathname+\'?r=\'+Date.now()">Tải lại bản mới</button></div>';
    return;
  }
  var CURATED = window.BKK_CURATED || {};
  var KEY = "bkkswipe.v1";
  var BANGKOK = { lat: 13.7563, lng: 100.5018 };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CATS = [
    { k: "all", vi: "Tất cả", e: "✨" },
    { k: "food", vi: "Ăn uống", e: "🍜" },
    { k: "photo", vi: "Chụp ảnh", e: "📸" },
    { k: "shop", vi: "Mua sắm", e: "🛍️" },
    { k: "night", vi: "Chợ đêm", e: "🌙" },
    { k: "sky", vi: "Rooftop", e: "🌃" }
  ];
  var CAT_VI = {}; CATS.forEach(function (c) { CAT_VI[c.k] = c.e + " " + c.vi; });
  var MODES = [{ k: "transit", vi: "BTS/MRT" }, { k: "walking", vi: "Đi bộ" }, { k: "driving", vi: "Grab/taxi" }];
  var MODE_VI = { transit: "BTS/MRT", walking: "đi bộ", driving: "Grab/taxi" };
  var SLOT_VI = { morning: "Sáng", afternoon: "Chiều", evening: "Tối", night: "Khuya" };
  var WD_VI = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  var PRICE = ["", "฿", "฿฿", "฿฿฿"];
  var CAT_E = { food: "🍜", photo: "📸", shop: "🛍️", night: "🌙", sky: "🌃" };
  var CAT_SLOTS = { food: ["afternoon", "evening"], photo: ["morning", "afternoon"], shop: ["afternoon"], night: ["evening", "night"], sky: ["evening", "night"] };

  /* ---------- Trạng thái ---------- */
  function defaults() { return { name: "", votes: {}, hotel: null, mode: "transit", members: [], minVotes: 0, links: [], custom: [] }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object") return Object.assign(defaults(), s);
    } catch (e) { /* bỏ qua */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } }

  var S = load();
  var live = { updatedAt: null, places: {} };
  var gps = null;
  var tab = "swipe";
  var cat = "all";
  var undo = [];
  var openId = null;
  var openKind = null; // "place" | "settings"
  var resetArmed = false;
  var linkPlace = ALL[0].id; // địa điểm đang chọn trong form thêm link
  var formMode = "new"; // "new" = tạo địa điểm mới từ link, "review" = gắn link vào địa điểm có sẵn
  var newCat = "food";
  var formVals = { url: "", name: "", loc: "", note: "", title: "" };
  var delArmedId = null;
  var lastTab = "swipe";

  /* ---------- Tiện ích ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function fmtDate(iso) { var p = iso.split("-"); return Number(p[2]) + "/" + Number(p[1]); }
  function byId(id) { return ALL.concat(customPlaces()).filter(function (p) { return p.id === id; })[0]; }

  function places() {
    return ALL.concat(customPlaces()).filter(function (p) {
      var lp = live.places[p.id];
      return !(lp && lp.status === "CLOSED_PERMANENTLY");
    });
  }
  function likedIds() { return Object.keys(S.votes).filter(function (id) { return S.votes[id] === 1 && byId(id); }); }

  /* ---------- Vị trí xuất phát ---------- */
  function gpsFar() { return gps && L.haversine(gps, BANGKOK) > 80; }
  function origin() {
    if (gps && !gpsFar()) return { lat: gps.lat, lng: gps.lng, label: "vị trí hiện tại" };
    if (S.hotel) return { lat: S.hotel.lat, lng: S.hotel.lng, label: "khách sạn" };
    if (C.hotel && C.hotel.lat != null) return { lat: C.hotel.lat, lng: C.hotel.lng, label: "khách sạn" };
    return null;
  }
  function originParam() { var o = origin(); return o ? o.lat.toFixed(6) + "," + o.lng.toFixed(6) : null; }
  function distText(p) {
    var o = origin();
    if (!o || !L.hasCoords(p)) return "";
    var km = L.haversine(o, p);
    return "📍 " + km.toFixed(1) + " km từ " + o.label + " · ~" + L.estimateMinutes(km, S.mode) + " phút " + MODE_VI[S.mode];
  }
  function dirUrl(list, mode) {
    return L.mapsDirUrl({ origin: originParam(), stops: list.map(function (p) { return p.mq || p.q; }), mode: mode || S.mode });
  }

  function locate() {
    if (!navigator.geolocation) { toast("Trình duyệt này không hỗ trợ định vị."); return; }
    toast("Đang lấy vị trí của bạn…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      gps = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
      toast(gpsFar() ? "Bạn đang ở xa Bangkok, app tạm tính khoảng cách từ khách sạn." : "Đã lấy vị trí của bạn.");
      render();
    }, function (err) {
      var m = {
        1: "Bạn chưa cho phép vị trí. Hãy bật lại quyền vị trí cho trang này trong cài đặt trình duyệt (biểu tượng ổ khóa cạnh thanh địa chỉ).",
        2: "Không xác định được vị trí. Hãy bật GPS hoặc ra chỗ thoáng rồi thử lại.",
        3: "Lấy vị trí quá lâu. Hãy thử lại."
      };
      toast(m[err.code] || "Không lấy được vị trí.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  /* ---------- Nhóm ---------- */
  function members() { return [{ n: S.name || "Tôi", l: likedIds(), me: true }].concat(S.members); }
  function scoreMap() {
    var map = {};
    members().forEach(function (m) { m.l.forEach(function (id) { (map[id] = map[id] || []).push(m.n); }); });
    return map;
  }
  function myCode() {
    var k = S.links.filter(function (l) { return l.mine; }).slice(0, 40).map(function (l) { return [l.place, l.url, l.title || ""]; });
    var c = S.custom.filter(function (x) { return x.mine; }).slice(0, 20).map(function (x) {
      return { id: x.id, n: x.name, c: x.cat, la: x.lat, ln: x.lng, x: x.exact ? 1 : 0, t: x.note || "" };
    });
    var o = { n: (S.name || "Tôi").slice(0, 20), l: likedIds(), k: k, c: c };
    return "BKK1." + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  }
  function parseCode(s) {
    var i = String(s || "").indexOf("BKK1.");
    if (i < 0) return null;
    try {
      var raw = s.slice(i + 5).trim().replace(/[^A-Za-z0-9+/=_-]+.*$/, "");
      var o = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (!o || typeof o.n !== "string" || !Array.isArray(o.l)) return null;
      var cs = (Array.isArray(o.c) ? o.c : []).slice(0, 20).map(function (x) {
        if (!x || typeof x !== "object" || !/^u-[a-z0-9]{3,10}$/.test(String(x.id))) return null;
        var nm = String(x.n || "").replace(/[<>]/g, "").trim().slice(0, 60);
        if (!nm || !CAT_E[x.c]) return null;
        var la = Number(x.la), ln = Number(x.ln);
        var okPos = x.la != null && x.ln != null && isFinite(la) && isFinite(ln) && inThailand(la, ln);
        return { id: x.id, name: nm, cat: x.c, lat: okPos ? la : null, lng: okPos ? ln : null, exact: okPos && x.x === 1, note: String(x.t || "").replace(/[<>]/g, "").slice(0, 120) };
      }).filter(Boolean);
      var known = function (id) { return !!byId(id) || cs.some(function (c) { return c.id === id; }); };
      var k = (Array.isArray(o.k) ? o.k : []).slice(0, 40).map(function (x) {
        if (!Array.isArray(x) || !known(x[0])) return null;
        var pv = L.parseVideoLink(x[1]); // kiểm tra lại, không tin dữ liệu từ người khác
        if (!pv) return null;
        return { place: x[0], url: pv.url, type: pv.type, id: pv.id, title: String(x[2] || "").replace(/[<>]/g, "").slice(0, 80) };
      }).filter(Boolean);
      return { n: o.n.replace(/[<>]/g, "").slice(0, 20) || "Bạn", l: o.l.filter(function (id) { return /^[a-z0-9-]{1,40}$/.test(String(id)); }), k: k, c: cs };
    } catch (e) { return null; }
  }
  function addMember(m) {
    (m.c || []).forEach(function (c) {
      if (S.custom.some(function (x) { return x.id === c.id; })) return;
      S.custom.push({ id: c.id, name: c.name, cat: c.cat, lat: c.lat, lng: c.lng, exact: c.exact, note: c.note, by: m.n, mine: false });
    });
    (m.k || []).forEach(function (x) { pushLink(x.place, L.parseVideoLink(x.url), x.title, m.n, false); });
    S.members = S.members.filter(function (x) { return x.n !== m.n; })
      .concat([{ n: m.n, l: m.l.filter(function (id) { return !!byId(id); }) }]);
    save();
  }

  /* ---------- Link review (TikTok / YouTube / Facebook) ---------- */
  var PLAT = { youtube: { vi: "YouTube", e: "▶️" }, tiktok: { vi: "TikTok", e: "🎵" }, facebook: { vi: "Facebook", e: "📘" } };
  function pushLink(placeId, pv, title, by, mine) {
    if (!pv || !byId(placeId)) return null;
    var dup = S.links.some(function (l) { return l.place === placeId && l.url === pv.url; });
    if (dup) return null;
    var e = {
      lid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      place: placeId, url: pv.url, type: pv.type, id: pv.id,
      title: String(title || "").replace(/[<>]/g, "").trim().slice(0, 80), by: by, mine: !!mine
    };
    S.links.push(e);
    return e;
  }
  function linksFor(placeId) {
    var fromRepo = (CURATED[placeId] || []).map(function (c) {
      var pv = L.parseVideoLink(c.url);
      return pv ? { type: pv.type, id: pv.id, url: pv.url, title: c.title || "", by: "Nhóm (repo)", fixed: true } : null;
    }).filter(Boolean);
    return fromRepo.concat(S.links.filter(function (l) { return l.place === placeId; }));
  }
  function linkLabel(l) {
    if (l.title) return l.title;
    var m = l.url.match(/tiktok\.com\/(@[^/]+)/);
    if (m) return "Video của " + m[1];
    return PLAT[l.type].vi + " · " + l.url.replace(/^https:\/\/(www\.)?/, "").slice(0, 42);
  }
  function linkRow(l) {
    var thumb = l.type === "youtube" && l.id
      ? '<img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + encodeURIComponent(l.id) + '/mqdefault.jpg">'
      : '<span class="em" aria-hidden="true">' + PLAT[l.type].e + "</span>";
    return '<div class="linkrow"' + (l.lid ? ' id="lk-' + l.lid + '"' : "") + '><a class="vid" target="_blank" rel="noopener" href="' + esc(l.url) + '">' + thumb +
      "<span><b>" + esc(linkLabel(l)) + "</b><br>" + PLAT[l.type].vi + (l.by ? " · " + esc(l.by) : "") + "</span></a>" +
      (l.lid ? '<button class="icon-btn" data-act="rmlink" data-lid="' + l.lid + '" aria-label="Xóa link">🗑️</button>' : "") + "</div>";
  }
  var activeIsInput = function () { return /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); };
  function autoTitle(entry) {
    // Cố lấy tiêu đề từ oEmbed của nền tảng; không được thì thôi (link vẫn dùng bình thường).
    if (!window.fetch || !window.AbortController || entry.title) return;
    var ep = entry.type === "youtube" ? "https://www.youtube.com/oembed?format=json&url=" :
      entry.type === "tiktok" ? "https://www.tiktok.com/oembed?url=" : null;
    if (!ep) return;
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 3000);
    fetch(ep + encodeURIComponent(entry.url), { signal: ctl.signal }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      clearTimeout(timer);
      if (j && typeof j.title === "string" && j.title) {
        entry.title = j.title.replace(/[<>]/g, "").slice(0, 80); save();
        if (!activeIsInput()) render();
      }
    }).catch(function () { clearTimeout(timer); });
  }
  function curatedSnippet() {
    var by = {};
    S.links.forEach(function (l) { if (ALL.some(function (p) { return p.id === l.place; })) (by[l.place] = by[l.place] || []).push(l); });
    var lines = Object.keys(by).map(function (id) {
      return "  " + id + ": [\n" + by[id].map(function (l) {
        return "    { type: " + JSON.stringify(l.type) + ", title: " + JSON.stringify(l.title || "") + ", url: " + JSON.stringify(l.url) + " }";
      }).join(",\n") + "\n  ]";
    });
    return lines.join(",\n");
  }

  /* ---------- Địa điểm do người dùng thêm từ link ---------- */
  function inThailand(la, ln) { return la > 5 && la < 21 && ln > 97 && ln < 106; }
  function hashId(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "u-" + (h >>> 0).toString(36);
  }
  function toPlace(c) {
    var has = typeof c.lat === "number" && typeof c.lng === "number";
    var srcs = S.links.filter(function (l) { return l.place === c.id; }).map(function (l) {
      return { t: PLAT[l.type].vi + (l.by ? " · " + l.by : ""), u: l.url };
    });
    return {
      id: c.id, name: c.name, q: c.name + " Bangkok", mq: c.exact && has ? c.lat + "," + c.lng : c.name + " Bangkok",
      emoji: CAT_E[c.cat] || "📍", cats: [c.cat], lat: has ? c.lat : null, lng: has ? c.lng : null, approx: !c.exact,
      area: "Thêm bởi " + c.by, transit: "", hours: "Kiểm tra giờ trên Google Maps", price: 0, priceNote: "",
      slots: CAT_SLOTS[c.cat] || ["afternoon"], dur: 90,
      blurb: c.note || "Địa điểm do " + c.by + " thêm từ một link review. Mở link bên dưới để xem quán này có gì hay.",
      tips: [], warn: "Địa điểm do nhóm tự thêm từ link, chưa được kiểm tra giờ mở cửa và vị trí.", check: true,
      sources: srcs, custom: true, by: c.by
    };
  }
  function customPlaces() { return S.custom.map(toPlace); }
  function addCustom(o) {
    var id = hashId(o.pv.url);
    var dup = S.custom.filter(function (c) { return c.id === id; })[0];
    if (dup) return { dup: dup };
    var c = {
      id: id, name: o.name, cat: o.cat, lat: o.coords ? o.coords.lat : null, lng: o.coords ? o.coords.lng : null,
      exact: !!o.coords, note: String(o.note || "").replace(/[<>]/g, "").trim().slice(0, 120), by: o.by, mine: true
    };
    S.custom.push(c);
    return { place: c, link: pushLink(id, o.pv, "", o.by, true) };
  }
  function geocode(id) {
    // Cố tìm vị trí gần đúng theo tên bằng OpenStreetMap Nominatim (chỉ trong khu vực Bangkok). Không được thì thôi.
    if (!window.fetch || !window.AbortController) return;
    var c = S.custom.filter(function (x) { return x.id === id; })[0];
    if (!c || c.lat != null) return;
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 4000);
    fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=100.30,14.05,100.95,13.45&q=" + encodeURIComponent(c.name),
      { signal: ctl.signal, headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (arr) {
        clearTimeout(timer);
        var h = arr && arr[0];
        var la = h ? parseFloat(h.lat) : NaN, ln = h ? parseFloat(h.lon) : NaN;
        if (isFinite(la) && isFinite(ln) && inThailand(la, ln) && c.lat == null) {
          c.lat = la; c.lng = ln; c.exact = false; save();
          toast("Đã tự tìm vị trí gần đúng cho " + c.name + ".");
          if (!activeIsInput()) render();
        }
      }).catch(function () { clearTimeout(timer); });
  }
  function customBlock(p) {
    if (!p.custom) return "";
    var c = S.custom.filter(function (x) { return x.id === p.id; })[0];
    var txt = L.hasCoords(p)
      ? (c && c.exact ? "Vị trí do bạn nhập." : "Vị trí app tự tìm theo tên nên có thể lệch. Hãy kiểm tra trên bản đồ.")
      : "Chưa có vị trí nên chưa tính được khoảng cách. Dán tọa độ bên dưới nếu muốn.";
    return '<div class="banner">' + esc(txt) + "</div>" +
      '<label class="field">Cập nhật vị trí (tọa độ hoặc link Google Maps dài)<input id="cuCoords" placeholder="13.75633, 100.50177"></label>' +
      '<div class="btn-row"><button class="btn ghost" data-act="setcoords" data-id="' + p.id + '">Lưu vị trí</button>' +
      '<button class="btn ghost" data-act="rmplace" data-id="' + p.id + '">' + (delArmedId === p.id ? "Bấm lần nữa để xóa" : "Xóa địa điểm này") + "</button></div>";
  }
  function hintFor(v) {
    v = (v || "").trim();
    if (!v) return "";
    var pv = L.parseVideoLink(v);
    return pv ? "✅ Nhận diện: " + PLAT[pv.type].vi : "⚠️ Chưa nhận ra link TikTok, YouTube hoặc Facebook.";
  }

  function viewLinks() {
    var out = '<h3 class="sec">Thêm từ link TikTok / YouTube</h3>' +
      '<div class="banner">Thấy một quán, chỗ chụp ảnh hay chợ đêm trong video? Dán link và đặt tên địa điểm, app sẽ thêm vào danh sách vuốt cho cả nhóm.</div>' +
      '<div class="seg" role="group" aria-label="Kiểu thêm">' +
      '<button data-act="formmode" data-mode="new" aria-pressed="' + (formMode === "new") + '">Địa điểm mới</button>' +
      '<button data-act="formmode" data-mode="review" aria-pressed="' + (formMode === "review") + '">Review cho nơi có sẵn</button></div>' +
      '<label class="field">Link TikTok / YouTube<input id="linkUrl" inputmode="url" autocomplete="off" autocapitalize="off" value="' + esc(formVals.url) + '" placeholder="https://www.tiktok.com/@…/video/… hoặc https://youtu.be/…"></label>' +
      '<div class="live-note" id="linkHint" aria-live="polite">' + esc(hintFor(formVals.url)) + "</div>";
    if (formMode === "new") {
      out += '<label class="field">Tên địa điểm<input id="newName" maxlength="60" autocomplete="off" value="' + esc(formVals.name) + '" placeholder="Ví dụ: Thip Samai Pad Thai"></label>' +
        '<div class="live-note">App chưa tự đọc được tên quán từ video, nên bạn nhập tên nhé.</div>' +
        '<div class="field">Loại</div><div class="chips-row wrap" role="group" aria-label="Loại địa điểm">' +
        CATS.filter(function (c) { return c.k !== "all"; }).map(function (c) {
          return '<button class="chip-btn" data-act="newcat" data-cat="' + c.k + '" aria-pressed="' + (newCat === c.k) + '">' + c.e + " " + c.vi + "</button>";
        }).join("") + "</div>" +
        '<label class="field">Vị trí (không bắt buộc)<input id="newLoc" autocomplete="off" value="' + esc(formVals.loc) + '" placeholder="Tọa độ hoặc link Google Maps dài. Bỏ trống để app tự tìm theo tên"></label>' +
        '<label class="field">Ghi chú (không bắt buộc)<input id="newNote" maxlength="120" autocomplete="off" value="' + esc(formVals.note) + '" placeholder="Ví dụ: ngon, xếp hàng 30 phút"></label>' +
        '<button class="btn pink block" data-act="addplace">➕ Thêm vào danh sách vuốt</button>';
    } else {
      var opts = places().filter(function (p) { return !p.custom; }).map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === linkPlace ? " selected" : "") + ">" + p.emoji + " " + esc(p.name) + "</option>";
      }).join("");
      out += '<label class="field">Review này về địa điểm nào?<select id="linkPlaceSel">' + opts + "</select></label>" +
        '<label class="field">Ghi chú / tiêu đề (không bắt buộc)<input id="linkTitle" maxlength="80" autocomplete="off" value="' + esc(formVals.title) + '" placeholder="Ví dụ: xếp hàng 30 phút"></label>' +
        '<button class="btn pink block" data-act="addlink">Thêm link review</button>';
    }

    if (S.custom.length) {
      out += '<h3 class="sec">Địa điểm đã thêm từ link (' + S.custom.length + ')</h3><ul class="list">' + customPlaces().map(function (p) {
        return '<li><button class="row" data-act="detail" data-id="' + p.id + '"><span class="em" aria-hidden="true">' + p.emoji + "</span>" +
          '<span class="tx"><b>' + esc(p.name) + "</b><small>" + esc(p.area) + (L.hasCoords(p) ? "" : " · chưa có vị trí") + "</small></span></button></li>";
      }).join("") + "</ul>";
    }

    var any = false, groups = "";
    ALL.forEach(function (p) {
      var ls = linksFor(p.id);
      if (!ls.length) return;
      any = true;
      groups += '<h4 class="grp"><button data-act="detail" data-id="' + p.id + '">' + p.emoji + " " + esc(p.name) + " (" + ls.length + ")</button></h4>" + ls.map(linkRow).join("");
    });
    if (any) out += '<h3 class="sec">Link review cho địa điểm có sẵn</h3>' + groups;
    if (S.links.some(function (l) { return !!ALL.filter(function (p) { return p.id === l.place; })[0]; })) {
      out += '<div class="live-note">Link review lưu trên máy này. Muốn giữ lâu dài cho cả nhóm, chép đoạn code rồi dán vào <code>data/curated.js</code> trong repo.</div>' +
        '<div class="btn-row"><button class="btn ghost" data-act="copycurated">Chép đoạn code curated.js</button></div>';
    }
    return out;
  }

  /* ---------- Giao diện: khung ---------- */
  function render() {
    var app = $("#app");
    var mm = $("#main");
    var keepScroll = mm && lastTab === tab ? mm.scrollTop : 0;
    var view = tab === "swipe" ? viewSwipe() : tab === "top" ? viewTop() : tab === "plan" ? viewPlan() : tab === "links" ? viewLinks() : viewNear();
    var tabs = [["swipe", "👆", "Vuốt"], ["top", "🏆", "Top"], ["plan", "🗓️", "Lịch"], ["near", "📍", "Gần bạn"], ["links", "➕", "Thêm"]];
    app.innerHTML =
      '<header class="hdr"><div class="brand">BKK <b>Swipe</b></div>' +
      '<span class="pill">' + esc(fmtDate(C.trip.start) + "–" + fmtDate(C.trip.end)) + " · " + C.trip.people + ' người</span>' +
      '<button class="icon-btn" data-act="settings" aria-label="Cài đặt">⚙️</button></header>' +
      '<main class="' + (tab === "swipe" ? "swipe-main" : "") + '" id="main">' + view + "</main>" +
      '<nav class="tabs" aria-label="Chuyển mục">' +
      tabs.map(function (t) {
        return '<button data-act="tab" data-tab="' + t[0] + '"' + (tab === t[0] ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + t[1] + "</span>" + t[2] + "</button>";
      }).join("") + "</nav>";
    var m2 = $("#main");
    if (m2) m2.scrollTop = keepScroll;
    lastTab = tab;
    if (tab === "swipe") bindSwipe();
    if (openKind) renderSheet(true);
  }

  function chipsRow() {
    return '<div class="chips-row" role="group" aria-label="Lọc theo nhóm">' + CATS.map(function (c) {
      return '<button class="chip-btn" data-act="cat" data-cat="' + c.k + '" aria-pressed="' + (cat === c.k) + '">' + c.e + " " + c.vi + "</button>";
    }).join("") + "</div>";
  }

  /* ---------- Mục 1: Vuốt ---------- */
  function deckList() {
    return places().filter(function (p) {
      return S.votes[p.id] === undefined && (cat === "all" || p.cats.indexOf(cat) !== -1);
    });
  }
  function cardHTML(p, pos) {
    var art = "art-" + p.cats[0];
    var lp = live.places[p.id] || {};
    var rating = lp.rating ? '<span>★ ' + esc(lp.rating) + "</span>" : "";
    return '<article class="card ' + pos + '" data-id="' + p.id + '" aria-label="' + esc(p.name) + '">' +
      '<div class="card-art ' + art + '"><span class="emoji" aria-hidden="true">' + p.emoji + "</span>" +
      '<span class="area">' + esc(p.area) + "</span>" +
      '<span class="stamp like">THÍCH</span><span class="stamp nope">BỎ QUA</span></div>' +
      '<div class="card-body"><div class="chips">' + p.cats.map(function (c) { return '<span class="chip">' + esc(CAT_VI[c]) + "</span>"; }).join("") + "</div>" +
      "<h2>" + esc(p.name) + "</h2>" +
      '<p class="blurb">' + esc(p.blurb) + "</p>" +
      '<div class="meta"><span>🕒 ' + esc(p.hours) + "</span>" + (p.price ? "<span>💸 " + PRICE[p.price] + "</span>" : "") + rating + "</div>" +
      (distText(p) ? '<div class="dist">' + esc(distText(p)) + "</div>" : "") +
      (p.warn ? '<div class="warn">⚠️ ' + esc(p.warn) + "</div>" : "") +
      '<button class="more" data-act="detail" data-id="' + p.id + '">Chi tiết, review mới nhất, chỉ đường ›</button></div></article>';
  }
  function viewSwipe() {
    var deck = deckList();
    var total = places().length;
    var voted = Object.keys(S.votes).length;
    var out = chipsRow() + '<p class="progress">Đã chọn ' + voted + "/" + total + " · Thích " + likedIds().length + "</p>";
    if (!deck.length) {
      var left = places().filter(function (p) { return S.votes[p.id] === undefined; }).length;
      out += '<div class="empty"><div class="big">🎉</div>' +
        (left === 0
          ? "<p><b>Bạn đã vuốt hết rồi!</b><br>Xem địa điểm cả nhóm cùng thích hoặc để app xếp lịch giúp.</p>"
          : "<p><b>Hết thẻ ở mục này.</b><br>Còn " + left + " địa điểm ở các mục khác.</p>") +
        '<div class="btn-row" style="justify-content:center">' +
        '<button class="btn pink" data-act="tab" data-tab="top">Xem Top nhóm</button>' +
        '<button class="btn" data-act="tab" data-tab="plan">Xếp lịch</button></div>' +
        (voted ? '<p><button class="btn ghost" data-act="reset">Vuốt lại từ đầu</button></p>' : "") + "</div>";
      return out;
    }
    out += '<div class="deck">' + (deck[1] ? cardHTML(deck[1], "behind") : "") + cardHTML(deck[0], "top") + "</div>" +
      '<div class="actions"><button class="round no" data-act="no" aria-label="Bỏ qua">✕</button>' +
      '<button class="round small" data-act="undo" aria-label="Hoàn tác" ' + (undo.length ? "" : "disabled") + ">↶</button>" +
      '<button class="round yes" data-act="yes" aria-label="Thích">♥</button></div>';
    return out;
  }

  function vote(id, v) {
    S.votes[id] = v; undo.push(id); save(); render();
  }
  function undoVote() {
    var id = undo.pop();
    if (!id) return;
    delete S.votes[id]; save(); render();
  }
  function topCard() { return $(".card.top"); }
  function fling(el, like) {
    var id = el.dataset.id;
    el.style.transform = "translate(" + (like ? 520 : -520) + "px, 0) rotate(" + (like ? 25 : -25) + "deg)";
    el.style.opacity = "0";
    setTimeout(function () { vote(id, like ? 1 : 0); }, reduceMotion ? 0 : 220);
  }
  function bindSwipe() {
    var el = topCard();
    if (!el) return;
    var sx = 0, sy = 0, dx = 0, drag = false, moved = false, startTarget = null;
    var likeS = $(".stamp.like", el), nopeS = $(".stamp.nope", el);
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button, a")) return;
      drag = true; moved = false; sx = e.clientX; sy = e.clientY; dx = 0; startTarget = e.target;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
      el.style.transition = "none";
    });
    el.addEventListener("pointermove", function (e) {
      if (!drag) return;
      dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      el.style.transform = "translate(" + dx + "px, " + dy * 0.2 + "px) rotate(" + dx / 18 + "deg)";
      var k = Math.min(1, Math.abs(dx) / 110);
      likeS.style.opacity = dx > 0 ? k : 0;
      nopeS.style.opacity = dx < 0 ? k : 0;
    });
    function end() {
      if (!drag) return;
      drag = false; el.style.transition = "";
      if (Math.abs(dx) > 110) { fling(el, dx > 0); return; }
      el.style.transform = ""; likeS.style.opacity = 0; nopeS.style.opacity = 0;
      if (!moved && startTarget) openPlace(el.dataset.id);
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  /* ---------- Mục 2: Top nhóm ---------- */
  function viewTop() {
    var ms = members();
    var map = scoreMap();
    var ranked = places().filter(function (p) { return map[p.id]; }).sort(function (a, b) {
      return map[b.id].length - map[a.id].length || a.name.localeCompare(b.name, "vi");
    });
    var out = '<h3 class="sec">Cả nhóm thích gì nhất</h3>';
    if (!ranked.length) {
      out += '<div class="empty"><div class="big">👆</div><p>Chưa có địa điểm nào được thích. Sang mục <b>Vuốt</b> để chọn nhé.</p></div>';
    } else {
      out += '<ul class="list">' + ranked.map(function (p, i) {
        var who = map[p.id];
        return '<li><button class="row" data-act="detail" data-id="' + p.id + '"><span class="rank">' + (i + 1) + "</span>" +
          '<span class="em" aria-hidden="true">' + p.emoji + "</span>" +
          '<span class="tx"><b>' + esc(p.name) + "</b><small>" + who.length + "/" + ms.length + " người thích" +
          '</small><span class="avs" aria-hidden="true">' + who.map(function (n) { return '<span class="av">' + esc(n.charAt(0).toUpperCase()) + "</span>"; }).join("") + "</span>" +
          '<div class="bar"><i style="width:' + Math.round((who.length / ms.length) * 100) + '%"></i></div></span></button></li>';
      }).join("") + "</ul>";
    }
    out += '<h3 class="sec">Gộp lựa chọn của cả nhóm</h3>' +
      '<div class="banner">Mỗi người vuốt trên điện thoại của mình, rồi gửi <b>mã</b> hoặc <b>link</b> bên dưới vào nhóm chat. Người nhận mở link (hoặc dán mã) để gộp vào đây.</div>' +
      '<div class="btn-row"><button class="btn pink" data-act="share">Chia sẻ lựa chọn của tôi</button>' +
      '<button class="btn ghost" data-act="copycode">Chép mã</button></div>' +
      '<label class="field">Dán mã hoặc link của bạn bè<textarea id="importBox" rows="2" placeholder="BKK1...."></textarea></label>' +
      '<button class="btn block" data-act="import">Thêm vào nhóm</button>';
    if (S.members.length) {
      out += '<h3 class="sec">Thành viên đã thêm</h3><ul class="list">' + S.members.map(function (m, i) {
        return '<li class="row"><span class="tx"><b>' + esc(m.n) + "</b><small>" + m.l.length + ' địa điểm</small></span><button class="btn ghost" data-act="rmmember" data-i="' + i + '">Xóa</button></li>';
      }).join("") + "</ul>";
    }
    return out;
  }

  /* ---------- Mục 3: Lịch ---------- */
  function viewPlan() {
    var ms = members();
    var map = scoreMap();
    var minV = S.minVotes && S.minVotes <= ms.length ? S.minVotes : ms.length > 1 ? Math.ceil(ms.length / 2) : 1;
    var cands = places().filter(function (p) { return map[p.id] && map[p.id].length >= minV; })
      .map(function (p) { return Object.assign({}, p, { score: map[p.id].length }); });
    var out = '<h3 class="sec">Lịch gợi ý ' + esc(fmtDate(C.trip.start) + " → " + fmtDate(C.trip.end)) + "</h3>";
    if (ms.length > 1) {
      out += '<label class="field">Chỉ xếp địa điểm có ít nhất<select id="minVotes">' +
        ms.map(function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === minV ? " selected" : "") + ">" + (i + 1) + " người thích</option>"; }).join("") + "</select></label>";
    }
    if (!cands.length) {
      return out + '<div class="empty"><div class="big">🗓️</div><p>Chưa có địa điểm để xếp. Hãy vuốt thích vài nơi ở mục <b>Vuốt</b> trước.</p>' +
        '<button class="btn pink" data-act="tab" data-tab="swipe">Đi vuốt</button></div>';
    }
    var days = L.buildDays(C.trip);
    var res = L.buildPlan(cands, days);
    out += '<div class="banner">App tự gom các điểm gần nhau vào cùng ngày và xếp đúng buổi mở cửa. Thông tin giờ giấc cần kiểm tra lại trước khi đi.</div>';
    res.plan.forEach(function (d, di) {
      var items = [];
      L.SLOT_ORDER.forEach(function (s) { d.slots[s].forEach(function (p) { items.push({ s: s, p: p }); }); });
      var note = di === 0 ? "Đến Bangkok khoảng trưa, nhận phòng rồi mới đi chơi" : di === res.plan.length - 1 ? "Ngày về, chỉ xếp buổi sáng. Chỉnh trong config.js khi có giờ bay" : "";
      out += '<section class="day"><h4>' + WD_VI[d.weekday] + " " + fmtDate(d.date) + '</h4><div class="sub">' + esc(note) + "</div>";
      if (!items.length) out += '<div class="day-free">Ngày trống, nghỉ ngơi hoặc tự do.</div>';
      var prev = null, lastSlot = null;
      items.forEach(function (it) {
        if (it.s !== lastSlot) { out += '<div class="slot-label">' + SLOT_VI[it.s] + "</div>"; lastSlot = it.s; }
        if (prev && L.hasCoords(prev) && L.hasCoords(it.p)) {
          var km = L.haversine(prev, it.p);
          out += '<div class="hop">↓ ' + km.toFixed(1) + " km · ~" + L.estimateMinutes(km, S.mode) + " phút " + MODE_VI[S.mode] + "</div>";
        }
        out += '<ul class="list"><li><button class="row" data-act="detail" data-id="' + it.p.id + '"><span class="em" aria-hidden="true">' + it.p.emoji + "</span>" +
          '<span class="tx"><b>' + esc(it.p.name) + (it.p.check ? " ⚠️" : "") + "</b><small>" + esc(it.p.hours) + "</small></span></button></li></ul>";
        prev = it.p;
      });
      if (items.length) {
        var stops = items.slice(0, 9).map(function (x) { return x.p; });
        out += '<div class="btn-row"><a class="btn" target="_blank" rel="noopener" href="' + esc(dirUrl(stops, "driving")) + '">Mở cả tuyến trong Google Maps</a></div>';
      }
      out += "</section>";
    });
    if (res.unplaced.length) {
      out += '<div class="banner warn"><b>Chưa xếp được:</b> ' + res.unplaced.map(function (p) { return esc(p.name); }).join(", ") +
        ". Có thể do hết chỗ hoặc địa điểm không mở vào ngày bạn ở Bangkok.</div>";
    }
    return out;
  }

  /* ---------- Mục 4: Gần bạn ---------- */
  function modeSeg() {
    return '<div class="seg" role="group" aria-label="Phương tiện">' + MODES.map(function (m) {
      return '<button data-act="mode" data-mode="' + m.k + '" aria-pressed="' + (S.mode === m.k) + '">' + m.vi + "</button>";
    }).join("") + "</div>";
  }
  function viewNear() {
    var o = origin();
    var out = '<h3 class="sec">Gần bạn nhất</h3>';
    out += '<div class="btn-row"><button class="btn pink" data-act="locate">📍 ' + (gps ? "Cập nhật vị trí" : "Dùng vị trí hiện tại") + "</button></div>";
    if (gpsFar()) out += '<div class="banner warn">Bạn đang ở xa Bangkok nên app chưa dùng GPS để tính khoảng cách' + (S.hotel ? ", tạm tính từ khách sạn." : ". Hãy nhập tọa độ khách sạn ở Cài đặt ⚙️.") + "</div>";
    if (!o) {
      return out + '<div class="banner">Chưa có điểm xuất phát. Bật vị trí hiện tại, hoặc nhập tọa độ khách sạn ở <b>Cài đặt ⚙️</b>. Trang chỉ xin vị trí khi bạn bấm nút.</div>';
    }
    out += modeSeg() + '<div class="live-note">Xuất phát từ ' + esc(o.label) + ". Thời gian là ước tính, giao thông Bangkok khó đoán.</div>";

    var likedAll = likedIds().map(byId);
    var liked = likedAll.filter(L.hasCoords);
    var noPos = likedAll.length - liked.length;
    out += '<h3 class="sec">Tuyến ngắn nhất qua các điểm đã thích</h3>';
    if (liked.length < 2) {
      out += '<div class="banner">Thích ít nhất 2 địa điểm để app tính tuyến ngắn nhất.</div>';
    } else {
      var route = L.shortestRoute(o, liked);
      var total = L.pathLength(o, route);
      out += '<div class="banner">Thứ tự ghé thăm quãng đường ngắn nhất (đường chim bay): <b>' + total.toFixed(1) + " km</b>.</div><ol class=\"list\" style=\"padding-left:0\">";
      var prev = o;
      route.forEach(function (p, i) {
        var km = L.haversine(prev, p);
        out += '<li><button class="row" data-act="detail" data-id="' + p.id + '"><span class="rank">' + (i + 1) + '</span><span class="em" aria-hidden="true">' + p.emoji + "</span>" +
          '<span class="tx"><b>' + esc(p.name) + "</b><small>+" + km.toFixed(1) + " km · ~" + L.estimateMinutes(km, S.mode) + " phút " + MODE_VI[S.mode] + "</small></span></button></li>";
        prev = p;
      });
      out += "</ol>";
      var many = route.length > 9 ? '<div class="live-note">Google Maps nhận tối đa 9 điểm, nên link chỉ gồm 9 điểm đầu.</div>' : "";
      out += many + '<div class="btn-row"><a class="btn" target="_blank" rel="noopener" href="' + esc(dirUrl(route.slice(0, 9), route.length > 1 ? "driving" : S.mode)) + '">Mở cả tuyến trong Google Maps</a></div>';
    }

    if (noPos) out += '<div class="banner warn">' + noPos + " địa điểm bạn thích chưa có vị trí nên chưa nằm trong tuyến. Mở chi tiết địa điểm để dán tọa độ.</div>";
    out += '<h3 class="sec">Tất cả địa điểm theo khoảng cách</h3>' + chipsRow();
    var list = places().filter(function (p) { return cat === "all" || p.cats.indexOf(cat) !== -1; })
      .map(function (p) { return { p: p, km: L.hasCoords(p) ? L.haversine(o, p) : null }; })
      .sort(function (a, b) { return (a.km == null) - (b.km == null) || a.km - b.km; });
    out += '<ul class="list">' + list.map(function (x) {
      var sub = x.km == null ? "Chưa có vị trí" : x.km.toFixed(1) + " km · ~" + L.estimateMinutes(x.km, S.mode) + " phút " + MODE_VI[S.mode];
      return '<li><button class="row" data-act="detail" data-id="' + x.p.id + '"><span class="em" aria-hidden="true">' + x.p.emoji + "</span>" +
        '<span class="tx"><b>' + esc(x.p.name) + "</b><small>" + sub + "</small></span></button></li>";
    }).join("") + "</ul>";
    return out;
  }

  /* ---------- Sheet: chi tiết & cài đặt ---------- */
  function openPlace(id) { openKind = "place"; openId = id; renderSheet(false); }
  function openSettings() { openKind = "settings"; renderSheet(false); }
  function closeSheet() {
    openKind = null; openId = null;
    var sh = $("#sheet"); sh.hidden = true; sh.innerHTML = "";
    var f = $("[data-act='settings']"); if (f) f.focus();
  }
  function renderSheet(keepScroll) {
    var wrap = $("#sheet");
    var prevScroll = keepScroll && $(".sheet", wrap) ? $(".sheet", wrap).scrollTop : 0;
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + (openKind === "place" ? placeSheet(byId(openId)) : settingsSheet()) + "</div>";
    wrap.hidden = false;
    var sheet = $(".sheet", wrap);
    sheet.scrollTop = prevScroll;
    if (!keepScroll) { var cb = $("[data-act='close']", wrap); if (cb) cb.focus(); }
  }

  function placeSheet(p) {
    var links = L.reviewLinks(p);
    var lp = live.places[p.id] || {};
    var tips = (p.tips || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    var liveHtml = "";
    if (lp.rating) liveHtml += '<p><b>★ ' + esc(lp.rating) + "</b>" + (lp.ratings ? " (" + Number(lp.ratings).toLocaleString("vi-VN") + " đánh giá Google)" : "") + "</p>";
    if (lp.status === "CLOSED_TEMPORARILY") liveHtml += '<div class="warn">⚠️ Google ghi địa điểm này đang tạm đóng cửa.</div>';
    if (lp.videos && lp.videos.length) {
      liveHtml += lp.videos.slice(0, 3).map(function (v) {
        return '<a class="vid" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + '"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/mqdefault.jpg"><span><b>' + esc(v.title) + "</b><br>" + esc(v.channel || "") + (v.publishedAt ? " · " + esc(v.publishedAt.slice(0, 10)) : "") + "</span></a>";
      }).join("");
    }
    if (liveHtml) liveHtml += '<div class="live-note">Dữ liệu tự động cập nhật' + (live.updatedAt ? " lúc " + esc(live.updatedAt.slice(0, 10)) : "") + ".</div>";

    var mine = linksFor(p.id);
    var curHtml = mine.map(linkRow).join("");

    return '<div class="sheet-head"><span class="em" aria-hidden="true">' + p.emoji + "</span><h2>" + esc(p.name) + '</h2><button class="icon-btn" data-act="close" aria-label="Đóng">✕</button></div>' +
      '<div class="chips">' + p.cats.map(function (c) { return '<span class="chip">' + esc(CAT_VI[c]) + "</span>"; }).join("") + "</div>" +
      "<p>" + esc(p.blurb) + "</p>" +
      (p.warn ? '<div class="warn">⚠️ ' + esc(p.warn) + "</div>" : "") +
      '<dl class="kv"><dt>Khu vực</dt><dd>' + esc(p.area) + "</dd>" + (p.transit ? "<dt>Di chuyển</dt><dd>" + esc(p.transit) + "</dd>" : "") +
      "<dt>Giờ mở cửa</dt><dd>" + esc(p.hours) + "</dd>" +
      (p.price ? "<dt>Mức giá</dt><dd>" + PRICE[p.price] + " · " + esc(p.priceNote) + " <small>(ước tính)</small></dd>" : "") + "</dl>" + customBlock(p) +
      (tips ? '<h3 class="sec">Mẹo</h3><ul class="tips">' + tips + "</ul>" : "") +
      '<h3 class="sec">Chỉ đường</h3>' + modeSeg() +
      (distText(p) ? '<div class="dist">' + esc(distText(p)) + "</div>" : '<div class="live-note">Bật vị trí ở mục Gần bạn hoặc nhập khách sạn ở Cài đặt để xem khoảng cách. Google Maps vẫn tự lấy vị trí của bạn.</div>') +
      '<div class="btn-row"><a class="btn pink" target="_blank" rel="noopener" href="' + esc(dirUrl([p])) + '">Mở chỉ đường trong Google Maps</a></div>' +
      '<h3 class="sec">Review mới nhất</h3><div class="btn-row">' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(links.tiktok) + '">TikTok</a>' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(links.youtube) + '">YouTube (mới nhất)</a>' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(links.facebook) + '">Facebook</a>' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(links.maps) + '">Đánh giá Google Maps</a></div>' +
      '<div class="live-note">Các nút mở trang tìm kiếm của từng nền tảng, nên luôn ra bài mới nhất. Facebook có thể yêu cầu đăng nhập.</div>' +
      '<h3 class="sec">Link review của nhóm</h3>' +
      (curHtml || '<div class="live-note">Chưa có link nào cho nơi này.</div>') +
      '<div class="btn-row"><button class="btn ghost" data-act="gotoadd" data-id="' + p.id + '">➕ Thêm link TikTok / YouTube</button></div>' +
      (liveHtml ? '<h3 class="sec">Cập nhật tự động</h3>' + liveHtml : "") +
      '<h3 class="sec">Nguồn tham khảo</h3><ul class="src">' + p.sources.map(function (s) { return '<li><a target="_blank" rel="noopener" href="' + esc(s.u) + '">' + esc(s.t) + "</a></li>"; }).join("") + "</ul>" +
      '<div class="live-note">Dữ liệu tổng hợp ngày 16/11/2026. Giờ mở cửa và giá có thể thay đổi, hãy kiểm tra lại trước khi đi.</div>';
  }

  function settingsSheet() {
    var h = S.hotel;
    return '<div class="sheet-head"><h2>Cài đặt</h2><button class="icon-btn" data-act="close" aria-label="Đóng">✕</button></div>' +
      '<label class="field">Tên của bạn (hiện khi gộp nhóm)<input id="setName" maxlength="20" value="' + esc(S.name) + '" placeholder="Ví dụ: Nam"></label>' +
      '<label class="field">Tọa độ khách sạn<input id="setHotel" inputmode="text" value="' + (h ? esc(h.lat.toFixed(5) + ", " + h.lng.toFixed(5)) : "") + '" placeholder="13.75633, 100.50177 hoặc link Google Maps dài"></label>' +
      '<div class="live-note">Mở khách sạn trên Google Maps, nhấn giữ vào ghim rồi chép dòng tọa độ (hai số). Link rút gọn dạng maps.app.goo.gl không chứa tọa độ nên app không đọc được.</div>' +
      '<div class="btn-row"><button class="btn pink" data-act="savesettings">Lưu</button>' +
      '<button class="btn ghost" data-act="hotelhere">Dùng vị trí hiện tại làm khách sạn</button></div>' +
      '<h3 class="sec">Dữ liệu</h3>' +
      '<div class="btn-row"><button class="btn ghost" data-act="reset">Xóa lựa chọn đã vuốt</button></div>' +
      '<div class="live-note">Lựa chọn được lưu ngay trên điện thoại này, không gửi đi đâu. Vị trí chỉ được dùng trên máy bạn để tính khoảng cách và mở Google Maps.</div>';
  }

  /* ---------- Sự kiện ---------- */
  function copy(text, okMsg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(okMsg); } catch (e) { toast("Không chép được, hãy chép thủ công."); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    else fallback();
  }
  function shareLink() { return location.href.split("#")[0] + "#" + myCode(); }

  function act(name, el) {
    try { actInner(name, el); }
    catch (err) {
      toast("Có lỗi: " + (err && err.message ? err.message : err) + ". Hãy tải lại trang rồi thử lại.");
      if (window.console) console.error(err);
    }
  }
  function actInner(name, el) {
    var d = el.dataset;
    switch (name) {
      case "tab": tab = d.tab; closeSheet(); render(); $("#main").scrollTop = 0; break;
      case "cat": cat = d.cat; render(); break;
      case "yes": case "no": { var t = topCard(); if (t) fling(t, name === "yes"); break; }
      case "undo": undoVote(); break;
      case "detail": openPlace(d.id); break;
      case "close": closeSheet(); break;
      case "settings": openSettings(); break;
      case "mode": S.mode = d.mode; save(); render(); break;
      case "locate": locate(); break;
      case "reset":
        if (!resetArmed) {
          resetArmed = true;
          toast("Bấm thêm một lần nữa trong 4 giây để xác nhận xóa.");
          setTimeout(function () { resetArmed = false; }, 4000);
        } else {
          resetArmed = false; S.votes = {}; undo = []; save(); closeSheet(); render(); toast("Đã xóa lựa chọn.");
        }
        break;
      case "share": {
        var url = shareLink();
        if (navigator.share) navigator.share({ title: "Lựa chọn Bangkok của tôi", text: "Mở link để gộp lựa chọn của mình vào BKK Swipe:", url: url }).catch(function () {});
        else copy(url, "Đã chép link, dán vào nhóm chat nhé.");
        break;
      }
      case "copycode": copy(myCode(), "Đã chép mã lựa chọn."); break;
      case "import": {
        var m = parseCode($("#importBox").value);
        if (!m) { toast("Mã hoặc link không hợp lệ."); break; }
        addMember(m); toast("Đã thêm lựa chọn của " + m.n + "."); render(); break;
      }
      case "rmmember": S.members.splice(Number(d.i), 1); save(); render(); break;
      case "gotoadd": linkPlace = d.id; formMode = "review"; closeSheet(); tab = "links"; render(); $("#main").scrollTop = 0; break;
      case "formmode": formMode = d.mode; render(); break;
      case "newcat": newCat = d.cat; render(); break;
      case "addplace": {
        var pv2 = L.parseVideoLink($("#linkUrl").value);
        if (!pv2) { toast("Link không hợp lệ. Chỉ nhận link TikTok, YouTube hoặc Facebook."); break; }
        var nm = $("#newName").value.replace(/[<>]/g, "").trim().slice(0, 60);
        if (!nm) { toast("Hãy nhập tên địa điểm (app chưa tự đọc được tên quán từ video)."); $("#newName").focus(); break; }
        var locRaw = $("#newLoc").value.trim();
        var cc = null;
        if (locRaw) {
          cc = L.parseCoords(locRaw);
          if (!cc || !inThailand(cc.lat, cc.lng)) { toast("Không đọc được vị trí. Dán tọa độ dạng 13.75, 100.50 hoặc link Google Maps dài (không phải link rút gọn)."); break; }
        }
        var res = addCustom({ pv: pv2, name: nm, cat: newCat, coords: cc, note: $("#newNote").value, by: S.name || "Tôi" });
        if (res.dup) { toast("Link này đã được thêm thành địa điểm “" + res.dup.name + "” rồi."); break; }
        S.votes[res.place.id] = 1; // người thêm chắc chắn thích nơi này
        formVals = { url: "", name: "", loc: "", note: "", title: "" };
        save(); render();
        toast("Đã thêm “" + nm + "” vào danh sách và tự đánh dấu thích. Bạn bè sẽ thấy khi nhận link chia sẻ của bạn.");
        if (res.link) autoTitle(res.link);
        if (!cc) geocode(res.place.id);
        break;
      }
      case "setcoords": {
        var cc2 = L.parseCoords($("#cuCoords").value);
        var cp = S.custom.filter(function (x) { return x.id === d.id; })[0];
        if (!cc2 || !inThailand(cc2.lat, cc2.lng) || !cp) { toast("Không đọc được vị trí. Dán tọa độ dạng 13.75, 100.50."); break; }
        cp.lat = cc2.lat; cp.lng = cc2.lng; cp.exact = true; save(); render(); toast("Đã lưu vị trí."); break;
      }
      case "rmplace":
        if (delArmedId !== d.id) {
          delArmedId = d.id; render(); toast("Bấm thêm một lần nữa trong 4 giây để xóa địa điểm này.");
          setTimeout(function () { if (delArmedId === d.id) { delArmedId = null; if (openKind === "place") render(); } }, 4000);
        } else {
          delArmedId = null;
          S.custom = S.custom.filter(function (x) { return x.id !== d.id; });
          S.links = S.links.filter(function (l) { return l.place !== d.id; });
          delete S.votes[d.id];
          save(); closeSheet(); render(); toast("Đã xóa địa điểm.");
        }
        break;
      case "addlink": {
        var pv = L.parseVideoLink($("#linkUrl").value);
        if (!pv) { toast("Link không hợp lệ. Chỉ nhận link TikTok, YouTube hoặc Facebook."); break; }
        linkPlace = $("#linkPlaceSel").value;
        var entry = pushLink(linkPlace, pv, $("#linkTitle").value, S.name || "Tôi", true);
        if (!entry) { toast("Link này đã có ở địa điểm đó rồi."); break; }
        formVals.url = ""; formVals.title = "";
        save(); render(); toast("Đã thêm link " + PLAT[pv.type].vi + ". Xem ở mục Link review bên dưới.");
        var added = document.getElementById("lk-" + entry.lid);
        if (added) {
          added.classList.add("flash");
          if (added.scrollIntoView) added.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
        }
        autoTitle(entry);
        break;
      }
      case "rmlink":
        S.links = S.links.filter(function (l) { return l.lid !== d.lid; }); save(); render(); toast("Đã xóa link."); break;
      case "copycurated": copy(curatedSnippet(), "Đã chép. Dán vào data/curated.js, bên trong dấu { }."); break;
      case "savesettings": {
        S.name = $("#setName").value.trim().slice(0, 20);
        var raw = $("#setHotel").value.trim();
        if (raw) {
          var c = L.parseCoords(raw);
          if (!c) { toast("Không đọc được tọa độ. Hãy nhập dạng 13.75633, 100.50177."); break; }
          S.hotel = c;
        } else S.hotel = null;
        save(); closeSheet(); render(); toast("Đã lưu cài đặt."); break;
      }
      case "hotelhere":
        if (gps && !gpsFar()) { S.hotel = { lat: gps.lat, lng: gps.lng }; save(); renderSheet(true); toast("Đã lưu vị trí hiện tại làm khách sạn."); }
        else { toast("Hãy bấm 'Dùng vị trí hiện tại' ở mục Gần bạn khi đã ở khách sạn."); }
        break;
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (el) { act(el.dataset.act, el); return; }
    if (e.target.id === "sheet") closeSheet();
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "minVotes") { S.minVotes = Number(e.target.value); save(); render(); }
    if (e.target.id === "linkPlaceSel") linkPlace = e.target.value;
  });
  var FIELD_KEY = { linkUrl: "url", newName: "name", newLoc: "loc", newNote: "note", linkTitle: "title" };
  document.addEventListener("input", function (e) {
    var k = FIELD_KEY[e.target.id];
    if (k) formVals[k] = e.target.value;
    if (e.target.id !== "linkUrl") return;
    var hint = $("#linkHint");
    if (hint) hint.textContent = hintFor(e.target.value);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openKind) { closeSheet(); return; }
    if (tab !== "swipe" || openKind) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    var t = topCard();
    if (!t) return;
    if (e.key === "ArrowRight") fling(t, true);
    else if (e.key === "ArrowLeft") fling(t, false);
    else if (e.key === "ArrowUp" || e.key === "Enter") openPlace(t.dataset.id);
  });

  /* ---------- Khởi động ---------- */
  function importFromHash() {
    var h = location.hash;
    if (h.indexOf("#BKK1.") !== 0) return;
    var m = parseCode(h.slice(1));
    if (m) { addMember(m); tab = "top"; setTimeout(function () { toast("Đã thêm lựa chọn của " + m.n + " vào nhóm."); }, 300); }
    try { history.replaceState(null, "", location.href.split("#")[0]); } catch (e) { /* bỏ qua */ }
  }

  importFromHash();
  render();
  window.addEventListener("hashchange", function () { importFromHash(); render(); });

  // Dữ liệu tự động (nếu GitHub Actions đã tạo data/live.json). Không có thì app vẫn chạy bình thường.
  if (window.fetch && location.protocol !== "file:") {
    fetch("data/live.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.places && typeof j.places === "object") { live = j; render(); }
    }).catch(function () { /* bỏ qua */ });
  }
})();
