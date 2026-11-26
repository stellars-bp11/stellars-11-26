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
   STELLARS OPEN LETTERS — ONE LETTER PER ACTIVE MEMBER
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const elements = {
    status: document.getElementById("lettersComposerStatus"),
    openButton: document.getElementById("lettersOpenButton"),
    signInButton: document.getElementById("lettersSignInButton"),
    count: document.getElementById("lettersCount"),
    feed: document.getElementById("lettersFeed"),
    dialog: document.getElementById("lettersDialog"),
    form: document.getElementById("lettersForm"),
    closeDialog: document.getElementById("lettersCloseDialog"),
    cancelButton: document.getElementById("lettersCancelButton"),
    title: document.getElementById("lettersTitleInput"),
    message: document.getElementById("lettersMessageInput"),
    anonymous: document.getElementById("lettersAnonymousInput"),
    characterCount: document.getElementById("lettersCharacterCount"),
    formMessage: document.getElementById("lettersFormMessage"),
    submitButton: document.getElementById("lettersSubmitButton"),
    toast: document.getElementById("lettersToast")
};

let currentUser = null;
let currentProfile = null;
let myLetter = null;
let feedLoaded = false;
let unsubscribeLetters = null;
let toastTimeout = null;
let submitting = false;

function showToast(message, type = "success") {
    clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.classList.add("is-visible");
    toastTimeout = setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
}

function setFormMessage(message = "", type = "") {
    elements.formMessage.textContent = message;
    elements.formMessage.dataset.type = type;
}

function showFeedState(title, description, icon = "bx-mail-send") {
    elements.feed.replaceChildren();
    const state = document.createElement("div");
    state.className = "letters-feed-state";

    const iconWrap = document.createElement("span");
    iconWrap.className = "letters-state-icon";
    const iconElement = document.createElement("i");
    iconElement.className = "bx " + icon;
    iconElement.setAttribute("aria-hidden", "true");
    iconWrap.append(iconElement);

    const heading = document.createElement("strong");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = description;

    state.append(iconWrap, heading, copy);
    elements.feed.append(state);
}

function updateComposerState() {
    const activeMember = Boolean(currentUser && currentProfile?.isActive === true);

    elements.signInButton.hidden = Boolean(currentUser);
    elements.openButton.disabled = !activeMember || !feedLoaded;

    if (!currentUser) {
        elements.status.textContent = "Sign in with your active STELLARS account to read and write letters.";
        elements.openButton.querySelector("span").textContent = "Write your letter";
        return;
    }

    if (!activeMember) {
        elements.status.textContent = "This account does not have an active STELLARS member profile.";
        elements.openButton.querySelector("span").textContent = "Write your letter";
        return;
    }

    if (!feedLoaded) {
        elements.status.textContent = "Opening the STELLARS mailbox…";
        elements.openButton.querySelector("span").textContent = "Loading letters";
        return;
    }

    if (myLetter) {
        elements.status.textContent = "You have already left a letter. You can revisit and edit that same letter anytime.";
        elements.openButton.querySelector("span").textContent = "Edit your letter";
    } else {
        elements.status.textContent = "Your space on the wall is waiting. Leave one letter for the people orbiting beside you.";
        elements.openButton.querySelector("span").textContent = "Write your letter";
    }
}

function formatLetterDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") return "Just now";
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta"
    }).format(timestamp.toDate());
}

