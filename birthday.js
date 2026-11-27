import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

(function () {
    const FALLBACK = "images/placeholder.jpg";

    const PHOTO_ALIASES = {
        "anita lestari elisabet siregar": "anita lestari elisabet",
        "nicke mega amelia truono": "nicke mega amelia trijono",
        "chairine aretha nathania chung": "chairine aretha nathania",
        "mareshah majesty wales": "maresha majesty wales"
    };

    function normalizeName(value) {
        return String(value || "").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, " ").trim();
    }

    function parseMonthDay(value) {
        const parts = String(value || "").split("-");
        if (parts.length !== 2 || parts.some(part => !/^\d{2}$/.test(part))) return null;
        const month = Number(parts[0]) - 1;
        const day = Number(parts[1]);
        const check = new Date(2000, month, day);
        if (check.getMonth() !== month || check.getDate() !== day) return null;
        return { month, day };
    }

    function isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    function birthdayDateForYear(birthday, year) {
        if (birthday.month === 1 && birthday.day === 29 && !isLeapYear(year)) return new Date(year, 2, 1);
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
        try { return new URL(path || FALLBACK, baseUrl).href; }
        catch (error) { console.warn("STELLARS Birthday: Could not resolve image path:", error); return FALLBACK; }
    }

    async function loadCrewPhotos() {
        let crewPageUrl = new URL("crewmates.html", document.baseURI).href;
        const photos = new Map();
        try {
            const response = await fetch(crewPageUrl, { cache: "force-cache" });
            if (response.ok) {
                crewPageUrl = response.url || crewPageUrl;
                const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
                parsed.querySelectorAll(".crew-card, .crewmate-card").forEach(card => {
                    const name = card.querySelector(".crew-info h3, .crewmate-info h3")?.textContent?.trim();
                    const image = card.querySelector(".crew-photo img, .crewmate-photo img")?.getAttribute("src");
                    if (name && image) photos.set(normalizeName(name), resolveAssetPath(image, crewPageUrl));
                });
            }
        } catch (error) {
            console.warn("STELLARS Birthday: Crew photos unavailable; using fallback portraits.", error);
        }
        return { photos, fallbackImage: resolveAssetPath(FALLBACK, crewPageUrl) };
    }

    function makePerson(record, photos, fallbackImage) {
        const name = String(record.fullName || "").trim();
        const birthday = parseMonthDay(record.birthMonthDay);
        if (!name || !birthday) return null;
        const key = normalizeName(name);
        return {
            name,
            birthday,
            image: photos.get(key) || photos.get(PHOTO_ALIASES[key] || key) || fallbackImage,
            fallbackImage
        };
    }

    function makeUpcoming(records, photos, fallbackImage, now = new Date()) {
        return records.map(record => {
            const person = makePerson(record, photos, fallbackImage);
            return person ? { person, next: nextBirthday(person.birthday, now) } : null;
        }).filter(Boolean).sort((a, b) =>
            a.next.date - b.next.date || a.person.name.localeCompare(b.person.name)
        );
    }

    function showEmpty(container, message) {
        if (!container) return;
        const empty = document.createElement("div");
        empty.className = "birthday-directory-state";
        empty.textContent = message;
        container.replaceChildren(empty);
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
        photoGroup.className = "birthday-preview-people " + (sameDayPeople.length > 1 ? "is-shared" : "is-single");

        sameDayPeople.forEach(member => {
            const figure = document.createElement("figure");
            figure.className = "birthday-preview-person";
            const img = document.createElement("img");
            img.src = member.image;
            img.alt = member.name;
            img.loading = "lazy";
            img.onerror = function () { this.onerror = null; this.src = member.fallbackImage || FALLBACK; };
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
        name.textContent = sameDayPeople.length > 1 ? sameDayPeople.map(x => x.name).join(" & ") : person.name;
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
        img.onerror = function () { this.onerror = null; this.src = person.fallbackImage || FALLBACK; };
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
        countdown.textContent = next.days === 0 ? "Today is their day!"
            : next.days === 1 ? "Coming up tomorrow" : "In " + next.days + " days";
        copy.append(date, name, countdown);
        article.append(img, copy);
        return article;
    }

    function renderPreview(upcoming, container) {
        if (!container) return;
        if (!upcoming.length) return showEmpty(container, "Upcoming birthday details are being updated.");
        const soonestDate = upcoming[0].next.date.getTime();
        const sameDay = upcoming.filter(item => item.next.date.getTime() === soonestDate).map(item => item.person);
        container.replaceChildren(createPreviewCard(upcoming[0].person, upcoming[0].next, sameDay));
    }

    function renderDirectory(upcoming, directory, count) {
        if (!directory) return;
        if (count) count.textContent = upcoming.length + " crew birthdays";
        if (!upcoming.length) return showEmpty(directory, "Birthday details are being prepared.");
        directory.replaceChildren(...upcoming.map(item => personCard(item.person, item.next)));
    }


    async function readPrivateDirectory(photos, fallbackImage) {
        const snapshot = await getDocs(collection(db, "birthdayDirectory"));
        return makeUpcoming(snapshot.docs.map(item => item.data() || {}), photos, fallbackImage);
    }

    async function isActiveMember(user) {
        if (!user) return false;
        try {
            const profile = await getDoc(doc(db, "users", user.uid));
            if (!profile.exists()) return false;
            const data = profile.data() || {};
            return data.isActive === true &&
                ["student", "member", "admin", "superAdmin", "super_admin"].includes(data.role);
        } catch (error) {
            console.warn("STELLARS Birthday: Could not verify member status.", error);
            return false;
        }
    }

    async function init() {
        const homeSection = document.getElementById("birthdayHomeSection");
        const homePreview = document.getElementById("birthdayPreview");
        const birthdayMain = document.getElementById("birthdayMain");
        const accessNotice = document.getElementById("birthdayAccessNotice");
        const directory = document.getElementById("birthdayDirectory");
        const count = document.getElementById("birthdayCount");
        if (!homeSection && !birthdayMain && !directory) return;

        // All Birthday content starts hidden. It is revealed only after the
        // signed-in profile is confirmed as an active class account.
        if (homeSection) homeSection.hidden = true;
        if (birthdayMain) birthdayMain.hidden = true;
        if (accessNotice) accessNotice.hidden = true;

        onAuthStateChanged(auth, async user => {
            const activeMember = await isActiveMember(user);

            if (!activeMember) {
                if (homeSection) homeSection.hidden = true;
                if (birthdayMain) birthdayMain.hidden = true;
                if (accessNotice) accessNotice.hidden = false;
                return;
            }

            if (accessNotice) accessNotice.hidden = true;
            if (homeSection) homeSection.hidden = false;
            if (birthdayMain) birthdayMain.hidden = false;

            const { photos, fallbackImage } = await loadCrewPhotos();
            try {
                const upcoming = await readPrivateDirectory(photos, fallbackImage);
                renderDirectory(upcoming, directory, count);
                renderPreview(upcoming, homePreview);
            } catch (error) {
                console.error("STELLARS Birthday: Could not load the private directory.", error);
                showEmpty(directory, "The birthday calendar could not be loaded. Please refresh the page.");
                showEmpty(homePreview, "Upcoming birthdays could not be loaded.");
            }
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
