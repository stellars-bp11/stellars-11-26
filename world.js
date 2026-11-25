import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
  authDomain: "class-web-7241e.firebaseapp.com",
  projectId: "class-web-7241e",
  storageBucket: "class-web-7241e.firebasestorage.app",
  messagingSenderId: "167560389153",
  appId: "1:167560389153:web:f61f4f821275c48373f960",
  measurementId: "G-DTHTZNT135"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const canvas = document.getElementById("worldCanvas");
const ctx = canvas.getContext("2d");
const avatarCanvas = document.getElementById("avatarCanvas");
const avatarCtx = avatarCanvas.getContext("2d");
const $ = id => document.getElementById(id);

const SAVE_PREFIX = "stellarsWorldPreviewV1";
const TILE_W = 60;
const TILE_H = 30;
const MAP_W = 18;
const MAP_H = 15;
const ORIGIN_X = 500;
const ORIGIN_Y = 57;

const jobs = [
  { id: "farmer", name: "Farmer", icon: "🌱", desc: "Grow crops and harvest the farm.", place: "farm" },
  { id: "cashier", name: "Cashier", icon: "☕", desc: "Serve neighbours at the Comet Café.", place: "cafe" },
  { id: "firefighter", name: "Firefighter", icon: "🚒", desc: "Train and respond to town emergencies.", place: "fire" },
  { id: "police", name: "Police Officer", icon: "🚓", desc: "Patrol the district and help residents.", place: "police" },
  { id: "builder", name: "Builder", icon: "🧱", desc: "Help construct shared town projects.", place: "townhall" },
  { id: "trader", name: "Virtual Trader", icon: "📈", desc: "Trade fictional goods at Star Market.", place: "market" },
  { id: "courier", name: "Courier", icon: "📦", desc: "Deliver parcels around the district.", place: "townhall" },
  { id: "trickster", name: "Trickster", icon: "🦝", desc: "Play harmless fictional mischief missions.", place: "market" }
];

const buildings = [
  { id: "park", name: "Moonbeam Park", x: 4, y: 3, w: 1, h: 1, height: 32, wall: "#84a878", side: "#63845f", roof: "#78a16f", kind: "park", icon: "🌳" },
  { id: "townhall", name: "Town Hall", x: 8, y: 4, w: 1, h: 1, height: 57, wall: "#c6b3d6", side: "#9983b4", roof: "#9c7ab3", kind: "public", icon: "🏛️" },
  { id: "cafe", name: "Little Comet Café", x: 12, y: 6, w: 1, h: 1, height: 46, wall: "#e8c49d", side: "#c78e73", roof: "#a96d78", kind: "shop", icon: "☕" },
  { id: "fire", name: "Fire Station", x: 3, y: 7, w: 1, h: 1, height: 42, wall: "#e3b1a5", side: "#bf817b", roof: "#b84f60", kind: "service", icon: "🚒" },
  { id: "police", name: "Police Station", x: 3, y: 11, w: 1, h: 1, height: 42, wall: "#b7c9d9", side: "#829bb8", roof: "#58779b", kind: "service", icon: "🚓" },
  { id: "market", name: "Star Market", x: 12, y: 10, w: 1, h: 1, height: 39, wall: "#e5cf98", side: "#c09e68", roof: "#b78c50", kind: "shop", icon: "🪙" },
  { id: "home", name: "Your Little Home", x: 8, y: 12, w: 1, h: 1, height: 39, wall: "#d0b7a6", side: "#a98a7e", roof: "#8d709d", kind: "home", icon: "⌂" },
  { id: "farm", name: "Stellar Farm", x: 15, y: 12, w: 1, h: 1, height: 25, wall: "#b6c98a", side: "#8d9d69", roof: "#8da66d", kind: "farm", icon: "🌱" }
];

let player = { x: 8, y: 9, facing: "down", name: "Star Visitor" };
let save = { job: "", coins: 100, xp: 0, townProgress: 0, homeDecor: 0 };
let storageKey = SAVE_PREFIX + ":guest";
let playerUser = null;
let walkTarget = null;
let lastMoveAt = 0;
let lastActionAt = 0;
let toastTimer = null;
let animationFrame = 0;
let lastFrame = 0;

