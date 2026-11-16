(function () {
  "use strict";

  var C = window.BKK_CONFIG;
  var L = window.BKK;
  var ALL = window.BKK_PLACES;
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

  /* ---------- Trạng thái ---------- */
  function defaults() { return { name: "", votes: {}, hotel: null, mode: "transit", members: [], minVotes: 0 }; }
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
  function byId(id) { return ALL.filter(function (p) { return p.id === id; })[0]; }

  function places() {
    return ALL.filter(function (p) {
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
    if (!o) return "";
    var km = L.haversine(o, p);
    return "📍 " + km.toFixed(1) + " km từ " + o.label + " · ~" + L.estimateMinutes(km, S.mode) + " phút " + MODE_VI[S.mode];
  }
  function dirUrl(list, mode) {
    return L.mapsDirUrl({ origin: originParam(), stops: list.map(function (p) { return p.q; }), mode: mode || S.mode });
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
    var o = { n: (S.name || "Tôi").slice(0, 20), l: likedIds() };
    return "BKK1." + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  }
  function parseCode(s) {
    var i = String(s || "").indexOf("BKK1.");
    if (i < 0) return null;
    try {
      var raw = s.slice(i + 5).trim().replace(/[^A-Za-z0-9+/=_-]+.*$/, "");
      var o = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (!o || typeof o.n !== "string" || !Array.isArray(o.l)) return null;
      return { n: o.n.replace(/[<>]/g, "").slice(0, 20) || "Bạn", l: o.l.filter(function (id) { return !!byId(id); }) };
    } catch (e) { return null; }
  }
  function addMember(m) {
    S.members = S.members.filter(function (x) { return x.n !== m.n; }).concat([m]);
    save();
  }

  /* ---------- Giao diện: khung ---------- */
  function render() {
    var app = $("#app");
    var view = tab === "swipe" ? viewSwipe() : tab === "top" ? viewTop() : tab === "plan" ? viewPlan() : viewNear();
    var tabs = [["swipe", "👆", "Vuốt"], ["top", "🏆", "Top nhóm"], ["plan", "🗓️", "Lịch"], ["near", "📍", "Gần bạn"]];
    app.innerHTML =
      '<header class="hdr"><div class="brand">BKK <b>Swipe</b></div>' +
      '<span class="pill">' + esc(fmtDate(C.trip.start) + "–" + fmtDate(C.trip.end)) + " · " + C.trip.people + ' người</span>' +
      '<button class="icon-btn" data-act="settings" aria-label="Cài đặt">⚙️</button></header>' +
      '<main class="' + (tab === "swipe" ? "swipe-main" : "") + '" id="main">' + view + "</main>" +
      '<nav class="tabs" aria-label="Chuyển mục">' +
      tabs.map(function (t) {
        return '<button data-act="tab" data-tab="' + t[0] + '"' + (tab === t[0] ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + t[1] + "</span>" + t[2] + "</button>";
      }).join("") + "</nav>";
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
      '<div class="meta"><span>🕒 ' + esc(p.hours) + "</span><span>💸 " + PRICE[p.price] + "</span>" + rating + "</div>" +
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
        if (prev) {
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

    var liked = likedIds().map(byId);
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

    out += '<h3 class="sec">Tất cả địa điểm theo khoảng cách</h3>' + chipsRow();
    var list = places().filter(function (p) { return cat === "all" || p.cats.indexOf(cat) !== -1; })
      .map(function (p) { return { p: p, km: L.haversine(o, p) }; })
      .sort(function (a, b) { return a.km - b.km; });
    out += '<ul class="list">' + list.map(function (x) {
      return '<li><button class="row" data-act="detail" data-id="' + x.p.id + '"><span class="em" aria-hidden="true">' + x.p.emoji + "</span>" +
        '<span class="tx"><b>' + esc(x.p.name) + "</b><small>" + x.km.toFixed(1) + " km · ~" + L.estimateMinutes(x.km, S.mode) + " phút " + MODE_VI[S.mode] + "</small></span></button></li>";
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
    var cur = CURATED[p.id] || [];
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

    var curHtml = cur.map(function (c) {
      var ok = /^https:\/\//.test(c.url || "");
      return ok ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(c.url) + '">' + esc((c.type || "link").toUpperCase()) + ": " + esc(c.title || "Xem") + "</a>" : "";
    }).join("");

    return '<div class="sheet-head"><span class="em" aria-hidden="true">' + p.emoji + "</span><h2>" + esc(p.name) + '</h2><button class="icon-btn" data-act="close" aria-label="Đóng">✕</button></div>' +
      '<div class="chips">' + p.cats.map(function (c) { return '<span class="chip">' + esc(CAT_VI[c]) + "</span>"; }).join("") + "</div>" +
      "<p>" + esc(p.blurb) + "</p>" +
      (p.warn ? '<div class="warn">⚠️ ' + esc(p.warn) + "</div>" : "") +
      '<dl class="kv"><dt>Khu vực</dt><dd>' + esc(p.area) + "</dd><dt>Di chuyển</dt><dd>" + esc(p.transit) + "</dd><dt>Giờ mở cửa</dt><dd>" + esc(p.hours) +
      "</dd><dt>Mức giá</dt><dd>" + PRICE[p.price] + " · " + esc(p.priceNote) + " <small>(ước tính)</small></dd></dl>" +
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
      (curHtml ? '<h3 class="sec">Link nhóm đã lưu</h3><div class="btn-row">' + curHtml + "</div>" : "") +
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
