import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

const accessGate = document.getElementById("birthdayAccessGate");
const memberTools = document.getElementById("birthdayMemberTools");
const memberStatus = document.getElementById("birthdayShareStatus");
const shareButton = document.getElementById("birthdayShareButton");
const stopShareButton = document.getElementById("birthdayStopShareButton");
const directorySection = document.getElementById("birthdayDirectorySection");
let currentUser = null;
let currentProfile = null;
let ownBirthdayShared = false;
let authSequence = 0;

function showBirthdayGate(message) {
    accessGate.hidden = false;
    accessGate.querySelector("p").textContent = message;
    memberTools.hidden = true;
    directorySection.hidden = true;
}

function formatBirthMonthDay(isoDate) {
    const match = String(isoDate || "").match(/^\\d{4}-(\\d{2})-(\\d{2})$/);
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const check = new Date(2000, month - 1, day);
    if (check.getMonth() !== month - 1 || check.getDate() !== day) return null;
    return match[1] + "-" + match[2];
}

function updateShareControls() {
    const monthDay = formatBirthMonthDay(currentProfile?.birthDate);
    shareButton.disabled = !monthDay;
    shareButton.textContent = ownBirthdayShared ? "Update shared birthday" : "Share my birthday";
    stopShareButton.hidden = !ownBirthdayShared;

    if (!monthDay) {
        memberStatus.textContent = "Add your birthday in your account profile first. You can still view birthdays shared by other members.";
        return;
    }
    memberStatus.textContent = ownBirthdayShared
        ? "Your month and day are shared with active STELLARS members. Your birth year is not shared."
        : "Your birthday is not shared yet. Only the month and day will be visible to active STELLARS members.";
}

async function refreshBirthdayRoster() {
    const snapshot = await getDocs(collection(db, "birthdayRoster"));
    const roster = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    ownBirthdayShared = roster.some(item => item.id === currentUser.uid);
    updateShareControls();
    await renderRoster(roster);
}

shareButton.addEventListener("click", async () => {
    if (!currentUser || !currentProfile || !currentProfile.isActive) return;
    const birthMonthDay = formatBirthMonthDay(currentProfile.birthDate);
    if (!birthMonthDay) {
        memberStatus.textContent = "Add a valid birthday in your account profile before sharing.";
        return;
    }

    shareButton.disabled = true;
    try {
        await setDoc(doc(db, "birthdayRoster", currentUser.uid), {
            uid: currentUser.uid,
            fullName: String(currentProfile.fullName || "STELLARS Member"),
            birthMonthDay,
            sharedAt: serverTimestamp()
        });
        await refreshBirthdayRoster();
    } catch (error) {
        console.error("Could not share birthday:", error);
        memberStatus.textContent = "Could not share your birthday. Please try again.";
        shareButton.disabled = false;
    }
});

stopShareButton.addEventListener("click", async () => {
    if (!currentUser) return;
    stopShareButton.disabled = true;
    try {
        await deleteDoc(doc(db, "birthdayRoster", currentUser.uid));
        await refreshBirthdayRoster();
    } catch (error) {
        console.error("Could not remove birthday share:", error);
        memberStatus.textContent = "Could not remove your shared birthday. Please try again.";
    } finally {
        stopShareButton.disabled = false;
    }
});