function readSave(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (parsed && typeof parsed === "object") {
      return {
        job: jobs.some(job => job.id === parsed.job) ? parsed.job : "",
        coins: Math.max(0, Number(parsed.coins) || 100),
        xp: Math.max(0, Number(parsed.xp) || 0),
        townProgress: Math.max(0, Math.min(100, Number(parsed.townProgress) || 0)),
        homeDecor: Math.max(0, Number(parsed.homeDecor) || 0),
        x: Number.isInteger(parsed.x) ? Math.max(1, Math.min(MAP_W - 2, parsed.x)) : 8,
        y: Number.isInteger(parsed.y) ? Math.max(1, Math.min(MAP_H - 2, parsed.y)) : 9
      };
    }
  } catch (error) {
    console.warn("Could not read local STELLARS World save:", error);
  }
  return { job: "", coins: 100, xp: 0, townProgress: 0, homeDecor: 0, x: 8, y: 9 };
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...save, x: player.x, y: player.y }));
    $("saveState").textContent = "● LOCAL SAVE ON";
  } catch (error) {
    $("saveState").textContent = "● SAVE UNAVAILABLE";
    console.warn("Could not save STELLARS World progress:", error);
  }
}

function applySave() {
  save = readSave(storageKey);
  player.x = save.x ?? 8;
  player.y = save.y ?? 9;
  updateHud();
  draw();
}

function updateHud() {
  const job = jobs.find(item => item.id === save.job);
  $("playerName").textContent = player.name;
  $("playerJob").textContent = job ? job.name : "New Resident";
  $("coinCount").textContent = Math.floor(save.coins).toLocaleString("en-US");
  $("xpLabel").textContent = (save.xp % 100) + " / 100 XP";
  $("xpBar").style.width = (save.xp % 100) + "%";
  $("townProgressBar").style.width = save.townProgress + "%";
  $("townProgressLabel").textContent = save.townProgress + "%";
  $("townLevel").textContent = String(1 + Math.floor(save.townProgress / 25)).padStart(2, "0");
  $("chooseJobButton").textContent = job ? "CHANGE PROFESSION" : "CHOOSE PROFESSION";
  $("taskHint").textContent = job
    ? "Your path: " + job.name + ". Find your workplace and press E."
    : "Choose a profession, then explore the town.";
  $("worldCoords").textContent = String(player.x).padStart(2, "0") + " : " + String(player.y).padStart(2, "0");
  const marker = document.querySelector(".map-player");
  if (marker) {
    marker.style.left = (12 + (player.x / (MAP_W - 1)) * 76) + "%";
    marker.style.top = (10 + (player.y / (MAP_H - 1)) * 76) + "%";
  }
  drawAvatar(job);
}

function showToast(message) {
  const toast = $("canvasToast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2100);
}

function setJob(id) {
  const job = jobs.find(item => item.id === id);
  if (!job) return;
  save.job = job.id;
  persist();
  updateHud();
  $("jobDialog").close();
  showToast(job.icon + " You're now a " + job.name + "!");
}

function openJobs() {
  const grid = $("jobGrid");
  grid.replaceChildren();
  jobs.forEach(job => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "job-card" + (save.job === job.id ? " selected" : "");
    button.innerHTML = '<span class="job-icon"></span><span><strong></strong><small></small></span>';
    button.querySelector(".job-icon").textContent = job.icon;
    button.querySelector("strong").textContent = job.name;
    button.querySelector("small").textContent = job.desc;
    button.addEventListener("click", () => setJob(job.id));
    grid.append(button);
  });
  $("jobDialog").showModal();
}

function toScreen(x, y) {
  return {
    x: ORIGIN_X + (x - y) * TILE_W / 2,
    y: ORIGIN_Y + (x + y) * TILE_H / 2
  };
}

function pathDiamond(x, y, width = TILE_W / 2, height = TILE_H / 2) {
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x - width, y);
  ctx.closePath();
}

function isRoad(x, y) {
  return (y === 8 && x >= 1 && x <= 16) ||
    (x === 8 && y >= 1 && y <= 13) ||
    (y === 4 && x >= 5 && x <= 11) ||
    (x === 12 && y >= 6 && y <= 11);
}

