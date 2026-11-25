import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
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

const securityMenuButton = document.createElement("button");
securityMenuButton.type = "button";
securityMenuButton.id = "siteAccountSecurityButton";
securityMenuButton.className = "site-account-security-button";
securityMenuButton.textContent = "Secure My Account";
securityMenuButton.hidden = true;
menu.insertBefore(securityMenuButton, portalLink);

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
    '<input id="siteLoginUsername" name="username" type="text" placeholder="Enter your current username or NIM" autocomplete="username" autocapitalize="words" required>' +
    '<label for="siteLoginPassword">Password</label>' +
    '<input id="siteLoginPassword" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required>' +
    '<p class="site-login-message" id="siteLoginMessage" role="status" aria-live="polite"></p>' +
    '<button class="site-login-submit" id="siteLoginSubmit" type="submit"><span>Sign In</span><span aria-hidden="true">→</span></button>' +
    '<button class="site-login-register-link" id="siteLoginRegisterButton" type="button">New student? Activate your account</button>' +
    '<p class="site-login-footnote">Existing members: use your current username and password. New students: use NIM after activating your account.</p>' +
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
registrationDialog.innerHTML = `
    <form id="siteRegistrationForm" class="site-login-form" novalidate>
        <div class="site-login-top">
            <span class="site-login-mark" aria-hidden="true">✦</span>
            <button class="site-login-close" id="siteRegistrationClose" type="button" aria-label="Close registration">×</button>
        </div>

        <p class="site-login-kicker" id="siteRegistrationStepLabel">STEP 1 OF 2 · STUDENT VERIFICATION</p>
        <h2 id="siteRegistrationTitle">Verify your student details.</h2>
        <p class="site-login-copy" id="siteRegistrationCopy">
            Enter the official name and NIM registered by STELLARS, together with your personal activation code.
        </p>

        <section class="site-registration-step" id="siteRegistrationIdentityStep">
            <label for="siteRegistrationName">Full name</label>
            <input id="siteRegistrationName" name="fullName" type="text"
                   autocomplete="name" placeholder="Your registered full name"
                   maxlength="100" required>

            <label for="siteRegistrationNim">NIM</label>
            <input id="siteRegistrationNim" name="nim" type="text"
                   inputmode="numeric" autocomplete="off"
                   placeholder="Your student number" maxlength="24" required>

            <label for="siteRegistrationCode">Personal activation code</label>
            <input id="siteRegistrationCode" name="activationCode" type="text"
                   autocomplete="off" autocapitalize="characters" spellcheck="false"
                   placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="19" required>

            <p class="site-register-field-note">
                The code is personal and can only be used for the matching student name and NIM.
            </p>
        </section>

        <section class="site-registration-step" id="siteRegistrationPasswordStep" hidden>
            <div class="site-registration-summary" id="siteRegistrationVerifiedSummary" aria-live="polite"></div>

            <label for="siteRegistrationPassword">Create password</label>
            <input id="siteRegistrationPassword" name="password" type="password"
                   autocomplete="new-password" minlength="8"
                   placeholder="At least 8 characters">

            <label for="siteRegistrationConfirm">Confirm password</label>
            <input id="siteRegistrationConfirm" name="confirmPassword" type="password"
                   autocomplete="new-password" minlength="8"
                   placeholder="Repeat your password">
        </section>

        <p class="site-login-message" id="siteRegistrationMessage" role="status" aria-live="polite"></p>

        <button class="site-login-submit" id="siteRegistrationSubmit" type="submit">
            <span>Verify Student Details</span><span aria-hidden="true">→</span>
        </button>
        <button class="site-login-register-link" id="siteRegistrationEditDetails" type="button" hidden>
            Back to student details
        </button>
        <button class="site-login-register-link" id="siteRegistrationBack" type="button">
            Back to Sign In
        </button>

        <p class="site-login-footnote">
            Your NIM identifies your academic records. It is not your password. Keep your password private.
        </p>
    </form>`;
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
const registrationStepLabel = document.getElementById("siteRegistrationStepLabel");
const registrationTitle = document.getElementById("siteRegistrationTitle");
const registrationCopy = document.getElementById("siteRegistrationCopy");
const registrationIdentityStep = document.getElementById("siteRegistrationIdentityStep");
const registrationPasswordStep = document.getElementById("siteRegistrationPasswordStep");
const registrationVerifiedSummary = document.getElementById("siteRegistrationVerifiedSummary");
const registrationEditDetails = document.getElementById("siteRegistrationEditDetails");
let verifiedActivation = null;
let registrationBusy = false;

