import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    deleteUser,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
    '<input id="siteLoginUsername" name="username" type="text" placeholder="Enter student NIM or admin username" autocomplete="username" autocapitalize="words" required>' +
    '<label for="siteLoginPassword">Password</label>' +
    '<input id="siteLoginPassword" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required>' +
    '<p class="site-login-message" id="siteLoginMessage" role="status" aria-live="polite"></p>' +
    '<button class="site-login-submit" id="siteLoginSubmit" type="submit"><span>Sign In</span><span aria-hidden="true">→</span></button>' +
    '<button class="site-login-register-link" id="siteLoginRegisterButton" type="button">First time here? Activate your account</button>' +
    '<p class="site-login-footnote">Students can sign in with NIM + their own password. Admins use their existing username.</p>' +
    '</form>';
document.body.append(loginDialog);

const loginForm = document.getElementById("siteLoginForm");
const loginUsername = document.getElementById("siteLoginUsername");
const loginPassword = document.getElementById("siteLoginPassword");
const loginMessage = document.getElementById("siteLoginMessage");
const loginSubmit = document.getElementById("siteLoginSubmit");
const closeLoginButton = document.getElementById("siteLoginClose");
const registerOpenButton = document.getElementById("siteLoginRegisterButton");

const registrationDialog = document.createElement("dialog");
registrationDialog.className = "site-login-dialog";
registrationDialog.id = "siteRegistrationDialog";
registrationDialog.setAttribute("aria-labelledby", "siteRegistrationTitle");
registrationDialog.innerHTML = '<form id="siteRegistrationForm" class="site-login-form">' +
    '<div class="site-login-top"><span class="site-login-mark" aria-hidden="true">✦</span>' +
    '<button class="site-login-close" id="siteRegistrationClose" type="button" aria-label="Close registration">×</button></div>' +
    '<p class="site-login-kicker">STELLARS BP11 · FIRST-TIME ACTIVATION</p>' +
    '<h2 id="siteRegistrationTitle">Create your account.</h2>' +
    '<p class="site-login-copy">Use the name and NIM registered by STELLARS, then enter your personal one-time activation code.</p>' +
    '<label for="siteRegistrationName">Full name</label>' +
    '<input id="siteRegistrationName" name="fullName" type="text" autocomplete="name" placeholder="Enter your registered full name" maxlength="100" required>' +
    '<label for="siteRegistrationNim">NIM</label>' +
    '<input id="siteRegistrationNim" name="nim" type="text" inputmode="numeric" autocomplete="off" placeholder="Enter your NIM" maxlength="24" required>' +
    '<label for="siteRegistrationCode">Personal activation code</label>' +
    '<input id="siteRegistrationCode" name="activationCode" type="text" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="19" required>' +
    '<label for="siteRegistrationPassword">Create password</label>' +
    '<input id="siteRegistrationPassword" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>' +
    '<label for="siteRegistrationConfirm">Confirm password</label>' +
    '<input id="siteRegistrationConfirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Repeat your password" required>' +
    '<p class="site-login-message" id="siteRegistrationMessage" role="status" aria-live="polite"></p>' +
    '<button class="site-login-submit" id="siteRegistrationSubmit" type="submit"><span>Create Account</span><span aria-hidden="true">→</span></button>' +
    '<button class="site-login-register-link" id="siteRegistrationBack" type="button">Back to Sign In</button>' +
    '<p class="site-login-footnote">Your NIM is used to match academic results. It is not your password.</p>' +
    '</form>';
document.body.append(registrationDialog);

const registrationForm = document.getElementById("siteRegistrationForm");
const registrationName = document.getElementById("siteRegistrationName");
const registrationNim = document.getElementById("siteRegistrationNim");
const registrationCode = document.getElementById("siteRegistrationCode");
const registrationPassword = document.getElementById("siteRegistrationPassword");
const registrationConfirm = document.getElementById("siteRegistrationConfirm");
const registrationMessage = document.getElementById("siteRegistrationMessage");
const registrationSubmit = document.getElementById("siteRegistrationSubmit");
const registrationClose = document.getElementById("siteRegistrationClose");
const registrationBack = document.getElementById("siteRegistrationBack");


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

function openRegistrationDialog() {
    closeMenu();
    loginDialog.close();
    registrationMessage.textContent = "";
    registrationMessage.dataset.type = "";
    if (!registrationDialog.open) registrationDialog.showModal();
    registrationName.focus();
}

function normalizeStudentName(value) {
    return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id");
}

function normalizeActivationCode(value) {
    return String(value || "").toUpperCase().replace(/[\s-]/g, "");
}

async function hashActivationCode(code) {
    const bytes = new TextEncoder().encode(code);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}


button.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
});

loginButton.addEventListener("click", openLoginDialog);
closeLoginButton.addEventListener("click", () => loginDialog.close());

