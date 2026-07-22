import { readFile } from "node:fs/promises";

const VERSION = "0.2.3";
const files = Object.fromEntries(await Promise.all(
  ["index.html", "app.js", "sw.js", "styles.css", "manifest.webmanifest", "templates/ai-consultant/template.json"]
    .map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), "utf8")])
));
const manifest = JSON.parse(files["manifest.webmanifest"]);
const template = JSON.parse(files["templates/ai-consultant/template.json"]);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(files["index.html"].includes('lang="zh-Hant-TW"'), "HTML 語言必須是 zh-Hant-TW");
check(files["index.html"].includes(`<meta name="app-version" content="${VERSION}"`), "HTML 版本標記不一致");
check(manifest.lang === "zh-Hant-TW", "PWA manifest 語言不一致");
check(manifest.start_url.includes(`v=${VERSION}`), "PWA 啟動網址缺少目前版本");
check(manifest.scope === "./", "PWA scope 必須明確限制在目前路徑");
check(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"), "PWA 缺少 192x192 PNG 圖示");
check(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"), "PWA 缺少 512x512 PNG 圖示");
check(template.version === VERSION, "課程範本版本不一致");
check(template.locale === "zh-Hant-TW", "課程範本語言不一致");
check(template.languagePolicy?.autoTranslateTerms === false, "課程範本不得自動翻譯術語");

for (const path of ["index.html", "app.js", "sw.js"]) {
  check(files[path].includes(VERSION), `${path} 缺少目前版本 ${VERSION}`);
}
check(files["sw.js"].includes("self.skipWaiting()"), "Service Worker 必須立即接管新版");
check(files["sw.js"].includes('cache: "reload"'), "預先快取必須略過舊 HTTP cache");
check(files["app.js"].includes('updateViaCache: "none"'), "Service Worker 更新不得使用舊 HTTP cache");
check(files["index.html"].includes('id="motionToggle"'), "首頁缺少動態效果開關");
check(files["app.js"].includes("MOTION_KEY"), "動態效果偏好必須保留在本機");
check(files["styles.css"].includes("prefers-reduced-motion"), "樣式必須支援系統減少動態效果偏好");
check(files["app.js"].includes("READING_SOURCE_PREFIX"), "閱讀器教材來源必須只保留在本機");
check(files["app.js"].includes("drive.google.com/file/d/"), "閱讀器必須支援 Google Drive PDF 預覽");
check(files["styles.css"].includes("mission-reading-layout"), "閱讀器缺少 Fold 雙欄版面規則");

const forbiddenLegacyText = [
  "Observer", "MAIN QUEST", "SIDE QUEST", "DEBUG LAB", "CLIENT CHALLENGE",
  "Completed", "Locked", "Reading index", "Complete mission", "Save for later",
  "Design the context", "Agent thinking", "Context engineering", "Solution architecture"
];
const visibleSources = `${files["index.html"]}\n${files["app.js"]}\n${files["templates/ai-consultant/template.json"]}`;
for (const text of forbiddenLegacyText) check(!visibleSources.includes(text), `仍含舊英文顯示文字：${text}`);

const missionIds = new Set(template.missions.map((mission) => mission.id));
check(missionIds.size === template.missions.length, "任務 ID 不可重複");
for (const mission of template.missions) {
  check(Boolean(mission.title && mission.summary), `任務 ${mission.id} 缺少標題或說明`);
  check(Number.isFinite(mission.minutes) && mission.minutes > 0, `任務 ${mission.id} 的分鐘數無效`);
  check(Number.isFinite(mission.xp) && mission.xp > 0, `任務 ${mission.id} 的經驗值無效`);
  check(Boolean(mission.device), `任務 ${mission.id} 缺少建議裝置`);
  check(Number.isInteger(mission.reading?.startPage) && Number.isInteger(mission.reading?.endPage) && mission.reading.startPage <= mission.reading.endPage, `任務 ${mission.id} 缺少有效的閱讀頁碼範圍`);
  for (const prerequisite of mission.prerequisites) {
    check(missionIds.has(prerequisite), `任務 ${mission.id} 指向不存在的前置任務 ${prerequisite}`);
  }
}

if (failures.length) {
  console.error(`QA 失敗，共 ${failures.length} 項：`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`QA 通過：繁體中文、版本一致性、PWA 設定與 ${template.missions.length} 個任務資料均符合規格。`);
