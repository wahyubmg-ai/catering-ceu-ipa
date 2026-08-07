/* ==========================================================================
   Dashboard Management System — Ceu Ipa
   Prototype MVP front-end sesuai PRD. Data operasional (omzet, transaksi,
   stok, dst) adalah data simulasi lokal — belum terhubung ke mesin kasir
   sungguhan. Import CSV & export CSV/PDF berfungsi nyata di sisi browser.
   ========================================================================== */

(() => {
"use strict";

/* ---------------------------------------------------------------------- */
/* Utils                                                                   */
/* ---------------------------------------------------------------------- */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const rupiah = (n) =>
  "Rp" + Math.round(n).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const num = (n) => Math.round(n).toLocaleString("id-ID");

function pad2(n) { return n.toString().padStart(2, "0"); }

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Deterministic PRNG so numbers stay stable within a day (mulberry32)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rngFor(...parts) { return mulberry32(seedFromString(parts.join("|"))); }

function daysAgoKey(offset, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() - offset);
  return todayKey(d);
}
const DOW_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const MONTH_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function store(key, fallback) {
  try {
    const raw = localStorage.getItem("dms_" + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function persist(key, value) {
  try { localStorage.setItem("dms_" + key, JSON.stringify(value)); } catch {}
}

/* ---------------------------------------------------------------------- */
/* Domain constants (menyesuaikan menu Catering Ceu Ipa)                   */
/* ---------------------------------------------------------------------- */

const MENU_ITEMS = [
  { id: "nasibox-ayam",  nama: "Nasi Box Ayam Bakar",   harga: 22000, hpp: 13500, baseQty: 68 },
  { id: "nasibox-sayap", nama: "Nasi Box Sayap Goreng", harga: 20000, hpp: 12000, baseQty: 54 },
  { id: "nasibox-array", nama: "Nasi Box Ikan Nila",    harga: 21000, hpp: 13000, baseQty: 30 },
  { id: "nasi-liwet",    nama: "Paket Nasi Liwet",      harga: 35000, hpp: 21000, baseQty: 18 },
  { id: "prasmanan",     nama: "Prasmanan (per porsi)", harga: 28000, hpp: 17500, baseQty: 22 },
  { id: "tumpeng-mini",  nama: "Tumpeng Mini",          harga: 150000, hpp: 92000, baseQty: 3 },
  { id: "snack-box",     nama: "Snack Box",             harga: 12000, hpp: 7200, baseQty: 40 },
  { id: "aqiqah-paket",  nama: "Paket Aqiqah",          harga: 450000, hpp: 290000, baseQty: 1 },
];

const INGREDIENTS = [
  { id: "beras",   nama: "Beras",              unit: "kg",  stok: 38,  min: 40,  perhari: 9 },
  { id: "ayam",    nama: "Ayam Potong",         unit: "kg",  stok: 22,  min: 20,  perhari: 7 },
  { id: "minyak",  nama: "Minyak Goreng",       unit: "liter", stok: 9, min: 15,  perhari: 4 },
  { id: "gas",     nama: "Gas LPG 12kg",        unit: "tabung", stok: 2, min: 3,  perhari: 0.6 },
  { id: "sayur",   nama: "Sayur Campur",        unit: "kg",  stok: 14, min: 10,  perhari: 5 },
  { id: "bumbu",   nama: "Bumbu Dapur",         unit: "paket", stok: 6, min: 5,  perhari: 1.2 },
  { id: "dusnasi", nama: "Dus Nasi Box",        unit: "pcs", stok: 180, min: 150, perhari: 65 },
  { id: "ikan",    nama: "Ikan Nila",           unit: "kg",  stok: 5,  min: 8,   perhari: 3 },
  { id: "telur",   nama: "Telur Ayam",          unit: "kg",  stok: 12, min: 8,   perhari: 3.5 },
];

const EMPLOYEES = [
  { id: "e1", nama: "Teh Ani",  peran: "Kasir",  pin: "1234" },
  { id: "e2", nama: "Kang Dadan", peran: "Kasir", pin: "2222" },
  { id: "e3", nama: "Teh Rina", peran: "Dapur",  pin: "3333" },
  { id: "e4", nama: "Kang Ujang", peran: "Dapur/Antar", pin: "4444" },
];

const SUPPLIERS = ["Toko Beras Pak Yayat", "Ayam Segar Sumedang", "Warung Sembako Bu Neni", "Distributor Gas Barokah"];

/* ---------------------------------------------------------------------- */
/* Mock data generators                                                    */
/* ---------------------------------------------------------------------- */

// Omzet harian & per-jam diturunkan dari data menu (menuAnalysis) yang sama
// supaya Total Omzet, HPP, dan Laba Kotor selalu konsisten satu sama lain.
function dayMenuRows(dateKey) {
  return menuAnalysis(dateKey + "_hari", 1);
}
function dayMenuRevenue(dateKey) {
  return dayMenuRows(dateKey).reduce((s, m) => s + m.revenue, 0);
}
function dayMenuHpp(dateKey) {
  return dayMenuRows(dateKey).reduce((s, m) => s + m.qty * m.hpp, 0);
}

function hourlySeries(dateKey) {
  const rng = rngFor("hourly", dateKey);
  const weights = [];
  let totalWeight = 0;
  for (let h = 6; h <= 22; h++) {
    let w;
    if (h >= 11 && h <= 13) w = 3.0 + rng() * 1.4;      // makan siang
    else if (h >= 17 && h <= 19) w = 2.6 + rng() * 1.3; // makan malam
    else if (h >= 7 && h <= 9) w = 1.3 + rng() * 0.7;   // sarapan
    else w = 0.4 + rng() * 0.6;
    weights.push({ hour: h, w });
    totalWeight += w;
  }
  const dayTotal = dayMenuRevenue(dateKey);
  return weights.map(({ hour, w }) => ({ hour, omzet: Math.round((dayTotal * w) / totalWeight) }));
}

function peakHour(hours) {
  return hours.reduce((a, b) => (b.omzet > a.omzet ? b : a), hours[0]);
}

function dailyTotalFor(dateKey) {
  return dayMenuRevenue(dateKey);
}

function weeklySeries(base = new Date()) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    out.push({ key: todayKey(d), label: DOW_ID[d.getDay()].slice(0, 3), omzet: dailyTotalFor(todayKey(d)) });
  }
  return out;
}

function transactionCountFor(dateKey, omzet) {
  const rng = rngFor("txcount", dateKey);
  const avgOrder = 24000 + rng() * 6000;
  return Math.max(8, Math.round(omzet / avgOrder));
}

function menuAnalysis(periodKey, multiplier = 1) {
  const rng = rngFor("menu", periodKey);
  return MENU_ITEMS.map((m) => {
    const qty = Math.max(0, Math.round(m.baseQty * multiplier * (0.3 + rng() * 1.3)));
    const revenue = qty * m.harga;
    const marginPct = Math.round(((m.harga - m.hpp) / m.harga) * 100);
    const trend = Math.round((rng() * 30 - 12) * 10) / 10;
    const status = qty > m.baseQty * multiplier * 0.85 ? "laris" : qty < m.baseQty * multiplier * 0.45 ? "kurang" : "normal";
    return { ...m, qty, revenue, marginPerUnit: m.harga - m.hpp, marginPct, trend, status };
  });
}

function todaysTransactions(dateKey) {
  const rng = rngFor("tx", dateKey);
  const count = 18 + Math.floor(rng() * 10);
  const out = [];
  const now = new Date();
  const isToday = dateKey === todayKey();
  const maxHour = isToday ? Math.max(6, now.getHours()) : 22;
  for (let i = 0; i < count; i++) {
    const hour = 6 + Math.floor(rng() * (Math.min(22, maxHour) - 6 + 1));
    const minute = Math.floor(rng() * 60);
    const kasir = EMPLOYEES.filter((e) => e.peran === "Kasir")[Math.floor(rng() * 2)];
    const itemsN = 1 + Math.floor(rng() * 3);
    let total = 0;
    for (let n = 0; n < itemsN; n++) {
      const item = MENU_ITEMS[Math.floor(rng() * MENU_ITEMS.length)];
      total += item.harga * (1 + Math.floor(rng() * 2));
    }
    const voidFlag = rng() > 0.93;
    const discPct = rng() > 0.9 ? Math.round(rng() * 40 + 10) : 0;
    out.push({
      waktu: `${pad2(hour)}:${pad2(minute)}`,
      meja: rng() > 0.5 ? `Meja ${1 + Math.floor(rng() * 8)}` : `Antrian #${20 + Math.floor(rng() * 60)}`,
      kasir: kasir.nama,
      total: Math.round(total),
      voidFlag,
      discPct,
      suspicious: voidFlag || discPct > 25,
    });
  }
  return out.sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
}

function cashierPerf(dateKey) {
  const rng = rngFor("cashierperf", dateKey);
  return EMPLOYEES.filter((e) => e.peran === "Kasir").map((e) => ({
    nama: e.nama,
    perJam: Math.round(4 + rng() * 5),
  }));
}

function monthlyProfit(base = new Date()) {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base); d.getMonth();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const rng = rngFor("month", key);
    // Skala mengikuti rata-rata omzet harian dari model menu (~Rp5-6 juta/hari x 30)
    const omzet = 150000000 + rng() * 45000000;
    const hpp = omzet * (0.56 + rng() * 0.05);
    const biaya = 6500000 + rng() * 2000000;
    out.push({ label: `${MONTH_ID[d.getMonth()]}`, omzet, laba: omzet - hpp - biaya });
  }
  return out;
}