const securityDialog = document.createElement("dialog");
securityDialog.className = "site-login-dialog";
securityDialog.id = "siteAccountSecurityDialog";
securityDialog.setAttribute("aria-labelledby", "siteAccountSecurityTitle");
securityDialog.innerHTML = '<form id="siteAccountSecurityForm" class="site-login-form">' +
    '<div class="site-login-top"><span class="site-login-mark" aria-hidden="true">✦</span>' +
    '<button class="site-login-close" id="siteAccountSecurityClose" type="button" aria-label="Close password update">×</button></div>' +
    '<p class="site-login-kicker">STELLARS BP11 · ACCOUNT SECURITY</p>' +
    '<h2 id="siteAccountSecurityTitle">Secure your account.</h2>' +
    '<p class="site-login-copy" id="siteAccountSecurityCopy">Students must verify with their personal activation code. Super Admins only need their current password to set a new one.</p>' +
    '<label for="siteSecurityCurrentPassword">Current password</label>' +
    '<input id="siteSecurityCurrentPassword" type="password" autocomplete="current-password" placeholder="Your current password" required>' +
    '<label for="siteSecurityCode">Personal activation code</label>' +
    '<input id="siteSecurityCode" type="text" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="19">' +
    '<label for="siteSecurityNewPassword">New password</label>' +
    '<input id="siteSecurityNewPassword" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>' +
    '<label for="siteSecurityConfirmPassword">Confirm new password</label>' +
    '<input id="siteSecurityConfirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Repeat your new password" required>' +
    '<p class="site-login-message" id="siteAccountSecurityMessage" role="status" aria-live="polite"></p>' +
    '<button class="site-login-submit" id="siteAccountSecuritySubmit" type="submit"><span>Update Password</span><span aria-hidden="true">→</span></button>' +
    '<p class="site-login-footnote">Your existing STELLARS account and academic results stay connected to the same account ID.</p>' +
    '</form>';
document.body.append(securityDialog);

const securityForm = document.getElementById("siteAccountSecurityForm");
const securityCurrentPassword = document.getElementById("siteSecurityCurrentPassword");
const securityCode = document.getElementById("siteSecurityCode");
const securityCodeLabel = securityForm.querySelector('label[for="siteSecurityCode"]');
const securityCopy = document.getElementById("siteAccountSecurityCopy");
const securityNewPassword = document.getElementById("siteSecurityNewPassword");
const securityConfirmPassword = document.getElementById("siteSecurityConfirmPassword");
const securityMessage = document.getElementById("siteAccountSecurityMessage");
const securitySubmit = document.getElementById("siteAccountSecuritySubmit");
const securityClose = document.getElementById("siteAccountSecurityClose");



const authReady = setPersistence(auth, browserLocalPersistence);
let registrationInProgress = false;
const pageParams = new URLSearchParams(window.location.search);
let shouldAutoOpenLogin = pageParams.get("login") === "1";
let shouldAutoOpenSecurity = pageParams.get("security") === "1";
const returnTarget = pageParams.get("return");

