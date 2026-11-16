// Cập nhật data/live.json từ YouTube + Google Places. Chạy bằng GitHub Actions (xem .github/workflows/refresh-data.yml).
// Cần Node 20+. Khóa API đặt trong GitHub Secrets: YT_API_KEY, GOOGLE_PLACES_KEY (cả hai đều tùy chọn).
// Lưu ý: script này CHƯA được chạy thử với khóa thật. Hãy chạy tay một lần (workflow_dispatch) và xem log.
import fs from "node:fs/promises";
import vm from "node:vm";

const YT = process.env.YT_API_KEY;
const GP = process.env.GOOGLE_PLACES_KEY;
const DAYS_BACK = Number(process.env.VIDEO_DAYS_BACK || 120);

const src = await fs.readFile(new URL("../data/places.js", import.meta.url), "utf8");
const ctx = vm.createContext({});
vm.runInContext(src, ctx);
const places = ctx.BKK_PLACES;
if (!Array.isArray(places) || !places.length) throw new Error("Không đọc được data/places.js");

let prev = { places: {} };
try { prev = JSON.parse(await fs.readFile(new URL("../data/live.json", import.meta.url), "utf8")); } catch { /* lần đầu */ }

const out = { updatedAt: new Date().toISOString(), places: {} };

async function youtube(p) {
  const after = new Date(Date.now() - DAYS_BACK * 864e5).toISOString();
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  u.search = new URLSearchParams({
    part: "snippet", type: "video", order: "date", maxResults: "3", videoEmbeddable: "true",
    q: `${p.q} review`, publishedAfter: after, regionCode: "TH", key: YT
  });
  const r = await fetch(u);
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.items || []).map((i) => ({
    id: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle, publishedAt: i.snippet.publishedAt
  }));
}

async function placesApi(p) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GP,
      "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount,places.businessStatus"
    },
    body: JSON.stringify({
      textQuery: p.q, languageCode: "vi", maxResultCount: 1,
      locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 1500 } }
    })
  });
  if (!r.ok) throw new Error(`Places ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const hit = ((await r.json()).places || [])[0];
  if (!hit) return null;
  return { rating: hit.rating ?? null, ratings: hit.userRatingCount ?? null, status: hit.businessStatus ?? null };
}

if (!YT && !GP) console.log("Không có khóa API nào, giữ nguyên dữ liệu cũ.");

for (const p of places) {
  const entry = { ...(prev.places?.[p.id] || {}) }; // lỗi mạng một địa điểm thì giữ dữ liệu cũ của nó
  if (YT) {
    try { entry.videos = await youtube(p); } catch (e) { console.warn(p.id, "YouTube:", e.message); }
  }
  if (GP) {
    try {
      const g = await placesApi(p);
      if (g) Object.assign(entry, g);
    } catch (e) { console.warn(p.id, "Places:", e.message); }
  }
  if (Object.keys(entry).length) out.places[p.id] = entry;
  await new Promise((r) => setTimeout(r, 150));
}

await fs.writeFile(new URL("../data/live.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`Đã ghi data/live.json cho ${Object.keys(out.places).length}/${places.length} địa điểm.`);
