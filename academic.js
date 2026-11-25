/*
 * STELLARS Academic Portal
 * Shared Firebase Authentication + role-aware academic workspace.
 *
 * The portal uses the same Firebase Auth identities as account.js.
 * First-time student registration creates the NIM-based email alias:
 *   202612010146@class-web-7241e.firebaseapp.com
 * Returning users sign in with the username/NIM and password they already use.
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

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    deleteUser
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const authPersistenceReady = setPersistence(auth, browserLocalPersistence);

/* DOM references */
const loginView = document.getElementById("loginView");
const portalView = document.getElementById("portalView");
const academicSignInLink = document.getElementById("academicSignInLink");
const academicAccessMessage = document.getElementById("academicAccessMessage");
const academicSignInPanel = document.getElementById("academicSignInPanel");
const academicRegisterPanel = document.getElementById("academicRegisterPanel");
const academicSignInForm = document.getElementById("academicSignInForm");
const academicLoginUsername = document.getElementById("academicLoginUsername");
const academicLoginPassword = document.getElementById("academicLoginPassword");
const academicSignInMessage = document.getElementById("academicSignInMessage");
const academicSignInSubmit = document.getElementById("academicSignInSubmit");
const academicRegisterForm = document.getElementById("academicRegisterForm");
const academicRegisterName = document.getElementById("academicRegisterName");
const academicRegisterNim = document.getElementById("academicRegisterNim");
const academicRegisterCode = document.getElementById("academicRegisterCode");
const academicRegisterPassword = document.getElementById("academicRegisterPassword");
const academicRegisterConfirm = document.getElementById("academicRegisterConfirm");
const academicRegisterMessage = document.getElementById("academicRegisterMessage");
const academicRegisterSubmit = document.getElementById("academicRegisterSubmit");
const academicOpenRegister = document.getElementById("academicOpenRegister");
const academicBackToSignIn = document.getElementById("academicBackToSignIn");

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
const studentNimLabel = document.getElementById("studentNimLabel");
const studentResultsSearch = document.getElementById("studentResultsSearch");
const studentResultsSubject = document.getElementById("studentResultsSubject");
const studentResultsSummary = document.getElementById("studentResultsSummary");
const studentResultsSubjectCount = document.getElementById("studentResultsSubjectCount");
const studentResultsComponentCount = document.getElementById("studentResultsComponentCount");
const studentResultsPublishedCount = document.getElementById("studentResultsPublishedCount");
const refreshStudentResultsButton = document.getElementById("refreshStudentResults");

const academicWorkspace = document.getElementById("academicImportWorkspace");
const academicWorkspaceLauncher = document.getElementById("openAcademicWorkspace");
const academicWorkspaceBack = document.getElementById("closeAcademicWorkspace");
const academicWorkspaceCard = document.querySelector(".academic-grade-card");
const academicImportStatus = document.getElementById("academicImportStatus");
const adminResultsNotice = document.getElementById("adminResultsNotice");
const adminResultsSearch = document.getElementById("adminResultsSearch");
const adminResultsSubject = document.getElementById("adminResultsSubject");
const adminResultsStatus = document.getElementById("adminResultsStatus");
const adminResultsSummary = document.getElementById("adminResultsSummary");
const adminResultsCards = document.getElementById("adminResultsCards");
const adminResultsNimLabel = document.getElementById("adminResultsNimLabel");
const adminResultsSubjectCount = document.getElementById("adminResultsSubjectCount");
const adminResultsComponentCount = document.getElementById("adminResultsComponentCount");
const adminResultsPublishedCount = document.getElementById("adminResultsPublishedCount");
const refreshAdminResultsButton = document.getElementById("refreshAdminResults");

let adminResultRecords = [];
let adminResultsLoading = false;
let adminResultsControlsBound = false;
let studentResultRecords = [];
let studentResultsLoading = false;
let studentResultsControlsBound = false;

let academicWorkspaceShellBound = false;
let academicRegistrationInProgress = false;

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

function setAcademicAuthMode(mode) {
    const showRegister = mode === "register";
    if (academicSignInPanel) academicSignInPanel.hidden = showRegister;
    if (academicRegisterPanel) academicRegisterPanel.hidden = !showRegister;
    if (mode === "register") academicRegisterName?.focus();
    else academicLoginUsername?.focus();
}

