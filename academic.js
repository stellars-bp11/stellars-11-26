/*
 * STELLARS Academic Portal
 * Firebase Authentication gate + role-aware portal shell.
 *
 * INTERNAL LOGIN ALIAS:
 * Firebase Email/Password requires an email-shaped identifier.
 * Students still enter their full name as the visible username.
 * The account provisioning script must use the exact same mapping:
 *   normalized-full-name@class-web-7241e.firebaseapp.com
 *
 * Example:
 *   "Jasper Vladino Alvis" -> "jasper.vladino.alvis@class-web-7241e.firebaseapp.com"
 *
 * If two people share a name, give each a distinct username suffix
 * (example: "Full Name 02") and provision the matching alias.
 *
 * Expected Firestore profile:
 * users/{firebaseUid}:
 * {
 *   fullName: string,
 *   username: string,
 *   nim: string,
 *   role: "student" | "admin" | "superAdmin",
 *   isActive: true
 * }
 *
 * Expected published score fields:
 * scores/{scoreId}:
 * {
 *   studentId: firebaseUid,
 *   subjectName: string,
 *   assessmentName: string,
 *   score: number,
 *   maxScore: 100,
 *   examDate: Timestamp | string | null
 * }
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* Firebase configuration reused from the existing STELLARS Library. */
const firebaseConfig = {
    apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
    authDomain: "class-web-7241e.firebaseapp.com",
    projectId: "class-web-7241e",
    storageBucket: "class-web-7241e.firebasestorage.app",
    messagingSenderId: "167560389153",
    appId: "1:167560389153:web:f61f4f821275c48373f960",
    measurementId: "G-DTHTZNT135"
};

const AUTH_ALIAS_DOMAIN = "class-web-7241e.firebaseapp.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* DOM references */
const loginView = document.getElementById("loginView");
const portalView = document.getElementById("portalView");
const loginForm = document.getElementById("academicLoginForm");
const usernameInput = document.getElementById("academicUsername");
const passwordInput = document.getElementById("academicPassword");
const togglePasswordButton = document.getElementById("togglePassword");
const formMessage = document.getElementById("academicFormMessage");
const loginSubmitButton = document.getElementById("loginSubmitButton");

const profileArea = document.getElementById("profileArea");
const profileMenuButton = document.getElementById("profileMenuButton");
const profileMenu = document.getElementById("profileMenu");
const logoutButton = document.getElementById("logoutButton");
const openProfileButton = document.getElementById("openProfileButton");
const profileDialog = document.getElementById("profileDialog");
const closeProfileDialog = document.getElementById("closeProfileDialog");

const studentView = document.getElementById("studentView");
const adminView = document.getElementById("adminView");
const resultsNotice = document.getElementById("resultsNotice");
const resultsContainer = document.getElementById("resultsContainer");

let currentProfile = null;
let currentAuthUser = null;
let isSubmitting = false;

