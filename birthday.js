(function () {
    const ROSTER = [
    {
        "name": "Adeline Nadia Nicola",
        "birthDate": "2008-02-29"
    },
    {
        "name": "Andre Praditya Pratama",
        "birthDate": "2008-04-15"
    },
    {
        "name": "Anita Lestari Elisabet Siregar",
        "birthDate": "2008-08-21"
    },
    {
        "name": "Anjelie",
        "birthDate": "2008-09-12"
    },
    {
        "name": "Carmella Wibowo Widhianto",
        "birthDate": "2008-06-07"
    },
    {
        "name": "Chairine Aretha Nathania Chung",
        "birthDate": "2008-12-25"
    },
    {
        "name": "Chantika Anastasia",
        "birthDate": "2008-09-21"
    },
    {
        "name": "Danniel",
        "birthDate": "2006-12-19"
    },
    {
        "name": "Darren Leinad Cahaya",
        "birthDate": "2008-05-18"
    },
    {
        "name": "Delfina Calista Ciu Putri",
        "birthDate": "2008-12-10"
    },
    {
        "name": "Eilien Ardelia",
        "birthDate": "2007-12-13"
    },
    {
        "name": "Ellie Margaretta",
        "birthDate": "2009-01-17"
    },
    {
        "name": "Elmarsha Hannabella",
        "birthDate": "2007-07-22"
    },
    {
        "name": "Ersya Fely",
        "birthDate": "2008-07-14"
    },
    {
        "name": "Felicia Zefanya",
        "birthDate": "2007-05-13"
    },
    {
        "name": "Grace Abigail Wijaya",
        "birthDate": "2007-11-30"
    },
    {
        "name": "Gracielle Fellisca Tjoa",
        "birthDate": "2008-04-21"
    },
    {
        "name": "Hosea Bowie Immanuel",
        "birthDate": "2008-05-13"
    },
    {
        "name": "Jasper Vladino Alvis",
        "birthDate": "2008-05-07"
    },
    {
        "name": "Jean Romeo Junior Sembiring",
        "birthDate": "2008-04-03"
    },
    {
        "name": "Johanna Avrilla Hapsari Putri",
        "birthDate": "2007-04-17"
    },
    {
        "name": "Keely Michiko Mulyanto",
        "birthDate": "2008-05-06"
    },
    {
        "name": "Kelly Patricia Ongkodjojo",
        "birthDate": "2008-01-22"
    },
    {
        "name": "Kevano Mareto",
        "birthDate": "2008-03-28"
    },
    {
        "name": "Kioko Rei",
        "birthDate": "2008-05-10"
    },
    {
        "name": "Levinne Emerson Mulia",
        "birthDate": "2008-09-01"
    },
    {
        "name": "Mareshah Majesty Wales",
        "birthDate": "2007-03-19"
    },
    {
        "name": "Marsha Setiawan",
        "birthDate": "2008-03-24"
    },
    {
        "name": "Maya Caroline",
        "birthDate": "2008-10-04"
    },
    {
        "name": "Nicke Mega Amelia Truono",
        "birthDate": "2007-03-10"
    },
    {
        "name": "Pande Kadek Redita Julia Dewi",
        "birthDate": "2006-07-30"
    },
    {
        "name": "Patricia Devina",
        "birthDate": "2007-11-28"
    },
    {
        "name": "Putu Adelia Nariswari",
        "birthDate": "2007-09-22"
    },
    {
        "name": "Quinetta Aulya Winata",
        "birthDate": "2008-08-20"
    },
    {
        "name": "Raisya Thalita Jasmine",
        "birthDate": "2008-07-16"
    },
    {
        "name": "Reynard Christian",
        "birthDate": "2008-09-14"
    },
    {
        "name": "Samantha Angel",
        "birthDate": "2008-08-16"
    },
    {
        "name": "Shareen Tesalonika Setiawan",
        "birthDate": "2008-04-14"
    },
    {
        "name": "Stephanie Felita Widodo",
        "birthDate": "2008-04-28"
    },
    {
        "name": "Stevander Rusli",
        "birthDate": "2008-05-11"
    },
    {
        "name": "Tesalonika Uli Putri Silalahi",
        "birthDate": "2007-06-19"
    },
    {
        "name": "Vianney Yovella Kristanto",
        "birthDate": "2008-10-01"
    },
    {
        "name": "Vincent Farrelius",
        "birthDate": "2008-06-03"
    },
    {
        "name": "Vivian Renata Chandra",
        "birthDate": "2008-06-17"
    },
    {
        "name": "Zalika Afarin Azura",
        "birthDate": "2007-03-26"
    }
];
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

    function parseIsoBirthday(value) {
        const parts = String(value || "").split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) return null;
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        if (![year, month, day].every(Number.isInteger)) return null;
        const check = new Date(year, month, day);
        if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) return null;
        return { year, month, day };
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

        const img = document.createElement("img");
        img.src = person.image;
        img.alt = person.name;
        img.loading = "lazy";
        img.onerror = function () { this.onerror = null; this.src = person.fallbackImage || FALLBACK; };

        const copy = document.createElement("div");
        copy.className = "birthday-preview-copy";

        const kicker = document.createElement("span");
        kicker.className = "birthday-preview-kicker";
        kicker.textContent = sameDayPeople.length > 1
            ? "NEXT UP · " + sameDayPeople.length + " STARS SHARE THIS DAY"
            : "NEXT UP IN THE CONSTELLATION";

        const name = document.createElement("h3");
        name.className = "birthday-preview-name";
        name.textContent = person.name;

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

        if (sameDayPeople.length > 1) {
            const shared = document.createElement("p");
            shared.className = "birthday-preview-shared";
            shared.textContent = "Also celebrating: " + sameDayPeople
                .filter(item => item.name !== person.name)
                .map(item => item.name)
                .join(", ");
            copy.append(shared);
        }

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

    async function init() {
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

        const people = ROSTER.map(entry => {
            const birthday = parseIsoBirthday(entry.birthDate);
            if (!birthday) return null;
            const person = { name: entry.name, birthday, image: "", fallbackImage };
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
})();
