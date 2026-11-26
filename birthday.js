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

    function safeImage(src) {
        return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/") ? src : src;
    }

    function personCard(person, next, compact) {
        const article = document.createElement("article");
        article.className = compact ? "birthday-preview-card" : "birthday-person-card";
        const img = document.createElement("img");
        img.src = safeImage(person.image);
        img.alt = person.name;
        img.loading = "lazy";
        img.onerror = function () { this.onerror = null; this.src = FALLBACK; };
        img.className = compact ? "" : "birthday-person-photo";

        const copy = document.createElement("div");
        copy.className = compact ? "birthday-preview-copy" : "birthday-person-info";
        if (compact) {
            const name = document.createElement("strong");
            name.textContent = person.name;
            const date = document.createElement("span");
            date.textContent = dateLabel(next.date);
            const countdown = document.createElement("small");
            countdown.textContent = next.days === 0 ? "Today is their day!" : next.days === 1 ? "Tomorrow" : "In " + next.days + " days";
            copy.append(name, date, countdown);
        } else {
            const date = document.createElement("span");
            date.className = "birthday-person-date";
            date.innerHTML = '<i class="bx bx-cake" aria-hidden="true"></i>';
            date.append(document.createTextNode(" " + dateLabel(next.date)));
            const name = document.createElement("h3");
            name.textContent = person.name;
            const countdown = document.createElement("p");
            countdown.textContent = next.days === 0 ? "Today is their day!" : next.days === 1 ? "Coming up tomorrow" : "In " + next.days + " days";
            copy.append(date, name, countdown);
        }
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
                .sort((a, b) => a.next.date - b.next.date);

            if (preview) {
                preview.replaceChildren();
                if (!upcoming.length) {
                    const empty = document.createElement("div");
                    empty.className = "birthday-preview-empty";
                    empty.textContent = "Birthday details are being prepared.";
                    preview.append(empty);
                } else {
                    upcoming.slice(0, 3).forEach(item => preview.append(personCard(item.person, item.next, true)));
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
                    upcoming.forEach(item => directory.append(personCard(item.person, item.next, false)));
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