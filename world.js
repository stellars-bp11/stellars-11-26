import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/*
 * STELLARS WORLD — Top-down single-player prototype.
 * Multiplayer-ready seam:
 * - The renderer accepts a collection of player entities.
 * - The local player already has a stable UID and serializable position state.
 * - A future Realtime Database adapter can call STELLARSWorld.setRemotePlayers().
 * No remote synchronization is enabled in this test.
 */
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

const $ = id => document.getElementById(id);
const canvas = $("worldCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const TILE = 32;
const MAP_W = 84;
const MAP_H = 60;
const MAP_PIXEL_W = MAP_W * TILE;
const MAP_PIXEL_H = MAP_H * TILE;
const SAVE_PREFIX = "stellarsWorldTopDownV1";
const ALLOWED_ROLES = ["student", "admin", "superAdmin", "super_admin"];

const jobs = [
  { id: "farmer", name: "Farmer", icon: "🌱", desc: "Grow crops and care for the Stellar Farm." },
  { id: "barista", name: "Barista", icon: "☕", desc: "Welcome neighbours at Little Comet Café." },
  { id: "builder", name: "Builder", icon: "🧱", desc: "Help shape the places around town." },
  { id: "librarian", name: "Librarian", icon: "📚", desc: "Keep stories and ideas in good order." },
  { id: "explorer", name: "Explorer", icon: "🧭", desc: "Find the little corners of our world." },
  { id: "artist", name: "Artist", icon: "🎨", desc: "Bring colour and creativity to town." }
];

const buildings = [
  { id: "library", name: "Stellar Library", x: 22, y: 17, w: 5, h: 4, roof: "#8c79ae", wall: "#d9c99d", sign: "LIBRARY" },
  { id: "townhall", name: "Town Hall", x: 36, y: 11, w: 6, h: 5, roof: "#b66f58", wall: "#e6d1a5", sign: "TOWN HALL" },
  { id: "cafe", name: "Little Comet Café", x: 49, y: 21, w: 5, h: 4, roof: "#bb8064", wall: "#f0d4a1", sign: "CAFE" },
  { id: "home", name: "Your Little Home", x: 29, y: 34, w: 5, h: 4, roof: "#7f91ad", wall: "#e7d4ad", sign: "HOME" },
  { id: "market", name: "Star Market", x: 49, y: 34, w: 5, h: 4, roof: "#d0a64e", wall: "#ead5a6", sign: "MARKET" }
];

const riverLine = [[7, 2], [9, 9], [8, 16], [11, 23], [10, 30], [13, 38], [12, 46], [17, 54], [20, 59]];
const pathLines = [
  [[37, 59], [37, 50], [37, 42], [37, 31], [39, 27], [39, 20], [39, 16]],
  [[39, 27], [46, 25], [50, 23]],
  [[37, 31], [30, 29], [27, 25], [25, 22], [24, 21]],
  [[37, 31], [40, 35], [45, 36], [50, 36]],
  [[37, 31], [32, 35], [31, 37]]
];

const treeSpots = [];
const decorativeSpots = [];
const remotePlayers = new Map();
const keys = new Set();
let playerUser = null;
let canPlayWorld = false;
let authSequence = 0;
let storageKey = SAVE_PREFIX + ":locked";
let save = { job: "", coins: 100, xp: 0, townProgress: 0, homeDecor: 0 };
let player = {
  uid: "local-preview",
  name: "Star",
  x: 37 * TILE + 16,
  y: 43 * TILE + 16,
  direction: "down",
  moving: false,
  walkFrame: 0,
  palette: 0
};
let camera = { x: 0, y: 0 };
let lastFrame = 0;
let toastTimer = null;
let lastAccessNoticeAt = 0;
let lastSaveAt = 0;
let facingTimestamp = 0;

function hash(x, y, salt = 0) {
  let n = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + salt + 1274126177, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  return (n ^ (n >>> 16)) >>> 0;
}
function rand01(x, y, salt = 0) { return hash(x, y, salt) / 4294967295; }
function distanceToLine(px, py, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
    const x = ax + dx * t, y = ay + dy * t;
    best = Math.min(best, Math.hypot(px - x, py - y));
  }
  return best;
}
function riverDistance(x, y) { return distanceToLine(x + .5, y + .5, riverLine); }
function pathDistance(x, y) {
  return Math.min(...pathLines.map(line => distanceToLine(x + .5, y + .5, line)));
}
function isBridge(x, y) {
  return (x >= 9 && x <= 11 && y >= 14 && y <= 16) ||
    (x >= 10 && x <= 12 && y >= 36 && y <= 38);
}
function terrainAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "void";
  if (isBridge(x, y)) return "bridge";
  const river = riverDistance(x, y);
  if (river < 1.2) return "water";
  if (river < 1.8) return "sand";
  if (pathDistance(x, y) < 1.18) return "path";
  return "grass";
}
function pointInBuilding(x, y, padding = 0) {
  return buildings.some(b =>
    x >= b.x * TILE - padding &&
    x <= (b.x + b.w) * TILE + padding &&
    y >= b.y * TILE - padding &&
    y <= (b.y + b.h) * TILE + padding
  );
}
function createWorldDetails() {
  let count = 0;
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      const r = rand01(x, y, 41);
      if (r > .12 && r < .165 && terrainAt(x, y) === "grass" &&
          riverDistance(x, y) > 2.8 && pathDistance(x, y) > 2.3 &&
          !pointInBuilding((x + .5) * TILE, (y + .5) * TILE, 42) &&
          Math.hypot(x - 37, y - 43) > 5) {
        treeSpots.push({
          kind: "tree",
          x: (x + .5) * TILE,
          y: (y + .88) * TILE,
          size: .82 + rand01(x, y, 77) * .4,
          tone: Math.floor(rand01(x, y, 93) * 4)
        });
        count++;
      } else if (r > .34 && r < .39 && terrainAt(x, y) === "grass") {
        decorativeSpots.push({ x: (x + .5) * TILE, y: (y + .5) * TILE, kind: "flower", tone: Math.floor(r * 100) % 4 });
      } else if (r > .43 && r < .465 && terrainAt(x, y) === "grass") {
        decorativeSpots.push({ x: (x + .5) * TILE, y: (y + .5) * TILE, kind: "bush" });
      }
    }
  }
  return count;
}
createWorldDetails();

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
        x: Number.isFinite(parsed.x) ? Math.max(TILE * 2, Math.min(MAP_PIXEL_W - TILE * 2, parsed.x)) : 37 * TILE + 16,
        y: Number.isFinite(parsed.y) ? Math.max(TILE * 2, Math.min(MAP_PIXEL_H - TILE * 2, parsed.y)) : 43 * TILE + 16
      };
    }
  } catch (error) {
    console.warn("Could not read local STELLARS World save:", error);
  }
  return { job: "", coins: 100, xp: 0, townProgress: 0, homeDecor: 0, x: 37 * TILE + 16, y: 43 * TILE + 16 };
}
function persist(force = false) {
  const now = Date.now();
  if (!force && now - lastSaveAt < 700) return;
  lastSaveAt = now;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...save, x: player.x, y: player.y }));
    $("saveState").textContent = "● LOCAL SAVE";
  } catch (error) {
    $("saveState").textContent = "● SAVE UNAVAILABLE";
    console.warn("Could not save STELLARS World progress:", error);
  }
}
function applySave() {
  save = readSave(storageKey);
  player.x = save.x;
  player.y = save.y;
  updateHud();
  updateCamera();
}
function firstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "Star";
}
function paletteFor(uid) {
  return hash(String(uid).length, String(uid).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0), 17) % 5;
}
function updateHud() {
  const job = jobs.find(item => item.id === save.job);
  $("playerName").textContent = player.name;
  $("playerJob").textContent = job ? job.name : "New Resident";
  $("avatarInitial").textContent = player.name.slice(0, 1).toUpperCase();
  $("coinCount").textContent = Math.floor(save.coins).toLocaleString("en-US");
  $("xpLabel").textContent = (save.xp % 100) + " / 100 XP";
  $("xpBar").style.width = (save.xp % 100) + "%";
  $("townProgressBar").style.width = save.townProgress + "%";
  $("townProgressLabel").textContent = save.townProgress + "%";
  $("townLevel").textContent = String(1 + Math.floor(save.townProgress / 25)).padStart(2, "0");
  $("chooseJobButton").textContent = job ? "CHANGE PROFESSION" : "CHOOSE A PROFESSION";
  $("worldCoords").textContent = String(Math.floor(player.x / TILE)).padStart(2, "0") + " : " +
    String(Math.floor(player.y / TILE)).padStart(2, "0");
}
function showToast(message) {
  const toast = $("canvasToast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2100);
}
function requireWorldMember() {
  if (canPlayWorld) return true;
  const now = Date.now();
  if (now - lastAccessNoticeAt > 1800) {
    showToast("STELLARS World is locked for visitor accounts.");
    lastAccessNoticeAt = now;
  }
  return false;
}
function updateWorldAccessUI() {
  const gate = $("worldAccessGate");
  const intro = $("worldMemberIntro");
  const game = $("worldGameLayout");
  const note = $("worldPrototypeNote");
  const message = $("worldAccessMessage");
  const signInLink = $("worldSignInLink");
  if (gate) gate.hidden = canPlayWorld;
  if (intro) intro.hidden = !canPlayWorld;
  if (game) game.hidden = !canPlayWorld;
  if (note) note.hidden = !canPlayWorld;
  if (!canPlayWorld) {
    if (message) message.textContent = playerUser
      ? "This account is not an active STELLARS class account."
      : "Sign in with an active STELLARS class account to unlock the town.";
    if (signInLink) signInLink.hidden = Boolean(playerUser);
    $("saveState").textContent = "● ACCESS LOCKED";
    return;
  }
  if (signInLink) signInLink.hidden = true;
  $("saveState").textContent = "● LOCAL SAVE";
}
function updateCamera() {
  camera.x = Math.max(0, Math.min(MAP_PIXEL_W - VIEW_W, player.x - VIEW_W / 2));
  camera.y = Math.max(0, Math.min(MAP_PIXEL_H - VIEW_H, player.y - VIEW_H / 2));
}
function drawGroundTile(x, y, screenX, screenY, time) {
  const type = terrainAt(x, y);
  const r = hash(x, y, 7);
  if (type === "grass") {
    const greens = ["#77b957", "#73b252", "#7dbd5d", "#70ad50"];
    ctx.fillStyle = greens[r % greens.length];
    ctx.fillRect(screenX, screenY, TILE, TILE);
    if (r % 5 === 0) {
      ctx.fillStyle = "#8bc866";
      ctx.fillRect(screenX + 5 + (r % 13), screenY + 7 + (r % 11), 3, 3);
      ctx.fillStyle = "#5e9f48";
      ctx.fillRect(screenX + 20, screenY + 18, 3, 2);
    }
    if (r % 13 === 0) {
      ctx.fillStyle = "#e5e6a0";
      ctx.fillRect(screenX + 9, screenY + 21, 3, 3);
    }
  } else if (type === "sand") {
    ctx.fillStyle = "#c9a45f";
    ctx.fillRect(screenX, screenY, TILE, TILE);
    ctx.fillStyle = "#e4c27d";
    ctx.fillRect(screenX + 4, screenY + 8, 5, 2);
    ctx.fillRect(screenX + 21, screenY + 22, 4, 3);
  } else if (type === "path") {
    ctx.fillStyle = r % 4 === 0 ? "#d8b878" : "#cfad6e";
    ctx.fillRect(screenX, screenY, TILE, TILE);
    ctx.fillStyle = "#e5c98e";
    ctx.fillRect(screenX + 6 + (r % 8), screenY + 7, 5, 3);
    ctx.fillStyle = "#b89258";
    ctx.fillRect(screenX + 21, screenY + 20 - (r % 5), 4, 3);
  } else if (type === "bridge") {
    ctx.fillStyle = "#ad7948";
    ctx.fillRect(screenX, screenY, TILE, TILE);
    ctx.fillStyle = "#d6aa69";
    for (let i = 3; i < TILE; i += 8) ctx.fillRect(screenX + i, screenY + 2, 3, TILE - 4);
    ctx.fillStyle = "#795537";
    ctx.fillRect(screenX, screenY + 2, TILE, 3);
    ctx.fillRect(screenX, screenY + TILE - 5, TILE, 3);
  } else if (type === "water") {
    ctx.fillStyle = "#3e9fbd";
    ctx.fillRect(screenX, screenY, TILE, TILE);
    ctx.fillStyle = "#5dbbd0";
    const wave = (Math.floor(time / 520) + (r % 7)) % 4;
    ctx.fillRect(screenX + 4 + wave * 3, screenY + 8, 10, 2);
    ctx.fillRect(screenX + 17 - wave, screenY + 22, 8, 2);
    ctx.fillStyle = "#76d1d5";
    if (r % 3 === 0) ctx.fillRect(screenX + 22, screenY + 5 + wave, 3, 3);
  } else {
    ctx.fillStyle = "#477b45";
    ctx.fillRect(screenX, screenY, TILE, TILE);
  }
}
function drawGround(time) {
  const startX = Math.max(0, Math.floor(camera.x / TILE) - 1);
  const startY = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const endX = Math.min(MAP_W - 1, Math.ceil((camera.x + VIEW_W) / TILE) + 1);
  const endY = Math.min(MAP_H - 1, Math.ceil((camera.y + VIEW_H) / TILE) + 1);
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      drawGroundTile(x, y, x * TILE - camera.x, y * TILE - camera.y, time);
    }
  }
  decorativeSpots.forEach(spot => {
    if (spot.x < camera.x - 20 || spot.x > camera.x + VIEW_W + 20 ||
        spot.y < camera.y - 20 || spot.y > camera.y + VIEW_H + 20) return;
    const sx = Math.round(spot.x - camera.x), sy = Math.round(spot.y - camera.y);
    if (spot.kind === "flower") {
      const colors = ["#fff0b5", "#f5a4a4", "#e9e5ff", "#ffd3e3"];
      ctx.fillStyle = "#3b8b43";
      ctx.fillRect(sx - 2, sy + 1, 4, 6);
      ctx.fillStyle = colors[spot.tone];
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      ctx.fillRect(sx - 4, sy, 2, 2);
      ctx.fillRect(sx + 2, sy, 2, 2);
    } else {
      ctx.fillStyle = "#477f3c";
      ctx.fillRect(sx - 6, sy - 3, 12, 8);
      ctx.fillStyle = "#65a14c";
      ctx.fillRect(sx - 3, sy - 6, 7, 7);
    }
  });
}
function drawTree(tree) {
  const sx = tree.x - camera.x, sy = tree.y - camera.y;
  if (sx < -90 || sx > VIEW_W + 90 || sy < -100 || sy > VIEW_H + 40) return;
  const s = tree.size;
  const palettes = [
    ["#285c39", "#347a3e", "#559a48", "#77b957"],
    ["#245943", "#277452", "#399466", "#6bb66a"],
    ["#365f32", "#477e36", "#639e43", "#8ab84f"],
    ["#225648", "#2d765f", "#449a75", "#80bf82"]
  ][tree.tone];
  ctx.fillStyle = "rgba(35,63,37,.25)";
  ctx.beginPath();
  ctx.ellipse(sx + 3, sy - 2, 23 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#81552f";
  ctx.fillRect(sx - 5 * s, sy - 33 * s, 10 * s, 34 * s);
  ctx.fillStyle = "#a8753e";
  ctx.fillRect(sx - 2 * s, sy - 31 * s, 3 * s, 28 * s);
  ctx.fillStyle = palettes[0];
  ctx.fillRect(sx - 25 * s, sy - 69 * s, 50 * s, 37 * s);
  ctx.fillRect(sx - 18 * s, sy - 78 * s, 36 * s, 27 * s);
  ctx.fillRect(sx - 33 * s, sy - 59 * s, 18 * s, 25 * s);
  ctx.fillRect(sx + 15 * s, sy - 59 * s, 18 * s, 25 * s);
  ctx.fillStyle = palettes[1];
  ctx.fillRect(sx - 19 * s, sy - 70 * s, 38 * s, 29 * s);
  ctx.fillRect(sx - 27 * s, sy - 57 * s, 17 * s, 18 * s);
  ctx.fillRect(sx + 10 * s, sy - 57 * s, 17 * s, 18 * s);
  ctx.fillStyle = palettes[2];
  ctx.fillRect(sx - 13 * s, sy - 77 * s, 25 * s, 23 * s);
  ctx.fillRect(sx - 23 * s, sy - 62 * s, 17 * s, 15 * s);
  ctx.fillRect(sx + 7 * s, sy - 64 * s, 17 * s, 15 * s);
  ctx.fillStyle = palettes[3];
  ctx.fillRect(sx - 8 * s, sy - 73 * s, 12 * s, 10 * s);
  ctx.fillRect(sx + 13 * s, sy - 57 * s, 7 * s, 6 * s);
}
function drawBuilding(building) {
  const x = building.x * TILE - camera.x;
  const y = building.y * TILE - camera.y;
  const w = building.w * TILE;
  const h = building.h * TILE;
  if (x > VIEW_W + 40 || x + w < -40 || y > VIEW_H + 40 || y + h < -50) return;
  ctx.fillStyle = "rgba(33,49,28,.28)";
  ctx.fillRect(x - 8, y + h - 1, w + 18, 15);
  ctx.fillStyle = "#6c553c";
  ctx.fillRect(x + 5, y + 12, w - 10, h - 2);
  ctx.fillStyle = building.wall;
  ctx.fillRect(x + 8, y + 9, w - 16, h - 14);
  ctx.fillStyle = "#fff0c6";
  ctx.fillRect(x + 11, y + 12, w - 22, 4);
  ctx.fillStyle = building.roof;
  ctx.fillRect(x, y, w, h - 15);
  ctx.fillStyle = shadeColor(building.roof, -17);
  ctx.fillRect(x, y + h - 22, w, 8);
  ctx.fillStyle = shadeColor(building.roof, 18);
  ctx.fillRect(x + 5, y + 5, w - 10, 5);
  ctx.fillStyle = "rgba(255,242,190,.22)";
  for (let xx = x + 12; xx < x + w - 8; xx += 18) ctx.fillRect(xx, y + 14, 3, h - 38);
  const doorX = x + w / 2 - 7;
  ctx.fillStyle = "#5e4632";
  ctx.fillRect(doorX, y + h - 28, 14, 22);
  ctx.fillStyle = "#e6bd72";
  ctx.fillRect(doorX + 9, y + h - 18, 2, 2);
  ctx.fillStyle = "#f0e2bb";
  ctx.fillRect(x + w / 2 - 26, y + h - 38, 52, 11);
  ctx.fillStyle = "#584734";
  ctx.font = "bold 7px Ubuntu, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(building.sign, x + w / 2, y + h - 30);
}
function shadeColor(hex, amount) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return "#" + (r << 16 | g << 8 | b).toString(16).padStart(6, "0");
}
function drawCharacter(entity, isLocal, time) {
  const sx = entity.x - camera.x;
  const sy = entity.y - camera.y;
  if (sx < -60 || sx > VIEW_W + 60 || sy < -70 || sy > VIEW_H + 50) return;
  const moving = Boolean(entity.moving);
  const step = moving ? Math.floor(time / 115) % 2 : 0;
  const palette = [
    { shirt: "#7b79bd", light: "#aaa4e4", pants: "#34465f", hair: "#44332e" },
    { shirt: "#cf8167", light: "#edac83", pants: "#4b5267", hair: "#49362e" },
    { shirt: "#5e9e83", light: "#9dd1a5", pants: "#394b50", hair: "#2c2929" },
    { shirt: "#6b94bd", light: "#b3d3e8", pants: "#444b6b", hair: "#3b302b" },
    { shirt: "#c18cba", light: "#e5b9da", pants: "#55435e", hair: "#4a302f" }
  ][entity.palette || 0];

  ctx.fillStyle = "rgba(28,54,29,.3)";
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = moving && step ? -2 : 0;
  const top = sy - 32 + bob;
  ctx.fillStyle = palette.hair;
  ctx.fillRect(sx - 8, top, 16, 8);
  ctx.fillRect(sx - 10, top + 4, 3, 7);
  ctx.fillRect(sx + 7, top + 4, 3, 7);
  if (entity.direction === "up") {
    ctx.fillStyle = palette.hair;
    ctx.fillRect(sx - 8, top + 5, 16, 9);
  } else {
    ctx.fillStyle = "#efbd91";
    ctx.fillRect(sx - 7, top + 8, 14, 10);
    ctx.fillStyle = "#332d29";
    const eyeY = top + (entity.direction === "down" ? 12 : 10);
    if (entity.direction === "left") ctx.fillRect(sx - 6, eyeY, 2, 2);
    else if (entity.direction === "right") ctx.fillRect(sx + 4, eyeY, 2, 2);
    else { ctx.fillRect(sx - 5, eyeY, 2, 2); ctx.fillRect(sx + 3, eyeY, 2, 2); }
  }
  ctx.fillStyle = palette.shirt;
  ctx.fillRect(sx - 9, top + 17, 18, 9);
  ctx.fillStyle = palette.light;
  ctx.fillRect(sx - 7, top + 18, 5, 3);
  ctx.fillStyle = palette.pants;
  ctx.fillRect(sx - 7, top + 26, 6, 5 + (step ? 1 : 0));
  ctx.fillRect(sx + 1, top + 26, 6, 5 + (step ? 0 : 1));
  ctx.fillStyle = "#594331";
  ctx.fillRect(sx - 8, top + 30 + (step ? 1 : 0), 7, 3);
  ctx.fillRect(sx + 1, top + 30 + (step ? 0 : 1), 7, 3);

  drawNameTag(entity.name, sx, top - 8, isLocal);
}
function drawNameTag(name, x, y, isLocal) {
  const label = String(name || "Star").slice(0, 18);
  ctx.font = "bold 13px Ubuntu, sans-serif";
  const width = Math.max(34, ctx.measureText(label).width + 16);
  const left = Math.round(x - width / 2);
  const top = Math.round(y - 17);
  ctx.fillStyle = isLocal ? "rgba(38,48,34,.92)" : "rgba(28,43,35,.88)";
  ctx.fillRect(left, top, width, 19);
  ctx.fillStyle = isLocal ? "#f5e6a8" : "#f5fff0";
  ctx.fillRect(left + 3, top + 3, width - 6, 1);
  ctx.fillStyle = "#fffdf0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, top + 10);
  ctx.textBaseline = "alphabetic";
}
function drawEntity(entity, time) {
  if (entity.kind === "tree") drawTree(entity);
  else if (entity.kind === "building") drawBuilding(entity.data);
  else drawCharacter(entity, entity.uid === player.uid, time);
}
function renderablePlayers() {
  // In multiplayer, the remote-player adapter will populate remotePlayers;
  // the same rendering path will draw local and remote characters.
  return [player, ...remotePlayers.values()];
}
function drawWorld(time) {
  if (!canPlayWorld) return;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawGround(time);

  const entities = [];
  treeSpots.forEach(tree => {
    if (tree.x >= camera.x - 90 && tree.x <= camera.x + VIEW_W + 90 &&
        tree.y >= camera.y - 110 && tree.y <= camera.y + VIEW_H + 50) entities.push(tree);
  });
  buildings.forEach(data => {
    entities.push({ kind: "building", y: (data.y + data.h) * TILE, x: (data.x + data.w / 2) * TILE, data });
  });
  renderablePlayers().forEach(person => entities.push({ ...person, kind: "player" }));
  entities.sort((a, b) => a.y - b.y);
  entities.forEach(entity => drawEntity(entity, time));
  updateWorldHud();
}
function updateWorldHud() {
  $("worldCoords").textContent = String(Math.floor(player.x / TILE)).padStart(2, "0") + " : " +
    String(Math.floor(player.y / TILE)).padStart(2, "0");
  const nearby = nearbyBuilding();
  $("interactionPrompt").textContent = nearby
    ? "E  ·  " + nearby.name.toUpperCase()
    : "✦ Explore freely · Your little world is waiting";
  $("areaTag").textContent = areaName(player.x, player.y);
}
function areaName(x, y) {
  const tileX = x / TILE, tileY = y / TILE;
  if (tileX > 46 && tileY > 18 && tileY < 29) return "LITTLE COMET CAFÉ";
  if (tileX > 33 && tileY < 19) return "TOWN SQUARE";
  if (tileX < 30 && tileY < 25) return "STELLAR LIBRARY";
  if (tileX > 45 && tileY > 30) return "STAR MARKET";
  if (tileX > 26 && tileX < 39 && tileY > 31 && tileY < 41) return "RESIDENTIAL LANE";
  if (riverDistance(Math.floor(tileX), Math.floor(tileY)) < 2.2) return "RIVERSIDE";
  return "TOWN OUTSKIRTS";
}
function nearbyBuilding() {
  let nearest = null, best = 82;
  for (const building of buildings) {
    const cx = (building.x + building.w / 2) * TILE;
    const cy = (building.y + building.h + .4) * TILE;
    const distance = Math.hypot(player.x - cx, player.y - cy);
    if (distance < best) { best = distance; nearest = building; }
  }
  return nearest;
}
function isSolidAt(x, y) {
  const tileX = Math.floor(x / TILE);
  const tileY = Math.floor(y / TILE);
  if (x < TILE || y < TILE || x > MAP_PIXEL_W - TILE || y > MAP_PIXEL_H - TILE) return true;
  if (terrainAt(tileX, tileY) === "water") return true;
  if (pointInBuilding(x, y - 7, 4)) return true;
  for (const tree of treeSpots) {
    if (Math.abs(tree.x - x) < 24 && Math.abs(tree.y - y) < 26 && Math.hypot(tree.x - x, tree.y - y + 11) < 23) return true;
  }
  return false;
}
function movePlayer(dx, dy) {
  if (!requireWorldMember()) return;
  if (dx === 0 && dy === 0) return;
  const length = Math.hypot(dx, dy) || 1;
  const speed = 178;
  const amountX = (dx / length) * speed * deltaSeconds;
  const amountY = (dy / length) * speed * deltaSeconds;
  const nextX = player.x + amountX;
  const nextY = player.y + amountY;
  let moved = false;
  if (!isSolidAt(nextX, player.y)) { player.x = nextX; moved = true; }
  if (!isSolidAt(player.x, nextY)) { player.y = nextY; moved = true; }
  if (moved) {
    player.moving = true;
    if (Math.abs(dx) > Math.abs(dy)) player.direction = dx < 0 ? "left" : "right";
    else player.direction = dy < 0 ? "up" : "down";
    updateCamera();
    if (Math.floor(player.x / TILE) !== lastTileX || Math.floor(player.y / TILE) !== lastTileY) {
      lastTileX = Math.floor(player.x / TILE);
      lastTileY = Math.floor(player.y / TILE);
      updateHud();
      persist(true);
    }
    facingTimestamp = Date.now();
  }
}
let deltaSeconds = 0;
let lastTileX = -1;
let lastTileY = -1;
function updatePlayer() {
  if (!canPlayWorld) return;
  let dx = 0, dy = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
  player.moving = false;
  if (dx || dy) movePlayer(dx, dy);
}
function loop(time) {
  deltaSeconds = Math.min(.04, lastFrame ? (time - lastFrame) / 1000 : 0);
  lastFrame = time;
  updatePlayer();
  drawWorld(time);
  requestAnimationFrame(loop);
}
function drawClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta", hour: "numeric", minute: "2-digit"
  }).format(now);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short"
  }).format(now);
  $("worldClock").textContent = date + " · " + time + " WIB";
}
function setJob(id) {
  if (!requireWorldMember()) return;
  const job = jobs.find(item => item.id === id);
  if (!job) return;
  save.job = job.id;
  save.xp += 5;
  persist(true);
  updateHud();
  $("jobDialog").close();
  showToast(job.icon + " You are now a " + job.name + "!");
}
function openJobs() {
  if (!requireWorldMember()) return;
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
function interact() {
  if (!requireWorldMember()) return;
  const building = nearbyBuilding();
  if (!building) {
    showToast("Walk a little closer to a building first.");
    return;
  }
  if (building.id === "home") {
    save.coins += 5;
    save.homeDecor += 1;
    save.xp += 8;
    save.townProgress = Math.min(100, save.townProgress + 2);
    persist(true);
    updateHud();
    showToast("Welcome home, " + player.name + "! +5 Star Coins");
  } else {
    save.coins += 2;
    save.xp += 4;
    save.townProgress = Math.min(100, save.townProgress + 1);
    persist(true);
    updateHud();
    showToast("You visited " + building.name + ". +2 Star Coins");
  }
}
function bindControls() {
  document.addEventListener("keydown", event => {
    if ($("jobDialog").open || event.repeat && ["e", "E"].includes(event.key)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      keys.add(key);
    } else if (key === "e") {
      event.preventDefault();
      interact();
    }
  });
  document.addEventListener("keyup", event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  });
  window.addEventListener("blur", () => keys.clear());
  document.querySelectorAll("[data-move]").forEach(button => {
    const keyByDirection = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
    const key = keyByDirection[button.dataset.move];
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys.add(key);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
      button.addEventListener(type, () => keys.delete(key));
    });
  });
  $("mobileInteract").addEventListener("click", interact);
  $("chooseJobButton").addEventListener("click", openJobs);
  $("closeJobDialog").addEventListener("click", () => $("jobDialog").close());
  $("gameFrame").addEventListener("contextmenu", event => event.preventDefault());
}
async function loadMemberProfile(user) {
  if (!user) return { active: false, name: "Star", uid: null };
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (!snapshot.exists()) return { active: false, name: "Star", uid: user.uid };
    const profile = snapshot.data() || {};
    return {
      active: profile.isActive === true && ALLOWED_ROLES.includes(profile.role),
      name: firstName(profile.fullName || user.displayName),
      uid: user.uid
    };
  } catch (error) {
    console.warn("Could not load STELLARS World profile:", error);
    return { active: false, name: "Star", uid: user.uid };
  }
}
function startAuth() {
  onAuthStateChanged(auth, async user => {
    const sequence = ++authSequence;
    playerUser = user || null;
    canPlayWorld = false;
    updateWorldAccessUI();
    const profile = await loadMemberProfile(user);
    if (sequence !== authSequence || (auth.currentUser?.uid || null) !== (user?.uid || null)) return;
    canPlayWorld = profile.active;
    if (!canPlayWorld) {
      remotePlayers.clear();
      player.uid = user?.uid || "local-preview";
      player.name = "Star";
      updateWorldAccessUI();
      return;
    }
    player.uid = profile.uid;
    player.name = profile.name;
    player.palette = paletteFor(profile.uid);
    storageKey = SAVE_PREFIX + ":member:" + profile.uid;
    applySave();
    updateHud();
    updateWorldAccessUI();
    drawClock();
    updateCamera();
    drawWorld(performance.now());
  });
}

// Multiplayer integration point: a future RTDB listener can pass remote player
// states here. Single-player mode keeps this map empty.
window.STELLARSWorld = Object.freeze({
  getLocalPlayer: () => ({
    uid: player.uid, name: player.name, x: player.x, y: player.y,
    direction: player.direction, moving: player.moving
  }),
  setRemotePlayers: (players) => {
    if (!Array.isArray(players)) return;
    remotePlayers.clear();
    players.forEach(person => {
      if (!person || typeof person.uid !== "string" || person.uid === player.uid ||
          typeof person.name !== "string" || !Number.isFinite(person.x) ||
          !Number.isFinite(person.y)) return;
      remotePlayers.set(person.uid, {
        uid: person.uid,
        name: firstName(person.name),
        x: Math.max(TILE, Math.min(MAP_PIXEL_W - TILE, person.x)),
        y: Math.max(TILE, Math.min(MAP_PIXEL_H - TILE, person.y)),
        direction: ["up", "down", "left", "right"].includes(person.direction) ? person.direction : "down",
        moving: person.moving === true,
        palette: paletteFor(person.uid)
      });
    });
  }
});

bindControls();
drawClock();
setInterval(drawClock, 30000);
startAuth();
requestAnimationFrame(loop);