function drawTile(x, y) {
  const p = toScreen(x, y);
  const road = isRoad(x, y);
  const plaza = x >= 7 && x <= 9 && y >= 7 && y <= 9;
  let fill = road ? "#d8c9a6" : (plaza ? "#c8b99c" : (((x * 7 + y * 13) % 5 === 0) ? "#82b38a" : "#8cbd91"));
  pathDiamond(p.x, p.y, TILE_W / 2, TILE_H / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = road ? "rgba(135,112,88,.18)" : "rgba(31,91,62,.13)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!road && !plaza && (x * 11 + y * 5) % 13 === 0) {
    ctx.fillStyle = "#f4e4a2";
    ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 2), 3, 3);
    ctx.fillStyle = "#e8a6b8";
    ctx.fillRect(Math.round(p.x + 2), Math.round(p.y - 4), 2, 2);
  }
  if (plaza && (x + y) % 3 === 0) {
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
}

function polygon(points, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBuilding(b) {
  const p = toScreen(b.x, b.y);
  if (b.kind === "park") {
    drawTree(p.x, p.y - 5, 1.18);
    return;
  }
  if (b.kind === "farm") {
    ctx.fillStyle = "rgba(62,92,54,.35)";
    ctx.fillRect(p.x - 25, p.y - 11, 50, 16);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = (row + col) % 2 ? "#5e8e53" : "#6e9d5c";
        ctx.fillRect(p.x - 19 + col * 10, p.y - 8 + row * 5, 5, 4);
        ctx.fillStyle = "#c5d77c";
        ctx.fillRect(p.x - 17 + col * 10, p.y - 11 + row * 5, 2, 3);
      }
    }
  }

  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const left = { x: x - 28, y: y - 13 };
  const back = { x, y: y - 28 };
  const right = { x: x + 28, y: y - 13 };
  const front = { x, y };
  const lift = b.height;
  const topLeft = { x: left.x, y: left.y - lift };
  const topBack = { x: back.x, y: back.y - lift };
  const topRight = { x: right.x, y: right.y - lift };
  const topFront = { x: front.x, y: front.y - lift };

  ctx.fillStyle = "rgba(33,61,49,.25)";
  ctx.beginPath();
  ctx.ellipse(x + 5, y - 1, 34, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  polygon([topLeft, topBack, back, left], b.wall, "rgba(45,46,54,.24)");
  polygon([topBack, topRight, right, back], b.side, "rgba(45,46,54,.24)");
  polygon([topRight, topFront, front, right], shade(b.side, -10), "rgba(45,46,54,.2)");
  polygon([topLeft, topBack, topRight, topFront], b.roof, "rgba(45,46,54,.26)");

  // Pixel roof trim and windows.
  ctx.fillStyle = "rgba(255,247,220,.72)";
  ctx.fillRect(x - 17, y - lift + 1, 5, 4);
  ctx.fillRect(x + 8, y - lift + 1, 5, 4);
  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.fillRect(x - 21, y - Math.round(lift * .53), 8, 8);
  ctx.fillRect(x + 9, y - Math.round(lift * .53), 8, 8);
  ctx.fillStyle = "#765b59";
  ctx.fillRect(x - 3, y - Math.round(lift * .48), 9, Math.round(lift * .48));
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.fillRect(x - 2, y - Math.round(lift * .48) + 3, 2, 9);

  ctx.fillStyle = "#3d4b46";
  ctx.font = "8px Ubuntu, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(b.name, x, y + 12);
}

function shade(hex, amount) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

function drawTree(x, y, scale = 1) {
  ctx.fillStyle = "rgba(39,74,51,.22)";
  ctx.fillRect(x - 10 * scale, y - 2, 24 * scale, 6 * scale);
  ctx.fillStyle = "#765d49";
  ctx.fillRect(x - 2 * scale, y - 24 * scale, 6 * scale, 26 * scale);
  ctx.fillStyle = "#4e835a";
  ctx.fillRect(x - 15 * scale, y - 35 * scale, 28 * scale, 18 * scale);
  ctx.fillStyle = "#6fa76e";
  ctx.fillRect(x - 10 * scale, y - 43 * scale, 20 * scale, 14 * scale);
  ctx.fillStyle = "#91c27f";
  ctx.fillRect(x - 4 * scale, y - 45 * scale, 8 * scale, 6 * scale);
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(x - 8 * scale, y - 38 * scale, 4 * scale, 4 * scale);
}

function drawBush(x, y) {
  ctx.fillStyle = "#53875e";
  ctx.fillRect(x - 9, y - 10, 18, 10);
  ctx.fillStyle = "#79a96c";
  ctx.fillRect(x - 5, y - 15, 11, 7);
  ctx.fillStyle = "#e5d38d";
  ctx.fillRect(x + 1, y - 11, 3, 3);
}

