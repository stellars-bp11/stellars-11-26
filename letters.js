import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
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
    toast: document.getElementById("lettersToast"),
    safetyButton: document.getElementById("lettersSafetyReviewButton"),
    safetyPanel: document.getElementById("lettersSafetyPanel"),
    safetyClose: document.getElementById("lettersSafetyCloseButton"),
    safetyStatus: document.getElementById("lettersSafetyStatus"),
    safetyFeed: document.getElementById("lettersSafetyFeed"),
    viewTabs: document.querySelectorAll("[data-letters-view]"),
    composeSection: document.getElementById("lettersComposeSection"),
    wallSection: document.getElementById("lettersWallSection"),
    privateWriteSection: document.getElementById("privateLetterWriteSection"),
    privateInboxSection: document.getElementById("privateLetterInboxSection"),
    privateSentSection: document.getElementById("privateLetterSentSection"),
    privateForm: document.getElementById("privateLetterForm"),
    recipientSearch: document.getElementById("privateRecipientSearch"),
    recipientResults: document.getElementById("privateRecipientResults"),
    recipientSelected: document.getElementById("privateRecipientSelected"),
    recipientStatus: document.getElementById("privateRecipientStatus"),
    privateTitle: document.getElementById("privateLetterTitleInput"),
    privateMessage: document.getElementById("privateLetterMessageInput"),
    privateAnonymous: document.getElementById("privateLetterAnonymousInput"),
    privateCharacterCount: document.getElementById("privateLetterCharacterCount"),
    privateFormMessage: document.getElementById("privateLetterFormMessage"),
    privateSubmitButton: document.getElementById("privateLetterSubmitButton"),
    privateResetButton: document.getElementById("privateLetterResetButton"),
    inboxStatus: document.getElementById("privateInboxStatus"),
    inboxList: document.getElementById("privateInboxList"),
    inboxTabCount: document.getElementById("privateInboxTabCount"),
    sentStatus: document.getElementById("privateSentStatus"),
    sentList: document.getElementById("privateSentList")
};

let currentUser = null;
let currentProfile = null;
let myLetter = null;
let ownLetterId = null;
let hasPrivateOwnerRecord = false;
let canReviewSafety = false;
let cachedLetters = [];
let memberDirectory = null;
let selectedRecipient = null;
let privateSubmitting = false;
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

    cachedLetters = letters;
    myLetter = letters.find(letter =>
        letter.id === ownLetterId ||
        (!hasPrivateOwnerRecord && letter.id === currentUser?.uid)
    ) || null;
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

function switchLettersView(view) {
    const isOpen = view === "open";
    elements.composeSection.hidden = !isOpen;
    elements.wallSection.hidden = !isOpen;
    elements.privateWriteSection.hidden = view !== "write";
    elements.privateInboxSection.hidden = view !== "inbox";
    elements.privateSentSection.hidden = view !== "sent";

    elements.viewTabs.forEach(button => {
        const selected = button.dataset.lettersView === view;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-selected", selected ? "true" : "false");
    });

    if (view !== "open") elements.safetyPanel.hidden = true;
    if (view === "inbox") loadPrivateInbox();
    if (view === "sent") loadPrivateSent();
    if (view === "write") {
        elements.recipientSearch.focus();
    }
}

async function loadMemberDirectory() {
    if (memberDirectory) return memberDirectory;
    const directoryQuery = query(
        collection(db, "nimIndex"),
        where("isActive", "==", true),
        limit(100)
    );
    const snapshot = await getDocs(directoryQuery);
    memberDirectory = snapshot.docs.map(item => ({
        nim: item.id,
        uid: item.data().uid,
        fullName: item.data().fullName
    })).filter(member => member.uid && member.fullName && member.nim);
    return memberDirectory;
}

