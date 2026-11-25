import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

/* =========================================================
   STELLARS RADIO — FIREBASE + DAILY MUSIC DIARY
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
    authDomain: "class-web-7241e.firebaseapp.com",
    projectId: "class-web-7241e",
    storageBucket: "class-web-7241e.firebasestorage.app",
    messagingSenderId: "167560389153",
    appId: "1:167560389153:web:f61f4f821275c48373f960",
    measurementId: "G-DTHTZNT135"
};

const CLOUD_NAME = "b88nrr3l";
const UPLOAD_PRESET = "stellar-library";
const MAX_ARTWORK_SIZE = 5 * 1024 * 1024;
const TIME_ZONE = "Asia/Jakarta";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const elements = {
    date: document.getElementById("radioDateLabel"),
    countdown: document.getElementById("radioCountdown"),
    count: document.getElementById("radioSongCount"),
    mySongStatus: document.getElementById("mySongStatus"),
    openButton: document.getElementById("openSubmissionBtn"),
    signInButton: document.getElementById("radioSignInBtn"),
    authGate: document.getElementById("radioAuthGate"),
    feed: document.getElementById("radioFeedGrid"),
    empty: document.getElementById("radioEmptyState"),
    footnote: document.getElementById("radioFeedFootnote"),
    dialog: document.getElementById("radioDialog"),
    form: document.getElementById("radioForm"),
    closeDialog: document.getElementById("closeRadioDialog"),
    cancelForm: document.getElementById("cancelRadioForm"),
    title: document.getElementById("songTitleInput"),
    artist: document.getElementById("artistNameInput"),
    story: document.getElementById("songStoryInput"),
    searchButton: document.getElementById("searchArtworkBtn"),
    results: document.getElementById("artworkResults"),
    upload: document.getElementById("artworkUploadInput"),
    cover: document.getElementById("coverPreview"),
    coverPlaceholder: document.getElementById("coverPlaceholder"),
    coverTitle: document.getElementById("coverSelectionTitle"),
    coverHint: document.getElementById("coverSelectionHint"),
    message: document.getElementById("radioFormMessage"),
    submitButton: document.getElementById("submitRadioBtn"),
    storyCount: document.getElementById("storyCharacterCount"),
    toast: document.getElementById("radioToast")
};

let currentUser = null;
let currentProfile = null;
let activeDayKey = getJakartaDayKey();
let mySubmission = null;
let selectedArtwork = null;
let uploadedArtworkFile = null;
let unsubscribeDailyFeed = null;
let toastTimeout = null;

function getJakartaParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getJakartaDayKey(date = new Date()) {
    const parts = getJakartaParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatJakartaDate(date = new Date()) {
    return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: TIME_ZONE
    }).format(date);
}

function getNextJakartaMidnight() {
    const [year, month, day] = activeDayKey.split("-").map(Number);
    // Jakarta uses UTC+7 year-round.
    return Date.UTC(year, month - 1, day + 1) - (7 * 60 * 60 * 1000);
}

function updateDailyClock() {
    elements.date.textContent = formatJakartaDate();
    const remaining = Math.max(0, getNextJakartaMidnight() - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    elements.countdown.textContent = `${hours}:${minutes}:${seconds}`;

    const nextDayKey = getJakartaDayKey();
    if (nextDayKey !== activeDayKey) {
        activeDayKey = nextDayKey;
        mySubmission = null;
        elements.storyCount.textContent = "0 / 240";
        resetComposer();
        if (currentUser && currentProfile?.isActive === true) {
            startDailyFeed();
        } else {
            renderSignedOutState();
        }
        showToast("A new day, a new song. Yesterday's wall has cleared.");
    }
}

function showToast(message, type = "success") {
    clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.classList.add("is-visible");
    toastTimeout = setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
}

function setComposerMessage(message = "", type = "") {
    elements.message.textContent = message;
    elements.message.dataset.type = type;
}

function setCoverPreview(url, title = "Album artwork selected", hint = "You can replace this cover with your own image.") {
    selectedArtwork = selectedArtwork ? { ...selectedArtwork, url } : { url, source: "itunes", storeUrl: "", albumName: "" };
    elements.cover.src = url;
    elements.cover.hidden = false;
    elements.coverPlaceholder.hidden = true;
    elements.coverTitle.textContent = title;
    elements.coverHint.textContent = hint;
}

function clearArtworkSelection() {
    selectedArtwork = null;
    uploadedArtworkFile = null;
    elements.upload.value = "";
    elements.cover.removeAttribute("src");
    elements.cover.hidden = true;
    elements.coverPlaceholder.hidden = false;
    elements.coverTitle.textContent = "No cover selected yet";
    elements.coverHint.textContent = "Choose an artwork result, or use your own image if the match is incorrect.";
}

function resetComposer() {
    elements.form.reset();
    elements.results.replaceChildren();
    elements.results.hidden = true;
    clearArtworkSelection();
    setComposerMessage("");
    elements.submitButton.disabled = false;
    elements.submitButton.querySelector("span").textContent = "Share with STELLARS";
    elements.storyCount.textContent = "0 / 240";
}

function openComposer() {
    if (!currentUser || currentProfile?.isActive !== true) {
        showToast("Sign in with an active STELLARS account first.", "error");
        return;
    }

    resetComposer();

    if (mySubmission) {
        elements.title.value = mySubmission.songTitle || "";
        elements.artist.value = mySubmission.artistName || "";
        elements.story.value = mySubmission.story || "";
        elements.storyCount.textContent = `${elements.story.value.length} / 240`;
        selectedArtwork = {
            url: mySubmission.artworkUrl,
            source: mySubmission.artworkSource || "itunes",
            storeUrl: mySubmission.storeUrl || "",
            albumName: mySubmission.albumName || ""
        };
        setCoverPreview(
            selectedArtwork.url,
            mySubmission.albumName || "Your current cover",
            "Your current artwork is kept unless you select a different cover."
        );
        elements.submitButton.querySelector("span").textContent = "Update today's song";
        document.getElementById("radioDialogTitle").textContent = "Edit your song.";
    } else {
        document.getElementById("radioDialogTitle").textContent = "Share a song.";
    }

    elements.dialog.showModal();
    elements.title.focus();
}

function buildSongCard(song, uid) {
    const card = document.createElement("article");
    card.className = "radio-song-card";
    if (song.uid === currentUser?.uid) card.classList.add("radio-own-entry");

    const art = document.createElement("div");
    art.className = "radio-song-art";
    const image = document.createElement("img");
    image.src = song.artworkUrl || "";
    image.alt = `Artwork for ${song.songTitle || "shared song"}`;
    image.loading = "lazy";
    image.onerror = () => {
        image.remove();
        art.style.background = "linear-gradient(145deg, #332657, #a89bdd)";
    };
    art.append(image);

    const copy = document.createElement("div");
    copy.className = "radio-song-copy";

    const tag = document.createElement("span");
    tag.className = "radio-song-tag";
    tag.textContent = song.uid === currentUser?.uid ? "YOUR SONG TODAY" : "TODAY'S PICK";

    const title = document.createElement("h3");
    title.textContent = song.songTitle || "Untitled song";

    const artist = document.createElement("p");
    artist.className = "radio-song-artist";
    artist.textContent = song.artistName || "Unknown artist";

    const member = document.createElement("div");
    member.className = "radio-song-member";
    const avatar = document.createElement("span");
    avatar.className = "radio-member-avatar";
    avatar.textContent = getInitials(song.displayName);
    const name = document.createElement("span");
    name.textContent = song.uid === currentUser?.uid ? "Shared by you" : `Shared by ${song.displayName || "A STELLARS member"}`;
    member.append(avatar, name);

    const story = document.createElement("p");
    story.className = "radio-song-story";
    if (song.story) {
        story.textContent = `“${song.story}”`;
    } else {
        story.textContent = "A song with a story of its own.";
        story.classList.add("is-empty");
    }

    copy.append(tag, title, artist, member, story);

    const spotifySearchUrl = buildSpotifySearchUrl(song.songTitle, song.artistName);
    if (spotifySearchUrl) {
        const link = document.createElement("a");
        link.className = "radio-song-link";
        link.href = spotifySearchUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.innerHTML = '<i class="bx bx-link-external" aria-hidden="true"></i> See on Spotify';
        copy.append(link);
    }

    if (song.uid === currentUser?.uid) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "radio-song-link radio-edit-entry";
        edit.innerHTML = '<i class="bx bx-edit-alt" aria-hidden="true"></i> Edit your entry';
        edit.addEventListener("click", openComposer);
        copy.append(edit);
    }

    card.append(art, copy);
    return card;
}

function getInitials(name = "Star") {
    return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "S";
}

function buildSpotifySearchUrl(songTitle, artistName) {
    const queryText = [songTitle, artistName].filter(Boolean).join(" ").trim();
    if (!queryText) return "";
    return "https://open.spotify.com/search/" + encodeURIComponent(queryText);
}

function isSafeHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function renderFeed(songs) {
    elements.feed.replaceChildren();
    elements.count.textContent = `${songs.length} song${songs.length === 1 ? "" : "s"} shared today`;
    elements.empty.hidden = songs.length > 0;
    elements.footnote.hidden = songs.length === 0;

    songs.forEach(song => {
        elements.feed.append(buildSongCard(song, song.uid));
    });

    mySubmission = songs.find(song => song.uid === currentUser?.uid) || null;
    if (mySubmission) {
        elements.mySongStatus.textContent = `You've shared “${mySubmission.songTitle}” by ${mySubmission.artistName}. You can edit it until the daily reset.`;
        elements.openButton.querySelector("span").textContent = "Edit today's song";
    } else {
        elements.mySongStatus.textContent = "Your space on today's song wall is waiting. Share one song that means something to you.";
        elements.openButton.querySelector("span").textContent = "Share today's song";
    }
    elements.openButton.disabled = false;
}

function renderSignedOutState() {
    elements.feed.replaceChildren();
    elements.count.textContent = "Sign in to see today's songs";
    elements.empty.hidden = true;
    elements.authGate.hidden = false;
    elements.authGate.querySelector("strong").textContent = "Sign in to see today's song wall";
    elements.authGate.querySelector("p").textContent = "Today's submissions are shared with active STELLARS members.";
    elements.footnote.hidden = false;
    elements.mySongStatus.textContent = "Sign in with your STELLARS account to share a song with everyone.";
    elements.openButton.disabled = true;
    elements.signInButton.hidden = false;
}

function startDailyFeed() {
    if (unsubscribeDailyFeed) {
        unsubscribeDailyFeed();
        unsubscribeDailyFeed = null;
    }

    mySubmission = null;
    elements.authGate.hidden = true;
    elements.feed.replaceChildren();
    elements.empty.hidden = true;
    elements.count.textContent = "Loading today's songs…";
    elements.openButton.disabled = false;
    elements.signInButton.hidden = true;

    const dailySongs = collection(db, "radioDays", activeDayKey, "songs");
    const dailyQuery = query(dailySongs, orderBy("createdAt", "desc"));

    unsubscribeDailyFeed = onSnapshot(dailyQuery, snapshot => {
        const songs = snapshot.docs.map(document => ({
            uid: document.id,
            ...document.data()
        }));
        renderFeed(songs);
    }, error => {
        console.error("STELLARS Radio feed error:", error);
        elements.count.textContent = "Today's song wall is unavailable";
        elements.footnote.textContent = "Check the Firestore Radio rules deployment, then refresh this page.";
        elements.footnote.hidden = false;
        showToast("Couldn't load the song wall. The Radio Firestore rules may not be deployed yet.", "error");
    });
}

async function searchArtwork() {
    const songTitle = elements.title.value.trim();
    const artistName = elements.artist.value.trim();

    if (!songTitle || !artistName) {
        setComposerMessage("Enter the song title and artist first.", "error");
        return;
    }

    elements.searchButton.disabled = true;
    elements.searchButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Searching…';
    elements.results.replaceChildren();
    elements.results.hidden = false;
    setComposerMessage("Searching for matching album artwork…", "info");

    try {
        const url = new URL("https://itunes.apple.com/search");
        url.search = new URLSearchParams({
            term: `${songTitle} ${artistName}`,
            entity: "song",
            limit: "12",
            country: "id"
        }).toString();

        let response = await fetch(url.toString());
        if (!response.ok) throw new Error("Artwork search is unavailable right now.");
        let payload = await response.json();

        if (!Array.isArray(payload.results) || payload.results.length === 0) {
            url.searchParams.set("country", "us");
            response = await fetch(url.toString());
            if (response.ok) payload = await response.json();
        }

        const results = Array.isArray(payload.results) ? payload.results : [];
        if (!results.length) {
            setComposerMessage("No matching artwork found. Try a shorter search or upload the cover manually.", "error");
            elements.results.hidden = true;
            return;
        }

        results.forEach(result => {
            if (!result.artworkUrl100) return;
            const resultButton = document.createElement("button");
            resultButton.type = "button";
            resultButton.className = "artwork-result";
            resultButton.setAttribute("aria-pressed", "false");

            const image = document.createElement("img");
            image.src = result.artworkUrl100.replace(/^http:/, "https:").replace(/100x100bb/i, "600x600bb");
            image.alt = "";

            const copy = document.createElement("span");
            copy.className = "artwork-result-copy";
            const title = document.createElement("strong");
            title.textContent = result.trackName || result.collectionName || "Untitled";
            const artist = document.createElement("small");
            artist.textContent = result.artistName || "Unknown artist";
            copy.append(title, artist);
            resultButton.append(image, copy);

            resultButton.addEventListener("click", () => {
                elements.results.querySelectorAll(".artwork-result").forEach(item => item.setAttribute("aria-pressed", "false"));
                resultButton.setAttribute("aria-pressed", "true");
                uploadedArtworkFile = null;
                elements.upload.value = "";

                const artworkUrl = result.artworkUrl100.replace(/^http:/, "https:").replace(/100x100bb/i, "600x600bb");
                selectedArtwork = {
                    url: artworkUrl,
                    source: "itunes",
                    storeUrl: buildSpotifySearchUrl(result.trackName || songTitle, result.artistName || artistName),
                    albumName: result.collectionName || ""
                };
                setCoverPreview(
                    artworkUrl,
                    result.collectionName || "Album artwork selected",
                    `Matched with ${result.trackName || songTitle} · ${result.artistName || artistName}`
                );
                setComposerMessage("Artwork selected. You can replace it manually if it isn't the right cover.", "success");
            });

            elements.results.append(resultButton);
        });

        if (!elements.results.children.length) {
            elements.results.hidden = true;
            setComposerMessage("No artwork was included in those results. Upload the cover manually.", "error");
        } else {
            setComposerMessage("Choose the correct artwork below.", "success");
        }
    } catch (error) {
        console.error("Artwork search failed:", error);
        setComposerMessage("Artwork search couldn't connect. Check your connection or upload the cover manually.", "error");
        elements.results.hidden = true;
    } finally {
        elements.searchButton.disabled = false;
        elements.searchButton.innerHTML = '<i class="bx bx-search"></i> Find album artwork';
    }
}

function previewUploadedArtwork(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        setComposerMessage("Please choose an image file.", "error");
        elements.upload.value = "";
        return;
    }
    if (file.size > MAX_ARTWORK_SIZE) {
        setComposerMessage("The artwork must be 5 MB or smaller.", "error");
        elements.upload.value = "";
        return;
    }

    uploadedArtworkFile = file;
    const localUrl = URL.createObjectURL(file);
    selectedArtwork = {
        url: localUrl,
        source: "upload",
        storeUrl: "",
        albumName: "Custom cover"
    };
    elements.cover.src = localUrl;
    elements.cover.hidden = false;
    elements.coverPlaceholder.hidden = true;
    elements.coverTitle.textContent = file.name;
    elements.coverHint.textContent = "Your uploaded image will replace the automatic artwork.";
    elements.results.querySelectorAll(".artwork-result").forEach(item => item.setAttribute("aria-pressed", "false"));
    setComposerMessage("Custom cover selected.", "success");
}

async function uploadArtwork(file) {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(endpoint, { method: "POST", body: formData });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.secure_url) {
        throw new Error(result?.error?.message || "The cover image could not be uploaded.");
    }
    return result.secure_url;
}

async function submitSong(event) {
    event.preventDefault();

    if (!currentUser || currentProfile?.isActive !== true) {
        setComposerMessage("Sign in with an active STELLARS account before sharing.", "error");
        return;
    }

    const songTitle = elements.title.value.trim();
    const artistName = elements.artist.value.trim();
    const story = elements.story.value.trim();

    if (!songTitle || !artistName) {
        setComposerMessage("Add both the song title and artist.", "error");
        return;
    }
    if (!selectedArtwork?.url) {
        setComposerMessage("Choose an album cover or upload one manually.", "error");
        return;
    }

    elements.submitButton.disabled = true;
    elements.submitButton.querySelector("span").textContent = uploadedArtworkFile ? "Uploading cover…" : "Sharing…";

    try {
        let artworkUrl = selectedArtwork.url;
        let artworkSource = selectedArtwork.source;
        if (uploadedArtworkFile) {
            artworkUrl = await uploadArtwork(uploadedArtworkFile);
            artworkSource = "upload";
        }

        const submissionRef = doc(db, "radioDays", activeDayKey, "songs", currentUser.uid);
        const payload = {
            uid: currentUser.uid,
            dayKey: activeDayKey,
            displayName: currentProfile.fullName || currentUser.displayName || "STELLARS Member",
            songTitle,
            artistName,
            albumName: selectedArtwork.albumName || "",
            artworkUrl,
            artworkSource,
            storeUrl: selectedArtwork.storeUrl || "",
            story,
            updatedAt: serverTimestamp()
        };

        if (mySubmission) {
            await updateDoc(submissionRef, payload);
        } else {
            await setDoc(submissionRef, {
                ...payload,
                createdAt: serverTimestamp()
            });
        }

        if (elements.dialog.open) elements.dialog.close();
        showToast(mySubmission ? "Your song story has been updated." : "Your song is now on today's STELLARS Radio wall.");
        resetComposer();
    } catch (error) {
        console.error("Could not save STELLARS Radio entry:", error);
        setComposerMessage(
            error?.code === "permission-denied"
                ? "Radio access is not ready yet. The latest Firestore rules need to be published in Firebase Console."
                : (error.message || "Your song could not be saved. Please try again."),
            "error"
        );
        elements.submitButton.disabled = false;
        elements.submitButton.querySelector("span").textContent = mySubmission ? "Update today's song" : "Share with STELLARS";
    }
}

/* =========================================================
   EVENTS
========================================================= */