onAuthStateChanged(auth, async user => {
    const sequence = ++authSequence;
    currentUser = user || null;
    currentProfile = null;
    ownBirthdayShared = false;

    if (!user) {
        showBirthdayGate("Sign in with an active STELLARS account to view the birthday directory.");
        return;
    }

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;

        const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
        const allowedRoles = ["student", "admin", "superAdmin", "super_admin"];
        if (!profile || profile.isActive !== true || !allowedRoles.includes(profile.role)) {
            showBirthdayGate("This page is reserved for active STELLARS members. Please use an active student account.");
            return;
        }

        currentProfile = profile;
        accessGate.hidden = true;
        memberTools.hidden = false;
        directorySection.hidden = false;
        updateShareControls();
        await refreshBirthdayRoster();
    } catch (error) {
        console.error("Could not verify Birthday page access:", error);
        showBirthdayGate("Membership could not be verified. Please refresh and try again.");
    }
});

    const FALLBACK = "images/placeholder.jpg";
    const PHOTO_ALIASES = {
        "anita lestari elisabet siregar": "anita lestari elisabet",
        "nicke mega amelia truono": "nicke mega amelia trijono",
        "chairine aretha nathania chung": "chairine aretha nathania",
        "mareshah majesty wales": "maresha majesty wales"
    };

    function normalizeName(value) {
        return String(value || "")
            .toLocaleLowerCase("id-ID")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function parseMonthDay(value) {
        const parts = String(value || "").split("-");
        if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) return null;
        const month = Number(parts[0]) - 1;
        const day = Number(parts[1]);
        if (![month, day].every(Number.isInteger)) return null;
        const check = new Date(2000, month, day);
        if (check.getMonth() !== month || check.getDate() !== day) return null;
        return { month, day };
    }

    function isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    // February 29 birthdays are observed on March 1 in non-leap years.
    function birthdayDateForYear(birthday, year) {
        if (birthday.month === 1 && birthday.day === 29 && !isLeapYear(year)) {
            return new Date(year, 2, 1);
        }
        return new Date(year, birthday.month, birthday.day);
    }

    function nextBirthday(birthday, now) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let date = birthdayDateForYear(birthday, today.getFullYear());
        if (date < today) date = birthdayDateForYear(birthday, today.getFullYear() + 1);
        return {
            date,
            days: Math.round((date - today) / 86400000),
            observedLeapDay: birthday.month === 1 && birthday.day === 29 && !isLeapYear(date.getFullYear())
        };
    }

    function dateLabel(next) {
        const label = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" }).format(next.date);
        return next.observedLeapDay ? label + " (29 Februari)" : label;
    }

    function resolveAssetPath(path, baseUrl) {
        try {
            return new URL(path || FALLBACK, baseUrl).href;
        } catch (error) {
            console.warn("STELLARS Birthday: Could not resolve image path:", path, error);
            return FALLBACK;
        }
    }

    function readCrewPhotos(documentText, baseUrl) {
        const parsed = new DOMParser().parseFromString(documentText, "text/html");
        const photos = new Map();
        parsed.querySelectorAll(".crew-card, .crewmate-card").forEach(card => {
            const name = card.querySelector(".crew-info h3, .crewmate-info h3")?.textContent?.trim();
            const image = card.querySelector(".crew-photo img, .crewmate-photo img")?.getAttribute("src");
            if (name && image) photos.set(normalizeName(name), resolveAssetPath(image, baseUrl));
        });
        return photos;
    }

    function matchPhoto(person, photos) {
        const key = normalizeName(person.name);
        const aliasedKey = PHOTO_ALIASES[key] || key;
        return photos.get(key) || photos.get(aliasedKey) || "";
    }

    function makeCountdownUnit(units, key, label) {
        const unit = document.createElement("div");
        unit.className = "birthday-countdown-unit";
        const value = document.createElement("strong");
        value.dataset.countdownUnit = key;
        value.textContent = "00";
        const caption = document.createElement("small");
        caption.textContent = label;
        unit.append(value, caption);
        units.append(unit);
    }

    function createPreviewCard(person, next, sameDayPeople) {
        const article = document.createElement("article");
        article.className = "birthday-preview-card";

        const photoGroup = document.createElement("div");
        photoGroup.className = "birthday-preview-people " +
            (sameDayPeople.length > 1 ? "is-shared" : "is-single");

        sameDayPeople.forEach(member => {
            const figure = document.createElement("figure");
            figure.className = "birthday-preview-person";

            const img = document.createElement("img");
            img.src = member.image;
            img.alt = member.name;
            img.loading = "lazy";
            img.onerror = function () {
                this.onerror = null;
                this.src = member.fallbackImage || FALLBACK;
            };

            const caption = document.createElement("figcaption");
            caption.textContent = member.name;

            figure.append(img, caption);
            photoGroup.append(figure);
        });

        const copy = document.createElement("div");
        copy.className = "birthday-preview-copy";

        const kicker = document.createElement("span");
        kicker.className = "birthday-preview-kicker";
        kicker.textContent = sameDayPeople.length > 1
            ? "SHARED BIRTHDAY · " + sameDayPeople.length + " STARS"
            : "NEXT UP IN THE CONSTELLATION";

        const name = document.createElement("h3");
        name.className = "birthday-preview-name";
        name.textContent = sameDayPeople.length > 1
            ? "Two stars. One celebration."
            : person.name;

        const date = document.createElement("p");
        date.className = "birthday-preview-date";
        const cakeIcon = document.createElement("i");
        cakeIcon.className = "bx bx-cake";
        cakeIcon.setAttribute("aria-hidden", "true");
        date.append(cakeIcon, document.createTextNode(" " + dateLabel(next)));

        const countdown = document.createElement("div");
        countdown.className = "birthday-preview-countdown";
        const countdownLabel = document.createElement("span");
        countdownLabel.className = "birthday-countdown-label";
        countdownLabel.textContent = "COUNTDOWN TO THE BIG DAY";

        const units = document.createElement("div");
        units.className = "birthday-countdown-units";
        makeCountdownUnit(units, "days", "DAYS");
        makeCountdownUnit(units, "hours", "HOURS");
        makeCountdownUnit(units, "minutes", "MINUTES");
        makeCountdownUnit(units, "seconds", "SECONDS");
        countdown.append(countdownLabel, units);

        function updateCountdown() {
            const difference = next.date.getTime() - Date.now();
            if (next.days === 0 || difference <= 0) {
                countdownLabel.textContent = "IT'S THEIR BIRTHDAY!";
                units.hidden = true;
                article.classList.add("is-birthday-today");
                return false;
            }

            const totalSeconds = Math.floor(difference / 1000);
            const values = {
                days: Math.floor(totalSeconds / 86400),
                hours: Math.floor((totalSeconds % 86400) / 3600),
                minutes: Math.floor((totalSeconds % 3600) / 60),
                seconds: totalSeconds % 60
            };
            Object.entries(values).forEach(([key, value]) => {
                const target = units.querySelector('[data-countdown-unit="' + key + '"]');
                if (target) target.textContent = String(value).padStart(2, "0");
            });
            return true;
        }

        copy.append(kicker, name, date, countdown);
        article.append(photoGroup, copy);

        if (updateCountdown()) {
            const intervalId = window.setInterval(() => {
                if (!updateCountdown()) window.clearInterval(intervalId);
            }, 1000);
        }
        return article;
    }

        function personCard(person, next) {
        const article = document.createElement("article");
        article.className = "birthday-person-card";

        const img = document.createElement("img");
        img.src = person.image;
        img.alt = person.name;
        img.loading = "lazy";
        img.onerror = function () { this.onerror = null; this.src = FALLBACK; };
        img.className = "birthday-person-photo";

        const copy = document.createElement("div");
        copy.className = "birthday-person-info";

        const date = document.createElement("span");
        date.className = "birthday-person-date";
        const cakeIcon = document.createElement("i");
        cakeIcon.className = "bx bx-cake";
        cakeIcon.setAttribute("aria-hidden", "true");
        date.append(cakeIcon, document.createTextNode(" " + dateLabel(next)));

        const name = document.createElement("h3");
        name.textContent = person.name;

        const countdown = document.createElement("p");
        countdown.textContent = next.days === 0
            ? "Today is their day!"
            : next.days === 1
                ? "Coming up tomorrow"
                : "In " + next.days + " days";

        copy.append(date, name, countdown);
        article.append(img, copy);
        return article;
    }

    async function renderRoster(rosterEntries) {
        const preview = document.getElementById("birthdayPreview");
        const directory = document.getElementById("birthdayDirectory");
        const count = document.getElementById("birthdayCount");
        if (!preview && !directory) return;

        let photos = new Map();
        let crewPageUrl = new URL("crewmates.html", document.baseURI).href;
        try {
            const response = await fetch(crewPageUrl, { cache: "no-store" });
            if (response.ok) {
                crewPageUrl = response.url || crewPageUrl;
                photos = readCrewPhotos(await response.text(), crewPageUrl);
            } else {
                console.warn("STELLARS Birthday: Crewmates returned HTTP", response.status);
            }
        } catch (error) {
            console.warn("STELLARS Birthday: Crew photos unavailable; using fallback portraits.", error);
        }
        const fallbackImage = resolveAssetPath(FALLBACK, crewPageUrl);

        const people = rosterEntries.map(entry => {
            const birthday = parseMonthDay(entry.birthMonthDay);
            if (!birthday) return null;
            const person = { name: entry.fullName, birthday, image: "", fallbackImage };
            person.image = matchPhoto(person, photos) || fallbackImage;
            return person;
        }).filter(Boolean);

        const now = new Date();
        const upcoming = people.map(person => ({
            person,
            next: nextBirthday(person.birthday, now)
        })).sort((a, b) =>
            a.next.date - b.next.date || a.person.name.localeCompare(b.person.name)
        );

        if (preview) {
            preview.replaceChildren();
            if (!upcoming.length) {
                const empty = document.createElement("div");
                empty.className = "birthday-preview-empty";
                empty.textContent = "Birthday details are being prepared.";
                preview.append(empty);
            } else {
                const soonestDate = upcoming[0].next.date.getTime();
                const sameDayPeople = upcoming
                    .filter(item => item.next.date.getTime() === soonestDate)
                    .map(item => item.person);
                preview.append(createPreviewCard(upcoming[0].person, upcoming[0].next, sameDayPeople));
            }
        }

        if (directory) {
            directory.replaceChildren();
            if (count) count.textContent = people.length + " crew birthdays";
            if (!upcoming.length) {
                const empty = document.createElement("div");
                empty.className = "birthday-directory-state";
                empty.textContent = "Birthday details are being prepared.";
                directory.append(empty);
            } else {
                upcoming.forEach(item => directory.append(personCard(item.person, item.next)));
            }
        }
    }

    document.addEventListener("DOMContentLoaded", init);