function cashflowSeries(base = new Date()) {
  const out = [];
  let saldo = 8500000;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const rng = rngFor("cashflow", key);
    const masuk = dailyTotalFor(key);
    const keluar = masuk * (0.55 + rng() * 0.15) + (rng() > 0.85 ? rng() * 800000 : 0);
    saldo += masuk - keluar;
    out.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, masuk, keluar, saldo });
  }
  return out;
}

function purchaseHistory() {
  const rng = rngFor("purchase", "static");
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const ing = INGREDIENTS[Math.floor(rng() * INGREDIENTS.length)];
    const d = new Date(); d.setDate(d.getDate() - Math.floor(rng() * 14));
    rows.push({
      tanggal: `${d.getDate()}/${d.getMonth() + 1}`,
      bahan: ing.nama,
      jumlah: `${Math.round(5 + rng() * 20)} ${ing.unit}`,
      supplier: SUPPLIERS[Math.floor(rng() * SUPPLIERS.length)],
      biaya: Math.round(50000 + rng() * 400000),
    });
  }
  return rows.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

/* ---------------------------------------------------------------------- */
/* State                                                                    */
/* ---------------------------------------------------------------------- */

const state = {
  role: store("role", "owner"),
  theme: store("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  tab: "ringkasan",
  onboarded: store("onboarded", false),
  kasir: store("kasir", { connected: false, method: null }),
  periodFilter: "hari",
  menuSort: { col: "revenue", dir: "desc" },
  targets: store("targets", { harian: 5000000, bulanan: 155000000 }),
  biaya: store("biaya", { sewa: 2500000, listrik: 900000, gaji: 4200000 }),
  notif: store("notif", { wa: true, push: true, email: false }),
  expenses: store("expenses", []),
  attendance: store("attendance", []),
  clockedIn: store("clockedIn", {}),
  csvToday: store("csvToday", null), // overrides today's transactions if imported
  onbSelection: null,
  onbShopName: store("shopName", "Warung Ceu Ipa"),
  onbOwnerName: store("ownerName", ""),
  liveTick: 0,
};

function setRole(r) { state.role = r; persist("role", r); renderAll(); }
function setTheme(t) {
  state.theme = t; persist("theme", t);
  document.documentElement.setAttribute("data-theme", t);
  $("#themeToggle").textContent = t === "dark" ? "☀️" : "🌙";
  refreshChartThemes();
}

/* ---------------------------------------------------------------------- */
/* Toast                                                                    */
/* ---------------------------------------------------------------------- */

function toast(msg) {
  const stack = $("#toastStack");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

/* ---------------------------------------------------------------------- */
/* Navigation                                                               */
/* ---------------------------------------------------------------------- */

const TABS = [
  { id: "ringkasan", label: "Ringkasan", icon: "🏠" },
  { id: "penjualan", label: "Penjualan", icon: "📈" },
  { id: "stok", label: "Stok", icon: "📦" },
  { id: "kasir", label: "Kasir & SDM", icon: "🧑‍🍳" },
  { id: "keuangan", label: "Keuangan", icon: "💰", ownerOnly: true },
];

function isLocked(tabId) {
  const t = TABS.find((x) => x.id === tabId);
  return t?.ownerOnly && state.role !== "owner";
}

function goTo(tabId) {
  state.tab = tabId;
  $$(".section").forEach((s) => s.classList.toggle("active", s.id === "sec-" + tabId));
  $$(".bottom-nav button, .side-nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tabId)
  );
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  renderTab(tabId);
}

function buildNav() {
  const bottom = $("#bottomNav");
  const side = $("#sideNav");
  bottom.innerHTML = "";
  side.innerHTML = "";
  TABS.forEach((t) => {
    const locked = isLocked(t.id);
    const b1 = document.createElement("button");
    b1.dataset.tab = t.id;
    b1.className = locked ? "locked" : "";
    b1.innerHTML = `<span class="nav-ic">${t.icon}</span><span>${t.label}</span>`;
    b1.addEventListener("click", () => goTo(t.id));
    bottom.appendChild(b1);

    const b2 = document.createElement("button");
    b2.dataset.tab = t.id;
    b2.className = locked ? "locked" : "";
    b2.innerHTML = `<span class="nav-ic">${t.icon}</span><span>${t.label}</span>`;
    b2.addEventListener("click", () => goTo(t.id));
    side.appendChild(b2);
  });
  $$(".bottom-nav button, .side-nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
}

/* ---------------------------------------------------------------------- */
/* Charts registry (destroy/recreate on re-render to avoid leaks)          */
/* ---------------------------------------------------------------------- */

const charts = {};
function chartColors() {
  const dark = state.theme === "dark";
  return {
    grid: dark ? "rgba(255,255,255,.08)" : "rgba(44,26,20,.08)",
    text: dark ? "#d9c9c1" : "#64748b",
    red: "#c0392b",
    redSoft: dark ? "rgba(192,57,43,.35)" : "rgba(192,57,43,.18)",
    ink: dark ? "#f4ece7" : "#2c3e50",
  };
}
function makeChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el.getContext("2d"), config);
}
function refreshChartThemes() {
  // simplest: re-render current tab so charts pick up new colors
  renderTab(state.tab);
}

/* ---------------------------------------------------------------------- */
/* Renderers — Module 1: Ringkasan Harian                                  */
/* ---------------------------------------------------------------------- */

function renderRingkasan() {
  const key = todayKey();
  const hours = hourlySeries(key);
  const omzetToday = state.csvToday ? state.csvToday.reduce((s, t) => s + t.total, 0) : hours.reduce((s, h) => s + h.omzet, 0);
  const txToday = state.csvToday ? state.csvToday.length : transactionCountFor(key, omzetToday);
  const avgOrder = omzetToday / Math.max(1, txToday);
  const yesterdayOmzet = dailyTotalFor(daysAgoKey(1));
  const deltaPct = ((omzetToday - yesterdayOmzet) / yesterdayOmzet) * 100;
  const activeTables = 2 + Math.floor((state.liveTick + seedFromString(key)) % 6);
  const criticalStock = INGREDIENTS.filter((i) => i.stok <= i.min * 0.6).length;

  const now = new Date();
  const isMidday = now.getHours() >= 12;
  const pctOfTarget = (omzetToday / state.targets.harian) * 100;
  const showTargetAlert = isMidday && pctOfTarget < 70;

  $("#alertBanner").innerHTML = "";
  if (showTargetAlert && state.role === "owner") {
    $("#alertBanner").innerHTML = `
      <div class="alert-banner">
        <span style="font-size:18px">⚠️</span>
        <div>
          <strong>Omzet di bawah target</strong>
          Baru ${rupiah(omzetToday)} (${pctOfTarget.toFixed(0)}% dari target harian ${rupiah(state.targets.harian)}) padahal sudah lewat tengah hari.
        </div>
        <button class="close-x" data-dismiss>✕</button>
      </div>`;
    $("[data-dismiss]")?.addEventListener("click", (e) => e.target.closest(".alert-banner").remove());
  } else if (criticalStock > 0) {
    $("#alertBanner").innerHTML = `
      <div class="alert-banner">
        <span style="font-size:18px">📦</span>
        <div>
          <strong>${criticalStock} bahan baku kritis</strong>
          Segera cek menu Stok untuk detail dan daftar belanja otomatis.
        </div>
        <button class="close-x" data-dismiss>✕</button>
      </div>`;
    $("[data-dismiss]")?.addEventListener("click", (e) => e.target.closest(".alert-banner").remove());
  }

  const cards = [
    { ic: "💰", label: "Total Omzet Hari Ini", value: rupiah(omzetToday), sub: `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct).toFixed(1)}% vs kemarin`, cls: deltaPct >= 0 ? "up" : "down", tag: "Real-time", financial: true },
    { ic: "📋", label: "Jumlah Transaksi", value: num(txToday), sub: "pesanan selesai", cls: "", tag: "Real-time" },
    { ic: "🍽", label: "Rata-rata Nilai Order", value: rupiah(avgOrder), sub: "per transaksi", cls: "", tag: "Real-time", financial: true },
    { ic: "👥", label: "Pelanggan Aktif", value: num(activeTables), sub: "meja/antrian aktif", cls: "", tag: "Real-time" },
    { ic: "📦", label: "Stok Kritis", value: num(criticalStock), sub: criticalStock > 0 ? "perlu perhatian" : "aman semua", cls: criticalStock > 0 ? "down" : "up", tag: "Tiap jam", alert: criticalStock > 0 },
    { ic: "📈", label: "Dibanding Kemarin", value: `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`, sub: rupiah(yesterdayOmzet) + " kemarin", cls: deltaPct >= 0 ? "up" : "down", tag: "Real-time", financial: true },
  ];
  const isOwner = state.role === "owner";
  $("#kpiGrid").innerHTML = cards.map((c) => {
    if (c.financial && !isOwner) {
      return `<div class="kpi-card">
        <span class="kpi-tag">Owner only</span>
        <div class="kpi-ic">${c.ic}</div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value" style="color:var(--ink-300)">🔒 ••••</div>
        <div class="kpi-sub" style="color:var(--ink-500)">Khusus Owner</div>
      </div>`;
    }
    return `<div class="kpi-card ${c.alert ? "alert" : ""}">
      <span class="kpi-tag">${c.tag}</span>
      <div class="kpi-ic">${c.ic}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-sub ${c.cls}">${c.sub}</div>
    </div>`;
  }).join("");

  const chartPanel = $("#ringkasanChartPanel");
  if (!isOwner) {
    chartPanel.innerHTML = `<div class="locked-state" style="padding:36px 20px">
      <div class="ic">🔒</div>
      <h3>Grafik omzet khusus Owner</h3>
      <p>Manajer dapat memantau stok, transaksi, dan kehadiran karyawan di menu lainnya.</p>
    </div>`;
    return;
  }
  chartPanel.innerHTML = `<div class="panel-head"><h2>Omzet per Jam Hari Ini</h2><span class="hint" id="peakHourNote"></span></div>
    <div class="chart-box"><canvas id="chartHourlyMini"></canvas></div>`;

  const peak = peakHour(hours);
  const colors = chartColors();
  makeChart("chartHourlyMini", {
    type: "line",
    data: {
      labels: hours.map((h) => `${h.hour}:00`),
      datasets: [{
        data: hours.map((h) => h.omzet),
        borderColor: colors.red, backgroundColor: colors.redSoft, fill: true, tension: .35,
        pointRadius: hours.map((h) => (h.hour === peak.hour ? 4 : 0)),
        pointBackgroundColor: colors.red,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => rupiah(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: colors.text, maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: colors.text, callback: (v) => (v / 1000) + "k" }, grid: { color: colors.grid } },
      },
    },
  });
  $("#peakHourNote").textContent = `Jam ramai hari ini: ${peak.hour}:00–${peak.hour + 1}:00 (${rupiah(peak.omzet)})`;
}

/* ---------------------------------------------------------------------- */
/* Renderers — Module 2: Laporan Penjualan                                 */
/* ---------------------------------------------------------------------- */

function periodMultiplier(period) {
  return period === "hari" ? 1 : period === "minggu" ? 6.5 : period === "bulan" ? 28 : 4;
}

function renderPenjualan() {
  const key = todayKey();
  const hours = hourlySeries(key);
  const peak = peakHour(hours);
  const colors = chartColors();
  const isOwner = state.role === "owner";

  $$("#periodChips .chip").forEach((c) => c.classList.toggle("active", c.dataset.period === state.periodFilter));
  $("#penjualanExportRow").style.display = isOwner ? "flex" : "none";
  $("#penjualanLocked").style.display = isOwner ? "none" : "block";
  $("#penjualanFinancial").style.display = isOwner ? "block" : "none";

  if (!isOwner) { renderMenuTable(); return; }

  makeChart("chartHourly", {
    type: "line",
    data: {
      labels: hours.map((h) => `${h.hour}:00`),
      datasets: [{
        label: "Omzet/jam",
        data: hours.map((h) => h.omzet),
        borderColor: colors.red, backgroundColor: colors.redSoft, fill: true, tension: .3,
        pointRadius: hours.map((h) => (h.hour === peak.hour ? 5 : 2)),
        pointBackgroundColor: hours.map((h) => (h.hour === peak.hour ? colors.red : colors.ink)),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => rupiah(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: colors.text }, grid: { display: false } },
        y: { ticks: { color: colors.text, callback: (v) => (v / 1000) + "k" }, grid: { color: colors.grid } },
      },
    },
  });

  const week = weeklySeries();
  makeChart("chartWeekly", {
    type: "bar",
    data: {
      labels: week.map((w) => w.label),
      datasets: [{
        data: week.map((w) => w.omzet),
        backgroundColor: week.map((w) => (w.key === key ? colors.red : colors.redSoft)),
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => rupiah(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: colors.text }, grid: { display: false } },
        y: { ticks: { color: colors.text, callback: (v) => (v / 1000) + "k" }, grid: { color: colors.grid } },
      },
    },
  });

  const thisMonth = monthlyProfit().at(-1);
  const lastMonth = monthlyProfit().at(-2);
  $("#periodCompare").innerHTML = `
    <div class="stat-mini"><div class="lbl">Omzet bulan ini</div><div class="val">${rupiah(thisMonth.omzet)}</div></div>
    <div class="stat-mini"><div class="lbl">Omzet bulan lalu</div><div class="val">${rupiah(lastMonth.omzet)}</div></div>
    <div class="stat-mini"><div class="lbl">Selisih</div><div class="val ${thisMonth.omzet >= lastMonth.omzet ? "pos" : "neg"}">${thisMonth.omzet >= lastMonth.omzet ? "+" : ""}${(((thisMonth.omzet - lastMonth.omzet) / lastMonth.omzet) * 100).toFixed(1)}%</div></div>
    <div class="stat-mini"><div class="lbl">Jam puncak hari ini</div><div class="val">${peak.hour}:00</div></div>
  `;

  renderMenuTable();
}

function renderMenuTable() {
  const isOwner = state.role === "owner";
  const mult = periodMultiplier(state.periodFilter);
  let rows = menuAnalysis(todayKey() + "_" + state.periodFilter, mult);
  const { col, dir } = state.menuSort;
  const sortCol = !isOwner && (col === "revenue" || col === "marginPct") ? "qty" : col;
  rows = rows.slice().sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    return (av > bv ? 1 : av < bv ? -1 : 0) * (dir === "asc" ? 1 : -1);
  });
  window.__menuRows = rows;

  $("#menuTableHead").innerHTML = `<tr>
    <th class="sortable" data-col="nama">Nama Menu</th>
    <th class="sortable" data-col="qty">Qty Terjual</th>
    ${isOwner ? '<th class="sortable" data-col="revenue">Total Pendapatan</th><th class="sortable" data-col="marginPct">Margin Kasar</th>' : ""}
    <th class="sortable" data-col="trend">Trend</th>
    <th class="sortable" data-col="status">Status</th>
  </tr>`;
  $$("#menuTableHead th[data-col]").forEach((th) => th.addEventListener("click", () => {
    const c = th.dataset.col;
    if (state.menuSort.col === c) state.menuSort.dir = state.menuSort.dir === "asc" ? "desc" : "asc";
    else state.menuSort = { col: c, dir: "desc" };
    renderMenuTable();
  }));

  $("#menuTableBody").innerHTML = rows.map((r) => `
    <tr>
      <td>${r.nama}</td>
      <td>${num(r.qty)}</td>
      ${isOwner ? `<td>${rupiah(r.revenue)}</td><td>${rupiah(r.marginPerUnit)} <span style="color:var(--ink-500)">(${r.marginPct}%)</span></td>` : ""}
      <td style="color:${r.trend >= 0 ? "var(--green)" : "var(--red-500)"}">${r.trend >= 0 ? "⬆" : "⬇"} ${Math.abs(r.trend)}%</td>
      <td>${r.status === "laris" ? '<span class="badge-status aman">🔥 Laris</span>' : r.status === "kurang" ? '<span class="badge-status kritis">💀 Kurang laku</span>' : '<span class="badge-status perlu">Normal</span>'}</td>
    </tr>`).join("");
}