function selectPrivateRecipient(member) {
    selectedRecipient = member;
    elements.recipientSearch.value = "";
    elements.recipientResults.replaceChildren();
    elements.recipientResults.hidden = true;
    elements.recipientSelected.hidden = false;
    elements.recipientSelected.textContent = `To: ${member.fullName} · NIM ${member.nim}`;
    elements.recipientStatus.textContent = "Recipient selected. Check the name and NIM before sending.";
}

async function searchPrivateRecipients() {
    const term = elements.recipientSearch.value.trim().toLowerCase();
    selectedRecipient = null;
    elements.recipientSelected.hidden = true;
    elements.recipientSelected.textContent = "";
    elements.recipientResults.replaceChildren();

    if (term.length < 2) {
        elements.recipientResults.hidden = true;
        elements.recipientStatus.textContent = "Type at least 2 characters to search by name or NIM.";
        return;
    }

    elements.recipientStatus.textContent = "Searching active STELLARS members…";
    try {
        const directory = await loadMemberDirectory();
        const matches = directory.filter(member =>
            member.uid !== currentUser?.uid &&
            (member.fullName.toLowerCase().includes(term) || member.nim.includes(term))
        ).slice(0, 8);

        elements.recipientResults.hidden = matches.length === 0;
        if (!matches.length) {
            elements.recipientStatus.textContent = "No matching active member found. Check the spelling or NIM.";
            return;
        }

        matches.forEach(member => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "private-recipient-option";

            const identity = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = member.fullName;
            const nim = document.createElement("small");
            nim.textContent = `NIM ${member.nim}`;
            identity.append(name, nim);

            const arrow = document.createElement("i");
            arrow.className = "bx bx-chevron-right";
            arrow.setAttribute("aria-hidden", "true");
            option.append(identity, arrow);
            option.addEventListener("click", () => selectPrivateRecipient(member));
            elements.recipientResults.append(option);
        });

        elements.recipientStatus.textContent = `${matches.length} matching member(s). Select the intended recipient.`;
    } catch (error) {
        console.error("Could not load STELLARS member directory:", error);
        elements.recipientStatus.textContent = error?.code === "permission-denied"
            ? "Member lookup is unavailable. Publish the latest Firestore Rules."
            : "Member lookup failed. Check your connection and try again.";
    }
}

function formatPrivateDate(timestamp) {
    return formatLetterDate(timestamp);
}

function createPrivateMailCard({ letter, mode }) {
    const card = document.createElement("article");
    const isUnread = mode === "inbox" && !letter.readAt;
    card.className = "private-mail-card" + (isUnread ? " is-unread" : "");

    const top = document.createElement("div");
    top.className = "private-mail-card-top";

    const identity = document.createElement("strong");
    identity.textContent = mode === "inbox"
        ? `From: ${letter.senderName || "A STELLARS Star"}`
        : `To: ${letter.recipientName || "STELLARS member"}`;

    const date = document.createElement("small");
    date.textContent = formatPrivateDate(letter.createdAt);
    top.append(identity, date);

    const status = document.createElement("span");
    status.className = "private-mail-status";
    status.textContent = mode === "inbox"
        ? (isUnread ? "UNREAD" : "READ")
        : "SENT PRIVATELY";

    const title = document.createElement("h3");
    title.textContent = letter.title || "A little note";

    const message = document.createElement("p");
    message.textContent = letter.message || "";

    card.append(top, status, title, message);

    if (mode === "inbox" && isUnread) {
        const actions = document.createElement("div");
        actions.className = "private-mail-card-actions";
        const markRead = document.createElement("button");
        markRead.type = "button";
        markRead.textContent = "Mark as read";
        markRead.addEventListener("click", async () => {
            markRead.disabled = true;
            markRead.textContent = "Saving…";
            try {
                await updateDoc(doc(db, "privateLetters", letter.id), {
                    readAt: serverTimestamp()
                });
                loadPrivateInbox();
            } catch (error) {
                console.error("Could not mark private letter as read:", error);
                markRead.disabled = false;
                markRead.textContent = "Try again";
            }
        });
        actions.append(markRead);
        card.append(actions);
    }

    return card;
}