/* Convert a full-name username into the internal Firebase email alias. */
function usernameToAuthEmail(username) {
    const normalized = String(username || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    if (!normalized) {
        throw new Error("Username tidak valid.");
    }

    return normalized + "@" + AUTH_ALIAS_DOMAIN;
}

function roleLabel(role) {
    if (role === "superAdmin" || role === "super_admin") return "Super Admin";
    if (role === "admin") return "Admin";
    if (role === "student") return "Student";
    return "Account";
}

function getInitials(name) {
    return String(name || "S")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("") || "S";
}

function setLoginMessage(message, type = "error") {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.dataset.type = type;
}

function setLoginBusy(busy) {
    isSubmitting = busy;
    if (!loginSubmitButton) return;
    loginSubmitButton.disabled = busy;
    loginSubmitButton.classList.toggle("is-loading", busy);
    const label = loginSubmitButton.querySelector("span");
    if (label) label.textContent = busy ? "Signing in…" : "Sign In";
}

function showLogin(message = "") {
    currentProfile = null;
    currentAuthUser = null;
    loginView.hidden = false;
    portalView.hidden = true;
    profileArea.hidden = true;
    closeProfileMenu();

    if (message) setLoginMessage(message);
}

function closeProfileMenu() {
    if (!profileMenu || !profileMenuButton) return;
    profileMenu.hidden = true;
    profileMenuButton.setAttribute("aria-expanded", "false");
}

function openProfileMenu() {
    if (!profileMenu || !profileMenuButton) return;
    profileMenu.hidden = false;
    profileMenuButton.setAttribute("aria-expanded", "true");
}

function showProfile(profile, authUser) {
    currentProfile = profile;
    currentAuthUser = authUser;

    const fullName = profile.fullName || authUser.displayName || "STELLARS Member";
    const nim = profile.nim || "NIM not available";
    const role = roleLabel(profile.role);

    document.getElementById("profileAvatar").textContent = getInitials(fullName);
    document.getElementById("profileButtonName").textContent = fullName;
    document.getElementById("profileButtonRole").textContent = role;
    document.getElementById("profileMenuName").textContent = fullName;
    document.getElementById("profileMenuNim").textContent = nim;

    document.getElementById("profileDialogName").textContent = fullName;
    document.getElementById("profileDialogUsername").textContent = profile.username || "—";
    document.getElementById("profileDialogNim").textContent = nim;
    document.getElementById("profileDialogRole").textContent = role;

    document.getElementById("portalWelcomeTitle").innerHTML =
        "Welcome back, <span></span>";
    document.querySelector("#portalWelcomeTitle span").textContent =
        (fullName.split(/\s+/)[0] || "Star") + ".";

    document.getElementById("portalWelcomeCopy").textContent =
        profile.role === "student"
            ? "Here are your published academic results."
            : "Manage the academic records for the STELLARS community.";

    document.getElementById("studentNimLabel").textContent = "NIM " + nim;

    loginView.hidden = true;
    portalView.hidden = false;
    profileArea.hidden = false;

    const isStudent = profile.role === "student";
    const isAdmin = profile.role === "admin" ||
                    profile.role === "superAdmin" ||
                    profile.role === "super_admin";

    studentView.hidden = !isStudent;
    adminView.hidden = !isAdmin;

    if (isStudent) {
        loadStudentResults(authUser.uid);
    } else {
        resultsContainer.replaceChildren();
    }
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
}

function formatScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(value) {
    if (!value) return "";

    let date = value;
    if (typeof value.toDate === "function") date = value.toDate();
    else if (!(value instanceof Date)) date = new Date(value);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function showResultsNotice(message, type = "info") {
    resultsNotice.dataset.type = type;
    resultsNotice.replaceChildren();
    const icon = makeElement("i", type === "error" ? "bx bx-error-circle" : "bx bx-info-circle");
    icon.setAttribute("aria-hidden", "true");
    resultsNotice.append(icon, makeElement("span", "", message));
    resultsNotice.hidden = false;
}

async function loadStudentResults(studentId) {
    resultsContainer.replaceChildren();
    showResultsNotice("Loading your published results…");

    try {
        /*
         * Security Rules must independently enforce:
         * resource.data.studentId == request.auth.uid
         * The query condition is not a substitute for Firestore Rules.
         */
        const scoresQuery = query(
            collection(db, "scores"),
            where("studentId", "==", studentId)
        );

        const snapshot = await getDocs(scoresQuery);

        if (snapshot.empty) {
            showResultsNotice("Belum ada hasil yang dipublikasikan.");
            return;
        }

        const records = snapshot.docs.map(scoreDoc => ({
            id: scoreDoc.id,
            ...scoreDoc.data()
        }));

        records.sort((a, b) => {
            const subjectCompare = String(a.subjectName || "").localeCompare(
                String(b.subjectName || ""), "id"
            );
            if (subjectCompare !== 0) return subjectCompare;
            return String(a.assessmentName || "").localeCompare(
                String(b.assessmentName || ""), "id"
            );
        });

        const groups = new Map();
        for (const record of records) {
            const subject = record.subjectName || "Mata Kuliah";
            if (!groups.has(subject)) groups.set(subject, []);
            groups.get(subject).push(record);
        }

        for (const [subjectName, assessments] of groups) {
            const card = makeElement("article", "academic-result-card");
            card.append(makeElement("h3", "", subjectName));

            const list = makeElement("div", "academic-result-list");

            for (const assessment of assessments) {
                const row = makeElement("div", "academic-result-row");
                const nameBlock = makeElement("div", "academic-result-name");
                nameBlock.append(
                    makeElement("strong", "", assessment.assessmentName || "Assessment")
                );

                const dateLabel = formatDate(assessment.examDate || assessment.publishedAt);
                if (dateLabel) nameBlock.append(makeElement("small", "", dateLabel));

                const score = assessment.score;
                const maxScore = assessment.maxScore ?? 100;
                const scoreText = score === null || score === undefined
                    ? "—"
                    : formatScore(score) + " / " + formatScore(maxScore);

                row.append(
                    nameBlock,
                    makeElement("span", "academic-result-score", scoreText)
                );
                list.append(row);
            }

            card.append(list);
            resultsContainer.append(card);
        }

        resultsNotice.hidden = true;
    } catch (error) {
        console.error("Unable to load student results:", error);
        showResultsNotice(
            "Hasil belum dapat dimuat. Pastikan profil, scores, dan Firestore Security Rules Academic Portal sudah disiapkan.",
            "error"
        );
    }
}

async function handleAuthState(user) {
    if (!user) {
        showLogin();
        return;
    }

    setLoginBusy(true);
    setLoginMessage("Checking your account…", "info");

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));

        if (!profileSnapshot.exists()) {
            await signOut(auth);
            showLogin("Akun Firebase ditemukan, tetapi profil STELLARS belum terdaftar. Hubungi Super Admin.");
            return;
        }

        const profile = profileSnapshot.data();

        if (profile.isActive !== true) {
            await signOut(auth);
            showLogin("Akun ini belum aktif. Silakan hubungi administrator STELLARS.");
            return;
        }

        if (!["student", "admin", "superAdmin", "super_admin"].includes(profile.role)) {
            await signOut(auth);
            showLogin("Role akun belum valid. Silakan hubungi administrator STELLARS.");
            return;
        }

        showProfile(profile, user);
    } catch (error) {
        console.error("Unable to load account profile:", error);
        await signOut(auth);
        showLogin(
            error.code === "permission-denied"
                ? "Login berhasil, tetapi akses profil belum disiapkan. Firestore Security Rules Academic Portal perlu dikonfigurasi terlebih dahulu."
                : "Profil akun belum bisa dimuat. Periksa konfigurasi Firebase dan hubungi administrator."
        );
    } finally {
        setLoginBusy(false);
    }
}