/* ---------------------------------------------------------------------- */
/* Renderers — Module 3: Stok & Bahan Baku                                 */
/* ---------------------------------------------------------------------- */

function stockStatus(i) {
  if (i.stok <= i.min * 0.6) return "kritis";
  if (i.stok <= i.min) return "perlu";
  return "aman";
}

function renderStok() {
  const rows = INGREDIENTS.map((i) => ({ ...i, status: stockStatus(i), hari: (i.stok / i.perhari).toFixed(1) }));
  const kritis = rows.filter((r) => r.status === "kritis");

  $("#stokAlert").innerHTML = kritis.length ? `
    <div class="alert-banner">
      <span style="font-size:18px">⚠️</span>
      <div>
        <strong>${kritis.length} bahan baku perlu segera dibeli</strong>
        ${kritis.map((k) => k.nama).join(", ")}.
      </div>
    </div>` : "";

  $("#stokTableBody").innerHTML = rows.map((r) => `
    <tr class="${r.status === "kritis" ? "flagged" : ""}">
      <td>${r.nama}</td>
      <td>${r.stok} ${r.unit}</td>
      <td>${r.min} ${r.unit}</td>
      <td>${badgeStok(r.status)}</td>
      <td>${r.hari} hari</td>
    </tr>`).join("");

  $("#purchaseHistBody").innerHTML = purchaseHistory().map((p) => `
    <tr><td>${p.tanggal}</td><td>${p.bahan}</td><td>${p.jumlah}</td><td>${p.supplier}</td><td>${rupiah(p.biaya)}</td></tr>
  `).join("");

  const expenseRows = state.expenses.slice().reverse();
  $("#expenseBody").innerHTML = expenseRows.length ? expenseRows.map((e) => `
    <tr><td>${e.tanggal}</td><td>${e.item}</td><td>${rupiah(e.jumlah)}</td></tr>
  `).join("") : `<tr><td colspan="3" style="text-align:center;color:var(--ink-500)">Belum ada pengeluaran dicatat manual.</td></tr>`;
}

