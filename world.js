import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getDatabase, ref as databaseRef, get as databaseGet,
  onChildAdded, onChildChanged, onChildRemoved,
  set as databaseSet, onDisconnect, remove as databaseRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

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
  measurementId: "G-DTHTZNT135",
  databaseURL: "https://class-web-7241e-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const realtimeDb = getDatabase(app, firebaseConfig.databaseURL);

const $ = id => document.getElementById(id);
const canvas = $("worldCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const TILE = 32;
const MAP_W = 140;
const MAP_H = 100;
const MAP_PIXEL_W = MAP_W * TILE;
const MAP_PIXEL_H = MAP_H * TILE;
const SAVE_PREFIX = "stellarsWorldTopDownV1";
const ALLOWED_ROLES = ["student", "member", "admin", "superAdmin", "super_admin"];

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
  { id: "market", name: "Star Market", x: 49, y: 34, w: 5, h: 4, roof: "#d0a64e", wall: "#ead5a6", sign: "MARKET" },
  { id: "workshop", name: "Star Workshop", x: 67, y: 23, w: 6, h: 5, roof: "#8f8a68", wall: "#d7c69b", sign: "WORKSHOP" },
  { id: "observatory", name: "Stellar Observatory", x: 110, y: 34, w: 7, h: 6, roof: "#586f9b", wall: "#c7c8c5", sign: "OBSERVATORY" },
  { id: "bakery", name: "Sunrise Bakery", x: 69, y: 66, w: 6, h: 5, roof: "#c78b55", wall: "#f0d5a3", sign: "BAKERY" },
  { id: "fashion", name: "Stellar Fashion House", x: 58, y: 34, w: 5, h: 4, roof: "#bf6e9d", wall: "#f0c8d9", sign: "FASHION" }
];

const riverLine = [[7, 2], [9, 9], [8, 16], [11, 23], [10, 30], [13, 38], [12, 46], [17, 54], [20, 62], [23, 70], [23, 80], [30, 90], [35, 99]];
const pathLines = [
  [[37, 99], [37, 75], [37, 58], [37, 50], [37, 42], [37, 31], [39, 27], [39, 20], [39, 16]],
  [[39, 27], [46, 25], [50, 23]],
  [[37, 31], [30, 29], [27, 25], [25, 22], [24, 21]],
  [[37, 31], [40, 35], [45, 36], [50, 36]],
  [[37, 31], [32, 35], [31, 37]],
  [[37, 51], [52, 52], [66, 51], [78, 48], [83, 47]],
  [[37, 51], [29, 64], [25, 78], [25, 89]],
  [[68, 28], [78, 29], [92, 32], [108, 36]],
  [[66, 51], [70, 61], [73, 68], [78, 70]],
  [[78, 70], [93, 75], [109, 77], [122, 81]]
];

const treeSpots = [];
const decorativeSpots = [];
const remotePlayers = new Map();
const keys = new Set();
let playerUser = null;
let canPlayWorld = false;
let authSequence = 0;
let storageKey = SAVE_PREFIX + ":locked";
let save = {
  job: "", coins: 100, xp: 0, townProgress: 0, homeDecor: 0,
  inventory: { riceSeed: 4, rice: 0, coffeeBeans: 3, coffee: 0, wood: 4, stone: 3, books: 2, starShard: 0, dye: 2 },
  plots: {}, npcRewards: {}, gathered: [], benches: 0, murals: 0
};
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
    (x >= 10 && x <= 12 && y >= 36 && y <= 38) ||
    (x >= 21 && x <= 24 && y >= 73 && y <= 76);
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
  const genderText = save.gender === "female" ? "Female character" : save.gender === "male" ? "Male character" : "Choose your character";
  const genderLabel = $("playerGender");
  if (genderLabel) genderLabel.textContent = genderText;
  const settingsGenderLabel = $("settingsGenderLabel");
  if (settingsGenderLabel) settingsGenderLabel.textContent = genderText;
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
  const basePalette = [
    { shirt: "#7b79bd", light: "#aaa4e4", pants: "#34465f", hair: "#44332e" },
    { shirt: "#cf8167", light: "#edac83", pants: "#4b5267", hair: "#49362e" },
    { shirt: "#5e9e83", light: "#9dd1a5", pants: "#394b50", hair: "#2c2929" },
    { shirt: "#6b94bd", light: "#b3d3e8", pants: "#444b6b", hair: "#3b302b" },
    { shirt: "#c18cba", light: "#e5b9da", pants: "#55435e", hair: "#4a302f" }
  ][entity.palette || 0];
  let palette = entity.gender === "female"
    ? { ...basePalette, shirt: "#e968ad", light: "#ffc0e4", pants: "#99547f" }
    : basePalette;
  if (isSafeWorldColor(entity.shirtColor)) {
    palette = { ...palette, shirt: entity.shirtColor, light: shadeColor(entity.shirtColor, 48) };
  }

  ctx.fillStyle = "rgba(28,54,29,.3)";
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = moving && step ? -2 : 0;
  const top = sy - 32 + bob;
  const isFemale = entity.gender === "female";
  ctx.fillStyle = palette.hair;
  if (isFemale) {
    ctx.fillRect(sx - 9, top - 1, 18, 9);
    ctx.fillRect(sx - 10, top + 5, 4, 17);
    ctx.fillRect(sx + 6, top + 5, 4, 17);
    ctx.fillRect(sx - 8, top + 18, 3, 5);
    ctx.fillRect(sx + 5, top + 18, 3, 5);
  } else {
    ctx.fillRect(sx - 8, top, 16, 8);
    ctx.fillRect(sx - 10, top + 4, 3, 7);
    ctx.fillRect(sx + 7, top + 4, 3, 7);
  }
  if (entity.direction === "up") {
    ctx.fillStyle = palette.hair;
    ctx.fillRect(sx - (isFemale ? 9 : 8), top + 5, isFemale ? 18 : 16, isFemale ? 17 : 9);
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
  const currentArea = insideBuilding || "outside";
  const now = performance.now();
  const visibleRemotePlayers = Array.from(remotePlayers.values())
    .filter(person => person.area === currentArea)
    .map(person => {
      const progress = Math.max(0, Math.min(1, (now - person.receivedAt) / 450));
      return {
        ...person,
        x: person.x + (person.targetX - person.x) * progress,
        y: person.y + (person.targetY - person.y) * progress
      };
    });
  return [player, ...visibleRemotePlayers];
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
  if (canPlayWorld) updateWorldEnvironment(deltaSeconds);
  drawWorld(time);
  syncWorldPresence(time);
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
function setGender(gender) {
  if (!requireWorldMember() || !["male", "female"].includes(gender)) return;
  save.gender = gender;
  const defaultStyle = FASHION_STYLES.find(style => style.gender === gender && style.default);
  if (defaultStyle) {
    save.outfitId = defaultStyle.id;
    save.shirtColor = defaultStyle.color;
  }
  player.gender = gender;
  player.shirtColor = save.shirtColor;
  persist(true);
  updateHud();
  $("genderDialog").close();
  if (!worldPresenceReady) void startMultiplayer();
  else syncWorldPresence(performance.now());
  showToast(gender === "female" ? "✦ Female character selected!" : "✦ Male character selected!");
}
function openGenderPicker() {
  if (!requireWorldMember()) return;
  $("genderDialog").showModal();
}
function bindGenderPicker() {
  document.querySelectorAll("[data-gender]").forEach(button => {
    button.addEventListener("click", () => setGender(button.dataset.gender));
  });
  $("changeGenderButton").addEventListener("click", openGenderPicker);
  $("closeGenderDialog").addEventListener("click", () => {
    if (save.gender) $("genderDialog").close();
  });
  $("genderDialog").addEventListener("cancel", event => {
    if (!save.gender) event.preventDefault();
  });
}
function setJob(id) {
  if (!requireWorldMember()) return;
  const job = jobs.find(item => item.id === id);
  if (!job) return;
  save.job = job.id;
  awardWorldXp(5);
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
    awardWorldXp(8);
    save.townProgress = Math.min(100, save.townProgress + 2);
    persist(true);
    updateHud();
    showToast("Welcome home, " + player.name + "! +5 Star Coins");
  } else {
    save.coins += 2;
    awardWorldXp(4);
    save.townProgress = Math.min(100, save.townProgress + 1);
    persist(true);
    updateHud();
    showToast("You visited " + building.name + ". +2 Star Coins");
  }
}
function bindControls() {
  document.addEventListener("keydown", event => {
    if (homeEditorActive || $("jobDialog").open || $("furnitureDialog").open || $("fashionDialog").open ||
        $("genderDialog").open || event.repeat && ["e", "E"].includes(event.key)) return;
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
  $("closeFurnitureDialog").addEventListener("click", () => $("furnitureDialog").close());
  $("closeFashionDialog").addEventListener("click", () => $("fashionDialog").close());
  $("buySupplyBundleButton").addEventListener("click", buyMarketSupplyBundle);
  bindGenderPicker();
  $("gameFrame").addEventListener("contextmenu", event => event.preventDefault());
}
async function loadMemberProfile(user) {
  if (!user) return { active: false, name: "Star", uid: null };
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (!snapshot.exists()) return { active: false, name: "Star", uid: user.uid };
    const profile = snapshot.data() || {};
    return {
      active: profile.isActive === true,
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
      stopMultiplayer();
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
    player.gender = save.gender || "male";
    player.shirtColor = save.shirtColor || "#6687a7";
    player.hairStyle = save.hairStyle || (save.gender === "female" ? "long" : "short");
    player.accessory = save.accessory || "none";
    player.pantsColor = save.pantsColor || "#34465f";
    player.shoeColor = save.shoeColor || "#594331";
    updateHud();
    updateWorldAccessUI();
    drawClock();
    updateCamera();
    drawWorld(performance.now());
    if (!save.gender) {
      $("genderDialog").showModal();
      setWorldNetworkStatus("CHOOSE YOUR CHARACTER", 1);
    } else {
      void startMultiplayer();
    }
  });
}

// Multiplayer integration point: a future RTDB listener can pass remote player
// states here. Single-player mode keeps this map empty.
window.STELLARSWorld = Object.freeze({
  getLocalPlayer: () => ({
    uid: player.uid, name: player.name, x: player.x, y: player.y,
    direction: player.direction, moving: player.moving,
    gender: save.gender || "male",
    shirtColor: save.shirtColor || "#6687a7",
    hairStyle: save.hairStyle || (save.gender === "female" ? "long" : "short"),
    accessory: save.accessory || "none",
    pantsColor: save.pantsColor || "#34465f",
    shoeColor: save.shoeColor || "#594331",
    area: insideBuilding || "outside", job: save.job || ""
  }),
  setRemotePlayers: (players) => {
    if (!Array.isArray(players)) return;
    const now = performance.now();
    const allowedAreas = ["outside", "library", "townhall", "cafe", "home", "market", "workshop", "observatory", "bakery", "fashion", "moon-garden"];
    const keep = new Set();
    players.forEach(person => {
      if (!person || typeof person.uid !== "string" || person.uid === player.uid ||
          typeof person.name !== "string" || !Number.isFinite(person.x) ||
          !Number.isFinite(person.y)) return;
      const area = allowedAreas.includes(person.area) ? person.area : "outside";
      const targetX = Math.max(TILE, Math.min(MAP_PIXEL_W - TILE, person.x));
      const targetY = Math.max(TILE, Math.min(MAP_PIXEL_H - TILE, person.y));
      const previous = remotePlayers.get(person.uid);
      let startX = targetX, startY = targetY;
      if (previous && previous.area === area) {
        const progress = Math.max(0, Math.min(1, (now - previous.receivedAt) / 450));
        startX = previous.x + (previous.targetX - previous.x) * progress;
        startY = previous.y + (previous.targetY - previous.y) * progress;
      }
      remotePlayers.set(person.uid, {
        uid: person.uid, name: firstName(person.name),
        x: startX, y: startY, targetX, targetY, area,
        direction: ["up", "down", "left", "right"].includes(person.direction) ? person.direction : "down",
        moving: person.moving === true,
        gender: person.gender === "female" ? "female" : "male",
        shirtColor: isSafeWorldColor(person.shirtColor) ? person.shirtColor : "",
        hairStyle: ["short", "wave", "curly", "long", "bob", "bun"].includes(person.hairStyle) ? person.hairStyle : "",
        accessory: ["none", "starclip", "glasses", "cap", "bow"].includes(person.accessory) ? person.accessory : "none",
        pantsColor: isSafeWorldColor(person.pantsColor) ? person.pantsColor : "",
        shoeColor: isSafeWorldColor(person.shoeColor) ? person.shoeColor : "",
        emote: ["👋", "💖", "🎉", "🎵", "✨"].includes(person.emote) ? person.emote : "",
        emoteUntil: person.emote ? Date.now() + 2800 : 0,
        job: typeof person.job === "string" ? person.job : "",
        receivedAt: now, palette: paletteFor(person.uid)
      });
      keep.add(person.uid);
    });
    for (const uid of remotePlayers.keys()) if (!keep.has(uid)) remotePlayers.delete(uid);
  }
});


// ── TOWN LIFE SYSTEM: expanded overworld, rooms, NPCs, items and profession loops.
const INVENTORY_ITEMS = [
  { key: "riceSeed", label: "Rice Seeds", icon: "🌾" }, { key: "rice", label: "Rice", icon: "🍚" },
  { key: "coffeeBeans", label: "Coffee Beans", icon: "🫘" }, { key: "coffee", label: "Coffee", icon: "☕" },
  { key: "wood", label: "Wood", icon: "🪵" }, { key: "stone", label: "Stone", icon: "🪨" },
  { key: "books", label: "Books", icon: "📚" }, { key: "starShard", label: "Star Shards", icon: "💎" },
  { key: "dye", label: "Dye", icon: "🎨" }
];
const DEFAULT_INVENTORY = { riceSeed: 4, rice: 0, coffeeBeans: 3, coffee: 0, wood: 4, stone: 3, books: 2, starShard: 0, dye: 2 };

const FURNITURE_CATALOG = [
  { id: "starter-sofa", name: "Cloud Sofa", description: "A soft little place to rest.", cost: 0, kind: "sofa" },
  { id: "star-rug", name: "Stardust Rug", description: "A warm centrepiece for your room.", cost: 38, kind: "rug" },
  { id: "moon-lamp", name: "Moonlight Lamp", description: "A gentle glow for quiet evenings.", cost: 32, kind: "lamp" },
  { id: "bookcase", name: "Little Bookcase", description: "Keep your favourite stories close.", cost: 46, kind: "bookcase" },
  { id: "potted-plant", name: "Sunbeam Plant", description: "A little green for your home.", cost: 24, kind: "plant" },
  { id: "coffee-table", name: "Comet Coffee Table", description: "A tiny table for slow mornings.", cost: 42, kind: "table" }
];
const HOME_THEMES = [
  { id: "sage", name: "Sage & Oak", description: "A calm, leafy home.", cost: 0, wall: "#657d69", floor: "#b28a67" },
  { id: "lavender", name: "Lavender Sky", description: "Soft violet walls and warm flooring.", cost: 55, wall: "#82729d", floor: "#b89b83" },
  { id: "sunset", name: "Peach Sunset", description: "Warm peach tones for a cosy room.", cost: 65, wall: "#b87968", floor: "#c59a70" },
  { id: "starlight", name: "Starlight Blue", description: "A cool midnight-inspired interior.", cost: 80, wall: "#566f91", floor: "#9c8d83" }
];
const FASHION_STYLES = [
  { id: "male-classic", gender: "male", name: "Campus Classic", description: "A neat everyday look.", cost: 0, color: "#6687a7", default: true },
  { id: "male-orbit", gender: "male", name: "Orbit Jacket", description: "A bold jacket for exploring.", cost: 58, color: "#c47b49" },
  { id: "male-midnight", gender: "male", name: "Midnight Street", description: "Deep blue with a cool tone.", cost: 76, color: "#4e528f" },
  { id: "female-classic", gender: "female", name: "Bloom Cardigan", description: "A soft pink everyday style.", cost: 0, color: "#e968ad", default: true },
  { id: "female-orbit", gender: "female", name: "Starlight Hoodie", description: "A lavender look with a little sparkle.", cost: 58, color: "#a578ce" },
  { id: "female-sunrise", gender: "female", name: "Sunrise Knit", description: "Warm peach tones for a bright day.", cost: 76, color: "#db866f" }
];
const FASHION_COLORS = [
  { name: "Rose", value: "#e968ad" },
  { name: "Lavender", value: "#a578ce" },
  { name: "Sky", value: "#6d9fce" },
  { name: "Ocean", value: "#4d8c99" },
  { name: "Sage", value: "#6d9b73" },
  { name: "Sunset", value: "#dc9061" },
  { name: "Butter", value: "#c5a44e" },
  { name: "Midnight", value: "#53547f" }
];
function isSafeWorldColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
function xpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 100 + 10 * ((safeLevel - 1) * safeLevel / 2);
}
function getWorldLevelProgress(totalXp) {
  let remaining = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let needed = xpRequiredForLevel(level);
  while (remaining >= needed && level < 9999) {
    remaining -= needed;
    level += 1;
    needed = xpRequiredForLevel(level);
  }
  return { level, current: remaining, needed, percent: Math.min(100, remaining / needed * 100) };
}