function setAuthMessage(element, message, type = "info") {
    if (!element) return;
    element.textContent = message || "";
    element.dataset.type = message ? type : "";
    element.hidden = !message;
}

function usernameToAuthEmail(username) {
    const normalized = String(username || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");
    if (!normalized) throw new Error("Username atau NIM tidak valid.");
    return normalized + "@class-web-7241e.firebaseapp.com";
}

function normalizeStudentName(value) {
    return String(value || "")
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("id");
}

function normalizeActivationCode(value) {
    return String(value || "").toUpperCase().replace(/[\s-]/g, "");
}

async function hashActivationCode(code) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
    return Array.from(new Uint8Array(digest), byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

function showLogin(message = "") {
    currentProfile = null;
    currentAuthUser = null;
    loginView.hidden = false;
    portalView.hidden = true;
    profileArea.hidden = true;
    academicSignInLink.hidden = false;
    setAcademicAuthMode("signin");
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
        bindAdminResultsControls();
        loadAdminResults();

        import("./activation-manager.js?v=activation-import-fix-20261125a")
            .then(({ initActivationManager }) => {
                initActivationManager(profile, authUser);
            })
            .catch((error) => {
                console.error("Activation manager could not be initialized:", error);
                const status = document.getElementById("activationManagerStatus");
                if (status) {
                    status.textContent = "Activation manager is unavailable. Refresh and try again.";
                    status.dataset.type = "error";
                }
            });

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
        if (studentNimLabel) studentNimLabel.textContent = "NIM " + nim;
        bindStudentResultsControls();
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
    const isLoading = /^(Loading|Checking)/i.test(message);
    const icon = makeElement(
        "i",
        isLoading ? "bx bx-loader-alt academic-loading-spinner"
            : type === "error" ? "bx bx-error-circle" : "bx bx-info-circle"
    );
    icon.setAttribute("aria-hidden", "true");
    resultsNotice.append(icon, makeElement("span", "", message));
    resultsNotice.hidden = false;
}

function bindStudentResultsControls() {
    if (studentResultsControlsBound) return;
    studentResultsControlsBound = true;

    refreshStudentResultsButton?.addEventListener("click", () => loadStudentResults(currentAuthUser?.uid));
    studentResultsSearch?.addEventListener("input", renderStudentResults);
    studentResultsSubject?.addEventListener("change", renderStudentResults);
}

async function loadStudentResults(studentId) {
    if (studentResultsLoading || !studentId) return;

    studentResultsLoading = true;
    if (refreshStudentResultsButton) refreshStudentResultsButton.disabled = true;
    resultsContainer.replaceChildren();
    showResultsNotice("Loading your published results…", "info");

    try {
        /*
         * Read only published import manifests first. Each score query is then
         * constrained to one sourceUploadId so Firestore Rules can verify that
         * the parent publication manifest exists and is still published.
         */
        const publishedImportsSnapshot = await getDocs(query(
            collection(db, "publishedImports"),
            where("status", "==", "published")
        ));

        const scoreSnapshots = await Promise.all(
            publishedImportsSnapshot.docs.map((publishedImport) =>
                getDocs(query(
                    collection(db, "scores"),
                    where("studentId", "==", studentId),
                    where("sourceUploadId", "==", publishedImport.id),
                    where("isPublished", "==", true)
                ))
            )
        );

        studentResultRecords = scoreSnapshots.flatMap((snapshot) =>
            snapshot.docs.map((scoreDoc) => {
                const data = scoreDoc.data() || {};
                return {
                    id: scoreDoc.id,
                    subjectName: data.subjectName || "Unnamed subject",
                    assessmentName: data.assessmentName || "Unnamed assessment",
                    score: data.score,
                    maxScore: data.maxScore ?? 100,
                    isPublished: true,
                    examDate: data.examDate || null,
                    publishedAt: data.publishedAt || null
                };
            })
        );

        studentResultRecords.sort((a, b) => {
            const subjectCompare = a.subjectName.localeCompare(b.subjectName, "id");
            if (subjectCompare !== 0) return subjectCompare;
            return a.assessmentName.localeCompare(b.assessmentName, "id");
        });

        const selectedSubject = studentResultsSubject?.value || "";
        if (studentResultsSubject) {
            const subjects = [...new Set(studentResultRecords.map((item) => item.subjectName))]
                .sort((a, b) => a.localeCompare(b, "id"));
            studentResultsSubject.replaceChildren();

            const allOption = makeElement("option", "", "All subjects");
            allOption.value = "";
            studentResultsSubject.appendChild(allOption);

            subjects.forEach((subject) => {
                const option = makeElement("option", "", subject);
                option.value = subject;
                studentResultsSubject.appendChild(option);
            });

            studentResultsSubject.value = subjects.includes(selectedSubject) ? selectedSubject : "";
        }

        if (studentResultsSubjectCount) {
            studentResultsSubjectCount.textContent = String(new Set(studentResultRecords.map((item) => item.subjectName)).size);
        }
        if (studentResultsComponentCount) {
            studentResultsComponentCount.textContent = String(studentResultRecords.length);
        }
        if (studentResultsPublishedCount) {
            studentResultsPublishedCount.textContent = String(studentResultRecords.length);
        }

        showResultsNotice(
            studentResultRecords.length
                ? "Your NIM-linked account is verified. These are your published results."
                : "Your account is ready. No results have been published for you yet.",
            "success"
        );
        renderStudentResults();
    } catch (error) {
        console.error("Unable to load student results:", error);
        studentResultRecords = [];
        if (studentResultsSubjectCount) studentResultsSubjectCount.textContent = "0";
        if (studentResultsComponentCount) studentResultsComponentCount.textContent = "0";
        if (studentResultsPublishedCount) studentResultsPublishedCount.textContent = "0";
        showResultsNotice(
            error.code === "permission-denied"
                ? "Access to your published results is not available. Check your student score access rules."
                : "Your results could not be loaded. " + (error.message || "Please try again."),
            "error"
        );
        renderPersonalScoreCards(
            resultsContainer,
            [],
            "Your results are taking a break",
            "Try refreshing in a moment. Your published scores will appear here."
        );
    } finally {
        studentResultsLoading = false;
        if (refreshStudentResultsButton) refreshStudentResultsButton.disabled = false;
    }
}

function renderStudentResults() {
    if (!resultsContainer) return;

    const search = String(studentResultsSearch?.value || "").trim().toLocaleLowerCase("id");
    const subject = studentResultsSubject?.value || "";

    const visibleRecords = studentResultRecords.filter((record) => {
        if (subject && record.subjectName !== subject) return false;
        if (!search) return true;
        return [record.subjectName, record.assessmentName]
            .some((value) => String(value).toLocaleLowerCase("id").includes(search));
    });

    renderPersonalScoreCards(
        resultsContainer,
        visibleRecords,
        studentResultRecords.length ? "Nothing in this orbit" : "Your results are on their way",
        studentResultRecords.length
            ? "Try another subject or component."
            : "Your lecturers' published scores will appear here once they are released."
    );

    if (studentResultsSummary) {
        studentResultsSummary.textContent =
            visibleRecords.length + " published component(s) shown · " +
            new Set(visibleRecords.map((item) => item.subjectName)).size + " subject(s)";
    }
}

function normalizeAcademicNim(value) {
    return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function setAdminResultsNotice(message, type = "info") {
    if (!adminResultsNotice) return;
    adminResultsNotice.textContent = message;
    adminResultsNotice.dataset.type = type;
    adminResultsNotice.hidden = false;
}

function renderPersonalScoreCardsEmpty(container, title, message) {
    if (!container) return;
    container.replaceChildren();
    const isLoading = /^(Mapping|Loading|Checking)/i.test(title);
    const empty = makeElement("div", isLoading
        ? "admin-results-empty-state is-loading"
        : "admin-results-empty-state");
    const icon = makeElement("i", isLoading
        ? "bx bx-loader-alt academic-loading-spinner"
        : "bx bx-planet");
    icon.setAttribute("aria-hidden", "true");
    empty.append(
        icon,
        makeElement("strong", "", title),
        makeElement("span", "", message)
    );
    container.appendChild(empty);
}

function renderAdminResultsEmpty(title, message) {
    renderPersonalScoreCardsEmpty(adminResultsCards, title, message);
}

function bindAdminResultsControls() {
    if (adminResultsControlsBound) return;
    adminResultsControlsBound = true;

    refreshAdminResultsButton?.addEventListener("click", () => loadAdminResults());
    adminResultsSearch?.addEventListener("input", renderAdminResults);
    adminResultsSubject?.addEventListener("change", renderAdminResults);
    adminResultsStatus?.addEventListener("change", renderAdminResults);

    window.addEventListener("academic-results-updated", () => {
        if (currentProfile && ["admin", "superAdmin", "super_admin"].includes(currentProfile.role)) {
            loadAdminResults({ silent: true });
        }
    });
}

async function loadAdminResults({ silent = false } = {}) {
    if (adminResultsLoading || !adminResultsCards) return;

    adminResultsLoading = true;
    if (refreshAdminResultsButton) refreshAdminResultsButton.disabled = true;
    if (!silent) {
        setAdminResultsNotice("Checking your registered NIM…");
        renderAdminResultsEmpty("Mapping your stars…", "Looking up the NIM connected to this account.");
    }

    try {
        const nimKey = normalizeAcademicNim(currentProfile?.nim);
        if (!nimKey || !currentAuthUser?.uid) {
            throw new Error("This admin profile does not have a registered NIM. Ask the administrator to verify the account profile.");
        }

        // Match the signed-in admin's profile NIM against the private roster.
        // Do not display scores unless that NIM resolves back to this exact Auth UID.
        const rosterSnapshot = await getDocs(collection(db, "nimIndex"));
        let rosterMatch = null;

        rosterSnapshot.forEach((memberDoc) => {
            if (normalizeAcademicNim(memberDoc.id) === nimKey) {
                const member = memberDoc.data() || {};
                rosterMatch = {
                    uid: String(member.uid || ""),
                    fullName: String(member.fullName || ""),
                    isActive: member.isActive === true
                };
            }
        });

        if (!rosterMatch || !rosterMatch.isActive || rosterMatch.uid !== currentAuthUser.uid) {
            throw new Error("The NIM on this profile does not match an active roster entry for this account. No scores were displayed.");
        }

        if (adminResultsNimLabel) {
            adminResultsNimLabel.textContent = "NIM " + (currentProfile.nim || "—");
        }

        const scoresSnapshot = await getDocs(query(
            collection(db, "scores"),
            where("studentId", "==", rosterMatch.uid)
        ));

        adminResultRecords = scoresSnapshot.docs.map((scoreDoc) => {
            const data = scoreDoc.data() || {};
            return {
                id: scoreDoc.id,
                subjectName: data.subjectName || "Unnamed subject",
                assessmentName: data.assessmentName || "Unnamed assessment",
                score: data.score,
                maxScore: data.maxScore ?? 100,
                isPublished: data.isPublished === true,
                examDate: data.examDate || null,
                publishedAt: data.publishedAt || null
            };
        });

        adminResultRecords.sort((a, b) => {
            const subjectCompare = a.subjectName.localeCompare(b.subjectName, "id");
            if (subjectCompare !== 0) return subjectCompare;
            return a.assessmentName.localeCompare(b.assessmentName, "id");
        });

        const selectedSubject = adminResultsSubject?.value || "";
        if (adminResultsSubject) {
            const subjects = [...new Set(adminResultRecords.map((item) => item.subjectName))]
                .sort((a, b) => a.localeCompare(b, "id"));
            adminResultsSubject.replaceChildren();

            const allOption = makeElement("option", "", "All subjects");
            allOption.value = "";
            adminResultsSubject.appendChild(allOption);

            subjects.forEach((subject) => {
                const option = makeElement("option", "", subject);
                option.value = subject;
                adminResultsSubject.appendChild(option);
            });

            adminResultsSubject.value = subjects.includes(selectedSubject) ? selectedSubject : "";
        }

        if (adminResultsSubjectCount) {
            adminResultsSubjectCount.textContent = String(new Set(adminResultRecords.map((item) => item.subjectName)).size);
        }
        if (adminResultsComponentCount) {
            adminResultsComponentCount.textContent = String(adminResultRecords.length);
        }
        if (adminResultsPublishedCount) {
            adminResultsPublishedCount.textContent = String(adminResultRecords.filter((item) => item.isPublished).length);
        }

        setAdminResultsNotice(
            adminResultRecords.length
                ? "NIM verified — showing only scores linked to your account. Drafts are included for your own review."
                : "NIM verified. No academic results have been recorded for this account yet.",
            "success"
        );
        renderAdminResults();
    } catch (error) {
        console.error("Unable to load personal administrator academic results:", error);
        adminResultRecords = [];
        if (adminResultsSubject) {
            adminResultsSubject.replaceChildren();
            const option = makeElement("option", "", "All subjects");
            option.value = "";
            adminResultsSubject.appendChild(option);
        }
        if (adminResultsSubjectCount) adminResultsSubjectCount.textContent = "0";
        if (adminResultsComponentCount) adminResultsComponentCount.textContent = "0";
        if (adminResultsPublishedCount) adminResultsPublishedCount.textContent = "0";
        setAdminResultsNotice(
            error.code === "permission-denied"
                ? "Access denied while verifying the NIM or reading your scores. Check the admin Firestore read rules."
                : (error.message || "Your academic results could not be loaded."),
            "error"
        );
        renderAdminResultsEmpty("We couldn't map this account", "Check that your profile NIM matches its active nimIndex record.");
        if (adminResultsSummary) adminResultsSummary.textContent = "No personal results available.";
    } finally {
        adminResultsLoading = false;
        if (refreshAdminResultsButton) refreshAdminResultsButton.disabled = false;
    }
}

function renderPersonalScoreCards(container, visibleRecords, emptyTitle, emptyMessage) {
    if (!container) return;
    container.replaceChildren();

    if (!visibleRecords.length) {
        renderPersonalScoreCardsEmpty(container, emptyTitle, emptyMessage);
        return;
    }

    const grouped = new Map();
    visibleRecords.forEach((record) => {
        if (!grouped.has(record.subjectName)) grouped.set(record.subjectName, []);
        grouped.get(record.subjectName).push(record);
    });

    grouped.forEach((records, subjectName) => {
        const card = makeElement("article", "admin-score-subject-card");

        const cardHead = makeElement("div", "admin-score-subject-head");
        const subjectIcon = makeElement("span", "admin-score-subject-icon");
        const icon = makeElement("i", "bx bx-book-heart");
        icon.setAttribute("aria-hidden", "true");
        subjectIcon.appendChild(icon);

        const subjectCopy = makeElement("div", "admin-score-subject-copy");
        subjectCopy.append(
            makeElement("small", "", "YOUR SUBJECT"),
            makeElement("h3", "", subjectName)
        );

        const itemCount = makeElement("span", "admin-score-subject-count",
            records.length + (records.length === 1 ? " ITEM" : " ITEMS"));
        cardHead.append(subjectIcon, subjectCopy, itemCount);
        card.appendChild(cardHead);

        const list = makeElement("div", "admin-score-items");
        records.forEach((record) => {
            const item = makeElement("article", "admin-score-item");
            const top = makeElement("div", "admin-score-item-top");
            const itemName = makeElement("strong", "admin-score-item-name", record.assessmentName);

            const statusBadge = makeElement(
                "span",
                "admin-score-status " + (record.isPublished ? "is-published" : "is-draft"),
                record.isPublished ? "Published" : "Draft"
            );
            top.append(itemName, statusBadge);

            const hasScore = record.score !== null &&
                record.score !== undefined &&
                Number.isFinite(Number(record.score));
            const maximum = Number(record.maxScore);
            const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 100;
            const scoreText = hasScore
                ? formatScore(record.score) + " / " + formatScore(safeMaximum)
                : "Not graded yet";

            const scoreLine = makeElement("div", "admin-score-line");
            scoreLine.append(
                makeElement("span", "", "Your score"),
                makeElement("strong", "", scoreText)
            );

            const meter = makeElement("div", "admin-score-meter");
            meter.setAttribute("role", "img");
            const percentage = hasScore
                ? Math.max(0, Math.min(100, Number(record.score) / safeMaximum * 100))
                : 0;
            meter.setAttribute(
                "aria-label",
                hasScore ? Math.round(percentage) + "% of maximum score" : "No score entered"
            );

            const fill = makeElement(
                "span",
                "admin-score-meter-fill" + (record.isPublished ? " is-published" : " is-draft")
            );
            fill.style.width = percentage + "%";
            meter.appendChild(fill);

            item.append(top, scoreLine, meter);
            list.appendChild(item);
        });

        card.appendChild(list);
        container.appendChild(card);
    });
}

function renderAdminResults() {
    if (!adminResultsCards) return;

    const search = String(adminResultsSearch?.value || "").trim().toLocaleLowerCase("id");
    const subject = adminResultsSubject?.value || "";
    const status = adminResultsStatus?.value || "all";

    const visibleRecords = adminResultRecords.filter((record) => {
        if (subject && record.subjectName !== subject) return false;
        if (status === "published" && !record.isPublished) return false;
        if (status === "draft" && record.isPublished) return false;

        if (!search) return true;
        return [record.subjectName, record.assessmentName]
            .some((value) => String(value).toLocaleLowerCase("id").includes(search));
    });

    renderPersonalScoreCards(
        adminResultsCards,
        visibleRecords,
        adminResultRecords.length ? "Nothing in this orbit" : "Your results are on their way",
        adminResultRecords.length
            ? "Try another subject, component, or publication filter."
            : "When your scores are imported using your registered NIM, they will appear here."
    );

    const publishedCount = visibleRecords.filter((item) => item.isPublished).length;
    const draftCount = visibleRecords.length - publishedCount;
    if (adminResultsSummary) {
        adminResultsSummary.textContent =
            visibleRecords.length + " component(s) shown · " +
            publishedCount + " published · " + draftCount + " draft";
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

/* Direct Academic sign-in uses the exact same NIM-based Firebase identity as the homepage. */
academicOpenRegister?.addEventListener("click", () => {
    setAuthMessage(academicSignInMessage, "");
    setAuthMessage(academicRegisterMessage, "");
    academicRegisterForm?.reset();
    setAcademicAuthMode("register");
});

academicBackToSignIn?.addEventListener("click", () => {
    setAuthMessage(academicRegisterMessage, "");
    setAuthMessage(academicSignInMessage, "");
    setAcademicAuthMode("signin");
});

academicSignInForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (academicSignInSubmit?.disabled) return;

    const username = academicLoginUsername?.value.trim() || "";
    const password = academicLoginPassword?.value || "";
    if (!username || !password) {
        setAuthMessage(academicSignInMessage, "Masukkan username/NIM dan password terlebih dahulu.", "error");
        return;
    }

    academicSignInSubmit.disabled = true;
    academicSignInSubmit.querySelector("span").textContent = "Signing in…";
    setAuthMessage(academicSignInMessage, "Memeriksa akun STELLARS…", "info");

    try {
        await authPersistenceReady;
        const emailAlias = usernameToAuthEmail(username);
        await signInWithEmailAndPassword(auth, emailAlias, password);
        academicLoginPassword.value = "";
        setAuthMessage(academicSignInMessage, "Login berhasil. Membuka Academic Portal…", "success");
    } catch (error) {
        const messages = {
            "auth/invalid-credential": "Username/NIM atau password tidak sesuai.",
            "auth/user-not-found": "Akun tidak ditemukan. Periksa username atau NIM.",
            "auth/wrong-password": "Password tidak sesuai.",
            "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
            "auth/network-request-failed": "Koneksi bermasalah. Periksa internet lalu coba lagi."
        };
        setAuthMessage(
            academicSignInMessage,
            messages[error.code] || error.message || "Login belum berhasil. Periksa data lalu coba lagi.",
            "error"
        );
    } finally {
        academicSignInSubmit.disabled = false;
        academicSignInSubmit.querySelector("span").textContent = "Sign In";
    }
});

academicRegisterForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (academicRegisterSubmit?.disabled || academicRegistrationInProgress) return;

    const fullName = String(academicRegisterName?.value || "").trim().replace(/\s+/g, " ");
    const nim = String(academicRegisterNim?.value || "").trim();
    const code = normalizeActivationCode(academicRegisterCode?.value || "");
    const password = academicRegisterPassword?.value || "";
    const confirmPassword = academicRegisterConfirm?.value || "";

    if (!fullName || !/^\d{5,24}$/.test(nim)) {
        setAuthMessage(academicRegisterMessage, "Periksa nama lengkap dan NIM. NIM harus terdiri dari 5–24 digit.", "error");
        return;
    }
    if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) {
        setAuthMessage(academicRegisterMessage, "Format kode aktivasi tidak valid. Gunakan kode 16 karakter dari admin.", "error");
        return;
    }
    if (password.length < 8) {
        setAuthMessage(academicRegisterMessage, "Password harus terdiri dari minimal 8 karakter.", "error");
        return;
    }
    if (password !== confirmPassword) {
        setAuthMessage(academicRegisterMessage, "Konfirmasi password belum sama.", "error");
        return;
    }

    academicRegistrationInProgress = true;
    academicRegisterSubmit.disabled = true;
    academicRegisterSubmit.querySelector("span").textContent = "Activating…";
    setAuthMessage(academicRegisterMessage, "Memeriksa nama, NIM, dan kode aktivasi…", "info");

    let createdCredential = null;
    let profileCommitted = false;

    try {
        await authPersistenceReady;
        const codeHash = await hashActivationCode(code);
        const activationRef = doc(db, "activationCodes", codeHash);
        const activationSnapshot = await getDoc(activationRef);

        if (!activationSnapshot.exists()) {
            throw new Error("Kode aktivasi tidak ditemukan. Pastikan admin sudah mendaftarkan kode tersebut.");
        }

        const activation = activationSnapshot.data() || {};
        if (activation.status !== "available" ||
            String(activation.nim || "").trim() !== nim ||
            normalizeStudentName(activation.fullName) !== normalizeStudentName(fullName)) {
            throw new Error("Kode tidak cocok dengan nama dan NIM ini, atau kode sudah pernah digunakan.");
        }

        const verifiedFullName = String(activation.fullName || "").trim();
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

        academicRegisterForm.reset();
        setAuthMessage(academicRegisterMessage, "Akun berhasil dibuat. Membuka Academic Portal…", "success");
        await handleAuthState(createdCredential.user);
    } catch (error) {
        if (createdCredential?.user && !profileCommitted) {
            try {
                await deleteUser(createdCredential.user);
            } catch (cleanupError) {
                console.error("Could not clean up incomplete Academic registration:", cleanupError);
                try { await signOut(auth); } catch (_) {}
            }
        }

        let message = error.message || "Registrasi belum berhasil. Periksa data lalu coba lagi.";
        if (error.code === "auth/email-already-in-use") {
            message = "Akun untuk NIM ini sudah ada. Sign in dengan password sebelumnya, lalu pilih Secure My Account bila perlu memperbarui password.";
        } else if (error.code === "auth/weak-password") {
            message = "Password terlalu lemah. Gunakan minimal 8 karakter.";
        } else if (error.code === "permission-denied") {
            message = "NIM ini mungkin sudah terhubung ke akun lama atau Firestore Rules belum diperbarui. Coba sign in dengan akun sebelumnya.";
        }
        setAuthMessage(academicRegisterMessage, message, "error");
    } finally {
        academicRegistrationInProgress = false;
        academicRegisterSubmit.disabled = false;
        academicRegisterSubmit.querySelector("span").textContent = "Create Account";
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

/* Account security */
document.getElementById("secureAccountButton").addEventListener("click", () => {
    closeProfileMenu();
    window.location.assign("index.html?security=1");
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
authPersistenceReady
    .then(() => onAuthStateChanged(auth, user => {
        if (academicRegistrationInProgress) return;
        handleAuthState(user);
    }))
    .catch(error => {
        console.error("Unable to initialize Firebase session:", error);
        showLogin("Firebase Authentication belum dapat diinisialisasi. Periksa koneksi dan konfigurasi project.");
    });
