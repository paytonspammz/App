/* Sleek Points App (PWA) - localStorage based */

const STORAGE_KEY = "wife_points_app_v1";

const $ = (id) => document.getElementById(id);

function nowISO() { return new Date().toISOString(); }
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0,0,0,0);
  x.setDate(x.getDate() - day);
  return x;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute:"2-digit" });
}
function fmtDateOnly(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year:"numeric" });
}
function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1600);
}

function defaultState(){
  return {
    balance: 0,
    earnActions: [
      { id: crypto.randomUUID(), name: "Gym", points: 15 },
      { id: crypto.randomUUID(), name: "Study", points: 20 },
      { id: crypto.randomUUID(), name: "Clean Kitchen", points: 10 },
      { id: crypto.randomUUID(), name: "Cook Dinner", points: 10 },
    ],
    rewards: [
      { id: crypto.randomUUID(), name: "Date Night", cost: 50 },
      { id: crypto.randomUUID(), name: "Pick Outfit", cost: 25 },
      { id: crypto.randomUUID(), name: "Massage", cost: 40 },
    ],
    rules: [
      { id: crypto.randomUUID(), text: "Kindness counts more than perfection." },
      { id: crypto.randomUUID(), text: "Ask for bonus points on hard days." },
    ],
    events: [
      { id: crypto.randomUUID(), title: "Dinner", date: new Date().toISOString().slice(0,10) }
    ],
    history: [] // {id, type: "Earned"|"Spent"|"Adjust", name, pointsSigned, ts}
  };
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const data = JSON.parse(raw);
    // basic guards
    if(typeof data.balance !== "number") return defaultState();
    return data;
  }catch{
    return defaultState();
  }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = load();

function addHistory(entry){
  state.history.unshift({ id: crypto.randomUUID(), ts: nowISO(), ...entry });
  // keep it reasonable
  state.history = state.history.slice(0, 300);
}

function adjustBalance(delta, label, kind){
  state.balance = Math.max(0, state.balance + delta);
  addHistory({ type: kind, name: label, pointsSigned: delta });
  save();
  renderAll();
}

/* Screens */
const screens = ["home","earn","shop","rules","history","calendar"];
function showScreen(name){
  screens.forEach(s => {
    const el = $("screen-"+s);
    if(!el) return;
    el.classList.toggle("active", s === name);
  });
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.to === name);
  });
}

/* Render */
function renderHome(){
  $("balanceBig").textContent = state.balance;
  $("balanceSub").textContent = "points available";

  const weekStart = startOfWeek();
  let earned = 0, spent = 0;
  for(const h of state.history){
    const d = new Date(h.ts);
    if(d < weekStart) break;
    if(h.pointsSigned > 0) earned += h.pointsSigned;
    if(h.pointsSigned < 0) spent += Math.abs(h.pointsSigned);
  }
  $("earnedWeek").textContent = `+${earned}`;
  $("earnedWeek").className = "stat good";
  $("spentWeek").textContent = `-${spent}`;
  $("spentWeek").className = "stat bad";

  const recent = state.history.slice(0,5);
  $("recentList").innerHTML = recent.length
    ? recent.map(h => `
      <div class="item">
        <div class="left">
          <div>${escapeHtml(h.name || h.type)}</div>
          <div class="small">${fmtDate(h.ts)} • ${h.type}</div>
        </div>
        <div class="right">
          <span class="pill ${h.pointsSigned>=0?"good":"bad"}">${h.pointsSigned>=0?`+${h.pointsSigned}`:h.pointsSigned}</span>
        </div>
      </div>
    `).join("")
    : `<div class="subtle">No activity yet.</div>`;
}