const farmPlots = [];
for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) farmPlots.push({ x: 81 + col, y: 45 + row });
const townNPCs = [
  { id: "mira", name: "Mira", x: 80.2 * TILE, y: 43.1 * TILE, palette: 2, message: "Plant a seed, water it three times, then harvest your rice.", reward: { riceSeed: 3 } },
  { id: "mika", name: "Mika", x: 55.5 * TILE, y: 26.8 * TILE, palette: 1, message: "Baristas brew beans into coffee, then serve each cup for Star Coins.", reward: { coffeeBeans: 2 } },
  { id: "theo", name: "Theo", x: 28.4 * TILE, y: 23.6 * TILE, palette: 3, message: "Librarians sort books at the desk to earn coins and experience.", reward: { books: 2 } },
  { id: "raya", name: "Raya", x: 74.6 * TILE, y: 29.6 * TILE, palette: 4, message: "Builders turn wood and stone into benches for the town square.", reward: { wood: 2, stone: 1 } },
  { id: "nova", name: "Nova", x: 107.4 * TILE, y: 43.5 * TILE, palette: 0, message: "Star fragments are scattered around the valley. Bring them to the observatory.", reward: { starShard: 1 } }
];
const resourceSpots = [
  { id: "wood-1", x: 60.5 * TILE, y: 66.5 * TILE, item: "wood", amount: 2 },
  { id: "wood-2", x: 96.5 * TILE, y: 20.5 * TILE, item: "wood", amount: 2 },
  { id: "wood-3", x: 119.5 * TILE, y: 64.5 * TILE, item: "wood", amount: 2 },
  { id: "stone-1", x: 58.5 * TILE, y: 80.5 * TILE, item: "stone", amount: 2 },
  { id: "stone-2", x: 101.5 * TILE, y: 87.5 * TILE, item: "stone", amount: 2 },
  { id: "star-1", x: 91.5 * TILE, y: 14.5 * TILE, item: "starShard", amount: 1 },
  { id: "star-2", x: 125.5 * TILE, y: 54.5 * TILE, item: "starShard", amount: 1 },
  { id: "star-3", x: 108.5 * TILE, y: 91.5 * TILE, item: "starShard", amount: 1 }
];
const interiorRooms = {
  library: { station: { x: 670, y: 315, label: "BOOK SORTING DESK" }, floor: "#b98d60", wall: "#79609a" },
  townhall: { station: { x: 930, y: 285, label: "MURAL CANVAS" }, floor: "#bd9364", wall: "#a75e4d" },
  cafe: { station: { x: 920, y: 315, label: "COFFEE COUNTER" }, floor: "#b77f60", wall: "#9b604f" },
  home: { station: { x: 350, y: 330, label: "HOME CORNER" }, floor: "#b28a67", wall: "#657d9d" },
  market: { station: { x: 930, y: 315, label: "FURNITURE & SUPPLY SHOP" }, floor: "#c39a61", wall: "#b38d42" },
  fashion: { station: { x: 920, y: 315, label: "FASHION COUNTER" }, floor: "#c58eaa", wall: "#9e6484" },
  workshop: { station: { x: 890, y: 330, label: "BUILDING BENCH" }, floor: "#9a7957", wall: "#777653" },
  observatory: { station: { x: 650, y: 280, label: "STAR CHART TABLE" }, floor: "#897da6", wall: "#536a96" },
  bakery: { station: { x: 910, y: 315, label: "BAKERY COUNTER" }, floor: "#c49a69", wall: "#bd8450" }
};
const indoorStaff = {
  library: { name: "Theo", x: 440, y: 300, palette: 3 },
  townhall: { name: "Elle", x: 760, y: 300, palette: 4 },
  cafe: { name: "Mika", x: 760, y: 330, palette: 1 },
  market: { name: "Nico", x: 760, y: 330, palette: 0 },
  workshop: { name: "Raya", x: 700, y: 335, palette: 4 },
  observatory: { name: "Nova", x: 820, y: 300, palette: 0 },
  bakery: { name: "Sora", x: 760, y: 330, palette: 2 },
  fashion: { name: "Ari", x: 760, y: 330, palette: 4 }
};
let insideBuilding = null;
let outsidePosition = null;
persist = function persistTownSave(force = false) {
  const now = Date.now();
  if (!force && now - lastSaveAt < 700) return;
  lastSaveAt = now;
  const position = insideBuilding && outsidePosition ? outsidePosition : player;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...save, x: position.x, y: position.y }));
    $("saveState").textContent = "● LOCAL SAVE";
  } catch (error) {
    $("saveState").textContent = "● SAVE UNAVAILABLE";
    console.warn("Could not save STELLARS World progress:", error);
  }
};

function createTownSave() {
  return {
    job: "", coins: 100, xp: 0, townProgress: 0, homeDecor: 0,
    inventory: { ...DEFAULT_INVENTORY }, plots: {}, npcRewards: {}, gathered: [],
    benches: 0, murals: 0, gender: "",
    ownedFashion: ["male-classic", "female-classic"], outfitId: "male-classic", shirtColor: "#6687a7",
    ownedFurniture: ["starter-sofa"], placedFurniture: ["starter-sofa"],
    ownedThemes: ["sage"], homeTheme: "sage",
    x: 37 * TILE + 16, y: 43 * TILE + 16
  };
}
readSave = function readSaveTown(key) {
  const defaults = createTownSave();
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (!parsed || typeof parsed !== "object") return defaults;
    const inventory = { ...DEFAULT_INVENTORY };
    if (parsed.inventory && typeof parsed.inventory === "object") {
      Object.keys(inventory).forEach(item => inventory[item] = Math.max(0, Math.floor(Number(parsed.inventory[item]) || 0)));
    }
    const gender = ["male", "female"].includes(parsed.gender) ? parsed.gender : "";
    const ownedFashion = Array.isArray(parsed.ownedFashion)
      ? [...new Set(parsed.ownedFashion.filter(id => FASHION_STYLES.some(style => style.id === id)))]
      : ["male-classic", "female-classic"];
    ["male-classic", "female-classic"].forEach(id => {
      if (!ownedFashion.includes(id)) ownedFashion.push(id);
    });
    const defaultOutfitId = gender === "female" ? "female-classic" : "male-classic";
    const requestedOutfit = FASHION_STYLES.find(style => style.id === parsed.outfitId);
    const outfitId = requestedOutfit && requestedOutfit.gender === gender &&
      ownedFashion.includes(requestedOutfit.id) ? requestedOutfit.id : defaultOutfitId;
    const outfitStyle = FASHION_STYLES.find(style => style.id === outfitId) || FASHION_STYLES[0];
    const ownedFurniture = Array.isArray(parsed.ownedFurniture)
      ? [...new Set(parsed.ownedFurniture.filter(id => FURNITURE_CATALOG.some(item => item.id === id)))]
      : ["starter-sofa"];
    if (!ownedFurniture.includes("starter-sofa")) ownedFurniture.push("starter-sofa");
    const placedFurniture = Array.isArray(parsed.placedFurniture)
      ? [...new Set(parsed.placedFurniture.filter(id => ownedFurniture.includes(id)))]
      : ["starter-sofa"];
    const ownedThemes = Array.isArray(parsed.ownedThemes)
      ? [...new Set(parsed.ownedThemes.filter(id => HOME_THEMES.some(theme => theme.id === id)))]
      : ["sage"];
    if (!ownedThemes.includes("sage")) ownedThemes.push("sage");
    const homeTheme = ownedThemes.includes(parsed.homeTheme) ? parsed.homeTheme : "sage";
    const shirtColor = isSafeWorldColor(parsed.shirtColor) ? parsed.shirtColor : outfitStyle.color;
    return {
      ...defaults, ...parsed,
      gender, ownedFashion, outfitId, shirtColor,
      ownedFurniture, placedFurniture, ownedThemes, homeTheme,
      job: jobs.some(job => job.id === parsed.job) ? parsed.job : "",
      coins: Math.max(0, Math.floor(Number(parsed.coins) || 0)),
      xp: Math.max(0, Math.floor(Number(parsed.xp) || 0)),
      townProgress: Math.max(0, Math.min(100, Number(parsed.townProgress) || 0)),
      homeDecor: Math.max(0, Math.floor(Number(parsed.homeDecor) || 0)),
      inventory,
      plots: parsed.plots && typeof parsed.plots === "object" ? parsed.plots : {},
      npcRewards: parsed.npcRewards && typeof parsed.npcRewards === "object" ? parsed.npcRewards : {},
      gathered: Array.isArray(parsed.gathered) ? parsed.gathered : [],
      benches: Math.max(0, Math.floor(Number(parsed.benches) || 0)),
      murals: Math.max(0, Math.floor(Number(parsed.murals) || 0)),
      x: Number.isFinite(parsed.x) ? Math.max(TILE * 2, Math.min(MAP_PIXEL_W - TILE * 2, parsed.x)) : defaults.x,
      y: Number.isFinite(parsed.y) ? Math.max(TILE * 2, Math.min(MAP_PIXEL_H - TILE * 2, parsed.y)) : defaults.y
    };
  } catch (error) { console.warn("Could not read STELLARS World save:", error); return defaults; }
};

function addStoreCard(grid, title, description, meta, buttonText, onClick, disabled = false, accent = "") {
  const card = document.createElement("article");
  card.className = "store-card" + (accent ? " " + accent : "");
  const icon = document.createElement("span");
  icon.className = "store-card-icon";
  icon.textContent = meta.icon || "✦";
  const heading = document.createElement("strong");
  heading.className = "store-card-title";
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.className = "store-card-description";
  copy.textContent = description;
  const price = document.createElement("small");
  price.className = "store-card-price";
  price.textContent = meta.price || "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pixel-button store-card-button";
  button.textContent = buttonText;
  button.disabled = disabled;
  if (onClick) button.addEventListener("click", onClick);
  card.append(icon, heading, copy, price, button);
  grid.append(card);
}

let furnitureDialogMode = "shop";
function openFurnitureShop(mode = "shop") {
  if (!requireWorldMember()) return;
  furnitureDialogMode = mode === "home" ? "home" : "shop";
  const isHome = furnitureDialogMode === "home";
  $("furnitureDialogTitle").textContent = isHome ? "Make this place yours." : "Furniture & Home Decor.";
  $("furnitureDialogDescription").textContent = isHome
    ? "Place or remove the furniture you own, and choose a room theme."
    : "Pick up a new piece at Star Market, then bring it home to decorate.";
  $("furnitureDialogKicker").textContent = isHome ? "HOME DESIGN STUDIO" : "STAR MARKET / HOME COLLECTION";
  $("buySupplyBundleButton").hidden = isHome;
  renderFurnitureShop();
  $("furnitureDialog").showModal();
}

function renderFurnitureShop() {
  const furnitureGrid = $("furnitureShopGrid");
  const themeGrid = $("homeThemeGrid");
  if (!furnitureGrid || !themeGrid) return;
  const isHome = furnitureDialogMode === "home";
  $("furnitureShopBalance").textContent = Math.floor(save.coins).toLocaleString("en-US") + " STAR COINS";
  furnitureGrid.replaceChildren();
  themeGrid.replaceChildren();

  FURNITURE_CATALOG.forEach(item => {
    const owned = save.ownedFurniture.includes(item.id);
    const placed = save.placedFurniture.includes(item.id);
    let label = "BUY · " + item.cost + " COINS";
    let disabled = false;
    let action = () => buyFurniture(item.id);
    if (isHome) {
      label = !owned ? "BUY AT STAR MARKET" : placed ? "REMOVE FROM HOME" : "PLACE IN HOME";
      disabled = !owned;
      action = owned ? () => toggleFurniturePlacement(item.id) : null;
    } else if (owned) {
      label = placed ? "OWNED · PLACED" : "OWNED";
      disabled = true;
      action = null;
    } else {
      disabled = save.coins < item.cost;
    }
    const icons = { sofa: "🛋️", rug: "🟪", lamp: "💡", bookcase: "📚", plant: "🪴", table: "🪑" };
    addStoreCard(
      furnitureGrid, item.name, item.description,
      { icon: icons[item.kind] || "✦", price: item.cost === 0 ? "STARTER ITEM" : item.cost + " STAR COINS" },
      label, action, disabled
    );
  });

  HOME_THEMES.forEach(theme => {
    const owned = save.ownedThemes.includes(theme.id);
    const selected = save.homeTheme === theme.id;
    let label = "BUY · " + theme.cost + " COINS";
    let disabled = false;
    let action = () => buyHomeTheme(theme.id);
    if (isHome) {
      label = !owned ? "BUY AT STAR MARKET" : selected ? "CURRENT THEME" : "APPLY THEME";
      disabled = !owned || selected;
      action = owned ? () => selectHomeTheme(theme.id) : null;
    } else if (owned) {
      label = selected ? "CURRENT THEME" : "OWNED";
      disabled = true;
      action = null;
    } else {
      disabled = save.coins < theme.cost;
    }
    addStoreCard(
      themeGrid, theme.name, theme.description,
      { icon: "🎨", price: theme.cost === 0 ? "STARTER THEME" : theme.cost + " STAR COINS" },
      label, action, disabled, "theme-store-card"
    );
  });
}

function buyFurniture(id) {
  const item = FURNITURE_CATALOG.find(entry => entry.id === id);
  if (!item || save.ownedFurniture.includes(id)) return;
  if (save.coins < item.cost) {
    showToast("You need " + item.cost + " Star Coins for " + item.name + ".");
    return;
  }
  save.coins -= item.cost;
  save.ownedFurniture.push(id);
  persist(true);
  updateHud();
  renderFurnitureShop();
  showToast(item.name + " added to your furniture collection!");
}

function toggleFurniturePlacement(id) {
  if (!save.ownedFurniture.includes(id)) return;
  const index = save.placedFurniture.indexOf(id);
  if (index >= 0) {
    save.placedFurniture.splice(index, 1);
    showToast("Furniture stored in your collection.");
  } else {
    if (save.placedFurniture.length >= 6) {
      showToast("Your room is full. Remove a piece before placing another.");
      return;
    }
    save.placedFurniture.push(id);
    save.homeDecor = Math.max(save.homeDecor, save.placedFurniture.length);
    showToast("A new piece has been placed in your home!");
  }
  persist(true);
  renderFurnitureShop();
}

function buyHomeTheme(id) {
  const theme = HOME_THEMES.find(entry => entry.id === id);
  if (!theme || save.ownedThemes.includes(id)) return;
  if (save.coins < theme.cost) {
    showToast("You need " + theme.cost + " Star Coins for this room theme.");
    return;
  }
  save.coins -= theme.cost;
  save.ownedThemes.push(id);
  save.homeTheme = id;
  persist(true);
  updateHud();
  renderFurnitureShop();
  showToast(theme.name + " unlocked for your home!");
}

function selectHomeTheme(id) {
  if (!save.ownedThemes.includes(id) || !HOME_THEMES.some(theme => theme.id === id)) return;
  save.homeTheme = id;
  persist(true);
  renderFurnitureShop();
  showToast("Your home has a fresh new look!");
}

function buyMarketSupplyBundle() {
  if (save.coins < 12) {
    showToast("You need 12 Star Coins for a supply bundle.");
    return;
  }
  save.coins -= 12;
  addTownItem("riceSeed", 3);
  addTownItem("coffeeBeans", 2);
  addTownItem("dye", 1);
  addTownItem("books", 1);
  addTownItem("wood", 1);
  addTownItem("stone", 1);
  persist(true);
  updateHud();
  showToast("Supply bundle purchased! Seeds, beans, dye, books, wood and stone added.");
}

function applyFashionStyle(style) {
  save.outfitId = style.id;
  save.shirtColor = style.color;
  player.shirtColor = style.color;
  persist(true);
  updateHud();
  if (worldPresenceReady) syncWorldPresence(performance.now());
}

function renderFashionShop() {
  const gender = save.gender === "female" ? "female" : "male";
  $("fashionGenderLabel").textContent = gender === "female" ? "WOMEN'S COLLECTION" : "MEN'S COLLECTION";
  $("fashionShopBalance").textContent = Math.floor(save.coins).toLocaleString("en-US") + " STAR COINS";
  const styleGrid = $("fashionStyleGrid");
  const colorGrid = $("fashionColorGrid");
  styleGrid.replaceChildren();
  colorGrid.replaceChildren();

  FASHION_STYLES.filter(style => style.gender === gender).forEach(style => {
    const owned = save.ownedFashion.includes(style.id);
    const equipped = save.outfitId === style.id;
    const label = equipped ? "CURRENT OUTFIT" : owned ? "WEAR THIS" : "BUY · " + style.cost + " COINS";
    addStoreCard(
      styleGrid, style.name, style.description,
      { icon: "👕", price: style.cost === 0 ? "STARTER LOOK" : style.cost + " STAR COINS" },
      label,
      () => {
        if (owned) {
          applyFashionStyle(style);
          renderFashionShop();
          showToast(style.name + " equipped!");
          return;
        }
        if (save.coins < style.cost) {
          showToast("You need " + style.cost + " Star Coins for this outfit.");
          return;
        }
        save.coins -= style.cost;
        save.ownedFashion.push(style.id);
        applyFashionStyle(style);
        renderFashionShop();
        showToast(style.name + " unlocked!");
      },
      equipped || (!owned && save.coins < style.cost),
      "fashion-store-card"
    );
  });

  FASHION_COLORS.forEach(color => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fashion-color-swatch" + (save.shirtColor === color.value ? " selected" : "");
    button.style.setProperty("--swatch-color", color.value);
    button.setAttribute("aria-label", color.name + " shirt color");
    button.title = color.name;
    button.addEventListener("click", () => {
      save.shirtColor = color.value;
      player.shirtColor = color.value;
      persist(true);
      if (worldPresenceReady) syncWorldPresence(performance.now());
      renderFashionShop();
      showToast(color.name + " shirt color selected.");
    });
    colorGrid.append(button);
  });
}

