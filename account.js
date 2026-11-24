import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
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

const button = document.getElementById("siteAccountButton");
const avatar = document.getElementById("siteAccountAvatar");
const menu = document.getElementById("siteAccountMenu");
const nameLabel = document.getElementById("siteAccountName");
const metaLabel = document.getElementById("siteAccountMeta");
const portalLink = document.getElementById("siteAccountPortalLink");
const profileLink = document.getElementById("siteAccountProfileLink");
const logoutButton = document.getElementById("siteAccountLogout");

function initials(name) {
    return String(name || "S")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("") || "S";
}

function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
}

button.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
});

document.addEventListener("click", event => {
    if (!event.target.closest(".site-account-wrap")) closeMenu();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
});

onAuthStateChanged(auth, async user => {
    if (!user) {
        avatar.textContent = "★";
        nameLabel.textContent = "Welcome, Star!";
        metaLabel.textContent = "Sign in to see your profile";
        portalLink.textContent = "Sign in to Academic Portal";
        portalLink.href = "academic.html";
        profileLink.hidden = true;
        logoutButton.hidden = true;
        return;
    }

    avatar.textContent = initials(user.displayName || "S");
    nameLabel.textContent = user.displayName || "STELLARS Member";
    metaLabel.textContent = "Signed in";
    portalLink.textContent = "Open Academic Portal";
    portalLink.href = "academic.html";
    profileLink.hidden = false;
    logoutButton.hidden = false;

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        if (profileSnapshot.exists()) {
            const profile = profileSnapshot.data();
            const fullName = profile.fullName || user.displayName || "STELLARS Member";
            avatar.textContent = initials(fullName);
            nameLabel.textContent = fullName;
            metaLabel.textContent = profile.nim ? "NIM " + profile.nim : (profile.role || "Member");
        }
    } catch (error) {
        console.error("Could not load the STELLARS account profile:", error);
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        closeMenu();
    } catch (error) {
        console.error("Logout failed:", error);
        alert("Logout belum berhasil. Coba lagi.");
    }
});