function renderEarn(){
  const grid = $("earnGrid");
  grid.innerHTML = state.earnActions.map(a => `
    <div class="tile">
      <div class="name">${escapeHtml(a.name)}</div>
      <div class="meta">${a.points} pts</div>
      <div class="actions">
        <button class="btn" data-earn="${a.id}">Earn</button>
        <button class="btn secondary" data-del-earn="${a.id}">Edit</button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-earn]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.earn;
      const a = state.earnActions.find(x=>x.id===id);
      if(!a) return;
      adjustBalance(a.points, a.name, "Earned");
      toast(`+${a.points} • ${a.name}`);
    });
  });

  grid.querySelectorAll("[data-del-earn]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.delEarn;
      const a = state.earnActions.find(x=>x.id===id);
      if(!a) return;
      const name = prompt("Edit action name:", a.name);
      if(name === null) return;
      const ptsRaw = prompt("Edit points:", String(a.points));
      if(ptsRaw === null) return;
      const pts = parseInt(ptsRaw, 10);
      if(!Number.isFinite(pts)) return toast("Points must be a number.");
      a.name = name.trim() || a.name;
      a.points = pts;
      save(); renderEarn(); toast("Updated.");
    });
  });
}

function renderShop(){
  const grid = $("shopGrid");
  grid.innerHTML = state.rewards.map(r => `
    <div class="tile">
      <div class="name">${escapeHtml(r.name)}</div>
      <div class="meta">${r.cost} pts</div>
      <div class="actions">
        <button class="btn" data-buy="${r.id}">Redeem</button>
        <button class="btn secondary" data-edit-reward="${r.id}">Edit</button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-buy]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.buy;
      const r = state.rewards.find(x=>x.id===id);
      if(!r) return;
      if(state.balance < r.cost){
        toast("Not enough points.");
        return;
      }
      adjustBalance(-r.cost, r.name, "Spent");
      toast(`-${r.cost} • ${r.name}`);
    });
  });

  grid.querySelectorAll("[data-edit-reward]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.editReward;
      const r = state.rewards.find(x=>x.id===id);
      if(!r) return;
      const name = prompt("Edit reward name:", r.name);
      if(name === null) return;
      const costRaw = prompt("Edit cost:", String(r.cost));
      if(costRaw === null) return;
      const cost = parseInt(costRaw, 10);
      if(!Number.isFinite(cost)) return toast("Cost must be a number.");
      r.name = name.trim() || r.name;
      r.cost = cost;
      save(); renderShop(); toast("Updated.");
    });
  });
}

function renderRules(){
  const list = $("rulesList");
  list.innerHTML = state.rules.map(r => `
    <div class="item">
      <div class="left">
        <div>${escapeHtml(r.text)}</div>
      </div>
      <div class="right">
        <button class="btn secondary" data-edit-rule="${r.id}">Edit</button>
        <button class="btn danger" data-del-rule="${r.id}">Delete</button>
      </div>
    </div>
  `).join("") || `<div class="subtle">No rules yet.</div>`;

  list.querySelectorAll("[data-edit-rule]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const r = state.rules.find(x=>x.id===btn.dataset.editRule);
      if(!r) return;
      const text = prompt("Edit rule:", r.text);
      if(text === null) return;
      r.text = text.trim() || r.text;
      save(); renderRules(); toast("Updated.");
    });
  });
  list.querySelectorAll("[data-del-rule]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.delRule;
      state.rules = state.rules.filter(x=>x.id!==id);
      save(); renderRules(); toast("Deleted.");
    });
  });
}

function renderHistory(){
  const list = $("historyList");
  list.innerHTML = state.history.map(h => `
    <div class="item">
      <div class="left">
        <div>${escapeHtml(h.name || h.type)}</div>
        <div class="small">${fmtDate(h.ts)} • ${h.type}</div>
      </div>
      <div class="right">
        <span class="pill ${h.pointsSigned>=0?"good":"bad"}">${h.pointsSigned>=0?`+${h.pointsSigned}`:h.pointsSigned}</span>
      </div>
    </div>
  `).join("") || `<div class="subtle">No history yet.</div>`;
}