registerOpenButton.addEventListener("click", openRegistrationDialog);
registrationClose.addEventListener("click", () => registrationDialog.close());
registrationBack.addEventListener("click", () => {
    registrationDialog.close();
    openLoginDialog();
});
registrationDialog.addEventListener("click", event => {
    if (event.target === registrationDialog) registrationDialog.close();
});

registrationForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (registrationSubmit.disabled) return;

    const fullName = registrationName.value.trim().replace(/\s+/g, " ");
    const nim = registrationNim.value.trim();
    const code = normalizeActivationCode(registrationCode.value);
    const password = registrationPassword.value;
    const confirmPassword = registrationConfirm.value;

    if (!fullName || !/^\d{5,24}$/.test(nim)) {
        registrationMessage.textContent = "Periksa kembali nama lengkap dan NIM. NIM harus berupa 5–24 digit.";
        registrationMessage.dataset.type = "error";
        return;
    }
    if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) {
        registrationMessage.textContent = "Format kode aktivasi tidak valid. Periksa kembali kode dari admin.";
        registrationMessage.dataset.type = "error";
        return;
    }
    if (password.length < 8) {
        registrationMessage.textContent = "Password harus terdiri dari minimal 8 karakter.";
        registrationMessage.dataset.type = "error";
        return;
    }
    if (password !== confirmPassword) {
        registrationMessage.textContent = "Konfirmasi password belum sama.";
        registrationMessage.dataset.type = "error";
        return;
    }

    registrationSubmit.disabled = true;
    registrationSubmit.querySelector("span").textContent = "Activating…";
    registrationMessage.textContent = "Memeriksa kode aktivasi…";
    registrationMessage.dataset.type = "info";

    let createdCredential = null;
    let profileCommitted = false;

    try {
        await authReady;
        const codeHash = await hashActivationCode(code);
        const activationRef = doc(db, "activationCodes", codeHash);
        const activationSnapshot = await getDoc(activationRef);

        if (!activationSnapshot.exists()) {
            throw new Error("Kode aktivasi tidak ditemukan. Pastikan kode yang dimasukkan benar.");
        }

        const activation = activationSnapshot.data();
        if (activation.status !== "available" ||
            activation.nim !== nim ||
            normalizeStudentName(activation.fullName) !== normalizeStudentName(fullName)) {
            throw new Error("Kode tidak cocok dengan nama dan NIM ini, atau sudah pernah digunakan.");
        }
        // Use the official name bound to the activation code as the canonical profile name.
        const verifiedFullName = String(activation.fullName);

        const emailAlias = usernameToAuthEmail(nim);
        createdCredential = await createUserWithEmailAndPassword(auth, emailAlias, password);
        await updateProfile(createdCredential.user, { displayName: verifiedFullName });

        const batch = writeBatch(db);
        batch.set(doc(db, "users", createdCredential.user.uid), {
            fullName: verifiedFullName,
            username: nim,
            nim,
            role: "student",
            isActive: true,
            birthDate: "",
            slogan: "",
            activationCodeHash: codeHash,
            createdAt: serverTimestamp()
        });
        batch.set(doc(db, "nimIndex", nim), {
            uid: createdCredential.user.uid,
            fullName: verifiedFullName,
            isActive: true
        });
        batch.update(activationRef, {
            status: "redeemed",
            redeemedBy: createdCredential.user.uid,
            redeemedAt: serverTimestamp()
        });
        await batch.commit();
        profileCommitted = true;

        registrationForm.reset();
        registrationDialog.close();
        loginDialog.close();

        avatar.textContent = initials(verifiedFullName);
        nameLabel.textContent = verifiedFullName;
        metaLabel.textContent = "Student";
        loginButton.hidden = true;
        profileLink.hidden = false;
        logoutButton.hidden = false;
        portalLink.textContent = "Open Academic Results";
        portalLink.href = "academic.html";

        if (returnTarget === "academic.html") {
            window.location.assign("academic.html");
        }
    } catch (error) {
        if (createdCredential?.user && !profileCommitted) {
            try {
                await deleteUser(createdCredential.user);
            } catch (cleanupError) {
                console.error("Could not remove the incomplete Auth account after registration failed:", cleanupError);
                try { await signOut(auth); } catch (_) {}
            }
        }

        const message = error.code === "auth/email-already-in-use"
            ? "Akun untuk NIM ini sudah pernah dibuat. Coba login atau hubungi admin."
            : error.code === "auth/weak-password"
                ? "Password terlalu lemah. Gunakan minimal 8 karakter."
                : error.code === "permission-denied"
                    ? "Registrasi ditolak oleh aturan keamanan. Pastikan kode sudah diaktifkan admin dan Rules terbaru sudah di-deploy."
                    : error.message || "Registrasi belum berhasil. Periksa data lalu coba lagi.";
        registrationMessage.textContent = message;
        registrationMessage.dataset.type = "error";
    } finally {
        registrationSubmit.disabled = false;
        registrationSubmit.querySelector("span").textContent = "Create Account";
    }
});


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
