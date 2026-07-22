const STORAGE_KEY = "learning-os:ai-consultant:v1";
const MOTION_KEY = "learning-os:motion-reduced";
const READING_SOURCE_PREFIX = "learning-os:reading-source:";
const READING_SOURCE_FRAGMENT = "readingSource";
const defaultState = { xp: 0, minutes: 0, completed: [], sessions: [], reflections: [], review: [], answers: [] };
let template, state;

const $ = (selector) => document.querySelector(selector);
const load = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultState,
      ...stored,
      completed: Array.isArray(stored.completed) ? stored.completed : [],
      sessions: Array.isArray(stored.sessions) ? stored.sessions : [],
      reflections: Array.isArray(stored.reflections) ? stored.reflections : [],
      review: Array.isArray(stored.review) ? stored.review.map((item, index) => ({ ...item, id: item.id || `legacy-review-${index}` })) : [],
      answers: Array.isArray(stored.answers) ? stored.answers : []
    };
  } catch {
    return { ...defaultState, completed: [], sessions: [], reflections: [], review: [], answers: [] };
  }
};
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const readingSourceKey = (templateId) => `${READING_SOURCE_PREFIX}${templateId}`;
const loadReadingSource = (templateId) => localStorage.getItem(readingSourceKey(templateId)) || "";
const saveReadingSource = (templateId, fileId) => localStorage.setItem(readingSourceKey(templateId), fileId);
const typeLabel = { main: "主線任務", side: "支線任務", debug: "除錯實驗室", challenge: "客戶情境挑戰" };
const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function levelFor(xp) {
  const level = Math.floor(xp / 400) + 1;
  return { level, current: xp % 400, needed: 400, title: ["觀察者", "需求拆解者", "方案建構者", "問題診斷者", "解決方案架構師"][Math.min(level - 1, 4)] };
}

function renderSummary() {
  const meta = levelFor(state.xp);
  $("#level").textContent = String(meta.level).padStart(2, "0");
  $("#levelTitle").textContent = meta.title;
  $("#xp").textContent = meta.current;
  $("#nextXp").textContent = meta.needed;
  $("#levelMeter").style.width = `${(meta.current / meta.needed) * 100}%`;
  $("#minutes").textContent = `${state.minutes} 分`;
  $("#completed").textContent = state.completed.length;
  $("#streak").textContent = activeDays().length;
  $("#reviewCount").textContent = state.review.length;
}

function activeDays() {
  return [...new Set(state.sessions.map((item) => item.date))].sort();
}

function isUnlocked(mission) {
  return mission.prerequisites.every((id) => state.completed.includes(id));
}