/* Password visibility */
if (togglePasswordButton && passwordInput) {
    togglePasswordButton.addEventListener("click", () => {
        const showPassword = passwordInput.type === "password";
        passwordInput.type = showPassword ? "text" : "password";

        const icon = togglePasswordButton.querySelector("i");
        if (icon) icon.className = showPassword ? "bx bx-hide" : "bx bx-show";

        togglePasswordButton.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );
    });
}

/* Username + password login */
loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (isSubmitting) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        setLoginMessage("Masukkan username dan password terlebih dahulu.");
        return;
    }

    let emailAlias;
    try {
        emailAlias = usernameToAuthEmail(username);
    } catch (error) {
        setLoginMessage(error.message);
        return;
    }

    setLoginBusy(true);
    setLoginMessage("Signing in…", "info");

    try {
        await signInWithEmailAndPassword(auth, emailAlias, password);
        passwordInput.value = "";
    } catch (error) {
        console.error("Academic Portal sign-in failed:", error);

        const messageByCode = {
            "auth/invalid-credential": "Username atau password tidak sesuai.",
            "auth/user-not-found": "Akun tidak ditemukan. Periksa penulisan username.",
            "auth/wrong-password": "Password tidak sesuai.",
            "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
            "auth/network-request-failed": "Koneksi bermasalah. Periksa internet lalu coba lagi."
        };

        setLoginMessage(
            messageByCode[error.code] ||
            "Login belum berhasil. Pastikan akun sudah dibuat oleh Super Admin."
        );
    } finally {
        setLoginBusy(false);
    }
});

/* Profile menu */
profileMenuButton.addEventListener("click", () => {
    if (profileMenu.hidden) openProfileMenu();
    else closeProfileMenu();
});

document.addEventListener("click", event => {
    if (!profileArea.contains(event.target)) closeProfileMenu();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeProfileMenu();
});

/* Profile dialog */
openProfileButton.addEventListener("click", () => {
    closeProfileMenu();
    if (typeof profileDialog.showModal === "function") profileDialog.showModal();
});

closeProfileDialog.addEventListener("click", () => profileDialog.close());

profileDialog.addEventListener("click", event => {
    if (event.target === profileDialog) profileDialog.close();
});

/* Logout */
logoutButton.addEventListener("click", async () => {
    closeProfileMenu();
    try {
        await signOut(auth);
        passwordInput.value = "";
        setLoginMessage("Kamu sudah logout.", "info");
    } catch (error) {
        console.error("Logout failed:", error);
        alert("Logout belum berhasil. Coba lagi.");
    }
});

/* Keep the session on the same browser until the user logs out. */
setPersistence(auth, browserLocalPersistence)
    .then(() => onAuthStateChanged(auth, handleAuthState))
    .catch(error => {
        console.error("Unable to initialize Firebase session:", error);
        showLogin("Firebase Authentication belum dapat diinisialisasi. Periksa koneksi dan konfigurasi project.");
    });