function openFashionShop() {
  if (!requireWorldMember()) return;
  if (!save.gender) {
    $("genderDialog").showModal();
    showToast("Choose your character first.");
    return;
  }
  renderFashionShop();
  $("fashionDialog").showModal();
}

function drawHomeFurniture() {
  const placed = new Set(save.placedFurniture || []);
  for (const item of FURNITURE_CATALOG) {
    if (!placed.has(item.id)) continue;
    if (item.kind === "sofa") {
      ctx.fillStyle = "rgba(45,34,31,.22)"; ctx.fillRect(220, 490, 185, 20);
      ctx.fillStyle = "#6e879c"; ctx.fillRect(225, 430, 178, 72);
      ctx.fillStyle = "#a8bfd1"; ctx.fillRect(235, 438, 158, 48);
      ctx.fillStyle = "#516c86"; ctx.fillRect(215, 453, 20, 47); ctx.fillRect(393, 453, 20, 47);
      ctx.fillStyle = "#e7e6dc"; ctx.fillRect(248, 447, 44, 29); ctx.fillRect(300, 447, 44, 29);
    } else if (item.kind === "rug") {
      ctx.fillStyle = "#8b6c9b"; ctx.fillRect(490, 475, 275, 96);
      ctx.fillStyle = "#d5b7d9"; ctx.fillRect(502, 487, 251, 72);
      ctx.fillStyle = "#9c79aa"; ctx.fillRect(520, 505, 215, 36);
    } else if (item.kind === "lamp") {
      ctx.fillStyle = "#74513a"; ctx.fillRect(1035, 440, 9, 65);
      ctx.fillStyle = "#f2d98c"; ctx.fillRect(1010, 420, 60, 28);
      ctx.fillStyle = "rgba(255,225,143,.18)"; ctx.beginPath(); ctx.arc(1040, 445, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#74513a"; ctx.fillRect(1020, 504, 38, 7);
    } else if (item.kind === "bookcase") {
      ctx.fillStyle = "#684832"; ctx.fillRect(920, 190, 115, 155);
      ctx.fillStyle = "#c08a59"; ctx.fillRect(928, 197, 99, 7);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 6; col++) {
          ctx.fillStyle = ["#b86e5c", "#7c8fbd", "#d0b36b", "#6b9b79", "#9f74a7"][(row + col) % 5];
          ctx.fillRect(933 + col * 15, 210 + row * 42, 10, 32);
        }
      }
    } else if (item.kind === "plant") {
      ctx.fillStyle = "#a66b4e"; ctx.fillRect(430, 338, 42, 33);
      ctx.fillStyle = "#426f47"; ctx.fillRect(448, 285, 8, 55);
      ctx.fillStyle = "#5e9e65"; ctx.fillRect(414, 300, 34, 19); ctx.fillRect(455, 280, 35, 18);
      ctx.fillStyle = "#83bd76"; ctx.fillRect(440, 268, 28, 25);
    } else if (item.kind === "table") {
      ctx.fillStyle = "#755238"; ctx.fillRect(650, 430, 110, 12);
      ctx.fillStyle = "#bd8d5c"; ctx.fillRect(645, 420, 120, 14);
      ctx.fillStyle = "#6b4b31"; ctx.fillRect(655, 442, 9, 45); ctx.fillRect(747, 442, 9, 45);
      ctx.fillStyle = "#f3e0bd"; ctx.fillRect(680, 409, 42, 9);
    }
  }
}