function renderMissions() {
  const missions = [...template.missions];
  $("#missions").innerHTML = missions.map((mission, index) => {
    const done = state.completed.includes(mission.id);
    const locked = !isUnlocked(mission);
    const missing = mission.prerequisites.filter((id) => !state.completed.includes(id)).map((id) => template.missions.find((item) => item.id === id)?.title).filter(Boolean);
    return `<article class="mission ${escapeHtml(mission.type)} ${index === 0 ? "featured" : ""} ${done ? "done" : ""}">
      <div class="mission-top"><span class="pill ${escapeHtml(mission.type)}">${escapeHtml(typeLabel[mission.type] || "學習任務")}</span><span class="pill">${mission.minutes} 分鐘</span><span class="pill">${escapeHtml(mission.device)}</span></div>
      <h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(mission.summary)}</p>
      ${locked ? `<small class="prerequisite">需先完成：${missing.map(escapeHtml).join("、")}</small>` : ""}
      <div class="mission-footer"><span>+${mission.xp} 經驗值</span><button data-mission="${escapeHtml(mission.id)}" ${locked ? "disabled" : ""}>${done ? "已完成" : locked ? "尚未解鎖" : "開啟任務"}</button></div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-mission]").forEach((button) => button.addEventListener("click", () => openMission(button.dataset.mission)));
}

function renderSkills() {
  const evidence = Object.fromEntries(template.skills.map((skill) => [skill.id, skill.level]));
  state.completed.forEach((id) => template.missions.find((mission) => mission.id === id)?.skills.forEach((skill) => evidence[skill] = Math.min(5, evidence[skill] + 1)));
  $("#skills").innerHTML = template.skills.map((skill) => `<div class="skill"><div class="skill-name"><strong>${escapeHtml(skill.name)}</strong><span>第 ${evidence[skill.id]} / 5 級</span></div><div class="skill-bar">${[1,2,3,4,5].map((level) => `<i class="${level <= evidence[skill.id] ? "on" : ""}"></i>`).join("")}</div></div>`).join("");
}

function renderCalendar() {
  const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; const active = new Set(activeDays());
  $("#monthLabel").textContent = new Intl.DateTimeFormat("zh-TW", { month: "long", year: "numeric" }).format(now);
  $("#calendar").innerHTML = Array.from({ length: offset }, () => '<span class="day empty"></span>').join("") + Array.from({ length: days }, (_, index) => {
    const day = index + 1; const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return `<span class="day ${active.has(date) ? "active" : ""} ${day === now.getDate() ? "today" : ""}">${day}</span>`;
  }).join("");
}

function driveFileId(value = "") {
  try {
    const url = new URL(value.trim());
    const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return pathMatch?.[1] || url.searchParams.get("id") || "";
  } catch {
    return "";
  }
}

function readerPanel(mission) {
  const fileId = loadReadingSource(template.id);
  const startPage = mission.reading.startPage || Number(String(mission.reading.pages).match(/\d+/)?.[0] || 1);
  const endPage = mission.reading.endPage || startPage;
  const setup = `<details class="reader-source-control" ${fileId ? "" : "open"}><summary>${fileId ? "更換教材連結" : "設定私人 Google Drive PDF"}</summary><p>連結只保留在這台裝置的瀏覽器，不會寫入公開 Repository。</p><label>Google Drive PDF 連結<input id="readingSourceUrl" type="url" inputmode="url" autocomplete="url" placeholder="貼上 Google Drive PDF 共用連結" value="" /></label><button class="secondary" type="button" id="saveReadingSource">儲存教材連結</button><span class="field-error" id="readerSourceError" aria-live="polite"></span></details>`;
  if (!fileId) return `<aside class="embedded-reader reader-empty"><div class="reader-heading"><span>原文閱讀</span><strong>第 ${startPage}–${endPage} 頁</strong></div><p>設定一次私人教材連結後，之後每個任務都會在這裡直接開啟指定閱讀區域。</p>${setup}</aside>`;
  const src = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview#page=${startPage}`;
  return `<aside class="embedded-reader"><div class="reader-heading"><div><span>原文閱讀</span><strong>${mission.reading.label}</strong></div><small>第 ${startPage}–${endPage} 頁</small></div><iframe class="pdf-reader" title="${escapeHtml(mission.reading.label)}，第 ${startPage} 至 ${endPage} 頁" src="${src}" loading="lazy" allow="fullscreen"></iframe><p class="reader-note">從第 ${startPage} 頁開始，閱讀到第 ${endPage} 頁。若未載入，請確認目前瀏覽器已登入有權限的 Google 帳號。</p>${setup}</aside>`;
}

function bindReadingSource(mission) {
  $("#saveReadingSource")?.addEventListener("click", () => {
    const fileId = driveFileId($("#readingSourceUrl").value);
    if (!fileId) { $("#readerSourceError").textContent = "請貼上 Google Drive PDF 的共用連結。"; return; }
    saveReadingSource(template.id, fileId);
    openMission(mission.id);
  });
}

function openMission(id) {
  const mission = template.missions.find((item) => item.id === id); const done = state.completed.includes(id);
  const previousAnswer = state.answers.find((answer) => answer.mission === id)?.text || "";
  $("#dialogContent").innerHTML = `<div class="mission-reading-layout"><section class="mission-study"><p class="dialog-tag">${escapeHtml(typeLabel[mission.type] || "學習任務")} · ${mission.minutes} 分鐘 · ${escapeHtml(mission.device)} · +${mission.xp} 經驗值</p><h2 class="dialog-title" id="missionDialogTitle">${escapeHtml(mission.title)}</h2><p class="dialog-copy">${escapeHtml(mission.summary)}</p><div class="reading"><strong>原文閱讀索引 · ${escapeHtml(mission.reading.depth)}</strong>${escapeHtml(mission.reading.label)}<br />第 ${escapeHtml(mission.reading.pages)} 頁</div><p class="dialog-copy">完成前，先回答：<em>這個概念會改變你為客戶做出的哪一項決策？</em></p><label class="answer-field">我的回答<textarea id="missionAnswer" ${done ? "disabled" : ""}>${escapeHtml(previousAnswer)}</textarea></label><label class="answer-field">目前掌握程度<select id="missionConfidence" ${done ? "disabled" : ""}><option value="review">還不確定，加入待複習</option><option value="solid">已能清楚應用</option></select></label><p class="field-error" id="answerError" aria-live="polite"></p><div class="dialog-actions"><button class="primary" value="default" id="completeMission" ${done ? "disabled" : ""}>${done ? "已完成" : "完成任務"}</button><button class="secondary" value="cancel">稍後再學</button></div></section>${readerPanel(mission)}</div>`;
  if (!$("#missionDialog").open) $("#missionDialog").showModal();
  bindReadingSource(mission);
  $("#completeMission")?.addEventListener("click", (event) => {
    event.preventDefault();
    const answer = $("#missionAnswer").value.trim();
    if (!answer) { $("#answerError").textContent = "請先寫下你的回答，再完成任務。"; return; }
    completeMission(mission, answer, $("#missionConfidence").value);
    $("#missionDialog").close();
  });
}

function completeMission(mission, answer, confidence) {
  if (state.completed.includes(mission.id)) return;
  const date = localDate();
  state.completed.push(mission.id); state.xp += mission.xp; state.minutes += mission.minutes; state.sessions.push({ date, mission: mission.id, minutes: mission.minutes });
  state.answers.push({ mission: mission.id, text: answer, confidence, date });
  if (confidence === "review" || mission.type === "debug" || mission.type === "challenge") state.review.push({ id: `${mission.id}-${Date.now()}`, mission: mission.id, text: answer, due: date });
  save(); render();
}

function logReflection() {
  $("#reflectionNote").value = "";
  $("#reflectionError").textContent = "";
  $("#reflectionDialog").showModal();
}

function saveReflection(event) {
  event.preventDefault();
  const note = $("#reflectionNote").value.trim();
  if (!note) { $("#reflectionError").textContent = "請先輸入反思內容。"; return; }
  const id = `reflection-${Date.now()}`;
  state.reflections.push({ id, date: new Date().toISOString(), note });
  state.review.push({ id, reflection: note, due: localDate() });
  save(); render(); $("#reflectionDialog").close();
}

function renderReviewDialog() {
  const items = state.review.map((item) => {
    const mission = item.mission ? template.missions.find((entry) => entry.id === item.mission) : null;
    const title = mission?.title || "學習反思";
    const detail = item.text || item.reflection || "重新確認這項內容是否已掌握。";
    return `<article class="review-item"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p><small>加入日期：${escapeHtml(item.due || "未記錄")}</small><br /><button class="secondary" type="button" data-mastered="${escapeHtml(item.id || "")}">標記為已掌握</button></article>`;
  }).join("");
  $("#reviewContent").innerHTML = `<p class="dialog-tag">複習清單</p><h2 class="dialog-title" id="reviewDialogTitle">需要重新確認的內容</h2>${items ? `<div class="review-list">${items}</div>` : '<p class="empty-state">目前沒有待複習項目。</p>'}`;
  document.querySelectorAll("[data-mastered]").forEach((button) => button.addEventListener("click", () => {
    state.review = state.review.filter((item) => (item.id || "") !== button.dataset.mastered);
    save(); render(); renderReviewDialog();
  }));
}

function openReviewDialog() { renderReviewDialog(); $("#reviewDialog").showModal(); }

function render() { renderSummary(); renderMissions(); renderSkills(); renderCalendar(); }

function setMotionPreference(reduced) {
  document.body.classList.toggle("motion-reduced", reduced);
  const button = $("#motionToggle");
  if (!button) return;
  button.setAttribute("aria-pressed", String(reduced));
  button.textContent = reduced ? "效果：關" : "效果：開";
  button.title = reduced ? "開啟介面動態效果" : "關閉介面動態效果";
}

async function init() {
  try {
    template = await fetch("templates/ai-consultant/template.json?v=0.2.5").then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  } catch {
    $("#missions").innerHTML = '<article class="mission featured"><h3>課程內容暫時無法載入</h3><p>請確認網路後重新整理。若曾成功開啟過，離線版本會在快取完成後使用。</p></article>';
    return;
  }
  state = load(); render();
  const sourceFromFragment = new URLSearchParams(window.location.hash.slice(1)).get(READING_SOURCE_FRAGMENT);
  if (/^[a-zA-Z0-9_-]{10,}$/.test(sourceFromFragment || "")) {
    saveReadingSource(template.id, sourceFromFragment);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  }
  $("#logReflection").addEventListener("click", logReflection);
  $("#saveReflection").addEventListener("click", saveReflection);
  $("#openReview").addEventListener("click", openReviewDialog);
  setMotionPreference(localStorage.getItem(MOTION_KEY) === "true");
  $("#motionToggle").addEventListener("click", () => {
    const reduced = !document.body.classList.contains("motion-reduced");
    localStorage.setItem(MOTION_KEY, String(reduced));
    setMotionPreference(reduced);
  });
  $("#resetProgress").addEventListener("click", () => { if (window.confirm("要清除這個瀏覽器內的所有學習進度嗎？")) { localStorage.removeItem(STORAGE_KEY); state = load(); render(); } });
  if ("serviceWorker" in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("./sw.js?v=0.2.5", { updateViaCache: "none" });
  }
}
init();