async function loadPrivateInbox() {
    if (!currentUser || currentProfile?.isActive !== true) return;
    elements.inboxStatus.textContent = "Loading your received letters…";
    elements.inboxList.replaceChildren();

    try {
        const inboxQuery = query(
            collection(db, "privateLetters"),
            where("recipientUid", "==", currentUser.uid),
            limit(100)
        );
        const snapshot = await getDocs(inboxQuery);
        const letters = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        const unread = letters.filter(letter => !letter.readAt).length;

        elements.inboxTabCount.textContent = unread > 99 ? "99+" : String(unread);
        elements.inboxTabCount.hidden = unread === 0;
        elements.inboxStatus.textContent = letters.length
            ? `${letters.length} private letter(s) received · ${unread} unread`
            : "Your inbox is quiet for now. Private letters sent to you will appear here.";

        letters.forEach(letter => elements.inboxList.append(
            createPrivateMailCard({ letter, mode: "inbox" })
        ));
    } catch (error) {
        console.error("Could not load private inbox:", error);
        elements.inboxStatus.textContent = error?.code === "permission-denied"
            ? "Inbox access denied. Publish the latest Firestore Rules, then refresh."
            : "Your inbox could not be loaded. Please refresh and try again.";
    }
}

async function loadPrivateSent() {
    if (!currentUser || currentProfile?.isActive !== true) return;
    elements.sentStatus.textContent = "Loading your sent letters…";
    elements.sentList.replaceChildren();

    try {
        const sentQuery = query(
            collection(db, "privateLetterSenders", currentUser.uid, "letters"),
            orderBy("createdAt", "desc"),
            limit(100)
        );
        const mappingSnapshot = await getDocs(sentQuery);
        const sent = mappingSnapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        })).sort((a, b) =>
            (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );

        elements.sentStatus.textContent = sent.length
            ? `${sent.length} private letter(s) sent`
            : "You have not sent a private letter yet.";

        sent.forEach(letter => {
            elements.sentList.append(createPrivateMailCard({
                letter: {
                    ...letter,
                    recipientName: letter.recipientName || "STELLARS member"
                },
                mode: "sent"
            }));
        });
    } catch (error) {
        console.error("Could not load sent private letters:", error);
        elements.sentStatus.textContent = error?.code === "permission-denied"
            ? "Sent access denied for your private sender archive. Publish the latest Firestore Rules, then refresh."
            : "Your sent letters could not be loaded. Please refresh and try again.";
    }
}

function clearPrivateLetterComposer() {
    elements.privateForm.reset();
    selectedRecipient = null;
    elements.recipientResults.replaceChildren();
    elements.recipientResults.hidden = true;
    elements.recipientSelected.textContent = "";
    elements.recipientSelected.hidden = true;
    elements.recipientStatus.textContent = "Search for a member by name or NIM, then select the correct person.";
    elements.privateCharacterCount.textContent = "0 / 2200";
    elements.privateFormMessage.textContent = "";
    elements.privateSubmitButton.disabled = false;
    elements.privateSubmitButton.querySelector("span").textContent = "Send private letter";
}