function buildLetterCard(letter, memberId) {
    const isYours = memberId === currentUser?.uid;
    const card = document.createElement("article");
    card.className = "letters-card" + (isYours ? " is-yours" : "");

    const top = document.createElement("div");
    top.className = "letters-card-top";

    const author = document.createElement("div");
    author.className = "letters-author";

    const mark = document.createElement("span");
    mark.className = "letters-author-mark";
    const markIcon = document.createElement("i");
    markIcon.className = "bx " + (letter.isAnonymous ? "bx-mask" : "bx-star");
    markIcon.setAttribute("aria-hidden", "true");
    mark.append(markIcon);

    const authorCopy = document.createElement("div");
    authorCopy.className = "letters-author-copy";
    const authorName = document.createElement("strong");
    authorName.textContent = letter.authorName || "A STELLARS Star";
    const authorTag = document.createElement("span");
    authorTag.textContent = isYours ? "YOUR LETTER" : "A LETTER FROM THE STARS";
    authorCopy.append(authorName, authorTag);
    author.append(mark, authorCopy);

    const date = document.createElement("time");
    date.className = "letters-date";
    date.textContent = formatLetterDate(letter.createdAt);
    top.append(author, date);

    const title = document.createElement("h3");
    title.className = "letters-card-title";
    title.textContent = letter.title || "";
    title.hidden = !letter.title;

    const message = document.createElement("p");
    message.className = "letters-card-message";
    message.textContent = letter.message || "";

    const footer = document.createElement("div");
    footer.className = "letters-card-footer";
    const footerNote = document.createElement("span");
    footerNote.textContent = letter.updatedAt && letter.createdAt &&
        letter.updatedAt.toMillis?.() !== letter.createdAt.toMillis?.()
        ? "A thought, revisited and rewritten."
        : "A little piece of a STELLARS story.";
    footer.append(footerNote);

    if (isYours) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "letters-edit-button";
        editButton.innerHTML = '<i class="bx bx-edit-alt" aria-hidden="true"></i> Edit letter';
        editButton.addEventListener("click", openComposer);
        footer.append(editButton);
    }

    card.append(top, title, message, footer);
    return card;
}

function renderLetters(snapshot) {
    const letters = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));

    myLetter = letters.find(letter => letter.id === currentUser?.uid) || null;
    feedLoaded = true;
    elements.feed.replaceChildren();
    elements.count.textContent = letters.length + " LETTER" + (letters.length === 1 ? "" : "S");

    if (letters.length === 0) {
        showFeedState(
            "The mailbox is quiet for now.",
            "Be the first Star to leave a few words here. Your letter could be the beginning of something lovely.",
            "bx-envelope-open"
        );
    } else {
        letters.forEach(letter => elements.feed.append(buildLetterCard(letter, letter.id)));
    }

    updateComposerState();
}

function renderSignedOutState() {
    feedLoaded = false;
    myLetter = null;
    elements.count.textContent = "MEMBERS ONLY";
    showFeedState(
        "A mailbox for STELLARS members.",
        "Sign in with your active STELLARS account to read the letters shared by the crew.",
        "bx-lock-alt"
    );
    updateComposerState();
}

function startLettersFeed() {
    if (unsubscribeLetters) {
        unsubscribeLetters();
        unsubscribeLetters = null;
    }

    feedLoaded = false;
    elements.count.textContent = "LOADING LETTERS";
    showFeedState("Opening the mailbox…", "Gathering the words shared by our stars.");
    updateComposerState();

    const lettersQuery = query(collection(db, "openLetters"), orderBy("createdAt", "desc"));
    unsubscribeLetters = onSnapshot(lettersQuery, renderLetters, error => {
        console.error("STELLARS Letters feed error:", error);
        feedLoaded = false;
        elements.count.textContent = "MAILBOX UNAVAILABLE";
        showFeedState(
            "The mailbox is not available yet.",
            error?.code === "permission-denied"
                ? "The latest Open Letters Firestore rules may not be published in Firebase Console yet."
                : "Check your connection and refresh the page.",
            "bx-error-circle"
        );
        updateComposerState();
    });
}

function openComposer() {
    if (!currentUser || currentProfile?.isActive !== true || !feedLoaded) {
        showToast("Sign in with an active STELLARS account first.", "error");
        return;
    }

    elements.form.reset();
    setFormMessage("");
    elements.characterCount.textContent = "0 / 2200";

    if (myLetter) {
        elements.title.value = myLetter.title || "";
        elements.message.value = myLetter.message || "";
        elements.anonymous.checked = Boolean(myLetter.isAnonymous);
        document.getElementById("lettersDialogTitle").textContent = "Revisit your letter.";
        elements.submitButton.querySelector("span").textContent = "Save changes";
    } else {
        document.getElementById("lettersDialogTitle").textContent = "Write your letter.";
        elements.submitButton.querySelector("span").textContent = "Publish letter";
    }

    elements.characterCount.textContent = elements.message.value.length + " / 2200";
    elements.dialog.showModal();
    elements.message.focus();
}

