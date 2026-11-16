/* Phần logic thuần (khoảng cách, tuyến ngắn nhất, xếp lịch, link bản đồ). Không đụng tới giao diện nên test được bằng Node. */
(function (root) {
  "use strict";

  const SLOT_ORDER = ["morning", "afternoon", "evening", "night"];
  const SLOT_CAP = { morning: 1, afternoon: 2, evening: 2, night: 1 };

  const rad = (d) => (d * Math.PI) / 180;

  /** Khoảng cách đường chim bay (km). */
  function haversine(a, b) {
    const R = 6371;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  function hasCoords(p) {
    return !!p && typeof p.lat === "number" && typeof p.lng === "number" && isFinite(p.lat) && isFinite(p.lng);
  }

  /** Ước tính thời gian (phút) theo phương tiện. Chỉ mang tính tham khảo vì giao thông Bangkok khó đoán. */
  function estimateMinutes(km, mode) {
    const road = km * 1.35; // đường thực tế dài hơn đường chim bay
    if (mode === "walking") return Math.round((road / 4.5) * 60);
    if (mode === "driving") return Math.round((road / 14) * 60 + 5);
    return Math.round((road / 16) * 60 + 10); // transit: gồm thời gian chờ
  }

  /** Đọc tọa độ từ "13.75, 100.50", link Google Maps dài (@lat,lng hoặc !3d..!4d..). */
  function parseCoords(text) {
    if (!text) return null;
    const s = String(text);
    const m =
      s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
      s.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
      s.match(/(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
    return { lat, lng };
  }

  function pathLength(origin, seq) {
    let d = 0;
    let prev = origin;
    for (const p of seq) {
      if (prev) d += haversine(prev, p);
      prev = p;
    }
    return d;
  }

  /**
   * Thứ tự ghé thăm ngắn nhất (đường đi hở, không phải quay về).
   * <= 9 điểm: vét cạn có cắt nhánh (chính xác). Nhiều hơn: gần nhất + 2-opt.
   */
  function shortestRoute(origin, pts) {
    const n = pts.length;
    if (n <= 1) return pts.slice();

    if (n <= 9) {
      let best = null;
      let bestD = Infinity;
      const used = new Array(n).fill(false);
      const cur = [];
      (function dfs(prev, d) {
        if (d >= bestD) return;
        if (cur.length === n) {
          best = cur.slice();
          bestD = d;
          return;
        }
        for (let i = 0; i < n; i++) {
          if (used[i]) continue;
          used[i] = true;
          cur.push(pts[i]);
          dfs(pts[i], d + (prev ? haversine(prev, pts[i]) : 0));
          cur.pop();
          used[i] = false;
        }
      })(origin, 0);
      return best;
    }

    // Gần nhất
    const left = pts.slice();
    let seq = [];
    let prev = origin;
    if (!prev) {
      seq.push(left.shift());
      prev = seq[0];
    }
    while (left.length) {
      let bi = 0;
      let bd = Infinity;
      left.forEach((p, i) => {
        const d = haversine(prev, p);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      prev = left.splice(bi, 1)[0];
      seq.push(prev);
    }
    // 2-opt
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < seq.length - 1; i++) {
        for (let j = i + 1; j < seq.length; j++) {
          const cand = seq.slice(0, i).concat(seq.slice(i, j + 1).reverse(), seq.slice(j + 1));
          if (pathLength(origin, cand) + 1e-9 < pathLength(origin, seq)) {
            seq = cand;
            improved = true;
          }
        }
      }
    }
    return seq;
  }

  /** Các buổi một địa điểm có thể xếp vào trong một ngày cụ thể. */
  function allowedSlots(place, day) {
    let slots;
    if (place.windows) {
      slots = place.windows
        .filter((w) => w.days.indexOf(day.weekday) !== -1)
        .reduce((a, w) => a.concat(w.slots), []);
    } else {
      slots = place.slots || [];
    }
    return slots.filter((s) => day.slots.indexOf(s) !== -1);
  }

  /** Tạo danh sách ngày của chuyến đi. */
  function buildDays(trip) {
    const days = [];
    const [y1, m1, d1] = trip.start.split("-").map(Number);
    const [y2, m2, d2] = trip.end.split("-").map(Number);
    const start = Date.UTC(y1, m1 - 1, d1);
    const end = Date.UTC(y2, m2 - 1, d2);
    for (let t = start, i = 0; t <= end; t += 86400000, i++) {
      const dt = new Date(t);
      days.push({
        date: dt.toISOString().slice(0, 10),
        weekday: dt.getUTCDay(),
        slots:
          i === 0
            ? trip.firstDaySlots.slice()
            : t === end
            ? trip.lastDaySlots.slice()
            : SLOT_ORDER.slice()
      });
    }
    if (days.length === 1) days[0].slots = trip.firstDaySlots.filter((s) => trip.lastDaySlots.indexOf(s) !== -1);
    return days;
  }

  /**
   * Xếp lịch: điểm khó xếp nhất (ít lựa chọn) đi trước, rồi ưu tiên gom các điểm gần nhau vào cùng ngày.
   * cands: mảng place (có thể kèm score). days: kết quả buildDays.
   */
  function buildPlan(cands, days) {
    const plan = days.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      slots: { morning: [], afternoon: [], evening: [], night: [] }
    }));
    const unplaced = [];
    const items = cands.map((p) => {
      const opts = [];
      days.forEach((d, i) => allowedSlots(p, d).forEach((s) => opts.push({ i, s })));
      return { p, opts };
    });
    items.sort((a, b) => a.opts.length - b.opts.length || (b.p.score || 0) - (a.p.score || 0));

    for (const { p, opts } of items) {
      let best = null;
      let bestCost = Infinity;
      for (const o of opts) {
        const day = plan[o.i];
        if (day.slots[o.s].length >= SLOT_CAP[o.s]) continue;
        const existing = SLOT_ORDER.reduce((a, s) => a.concat(day.slots[s]), []);
        // Địa điểm chưa có tọa độ (người dùng tự thêm) thì không gom theo khoảng cách được.
        const ds = existing.filter((e) => hasCoords(e) && hasCoords(p)).map((e) => haversine(e, p));
        const cluster = ds.length ? ds.reduce((a, d) => a + d, 0) / ds.length : 3;
        const cost = cluster + existing.length * 1.5;
        if (cost < bestCost) {
          bestCost = cost;
          best = o;
        }
      }
      if (best) plan[best.i].slots[best.s].push(p);
      else unplaced.push(p);
    }

    // Trong cùng một buổi có 2 điểm: đi điểm gần điểm trước đó hơn trước.
    plan.forEach((day) => {
      let prev = null;
      SLOT_ORDER.forEach((s) => {
        const arr = day.slots[s];
        if (arr.length === 2 && hasCoords(prev) && hasCoords(arr[0]) && hasCoords(arr[1])) {
          if (haversine(prev, arr[1]) < haversine(prev, arr[0])) arr.reverse();
        }
        if (arr.length) prev = arr[arr.length - 1];
      });
    });

    return { plan, unplaced };
  }

  function mapsDirUrl(opts) {
    const stops = opts.stops;
    const u = new URLSearchParams();
    u.set("api", "1");
    if (opts.origin) u.set("origin", opts.origin);
    u.set("destination", stops[stops.length - 1]);
    if (stops.length > 1) u.set("waypoints", stops.slice(0, -1).join("|"));
    u.set("travelmode", opts.mode || "transit");
    return "https://www.google.com/maps/dir/?" + u.toString();
  }

  function reviewLinks(place) {
    const q = encodeURIComponent(place.q || place.name);
    const qr = encodeURIComponent((place.q || place.name) + " review");
    return {
      youtube: "https://www.youtube.com/results?search_query=" + qr + "&sp=CAI%253D", // sắp xếp theo mới nhất
      tiktok: "https://www.tiktok.com/search?q=" + qr,
      facebook: "https://www.facebook.com/search/posts/?q=" + qr,
      maps: "https://www.google.com/maps/search/?api=1&query=" + q
    };
  }

  const LINK_DOMAINS = {
    tiktok: ["tiktok.com"],
    youtube: ["youtube.com", "youtu.be"],
    facebook: ["facebook.com", "fb.watch"]
  };
  function hostType(host) {
    const h = host.toLowerCase();
    for (const type in LINK_DOMAINS) {
      if (LINK_DOMAINS[type].some((d) => h === d || h.endsWith("." + d))) return type;
    }
    return null;
  }

  /**
   * Nhận diện link review TikTok / YouTube / Facebook. Chấp nhận cả đoạn chữ chia sẻ có kèm link.
   * Chỉ nhận https của đúng các tên miền này; trả về link đã làm sạch (bỏ tham số theo dõi) hoặc null.
   */
  function parseVideoLink(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    const m = s.match(/https?:\/\/[^\s]+/i);
    if (m) s = m[0];
    else if (/^(www\.|m\.|vm\.|vt\.)?(tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch)\//i.test(s)) s = "https://" + s;
    else return null;
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    const type = hostType(u.hostname);
    if (!type) return null;
    if ((u.pathname === "/" || u.pathname === "") && !u.search) return null; // chỉ là trang chủ
    let url;
    let id = null;
    if (type === "youtube") {
      const host = u.hostname.toLowerCase();
      if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
      else if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const mm = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
        if (mm) id = mm[2];
      }
      if (id && /^[\w-]{6,20}$/.test(id)) url = "https://www.youtube.com/watch?v=" + id;
      else { id = null; url = "https://www.youtube.com" + u.pathname + u.search; }
    } else if (type === "tiktok") {
      url = "https://" + u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, "");
    } else {
      url = "https://" + u.hostname.toLowerCase() + u.pathname + u.search;
    }
    if (url.length > 300) return null;
    return { type, id, url };
  }

  /* ---------- Trích địa điểm từ văn bản (tiêu đề, caption, mô tả, phụ đề) ---------- */
  const KNOWN_ALIASES = {
    yaowarat: ["yaowarat", "chinatown", "pho tau"], jayfai: ["jay fai", "jai fai"], jokprince: ["jok prince"],
    khaosan: ["khao san", "khaosan"], watarun: ["wat arun"], watpho: ["wat pho"], grandpalace: ["grand palace"],
    benchamabophit: ["benchamabophit", "marble temple"], skywalk: ["mahanakhon", "skywalk"], lebua: ["lebua"],
    octave: ["octave rooftop", "octave bar"], redsky: ["red sky"], vertigo: ["vertigo", "moon bar"], mbk: ["mbk"],
    paragon: ["siam paragon"], iconsiam: ["iconsiam", "icon siam"], pratunam: ["pratunam", "platinum fashion"],
    terminal21: ["terminal 21", "terminal21"], jodd: ["jodd fairs", "jodd fair"],
    trainratchada: ["train night market", "talad rot fai", "rot fai"], chatuchak: ["chatuchak", "jatujak"], asiatique: ["asiatique"]
  };
  const GENERIC_TAGS = new Set(["bangkok", "thailand", "thai", "thailand🇹🇭", "fyp", "foryou", "foryoupage", "viral", "trending", "travel", "food", "foodie", "review", "vlog", "xuhuong", "dulich", "dulichthailand", "dulichbangkok", "thailande", "amthuc", "reviewanuong", "anuong", "streetfood", "shorts", "short", "tiktok", "youtube", "tiktokfood", "tiktoktravel", "traveltiktok", "bkk", "thailandtravel", "bangkokfood", "bangkoktravel", "dulichbuiThailand", "mukbang", "fypシ", "parati"]);
  const STOP_FIRST = new Set(["the", "this", "that", "my", "our", "we", "i", "bangkok", "thailand", "thai", "day", "best", "top", "how", "what", "where", "here", "new", "free", "full", "watch", "follow", "subscribe", "link", "price", "open", "location", "address", "map", "maps", "google", "instagram", "tiktok", "youtube", "facebook"]);
  const PLACE_WORDS = /\b(market|night market|rooftop|bar|cafe|café|coffee|restaurant|noodles?|noodle|temple|wat|mall|street|road|soi|kitchen|bakery|pad thai|congee|bistro|garden|palace|tower|hotel|food court|pier|park|museum|shop|house|station)\b/i;

  function fold(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function guessCat(t) {
    const s = " " + fold(t) + " ";
    if (/ (rooftop|sky bar|skybar|sky|cocktail|lounge) /.test(s)) return "sky";
    if (/ (night market|cho dem|rot fai|jodd) /.test(s)) return "night";
    if (/ (wat|temple|chua|den|palace|cung dien|view|photo|chup anh|museum|bao tang|park|cong vien|pier|tower|garden|vuon) /.test(s)) return "photo";
    if (/ (mall|market|cho|shopping|mua sam|trung tam|center|centre|platinum|plaza|outlet) /.test(s)) return "shop";
    return "food";
  }
  function cleanName(n) {
    n = String(n || "").replace(/https?:\/\/\S+/g, " ").replace(/[<>]/g, " ").replace(/[\u{1F000}-\u{1FFFF}☀-➿️‍]/gu, " ")
      .replace(/^[\s\-–—:|•·*#@"'“”‘’()\[\]]+|[\s\-–—:|•·*"'“”‘’()\[\]]+$/g, "").replace(/\s+/g, " ").trim();
    return n.slice(0, 60);
  }
  function humanizeTag(t) {
    const m = t.replace(/_/g, " ");
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  /**
   * Gợi ý các địa điểm có trong một đoạn văn bản. Dựa trên quy tắc đơn giản nên chỉ là GỢI Ý, người dùng cần xác nhận.
   * Trả về [{ name, cat, known: id|null, coords: {lat,lng}|null, conf: "high"|"low" }].
   */
  function extractPlaces(text, opts) {
    const src = String(text || "").slice(0, 8000);
    const out = [];
    const seen = new Set();
    function push(name, conf, extra) {
      name = cleanName(name);
      if (name.length < 3) return;
      const key = fold(name);
      if (!key || key.length < 3 || seen.has(key)) return;
      const ck = key.replace(/ /g, "");
      const first = key.split(" ")[0];
      if (STOP_FIRST.has(first) && key.split(" ").length < 3) return;
      for (const o of out) { const ok = fold(o.name).replace(/ /g, ""); if (ok.indexOf(ck) >= 0 || ck.indexOf(ok) >= 0) return; }
      seen.add(key);
      out.push(Object.assign({ name, cat: guessCat(name), known: null, coords: null, conf }, extra || {}));
    }

    // 1) Địa điểm có sẵn trong app
    const f = " " + fold(src) + " ";
    for (const id of Object.keys(KNOWN_ALIASES)) {
      if (KNOWN_ALIASES[id].some((a) => f.indexOf(" " + a + " ") >= 0)) {
        const nm = (opts && opts.names && opts.names[id]) || id;
        const key = "known:" + id;
        if (!seen.has(key)) { seen.add(key); out.push({ name: nm, cat: guessCat(nm), known: id, coords: null, conf: "high" }); }
      }
    }
    // 2) Dòng có biểu tượng ghim / nhãn địa chỉ
    const lines = src.split(/\r?\n|(?<=[.!?])\s+(?=[📍📌🏠])/u);
    for (const raw of lines) {
      const m = raw.match(/(?:📍|📌|🏠|📮|🗺️?|\b(?:địa chỉ|dia chi|address|location|add|vị trí|vi tri|quán|quan|place|where)\b\s*[:：\-–])\s*(.+)$/iu);
      if (!m) continue;
      let seg = m[1].split(/\s[-–—|•]\s|[,;（(]|\s{2,}|#/)[0];
      const co = parseCoords(raw);
      push(seg, "high", co && co.lat > 5 && co.lat < 21 && co.lng > 97 && co.lng < 106 ? { coords: co } : null);
    }
    // 3) Cụm viết hoa có từ khóa địa điểm, hoặc đứng sau "at / @ / tại / ở / quán"
    const capSeq = "[A-Z][\\p{L}'&-]*(?:\\s+(?:[A-Z][\\p{L}'&-]*|&|of|the|de|la)){0,4}";
    const re1 = new RegExp("(?:\\b(?:at|in|to|from|@|tại|ở|quán|tiệm|chợ|nhà hàng|chùa|đền)\\s+)(" + capSeq + ")", "gu");
    const re2 = new RegExp("\\b(" + capSeq + ")\\b", "gu");
    let mm;
    while ((mm = re1.exec(src))) push(mm[1], "low");
    while ((mm = re2.exec(src))) { if (PLACE_WORDS.test(mm[1]) && mm[1].split(/\s+/).length >= 2) push(mm[1], "low"); }
    // 4) Hashtag không chung chung
    const tagRe = /#([\p{L}\p{N}_]{4,30})/gu;
    while ((mm = tagRe.exec(src))) {
      const t = mm[1];
      if (GENERIC_TAGS.has(t.toLowerCase())) continue;
      if (/^(bangkok|thailand|thai|dulich|review|an|food|travel|vlog)/i.test(t) && t.length < 12) continue;
      push(humanizeTag(t), "low");
    }
    return out.slice(0, 12);
  }

  const api = {
    hasCoords,
    parseVideoLink,
    SLOT_ORDER,
    SLOT_CAP,
    haversine,
    estimateMinutes,
    parseCoords,
    shortestRoute,
    pathLength,
    allowedSlots,
    buildDays,
    buildPlan,
    mapsDirUrl,
    reviewLinks,
    extractPlaces,
    guessCat,
    KNOWN_ALIASES
  };
  root.BKK = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