function badgeStok(status) {
  if (status === "aman") return '<span class="badge-status aman">🟢 Aman</span>';
  if (status === "perlu") return '<span class="badge-status perlu">🟡 Perlu Beli</span>';
  return '<span class="badge-status kritis">🔴 Kritis</span>';
}

function generateShoppingList() {
  const rows = INGREDIENTS.filter((i) => stockStatus(i) !== "aman").map((i) => ({
    bahan: i.nama, sarankuantitas: `${Math.max(i.min * 2 - i.stok, i.min)} ${i.unit}`,
  }));
  if (!rows.length) { toast("Semua stok aman, belum perlu belanja 👍"); return; }
  const csv = ["Bahan,Saran Kuantitas Beli", ...rows.map((r) => `${r.bahan},${r.sarankuantitas}`)].join("\n");
  downloadText(`daftar-belanja-${todayKey()}.csv`, csv);
  toast(`Daftar belanja (${rows.length} item) berhasil diunduh`);
}

/* ---------------------------------------------------------------------- */
/* Renderers — Module 4: Kasir & Karyawan                                  */
/* ---------------------------------------------------------------------- */

function renderKasir() {
  const key = todayKey();
  const txs = state.csvToday || todaysTransactions(key);
  window.__txRows = txs;

  $("#txTableBody").innerHTML = txs.slice(0, 40).map((t) => `
    <tr class="${t.suspicious ? "flagged" : ""}">
      <td>${t.waktu}</td>
      <td>${t.meja}</td>
      <td>${t.kasir}</td>
      <td>${rupiah(t.total)}</td>
      <td>${t.suspicious ? `<span class="badge-status kritis">⚠️ ${t.voidFlag ? "Void" : "Diskon " + t.discPct + "%"}</span>` : "—"}</td>
    </tr>`).join("");

  const colors = chartColors();
  const perf = cashierPerf(key);
  makeChart("chartCashier", {
    type: "bar",
    data: {
      labels: perf.map((p) => p.nama),
      datasets: [{ data: perf.map((p) => p.perJam), backgroundColor: colors.red, borderRadius: 8, maxBarThickness: 60 }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.parsed.x + " transaksi/jam" } } },
      scales: {
        x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
        y: { ticks: { color: colors.text }, grid: { display: false } },
      },
    },
  });

  $("#shiftBody").innerHTML = EMPLOYEES.map((e) => {
    const inState = state.clockedIn[e.id];
    return `<tr>
      <td>${e.nama}</td><td>${e.peran}</td>
      <td>${e.peran === "Kasir" ? "08:00 – 16:00" : "07:00 – 15:00"}</td>
      <td>${inState ? `<span class="badge-status aman">🟢 Clock-in ${inState.jam}</span>` : '<span class="badge-status perlu">Belum absen</span>'}</td>
    </tr>`;
  }).join("");

  const att = state.attendance.slice().reverse().slice(0, 10);
  $("#attendanceBody").innerHTML = att.length ? att.map((a) => `
    <tr><td>${a.tanggal}</td><td>${a.nama}</td><td>${a.jamMasuk}</td><td>${a.jamKeluar || "—"}</td></tr>
  `).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--ink-500)">Belum ada riwayat absensi bulan ini.</td></tr>`;

}