elements.openButton.addEventListener("click", openComposer);
elements.signInButton.addEventListener("click", () => {
    window.location.assign("radio.html?login=1");
});
elements.searchButton.addEventListener("click", searchArtwork);
elements.upload.addEventListener("change", () => previewUploadedArtwork(elements.upload.files?.[0]));
elements.story.addEventListener("input", () => {
    elements.storyCount.textContent = `${elements.story.value.length} / 240`;
});
elements.form.addEventListener("submit", submitSong);
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.cancelForm.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => {
    if (event.target === elements.dialog) elements.dialog.close();
});
elements.dialog.addEventListener("close", resetComposer);

/* =========================================================
   SHARED STELLARS ACCOUNT
========================================================= */

onAuthStateChanged(auth, async user => {
    currentUser = user;
    currentProfile = null;

    if (unsubscribeDailyFeed) {
        unsubscribeDailyFeed();
        unsubscribeDailyFeed = null;
    }

    if (!user) {
        renderSignedOutState();
        return;
    }

    elements.mySongStatus.textContent = "Checking your STELLARS membership…";
    elements.openButton.disabled = true;
    elements.authGate.hidden = true;

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        if (auth.currentUser?.uid !== user.uid) return;

        const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
        if (!profile || profile.isActive !== true) {
            renderSignedOutState();
            elements.count.textContent = "Active membership required";
            elements.mySongStatus.textContent = "This account does not have an active STELLARS member profile.";
            elements.authGate.querySelector("strong").textContent = "Active STELLARS membership required";
            elements.authGate.querySelector("p").textContent = "Only active member accounts can view and share today's songs.";
            elements.signInButton.hidden = true;
            return;
        }

        currentProfile = profile;
        startDailyFeed();
    } catch (error) {
        console.error("Could not verify STELLARS Radio membership:", error);
        renderSignedOutState();
        elements.mySongStatus.textContent = "Membership could not be checked. Please refresh and try again.";
        elements.count.textContent = "Unable to verify membership";
    }
});

updateDailyClock();
setInterval(updateDailyClock, 1000);