function addTownItem(item, amount = 1) {
  if (Object.prototype.hasOwnProperty.call(save.inventory, item)) save.inventory[item] = Math.max(0, save.inventory[item] + amount);
}
function hasTownItems(cost) { return Object.entries(cost).every(([item, amount]) => (save.inventory[item] || 0) >= amount); }
function spendTownItems(cost) {
  if (!hasTownItems(cost)) return false;
  Object.entries(cost).forEach(([item, amount]) => addTownItem(item, -amount));
  return true;
}
function awardWorldXp(amount) {
  save.xp = Math.max(0, Math.floor(Number(save.xp) || 0)) +
    Math.max(0, Math.floor(Number(amount) || 0));
}
function rewardTown(coins, xp = 0, progress = 0) {
  save.coins += coins;
  if (xp) awardWorldXp(xp);
  save.townProgress = Math.min(100, save.townProgress + progress);
  persist(true);
  updateHud();
}
updateHud = function updateTownHud() {
  const job = jobs.find(item => item.id === save.job);
  $("playerName").textContent = player.name;
  $("playerJob").textContent = job ? job.name : "New Resident";
  $("avatarInitial").textContent = player.name.slice(0, 1).toUpperCase();
  $("coinCount").textContent = Math.floor(save.coins).toLocaleString("en-US");
  const levelProgress = getWorldLevelProgress(save.xp);
  $("xpLabel").textContent = levelProgress.current + " / " + levelProgress.needed + " XP";
  $("xpBar").style.width = levelProgress.percent + "%";
  $("townProgressBar").style.width = save.townProgress + "%";
  $("townProgressLabel").textContent = save.townProgress + "%";
  $("townLevel").textContent = String(levelProgress.level).padStart(2, "0");
  $("chooseJobButton").textContent = job ? "CHANGE PROFESSION" : "CHOOSE A PROFESSION";
  const hints = {
    farmer: "🌾 Farmer: at Stellar Farm, press E to plant, water three times, then harvest rice.",
    barista: "☕ Barista: enter Little Comet Café. Brew coffee beans, then serve each cup for coins.",
    builder: "🧱 Builder: collect wood and stone, then build a bench at Star Workshop.",
    librarian: "📚 Librarian: enter Stellar Library and sort books at the desk.",
    explorer: "💎 Explorer: find glowing star shards around the valley and exchange them at the Observatory.",
    artist: "🎨 Artist: use dye at the Town Hall mural canvas to decorate the town."
  };
  $("taskHint").textContent = job ? hints[job.id] : "Choose a profession, meet the townsfolk, and try a little task.";
  const grid = $("inventoryGrid");
  if (grid) {
    grid.replaceChildren();
    INVENTORY_ITEMS.forEach(item => {
      const tile = document.createElement("div"); tile.className = "inventory-item";
      const icon = document.createElement("span"); icon.className = "inventory-icon"; icon.textContent = item.icon;
      const label = document.createElement("span"); label.className = "inventory-label"; label.textContent = item.label;
      const count = document.createElement("strong"); count.textContent = String(save.inventory[item.key] || 0);
      tile.append(icon, label, count); grid.append(tile);
    });
  }
};
updateCamera = function updateTownCamera() {
  if (insideBuilding) { camera.x = 0; camera.y = 0; return; }
  camera.x = Math.max(0, Math.min(MAP_PIXEL_W - VIEW_W, player.x - VIEW_W / 2));
  camera.y = Math.max(0, Math.min(MAP_PIXEL_H - VIEW_H, player.y - VIEW_H / 2));
};
function plotKey(plot) { return plot.x + "," + plot.y; }
function getPlotState(plot) {
  const key = plotKey(plot);
  if (!save.plots[key]) save.plots[key] = { planted: false, waterings: 0 };
  return save.plots[key];
}
function nearestFarmPlot(maxDistance = 48) {
  let nearest = null;
  for (const plot of farmPlots) {
    const distance = Math.hypot(player.x - (plot.x + .5) * TILE, player.y - (plot.y + .5) * TILE);
    if (distance < maxDistance && (!nearest || distance < nearest.distance)) nearest = { ...plot, distance };
  }
  return nearest;
}
function nearestTownNpc(maxDistance = 58) {
  let nearest = null;
  for (const npc of townNPCs) {
    const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (distance < maxDistance && (!nearest || distance < nearest.distance)) nearest = { ...npc, distance };
  }
  return nearest;
}
function nearestTownResource(maxDistance = 55) {
  let nearest = null;
  for (const item of resourceSpots) {
    if (save.gathered.includes(item.id)) continue;
    const distance = Math.hypot(player.x - item.x, player.y - item.y);
    if (distance < maxDistance && (!nearest || distance < nearest.distance)) nearest = { ...item, distance };
  }
  return nearest;
}
nearbyBuilding = function nearbyTownBuilding() {
  if (insideBuilding) return null;
  let nearest = null, best = 90;
  for (const building of buildings) {
    const cx = (building.x + building.w / 2) * TILE;
    const cy = (building.y + building.h) * TILE + 8;
    const distance = Math.hypot(player.x - cx, player.y - cy);
    if (distance < best) { best = distance; nearest = building; }
  }
  return nearest;
};
function isTownDoorway(x, y, building) {
  const cx = (building.x + building.w / 2) * TILE;
  const bottom = (building.y + building.h) * TILE;
  return Math.abs(x - cx) < 18 && y > bottom - 34 && y < bottom + 18;
}
isSolidAt = function isTownSolidAt(x, y) {
  if (insideBuilding) return x < 105 || x > VIEW_W - 105 || y < 145 || y > VIEW_H - 95;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (x < TILE || y < TILE || x > MAP_PIXEL_W - TILE || y > MAP_PIXEL_H - TILE || terrainAt(tx, ty) === "water") return true;
  for (const b of buildings) {
    if (b.id === "moon-garden" && !isWorldBuildingUnlocked(b)) continue;
    if (x >= b.x * TILE - 4 && x <= (b.x + b.w) * TILE + 4 &&
        y - 7 >= b.y * TILE - 4 && y - 7 <= (b.y + b.h) * TILE + 4 &&
        !isTownDoorway(x, y - 7, b)) return true;
  }
  for (const tree of treeSpots) {
    if (Math.abs(tree.x - x) < 24 && Math.abs(tree.y - y) < 26 && Math.hypot(tree.x - x, tree.y - y + 11) < 23) return true;
  }
  for (let i = 0; i < Math.min(save.benches, 5); i++) {
    if (Math.abs(x - (44 + i * 2) * TILE) < 20 && Math.abs(y - 34 * TILE) < 20) return true;
  }
  return false;
};
movePlayer = function moveTownPlayer(dx, dy) {
  if (!requireWorldMember() || (!dx && !dy)) return;
  const length = Math.hypot(dx, dy) || 1;
  const speed = insideBuilding ? 190 : 178;
  const mx = (dx / length) * speed * deltaSeconds;
  const my = (dy / length) * speed * deltaSeconds;
  let moved = false;
  if (!isSolidAt(player.x + mx, player.y)) { player.x += mx; moved = true; }
  if (!isSolidAt(player.x, player.y + my)) { player.y += my; moved = true; }
  if (moved) {
    player.moving = true;
    player.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    updateCamera();
    if (!insideBuilding && (Math.floor(player.x / TILE) !== lastTileX || Math.floor(player.y / TILE) !== lastTileY)) {
      lastTileX = Math.floor(player.x / TILE); lastTileY = Math.floor(player.y / TILE);
      updateHud(); persist(true);
    }
  }
};
function enterTownBuilding(building) {
  if (!building || !interiorRooms[building.id]) { showToast("This place is still being prepared."); return; }
  outsidePosition = { x: player.x, y: player.y, direction: player.direction };
  insideBuilding = building.id;
  player.x = VIEW_W / 2; player.y = VIEW_H - 170; player.direction = "up"; player.moving = false;
  updateCamera(); updateWorldHud(); showToast("Entered " + building.name + " · Find the glowing station!");
}
function leaveTownBuilding() {
  insideBuilding = null;
  if (outsidePosition) { player.x = outsidePosition.x; player.y = outsidePosition.y; player.direction = outsidePosition.direction || "down"; }
  outsidePosition = null; updateCamera(); persist(true); showToast("Back outside · Keep exploring!");
}
function drawTownInterior(time) {
  const room = interiorRooms[insideBuilding] || interiorRooms.home;
  const homeTheme = insideBuilding === "home"
    ? HOME_THEMES.find(theme => theme.id === save.homeTheme)
    : null;
  const roomWall = homeTheme ? homeTheme.wall : room.wall;
  const roomFloor = homeTheme ? homeTheme.floor : room.floor;
  ctx.fillStyle = "#47372b"; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = roomWall; ctx.fillRect(35, 30, VIEW_W - 70, 112);
  ctx.fillStyle = shadeColor(room.wall, -20); ctx.fillRect(35, 132, VIEW_W - 70, 12);
  ctx.fillStyle = "#8c7052"; ctx.fillRect(75, 60, 135, 48); ctx.fillRect(VIEW_W - 210, 60, 135, 48);
  ctx.fillStyle = "#b5d4d1"; ctx.fillRect(82, 66, 121, 36); ctx.fillRect(VIEW_W - 203, 66, 121, 36);
  ctx.fillStyle = roomFloor; ctx.fillRect(35, 144, VIEW_W - 70, VIEW_H - 180);
  for (let y = 152; y < VIEW_H - 42; y += 34) for (let x = 42; x < VIEW_W - 42; x += 42) {
    ctx.fillStyle = ((x / 42 + y / 34) % 2 < 1) ? "rgba(255,236,190,.055)" : "rgba(66,45,31,.045)";
    ctx.fillRect(x, y, 40, 32);
  }
  // Distinct furniture for each interior type.
  if (insideBuilding === "library") {
    for (let x = 150; x < 390; x += 112) {
      ctx.fillStyle = "#684832"; ctx.fillRect(x, 190, 82, 164);
      ctx.fillStyle = "#a67851"; ctx.fillRect(x + 5, 196, 72, 7);
      for (let j = 0; j < 5; j++) { ctx.fillStyle = ["#b86e5c", "#7c8fbd", "#d0b36b", "#6b9b79"][j % 4]; ctx.fillRect(x + 11 + j * 12, 210, 8, 38); ctx.fillRect(x + 11 + j * 12, 264, 8, 38); }
    }
    ctx.fillStyle = "#745137"; ctx.fillRect(550, 285, 240, 48);
    ctx.fillStyle = "#d0aa71"; ctx.fillRect(558, 280, 224, 12);
  } else if (insideBuilding === "cafe" || insideBuilding === "bakery") {
    ctx.fillStyle = "#6a4735"; ctx.fillRect(760, 210, 300, 90);
    ctx.fillStyle = "#d49a6b"; ctx.fillRect(750, 202, 320, 18);
    for (const x of [210, 420, 560]) { ctx.fillStyle = "#81563c"; ctx.fillRect(x, 315, 104, 58); ctx.fillStyle = "#d8b486"; ctx.fillRect(x + 7, 307, 90, 48); ctx.fillStyle = "#76513e"; ctx.fillRect(x + 38, 354, 22, 42); }
  } else if (insideBuilding === "workshop") {
    ctx.fillStyle = "#684b32"; ctx.fillRect(740, 230, 315, 125); ctx.fillStyle = "#bc8c55"; ctx.fillRect(730, 220, 335, 25);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = "#d2b37b"; ctx.fillRect(770 + i * 48, 265, 28, 45); }
    ctx.fillStyle = "#60442e"; ctx.fillRect(180, 250, 170, 100);
  } else if (insideBuilding === "townhall") {
    ctx.fillStyle = "#8e5642"; ctx.fillRect(820, 190, 220, 180);
    ctx.fillStyle = "#f0d5a6"; ctx.fillRect(840, 210, 180, 136);
    ctx.fillStyle = "#6c8d72"; ctx.fillRect(865, 235, 130, 86);
    for (let i = 0; i < Math.min(save.murals, 5); i++) { ctx.fillStyle = ["#e7a36d", "#88b7a1", "#9285c4", "#dfcc7d", "#c67b8a"][i]; ctx.fillRect(875 + i * 19, 250 + (i % 2) * 13, 15, 18); }
  } else if (insideBuilding === "market") {
    ctx.fillStyle = "#73513a"; ctx.fillRect(760, 225, 300, 100); ctx.fillStyle = "#e4c387"; ctx.fillRect(750, 215, 320, 20);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ["#cf805f", "#7a9b72", "#d5b46b"][i % 3]; ctx.fillRect(785 + i * 42, 254, 24, 34); }
  } else if (insideBuilding === "home") {
    ctx.fillStyle = "#e2c5a0"; ctx.fillRect(170, 205, 240, 120); ctx.fillStyle = "#7d8fab"; ctx.fillRect(180, 215, 220, 90); ctx.fillStyle = "#f3e4c4"; ctx.fillRect(190, 222, 200, 70);
    ctx.fillStyle = "#78563e"; ctx.fillRect(770, 300, 150, 54);
    drawHomeFurniture();
  } else if (insideBuilding === "fashion") {
    ctx.fillStyle = "#7c4e69"; ctx.fillRect(170, 215, 300, 34);
    ctx.fillStyle = "#e1b9cf"; ctx.fillRect(160, 207, 320, 14);
    for (let i = 0; i < 4; i++) {
      const x = 205 + i * 215;
      ctx.fillStyle = "#76506a"; ctx.fillRect(x, 255, 12, 135);
      ctx.fillStyle = ["#e968ad", "#a578ce", "#6d9fce", "#dc9061"][i];
      ctx.fillRect(x - 32, 280, 76, 68);
      ctx.fillStyle = "#f3d6e4"; ctx.fillRect(x - 22, 288, 56, 10);
      ctx.fillStyle = "#67445e"; ctx.fillRect(x - 25, 348, 8, 30); ctx.fillRect(x + 22, 348, 8, 30);
    }
    ctx.fillStyle = "#6b435b"; ctx.fillRect(745, 220, 290, 78);
    ctx.fillStyle = "#f0c8dc"; ctx.fillRect(735, 210, 310, 17);
    ctx.fillStyle = "#fff1f7"; ctx.font = "bold 14px Ubuntu"; ctx.textAlign = "center";
    ctx.fillText("STELLARS FASHION", 890, 258); ctx.textAlign = "left";
  } else if (insideBuilding === "observatory") {
    ctx.fillStyle = "#4c527d"; ctx.beginPath(); ctx.arc(650, 285, 130, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9d9a9"; ctx.beginPath(); ctx.arc(650, 285, 106, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7a78a3"; ctx.beginPath(); ctx.arc(650, 285, 86, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) { ctx.fillStyle = "#fff0b7"; ctx.fillRect(580 + (i * 37) % 140, 220 + (i * 23) % 130, 4, 4); }
  }
  const station = room.station;
  ctx.fillStyle = "rgba(255,232,150,.18)"; ctx.beginPath(); ctx.arc(station.x, station.y + 25, 72 + Math.sin(time / 350) * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f1db9a"; ctx.fillRect(station.x - 64, station.y + 22, 128, 12);
  ctx.fillStyle = "#725038"; ctx.fillRect(station.x - 57, station.y + 34, 12, 28); ctx.fillRect(station.x + 45, station.y + 34, 12, 28);
  ctx.fillStyle = "#fff6d8"; ctx.font = "bold 11px Ubuntu"; ctx.textAlign = "center"; ctx.fillText(station.label, station.x, station.y + 13);
  ctx.fillStyle = "#493323"; ctx.fillRect(590, 640, 100, 60); ctx.fillStyle = "#d6b06e"; ctx.fillRect(600, 640, 80, 8);
  ctx.fillStyle = "#fff0c5"; ctx.font = "bold 10px Ubuntu"; ctx.fillText("EXIT · E", 640, 628);
  ctx.textAlign = "left"; ctx.fillStyle = "#fff8e7"; ctx.font = "bold 17px Ubuntu";
  ctx.fillText((buildings.find(item => item.id === insideBuilding) || { name: "STELLARS ROOM" }).name, 62, 176);
  ctx.fillStyle = "rgba(45,32,24,.7)"; ctx.fillRect(60, 682, 1160, 25);
  ctx.fillStyle = "#f8edce"; ctx.font = "10px Ubuntu"; ctx.fillText("Walk around · Visit the glowing station · Press E to use it or leave", 76, 699);
}
function drawTownFarm() {
  for (const plot of farmPlots) {
    const sx = plot.x * TILE - camera.x, sy = plot.y * TILE - camera.y;
    if (sx < -TILE || sx > VIEW_W || sy < -TILE || sy > VIEW_H) continue;
    const state = getPlotState(plot);
    ctx.fillStyle = "#987247"; ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "#644c34"; ctx.fillRect(sx + 5, sy + 7, TILE - 10, TILE - 12);
    ctx.fillStyle = "#b28a56"; for (let i = 0; i < 3; i++) ctx.fillRect(sx + 8, sy + 9 + i * 6, TILE - 16, 2);
    if (state.planted) {
      const mature = Number(state.waterings) >= 3, height = mature ? 17 : 4 + Number(state.waterings || 0) * 4;
      ctx.fillStyle = mature ? "#d3bc69" : "#6ba64d";
      for (let i = 0; i < 3; i++) { const px = sx + 9 + i * 7; ctx.fillRect(px, sy + 23 - height, 3, height); ctx.fillRect(px - 3, sy + 20 - height, 4, 3); }
      if (mature) { ctx.fillStyle = "#f6e4a4"; ctx.fillRect(sx + 7, sy + 4, 3, 5); ctx.fillRect(sx + 17, sy + 3, 3, 5); }
    } else { ctx.fillStyle = "#d4b178"; ctx.fillRect(sx + 13, sy + 14, 6, 3); }
  }
  const sx = 79 * TILE - camera.x, sy = 43 * TILE - camera.y;
  if (sx > -80 && sx < VIEW_W + 80 && sy > -40 && sy < VIEW_H + 40) {
    ctx.fillStyle = "#754c2d"; ctx.fillRect(sx, sy, 4, 38); ctx.fillStyle = "#e3c47b"; ctx.fillRect(sx - 26, sy - 12, 66, 20);
    ctx.fillStyle = "#60482d"; ctx.font = "bold 9px Ubuntu"; ctx.textAlign = "center"; ctx.fillText("STELLAR FARM", sx + 7, sy + 2); ctx.textAlign = "left";
  }
}
function drawTownResources() {
  for (const spot of resourceSpots) {
    if (save.gathered.includes(spot.id)) continue;
    const x = spot.x - camera.x, y = spot.y - camera.y;
    if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) continue;
    const colors = { wood: "#d8b17a", stone: "#c2d0d3", starShard: "#b8b2ff" };
    ctx.fillStyle = "rgba(255,246,190,.25)"; ctx.beginPath(); ctx.arc(x, y, 15 + Math.sin(performance.now() / 240 + x) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors[spot.item] || "#fff"; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff8d4"; ctx.fillRect(x - 2, y - 4, 3, 3);
  }
}
function drawTownBenches() {
  for (let i = 0; i < Math.min(save.benches, 5); i++) {
    const x = (44 + i * 2) * TILE - camera.x, y = 34 * TILE - camera.y;
    ctx.fillStyle = "rgba(35,39,26,.25)"; ctx.fillRect(x - 15, y + 11, 31, 6);
    ctx.fillStyle = "#855b37"; ctx.fillRect(x - 16, y - 4, 32, 8);
    ctx.fillStyle = "#c18a52"; ctx.fillRect(x - 16, y - 8, 32, 7);
    ctx.fillStyle = "#68482e"; ctx.fillRect(x - 12, y + 2, 4, 10); ctx.fillRect(x + 8, y + 2, 4, 10);
  }
}
drawEntity = function drawTownEntity(entity, time) {
  if (entity.kind === "tree") drawTree(entity);
  else if (entity.kind === "building") drawBuilding(entity.data);
  else drawCharacter(entity, entity.uid === player.uid, time);
};
drawWorld = function drawTownWorld(time) {
  if (!canPlayWorld) return;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (insideBuilding) {
    drawTownInterior(time);
    renderablePlayers().forEach(person => drawCharacter(person, person.uid === player.uid, time));
    const staff = indoorStaff[insideBuilding];
    if (staff) drawCharacter({ ...staff, uid: "staff-" + insideBuilding, direction: "down", moving: false }, false, time);
    updateWorldHud(); return;
  }
  drawGround(time); drawTownFarm(); drawTownResources(); drawTownBenches();
  const entities = [];
  treeSpots.forEach(tree => {
    if (tree.x >= camera.x - 90 && tree.x <= camera.x + VIEW_W + 90 && tree.y >= camera.y - 110 && tree.y <= camera.y + VIEW_H + 50) entities.push(tree);
  });
  buildings.forEach(data => entities.push({ kind: "building", y: (data.y + data.h) * TILE, x: (data.x + data.w / 2) * TILE, data }));
  townNPCs.forEach(npc => entities.push({ ...npc, uid: "npc-" + npc.id, direction: "down", moving: false, kind: "npc", y: npc.y }));
  renderablePlayers().forEach(person => entities.push({ ...person, kind: "player" }));
  entities.sort((a, b) => a.y - b.y).forEach(entity => drawEntity(entity, time));
  updateWorldHud();
};
areaName = function townAreaName(x, y) {
  if (insideBuilding) return (buildings.find(item => item.id === insideBuilding) || { name: "INDOORS" }).name.toUpperCase();
  const tx = x / TILE, ty = y / TILE;
  if (tx > 76 && tx < 89 && ty > 41 && ty < 53) return "STELLAR FARM";
  if (tx > 106 && ty > 31 && ty < 47) return "OBSERVATORY HILL";
  if (tx > 62 && tx < 80 && ty > 20 && ty < 34) return "WORKSHOP LANE";
  if (tx > 65 && tx < 82 && ty > 61 && ty < 75) return "SUNRISE CORNER";
  if (tx > 46 && ty > 18 && ty < 29) return "LITTLE COMET CAFE";
  if (tx > 56 && tx < 65 && ty > 31 && ty < 40) return "STELLAR FASHION HOUSE";
  if (tx > 122 && ty > 81) return "MOON GARDEN GATE";
  if (tx > 33 && ty < 19) return "TOWN SQUARE";
  if (tx < 30 && ty < 25) return "STELLAR LIBRARY";
  if (tx > 45 && ty > 30 && ty < 42) return "STAR MARKET";
  if (tx > 26 && tx < 39 && ty > 31 && ty < 41) return "RESIDENTIAL LANE";
  if (riverDistance(Math.floor(tx), Math.floor(ty)) < 2.2) return "RIVERSIDE";
  if (tx > 88 && ty > 55) return "SOUTHERN VALLEY";
  if (tx > 90) return "EASTERN WOODS";
  if (ty > 70) return "SOUTHERN MEADOW";
  return "TOWN OUTSKIRTS";
};
updateWorldHud = function updateTownWorldHud() {
  $("worldCoords").textContent = insideBuilding ? "INDOORS" : String(Math.floor(player.x / TILE)).padStart(2, "0") + " : " + String(Math.floor(player.y / TILE)).padStart(2, "0");
  $("areaTag").textContent = areaName(player.x, player.y);
  if (insideBuilding) {
    const room = interiorRooms[insideBuilding];
    const atStation = Math.hypot(player.x - room.station.x, player.y - room.station.y) < 108;
    const atExit = Math.hypot(player.x - 640, player.y - 655) < 105;
    $("interactionPrompt").textContent = atStation ? "E · " + room.station.label : atExit ? "E · LEAVE BUILDING" : "Explore the room · Find the glowing station";
    return;
  }
  const plot = nearestFarmPlot(), resource = nearestTownResource(), npc = nearestTownNpc(), building = nearbyBuilding();
  if (plot) {
    const state = getPlotState(plot);
    $("interactionPrompt").textContent = !state.planted ? "E · PLANT RICE SEED" : Number(state.waterings) < 3 ? "E · WATER RICE (" + Number(state.waterings || 0) + "/3)" : "E · HARVEST RICE";
  } else if (resource) $("interactionPrompt").textContent = "E · COLLECT " + resource.item.toUpperCase();
  else if (npc) $("interactionPrompt").textContent = "E · TALK TO " + npc.name.toUpperCase();
  else if (building) $("interactionPrompt").textContent = "E · ENTER " + building.name.toUpperCase();
  else $("interactionPrompt").textContent = "✦ Explore the valley · Meet townsfolk · Find glowing items";
};
function talkTownNpc(npc) {
  if (!save.npcRewards[npc.id]) {
    save.npcRewards[npc.id] = true;
    Object.entries(npc.reward || {}).forEach(([item, amount]) => addTownItem(item, amount));
    awardWorldXp(4); persist(true); updateHud();
    const gift = Object.entries(npc.reward || {}).map(([item, amount]) => {
      const meta = INVENTORY_ITEMS.find(entry => entry.key === item);
      return "+" + amount + " " + (meta ? meta.label : item);
    }).join(", ");
    showToast(npc.name + ": " + npc.message + (gift ? " Gift: " + gift : ""));
  } else showToast(npc.name + ": " + npc.message);
}
function tendRicePlot(plot) {
  if (save.job !== "farmer") { showToast("Choose Farmer to work the Stellar Farm plots."); return; }
  const state = getPlotState(plot);
  if (!state.planted) {
    if (!spendTownItems({ riceSeed: 1 })) { showToast("No rice seeds left. Visit Star Market."); return; }
    state.planted = true; state.waterings = 0; showToast("Rice planted! Press E to water it.");
  } else if (Number(state.waterings) < 3) {
    state.waterings = Number(state.waterings || 0) + 1; showToast("Rice watered · " + state.waterings + "/3");
  } else {
    state.planted = false; state.waterings = 0; addTownItem("rice", 3); rewardTown(8, 8, 2);
    showToast("Rice harvested! +3 Rice · +8 Star Coins"); return;
  }
  persist(true); updateHud();
}
function collectTownResource(resource) {
  save.gathered.push(resource.id); addTownItem(resource.item, resource.amount); awardWorldXp(3);
  persist(true); updateHud();
  const label = (INVENTORY_ITEMS.find(item => item.key === resource.item) || {}).label || resource.item;
  showToast("Collected " + resource.amount + " " + label + "!");
}
function useTownWorkstation() {
  if (insideBuilding === "cafe") {
    if (save.job !== "barista") { showToast("Choose Barista to work behind this counter."); return; }
    if (save.inventory.coffee > 0) { spendTownItems({ coffee: 1 }); rewardTown(18, 10, 2); showToast("Coffee served! +18 Star Coins · +10 XP"); }
    else if (spendTownItems({ coffeeBeans: 1 })) { addTownItem("coffee", 1); rewardTown(0, 3, 0); showToast("Fresh coffee brewed! Serve it for coins."); }
    else showToast("No coffee beans left. Buy supplies at Star Market.");
  } else if (insideBuilding === "library") {
    if (save.job !== "librarian") { showToast("Choose Librarian to use the sorting desk."); return; }
    if (!spendTownItems({ books: 1 })) { showToast("No books to sort. Talk to Theo or visit the market."); return; }
    rewardTown(14, 10, 2); showToast("Books sorted and shelved! +14 Star Coins · +10 XP");
  } else if (insideBuilding === "workshop") {
    if (save.job !== "builder") { showToast("Choose Builder to use the construction bench."); return; }
    if (save.benches >= 5) { showToast("Town Square already has five new benches."); return; }
    if (!spendTownItems({ wood: 2, stone: 1 })) { showToast("A bench needs 2 Wood and 1 Stone. Explore the valley for materials."); return; }
    save.benches++; rewardTown(10, 12, 10); showToast("Bench built and added to Town Square! +10 Star Coins · +12 XP");
  } else if (insideBuilding === "townhall") {
    if (save.job !== "artist") { showToast("Choose Artist to paint the Town Hall mural."); return; }
    if (save.murals >= 5) { showToast("The mural wall is complete!"); return; }
    if (!spendTownItems({ dye: 1 })) { showToast("No dye left. Pick up a supply bundle at Star Market."); return; }
    save.murals++; rewardTown(15, 10, 8); showToast("A new mural is on the wall! +15 Star Coins · +10 XP");
  } else if (insideBuilding === "observatory") {
    if (save.job !== "explorer") { showToast("Choose Explorer to study star fragments here."); return; }
    if (!spendTownItems({ starShard: 1 })) { showToast("Find glowing Star Shards around the valley first."); return; }
    rewardTown(22, 14, 4); showToast("Star fragment recorded! +22 Star Coins · +14 XP");
  } else if (insideBuilding === "market") {
    openFurnitureShop("shop");
  } else if (insideBuilding === "home") {
    openFurnitureShop("home");
  } else if (insideBuilding === "fashion") {
    openFashionShop();
  } else if (insideBuilding === "bakery") {
    if (spendTownItems({ rice: 1 })) { rewardTown(10, 5, 1); showToast("Rice traded! +10 Star Coins."); }
    else showToast("Bring harvested rice here to trade it for coins.");
  }
}
interact = function interactWithTown() {
  if (!requireWorldMember()) return;
  if (insideBuilding) {
    if (Math.hypot(player.x - 640, player.y - 655) < 105) { leaveTownBuilding(); return; }
    const station = interiorRooms[insideBuilding].station;
    if (Math.hypot(player.x - station.x, player.y - station.y) < 108) { useTownWorkstation(); return; }
    showToast("Walk closer to the glowing station or the EXIT door."); return;
  }
  const plot = nearestFarmPlot();
  if (plot) { tendRicePlot(plot); return; }
  const resource = nearestTownResource();
  if (resource) { collectTownResource(resource); return; }
  const npc = nearestTownNpc();
  if (npc) { talkTownNpc(npc); return; }
  const building = nearbyBuilding();
  if (building) { enterTownBuilding(building); return; }
  showToast("Find a person, glowing item, farm plot, or building door to interact with.");
};


// Action tracking wrappers are deliberately local and run after existing game logic.
const collectTownResourceBeforeQuests = collectTownResource;
collectTownResource = function collectTownResourceWithQuests(resource) {
  collectTownResourceBeforeQuests(resource);
  trackQuestAction("collect");
  checkWorldAchievements();
};
const talkTownNpcBeforeQuests = talkTownNpc;
talkTownNpc = function talkTownNpcWithQuests(npc) {
  talkTownNpcBeforeQuests(npc);
  trackQuestAction("talk");
  checkWorldAchievements();
};
const tendRicePlotBeforeQuests = tendRicePlot;
tendRicePlot = function tendRicePlotWithQuests(plot) {
  const oldRice = Number(save.inventory.rice) || 0;
  tendRicePlotBeforeQuests(plot);
  const harvested = (Number(save.inventory.rice) || 0) > oldRice;
  if (harvested) {
    if (hasProfessionSkill("farmer-seed")) addTownItem("rice", 1);
    trackQuestAction("harvest");
    checkWorldAchievements();
    persist(true);
    updateHud();
  }
};
const enterTownBuildingBeforeQuests = enterTownBuilding;
enterTownBuilding = function enterTownBuildingWithQuests(building) {
  enterTownBuildingBeforeQuests(building);
  if (insideBuilding) {
    trackQuestAction("visit");
  }
};


// ── LIVE MULTIPLAYER PRESENCE (Firebase Realtime Database) ──────────────────
const WORLD_MEMBER_ALLOWLIST = "worldMembers";
const WORLD_PLAYER_PATH = "worldPlayers";
const PRESENCE_SEND_INTERVAL = 850;
const PRESENCE_HEARTBEAT_INTERVAL = 12000;
const PRESENCE_STALE_AFTER = 30000;
let worldPresenceRef = null;
let worldPresenceUnsubscribe = null;
let worldPresenceReady = false;
let worldPresencePending = false;
let lastPresenceWriteAt = 0;
let lastPresenceState = null;
let multiplayerSequence = 0;

function setWorldNetworkStatus(label, onlineCount) {
  const status = $("worldNetworkStatus"), count = $("worldOnlineCount");
  if (status) status.textContent = label;
  if (count && Number.isFinite(onlineCount)) count.textContent = onlineCount + (onlineCount === 1 ? " STAR ONLINE" : " STARS ONLINE");
}
function currentWorldPresence() {
  return {
    uid: player.uid, name: firstName(player.name),
    x: Math.round(player.x * 10) / 10, y: Math.round(player.y * 10) / 10,
    direction: ["up", "down", "left", "right"].includes(player.direction) ? player.direction : "down",
    moving: player.moving === true, job: typeof save.job === "string" ? save.job : "",
    gender: save.gender === "female" ? "female" : "male",
    shirtColor: isSafeWorldColor(save.shirtColor) ? save.shirtColor : "#6687a7",
    area: insideBuilding || "outside"
  };
}
function presenceHasChanged(next) {
  if (!lastPresenceState) return true;
  return next.area !== lastPresenceState.area || next.direction !== lastPresenceState.direction ||
    next.moving !== lastPresenceState.moving || next.job !== lastPresenceState.job ||
    next.gender !== lastPresenceState.gender ||
    Math.hypot(next.x - lastPresenceState.x, next.y - lastPresenceState.y) >= 32;
}
async function startMultiplayer() {
  stopMultiplayer();
  const sequence = multiplayerSequence;
  if (!canPlayWorld || !player.uid || player.uid === "local-preview") {
    setWorldNetworkStatus("MEMBER ACCESS REQUIRED", 1); return;
  }
  setWorldNetworkStatus("CHECKING MEMBER ACCESS", 1);
  try {
    const membership = await databaseGet(databaseRef(realtimeDb, WORLD_MEMBER_ALLOWLIST + "/" + player.uid));
    if (sequence !== multiplayerSequence) return;
    if (membership.val() !== true) {
      setWorldNetworkStatus("WAITING FOR MEMBER SETUP", 1);
      showToast("Multiplayer needs the Super Admin member-list setup first."); return;
    }
    const myRef = databaseRef(realtimeDb, WORLD_PLAYER_PATH + "/" + player.uid);
    worldPresenceRef = myRef;
    await onDisconnect(myRef).remove();
    if (sequence !== multiplayerSequence) return;
    const remotePresenceRecords = new Map();
    const playersRootRef = databaseRef(realtimeDb, WORLD_PLAYER_PATH);
    const publishRemotePresence = () => {
      const now = Date.now();
      const players = [];
      remotePresenceRecords.forEach((person, uid) => {
        if (!person || !Number.isFinite(Number(person.updatedAt)) ||
            now - Number(person.updatedAt) > PRESENCE_STALE_AFTER) {
          remotePresenceRecords.delete(uid);
          return;
        }
        players.push(person);
      });
      window.STELLARSWorld.setRemotePlayers(players);
      setWorldNetworkStatus("WORLD LIVE", Math.max(1, players.length));
    };
    const acceptRemotePresence = snapshot => {
      const person = snapshot.val();
      if (!person || typeof person.uid !== "string" || person.uid !== snapshot.key) return;
      remotePresenceRecords.set(snapshot.key, person);
      publishRemotePresence();
    };
    const handlePresenceError = error => {
      console.warn("STELLARS World presence listener failed:", error);
      worldPresenceReady = false;
      setWorldNetworkStatus("CONNECTION ERROR", 1);
    };
    const stopChildListeners = [
      onChildAdded(playersRootRef, acceptRemotePresence, handlePresenceError),
      onChildChanged(playersRootRef, acceptRemotePresence, handlePresenceError),
      onChildRemoved(playersRootRef, snapshot => {
        remotePresenceRecords.delete(snapshot.key);
        publishRemotePresence();
      }, handlePresenceError)
    ];
    worldPresenceUnsubscribe = () => {
      stopChildListeners.forEach(unsubscribe => unsubscribe());
      remotePresenceRecords.clear();
    };
    await databaseSet(myRef, { ...currentWorldPresence(), updatedAt: serverTimestamp() });
    if (sequence !== multiplayerSequence) { await databaseRemove(myRef).catch(() => {}); return; }
    worldPresenceReady = true;
    lastPresenceWriteAt = performance.now();
    lastPresenceState = currentWorldPresence();
    setWorldNetworkStatus("WORLD LIVE", 1);
  } catch (error) {
    console.warn("Could not connect STELLARS World multiplayer:", error);
    if (sequence !== multiplayerSequence) return;
    if (worldPresenceUnsubscribe) { worldPresenceUnsubscribe(); worldPresenceUnsubscribe = null; }
    worldPresenceRef = null; worldPresenceReady = false; remotePlayers.clear();
    const message = String(error?.message || error);
    if (/permission|denied/i.test(message)) {
      setWorldNetworkStatus("MEMBER LIST SETUP NEEDED", 1);
      showToast("Your account is not in the multiplayer member list yet.");
    } else {
      setWorldNetworkStatus("DATABASE SETUP NEEDED", 1);
      showToast("Realtime Database still needs to be created and configured.");
    }
  }
}
function stopMultiplayer() {
  multiplayerSequence++;
  if (worldPresenceUnsubscribe) { worldPresenceUnsubscribe(); worldPresenceUnsubscribe = null; }
  if (worldPresenceRef) {
    const oldRef = worldPresenceRef; worldPresenceRef = null;
    void databaseRemove(oldRef).catch(() => {});
  }
  worldPresenceReady = false; worldPresencePending = false;
  lastPresenceState = null; lastPresenceWriteAt = 0; remotePlayers.clear();
  setWorldNetworkStatus(canPlayWorld ? "RECONNECTING…" : "MEMBER ACCESS REQUIRED", 1);
}
function syncWorldPresence(frameTime) {
  if (!worldPresenceReady || !worldPresenceRef || worldPresencePending || !canPlayWorld) return;
  const next = currentWorldPresence(), changed = presenceHasChanged(next);
  const heartbeatDue = frameTime - lastPresenceWriteAt >= PRESENCE_HEARTBEAT_INTERVAL;
  if (!changed && !heartbeatDue) return;
  if (frameTime - lastPresenceWriteAt < PRESENCE_SEND_INTERVAL) return;
  worldPresencePending = true; lastPresenceWriteAt = frameTime; lastPresenceState = next;
  databaseSet(worldPresenceRef, { ...next, updatedAt: serverTimestamp() })
    .catch(error => {
      console.warn("STELLARS World presence write failed:", error);
      worldPresenceReady = false; setWorldNetworkStatus("CONNECTION ERROR", 1);
    })
    .finally(() => { worldPresencePending = false; });
}



// ── LOCAL-FIRST WORLD EXPANSION DATA ────────────────────────────────────────
// All quests, achievements, profession data, and mini-game progress stay in
// this member's browser save. Firebase remains responsible for presence only.
DEFAULT_INVENTORY.fish = 0;
DEFAULT_INVENTORY.shell = 0;
if (!INVENTORY_ITEMS.some(item => item.key === "fish")) {
  INVENTORY_ITEMS.push({ key: "fish", label: "Fresh Fish", icon: "🐟" });
  INVENTORY_ITEMS.push({ key: "shell", label: "Seashells", icon: "🐚" });
}

const FASHION_HAIR_STYLES = [
  { id: "short", gender: "male", name: "Classic Short", icon: "✂" },
  { id: "wave", gender: "male", name: "Soft Waves", icon: "〰" },
  { id: "curly", gender: "male", name: "Curly Crop", icon: "✿" },
  { id: "long", gender: "female", name: "Long Flow", icon: "〰" },
  { id: "bob", gender: "female", name: "Little Bob", icon: "✂" },
  { id: "bun", gender: "female", name: "Star Bun", icon: "✦" }
];
const FASHION_ACCESSORIES = [
  { id: "none", name: "No Accessory", icon: "—" },
  { id: "starclip", name: "Star Clip", icon: "✦" },
  { id: "glasses", name: "Round Glasses", icon: "◉" },
  { id: "cap", name: "Comet Cap", icon: "⌂" },
  { id: "bow", name: "Ribbon Bow", icon: "🎀" }
];

function defaultHomeFurnitureLayout() {
  return {
    "starter-sofa": { x: 225, y: 430, rotation: 0 },
    "star-rug": { x: 490, y: 475, rotation: 0 },
    "moon-lamp": { x: 1010, y: 420, rotation: 0 },
    "bookcase": { x: 920, y: 190, rotation: 0 },
    "potted-plant": { x: 430, y: 268, rotation: 0 },
    "coffee-table": { x: 645, y: 420, rotation: 0 }
  };
}
function cloneDefaultHomeLayout() {
  return JSON.parse(JSON.stringify(defaultHomeFurnitureLayout()));
}
function getJakartaDayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = {};
  parts.forEach(part => { values[part.type] = part.value; });
  return values.year + "-" + values.month + "-" + values.day;
}

