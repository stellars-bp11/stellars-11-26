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
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* DOM references */
const loginView = document.getElementById("loginView");
const portalView = document.getElementById("portalView");
const academicSignInLink = document.getElementById("academicSignInLink");
const academicAccessMessage = document.getElementById("academicAccessMessage");

const profileArea = document.getElementById("profileArea");
const profileMenuButton = document.getElementById("profileMenuButton");
const profileMenu = document.getElementById("profileMenu");
const logoutButton = document.getElementById("logoutButton");
const openProfileButton = document.getElementById("openProfileButton");
const profileDialog = document.getElementById("profileDialog");
const closeProfileDialog = document.getElementById("closeProfileDialog");
const profileDetailsForm = document.getElementById("profileDetailsForm");
const profileBirthDateInput = document.getElementById("profileBirthDate");
const profileSloganInput = document.getElementById("profileSlogan");
const profileSaveMessage = document.getElementById("profileSaveMessage");
const saveProfileButton = document.getElementById("saveProfileButton");
const portalPersonalSlogan = document.getElementById("portalPersonalSlogan");

const studentView = document.getElementById("studentView");
const adminView = document.getElementById("adminView");
const resultsNotice = document.getElementById("resultsNotice");
const resultsContainer = document.getElementById("resultsContainer");

const academicWorkspace = document.getElementById("academicImportWorkspace");
const academicWorkspaceLauncher = document.getElementById("openAcademicWorkspace");
const academicWorkspaceBack = document.getElementById("closeAcademicWorkspace");
const academicWorkspaceCard = document.querySelector(".academic-grade-card");
const academicImportStatus = document.getElementById("academicImportStatus");

let academicWorkspaceShellBound = false;

function bindAcademicWorkspaceShell() {
    if (academicWorkspaceShellBound) return;
    academicWorkspaceShellBound = true;

    academicWorkspaceLauncher?.addEventListener("click", () => {
        if (!academicWorkspace || !academicWorkspaceCard) return;
        academicWorkspace.hidden = false;
        academicWorkspaceCard.hidden = true;
        academicWorkspace.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    academicWorkspaceBack?.addEventListener("click", () => {
        if (!academicWorkspace || !academicWorkspaceCard) return;
        academicWorkspace.hidden = true;
        academicWorkspaceCard.hidden = false;
        academicWorkspaceCard.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

bindAcademicWorkspaceShell();

let currentProfile = null;
let currentAuthUser = null;
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

function showLogin(message = "") {
    currentProfile = null;
    currentAuthUser = null;
    loginView.hidden = false;
    portalView.hidden = true;
    profileArea.hidden = true;
    academicSignInLink.hidden = false;
    closeProfileMenu();

    if (academicAccessMessage) {
        academicAccessMessage.textContent = message;
        academicAccessMessage.hidden = !message;
    }
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
    document.getElementById("profileMenuName").textContent = fullName;
    document.getElementById("profileMenuNim").textContent = nim;

    document.getElementById("profileDialogName").textContent = fullName;
    document.getElementById("profileDialogUsername").textContent = profile.username || "—";
    document.getElementById("profileDialogNim").textContent = nim;
    document.getElementById("profileDialogRole").textContent = role;
    profileBirthDateInput.value = profile.birthDate || "";
    profileSloganInput.value = profile.slogan || "";
    profileSaveMessage.textContent = "";

    portalPersonalSlogan.textContent =
        profile.slogan || "Together we shine beyond the limits.";

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
    academicSignInLink.hidden = true;

    const isStudent = profile.role === "student";
    const isAdmin = profile.role === "admin" ||
                    profile.role === "superAdmin" ||
                    profile.role === "super_admin";

    studentView.hidden = !isStudent;
    adminView.hidden = !isAdmin;

    if (isAdmin) {
        import("./academic-import.js")
            .then(({ initAcademicImport }) => {
                initAcademicImport(profile, authUser);
            })
            .catch((error) => {
                console.error("Academic importer could not be initialized:", error);
                if (academicImportStatus) {
                    academicImportStatus.textContent =
                        "Importer module failed to load. Please sync the latest feature branch and refresh. " +
                        (error?.message || "");
                    academicImportStatus.dataset.type = "error";
                }
            });
    }

    if (isStudent) {
        loadStudentResults(authUser.uid);
    } else {
        resultsContainer.replaceChildren();
    }

    // The home-page account menu can deep-link to the profile editor.
    if (new URLSearchParams(window.location.search).get("profile") === "1") {
        if (typeof profileDialog.showModal === "function") profileDialog.showModal();
        window.history.replaceState({}, "", window.location.pathname);
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
            where("studentId", "==", studentId),
            where("isPublished", "==", true)
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

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));

        if (!profileSnapshot.exists()) {
            await signOut(auth);
            showLogin("Akun belum memiliki profil STELLARS. Hubungi administrator.");
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
        showLogin(
            error.code === "permission-denied"
                ? "Akses profil belum diizinkan. Periksa Firestore Security Rules."
                : "Profil akun belum bisa dimuat. Periksa koneksi dan coba lagi."
        );
    }
}

/* Login is handled once from the main STELLARS website. */

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
    profileSaveMessage.textContent = "";
    if (typeof profileDialog.showModal === "function") profileDialog.showModal();
});

profileDetailsForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentAuthUser || !currentProfile) return;

    const birthDate = profileBirthDateInput.value;
    const slogan = profileSloganInput.value.trim().slice(0, 120);

    saveProfileButton.disabled = true;
    saveProfileButton.textContent = "Saving…";
    profileSaveMessage.textContent = "";

    try {
        await updateDoc(doc(db, "users", currentAuthUser.uid), {
            birthDate,
            slogan
        });

        currentProfile = { ...currentProfile, birthDate, slogan };
        portalPersonalSlogan.textContent =
            slogan || "Together we shine beyond the limits.";
        profileSaveMessage.textContent = "Profile berhasil disimpan.";
        profileSaveMessage.dataset.type = "success";
    } catch (error) {
        console.error("Unable to save profile details:", error);
        profileSaveMessage.textContent =
            error.code === "permission-denied"
                ? "Akses penyimpanan belum diizinkan. Perbarui Firestore Rules terlebih dahulu."
                : "Profil belum berhasil disimpan. Coba lagi.";
        profileSaveMessage.dataset.type = "error";
    } finally {
        saveProfileButton.disabled = false;
        saveProfileButton.textContent = "Save Profile";
    }
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
        showLogin();
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
