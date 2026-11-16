// Chạy: node test/lib.test.js
const assert = require("node:assert/strict");
const path = require("node:path");
require(path.join(__dirname, "../data/places.js"));
const L = require(path.join(__dirname, "../lib.js"));
const P = globalThis.BKK_PLACES;

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("dữ liệu: id duy nhất, tọa độ nằm quanh Bangkok, có nguồn", () => {
  const ids = new Set();
  for (const p of P) {
    assert.ok(!ids.has(p.id), "trùng id " + p.id);
    ids.add(p.id);
    assert.ok(p.lat > 13.6 && p.lat < 13.9 && p.lng > 100.4 && p.lng < 100.7, p.id + " ngoài Bangkok");
    assert.ok(p.sources && p.sources.length >= 1, p.id + " thiếu nguồn");
    assert.ok(p.cats.length >= 1 && p.slots.length >= 1, p.id + " thiếu cats/slots");
    for (const s of p.sources) assert.match(s.u, /^https:\/\//);
  }
  assert.ok(P.length >= 20);
});

t("haversine: Siam Paragon -> MBK sát nhau (~0,5 km); Chatuchak -> Asiatique rất xa (~12 km)", () => {
  const g = (id) => P.find((p) => p.id === id);
  const near = L.haversine(g("paragon"), g("mbk"));
  assert.ok(near > 0.3 && near < 0.9, "near=" + near);
  const far = L.haversine(g("chatuchak"), g("asiatique"));
  assert.ok(far > 10 && far < 14, "far=" + far);
});

t("parseCoords", () => {
  assert.deepEqual(L.parseCoords("13.7563, 100.5018"), { lat: 13.7563, lng: 100.5018 });
  assert.deepEqual(L.parseCoords("https://www.google.com/maps/place/X/@13.7467,100.5392,17z"), { lat: 13.7467, lng: 100.5392 });
  assert.deepEqual(L.parseCoords("...!3d13.7467!4d100.5392"), { lat: 13.7467, lng: 100.5392 });
  assert.equal(L.parseCoords("https://maps.app.goo.gl/f8DfC1i9sAMK4BBA8"), null);
  assert.equal(L.parseCoords("abc"), null);
  assert.equal(L.parseCoords("95.1, 100.2"), null);
});

t("shortestRoute: đường thẳng bị xáo -> trả về đúng thứ tự", () => {
  const pts = [3, 1, 4, 2, 5].map((i) => ({ id: i, lat: 13.7 + i * 0.01, lng: 100.5 }));
  const origin = { lat: 13.7, lng: 100.5 };
  const r = L.shortestRoute(origin, pts);
  assert.deepEqual(r.map((p) => p.id), [1, 2, 3, 4, 5]);
});

t("shortestRoute: >9 điểm vẫn ra đủ điểm và không tệ hơn thứ tự gốc", () => {
  const pts = P.slice(0, 12);
  const origin = { lat: 13.75, lng: 100.52 };
  const r = L.shortestRoute(origin, pts);
  assert.equal(r.length, 12);
  assert.equal(new Set(r.map((p) => p.id)).size, 12);
  assert.ok(L.pathLength(origin, r) <= L.pathLength(origin, pts) + 1e-9);
});

t("shortestRoute: vét cạn không tệ hơn nearest-neighbor", () => {
  const pts = P.slice(0, 8);
  const origin = { lat: 13.74, lng: 100.53 };
  const best = L.pathLength(origin, L.shortestRoute(origin, pts));
  const left = pts.slice(); let prev = origin; let d = 0;
  while (left.length) { let bi = 0, bd = Infinity; left.forEach((p, i) => { const x = L.haversine(prev, p); if (x < bd) { bd = x; bi = i; } }); d += bd; prev = left.splice(bi, 1)[0]; }
  assert.ok(best <= d + 1e-9);
});

const trip = { start: "2026-12-08", end: "2026-12-12", firstDaySlots: ["afternoon", "evening", "night"], lastDaySlots: ["morning"] };

t("buildDays: 5 ngày, đúng thứ", () => {
  const days = L.buildDays(trip);
  assert.equal(days.length, 5);
  assert.deepEqual(days.map((d) => d.weekday), [2, 3, 4, 5, 6]); // Tue..Sat
  assert.deepEqual(days[0].slots, trip.firstDaySlots);
  assert.deepEqual(days[4].slots, ["morning"]);
});

t("buildPlan: chọn hết 22 điểm, Chatuchak chỉ vào đêm thứ Sáu hoặc sáng thứ Bảy", () => {
  const days = L.buildDays(trip);
  const { plan, unplaced } = L.buildPlan(P.map((p) => ({ ...p, score: 1 })), days);
  const placed = plan.flatMap((d) => Object.values(d.slots).flat());
  assert.equal(placed.length + unplaced.length, P.length);
  assert.equal(new Set(placed.map((p) => p.id)).size, placed.length, "điểm bị xếp trùng");
  const where = [];
  plan.forEach((d) => Object.entries(d.slots).forEach(([s, arr]) => arr.forEach((p) => p.id === "chatuchak" && where.push([d.weekday, s]))));
  if (where.length) {
    const [wd, s] = where[0];
    assert.ok((wd === 5 && ["evening", "night"].includes(s)) || (wd === 6 && ["morning", "afternoon"].includes(s)), JSON.stringify(where));
  }
  // ngày đầu không có buổi sáng, ngày cuối chỉ có buổi sáng
  assert.equal(plan[0].slots.morning.length, 0);
  ["afternoon", "evening", "night"].forEach((s) => assert.equal(plan[4].slots[s].length, 0));
});

t("buildPlan: mỗi buổi không vượt sức chứa", () => {
  const days = L.buildDays(trip);
  const { plan } = L.buildPlan(P.map((p) => ({ ...p, score: 1 })), days);
  plan.forEach((d) => Object.entries(d.slots).forEach(([s, arr]) => assert.ok(arr.length <= L.SLOT_CAP[s])));
});

t("buildPlan: Chatuchak không xếp được nếu chỉ còn ngày thường", () => {
  const days = L.buildDays({ ...trip, end: "2026-12-10" }); // Tue..Thu
  const { plan, unplaced } = L.buildPlan([{ ...P.find((p) => p.id === "chatuchak"), score: 1 }], days);
  assert.equal(unplaced.length, 1);
  assert.equal(plan.flatMap((d) => Object.values(d.slots).flat()).length, 0);
});

t("parseVideoLink: nhận diện, làm sạch và từ chối link lạ", () => {
  const yt = L.parseVideoLink("https://youtu.be/dQw4w9WgXcQ?si=abc&t=10");
  assert.deepEqual(yt, { type: "youtube", id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  assert.equal(L.parseVideoLink("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share").id, "dQw4w9WgXcQ");
  assert.equal(L.parseVideoLink("https://www.youtube.com/shorts/abcDEF12345").id, "abcDEF12345");
  const tt = L.parseVideoLink("Xem video này nè https://www.tiktok.com/@foodie/video/7300000000000000000?is_from_webapp=1&sender_device=pc #bangkok");
  assert.deepEqual(tt, { type: "tiktok", id: null, url: "https://www.tiktok.com/@foodie/video/7300000000000000000" });
  assert.equal(L.parseVideoLink("https://vm.tiktok.com/ZSabc123/").url, "https://vm.tiktok.com/ZSabc123");
  assert.equal(L.parseVideoLink("tiktok.com/@a/video/1").type, "tiktok");
  assert.equal(L.parseVideoLink("https://fb.watch/abc123/").type, "facebook");
  // từ chối
  for (const bad of ["", null, "hello", "https://example.com/x", "https://evil.com/?u=https://youtube.com/watch?v=aaaaaaaaaaa",
    "https://tiktok.com.evil.com/@a/video/1", "https://nottiktok.com/@a/video/1", "javascript:alert(1)",
    "https://user:pw@www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.tiktok.com/", "ftp://youtube.com/watch?v=dQw4w9WgXcQ"]) {
    assert.equal(L.parseVideoLink(bad), null, "phải từ chối: " + bad);
  }
});

t("mapsDirUrl & reviewLinks", () => {
  const u = L.mapsDirUrl({ origin: "13.7,100.5", stops: ["A Bangkok", "B Bangkok", "C Bangkok"], mode: "driving" });
  assert.match(u, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
  assert.match(u, /destination=C\+Bangkok/);
  assert.match(u, /waypoints=A\+Bangkok%7CB\+Bangkok/);
  const r = L.reviewLinks(P[0]);
  assert.match(r.tiktok, /tiktok\.com\/search/);
  assert.match(r.youtube, /sp=CAI%253D/);
});

console.log("\nTất cả " + n + " nhóm test đạt.");