const worldReadSaveBeforeExpansion = readSave;
readSave = function readSaveWithExpandedProgress(key) {
  const base = worldReadSaveBeforeExpansion(key);
  const layoutDefaults = cloneDefaultHomeLayout();
  const rawLayout = base.homeLayout && typeof base.homeLayout === "object" ? base.homeLayout : {};
  const layout = {};
  (base.placedFurniture || ["starter-sofa"]).forEach(id => {
    const raw = rawLayout[id] && typeof rawLayout[id] === "object" ? rawLayout[id] : layoutDefaults[id];
    const fallback = layoutDefaults[id] || { x: 520, y: 420, rotation: 0 };
    layout[id] = {
      x: Math.max(130, Math.min(1130, Number.isFinite(Number(raw && raw.x)) ? Number(raw.x) : fallback.x)),
      y: Math.max(170, Math.min(610, Number.isFinite(Number(raw && raw.y)) ? Number(raw.y) : fallback.y)),
      rotation: Math.max(0, Math.min(3, Math.floor(Number(raw && raw.rotation) || 0)))
    };
  });

  const professionXp = {};
  const skillPoints = {};
  jobs.forEach(job => {
    professionXp[job.id] = Math.max(0, Math.floor(Number(base.professionXp && base.professionXp[job.id]) || 0));
    skillPoints[job.id] = Math.max(0, Math.floor(Number(base.skillPoints && base.skillPoints[job.id]) || 0));
  });
  const validHair = FASHION_HAIR_STYLES.some(style =>
    style.id === base.hairStyle && style.gender === (base.gender === "female" ? "female" : "male")
  );
  const defaultHair = base.gender === "female" ? "long" : "short";

  return {
    ...base,
    homeLayout: layout,
    homeExpansion: Math.max(0, Math.min(2, Math.floor(Number(base.homeExpansion) || 0))),
    professionXp,
    skillPoints,
    unlockedSkills: Array.isArray(base.unlockedSkills) ? [...new Set(base.unlockedSkills.filter(id =>
      Object.values(PROFESSION_SKILL_TREE).flat().some(skill => skill.id === id)
    ))] : [],
    achievements: Array.isArray(base.achievements) ? [...new Set(base.achievements)] : [],
    dailyQuestDate: typeof base.dailyQuestDate === "string" ? base.dailyQuestDate : "",
    dailyQuests: Array.isArray(base.dailyQuests) ? base.dailyQuests.filter(id =>
      DAILY_QUEST_POOL.some(quest => quest.id === id)
    ) : [],
    dailyQuestProgress: base.dailyQuestProgress && typeof base.dailyQuestProgress === "object" ? base.dailyQuestProgress : {},
    dailyQuestClaimed: base.dailyQuestClaimed && typeof base.dailyQuestClaimed === "object" ? base.dailyQuestClaimed : {},
    secretFinds: Array.isArray(base.secretFinds) ? [...new Set(base.secretFinds)] : [],
    fishCaught: Math.max(0, Math.floor(Number(base.fishCaught) || 0)),
    minigameStats: base.minigameStats && typeof base.minigameStats === "object" ? base.minigameStats : {},
    worldDay: Math.max(1, Math.floor(Number(base.worldDay) || 1)),
    worldMinutes: Math.max(0, Math.min(1439.99, Number(base.worldMinutes) || 540)),
    hairStyle: validHair ? base.hairStyle : defaultHair,
    accessory: ["none", "starclip", "glasses", "cap", "bow"].includes(base.accessory) ? base.accessory : "none",
    pantsColor: isSafeWorldColor(base.pantsColor) ? base.pantsColor : "#34465f",
    shoeColor: isSafeWorldColor(base.shoeColor) ? base.shoeColor : "#594331"
  };
};

// Daily missions are generated from the Jakarta calendar date, so every
// member receives the same three themes without a server-side scheduler.
const DAILY_QUEST_POOL = [
  { id: "gather-three", title: "Little Forager", description: "Collect resources three times.", action: "collect", target: 3, coins: 22, xp: 14 },
  { id: "say-hello", title: "Friendly Faces", description: "Talk to two townsfolk.", action: "talk", target: 2, coins: 20, xp: 14 },
  { id: "visit-places", title: "Town Wanderer", description: "Visit three different places.", action: "visit", target: 3, coins: 25, xp: 16 },
  { id: "honest-work", title: "A Little Day's Work", description: "Complete two profession tasks.", action: "work", target: 2, coins: 28, xp: 18 },
  { id: "harvest-rice", title: "Golden Harvest", description: "Harvest rice once.", action: "harvest", target: 1, coins: 24, xp: 16 },
  { id: "play-together", title: "Playful Star", description: "Finish a mini-game.", action: "minigame", target: 1, coins: 26, xp: 16 },
  { id: "find-secret", title: "Hidden in Plain Sight", description: "Find a secret star.", action: "secret", target: 1, coins: 32, xp: 20 }
];

const PROFESSION_SKILL_TREE = {
  farmer: [
    { id: "farmer-green", name: "Green Thumb", description: "Gain 10% more profession XP.", bonus: "xp" },
    { id: "farmer-golden", name: "Golden Harvest", description: "Earn 10% more Star Coins from work.", bonus: "coins" },
    { id: "farmer-seed", name: "Seed Saver", description: "Harvest one extra Rice.", bonus: "yield" }
  ],
  barista: [
    { id: "barista-pour", name: "Perfect Pour", description: "Gain 10% more profession XP.", bonus: "xp" },
    { id: "barista-tips", name: "Friendly Service", description: "Earn 10% more Star Coins from work.", bonus: "coins" },
    { id: "barista-blend", name: "Signature Blend", description: "Get one extra Coffee when serving.", bonus: "yield" }
  ],
  builder: [
    { id: "builder-craft", name: "Careful Craft", description: "Gain 10% more profession XP.", bonus: "xp" },
    { id: "builder-contract", name: "Good Contracts", description: "Earn 10% more Star Coins from work.", bonus: "coins" },
    { id: "builder-reuse", name: "Resourceful", description: "Occasionally recover one Wood.", bonus: "yield" }
  ],
  librarian: [
    { id: "librarian-study", name: "Deep Reader", description: "Gain 10% more profession XP.", bonus: "xp" },
    { id: "librarian-donation", name: "Community Shelf", description: "Earn 10% more Star Coins from work.", bonus: "coins" },
    { id: "librarian-rare", name: "Rare Edition", description: "Occasionally find one extra Book.", bonus: "yield" }
  ],
  explorer: [
    { id: "explorer-trail", name: "Trail Sense", description: "Gain 10% more profession XP.", bonus: "xp" },
    { id: "explorer-trade", name: "Relic Trader", description: "Earn 10% more Star Coins from work.", bonus: "coins" },
    { id: "explorer-shard", name: "Shard Finder", description: "Occasionally discover an extra Star Shard.", bonus: "yield" }
  ],
  artist: [
    { id: "artist-inspire", name: "Inspiration", description: "Gain 10% more profession XP.", bonus: "xp" },
    { id: "artist-commission", name: "Town Commissions", description: "Earn 10% more Star Coins from work.", bonus: "coins" },
    { id: "artist-palette", name: "Full Palette", description: "Occasionally recover one Dye.", bonus: "yield" }
  ]
};

const WORLD_ACHIEVEMENTS = [
  { id: "first-friend", title: "First Hello", description: "Talk to your first townsfolk.", reward: 15 },
  { id: "first-gather", title: "Forager", description: "Collect your first resource.", reward: 15 },
  { id: "five-gathers", title: "Field Collector", description: "Collect five resources.", reward: 25 },
  { id: "first-harvest", title: "Homegrown", description: "Harvest your first Rice.", reward: 20 },
  { id: "home-decorator", title: "Room to Bloom", description: "Place three pieces of furniture.", reward: 30 },
  { id: "first-mini-game", title: "Just One More Round", description: "Win your first mini-game.", reward: 25 },
  { id: "secret-star", title: "Stargazer", description: "Discover a hidden star.", reward: 35 },
  { id: "level-five", title: "Rising Star", description: "Reach World Level 5.", reward: 50 },
  { id: "home-expansion", title: "Room to Grow", description: "Expand your little home.", reward: 40 },
  { id: "angler", title: "Riverside Regular", description: "Catch five fish.", reward: 30 }
];