/* ---------------------------------------------------------------------- */
/* Renderers — Module 5: Laporan Keuangan (Owner only)                     */
/* ---------------------------------------------------------------------- */

function renderKeuangan() {
  const locked = state.role !== "owner";
  $("#keuanganLocked").style.display = locked ? "block" : "none";
  $("#keuanganContent").style.display = locked ? "none" : "block";
  $("#keuanganActions").style.display = locked ? "none" : "flex";
  if (locked) return;

  const key = todayKey();
  const omzetToday = dailyTotalFor(key);
  const hppToday = dayMenuHpp(key);
  const biayaHarian = (state.biaya.sewa + state.biaya.listrik + state.biaya.gaji) / 30;
  const labaKotor = omzetToday - hppToday - biayaHarian;

  $("#plSummary").innerHTML = `
    <div class="stat-mini"><div class="lbl">Omzet</div><div class="val">${rupiah(omzetToday)}</div></div>
    <div class="stat-mini"><div class="lbl">HPP Bahan</div><div class="val neg">-${rupiah(hppToday)}</div></div>
    <div class="stat-mini"><div class="lbl">Biaya Operasional/hari</div><div class="val neg">-${rupiah(biayaHarian)}</div></div>
    <div class="stat-mini"><div class="lbl">Laba Kotor</div><div class="val ${labaKotor >= 0 ? "pos" : "neg"}">${rupiah(labaKotor)}</div></div>
  `;
  $("#biayaSewa").value = state.biaya.sewa;
  $("#biayaListrik").value = state.biaya.listrik;
  $("#biayaGaji").value = state.biaya.gaji;

  const colors = chartColors();
  const months = monthlyProfit();
  makeChart("chartMonthlyProfit", {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [{ data: months.map((m) => m.laba), backgroundColor: colors.red, borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => rupiah(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: colors.text }, grid: { display: false } },
        y: { ticks: { color: colors.text, callback: (v) => (v / 1e6) + "jt" }, grid: { color: colors.grid } },
      },
    },
  });

  const cf = cashflowSeries();
  const today = cf.at(-1), yesterday = cf.at(-2);
  const avgDailyNet = cf.slice(-7).reduce((s, c) => s + (c.masuk - c.keluar), 0) / 7;
  const daysLeftInMonth = 30 - new Date().getDate();
  const predictedEom = today.saldo + avgDailyNet * daysLeftInMonth;

  $("#cashflowStats").innerHTML = `
    <div class="stat-mini"><div class="lbl">Saldo Kas Hari Ini</div><div class="val">${rupiah(today.saldo)}</div></div>
    <div class="stat-mini"><div class="lbl">Saldo Kemarin</div><div class="val">${rupiah(yesterday.saldo)}</div></div>
    <div class="stat-mini"><div class="lbl">Perubahan</div><div class="val ${today.saldo >= yesterday.saldo ? "pos" : "neg"}">${today.saldo >= yesterday.saldo ? "+" : ""}${rupiah(today.saldo - yesterday.saldo)}</div></div>
    <div class="stat-mini"><div class="lbl">Prediksi Saldo Akhir Bulan</div><div class="val">${rupiah(predictedEom)}</div></div>
  `;
  makeChart("chartCashflow", {
    type: "line",
    data: {
      labels: cf.map((c) => c.label),
      datasets: [
        { label: "Saldo", data: cf.map((c) => c.saldo), borderColor: colors.red, backgroundColor: colors.redSoft, fill: true, tension: .3, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => rupiah(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: colors.text, maxTicksLimit: 7 }, grid: { display: false } },
        y: { ticks: { color: colors.text, callback: (v) => (v / 1e6) + "jt" }, grid: { color: colors.grid } },
      },
    },
  });

  const pctHarianReal = state.targets.harian > 0 ? (omzetToday / state.targets.harian) * 100 : 0;
  const monthOmzet = months.at(-1).omzet;
  const pctBulananReal = state.targets.bulanan > 0 ? (monthOmzet / state.targets.bulanan) * 100 : 0;
  $("#targetHarian").value = state.targets.harian;
  $("#targetBulanan").value = state.targets.bulanan;
  $("#progressHarian").style.width = Math.min(100, pctHarianReal) + "%";
  $("#progressHarian").parentElement.classList.toggle("warn", pctHarianReal < 70);
  $("#progressHarianLabel").textContent = `${rupiah(omzetToday)} / ${rupiah(state.targets.harian)} (${pctHarianReal.toFixed(0)}%)`;
  $("#progressBulanan").style.width = Math.min(100, pctBulananReal) + "%";
  $("#progressBulanan").parentElement.classList.toggle("warn", pctBulananReal < 70);
  $("#progressBulananLabel").textContent = `${rupiah(monthOmzet)} / ${rupiah(state.targets.bulanan)} (${pctBulananReal.toFixed(0)}%)`;
}