async function submitPrivateLetter(event) {
    event.preventDefault();
    if (privateSubmitting || !currentUser || currentProfile?.isActive !== true) return;

    if (!selectedRecipient) {
        elements.privateFormMessage.textContent = "Select one recipient before sending.";
        elements.recipientSearch.focus();
        return;
    }

    const title = elements.privateTitle.value.trim();
    const message = elements.privateMessage.value.trim();
    const isAnonymous = elements.privateAnonymous.checked;
    if (!message) {
        elements.privateFormMessage.textContent = "Write a message before sending.";
        elements.privateMessage.focus();
        return;
    }
    if (title.length > 90 || message.length > 2200) {
        elements.privateFormMessage.textContent = "Your letter is longer than the allowed limit.";
        return;
    }

    privateSubmitting = true;
    elements.privateSubmitButton.disabled = true;
    elements.privateSubmitButton.querySelector("span").textContent = "Sending…";
    elements.privateFormMessage.textContent = "Sending your private letter…";

    try {
        const senderName = isAnonymous
            ? "Anonymous Star"
            : String(currentProfile.fullName || currentUser.displayName || "A STELLARS Star").trim().slice(0, 100);
        const letterRef = doc(collection(db, "privateLetters"));
        const senderMapRef = doc(db, "privateLetterSenders", currentUser.uid, "letters", letterRef.id);
        const batch = writeBatch(db);

        batch.set(letterRef, {
            recipientUid: selectedRecipient.uid,
            senderName,
            isAnonymous,
            title,
            message,
            createdAt: serverTimestamp(),
            readAt: null
        });
        batch.set(senderMapRef, {
            letterId: letterRef.id,
            recipientUid: selectedRecipient.uid,
            recipientName: selectedRecipient.fullName,
            senderName,
            isAnonymous,
            title,
            message,
            createdAt: serverTimestamp()
        });
        await batch.commit();

        clearPrivateLetterComposer();
        showToast("Your private letter has been delivered.");
        switchLettersView("sent");
    } catch (error) {
        console.error("Could not send a private STELLARS letter:", error);
        elements.privateFormMessage.textContent = error?.code === "permission-denied"
            ? "Private Letters access is not ready. Publish the latest Firestore Rules, then refresh."
            : "Your letter could not be sent. Check your connection and try again.";
    } finally {
        privateSubmitting = false;
        elements.privateSubmitButton.disabled = false;
        elements.privateSubmitButton.querySelector("span").textContent = "Send private letter";
    }
}