function drawPlayer() {
  const p = toScreen(player.x, player.y);
  const bob = Math.sin(animationFrame / 180) * 1.5;
  const x = Math.round(p.x);
  const y = Math.round(p.y + bob);
  ctx.fillStyle = "rgba(36,56,48,.28)";
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pixel character, original simple sprite.
  ctx.fillStyle = "#473854";
  ctx.fillRect(x - 6, y - 25, 12, 12);
  ctx.fillStyle = "#f0bd91";
  ctx.fillRect(x - 5, y - 34, 10, 10);
  ctx.fillStyle = "#503a46";
  ctx.fillRect(x - 6, y - 36, 12, 5);
  ctx.fillRect(x - 7, y - 32, 3, 5);
  ctx.fillStyle = "#fff1d2";
  ctx.fillRect(x - 3, y - 30, 2, 2);
  ctx.fillRect(x + 2, y - 30, 2, 2);
  ctx.fillStyle = "#8c79c9";
  ctx.fillRect(x - 7, y - 23, 14, 12);
  ctx.fillStyle = "#d8c8ff";
  ctx.fillRect(x - 7, y - 23, 14, 3);
  ctx.fillStyle = "#f0bd91";
  ctx.fillRect(x - 11, y - 21, 4, 8);
  ctx.fillRect(x + 7, y - 21, 4, 8);
  ctx.fillStyle = "#423c62";
  ctx.fillRect(x - 6, y - 11, 5, 8);
  ctx.fillRect(x + 2, y - 11, 5, 8);
  ctx.fillStyle = "#f7e5a6";
  ctx.fillRect(x - 7, y - 3, 6, 3);
  ctx.fillRect(x + 2, y - 3, 6, 3);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillRect(x - 2, y - 20, 3, 2);
}

function drawAvatar(job) {
  avatarCtx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);
  avatarCtx.imageSmoothingEnabled = false;
  avatarCtx.fillStyle = "#211f3b";
  avatarCtx.fillRect(0, 0, 72, 80);
  avatarCtx.fillStyle = "#44334b";
  avatarCtx.fillRect(23, 9, 26, 19);
  avatarCtx.fillStyle = "#f0bd91";
  avatarCtx.fillRect(25, 19, 22, 22);
  avatarCtx.fillStyle = "#4b3447";
  avatarCtx.fillRect(22, 14, 28, 9);
  avatarCtx.fillStyle = "#fff3d7";
  avatarCtx.fillRect(29, 28, 3, 3);
  avatarCtx.fillRect(41, 28, 3, 3);
  const coat = job?.id === "firefighter" ? "#ce6d61" : job?.id === "police" ? "#6684ad" : "#8d7bd0";
  avatarCtx.fillStyle = coat;
  avatarCtx.fillRect(17, 43, 38, 27);
  avatarCtx.fillStyle = "#dbcfff";
  avatarCtx.fillRect(17, 43, 38, 5);
  avatarCtx.fillStyle = "#f0bd91";
  avatarCtx.fillRect(12, 47, 6, 18);
  avatarCtx.fillRect(54, 47, 6, 18);
  avatarCtx.fillStyle = "#413c62";
  avatarCtx.fillRect(23, 69, 9, 7);
  avatarCtx.fillRect(41, 69, 9, 7);
}

function renderWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9ec9b8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft clouds in the distant sky.
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(115, 24, 58, 8);
  ctx.fillRect(128, 16, 34, 8);
  ctx.fillRect(760, 48, 70, 7);
  ctx.fillRect(775, 40, 39, 8);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) drawTile(x, y);
  }

  // A few trees and bushes around the neighbourhood.
  const decorations = [
    { x: 1, y: 2, type: "tree" }, { x: 2, y: 4, type: "bush" },
    { x: 5, y: 2, type: "tree" }, { x: 10, y: 2, type: "tree" },
    { x: 14, y: 3, type: "tree" }, { x: 16, y: 5, type: "bush" },
    { x: 1, y: 12, type: "tree" }, { x: 6, y: 13, type: "bush" },
    { x: 10, y: 13, type: "tree" }, { x: 16, y: 13, type: "tree" }
  ];
  const drawables = [];
  buildings.forEach(building => drawables.push({ depth: building.x + building.y + .2, draw: () => drawBuilding(building) }));
  decorations.forEach(item => {
    const p = toScreen(item.x, item.y);
    drawables.push({ depth: item.x + item.y + .15, draw: () => item.type === "tree" ? drawTree(p.x, p.y) : drawBush(p.x, p.y) });
  });
  drawables.push({ depth: player.x + player.y + .45, draw: drawPlayer });
  drawables.sort((a, b) => a.depth - b.depth).forEach(item => item.draw());

  // A tiny signpost at the entrance.
  const sign = toScreen(1, 8);
  ctx.fillStyle = "#765b49";
  ctx.fillRect(sign.x - 2, sign.y - 20, 4, 20);
  ctx.fillStyle = "#f4df9f";
  ctx.fillRect(sign.x - 19, sign.y - 30, 38, 12);
  ctx.fillStyle = "#57465c";
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText("HI!", sign.x, sign.y - 22);
}

function draw() {
  renderWorld();
  updatePrompt();
}

function isBlocked(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return buildings.some(b => b.id !== "park" && Math.abs(b.x - x) <= 0 && Math.abs(b.y - y) <= 0);
}

function step(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (isBlocked(nx, ny)) return false;
  player.x = nx;
  player.y = ny;
  player.facing = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
  walkTarget = null;
  persist();
  updateHud();
  draw();
  return true;
}

function moveTowardTarget() {
  if (!walkTarget) return;
  const dx = walkTarget.x - player.x;
  const dy = walkTarget.y - player.y;
  if (Math.abs(dx) + Math.abs(dy) === 0) {
    walkTarget = null;
    return;
  }
  const candidates = Math.abs(dx) >= Math.abs(dy)
    ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
    : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
  for (const candidate of candidates) {
    if (candidate.x || candidate.y) {
      if (step(candidate.x, candidate.y)) return;
    }
  }
  walkTarget = null;
  showToast("That path is blocked!");
}

function setTargetFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = (event.clientX - rect.left) * canvas.width / rect.width;
  const sy = (event.clientY - rect.top) * canvas.height / rect.height;
  const a = (sx - ORIGIN_X) / (TILE_W / 2);
  const b = (sy - ORIGIN_Y) / (TILE_H / 2);
  const x = Math.round((a + b) / 2);
  const y = Math.round((b - a) / 2);
  if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !isBlocked(x, y)) {
    walkTarget = { x, y };
  }
}

function nearestBuilding() {
  const ranked = buildings.map(building => ({
    building,
    distance: Math.abs(building.x - player.x) + Math.abs(building.y - player.y)
  })).sort((a, b) => a.distance - b.distance);
  return ranked.length && ranked[0].distance <= 2 ? ranked[0].building : null;
}

function updatePrompt() {
  const building = nearestBuilding();
  const prompt = $("interactionPrompt");
  if (building) {
    prompt.textContent = building.id === "home"
      ? "⌂ " + building.name + "  ·  PRESS E TO VISIT"
      : building.icon + " " + building.name + "  ·  PRESS E TO INTERACT";
  } else {
    prompt.textContent = "✦ Explore the town · Find a place to work";
  }
}

function addReward(coins, xp, progress, message) {
  save.coins += coins;
  save.xp += xp;
  save.townProgress = Math.min(100, save.townProgress + progress);
  persist();
  updateHud();
  showToast(message + "  +" + coins + " coins");
}