// Consume the one-time URL flags while retaining their in-memory actions.
if (shouldAutoOpenLogin || shouldAutoOpenSecurity || returnTarget) {
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

function setRegistrationMessage(message, type = "") {
    registrationMessage.textContent = message || "";
    registrationMessage.dataset.type = message ? type : "";
}

function showRegistrationIdentityStep() {
    verifiedActivation = null;
    registrationIdentityStep.hidden = false;
    registrationPasswordStep.hidden = true;
    registrationEditDetails.hidden = true;
    registrationStepLabel.textContent = "STEP 1 OF 2 · STUDENT VERIFICATION";
    registrationTitle.textContent = "Verify your student details.";
    registrationCopy.textContent =
        "Enter the official name and NIM registered by STELLARS, together with your personal activation code.";
    registrationSubmit.querySelector("span").textContent = "Verify Student Details";
    registrationPassword.value = "";
    registrationConfirm.value = "";
    setRegistrationMessage("");
}

function resetRegistrationFlow() {
    registrationForm.reset();
    showRegistrationIdentityStep();
}

function openRegistrationDialog() {
    closeMenu();
    loginDialog.close();
    resetRegistrationFlow();
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

async function openSecurityDialog() {
    closeMenu();
    securityMessage.textContent = "";
    securityMessage.dataset.type = "";
    securityForm.reset();

    // Default to the student flow until the signed-in profile confirms Super Admin.
    securityCodeLabel.hidden = false;
    securityCode.hidden = false;
    securityCopy.textContent = "Students must verify with their personal activation code. Super Admins only need their current password to set a new one.";

    const currentUser = auth.currentUser;
    if (currentUser) {
        try {
            await authReady;
            const profileSnapshot = await getDoc(doc(db, "users", currentUser.uid));
            const role = profileSnapshot.exists()
                ? String(profileSnapshot.data().role || "").trim().toLowerCase()
                : "";
            const isSuperAdmin = ["superadmin", "super_admin"].includes(role);

            securityCodeLabel.hidden = isSuperAdmin;
            securityCode.hidden = isSuperAdmin;
            securityCopy.textContent = isSuperAdmin
                ? "Super Admin verification: enter your current password, then choose a new password. No activation code is required."
                : "Student verification: enter your current password and personal activation code, then choose a new password.";
        } catch (error) {
            console.error("Could not determine STELLARS account role:", error);
            securityMessage.textContent = "Jenis akun belum dapat diverifikasi. Muat ulang halaman dan coba lagi.";
            securityMessage.dataset.type = "error";
        }
    }

    if (!securityDialog.open) securityDialog.showModal();
    securityCurrentPassword.focus();
}

securityMenuButton.addEventListener("click", openSecurityDialog);
securityClose.addEventListener("click", () => securityDialog.close());
securityDialog.addEventListener("click", event => {
    if (event.target === securityDialog) securityDialog.close();
});

securityForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (securitySubmit.disabled) return;

    const currentUser = auth.currentUser;
    const currentPassword = securityCurrentPassword.value;
    const code = normalizeActivationCode(securityCode.value);
    const newPassword = securityNewPassword.value;
    const confirmPassword = securityConfirmPassword.value;

    if (!currentUser) {
        securityMessage.textContent = "Sesi login sudah berakhir. Login kembali menggunakan akun lama.";
        securityMessage.dataset.type = "error";
        return;
    }
    if (newPassword.length < 8) {
        securityMessage.textContent = "Password baru harus minimal 8 karakter.";
        securityMessage.dataset.type = "error";
        return;
    }
    if (newPassword !== confirmPassword) {
        securityMessage.textContent = "Konfirmasi password baru belum sama.";
        securityMessage.dataset.type = "error";
        return;
    }
    if (newPassword === currentPassword) {
        securityMessage.textContent = "Password baru harus berbeda dari password lama.";
        securityMessage.dataset.type = "error";
        return;
    }

    securitySubmit.disabled = true;
    securitySubmit.querySelector("span").textContent = "Securing…";
    securityMessage.textContent = "Memeriksa akun dan verifikasi password…";
    securityMessage.dataset.type = "info";

    let passwordUpdated = false;
    let activationRef = null;
    let isSuperAdmin = false;
    try {
        await authReady;
        const profileSnapshot = await getDoc(doc(db, "users", currentUser.uid));
        if (!profileSnapshot.exists()) throw new Error("Profil akun tidak ditemukan.");
        const profile = profileSnapshot.data();

        const eligibleRoles = ["student", "admin", "superAdmin", "super_admin"];
        if (!eligibleRoles.includes(profile.role) || profile.isActive !== true) {
            throw new Error("Secure My Account hanya tersedia untuk akun STELLARS yang aktif.");
        }

        const normalizedRole = String(profile.role || "").trim().toLowerCase();
        isSuperAdmin = ["superadmin", "super_admin"].includes(normalizedRole);

        // Only student and regular admin accounts need a one-time activation code.
        if (!isSuperAdmin) {
            const profileNim = String(profile.nim ?? "").trim();
            if (!profileNim) {
                throw new Error("Profil akun ini belum memiliki NIM. Minta admin melengkapi NIM akun terlebih dahulu agar kode aktivasi bisa dicocokkan.");
            }
            if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) {
                throw new Error("Format kode aktivasi tidak valid.");
            }

            const codeHash = await hashActivationCode(code);
            const candidateActivationRef = doc(db, "activationCodes", codeHash);
            const activationSnapshot = await getDoc(candidateActivationRef);
            if (!activationSnapshot.exists()) {
                throw new Error("Kode aktivasi tidak ditemukan. Pastikan kode yang dimasukkan benar.");
            }

            const activation = activationSnapshot.data();
            const identityMatches =
                String(activation.nim || "").trim() === profileNim &&
                normalizeStudentName(activation.fullName) === normalizeStudentName(profile.fullName);
            const unusedCode = activation.status === "available";
            const alreadyOwnedByThisAccount =
                activation.status === "redeemed" &&
                activation.redeemedBy === currentUser.uid;

            if (!identityMatches || (!unusedCode && !alreadyOwnedByThisAccount)) {
                throw new Error("Kode tidak cocok dengan akun ini, atau sudah digunakan oleh akun lain.");
            }

            // A code already redeemed by this exact UID is valid for securing
            // that existing account; do not try to redeem it a second time.
            if (unusedCode) activationRef = candidateActivationRef;
        }

        if (!currentUser.email) throw new Error("Identitas login akun tidak tersedia. Hubungi admin STELLARS.");
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        passwordUpdated = true;

        if (activationRef) {
            const batch = writeBatch(db);
            batch.update(activationRef, {
                status: "redeemed",
                redeemedBy: currentUser.uid,
                redeemedAt: serverTimestamp()
            });
            await batch.commit();
        }

        securityForm.reset();
        securityDialog.close();
        alert(isSuperAdmin
            ? "Password Super Admin berhasil diperbarui."
            : "Password berhasil diperbarui. Akun dan riwayat nilai kamu tetap sama.");
    } catch (error) {
        console.error("Could not secure STELLARS student account:", error);
        let message = error.message || "Password belum berhasil diperbarui.";
        if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
            message = "Password lama tidak sesuai. Gunakan password yang biasa dipakai untuk login.";
        } else if (error.code === "auth/weak-password") {
            message = "Password baru terlalu lemah. Gunakan minimal 8 karakter.";
        } else if (error.code === "auth/requires-recent-login") {
            message = "Sesi perlu diperbarui. Logout, login lagi dengan akun lama, lalu ulangi proses ini.";
        } else if (error.code === "permission-denied" && passwordUpdated && activationRef) {
            message = "Password akun sudah berubah, tetapi kode belum berhasil ditandai terpakai. Jangan bagikan kode ini; hubungi admin untuk pemeriksaan.";
        } else if (error.code === "permission-denied") {
            message = "Aturan keamanan belum mengizinkan proses ini. Pastikan Firestore Rules terbaru sudah di-deploy.";
        }
        securityMessage.textContent = message;
        securityMessage.dataset.type = "error";
    } finally {
        securitySubmit.disabled = false;
        securitySubmit.querySelector("span").textContent = "Update Password";
    }
});



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