function ensureDailyQuests() {
  const today = getJakartaDayKey();
  if (save.dailyQuestDate === today && Array.isArray(save.dailyQuests) && save.dailyQuests.length) return;
  const seed = today.split("-").join("").split("").reduce((total, digit) => total + Number(digit), 0);
  const shuffled = [...DAILY_QUEST_POOL].sort((a, b) =>
    ((hash(seed, a.id.length, a.id.charCodeAt(0)) % 997) -
     (hash(seed, b.id.length, b.id.charCodeAt(0)) % 997))
  );
  save.dailyQuestDate = today;
  save.dailyQuests = shuffled.slice(0, 3).map(quest => quest.id);
  save.dailyQuestProgress = {};
  save.dailyQuestClaimed = {};
  persist(true);
}

function hasProfessionSkill(id) {
  return Array.isArray(save.unlockedSkills) && save.unlockedSkills.includes(id);
}
function getProfessionLevel(jobId = save.job) {
  return Math.max(1, Math.floor((Number(save.professionXp && save.professionXp[jobId]) || 0) / 100) + 1);
}
function getProfessionBonus(type) {
  const skills = PROFESSION_SKILL_TREE[save.job] || [];
  return skills.filter(skill => skill.bonus === type && hasProfessionSkill(skill.id)).length;
}
function awardWorldXp(amount) {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!safeAmount) return;
  const oldLevel = getWorldLevelProgress(save.xp).level;
  save.xp = Math.max(0, Math.floor(Number(save.xp) || 0)) + safeAmount;
  if (save.job) {
    const oldProfessionLevel = getProfessionLevel(save.job);
    save.professionXp[save.job] = Math.max(0, Number(save.professionXp[save.job]) || 0) + safeAmount;
    const newProfessionLevel = getProfessionLevel(save.job);
    if (newProfessionLevel > oldProfessionLevel) {
      save.skillPoints[save.job] = (save.skillPoints[save.job] || 0) + (newProfessionLevel - oldProfessionLevel);
      showToast(save.job.toUpperCase() + " LEVEL " + newProfessionLevel + " · SKILL POINT EARNED!");
    }
  }
  const newLevel = getWorldLevelProgress(save.xp).level;
  if (newLevel > oldLevel) showToast("✦ LEVEL UP! YOU REACHED LEVEL " + newLevel + "!");
  if (newLevel >= 5) unlockWorldAchievement("level-five");
}

function unlockWorldAchievement(id) {
  if (!WORLD_ACHIEVEMENTS.some(item => item.id === id) || save.achievements.includes(id)) return;
  const achievement = WORLD_ACHIEVEMENTS.find(item => item.id === id);
  save.achievements.push(id);
  save.coins += achievement.reward;
  persist(true);
  updateHud();
  showToast("✦ ACHIEVEMENT UNLOCKED: " + achievement.title + " · +" + achievement.reward + " COINS");
}

function checkWorldAchievements() {
  if (!save.achievements.includes("first-friend") && Object.keys(save.npcRewards || {}).length) unlockWorldAchievement("first-friend");
  if (!save.achievements.includes("first-gather") && (save.gathered || []).length >= 1) unlockWorldAchievement("first-gather");
  if (!save.achievements.includes("five-gathers") && (save.gathered || []).length >= 5) unlockWorldAchievement("five-gathers");
  if (!save.achievements.includes("first-harvest") && (save.inventory.rice || 0) >= 3) unlockWorldAchievement("first-harvest");
  if (!save.achievements.includes("home-decorator") && (save.placedFurniture || []).length >= 3) unlockWorldAchievement("home-decorator");
  if (!save.achievements.includes("first-mini-game") && Object.values(save.minigameStats || {}).some(value => Number(value) > 0)) unlockWorldAchievement("first-mini-game");
  if (!save.achievements.includes("angler") && Number(save.fishCaught || 0) >= 5) unlockWorldAchievement("angler");
  if (!save.achievements.includes("secret-star") && (save.secretFinds || []).length) unlockWorldAchievement("secret-star");
}

function trackQuestAction(action, amount = 1) {
  ensureDailyQuests();
  let changed = false;
  save.dailyQuests.forEach(id => {
    const quest = DAILY_QUEST_POOL.find(item => item.id === id);
    if (!quest || quest.action !== action || save.dailyQuestClaimed[id]) return;
    const current = Math.max(0, Number(save.dailyQuestProgress[id]) || 0);
    save.dailyQuestProgress[id] = Math.min(quest.target, current + amount);
    changed = true;
  });
  if (changed) {
    persist(true);
    if ($("questDialog") && $("questDialog").open) renderQuestBoard();
  }
}

const worldRewardTownBeforeSkills = rewardTown;
rewardTown = function rewardTownWithProfessionSkills(coins, xp = 0, progress = 0) {
  const coinMultiplier = 1 + .1 * getProfessionBonus("coins");
  const xpMultiplier = 1 + .1 * getProfessionBonus("xp");
  const finalCoins = Math.round(Math.max(0, Number(coins) || 0) * coinMultiplier);
  const finalXp = Math.round(Math.max(0, Number(xp) || 0) * xpMultiplier);
  worldRewardTownBeforeSkills(finalCoins, finalXp, progress);
  if (coins > 0 || xp > 0) trackQuestAction("work");
};

function claimDailyQuest(id) {
  ensureDailyQuests();
  const quest = DAILY_QUEST_POOL.find(item => item.id === id);
  if (!quest || !save.dailyQuests.includes(id) || save.dailyQuestClaimed[id]) return;
  if ((Number(save.dailyQuestProgress[id]) || 0) < quest.target) return;
  save.dailyQuestClaimed[id] = true;
  save.coins += quest.coins;
  awardWorldXp(quest.xp);
  persist(true);
  updateHud();
  renderQuestBoard();
  showToast("DAILY QUEST COMPLETE · +" + quest.coins + " COINS · +" + quest.xp + " XP");
}

function renderQuestBoard() {
  ensureDailyQuests();
  const questGrid = $("dailyQuestGrid");
  const achievementGrid = $("achievementGrid");
  if (!questGrid || !achievementGrid) return;
  questGrid.replaceChildren();
  const completed = save.dailyQuests.filter(id => save.dailyQuestClaimed[id]).length;
  $("questBoardDate").textContent = "JAKARTA · " + save.dailyQuestDate + " · " + completed + "/3 CLAIMED";
  save.dailyQuests.forEach(id => {
    const quest = DAILY_QUEST_POOL.find(item => item.id === id);
    const progress = Math.min(quest.target, Number(save.dailyQuestProgress[id]) || 0);
    const claimed = Boolean(save.dailyQuestClaimed[id]);
    const card = document.createElement("article");
    card.className = "world-quest-card" + (claimed ? " is-claimed" : progress >= quest.target ? " is-ready" : "");
    const title = document.createElement("strong");
    title.textContent = quest.title;
    const description = document.createElement("p");
    description.textContent = quest.description;
    const meta = document.createElement("small");
    meta.textContent = progress + "/" + quest.target + " · " + quest.coins + " COINS · " + quest.xp + " XP";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pixel-button quest-claim-button";
    button.textContent = claimed ? "CLAIMED" : progress >= quest.target ? "CLAIM REWARD" : "IN PROGRESS";
    button.disabled = claimed || progress < quest.target;
    button.addEventListener("click", () => claimDailyQuest(id));
    card.append(title, description, meta, button);
    questGrid.append(card);
  });

  achievementGrid.replaceChildren();
  WORLD_ACHIEVEMENTS.forEach(item => {
    const unlocked = save.achievements.includes(item.id);
    const card = document.createElement("article");
    card.className = "world-achievement-card" + (unlocked ? " is-unlocked" : "");
    const icon = document.createElement("span");
    icon.textContent = unlocked ? "✦" : "◇";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description;
    copy.append(title, description);
    card.append(icon, copy);
    achievementGrid.append(card);
  });
}

function openQuestBoard() {
  if (!requireWorldMember()) return;
  renderQuestBoard();
  $("questDialog").showModal();
}

function unlockProfessionSkill(id) {
  const tree = PROFESSION_SKILL_TREE[save.job] || [];
  const skill = tree.find(item => item.id === id);
  if (!skill || hasProfessionSkill(id) || Number(save.skillPoints[save.job] || 0) < 1) return;
  save.skillPoints[save.job] -= 1;
  save.unlockedSkills.push(id);
  persist(true);
  updateHud();
  renderSkillTree();
  showToast(skill.name + " unlocked!");
}

function renderSkillTree() {
  const grid = $("professionSkillGrid");
  if (!grid) return;
  grid.replaceChildren();
  const tree = PROFESSION_SKILL_TREE[save.job] || [];
  const points = Number(save.skillPoints[save.job] || 0);
  $("skillProfessionName").textContent = save.job
    ? jobs.find(item => item.id === save.job).name.toUpperCase() + " · LEVEL " + getProfessionLevel(save.job)
    : "CHOOSE A PROFESSION FIRST";
  $("skillPointCount").textContent = points + " SKILL POINTS";
  if (!save.job) {
    const empty = document.createElement("p");
    empty.textContent = "Choose a profession to unlock its own skill tree.";
    grid.append(empty);
    return;
  }
  tree.forEach(skill => {
    const owned = hasProfessionSkill(skill.id);
    const card = document.createElement("article");
    card.className = "world-skill-card" + (owned ? " is-unlocked" : "");
    const title = document.createElement("strong");
    title.textContent = skill.name;
    const description = document.createElement("p");
    description.textContent = skill.description;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pixel-button skill-unlock-button";
    button.textContent = owned ? "UNLOCKED" : "UNLOCK · 1 POINT";
    button.disabled = owned || points < 1;
    button.addEventListener("click", () => unlockProfessionSkill(skill.id));
    card.append(title, description, button);
    grid.append(card);
  });
}
function openSkillTree() {
  if (!requireWorldMember()) return;
  renderSkillTree();
  $("skillDialog").showModal();
}


// ── HOME LAYOUT EDITOR ─────────────────────────────────────────────────────
let homeEditorActive = false;
let homeDraggingFurniture = null;
let homeSelectedFurniture = null;
let homeDragOffset = { x: 0, y: 0 };

function furnitureDimensions(item) {
  const sizes = {
    sofa: [178, 72], rug: [220, 82], lamp: [60, 82],
    bookcase: [100, 150], plant: [70, 88], table: [120, 68]
  };
  return sizes[item.kind] || [72, 72];
}

