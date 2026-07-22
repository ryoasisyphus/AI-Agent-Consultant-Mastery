const STORAGE_KEY = "learning-os:ai-consultant:v1";
const defaultState = { xp: 0, minutes: 0, completed: [], sessions: [], reflections: [], review: [] };
let template, state;

const $ = (selector) => document.querySelector(selector);
const load = () => ({ ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") });
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const typeLabel = { main: "主線任務", side: "支線任務", debug: "除錯實驗室", challenge: "客戶情境挑戰" };

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
  const missions = [...template.missions].sort((a, b) => (a.type === "main" ? -1 : 1));
  $("#missions").innerHTML = missions.map((mission, index) => {
    const done = state.completed.includes(mission.id);
    const locked = !isUnlocked(mission);
    return `<article class="mission ${index === 0 ? "featured" : ""} ${done ? "done" : ""}">
      <div class="mission-top"><span class="pill ${mission.type}">${typeLabel[mission.type]}</span><span class="pill">${mission.minutes} 分鐘</span></div>
      <h3>${mission.title}</h3><p>${mission.summary}</p>
      <div class="mission-footer"><span>+${mission.xp} 經驗值</span><button data-mission="${mission.id}" ${locked ? "disabled" : ""}>${done ? "已完成" : locked ? "尚未解鎖" : "開啟任務"}</button></div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-mission]").forEach((button) => button.addEventListener("click", () => openMission(button.dataset.mission)));
}

function renderSkills() {
  const evidence = Object.fromEntries(template.skills.map((skill) => [skill.id, skill.level]));
  state.completed.forEach((id) => template.missions.find((mission) => mission.id === id)?.skills.forEach((skill) => evidence[skill] = Math.min(5, evidence[skill] + 1)));
  $("#skills").innerHTML = template.skills.map((skill) => `<div class="skill"><div class="skill-name"><strong>${skill.name}</strong><span>第 ${evidence[skill.id]} / 5 級</span></div><div class="skill-bar">${[1,2,3,4,5].map((level) => `<i class="${level <= evidence[skill.id] ? "on" : ""}"></i>`).join("")}</div></div>`).join("");
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

function openMission(id) {
  const mission = template.missions.find((item) => item.id === id); const done = state.completed.includes(id);
  $("#dialogContent").innerHTML = `<p class="dialog-tag">${typeLabel[mission.type]} · ${mission.minutes} 分鐘 · +${mission.xp} 經驗值</p><h2 class="dialog-title">${mission.title}</h2><p class="dialog-copy">${mission.summary}</p><div class="reading"><strong>原文閱讀索引 · ${mission.reading.depth}</strong>${mission.reading.label}<br />第 ${mission.reading.pages} 頁</div><p class="dialog-copy">完成前，先回答一題：<em>這個概念會改變你為客戶做出的哪一項決策？</em></p><div class="dialog-actions"><button class="primary" value="default" id="completeMission" ${done ? "disabled" : ""}>${done ? "已完成" : "完成任務"}</button><button class="secondary" value="cancel">稍後再學</button></div>`;
  $("#missionDialog").showModal();
  $("#completeMission")?.addEventListener("click", (event) => { event.preventDefault(); completeMission(mission); $("#missionDialog").close(); });
}

function completeMission(mission) {
  if (state.completed.includes(mission.id)) return;
  const date = new Date().toISOString().slice(0, 10);
  state.completed.push(mission.id); state.xp += mission.xp; state.minutes += mission.minutes; state.sessions.push({ date, mission: mission.id, minutes: mission.minutes });
  if (mission.type === "debug" || mission.type === "challenge") state.review.push({ mission: mission.id, due: date });
  save(); render();
}

function logReflection() {
  const note = window.prompt("今天有哪些地方不確定、有幫助，或值得之後重新複習？");
  if (!note?.trim()) return;
  state.reflections.push({ date: new Date().toISOString(), note: note.trim() }); state.review.push({ reflection: note.trim(), due: new Date().toISOString().slice(0, 10) }); save(); render();
}

function render() { renderSummary(); renderMissions(); renderSkills(); renderCalendar(); }

async function init() {
  template = await fetch("templates/ai-consultant/template.json").then((response) => response.json()); state = load(); render();
  $("#logReflection").addEventListener("click", logReflection);
  $("#resetProgress").addEventListener("click", () => { if (window.confirm("要清除這個瀏覽器內的所有學習進度嗎？")) { localStorage.removeItem(STORAGE_KEY); state = load(); render(); } });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
}
init();