registrationCode.addEventListener("input", () => {
    const compact = normalizeActivationCode(registrationCode.value)
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 16);
    registrationCode.value = compact.match(/.{1,4}/g)?.join("-") || "";
});

registrationEditDetails.addEventListener("click", () => {
    showRegistrationIdentityStep();
    registrationName.focus();
});

registrationForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (registrationBusy || registrationSubmit.disabled) return;

    // Stage 1: verify the activation code and its registered student identity.
    if (!verifiedActivation) {
        const fullName = registrationName.value.trim().replace(/\s+/g, " ");
        const nim = registrationNim.value.trim();
        const code = normalizeActivationCode(registrationCode.value);

        if (!fullName || fullName.length > 100 || !/^\d{5,24}$/.test(nim)) {
            setRegistrationMessage(
                "Periksa kembali nama lengkap dan NIM. NIM harus terdiri dari 5–24 digit.",
                "error"
            );
            return;
        }

        if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) {
            setRegistrationMessage(
                "Kode aktivasi harus terdiri dari 16 karakter. Periksa kembali kode dari admin.",
                "error"
            );
            return;
        }

        registrationBusy = true;
        registrationSubmit.disabled = true;
        registrationSubmit.querySelector("span").textContent = "Verifying…";
        setRegistrationMessage("Memeriksa nama, NIM, dan kode aktivasi…", "info");

        try {
            await authReady;
            const codeHash = await hashActivationCode(code);
            const activationRef = doc(db, "activationCodes", codeHash);
            const activationSnapshot = await getDoc(activationRef);

            if (!activationSnapshot.exists()) {
                throw new Error("Kode aktivasi tidak ditemukan. Pastikan admin sudah mendaftarkan kode tersebut.");
            }

            const activation = activationSnapshot.data() || {};
            if (activation.status !== "available") {
                throw new Error(
                    activation.status === "redeemed"
                        ? "Kode ini sudah pernah digunakan. Silakan Sign In dengan akun yang sudah dibuat."
                        : "Kode aktivasi ini tidak lagi tersedia. Hubungi admin STELLARS."
                );
            }

            const officialName = String(activation.fullName || "").trim();
            const registeredNim = String(activation.nim || "").trim();

            if (registeredNim !== nim ||
                normalizeStudentName(officialName) !== normalizeStudentName(fullName)) {
                throw new Error("Nama lengkap dan NIM tidak cocok dengan kode aktivasi ini. Periksa data yang diberikan admin.");
            }

            verifiedActivation = {
                codeHash,
                nim,
                fullName: officialName
            };

            registrationVerifiedSummary.textContent =
                "Student verified: " + officialName + " · NIM " + nim;
            registrationIdentityStep.hidden = true;
            registrationPasswordStep.hidden = false;
            registrationEditDetails.hidden = false;
            registrationStepLabel.textContent = "STEP 2 OF 2 · CREATE YOUR PASSWORD";
            registrationTitle.textContent = "Secure your account.";
            registrationCopy.textContent =
                "Your student details are verified. Create a password that you will use whenever you sign in to STELLARS.";
            registrationSubmit.querySelector("span").textContent = "Create Account";
            setRegistrationMessage("Student details verified. You can now create your password.", "success");
            registrationPassword.focus();
        } catch (error) {
            console.error("STELLARS student verification failed:", error);
            setRegistrationMessage(
                error.message || "Student verification failed. Check your details and try again.",
                "error"
            );
        } finally {
            registrationBusy = false;
            registrationSubmit.disabled = false;
            if (!verifiedActivation) {
                registrationSubmit.querySelector("span").textContent = "Verify Student Details";
            }
        }
        return;
    }

    // Stage 2: create the password and commit Auth/profile/NIM/code records atomically.
    const password = registrationPassword.value;
    const confirmPassword = registrationConfirm.value;

    if (password.length < 8) {
        setRegistrationMessage("Password harus terdiri dari minimal 8 karakter.", "error");
        registrationPassword.focus();
        return;
    }
    if (password !== confirmPassword) {
        setRegistrationMessage("Konfirmasi password belum sama.", "error");
        registrationConfirm.focus();
        return;
    }

    registrationBusy = true;
    registrationInProgress = true;
    registrationSubmit.disabled = true;
    registrationEditDetails.disabled = true;
    registrationSubmit.querySelector("span").textContent = "Creating account…";
    setRegistrationMessage("Membuat akun STELLARS dan menghubungkan NIM kamu…", "info");

    let createdCredential = null;
    let profileCommitted = false;

    try {
        await authReady;

        // Re-check the one-time code immediately before account creation.
        const activationRef = doc(db, "activationCodes", verifiedActivation.codeHash);
        const activationSnapshot = await getDoc(activationRef);
        if (!activationSnapshot.exists()) {
            throw new Error("Kode aktivasi tidak lagi ditemukan. Kembali ke tahap pertama dan hubungi admin.");
        }

        const activation = activationSnapshot.data() || {};
        if (activation.status !== "available" ||
            String(activation.nim || "").trim() !== verifiedActivation.nim ||
            normalizeStudentName(activation.fullName) !== normalizeStudentName(verifiedActivation.fullName)) {
            throw new Error("Kode aktivasi sudah digunakan atau data mahasiswa berubah. Ulangi verifikasi dari tahap pertama.");
        }

        const emailAlias = usernameToAuthEmail(verifiedActivation.nim);
        createdCredential = await createUserWithEmailAndPassword(auth, emailAlias, password);
        await updateProfile(createdCredential.user, { displayName: verifiedActivation.fullName });

        const batch = writeBatch(db);
        batch.set(doc(db, "users", createdCredential.user.uid), {
            fullName: verifiedActivation.fullName,
            username: verifiedActivation.nim,
            nim: verifiedActivation.nim,
            role: "student",
            isActive: true,
            birthDate: "",
            slogan: "",
            activationCodeHash: verifiedActivation.codeHash,
            createdAt: serverTimestamp()
        });
        batch.set(doc(db, "nimIndex", verifiedActivation.nim), {
            uid: createdCredential.user.uid,
            fullName: verifiedActivation.fullName,
            isActive: true
        });
        batch.update(activationRef, {
            status: "redeemed",
            redeemedBy: createdCredential.user.uid,
            redeemedAt: serverTimestamp()
        });
        await batch.commit();
        profileCommitted = true;

        const createdName = verifiedActivation.fullName;
        registrationForm.reset();
        verifiedActivation = null;
        registrationDialog.close();
        loginDialog.close();

        avatar.textContent = initials(createdName);
        nameLabel.textContent = createdName;
        metaLabel.textContent = "Student";
        loginButton.hidden = true;
        profileLink.hidden = false;
        logoutButton.hidden = false;
        securityMenuButton.hidden = false;
        portalLink.textContent = "Open Academic Results";
        portalLink.href = "academic.html";

        if (returnTarget === "academic.html") {
            window.location.assign("academic.html");
        }
    } catch (error) {
        console.error("STELLARS account creation failed:", error);

        if (createdCredential?.user && !profileCommitted) {
            try {
                await deleteUser(createdCredential.user);
            } catch (cleanupError) {
                console.error("Could not remove incomplete Auth account:", cleanupError);
                try { await signOut(auth); } catch (signOutError) {
                    console.error("Could not sign out incomplete Auth session:", signOutError);
                }
            }
        }

        let message = error.message || "Akun belum berhasil dibuat. Periksa data lalu coba lagi.";
        if (error.code === "auth/email-already-in-use") {
            message = "Akun untuk NIM ini sudah pernah dibuat. Silakan Sign In dengan akun tersebut.";
        } else if (error.code === "auth/weak-password") {
            message = "Password terlalu lemah. Gunakan minimal 8 karakter.";
        } else if (error.code === "permission-denied") {
            message = "Firestore menolak penyimpanan profil. NIM ini mungkin sudah terhubung ke akun lain, atau aturan keamanan perlu diperiksa. Jangan gunakan kode berulang kali; hubungi admin bila masalah berlanjut.";
        } else if (error.code === "auth/network-request-failed") {
            message = "Koneksi terputus saat membuat akun. Periksa internet sebelum mencoba kembali.";
        }
        setRegistrationMessage(message, "error");

        if (/kode aktivasi|data mahasiswa berubah/i.test(message)) {
            showRegistrationIdentityStep();
            setRegistrationMessage(message, "error");
        }

        // The observer ignores temporary Auth changes during provisioning.
        if (!profileCommitted && auth.currentUser) {
            try { await signOut(auth); } catch (signOutError) {
                console.error("Could not clear incomplete registration session:", signOutError);
            }
        }
    } finally {
        registrationInProgress = false;
        registrationBusy = false;
        registrationSubmit.disabled = false;
        registrationEditDetails.disabled = false;
        registrationSubmit.querySelector("span").textContent =
            verifiedActivation ? "Create Account" : "Verify Student Details";
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
        if (registrationInProgress) return;

        if (!user) {
            avatar.textContent = "★";
            nameLabel.textContent = "Welcome, Star!";
            metaLabel.textContent = "Not signed in";
            loginButton.hidden = false;
            portalLink.textContent = "Academic Results";
            portalLink.href = "academic.html";
            profileLink.hidden = true;
            logoutButton.hidden = true;
            securityMenuButton.hidden = true;

            if ((shouldAutoOpenLogin || shouldAutoOpenSecurity) && !loginDialog.open) {
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
                const canSecureAccount =
                    ["student", "admin", "superAdmin", "super_admin"].includes(profile.role) &&
                    profile.isActive === true;
                securityMenuButton.hidden = !canSecureAccount;

                if (shouldAutoOpenSecurity) {
                    shouldAutoOpenSecurity = false;
                    if (canSecureAccount) {
                        openSecurityDialog();
                    } else {
                        alert("Akun ini belum memenuhi syarat untuk mengubah password. Hubungi admin STELLARS.");
                    }
                }
            } else if (shouldAutoOpenSecurity) {
                shouldAutoOpenSecurity = false;
                alert("Profil akun STELLARS tidak ditemukan. Hubungi admin.");
            }
        } catch (error) {
            console.error("Could not load the STELLARS account profile:", error);
            if (shouldAutoOpenSecurity) {
                shouldAutoOpenSecurity = false;
                alert("Profil akun belum berhasil dimuat. Muat ulang halaman lalu coba lagi.");
            }
        }
    }))
    .catch(error => {
        console.error("Unable to initialize STELLARS sign-in:", error);
        loginMessage.textContent = "Layanan login belum tersedia. Periksa koneksi lalu muat ulang halaman.";
        loginMessage.dataset.type = "error";
    });