async function submitLetter(event) {
    event.preventDefault();
    if (submitting || !currentUser || currentProfile?.isActive !== true) return;

    const title = elements.title.value.trim();
    const message = elements.message.value.trim();
    const isAnonymous = elements.anonymous.checked;

    if (!message) {
        setFormMessage("Write a few words before publishing your letter.", "error");
        elements.message.focus();
        return;
    }
    if (title.length > 90 || message.length > 2200) {
        setFormMessage("Your letter is longer than the allowed limit.", "error");
        return;
    }

    const authorName = isAnonymous
        ? "Anonymous Star"
        : String(currentProfile.fullName || currentUser.displayName || "A STELLARS Star").trim().slice(0, 100);

    const payload = {
        authorName,
        isAnonymous,
        title,
        message,
        updatedAt: serverTimestamp()
    };

    submitting = true;
    elements.submitButton.disabled = true;
    elements.submitButton.querySelector("span").textContent = myLetter ? "Saving…" : "Publishing…";
    setFormMessage("Saving your letter…", "info");

    try {
        const ownLetterRef = doc(db, "openLetters", currentUser.uid);

        if (myLetter) {
            await updateDoc(ownLetterRef, payload);
        } else {
            await setDoc(ownLetterRef, {
                ...payload,
                createdAt: serverTimestamp()
            });
        }

        elements.dialog.close();
        showToast(myLetter ? "Your letter has been updated." : "Your letter is now part of the STELLARS mailbox.");
    } catch (error) {
        console.error("Could not save STELLARS letter:", error);
        let messageText = error?.message || "Your letter could not be saved. Please try again.";
        if (error?.code === "permission-denied") {
            messageText = "Letters access is not ready yet. Publish the latest firestore.rules file, then refresh this page.";
        }
        setFormMessage(messageText, "error");
    } finally {
        submitting = false;
        elements.submitButton.disabled = false;
        elements.submitButton.querySelector("span").textContent = myLetter ? "Save changes" : "Publish letter";
    }
}

elements.openButton.addEventListener("click", openComposer);
elements.signInButton.addEventListener("click", () => {
    window.location.assign("letters.html?login=1");
});
elements.form.addEventListener("submit", submitLetter);
elements.message.addEventListener("input", () => {
    elements.characterCount.textContent = elements.message.value.length + " / 2200";
});
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.cancelButton.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => {
    if (event.target === elements.dialog) elements.dialog.close();
});

onAuthStateChanged(auth, async user => {
    currentUser = user;
    currentProfile = null;
    myLetter = null;
    feedLoaded = false;

    if (unsubscribeLetters) {
        unsubscribeLetters();
        unsubscribeLetters = null;
    }

    if (!user) {
        renderSignedOutState();
        return;
    }

    elements.status.textContent = "Checking your STELLARS membership…";
    elements.openButton.disabled = true;
    showFeedState("Checking your membership…", "Making sure this mailbox stays within the STELLARS community.");

    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        if (auth.currentUser?.uid !== user.uid) return;

        const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
        if (!profile || profile.isActive !== true) {
            currentProfile = null;
            elements.count.textContent = "ACTIVE MEMBERS ONLY";
            showFeedState(
                "Active STELLARS membership required.",
                "This account does not have an active member profile.",
                "bx-lock-alt"
            );
            updateComposerState();
            return;
        }

        currentProfile = profile;
        startLettersFeed();
    } catch (error) {
        console.error("Could not verify STELLARS Letters membership:", error);
        currentProfile = null;
        elements.count.textContent = "MEMBERSHIP CHECK FAILED";
        showFeedState(
            "We could not open the mailbox.",
            error?.code === "permission-denied"
                ? "Your member profile could not be verified. Check the current Firestore access rules."
                : "Check your connection and refresh the page.",
            "bx-error-circle"
        );
        updateComposerState();
    }
});