async function loadSafetyReview() {
    if (!canReviewSafety) return;

    elements.safetyPanel.hidden = false;
    elements.safetyStatus.textContent = "Loading private authorship records…";
    elements.safetyFeed.replaceChildren();

    try {
        const ownerSnapshot = await getDocs(collection(db, "openLetterOwners"));
        const ownersByLetterId = new Map(
            ownerSnapshot.docs.map(item => [item.data().letterId, {
                uid: item.id,
                ...item.data()
            }])
        );

        const records = [];
        for (const letter of cachedLetters) {
            const owner = ownersByLetterId.get(letter.id);
            let authorName = owner?.fullName || "";
            const legacy = !owner;

            if (!authorName && legacy) {
                try {
                    const profileSnapshot = await getDoc(doc(db, "users", letter.id));
                    authorName = profileSnapshot.exists()
                        ? String(profileSnapshot.data().fullName || "")
                        : "";
                } catch (profileError) {
                    console.warn("Could not resolve a legacy letter author:", profileError);
                }
            }

            records.push({ letter, authorName: authorName || "Author not resolved", legacy });
        }

        elements.safetyFeed.replaceChildren();
        if (!records.length) {
            elements.safetyStatus.textContent = "There are no letters to review.";
            return;
        }

        records.forEach(({ letter, authorName, legacy }) => {
            const card = document.createElement("article");
            card.className = "letters-safety-card";

            const top = document.createElement("div");
            top.className = "letters-safety-card-top";

            const name = document.createElement("strong");
            name.textContent = authorName;

            const tag = document.createElement("span");
            tag.textContent = letter.isAnonymous
                ? "PUBLISHED ANONYMOUSLY"
                : "NAME SHOWN ON WALL";
            top.append(name, tag);

            const title = document.createElement("h4");
            title.textContent = letter.title || "Untitled letter";

            const message = document.createElement("p");
            message.textContent = letter.message || "";

            const note = document.createElement("small");
            note.textContent = legacy
                ? "Legacy entry · author resolved from its original account record"
                : "Private author record · visible only to the designated moderator";

            card.append(top, title, message, note);
            elements.safetyFeed.append(card);
        });

        elements.safetyStatus.textContent =
            "Private review view. Authorship is shown here only to the designated STELLARS SuperAdmin moderator.";
    } catch (error) {
        console.error("STELLARS Letters safety review failed:", error);
        elements.safetyStatus.textContent = error?.code === "permission-denied"
            ? "Access denied. Check the deployed Firestore Rules and this account’s canModerateLetters permission."
            : "The private review list could not be loaded. Refresh and try again.";
    }
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
        const ownerRef = doc(db, "openLetterOwners", currentUser.uid);

        if (myLetter && hasPrivateOwnerRecord) {
            await updateDoc(doc(db, "openLetters", ownLetterId), payload);
        } else if (myLetter) {
            // Migrate this account's legacy UID-keyed letter to a random public document ID.
            const newLetterRef = doc(collection(db, "openLetters"));
            const batch = writeBatch(db);
            batch.set(ownerRef, {
                letterId: newLetterRef.id,
                fullName: String(currentProfile.fullName || currentUser.displayName || "A STELLARS Star").trim().slice(0, 100),
                createdAt: serverTimestamp()
            });
            batch.set(newLetterRef, {
                ...payload,
                createdAt: myLetter.createdAt || serverTimestamp()
            });
            batch.delete(doc(db, "openLetters", myLetter.id));
            await batch.commit();
            ownLetterId = newLetterRef.id;
            hasPrivateOwnerRecord = true;
        } else if (hasPrivateOwnerRecord && ownLetterId) {
            await setDoc(doc(db, "openLetters", ownLetterId), {
                ...payload,
                createdAt: serverTimestamp()
            });
        } else {
            // New posts use random IDs; the private owner mapping is readable only by
            // the author and the designated moderation account.
            const newLetterRef = doc(collection(db, "openLetters"));
            const batch = writeBatch(db);
            batch.set(ownerRef, {
                letterId: newLetterRef.id,
                fullName: String(currentProfile.fullName || currentUser.displayName || "A STELLARS Star").trim().slice(0, 100),
                createdAt: serverTimestamp()
            });
            batch.set(newLetterRef, {
                ...payload,
                createdAt: serverTimestamp()
            });
            await batch.commit();
            ownLetterId = newLetterRef.id;
            hasPrivateOwnerRecord = true;
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
elements.viewTabs.forEach(button => {
    button.addEventListener("click", () => switchLettersView(button.dataset.lettersView));
});
elements.recipientSearch.addEventListener("input", searchPrivateRecipients);
elements.privateForm.addEventListener("submit", submitPrivateLetter);
elements.privateResetButton.addEventListener("click", clearPrivateLetterComposer);
elements.privateMessage.addEventListener("input", () => {
    elements.privateCharacterCount.textContent = `${elements.privateMessage.value.length} / 2200`;
});
elements.safetyButton.addEventListener("click", loadSafetyReview);
elements.safetyClose.addEventListener("click", () => {
    elements.safetyPanel.hidden = true;
});
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
    memberDirectory = null;
    selectedRecipient = null;
    ownLetterId = null;
    hasPrivateOwnerRecord = false;
    canReviewSafety = false;
    cachedLetters = [];
    elements.safetyButton.hidden = true;
    elements.safetyPanel.hidden = true;
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
        canReviewSafety =
            ["superAdmin", "super_admin"].includes(profile.role) &&
            profile.canModerateLetters === true;
        elements.safetyButton.hidden = !canReviewSafety;
        elements.safetyPanel.hidden = true;

        try {
            const ownerSnapshot = await getDoc(doc(db, "openLetterOwners", user.uid));
            hasPrivateOwnerRecord = ownerSnapshot.exists();
            ownLetterId = hasPrivateOwnerRecord
                ? String(ownerSnapshot.data().letterId || user.uid)
                : user.uid;
        } catch (ownerError) {
            console.warn("Private Letters owner record is not available yet:", ownerError);
            hasPrivateOwnerRecord = false;
            ownLetterId = user.uid;
        }

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