/* ---------------------------------------------------------------------- */
/* Tab dispatch                                                            */
/* ---------------------------------------------------------------------- */

function renderTab(tab) {
  if (tab === "ringkasan") renderRingkasan();
  else if (tab === "penjualan") renderPenjualan();
  else if (tab === "stok") renderStok();
  else if (tab === "kasir") renderKasir();
  else if (tab === "keuangan") renderKeuangan();
}

function renderAll() {
  buildNav();
  $("#kasirStatusPill").className = "status-pill" + (state.kasir.connected ? " is-on" : "");
  $("#kasirStatusPill").innerHTML = `<span class="dot"></span><span class="lbl">${state.kasir.connected ? "Kasir Terhubung" : "Kasir Belum Terhubung"}</span>`;
  $$(".role-switch button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
  renderTab(state.tab);
}

/* ---------------------------------------------------------------------- */
/* CSV import / export                                                     */
/* ---------------------------------------------------------------------- */

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(",").map((h) => h.trim().toLowerCase());
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

function handleCsvFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCsv(String(reader.result));
      const txs = rows.map((r) => ({
        waktu: r.waktu || "00:00",
        meja: r.meja || "-",
        kasir: r.kasir || "-",
        total: Number(r.total || 0),
        voidFlag: false, discPct: 0, suspicious: false,
      })).filter((t) => t.total > 0);
      if (!txs.length) throw new Error("empty");
      state.csvToday = txs;
      persist("csvToday", txs);
      state.kasir = { connected: true, method: "csv" };
      persist("kasir", state.kasir);
      toast(`Import berhasil: ${txs.length} transaksi dimuat dari CSV`);
      renderAll();
    } catch {
      toast("Gagal membaca CSV. Pastikan format: waktu,meja,kasir,total");
    }
  };
  reader.readAsText(file);
}

