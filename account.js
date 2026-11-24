import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
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
const loginButton = document.getElementById("siteAccountLoginButton");
const logoutButton = document.getElementById("siteAccountLogout");

const loginDialog = document.createElement("dialog");
loginDialog.className = "site-login-dialog";
loginDialog.id = "siteLoginDialog";
loginDialog.setAttribute("aria-labelledby", "siteLoginTitle");
loginDialog.innerHTML = '<form id="siteLoginForm" class="site-login-form">' +
    '<div class="site-login-top"><span class="site-login-mark" aria-hidden="true">✦</span>' +
    '<button class="site-login-close" id="siteLoginClose" type="button" aria-label="Close sign in">×</button></div>' +
    '<p class="site-login-kicker">STELLARS BP11 · ACCOUNT ACCESS</p>' +
    '<h2 id="siteLoginTitle">Welcome back, Star.</h2>' +
    '<p class="site-login-copy">Sign in once to access your STELLARS account and academic results.</p>' +
    '<label for="siteLoginUsername">Username</label>' +
    '<input id="siteLoginUsername" name="username" type="text" placeholder="Enter your full name" autocomplete="username" autocapitalize="words" required>' +
    '<label for="siteLoginPassword">Password</label>' +
    '<input id="siteLoginPassword" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required>' +
    '<p class="site-login-message" id="siteLoginMessage" role="status" aria-live="polite"></p>' +
    '<button class="site-login-submit" id="siteLoginSubmit" type="submit"><span>Sign In</span><span aria-hidden="true">→</span></button>' +
    '<p class="site-login-footnote">Access is provided by STELLARS administrators. Public registration is unavailable.</p>' +
    '</form>';
document.body.append(loginDialog);

const loginForm = document.getElementById("siteLoginForm");
const loginUsername = document.getElementById("siteLoginUsername");
const loginPassword = document.getElementById("siteLoginPassword");
const loginMessage = document.getElementById("siteLoginMessage");
const loginSubmit = document.getElementById("siteLoginSubmit");
const closeLoginButton = document.getElementById("siteLoginClose");

const authReady = setPersistence(auth, browserLocalPersistence);
const pageParams = new URLSearchParams(window.location.search);
let shouldAutoOpenLogin = pageParams.get("login") === "1";
const returnTarget = pageParams.get("return");

// Consume the one-time login URL flags so they cannot reopen the dialog on logout.
if (shouldAutoOpenLogin || returnTarget) {
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
}

function initials(name) {
    return String(name || "S")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("") || "S";
}

function usernameToAuthEmail(username) {
    const normalized = String(username || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    if (!normalized) throw new Error("Username tidak valid.");
    return normalized + "@class-web-7241e.firebaseapp.com";
}

function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
}

function openLoginDialog() {
    closeMenu();
    loginMessage.textContent = "";
    loginMessage.dataset.type = "";
    if (!loginDialog.open) loginDialog.showModal();
    loginUsername.focus();
}

button.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
});

loginButton.addEventListener("click", openLoginDialog);
closeLoginButton.addEventListener("click", () => loginDialog.close());

loginDialog.addEventListener("click", event => {
    if (event.target === loginDialog) loginDialog.close();
});

document.addEventListener("click", event => {
    if (!event.target.closest(".site-account-wrap")) closeMenu();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
});

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (loginSubmit.disabled) return;

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
        loginMessage.textContent = "Masukkan username dan password terlebih dahulu.";
        loginMessage.dataset.type = "error";
        return;
    }

    let emailAlias;
    try {
        emailAlias = usernameToAuthEmail(username);
    } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.dataset.type = "error";
        return;
    }

    loginSubmit.disabled = true;
    loginSubmit.querySelector("span").textContent = "Signing in…";
    loginMessage.textContent = "Memeriksa akun…";
    loginMessage.dataset.type = "info";

    try {
        await authReady;
        await signInWithEmailAndPassword(auth, emailAlias, password);
        loginPassword.value = "";
        loginDialog.close();

        if (returnTarget === "academic.html") {
            window.location.assign("academic.html");
        }
    } catch (error) {
        const messages = {
            "auth/invalid-credential": "Username atau password tidak sesuai.",
            "auth/user-not-found": "Akun tidak ditemukan. Periksa penulisan username.",
            "auth/wrong-password": "Password tidak sesuai.",
            "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
            "auth/network-request-failed": "Koneksi bermasalah. Periksa internet lalu coba lagi."
        };

        loginMessage.textContent =
            messages[error.code] || "Login belum berhasil. Coba periksa username dan password.";
        loginMessage.dataset.type = "error";
    } finally {
        loginSubmit.disabled = false;
        loginSubmit.querySelector("span").textContent = "Sign In";
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

authReady
    .then(() => onAuthStateChanged(auth, async user => {
        if (!user) {
            avatar.textContent = "★";
            nameLabel.textContent = "Welcome, Star!";
            metaLabel.textContent = "Not signed in";
            loginButton.hidden = false;
            portalLink.textContent = "Academic Results";
            portalLink.href = "academic.html";
            profileLink.hidden = true;
            logoutButton.hidden = true;

            if (shouldAutoOpenLogin && !loginDialog.open) {
                shouldAutoOpenLogin = false;
                loginDialog.showModal();
            }
            return;
        }

        shouldAutoOpenLogin = false;
        avatar.textContent = initials(user.displayName || "S");
        nameLabel.textContent = user.displayName || "STELLARS Member";
        metaLabel.textContent = "Signed in";
        loginButton.hidden = true;
        portalLink.textContent = "Open Academic Results";
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
                const roleNames = {
                    student: "Student",
                    admin: "Admin",
                    superAdmin: "Super Admin",
                    super_admin: "Super Admin"
                };
                metaLabel.textContent = roleNames[profile.role] || "Signed in";
            }
        } catch (error) {
            console.error("Could not load the STELLARS account profile:", error);
        }
    }))
    .catch(error => {
        console.error("Unable to initialize STELLARS sign-in:", error);
        loginMessage.textContent = "Layanan login belum tersedia. Periksa koneksi lalu muat ulang halaman.";
        loginMessage.dataset.type = "error";
    });