function drawHomeFurniture() {
  const placed = new Set(save.placedFurniture || []);
  FURNITURE_CATALOG.forEach(item => {
    if (!placed.has(item.id)) return;
    const layout = save.homeLayout[item.id] || defaultHomeFurnitureLayout()[item.id] || { x: 500, y: 400, rotation: 0 };
    const size = furnitureDimensions(item);
    ctx.save();
    ctx.translate(layout.x + size[0] / 2, layout.y + size[1] / 2);
    ctx.rotate((Number(layout.rotation) || 0) * Math.PI / 2);
    ctx.translate(-size[0] / 2, -size[1] / 2);
    ctx.fillStyle = "rgba(25,30,25,.2)";
    ctx.fillRect(4, size[1] - 4, size[0], 9);
    if (item.kind === "sofa") {
      ctx.fillStyle = "#526b85"; ctx.fillRect(4, 13, 170, 56);
      ctx.fillStyle = "#8faec4"; ctx.fillRect(13, 18, 151, 42);
      ctx.fillStyle = "#dce8e1"; ctx.fillRect(24, 23, 52, 31); ctx.fillRect(88, 23, 52, 31);
      ctx.fillStyle = "#40566c"; ctx.fillRect(0, 28, 12, 42); ctx.fillRect(166, 28, 12, 42);
    } else if (item.kind === "rug") {
      ctx.fillStyle = "#765d8d"; ctx.fillRect(2, 5, 216, 72);
      ctx.fillStyle = "#d7b8d9"; ctx.fillRect(9, 11, 202, 60);
      ctx.fillStyle = "#a881b5"; ctx.fillRect(19, 20, 182, 43);
      ctx.fillStyle = "#f1d9ef"; ctx.fillRect(102, 24, 16, 33);
    } else if (item.kind === "lamp") {
      ctx.fillStyle = "rgba(255,223,144,.2)"; ctx.beginPath(); ctx.arc(30, 32, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#76533b"; ctx.fillRect(27, 31, 7, 42);
      ctx.fillStyle = "#f3d88d"; ctx.fillRect(8, 5, 45, 27);
      ctx.fillStyle = "#fff1be"; ctx.fillRect(14, 10, 33, 5);
    } else if (item.kind === "bookcase") {
      ctx.fillStyle = "#5e3f2c"; ctx.fillRect(3, 2, 94, 145);
      ctx.fillStyle = "#ad7c4d"; ctx.fillRect(9, 8, 82, 7);
      for (let row = 0; row < 3; row++) {
        ctx.fillStyle = "#bd8b5b"; ctx.fillRect(9, 18 + row * 41, 82, 5);
        for (let col = 0; col < 6; col++) {
          ctx.fillStyle = ["#b86e5c", "#7c8fbd", "#d0b36b", "#6b9b79", "#9f74a7"][(row + col) % 5];
          ctx.fillRect(13 + col * 13, 23 + row * 41, 9, 31);
        }
      }
    } else if (item.kind === "plant") {
      ctx.fillStyle = "#a66b4e"; ctx.fillRect(17, 56, 38, 28);
      ctx.fillStyle = "#426f47"; ctx.fillRect(34, 23, 7, 37);
      ctx.fillStyle = "#5e9e65"; ctx.fillRect(5, 30, 34, 17); ctx.fillRect(39, 24, 28, 19);
      ctx.fillStyle = "#83bd76"; ctx.fillRect(22, 11, 29, 22);
    } else if (item.kind === "table") {
      ctx.fillStyle = "#67472f"; ctx.fillRect(10, 23, 9, 43); ctx.fillRect(101, 23, 9, 43);
      ctx.fillStyle = "#bd8d5c"; ctx.fillRect(3, 13, 116, 17);
      ctx.fillStyle = "#f3e0bd"; ctx.fillRect(38, 5, 45, 7);
    }
    if (homeEditorActive && homeSelectedFurniture === item.id) {
      ctx.strokeStyle = "#fff4b6"; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
      ctx.strokeRect(-3, -3, size[0] + 6, size[1] + 6);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
}

function toggleHomeLayoutEditor() {
  if (!requireWorldMember()) return;
  if (insideBuilding !== "home") {
    showToast("Enter Your Little Home before editing its layout.");
    return;
  }
  homeEditorActive = !homeEditorActive;
  homeDraggingFurniture = null;
  homeSelectedFurniture = null;
  if ($("furnitureDialog").open) $("furnitureDialog").close();
  showToast(homeEditorActive
    ? "HOME EDITOR ON · Drag furniture · R rotate · ESC finish"
    : "Home layout saved!");
  $("interactionPrompt").textContent = homeEditorActive
    ? "DRAG FURNITURE · R ROTATE · ESC FINISH"
    : "E · HOME DESIGN STUDIO";
  persist(true);
}

function finishHomeLayoutEditor() {
  if (!homeEditorActive) return;
  homeEditorActive = false;
  homeDraggingFurniture = null;
  homeSelectedFurniture = null;
  persist(true);
  showToast("Your home layout has been saved.");
}

function furnitureCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (VIEW_W / rect.width),
    y: (event.clientY - rect.top) * (VIEW_H / rect.height)
  };
}

function bindHomeEditorPointer() {
  canvas.addEventListener("pointerdown", event => {
    if (!homeEditorActive || insideBuilding !== "home") return;
    const point = furnitureCanvasPoint(event);
    const items = [...(save.placedFurniture || [])].reverse();
    for (const id of items) {
      const item = FURNITURE_CATALOG.find(entry => entry.id === id);
      if (!item) continue;
      const size = furnitureDimensions(item);
      const layout = save.homeLayout[id] || { x: 500, y: 400, rotation: 0 };
      if (point.x >= layout.x - 5 && point.x <= layout.x + size[0] + 5 &&
          point.y >= layout.y - 5 && point.y <= layout.y + size[1] + 5) {
        homeSelectedFurniture = id;
        homeDraggingFurniture = id;
        homeDragOffset = { x: point.x - layout.x, y: point.y - layout.y };
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }
  });
  canvas.addEventListener("pointermove", event => {
    if (!homeEditorActive || !homeDraggingFurniture) return;
    const item = FURNITURE_CATALOG.find(entry => entry.id === homeDraggingFurniture);
    if (!item) return;
    const point = furnitureCanvasPoint(event);
    const size = furnitureDimensions(item);
    const x = Math.max(125, Math.min(1140 - size[0], point.x - homeDragOffset.x));
    const y = Math.max(165, Math.min(625 - size[1], point.y - homeDragOffset.y));
    save.homeLayout[homeDraggingFurniture] = {
      ...save.homeLayout[homeDraggingFurniture],
      x: Math.round(x / 8) * 8,
      y: Math.round(y / 8) * 8
    };
  });
  const stopDragging = event => {
    if (!homeDraggingFurniture) return;
    homeDraggingFurniture = null;
    persist(true);
    if (event && event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  document.addEventListener("keydown", event => {
    if (!homeEditorActive) return;
    if (event.key === "Escape") {
      event.preventDefault();
      finishHomeLayoutEditor();
    } else if (event.key.toLowerCase() === "r" && homeSelectedFurniture) {
      const item = save.homeLayout[homeSelectedFurniture] || { x: 400, y: 400, rotation: 0 };
      item.rotation = (Number(item.rotation || 0) + 1) % 4;
      save.homeLayout[homeSelectedFurniture] = item;
      persist(true);
    }
  });
}

function buyHomeExpansion() {
  const next = Number(save.homeExpansion || 0) + 1;
  if (next > 2) return;
  const requiredLevel = next === 1 ? 5 : 10;
  const cost = next === 1 ? 250 : 500;
  if (getWorldLevelProgress(save.xp).level < requiredLevel) {
    showToast("Reach World Level " + requiredLevel + " to unlock this home expansion.");
    return;
  }
  if (save.coins < cost) {
    showToast("You need " + cost + " Star Coins for this expansion.");
    return;
  }
  save.coins -= cost;
  save.homeExpansion = next;
  persist(true);
  updateHud();
  renderFurnitureShop();
  unlockWorldAchievement("home-expansion");
  showToast(next === 1 ? "A sunny side room has been added to your home!" : "Your home has a new starlight loft!");
}

const renderFurnitureShopBeforeEditor = renderFurnitureShop;
renderFurnitureShop = function renderFurnitureShopWithEditor() {
  renderFurnitureShopBeforeEditor();
  const editButton = $("editHomeLayoutButton");
  const expansionButton = $("expandHomeButton");
  const expansionStatus = $("homeExpansionStatus");
  const isHome = furnitureDialogMode === "home";
  if (editButton) editButton.hidden = !isHome;
  if (expansionButton) {
    const next = Number(save.homeExpansion || 0) + 1;
    const requiredLevel = next === 1 ? 5 : 10;
    const cost = next === 1 ? 250 : 500;
    expansionButton.hidden = !isHome;
    expansionButton.disabled = next > 2;
    expansionButton.textContent = next > 2 ? "HOME FULLY EXPANDED" : "EXPAND · " + cost + " COINS · LVL " + requiredLevel;
  }
  if (expansionStatus) {
    expansionStatus.hidden = !isHome;
    expansionStatus.textContent = "HOME EXPANSION " + (save.homeExpansion || 0) + "/2";
  }
};

const toggleFurniturePlacementBeforeLayout = toggleFurniturePlacement;
toggleFurniturePlacement = function toggleFurniturePlacementWithLayout(id) {
  const wasPlaced = save.placedFurniture.includes(id);
  toggleFurniturePlacementBeforeLayout(id);
  const isPlaced = save.placedFurniture.includes(id);
  if (!wasPlaced && isPlaced && !save.homeLayout[id]) {
    const defaults = defaultHomeFurnitureLayout();
    save.homeLayout[id] = defaults[id] || {
      x: 280 + (save.placedFurniture.length % 3) * 240,
      y: 260 + Math.floor(save.placedFurniture.length / 3) * 130,
      rotation: 0
    };
    persist(true);
  }
  if (wasPlaced && !isPlaced) {
    delete save.homeLayout[id];
    persist(true);
  }
  checkWorldAchievements();
  if ($("furnitureDialog") && $("furnitureDialog").open) renderFurnitureShop();
};

function drawHomeExpansion() {
  if (insideBuilding !== "home" || !save.homeExpansion) return;
  ctx.fillStyle = "#6b4d3a"; ctx.fillRect(890, 180, 270, 20);
  ctx.fillStyle = save.homeExpansion > 1 ? "#64789a" : "#9b7659";
  ctx.fillRect(900, 195, 245, 245);
  ctx.fillStyle = save.homeExpansion > 1 ? "#a7c3e1" : "#e5c99f";
  ctx.fillRect(910, 205, 225, 225);
  ctx.fillStyle = "#76543a"; ctx.fillRect(915, 430, 215, 12);
  if (save.homeExpansion > 1) {
    ctx.fillStyle = "#f1d88f";
    for (let i = 0; i < 8; i++) {
      const x = 945 + i * 25, y = 235 + (i % 3) * 33;
      ctx.fillRect(x, y, 5, 5);
    }
  } else {
    ctx.fillStyle = "#718ba0"; ctx.fillRect(950, 245, 120, 95);
    ctx.fillStyle = "#d9edf0"; ctx.fillRect(958, 253, 104, 79);
    ctx.fillStyle = "#806044"; ctx.fillRect(1005, 340, 8, 88);
  }
}


// ── AVATAR STUDIO, SECRET EXPLORATION & WORLD ATMOSPHERE ────────────────────
const AVATAR_COLOR_PALETTE = [
  "#e968ad", "#a578ce", "#6d9fce", "#4d8c99",
  "#6d9b73", "#dc9061", "#c5a44e", "#53547f",
  "#e9d7be", "#745b50"
];

function setAvatarAppearance(field, value) {
  const hairAllowed = FASHION_HAIR_STYLES
    .filter(style => style.gender === save.gender).map(style => style.id);
  if (field === "hairStyle" && !hairAllowed.includes(value)) return;
  if (field === "accessory" && !FASHION_ACCESSORIES.some(item => item.id === value)) return;
  if (["pantsColor", "shoeColor"].includes(field) && !isSafeWorldColor(value)) return;
  if (!["hairStyle", "accessory", "pantsColor", "shoeColor"].includes(field)) return;
  save[field] = value;
  player[field] = value;
  persist(true);
  if (worldPresenceReady) syncWorldPresence(performance.now());
  renderFashionAppearanceOptions();
}

function renderFashionAppearanceOptions() {
  const groups = [
    ["hairStyleGrid", "hairStyle", FASHION_HAIR_STYLES
      .filter(item => item.gender === save.gender)
      .map(item => ({ id: item.id, label: item.icon + " " + item.name }))],
    ["accessoryGrid", "accessory", FASHION_ACCESSORIES
      .map(item => ({ id: item.id, label: item.icon + " " + item.name }))]
  ];
  groups.forEach(([elementId, field, items]) => {
    const grid = $(elementId);
    if (!grid) return;
    grid.replaceChildren();
    items.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "appearance-choice" + (save[field] === item.id ? " selected" : "");
      button.textContent = item.label;
      button.addEventListener("click", () => setAvatarAppearance(field, item.id));
      grid.append(button);
    });
  });
  [["pantsColorGrid", "pantsColor"], ["shoeColorGrid", "shoeColor"]].forEach(([elementId, field]) => {
    const grid = $(elementId);
    if (!grid) return;
    grid.replaceChildren();
    AVATAR_COLOR_PALETTE.forEach(color => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fashion-color-swatch" + (save[field] === color ? " selected" : "");
      button.style.setProperty("--swatch-color", color);
      button.title = color;
      button.setAttribute("aria-label", field + " " + color);
      button.addEventListener("click", () => setAvatarAppearance(field, color));
      grid.append(button);
    });
  });
}
const worldRenderFashionBeforeAvatar = renderFashionShop;
renderFashionShop = function renderFashionShopWithAvatar() {
  worldRenderFashionBeforeAvatar();
  renderFashionAppearanceOptions();
};
const worldSetGenderBeforeHair = setGender;
setGender = function setGenderWithHair(gender) {
  worldSetGenderBeforeHair(gender);
  save.hairStyle = gender === "female" ? "long" : "short";
  player.hairStyle = save.hairStyle;
  player.accessory = save.accessory || "none";
  player.pantsColor = save.pantsColor || "#34465f";
  player.shoeColor = save.shoeColor || "#594331";
  persist(true);
  if (worldPresenceReady) syncWorldPresence(performance.now());
};

const worldDrawCharacterBeforeAvatar = drawCharacter;
drawCharacter = function drawCharacterWithAvatar(entity, isLocal, time) {
  worldDrawCharacterBeforeAvatar(entity, isLocal, time);
  const sx = entity.x - camera.x;
  const sy = entity.y - camera.y;
  if (sx < -60 || sx > VIEW_W + 60 || sy < -70 || sy > VIEW_H + 50) return;
  const top = sy - 32 + (entity.moving && Math.floor(time / 115) % 2 ? -2 : 0);
  if (isSafeWorldColor(entity.pantsColor)) {
    ctx.fillStyle = entity.pantsColor;
    ctx.fillRect(sx - 7, top + 26, 6, 5);
    ctx.fillRect(sx + 1, top + 26, 6, 5);
  }
  if (isSafeWorldColor(entity.shoeColor)) {
    ctx.fillStyle = entity.shoeColor;
    ctx.fillRect(sx - 8, top + 30, 7, 3);
    ctx.fillRect(sx + 1, top + 30, 7, 3);
  }
  const hair = entity.hairStyle || (entity.gender === "female" ? "long" : "short");
  ctx.fillStyle = "#49362e";
  if (hair === "wave") ctx.fillRect(sx + 2, top - 2, 9, 5);
  else if (hair === "curly") {
    ctx.fillRect(sx - 10, top - 2, 5, 5);
    ctx.fillRect(sx - 4, top - 5, 6, 6);
    ctx.fillRect(sx + 3, top - 2, 7, 5);
  } else if (hair === "bob") {
    ctx.fillRect(sx - 10, top + 7, 4, 13);
    ctx.fillRect(sx + 6, top + 7, 4, 13);
  } else if (hair === "bun") {
    ctx.fillRect(sx - 4, top - 7, 8, 7);
    ctx.fillRect(sx - 2, top - 10, 4, 4);
  }
  const accessory = entity.accessory || "none";
  if (accessory === "starclip" || accessory === "bow") {
    ctx.fillStyle = accessory === "starclip" ? "#ffe18b" : "#f39ac9";
    ctx.fillRect(sx + 7, top + 2, 5, 5);
    ctx.fillRect(sx + 9, top, 2, 9);
  } else if (accessory === "glasses" && entity.direction !== "up") {
    ctx.strokeStyle = "#403c50"; ctx.lineWidth = 2;
    ctx.strokeRect(sx - 7, top + 9, 6, 5);
    ctx.strokeRect(sx + 1, top + 9, 6, 5);
    ctx.beginPath(); ctx.moveTo(sx - 1, top + 11); ctx.lineTo(sx + 1, top + 11); ctx.stroke();
  } else if (accessory === "cap") {
    ctx.fillStyle = "#526b85";
    ctx.fillRect(sx - 9, top - 3, 18, 6);
    ctx.fillRect(sx - 11, top + 1, 22, 3);
    ctx.fillStyle = "#d8e4e8"; ctx.fillRect(sx - 2, top - 2, 5, 2);
  }
  if (entity.emote && entity.emoteUntil > Date.now()) {
    const bubbleY = top - 25;
    ctx.fillStyle = "rgba(255,250,228,.96)";
    ctx.fillRect(sx - 15, bubbleY - 11, 30, 25);
    ctx.fillStyle = "#473b54";
    ctx.font = "17px Ubuntu";
    ctx.textAlign = "center";
    ctx.fillText(entity.emote, sx, bubbleY + 8);
    ctx.fillStyle = "rgba(255,250,228,.96)";
    ctx.fillRect(sx - 2, bubbleY + 13, 5, 4);
  }
};

const worldPresenceBeforeAvatar = currentWorldPresence;
currentWorldPresence = function currentWorldPresenceWithAvatar() {
  const base = worldPresenceBeforeAvatar();
  return {
    ...base,
    hairStyle: save.hairStyle || (save.gender === "female" ? "long" : "short"),
    accessory: save.accessory || "none",
    pantsColor: save.pantsColor || "#34465f",
    shoeColor: save.shoeColor || "#594331",
    emote: player.emoteUntil > Date.now() ? (player.emote || "") : ""
  };
};
const worldPresenceChangeBeforeAvatar = presenceHasChanged;
presenceHasChanged = function presenceHasChangedWithAvatar(next) {
  if (worldPresenceChangeBeforeAvatar(next)) return true;
  return next.hairStyle !== lastPresenceState.hairStyle ||
    next.accessory !== lastPresenceState.accessory ||
    next.pantsColor !== lastPresenceState.pantsColor ||
    next.shoeColor !== lastPresenceState.shoeColor ||
    next.emote !== lastPresenceState.emote;
};
function sendWorldEmote(emote) {
  if (!requireWorldMember()) return;
  if (!["👋", "💖", "🎉", "🎵", "✨"].includes(emote)) return;
  player.emote = emote;
  player.emoteUntil = Date.now() + 3200;
  if (worldPresenceReady) syncWorldPresence(performance.now());
}

// ── HIDDEN COLLECTIBLES & LEVEL-GATED MOON GARDEN ───────────────────────────
const SECRET_STAR_SPOTS = [
  { id: "secret-star-north", x: 97 * TILE + 16, y: 13 * TILE + 16, reward: 1 },
  { id: "secret-star-east", x: 130 * TILE + 16, y: 65 * TILE + 16, reward: 1 },
  { id: "secret-star-south", x: 91 * TILE + 16, y: 91 * TILE + 16, reward: 2 }
];
function canSenseSecretStars() {
  return save.job === "explorer" || getWorldLevelProgress(save.xp).level >= 3 ||
    hasProfessionSkill("explorer-shard");
}
function nearestSecretStar(maxDistance = 48) {
  if (!canSenseSecretStars()) return null;
  let nearest = null;
  SECRET_STAR_SPOTS.forEach(spot => {
    if (save.secretFinds.includes(spot.id)) return;
    const distance = Math.hypot(player.x - spot.x, player.y - spot.y);
    if (distance < maxDistance && (!nearest || distance < nearest.distance)) nearest = { ...spot, distance };
  });
  return nearest;
}
function drawSecretStars(time) {
  if (!canSenseSecretStars()) return;
  SECRET_STAR_SPOTS.forEach(spot => {
    if (save.secretFinds.includes(spot.id)) return;
    const x = spot.x - camera.x, y = spot.y - camera.y;
    if (x < -35 || x > VIEW_W + 35 || y < -35 || y > VIEW_H + 35) return;
    if (Math.hypot(player.x - spot.x, player.y - spot.y) > 170) return;
    const pulse = 9 + Math.sin(time / 180 + x) * 3;
    ctx.fillStyle = "rgba(255,231,146,.18)";
    ctx.beginPath(); ctx.arc(x, y, pulse + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff0a8";
    ctx.beginPath(); ctx.moveTo(x, y - pulse); ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + pulse); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
  });
}
function collectSecretStar(spot) {
  if (!spot || save.secretFinds.includes(spot.id)) return;
  save.secretFinds.push(spot.id);
  addTownItem("starShard", spot.reward);
  save.coins += 12 * spot.reward;
  awardWorldXp(12 * spot.reward);
  trackQuestAction("secret");
  checkWorldAchievements();
  persist(true);
  updateHud();
  showToast("HIDDEN STAR FOUND · +" + spot.reward + " STAR SHARD" + (spot.reward > 1 ? "S" : "") + "!");
}

const moonGardenBuilding = {
  id: "moon-garden", name: "Moon Garden", x: 125, y: 84, w: 5, h: 4,
  roof: "#556e92", wall: "#c9d5d8", sign: "MOON GARDEN"
};
buildings.push(moonGardenBuilding);
interiorRooms["moon-garden"] = {
  station: { x: 650, y: 300, label: "MOONLIGHT SHRINE" },
  floor: "#7f8eaa", wall: "#52627f"
};
indoorStaff["moon-garden"] = { name: "Lumina", x: 470, y: 300, palette: 0 };
function isWorldBuildingUnlocked(building) {
  return !building || building.id !== "moon-garden" ||
    getWorldLevelProgress(save.xp).level >= 5;
}
const worldNearbyBuildingBeforeGate = nearbyBuilding;
nearbyBuilding = function nearbyBuildingWithLevelGate() {
  const building = worldNearbyBuildingBeforeGate();
  return isWorldBuildingUnlocked(building) ? building : null;
};
const worldEnterBuildingBeforeGate = enterTownBuilding;
enterTownBuilding = function enterTownBuildingWithLevelGate(building) {
  if (!isWorldBuildingUnlocked(building)) {
    showToast("Reach World Level 5 to discover the Moon Garden.");
    return;
  }
  worldEnterBuildingBeforeGate(building);
};
const worldDrawBuildingBeforeGate = drawBuilding;
drawBuilding = function drawBuildingWithLevelGate(building) {
  if (!isWorldBuildingUnlocked(building)) return;
  worldDrawBuildingBeforeGate(building);
};
const worldInteractBeforeSecrets = interact;
interact = function interactWithSecrets() {
  if (!insideBuilding) {
    const secret = nearestSecretStar();
    if (secret) { collectSecretStar(secret); return; }
  }
  worldInteractBeforeSecrets();
};

// ── DAY / NIGHT, WEATHER & SEASONAL PIXEL DETAILS ───────────────────────────
let worldEnvironmentSaveTimer = 0;
let lastEnvironmentUiAt = 0;
function worldSeasonName() {
  return ["BLOOM SEASON", "SUN SEASON", "GOLDEN SEASON", "STARLIGHT SEASON"][
    Math.floor((Math.max(1, save.worldDay) - 1) / 7) % 4
  ];
}
function worldWeatherName() {
  const season = Math.floor((Math.max(1, save.worldDay) - 1) / 7) % 4;
  const weather = ["Sunny", "Cloudy", "Rainy", "Breezy", "Clear Skies"];
  return weather[hash(save.worldDay, season, 81) % weather.length];
}
function updateWorldEnvironment(delta) {
  const previousDay = save.worldDay;
  save.worldMinutes = Number(save.worldMinutes || 540) + Math.max(0, delta) * 1.5;
  while (save.worldMinutes >= 1440) {
    save.worldMinutes -= 1440;
    save.worldDay += 1;
  }
  if (save.worldDay !== previousDay) showToast("A new day begins in Stellars Town · " + worldSeasonName() + "!");
  worldEnvironmentSaveTimer += delta;
  if (worldEnvironmentSaveTimer >= 25) {
    worldEnvironmentSaveTimer = 0;
    persist(true);
  }
  if (performance.now() - lastEnvironmentUiAt > 5000) {
    lastEnvironmentUiAt = performance.now();
    const hour = Math.floor(save.worldMinutes / 60);
    const minute = Math.floor(save.worldMinutes % 60);
    $("worldClock").textContent = "DAY " + save.worldDay + " · " +
      String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    $("weatherLabel").textContent = worldWeatherName();
    $("weatherIcon").textContent = worldWeatherName() === "Rainy" ? "☂" :
      worldWeatherName() === "Cloudy" ? "☁" : worldWeatherName() === "Breezy" ? "🍃" : "☀";
    const seasonLabel = $("worldSeasonLabel");
    if (seasonLabel) seasonLabel.textContent = worldSeasonName();
  }
}
function drawWorldAtmosphere(time) {
  if (insideBuilding) return;
  const hour = save.worldMinutes / 60;
  let darkness = 0;
  if (hour < 5.5 || hour >= 20) darkness = .42;
  else if (hour < 7.5) darkness = .42 * (1 - (hour - 5.5) / 2);
  else if (hour >= 18 && hour < 20) darkness = .42 * ((hour - 18) / 2);
  if (darkness > .01) {
    ctx.fillStyle = "rgba(18,25,60," + darkness.toFixed(3) + ")";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const sunProgress = Math.max(0, Math.min(1, (hour - 6) / 12));
  const orbX = 100 + sunProgress * (VIEW_W - 200);
  if (hour >= 6 && hour < 18) {
    ctx.fillStyle = "rgba(255,222,132,.12)";
    ctx.beginPath(); ctx.arc(orbX, 95, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffe39a";
    ctx.beginPath(); ctx.arc(orbX, 95, 13, 0, Math.PI * 2); ctx.fill();
  } else {
    const moonX = VIEW_W - 130;
    ctx.fillStyle = "rgba(190,210,255,.12)";
    ctx.beginPath(); ctx.arc(moonX, 86, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e4eaff";
    ctx.beginPath(); ctx.arc(moonX, 86, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(110,128,174,.6)";
    ctx.beginPath(); ctx.arc(moonX + 7, 82, 11, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 18; i++) {
      const x = hash(i, 9, save.worldDay) % VIEW_W;
      const y = hash(i, 27, save.worldDay) % 270;
      ctx.globalAlpha = .45 + .45 * Math.sin(time / 230 + i);
      ctx.fillStyle = "#fff3c5"; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  const weather = worldWeatherName();
  if (weather === "Rainy") {
    ctx.strokeStyle = "rgba(196,222,239,.42)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 42; i++) {
      const x = (hash(i, 11, save.worldDay) + time * .48) % VIEW_W;
      const y = (hash(i, 29, save.worldDay) + time * 1.05) % VIEW_H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 17); ctx.stroke();
    }
  } else if (weather === "Breezy") {
    for (let i = 0; i < 15; i++) {
      const x = (hash(i, 44, save.worldDay) + time * .11) % VIEW_W;
      const y = (hash(i, 72, save.worldDay) + Math.sin(time / 330 + i) * 16) % VIEW_H;
      ctx.fillStyle = ["#d6bf73", "#a7c88c", "#e9d6a1"][i % 3];
      ctx.fillRect(x, y, 6, 3);
    }
  }
  if (worldSeasonName() === "STARLIGHT SEASON") {
    for (let i = 0; i < 18; i++) {
      const x = hash(i, 91, save.worldDay) % VIEW_W;
      const y = (hash(i, 93, save.worldDay) + time * .025) % VIEW_H;
      ctx.fillStyle = "rgba(226,237,255,.72)"; ctx.fillRect(x, y, 3, 3);
    }
  }
}
const worldDrawBeforeAtmosphere = drawWorld;
drawWorld = function drawWorldWithAtmosphere(time) {
  worldDrawBeforeAtmosphere(time);
  if (!canPlayWorld) return;
  drawSecretStars(time);
  drawWorldAtmosphere(time);
  if (insideBuilding === "home" && typeof drawHomeExpansion === "function") drawHomeExpansion();
};
const worldDrawTreeBeforeSeason = drawTree;
drawTree = function drawTreeWithSeasonDetails(tree) {
  worldDrawTreeBeforeSeason(tree);
  const sx = tree.x - camera.x, sy = tree.y - camera.y;
  if (sx < -70 || sx > VIEW_W + 70 || sy < -90 || sy > VIEW_H + 40) return;
  if (worldSeasonName() === "BLOOM SEASON") {
    ctx.fillStyle = "#ffd4e7";
    ctx.fillRect(sx - 13, sy - 72, 4, 4);
    ctx.fillRect(sx + 17, sy - 60, 4, 4);
  } else if (worldSeasonName() === "GOLDEN SEASON") {
    ctx.fillStyle = "#e0b767"; ctx.fillRect(sx - 17, sy - 64, 4, 4);
    ctx.fillRect(sx + 12, sy - 72, 4, 4);
  } else if (worldSeasonName() === "STARLIGHT SEASON") {
    ctx.fillStyle = "#dce8f6"; ctx.fillRect(sx - 18, sy - 68, 6, 4);
    ctx.fillRect(sx + 11, sy - 77, 5, 4);
  }
};
const worldDrawBuildingBeforeDetail = drawBuilding;
drawBuilding = function drawBuildingWithPixelDetail(building) {
  if (!isWorldBuildingUnlocked(building)) return;
  worldDrawBuildingBeforeDetail(building);
  const x = building.x * TILE - camera.x, y = building.y * TILE - camera.y;
  const w = building.w * TILE, h = building.h * TILE;
  if (x > VIEW_W + 40 || x + w < -40 || y > VIEW_H + 40 || y + h < -50) return;
  ctx.fillStyle = "rgba(42,35,29,.18)";
  ctx.fillRect(x + 7, y + h - 9, w - 14, 5);
  ctx.fillStyle = "rgba(255,247,214,.5)";
  ctx.fillRect(x + 12, y + 15, 3, 18);
  ctx.fillRect(x + w - 15, y + 15, 3, 18);
  ctx.fillStyle = "#d8ecdf";
  ctx.fillRect(x + 15, y + h - 32, 12, 13);
  ctx.fillRect(x + w - 27, y + h - 32, 12, 13);
  ctx.fillStyle = shadeColor(building.roof, -30);
  ctx.fillRect(x + 6, y + 6, w - 12, 3);
};

// ── MINI-GAMES: local-only fishing, memory, cooking and rhythm ───────────────
let miniGameState = null;
let miniGameTimers = [];
function clearMiniGameTimers() {
  miniGameTimers.forEach(id => clearTimeout(id));
  miniGameTimers = [];
}
function showMiniGameMenu() {
  clearMiniGameTimers();
  miniGameState = null;
  $("miniGameMenu").hidden = false;
  $("miniGameStage").hidden = true;
  $("miniGameMenu").replaceChildren();
  const games = [
    { id: "fishing", icon: "🎣", name: "Riverside Fishing", description: "Wait for a bite, then reel it in." },
    { id: "memory", icon: "🧠", name: "Stellar Memory", description: "Find all six matching pairs." },
    { id: "cooking", icon: "🍳", name: "Comet Kitchen", description: "Repeat the recipe in the right order." },
    { id: "rhythm", icon: "🎵", name: "Starbeat Rhythm", description: "Tap the notes in the sequence." }
  ];
  games.forEach(game => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-minigame-card";
    const icon = document.createElement("span");
    icon.textContent = game.icon;
    const title = document.createElement("strong");
    title.textContent = game.name;
    const description = document.createElement("small");
    description.textContent = game.description;
    button.append(icon, title, description);
    button.addEventListener("click", () => startMiniGame(game.id));
    $("miniGameMenu").append(button);
  });
}
function openMiniGameHub() {
  if (!requireWorldMember()) return;
  showMiniGameMenu();
  $("miniGameDialog").showModal();
}
function showMiniGameStage(title, description, content) {
  $("miniGameMenu").hidden = true;
  $("miniGameStage").hidden = false;
  $("miniGameTitle").textContent = title;
  $("miniGameDescription").textContent = description;
  $("miniGameContent").replaceChildren();
  $("miniGameContent").append(content);
}
function finishMiniGame(id, success, amount = 0) {
  clearMiniGameTimers();
  if (success) {
    save.minigameStats[id] = (Number(save.minigameStats[id]) || 0) + 1;
    save.coins += amount;
    if (id === "fishing") {
      addTownItem("fish", 1);
      save.fishCaught = (save.fishCaught || 0) + 1;
      if (Math.random() < .28) addTownItem("shell", 1);
    }
    awardWorldXp(id === "fishing" ? 12 : 16);
    trackQuestAction("minigame");
    checkWorldAchievements();
    persist(true);
    updateHud();
    showToast("MINI-GAME COMPLETE · +" + amount + " STAR COINS!");
  } else {
    showToast("Not quite! Give it another try.");
  }
  const result = document.createElement("div");
  result.className = "minigame-result" + (success ? " success" : "");
  result.textContent = success
    ? "✦ Well played! +" + amount + " Star Coins · XP earned."
    : "The round ended. Try again when you're ready.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "pixel-button minigame-retry-button";
  retry.textContent = "PLAY AGAIN";
  retry.addEventListener("click", () => startMiniGame(id));
  const back = document.createElement("button");
  back.type = "button";
  back.className = "pixel-button secondary-button minigame-retry-button";
  back.textContent = "ALL MINI-GAMES";
  back.addEventListener("click", showMiniGameMenu);
  $("miniGameContent").replaceChildren(result, retry, back);
}
function startMiniGame(id) {
  clearMiniGameTimers();
  if (id === "fishing") {
    const wrapper = document.createElement("div");
    wrapper.className = "fishing-game-stage";
    const pond = document.createElement("div");
    pond.className = "fishing-pond";
    pond.textContent = "🌊  🌊  🌊  🌊";
    const status = document.createElement("p");
    status.textContent = "Cast your line and watch the water…";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "pixel-button";
    action.textContent = "CAST LINE";
    action.addEventListener("click", () => {
      if (!miniGameState || miniGameState.phase === "ready") {
        action.disabled = true;
        status.textContent = "Waiting for a bite…";
        miniGameState = { id: "fishing", phase: "waiting" };
        const delay = 1300 + Math.floor(Math.random() * 2200);
        miniGameTimers.push(setTimeout(() => {
          if (!miniGameState || miniGameState.id !== "fishing" || miniGameState.phase !== "waiting") return;
          miniGameState.phase = "bite";
          status.textContent = "A FISH BIT! REEL IT IN!";
          pond.textContent = "💦  🐟  💦";
          action.disabled = false;
          action.textContent = "REEL IN!";
          miniGameTimers.push(setTimeout(() => {
            if (miniGameState && miniGameState.phase === "bite") finishMiniGame("fishing", false);
          }, 1700));
        }, delay));
      } else if (miniGameState.phase === "bite") {
        miniGameState.phase = "caught";
        finishMiniGame("fishing", true, 18);
      }
    });
    wrapper.append(pond, status, action);
    showMiniGameStage("Riverside Fishing", "Cast a line, then reel in quickly when a fish bites.", wrapper);
    miniGameState = { id: "fishing", phase: "ready" };
    return;
  }

  if (id === "memory") {
    const symbols = ["🌙", "⭐", "🍀", "🎵", "☕", "📚"];
    const deck = [...symbols, ...symbols].sort(() => Math.random() - .5);
    const wrapper = document.createElement("div");
    wrapper.className = "memory-game-grid";
    let opened = [];
    let matched = 0;
    let locked = false;
    deck.forEach((symbol, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "memory-card";
      card.textContent = "✦";
      card.addEventListener("click", () => {
        if (locked || card.classList.contains("matched") || opened.includes(index)) return;
        card.textContent = symbol;
        card.classList.add("revealed");
        opened.push(index);
        if (opened.length === 2) {
          locked = true;
          const first = wrapper.children[opened[0]];
          const second = wrapper.children[opened[1]];
          if (deck[opened[0]] === deck[opened[1]]) {
            first.classList.add("matched");
            second.classList.add("matched");
            matched += 1;
            opened = [];
            locked = false;
            if (matched === symbols.length) finishMiniGame("memory", true, 24);
          } else {
            miniGameTimers.push(setTimeout(() => {
              first.textContent = "✦";
              second.textContent = "✦";
              first.classList.remove("revealed");
              second.classList.remove("revealed");
              opened = [];
              locked = false;
            }, 650));
          }
        }
      });
      wrapper.append(card);
    });
    showMiniGameStage("Stellar Memory", "Find all six matching pairs.", wrapper);
    return;
  }

  if (id === "cooking" || id === "rhythm") {
    const isCooking = id === "cooking";
    const choices = isCooking
      ? [{id:"bean",label:"🫘 BEANS"},{id:"milk",label:"🥛 MILK"},{id:"pour",label:"☕ POUR"},{id:"star",label:"⭐ FINISH"}]
      : [{id:"star",label:"⭐ STAR"},{id:"moon",label:"🌙 MOON"},{id:"note",label:"🎵 NOTE"},{id:"leaf",label:"🍃 LEAF"}];
    const sequence = isCooking
      ? ["bean", "milk", "pour", "star"]
      : ["star", "note", "moon", "leaf", "star"];
    let step = 0;
    const wrapper = document.createElement("div");
    wrapper.className = "sequence-game-stage";
    const progress = document.createElement("p");
    progress.textContent = "STEP 1 / " + sequence.length;
    const buttons = document.createElement("div");
    buttons.className = "sequence-game-buttons";
    choices.forEach(choice => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sequence-game-button";
      button.textContent = choice.label;
      button.addEventListener("click", () => {
        if (choice.id !== sequence[step]) {
          finishMiniGame(id, false);
          return;
        }
        step += 1;
        progress.textContent = step >= sequence.length ? "PERFECT!" : "STEP " + (step + 1) + " / " + sequence.length;
        button.classList.add("is-correct");
        if (step >= sequence.length) finishMiniGame(id, true, isCooking ? 26 : 28);
      });
      buttons.append(button);
    });
    wrapper.append(progress, buttons);
    showMiniGameStage(
      isCooking ? "Comet Kitchen" : "Starbeat Rhythm",
      isCooking ? "Tap the ingredients in the recipe order." : "Follow the little sequence and tap each note in order.",
      wrapper
    );
    return;
  }
}



const worldUseWorkstationBeforeSkillYield = useTownWorkstation;
useTownWorkstation = function useTownWorkstationWithSkillYield() {
  const job = save.job;
  const beforeXp = Number(save.xp) || 0;
  const before = { ...save.inventory };
  const beforeBenches = Number(save.benches) || 0;
  const beforeMurals = Number(save.murals) || 0;
  worldUseWorkstationBeforeSkillYield();
  if ((Number(save.xp) || 0) <= beforeXp) return;

  let bonusItem = "";
  if (job === "barista" && hasProfessionSkill("barista-blend") &&
      (before.coffee || 0) > (save.inventory.coffee || 0) && Math.random() < 1) {
    bonusItem = "coffee";
  } else if (job === "builder" && hasProfessionSkill("builder-reuse") &&
      save.benches > beforeBenches && Math.random() < .35) {
    bonusItem = "wood";
  } else if (job === "librarian" && hasProfessionSkill("librarian-rare") &&
      (before.books || 0) > (save.inventory.books || 0) && Math.random() < .25) {
    bonusItem = "books";
  } else if (job === "explorer" && hasProfessionSkill("explorer-shard") &&
      (before.starShard || 0) > (save.inventory.starShard || 0) && Math.random() < .3) {
    bonusItem = "starShard";
  } else if (job === "artist" && hasProfessionSkill("artist-palette") &&
      save.murals > beforeMurals && Math.random() < .25) {
    bonusItem = "dye";
  }
  if (bonusItem) {
    addTownItem(bonusItem, 1);
    persist(true);
    updateHud();
    showToast("SKILL BONUS · +" + (INVENTORY_ITEMS.find(item => item.key === bonusItem)?.label || bonusItem));
  }
};


bindControls();
bindHomeEditorPointer();
$("openQuestBoardButton").addEventListener("click", openQuestBoard);
$("openSkillTreeButton").addEventListener("click", openSkillTree);
$("openMiniGameButton").addEventListener("click", openMiniGameHub);
$("closeQuestDialog").addEventListener("click", () => $("questDialog").close());
$("closeSkillDialog").addEventListener("click", () => $("skillDialog").close());
$("closeMiniGameDialog").addEventListener("click", () => {
  clearMiniGameTimers();
  $("miniGameDialog").close();
});
$("miniGameDialog").addEventListener("close", clearMiniGameTimers);
document.querySelectorAll("[data-world-emote]").forEach(button => {
  button.addEventListener("click", () => sendWorldEmote(button.dataset.worldEmote));
});
$("editHomeLayoutButton").addEventListener("click", toggleHomeLayoutEditor);
$("expandHomeButton").addEventListener("click", buyHomeExpansion);
drawClock();
// The in-game clock now advances locally with the World day/night cycle.
startAuth();
requestAnimationFrame(loop);