function downloadSampleCsv() {
  const sample = [
    "waktu,meja,kasir,total",
    "11:15,Meja 3,Teh Ani,45000",
    "12:02,Antrian #21,Kang Dadan,68000",
    "12:40,Meja 5,Teh Ani,22000",
  ].join("\n");
  downloadText("contoh-import-kasir.csv", sample);
}

/* ---------------------------------------------------------------------- */
/* Onboarding                                                              */
/* ---------------------------------------------------------------------- */

let onbStepIdx = 0;
function openOnboarding() {
  onbStepIdx = 0;
  $("#onbShopName").value = state.onbShopName;
  $("#onbOwnerName").value = state.onbOwnerName;
  updateOnbStep();
  $("#onboardingOverlay").classList.add("open");
}
function closeOnboarding(skip) {
  $("#onboardingOverlay").classList.remove("open");
  if (skip) { state.onboarded = true; persist("onboarded", true); }
}
function updateOnbStep() {
  $$(".onb-step").forEach((s, i) => s.classList.toggle("active", i === onbStepIdx));
  $$(".step-dots span").forEach((d, i) => d.classList.toggle("on", i === onbStepIdx));
  $("#onbBack").style.visibility = onbStepIdx === 0 ? "hidden" : "visible";
  $("#onbNext").textContent = onbStepIdx === 2 ? "Mulai Pakai 🎉" : "Lanjut";
}
function onbNext() {
  if (onbStepIdx === 0) {
    state.onbShopName = $("#onbShopName").value.trim() || "Warung Ceu Ipa";
    state.onbOwnerName = $("#onbOwnerName").value.trim();
    persist("shopName", state.onbShopName);
    persist("ownerName", state.onbOwnerName);
    $("#brandShopName").textContent = state.onbShopName;
  }
  if (onbStepIdx === 2) {
    state.onboarded = true; persist("onboarded", true);
    closeOnboarding(false);
    renderAll();
    toast(`Selamat datang, ${state.onbShopName}! 🎉`);
    return;
  }
  onbStepIdx++; updateOnbStep();
}
function onbBack() { if (onbStepIdx > 0) { onbStepIdx--; updateOnbStep(); } }

function selectOnbOption(method) {
  $$(".onb-option").forEach((o) => o.classList.toggle("selected", o.dataset.method === method));
  state.onbSelection = method;
  if (method === "api") {
    toast("Menghubungkan ke kasir…");
    setTimeout(() => {
      state.kasir = { connected: true, method: "api" };
      persist("kasir", state.kasir);
      toast("Kasir berhasil terhubung ✅");
      renderAll();
    }, 900);
  } else if (method === "csv") {
    $("#onbCsvInput").click();
  } else {
    state.kasir = { connected: false, method: null };
    persist("kasir", state.kasir);
  }
}

/* ---------------------------------------------------------------------- */
/* Settings modal                                                          */
/* ---------------------------------------------------------------------- */

function openSettings() {
  $("#setNotifWa").checked = state.notif.wa;
  $("#setNotifPush").checked = state.notif.push;
  $("#setNotifEmail").checked = state.notif.email;
  $("#setKasirStatus").textContent = state.kasir.connected
    ? `Terhubung via ${state.kasir.method === "api" ? "API Kasir" : "Import CSV"}`
    : "Belum terhubung";
  $("#settingsOverlay").classList.add("open");
}
function closeSettings() { $("#settingsOverlay").classList.remove("open"); }

/* ---------------------------------------------------------------------- */
/* PIN pad clock-in / clock-out                                            */
/* ---------------------------------------------------------------------- */

let pinBuffer = "";
function openPinPad() {
  pinBuffer = "";
  renderPinDots();
  $("#pinEmpName").textContent = "Masukkan PIN karyawan";
  $("#pinPadOverlay").classList.add("open");
}
function closePinPad() { $("#pinPadOverlay").classList.remove("open"); }
function renderPinDots() {
  $("#pinDots").innerHTML = Array.from({ length: 4 }).map((_, i) => `<span class="${i < pinBuffer.length ? "filled" : ""}"></span>`).join("");
}
function pinPress(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  renderPinDots();
  if (pinBuffer.length === 4) checkPin();
}
function pinBackspace() { pinBuffer = pinBuffer.slice(0, -1); renderPinDots(); }
function checkPin() {
  const emp = EMPLOYEES.find((e) => e.pin === pinBuffer);
  if (!emp) {
    $("#pinEmpName").textContent = "PIN salah, coba lagi";
    $("#pinEmpName").style.color = "var(--red-500)";
    setTimeout(() => { pinBuffer = ""; renderPinDots(); $("#pinEmpName").style.color = ""; $("#pinEmpName").textContent = "Masukkan PIN karyawan"; }, 700);
    return;
  }
  const now = new Date();
  const jam = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const already = state.clockedIn[emp.id];
  if (already) {
    delete state.clockedIn[emp.id];
    const rec = state.attendance.find((a) => a.nama === emp.nama && !a.jamKeluar && a.tanggal === todayKey());
    if (rec) rec.jamKeluar = jam;
    toast(`${emp.nama} clock-out ${jam}`);
  } else {
    state.clockedIn[emp.id] = { jam };
    state.attendance.push({ tanggal: todayKey(), nama: emp.nama, jamMasuk: jam, jamKeluar: null });
    toast(`${emp.nama} clock-in ${jam}`);
  }
  persist("clockedIn", state.clockedIn);
  persist("attendance", state.attendance);
  closePinPad();
  renderTab("kasir");
}

/* ---------------------------------------------------------------------- */
/* Wire up static DOM                                                      */
/* ---------------------------------------------------------------------- */