function interact() {
  const now = Date.now();
  if (now - lastActionAt < 1100) {
    showToast("One task at a time, Star!");
    return;
  }
  const building = nearestBuilding();
  if (!building) {
    showToast("Move closer to a building first!");
    return;
  }
  lastActionAt = now;
  if (building.id === "home") {
    save.homeDecor += 1;
    addReward(0, 4, 1, "Your home feels cosier!");
    $("taskHint").textContent = "Home comfort level: " + save.homeDecor + ". Your little corner of Stellars.";
    return;
  }
  if (building.id === "park") {
    addReward(2, 4, 1, "A peaceful break at the park!");
    return;
  }
  const job = jobs.find(item => item.id === save.job);
  if (!job) {
    showToast("Choose a profession before starting work.");
    openJobs();
    return;
  }
  if (building.id === "townhall") {
    if (job.id === "builder") {
      addReward(20, 14, 7, "Town project completed!");
      return;
    }
    addReward(5, 8, 2, "You contributed to the town fund!");
    return;
  }
  if (building.id !== job.place) {
    const expected = jobs.find(item => item.place === building.id);
    showToast(expected ? "This place is for " + expected.name + " work." : "Nothing to do here yet.");
    return;
  }
  const rewards = {
    farmer: [18, 11, 3, "Fresh harvest ready!"],
    cashier: [14, 10, 2, "Order served. Nice work!"],
    firefighter: [16, 12, 3, "Fire safety drill complete!"],
    police: [15, 10, 3, "Town patrol completed!"],
    trader: [12 + Math.floor(Math.random() * 12), 9, 2, "Virtual trade completed!"],
    courier: [13, 10, 2, "Parcel delivered!"],
    trickster: [18, 8, 2, "You pulled off a harmless NPC prank!"]
  };
  const reward = rewards[job.id];
  if (reward) addReward(...reward);
}

function animate(timestamp) {
  if (timestamp - lastFrame > 150) {
    animationFrame = timestamp;
    lastFrame = timestamp;
    if (walkTarget && timestamp - lastMoveAt > 150) {
      lastMoveAt = timestamp;
      moveTowardTarget();
    } else if (!walkTarget) {
      draw();
    }
  }
  requestAnimationFrame(animate);
}

function dayCycle() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) {
    $("worldClock").textContent = "A bright new morning";
    $("weatherIcon").textContent = "☀";
    $("weatherLabel").textContent = "Sunny";
  } else if (hour >= 11 && hour < 17) {
    $("worldClock").textContent = "A lovely afternoon";
    $("weatherIcon").textContent = "☀";
    $("weatherLabel").textContent = "Clear";
  } else {
    $("worldClock").textContent = "A cosy town evening";
    $("weatherIcon").textContent = "☾";
    $("weatherLabel").textContent = "Night";
  }
}

function bindControls() {
  document.addEventListener("keydown", event => {
    if ($("jobDialog").open) return;
    // Screen-direction controls for an isometric grid.
    const keys = {
      ArrowUp: [-1, -1], w: [-1, -1], W: [-1, -1],
      ArrowDown: [1, 1], s: [1, 1], S: [1, 1],
      ArrowLeft: [-1, 1], a: [-1, 1], A: [-1, 1],
      ArrowRight: [1, -1], d: [1, -1], D: [1, -1]
    };
    if (keys[event.key]) {
      event.preventDefault();
      const now = Date.now();
      if (now - lastMoveAt > 105) {
        lastMoveAt = now;
        step(...keys[event.key]);
      }
    } else if (event.key.toLowerCase() === "e") {
      event.preventDefault();
      interact();
    }
  });

  canvas.addEventListener("click", setTargetFromPointer);
  $("chooseJobButton").addEventListener("click", openJobs);
  $("closeJobDialog").addEventListener("click", () => $("jobDialog").close());
  $("mobileInteract").addEventListener("click", interact);

  document.querySelectorAll("[data-move]").forEach(button => {
    const moveMap = {
      up: [-1, -1], down: [1, 1], left: [-1, 1], right: [1, -1]
    };
    button.addEventListener("click", () => step(...moveMap[button.dataset.move]));
  });

  document.querySelectorAll("[data-place]").forEach(button => {
    button.addEventListener("click", () => {
      const building = buildings.find(item => item.id === button.dataset.place);
      if (!building) return;
      const target = { x: building.x, y: building.y + 1 };
      if (!isBlocked(target.x, target.y)) walkTarget = target;
      else walkTarget = { x: building.x + 1, y: building.y };
      showToast("Heading to " + building.name + "…");
    });
  });
}

async function loadMemberName(user) {
  if (!user) return "Star Visitor";
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (snapshot.exists()) return snapshot.data().fullName || user.displayName || "STELLARS Member";
  } catch (error) {
    console.warn("Could not load STELLARS profile name:", error);
  }
  return user.displayName || "STELLARS Member";
}

function startAuth() {
  onAuthStateChanged(auth, async user => {
    playerUser = user || null;
    player.name = await loadMemberName(user);
    storageKey = SAVE_PREFIX + (user ? ":member:" + user.uid : ":guest");
    applySave();
  });
}

bindControls();
applySave();
dayCycle();
draw();
requestAnimationFrame(animate);
startAuth();
