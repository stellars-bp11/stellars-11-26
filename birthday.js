(function () {
    const MONTHS = {
        januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
        juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
    };
    const FALLBACK = "images/placeholder.jpg";

    function parseBirthday(value) {
        const match = String(value || "").trim().match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
        if (!match) return null;
        const month = MONTHS[match[2].toLocaleLowerCase("id-ID")];
        const day = Number(match[1]);
        if (month === undefined || day < 1 || day > 31) return null;
        return { day, month };
    }

    function nextBirthday(birthday, now) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let next = new Date(today.getFullYear(), birthday.month, birthday.day);
        if (next < today) next = new Date(today.getFullYear() + 1, birthday.month, birthday.day);
        return { date: next, days: Math.round((next - today) / 86400000) };
    }

    function dateLabel(date) {
        return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" }).format(date);
    }

    function readCrewCards(documentText) {
        const parsed = new DOMParser().parseFromString(documentText, "text/html");
        return Array.from(parsed.querySelectorAll(".crew-card")).map(card => {
            const name = card.querySelector(".crew-info h3")?.textContent?.trim();
            const dobText = card.querySelector(".crew-dob")?.textContent?.replace(/\s+/g, " ").trim();
            const birthday = parseBirthday(dobText);
            const image = card.querySelector(".crew-photo img")?.getAttribute("src");
            if (!name || !birthday) return null;
            return { name, birthday, image: image || FALLBACK };
        }).filter(Boolean);
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

    function createPreviewCard(person, next) {
        const article = document.createElement("article");
        article.className = "birthday-preview-card";

        const img = document.createElement("img");
        img.src = person.image || FALLBACK;
        img.alt = person.name;
        img.loading = "lazy";
        img.onerror = function () { this.onerror = null; this.src = FALLBACK; };

        const copy = document.createElement("div");
        copy.className = "birthday-preview-copy";

        const kicker = document.createElement("span");
        kicker.className = "birthday-preview-kicker";
        kicker.textContent = "NEXT UP IN THE CONSTELLATION";

        const name = document.createElement("h3");
        name.className = "birthday-preview-name";
        name.textContent = person.name;

        const date = document.createElement("p");
        date.className = "birthday-preview-date";
        const cakeIcon = document.createElement("i");
        cakeIcon.className = "bx bx-cake";
        cakeIcon.setAttribute("aria-hidden", "true");
        date.append(cakeIcon, document.createTextNode(" " + dateLabel(next.date)));

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
        article.append(img, copy);

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
        img.src = person.image || FALLBACK;
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
        date.append(cakeIcon, document.createTextNode(" " + dateLabel(next.date)));

        const name = document.createElement("h3");
        name.textContent = person.name;
        const countdown = document.createElement("p");
        countdown.textContent = next.days === 0 ? "Today is their day!" : next.days === 1 ? "Coming up tomorrow" : "In " + next.days + " days";
        copy.append(date, name, countdown);
        article.append(img, copy);
        return article;
    }

    async function init() {
        const preview = document.getElementById("birthdayPreview");
        const directory = document.getElementById("birthdayDirectory");
        const count = document.getElementById("birthdayCount");
        if (!preview && !directory) return;
        try {
            const response = await fetch("crewmates.html", { cache: "no-store" });
            if (!response.ok) throw new Error("Crewmates page could not be loaded");
            const people = readCrewCards(await response.text());
            const now = new Date();
            const upcoming = people.map(person => ({ person, next: nextBirthday(person.birthday, now) }))
                .sort((a, b) => a.next.date - b.next.date || a.person.name.localeCompare(b.person.name));

            if (preview) {
                preview.replaceChildren();
                if (!upcoming.length) {
                    const empty = document.createElement("div");
                    empty.className = "birthday-preview-empty";
                    empty.textContent = "Birthday details are being prepared.";
                    preview.append(empty);
                } else {
                    const next = upcoming[0];
                    preview.append(createPreviewCard(next.person, next.next));
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
        } catch (error) {
            [preview, directory].filter(Boolean).forEach(target => {
                target.replaceChildren();
                const message = document.createElement("div");
                message.className = target.id === "birthdayPreview" ? "birthday-preview-empty" : "birthday-directory-state";
                message.textContent = "We couldn't load the crew list right now. Please refresh the page.";
                target.append(message);
            });
            if (count) count.textContent = "Crew list unavailable";
            console.error("STELLARS Birthday:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