function buildStaticMarkup() {
  // KPI / peak note is generated in renderRingkasan
  $("#brandShopName").textContent = state.onbShopName;

  // Period chips
  $("#periodChips").innerHTML = [
    ["hari", "Hari ini"], ["minggu", "Minggu ini"], ["bulan", "Bulan ini"], ["custom", "Custom"],
  ].map(([id, label]) => `<button class="chip" data-period="${id}">${label}</button>`).join("");
  $$("#periodChips .chip").forEach((c) => c.addEventListener("click", () => {
    state.periodFilter = c.dataset.period;
    if (c.dataset.period === "custom") toast("Pilih rentang tanggal lalu tekan cari (demo: memakai data 30 hari terakhir)");
    renderPenjualan();
  }));

  // Export buttons
  $("#exportMenuCsv").addEventListener("click", () => {
    const rows = window.__menuRows || [];
    const csv = ["Nama Menu,Qty Terjual,Total Pendapatan,Margin Kasar,Trend %,Status",
      ...rows.map((r) => `${r.nama},${r.qty},${r.revenue},${r.marginPerUnit},${r.trend},${r.status}`)].join("\n");
    downloadText(`laporan-menu-${todayKey()}.csv`, csv);
    toast("Laporan menu diekspor ke CSV");
  });
  $("#exportPdf").addEventListener("click", () => {
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("print-target"));
    $("#sec-penjualan").classList.add("print-target");
    window.print();
  });
  $("#exportTxCsv").addEventListener("click", () => {
    const rows = window.__txRows || [];
    const csv = ["Waktu,Meja,Kasir,Total,Suspicious", ...rows.map((r) => `${r.waktu},${r.meja},${r.kasir},${r.total},${r.suspicious ? "YA" : ""}`)].join("\n");
    downloadText(`transaksi-${todayKey()}.csv`, csv);
    toast("Data transaksi diekspor ke CSV");
  });

  // Stok
  $("#genShoppingList").addEventListener("click", generateShoppingList);
  $("#expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = $("#expenseItem").value.trim();
    const jumlah = Number($("#expenseAmount").value);
    if (!item || !jumlah) return;
    state.expenses.push({ tanggal: todayKey(), item, jumlah });
    persist("expenses", state.expenses);
    $("#expenseForm").reset();
    renderStok();
    toast("Pengeluaran dicatat");
  });

  // Kasir PIN
  $("#openPinPad").addEventListener("click", openPinPad);
  $$(".pin-pad button[data-d]").forEach((b) => b.addEventListener("click", () => pinPress(b.dataset.d)));
  $("#pinBackspace").addEventListener("click", pinBackspace);
  $("#closePinPad").addEventListener("click", closePinPad);

  // Keuangan forms
  $("#biayaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.biaya = {
      sewa: Number($("#biayaSewa").value) || 0,
      listrik: Number($("#biayaListrik").value) || 0,
      gaji: Number($("#biayaGaji").value) || 0,
    };
    persist("biaya", state.biaya);
    renderKeuangan();
    toast("Biaya operasional diperbarui");
  });
  $("#targetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.targets = {
      harian: Number($("#targetHarian").value) || 0,
      bulanan: Number($("#targetBulanan").value) || 0,
    };
    persist("targets", state.targets);
    renderKeuangan();
    toast("Target omzet diperbarui");
  });
  $("#exportKeuanganPdf").addEventListener("click", () => {
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("print-target"));
    $("#sec-keuangan").classList.add("print-target");
    window.print();
  });

  // Role switch
  $$(".role-switch button").forEach((b) => b.addEventListener("click", () => setRole(b.dataset.role)));

  // Theme
  $("#themeToggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

  // Settings
  $("#openSettings").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", closeSettings);
  $("#closeSettingsBottom").addEventListener("click", closeSettings);
  $("#settingsOverlay").addEventListener("click", (e) => { if (e.target.id === "settingsOverlay") closeSettings(); });
  $("#setNotifWa").addEventListener("change", (e) => { state.notif.wa = e.target.checked; persist("notif", state.notif); });
  $("#setNotifPush").addEventListener("change", (e) => { state.notif.push = e.target.checked; persist("notif", state.notif); });
  $("#setNotifEmail").addEventListener("change", (e) => { state.notif.email = e.target.checked; persist("notif", state.notif); });
  $("#setConnectApi").addEventListener("click", () => selectOnbOption("api"));
  $("#setImportCsv").addEventListener("click", () => $("#settingsCsvInput").click());
  $("#settingsCsvInput").addEventListener("change", (e) => {
    if (e.target.files[0]) handleCsvFile(e.target.files[0]);
    e.target.value = "";
    openSettings();
  });
  $("#setDisconnect").addEventListener("click", () => {
    state.kasir = { connected: false, method: null }; persist("kasir", state.kasir);
    state.csvToday = null; persist("csvToday", null);
    openSettings(); renderAll();
    toast("Kasir diputus. Data kembali ke simulasi.");
  });
  $("#setRestartOnboarding").addEventListener("click", () => { closeSettings(); openOnboarding(); });
  $("#setDownloadSample").addEventListener("click", downloadSampleCsv);

  // Onboarding wiring
  $("#onbNext").addEventListener("click", onbNext);
  $("#onbBack").addEventListener("click", onbBack);
  $("#onbSkip").addEventListener("click", () => closeOnboarding(true));
  $$(".onb-option").forEach((o) => o.addEventListener("click", () => selectOnbOption(o.dataset.method)));
  $("#onbCsvInput").addEventListener("change", (e) => {
    if (e.target.files[0]) handleCsvFile(e.target.files[0]);
    e.target.value = "";
    selectOnbOption("csv");
  });
}

/* ---------------------------------------------------------------------- */
/* Boot                                                                     */
/* ---------------------------------------------------------------------- */

function boot() {
  document.documentElement.setAttribute("data-theme", state.theme);
  $("#themeToggle").textContent = state.theme === "dark" ? "☀️" : "🌙";
  buildStaticMarkup();
  buildNav();
  renderAll();
  goTo("ringkasan");

  if (!state.onboarded) setTimeout(openOnboarding, 400);

  // simulate light "real-time" drift on the home KPIs
  setInterval(() => {
    state.liveTick++;
    if (state.tab === "ringkasan") renderRingkasan();
  }, 15000);
}

document.addEventListener("DOMContentLoaded", boot);
})();