function renderCalendar(){
  const list = $("calendarList");
  const sorted = [...state.events].sort((a,b)=> (a.date||"").localeCompare(b.date||""));
  list.innerHTML = sorted.map(e => `
    <div class="item">
      <div class="left">
        <div>${escapeHtml(e.title)}</div>
        <div class="small">${escapeHtml(e.date)}</div>
      </div>
      <div class="right">
        <button class="btn secondary" data-edit-ev="${e.id}">Edit</button>
        <button class="btn danger" data-del-ev="${e.id}">Delete</button>
      </div>
    </div>
  `).join("") || `<div class="subtle">No events yet.</div>`;

  list.querySelectorAll("[data-edit-ev]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const e = state.events.find(x=>x.id===btn.dataset.editEv);
      if(!e) return;
      const title = prompt("Edit title:", e.title);
      if(title === null) return;
      const date = prompt("Edit date (YYYY-MM-DD):", e.date);
      if(date === null) return;
      e.title = title.trim() || e.title;
      e.date = date.trim() || e.date;
      save(); renderCalendar(); toast("Updated.");
    });
  });
  list.querySelectorAll("[data-del-ev]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.delEv;
      state.events = state.events.filter(x=>x.id!==id);
      save(); renderCalendar(); toast("Deleted.");
    });
  });
}

function renderAll(){
  renderHome();
  renderEarn();
  renderShop();
  renderRules();
  renderHistory();
  renderCalendar();
}

/* Add items */
$("addEarnBtn").addEventListener("click", ()=>{
  const name = $("earnName").value.trim();
  const pts = parseInt($("earnPts").value, 10);
  if(!name) return toast("Add an action name.");
  if(!Number.isFinite(pts)) return toast("Points must be a number.");
  state.earnActions.unshift({ id: crypto.randomUUID(), name, points: pts });
  $("earnName").value = ""; $("earnPts").value = "";
  save(); renderEarn(); toast("Added.");
});

$("addRewardBtn").addEventListener("click", ()=>{
  const name = $("rewardName").value.trim();
  const cost = parseInt($("rewardCost").value, 10);
  if(!name) return toast("Add a reward name.");
  if(!Number.isFinite(cost)) return toast("Cost must be a number.");
  state.rewards.unshift({ id: crypto.randomUUID(), name, cost });
  $("rewardName").value = ""; $("rewardCost").value = "";
  save(); renderShop(); toast("Added.");
});

$("addRuleBtn").addEventListener("click", ()=>{
  const text = $("ruleText").value.trim();
  if(!text) return toast("Add a rule.");
  state.rules.unshift({ id: crypto.randomUUID(), text });
  $("ruleText").value = "";
  save(); renderRules(); toast("Added.");
});

$("addAdjBtn").addEventListener("click", ()=>{
  const pts = parseInt($("adjPts").value, 10);
  if(!Number.isFinite(pts)) return toast("Enter a number (e.g., -10).");
  const reason = ($("adjReason").value.trim() || "Adjustment");
  adjustBalance(pts, reason, "Adjust");
  $("adjPts").value = ""; $("adjReason").value = "";
  toast("Applied.");
});

$("addEventBtn").addEventListener("click", ()=>{
  const title = $("eventTitle").value.trim();
  const date = $("eventDate").value;
  if(!title) return toast("Add a title.");
  if(!date) return toast("Pick a date.");
  state.events.unshift({ id: crypto.randomUUID(), title, date });
  $("eventTitle").value = ""; $("eventDate").value = "";
  save(); renderCalendar(); toast("Added.");
});

/* Navigation */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>showScreen(btn.dataset.to));
});

/* Reset */
$("resetBtn").addEventListener("click", ()=>{
  const ok = confirm("Reset all data on this iPad? This cannot be undone.");
  if(!ok) return;
  state = defaultState();
  save();
  renderAll();
  toast("Reset.");
});

/* Helpers */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

/* PWA SW */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}

/* Initial */
renderAll();
showScreen("home");
