import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    deleteDoc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
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
    toast: document.getElementById("radioToast"),
    notificationsButton: document.getElementById("radioNotificationsButton"),
    notificationsCount: document.getElementById("radioNotificationsCount"),
    notificationsPanel: document.getElementById("radioNotificationsPanel"),
    notificationsList: document.getElementById("radioNotificationsList"),
    markAllNotificationsRead: document.getElementById("markAllNotificationsRead")
};

let currentUser = null;
let currentProfile = null;
let activeDayKey = getJakartaDayKey();
let mySubmission = null;
let selectedArtwork = null;
let uploadedArtworkFile = null;
let unsubscribeDailyFeed = null;
let unsubscribeRadioNotifications = null;
let commentSubscriptions = new Map();
let replySubscriptions = new Map();
let pendingReplyTarget = null;
let radioNotifications = [];
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

function stopCommentSubscriptions() {
    commentSubscriptions.forEach(unsubscribe => unsubscribe());
    commentSubscriptions.clear();
    replySubscriptions.forEach(unsubscribe => unsubscribe());
    replySubscriptions.clear();
    pendingReplyTarget = null;
}

function stopSongReplySubscriptions(songUid) {
    const prefix = activeDayKey + ":" + songUid + ":";
    for (const [key, unsubscribe] of replySubscriptions.entries()) {
        if (!key.startsWith(prefix)) continue;
        unsubscribe();
        replySubscriptions.delete(key);
    }
}

function formatRadioTimestamp(timestamp, includeDate = false) {
    const date = timestamp && typeof timestamp.toDate === "function" ? timestamp.toDate() : null;
    if (!date) return "Just now";
    const options = includeDate
        ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
        : { hour: "2-digit", minute: "2-digit" };
    return new Intl.DateTimeFormat("en-ID", options).format(date);
}

function renderSongComments(song, snapshot, list, toggleButton) {
    list.replaceChildren();
    const comments = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    toggleButton.textContent = comments.length ? "Comments (" + comments.length + ")" : "Comments";

    if (!comments.length) {
        const empty = document.createElement("p");
        empty.className = "radio-comments-empty";
        empty.textContent = "No comments yet. Start the conversation.";
        list.append(empty);
        return;
    }

    comments.forEach(comment => {
        const item = document.createElement("article");
        item.className = "radio-comment-item";
        item.id = "radio-comment-" + comment.id;

        const header = document.createElement("div");
        header.className = "radio-comment-header";
        const author = document.createElement("strong");
        author.textContent = comment.displayName || "STELLARS Member";
        const time = document.createElement("time");
        time.textContent = formatRadioTimestamp(comment.createdAt);
        header.append(author, time);

        const body = document.createElement("p");
        body.className = "radio-comment-text";
        body.textContent = comment.text || "";
        item.append(header, body);

        const canDelete = currentProfile && currentProfile.isActive === true &&
            (comment.uid === (currentUser && currentUser.uid) ||
             song.uid === (currentUser && currentUser.uid));
        if (canDelete) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "radio-comment-delete";
            remove.textContent = "Delete";
            remove.addEventListener("click", async () => {
                if (!currentUser || !currentProfile || currentProfile.isActive !== true) return;
                remove.disabled = true;
                try {
                    await deleteDoc(doc(
                        db, "radioDays", activeDayKey, "songs", song.uid, "comments", comment.id
                    ));
                    showToast("Comment deleted.");
                } catch (error) {
                    console.error("Could not delete Radio comment:", error);
                    showToast("This comment could not be deleted.", "error");
                    remove.disabled = false;
                }
            });
            item.append(remove);
        }

        item.append(createCommentReplies(song, comment));
        list.append(item);

        if (pendingReplyTarget && pendingReplyTarget.commentId === comment.id &&
            Date.now() <= pendingReplyTarget.expiresAt) {
            const replyToggle = item.querySelector(".radio-replies-toggle");
            const replyPanel = item.querySelector(".radio-replies-panel");
            if (replyToggle && replyPanel && replyPanel.hidden) replyToggle.click();
        }
    });
}

function subscribeSongComments(song, list, toggleButton) {
    const key = activeDayKey + ":" + song.uid;
    if (commentSubscriptions.has(key)) return;

    const commentsQuery = query(
        collection(db, "radioDays", activeDayKey, "songs", song.uid, "comments"),
        orderBy("createdAt", "asc"),
        limit(100)
    );
    const unsubscribe = onSnapshot(commentsQuery, snapshot => {
        renderSongComments(song, snapshot, list, toggleButton);
    }, error => {
        console.error("Could not load Radio comments:", error);
        list.replaceChildren();
        const message = document.createElement("p");
        message.className = "radio-comments-empty";
        message.textContent = "Comments are unavailable right now. Check the latest Firestore rules.";
        list.append(message);
    });
    commentSubscriptions.set(key, unsubscribe);
}

async function submitSongComment(song, input, submitButton) {
    const text = input.value.trim();
    if (!currentUser || !currentProfile || currentProfile.isActive !== true) {
        showToast("Sign in with an active STELLARS account to comment.", "error");
        return;
    }
    if (!text) {
        input.focus();
        return;
    }
    if (text.length > 280) {
        showToast("Comments can contain up to 280 characters.", "error");
        return;
    }

    submitButton.disabled = true;
    try {
        const commentRef = doc(collection(
            db, "radioDays", activeDayKey, "songs", song.uid, "comments"
        ));
        const commenterName = String(
            currentProfile.fullName || currentUser.displayName || "STELLARS Member"
        );
        const batch = writeBatch(db);
        batch.set(commentRef, {
            uid: currentUser.uid,
            displayName: commenterName,
            text: text,
            createdAt: serverTimestamp()
        });

        if (song.uid !== currentUser.uid) {
            const notificationRef = doc(
                db, "radioNotifications", song.uid, "items", commentRef.id
            );
            batch.set(notificationRef, {
                type: "radio_comment",
                dayKey: activeDayKey,
                songOwnerUid: song.uid,
                songTitle: String(song.songTitle || "your song"),
                commentId: commentRef.id,
                commenterUid: currentUser.uid,
                commenterName: commenterName,
                commentText: text,
                createdAt: serverTimestamp(),
                readAt: null
            });
        }

        await batch.commit();
        input.value = "";
        showToast(song.uid === currentUser.uid
            ? "Your comment has been added."
            : "Comment posted. The song owner has been notified.");
    } catch (error) {
        console.error("Could not post Radio comment:", error);
        showToast(
            error && error.code === "permission-denied"
                ? "Comment access is not ready yet. The latest Firestore rules must be deployed."
                : ((error && error.message) || "Your comment could not be posted."),
            "error"
        );
    } finally {
        submitButton.disabled = false;
    }
}

function renderCommentReplies(song, comment, snapshot, list, toggleButton) {
    list.replaceChildren();
    const replies = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    toggleButton.textContent = replies.length
        ? "Replies (" + replies.length + ")"
        : "Reply";

    if (!replies.length) {
        const empty = document.createElement("p");
        empty.className = "radio-replies-empty";
        empty.textContent = "No replies yet.";
        list.append(empty);
    }

    replies.forEach(reply => {
        const item = document.createElement("article");
        item.className = "radio-reply-item";
        item.id = "radio-reply-" + reply.id;

        const header = document.createElement("div");
        header.className = "radio-reply-header";
        const author = document.createElement("strong");
        author.textContent = reply.displayName || "STELLARS Member";
        const time = document.createElement("time");
        time.textContent = formatRadioTimestamp(reply.createdAt);
        header.append(author, time);

        const body = document.createElement("p");
        body.className = "radio-reply-text";
        body.textContent = reply.text || "";
        item.append(header, body);

        const canDelete = currentProfile && currentProfile.isActive === true &&
            (reply.uid === (currentUser && currentUser.uid) ||
             song.uid === (currentUser && currentUser.uid) ||
             comment.uid === (currentUser && currentUser.uid));
        if (canDelete) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "radio-comment-delete";
            remove.textContent = "Delete reply";
            remove.addEventListener("click", async () => {
                if (!currentUser || !currentProfile || currentProfile.isActive !== true) return;
                remove.disabled = true;
                try {
                    await deleteDoc(doc(
                        db, "radioDays", activeDayKey, "songs", song.uid,
                        "comments", comment.id, "replies", reply.id
                    ));
                    showToast("Reply deleted.");
                } catch (error) {
                    console.error("Could not delete Radio reply:", error);
                    showToast("This reply could not be deleted.", "error");
                    remove.disabled = false;
                }
            });
            item.append(remove);
        }

        list.append(item);

        if (pendingReplyTarget &&
            pendingReplyTarget.commentId === comment.id &&
            pendingReplyTarget.replyId === reply.id) {
            item.classList.add("is-notification-target");
            item.scrollIntoView({ behavior: "smooth", block: "center" });
            pendingReplyTarget = null;
        }
    });

    if (pendingReplyTarget && pendingReplyTarget.commentId === comment.id &&
        Date.now() > pendingReplyTarget.expiresAt) {
        pendingReplyTarget = null;
    }
}

function subscribeCommentReplies(song, comment, list, toggleButton) {
    const key = activeDayKey + ":" + song.uid + ":" + comment.id;
    if (replySubscriptions.has(key)) return;

    const repliesQuery = query(
        collection(
            db, "radioDays", activeDayKey, "songs", song.uid,
            "comments", comment.id, "replies"
        ),
        orderBy("createdAt", "asc"),
        limit(100)
    );

    const unsubscribe = onSnapshot(repliesQuery, snapshot => {
        renderCommentReplies(song, comment, snapshot, list, toggleButton);
    }, error => {
        console.error("Could not load Radio replies:", error);
        list.replaceChildren();
        const message = document.createElement("p");
        message.className = "radio-replies-empty";
        message.textContent = "Replies are unavailable right now. Check the latest Firestore rules.";
        list.append(message);
    });

    replySubscriptions.set(key, unsubscribe);
}

async function submitCommentReply(song, comment, input, submitButton) {
    const text = input.value.trim();
    if (!currentUser || !currentProfile || currentProfile.isActive !== true) {
        showToast("Sign in with an active STELLARS account to reply.", "error");
        return;
    }
    if (!text) {
        input.focus();
        return;
    }
    if (text.length > 280) {
        showToast("Replies can contain up to 280 characters.", "error");
        return;
    }

    submitButton.disabled = true;
    try {
        const replyRef = doc(collection(
            db, "radioDays", activeDayKey, "songs", song.uid,
            "comments", comment.id, "replies"
        ));
        const replierName = String(
            currentProfile.fullName || currentUser.displayName || "STELLARS Member"
        );
        const batch = writeBatch(db);

        batch.set(replyRef, {
            uid: currentUser.uid,
            displayName: replierName,
            text: text,
            createdAt: serverTimestamp()
        });

        // Notify the author of the original comment, not necessarily the song owner.
        if (comment.uid !== currentUser.uid) {
            const notificationRef = doc(
                db, "radioNotifications", comment.uid, "items", replyRef.id
            );
            batch.set(notificationRef, {
                type: "radio_reply",
                dayKey: activeDayKey,
                songOwnerUid: song.uid,
                songTitle: String(song.songTitle || "a STELLARS Radio song"),
                commentId: comment.id,
                replyId: replyRef.id,
                commenterUid: currentUser.uid,
                commenterName: replierName,
                commentText: text,
                createdAt: serverTimestamp(),
                readAt: null
            });
        }

        await batch.commit();
        input.value = "";
        showToast(comment.uid === currentUser.uid
            ? "Your reply has been added."
            : "Reply posted. The original commenter has been notified.");
    } catch (error) {
        console.error("Could not post Radio reply:", error);
        showToast(
            error && error.code === "permission-denied"
                ? "Reply access is not ready yet. Deploy the latest Firestore rules."
                : ((error && error.message) || "Your reply could not be posted."),
            "error"
        );
    } finally {
        submitButton.disabled = false;
    }
}

function createCommentReplies(song, comment) {
    const section = document.createElement("section");
    section.className = "radio-replies";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "radio-replies-toggle";
    toggle.textContent = "Reply";
    toggle.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "radio-replies-panel";
    panel.hidden = true;

    const list = document.createElement("div");
    list.className = "radio-replies-list";
    panel.append(list);

    if (currentUser && currentProfile && currentProfile.isActive === true) {
        const form = document.createElement("form");
        form.className = "radio-reply-form";

        const input = document.createElement("textarea");
        input.maxLength = 280;
        input.rows = 2;
        input.placeholder = "Write a reply…";
        input.setAttribute("aria-label", "Reply to " + (comment.displayName || "this comment"));

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "radio-reply-submit";
        submit.innerHTML = '<i class="bx bx-reply" aria-hidden="true"></i><span>Reply</span>';

        form.append(input, submit);
        form.addEventListener("submit", event => {
            event.preventDefault();
            void submitCommentReply(song, comment, input, submit);
        });
        panel.append(form);
    } else {
        const signInNote = document.createElement("p");
        signInNote.className = "radio-replies-empty";
        signInNote.textContent = "Sign in with an active STELLARS account to reply.";
        panel.append(signInNote);
    }

    toggle.addEventListener("click", () => {
        const opening = panel.hidden;
        panel.hidden = !opening;
        toggle.setAttribute("aria-expanded", String(opening));

        const key = activeDayKey + ":" + song.uid + ":" + comment.id;
        if (opening) {
            subscribeCommentReplies(song, comment, list, toggle);
        } else {
            const unsubscribe = replySubscriptions.get(key);
            if (unsubscribe) unsubscribe();
            replySubscriptions.delete(key);
        }
    });

    section.append(toggle, panel);
    return section;
}

function createSongComments(song) {
    const section = document.createElement("section");
    section.className = "radio-comments";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "radio-comments-toggle";
    toggle.textContent = "Comments";
    toggle.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "radio-comments-panel";
    panel.hidden = true;
    const list = document.createElement("div");
    list.className = "radio-comments-list";
    panel.append(list);

    if (currentUser && currentProfile && currentProfile.isActive === true) {
        const form = document.createElement("form");
        form.className = "radio-comment-form";

        const input = document.createElement("textarea");
        input.maxLength = 280;
        input.rows = 2;
        input.placeholder = "Say something about this song…";
        input.setAttribute("aria-label", "Comment on " + (song.songTitle || "this song"));

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "radio-comment-submit";
        submit.innerHTML = '<i class="bx bx-send" aria-hidden="true"></i><span>Post comment</span>';

        const helper = document.createElement("small");
        helper.className = "radio-comment-helper";
        helper.textContent = "Be kind · 280 characters max";

        form.append(input, submit, helper);
        form.addEventListener("submit", event => {
            event.preventDefault();
            void submitSongComment(song, input, submit);
        });
        panel.append(form);
    } else {
        const signInNote = document.createElement("p");
        signInNote.className = "radio-comments-signin";
        signInNote.textContent = "Sign in with an active STELLARS account to join the conversation.";
        panel.append(signInNote);
    }

    toggle.addEventListener("click", () => {
        const opening = panel.hidden;
        panel.hidden = !opening;
        toggle.setAttribute("aria-expanded", String(opening));
        const key = activeDayKey + ":" + song.uid;
        if (opening) {
            subscribeSongComments(song, list, toggle);
        } else {
            const unsubscribe = commentSubscriptions.get(key);
            if (unsubscribe) unsubscribe();
            commentSubscriptions.delete(key);
            stopSongReplySubscriptions(song.uid);
        }
    });

    section.append(toggle, panel);
    return section;
}

function renderRadioNotifications(items) {
    radioNotifications = items;
    const unreadCount = items.filter(item => !item.readAt).length;
    elements.notificationsCount.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    elements.notificationsCount.hidden = unreadCount === 0;
    elements.notificationsButton.hidden = !(currentUser && currentProfile && currentProfile.isActive === true);
    elements.markAllNotificationsRead.disabled = unreadCount === 0;

    elements.notificationsList.replaceChildren();
    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "radio-notifications-empty";
        empty.textContent = "No notifications yet. Comments on your song will appear here.";
        elements.notificationsList.append(empty);
        return;
    }

    items.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "radio-notification-item";
        if (!item.readAt) button.classList.add("is-unread");

        const top = document.createElement("span");
        top.className = "radio-notification-top";
        const title = document.createElement("strong");
        title.textContent = item.type === "radio_reply"
            ? (item.commenterName || "A STELLARS member") + " replied to your comment"
            : (item.commenterName || "A STELLARS member") + " commented on your song";
        const time = document.createElement("time");
        time.textContent = formatRadioTimestamp(item.createdAt, true);
        top.append(title, time);

        const song = document.createElement("span");
        song.className = "radio-notification-song";
        song.textContent = item.type === "radio_reply"
            ? "Reply in the conversation on “" + (item.songTitle || "a song") + "”"
            : (item.songTitle ? "“" + item.songTitle + "”" : "Your Radio song");

        const preview = document.createElement("span");
        preview.className = "radio-notification-preview";
        preview.textContent = item.commentText || "New comment";

        button.append(top, song, preview);
        button.addEventListener("click", () => void openRadioNotification(item));
        elements.notificationsList.append(button);
    });
}

async function openRadioNotification(item) {
    try {
        if (!item.readAt && currentUser) {
            await updateDoc(doc(
                db, "radioNotifications", currentUser.uid, "items", item.id
            ), { readAt: serverTimestamp() });
        }

        elements.notificationsPanel.hidden = true;
        elements.notificationsButton.setAttribute("aria-expanded", "false");

        if (item.dayKey !== activeDayKey) {
            showToast("That song wall has already reset for a new day.");
            return;
        }

        const card = document.getElementById("radio-song-card-" + item.songOwnerUid);
        if (!card) {
            showToast("That song is no longer on today's wall.");
            return;
        }

        card.scrollIntoView({ behavior: "smooth", block: "center" });
        const toggle = card.querySelector(".radio-comments-toggle");
        const panel = card.querySelector(".radio-comments-panel");

        if (item.type === "radio_reply") {
            pendingReplyTarget = {
                commentId: item.commentId,
                replyId: item.replyId,
                expiresAt: Date.now() + 15000
            };
        }

        if (toggle && panel && panel.hidden) {
            toggle.click();
        } else if (item.type === "radio_reply") {
            const commentElement = document.getElementById("radio-comment-" + item.commentId);
            const replyToggle = commentElement && commentElement.querySelector(".radio-replies-toggle");
            const replyPanel = commentElement && commentElement.querySelector(".radio-replies-panel");
            const replyElement = document.getElementById("radio-reply-" + item.replyId);

            if (replyElement) {
                replyElement.classList.add("is-notification-target");
                replyElement.scrollIntoView({ behavior: "smooth", block: "center" });
                pendingReplyTarget = null;
            } else if (replyToggle && replyPanel && replyPanel.hidden) {
                replyToggle.click();
            }
        }
    } catch (error) {
        console.error("Could not open Radio notification:", error);
        showToast("This notification could not be opened.", "error");
    }
}

function startRadioNotifications() {
    if (unsubscribeRadioNotifications) {
        unsubscribeRadioNotifications();
        unsubscribeRadioNotifications = null;
    }

    elements.notificationsPanel.hidden = true;
    elements.notificationsButton.setAttribute("aria-expanded", "false");

    if (!currentUser || !currentProfile || currentProfile.isActive !== true) {
        renderRadioNotifications([]);
        elements.notificationsButton.hidden = true;
        return;
    }

    const notificationsQuery = query(
        collection(db, "radioNotifications", currentUser.uid, "items"),
        orderBy("createdAt", "desc"),
        limit(50)
    );
    unsubscribeRadioNotifications = onSnapshot(notificationsQuery, snapshot => {
        renderRadioNotifications(snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        })));
    }, error => {
        console.error("Radio notification listener failed:", error);
        showToast("Radio notifications are temporarily unavailable.", "error");
    });
}

function buildSongCard(song, uid) {
    const card = document.createElement("article");
    card.className = "radio-song-card";
    card.id = "radio-song-card-" + song.uid;
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

    card.append(art, copy, createSongComments(song));
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
    stopCommentSubscriptions();
    elements.feed.replaceChildren();
    elements.count.textContent = `${songs.length} song${songs.length === 1 ? "" : "s"} shared today`;
    elements.empty.hidden = songs.length > 0;
    elements.footnote.hidden = songs.length === 0;

    songs.forEach(song => {
        elements.feed.append(buildSongCard(song, song.uid));
    });

    const canParticipate = Boolean(currentUser && currentProfile?.isActive === true);
    mySubmission = canParticipate
        ? songs.find(song => song.uid === currentUser.uid) || null
        : null;

    if (!canParticipate) {
        elements.mySongStatus.textContent = currentUser
            ? "Only active STELLARS members can share or edit a song. You can still browse today's wall."
            : "The song wall is open to everyone. Sign in with an active STELLARS account to share a song.";
        elements.openButton.querySelector("span").textContent = "Share today's song";
        elements.openButton.disabled = true;
        elements.signInButton.hidden = Boolean(currentUser);
        return;
    }

    if (mySubmission) {
        elements.mySongStatus.textContent = `You've shared “${mySubmission.songTitle}” by ${mySubmission.artistName}. You can edit it until the daily reset.`;
        elements.openButton.querySelector("span").textContent = "Edit today's song";
    } else {
        elements.mySongStatus.textContent = "Your space on today's song wall is waiting. Share one song that means something to you.";
        elements.openButton.querySelector("span").textContent = "Share today's song";
    }
    elements.openButton.disabled = false;
    elements.signInButton.hidden = true;
}

function renderSignedOutState() {
    elements.notificationsPanel.hidden = true;
    elements.notificationsButton.hidden = true;
    elements.authGate.hidden = true;
    elements.footnote.hidden = false;
    elements.mySongStatus.textContent = currentUser
        ? "Only active STELLARS members can share or edit a song. You can still browse today's wall."
        : "The song wall is open to everyone. Sign in with an active STELLARS account to share a song.";
    elements.openButton.disabled = true;
    elements.signInButton.hidden = Boolean(currentUser);
    startDailyFeed();
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
    const canParticipate = Boolean(currentUser && currentProfile?.isActive === true);
    elements.openButton.disabled = !canParticipate;
    elements.signInButton.hidden = Boolean(currentUser);

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

let itunesJsonpSequence = 0;

function searchItunesArtworkJsonp(searchUrl, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const callbackName = "__stellarsItunesSearch_" + (++itunesJsonpSequence) + "_" + Date.now();
        const script = document.createElement("script");
        let timeoutId = null;
        let settled = false;

        const cleanup = () => {
            if (timeoutId !== null) clearTimeout(timeoutId);
            script.remove();
            try {
                delete window[callbackName];
            } catch {
                window[callbackName] = undefined;
            }
        };

        const finish = (error, payload) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) reject(error);
            else resolve(payload);
        };

        window[callbackName] = payload => finish(null, payload);
        script.async = true;
        script.onerror = () => {
            const error = new Error("Apple's artwork search script could not be loaded.");
            error.code = "itunes/jsonp-load-failed";
            finish(error);
        };

        const url = new URL(searchUrl.toString());
        url.searchParams.set("callback", callbackName);
        script.src = url.toString();

        timeoutId = setTimeout(() => {
            const error = new Error("Apple's artwork search did not respond in time.");
            error.code = "itunes/jsonp-timeout";
            finish(error);
        }, timeoutMs);

        document.head.append(script);
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

        // Apple documents callback-based JSONP for cross-site Search API requests.
        // This avoids depending on browser CORS access to the iTunes JSON response.
        let payload = await searchItunesArtworkJsonp(url);

        if (!Array.isArray(payload.results) || payload.results.length === 0) {
            url.searchParams.set("country", "us");
            payload = await searchItunesArtworkJsonp(url);
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
        console.error("Apple artwork search failed:", error);
        const message = error.code === "itunes/jsonp-timeout"
            ? "Apple's artwork catalog is taking too long to respond. Try again, or upload the cover manually."
            : error.code === "itunes/jsonp-load-failed"
                ? "Apple's artwork catalog could not be reached from this browser right now. Try again later, or upload the cover manually."
                : "Apple's artwork search could not be completed. Try again, or upload the cover manually.";
        setComposerMessage(message, "error");
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
elements.notificationsButton.addEventListener("click", () => {
    const opening = elements.notificationsPanel.hidden;
    elements.notificationsPanel.hidden = !opening;
    elements.notificationsButton.setAttribute("aria-expanded", String(opening));
});
elements.markAllNotificationsRead.addEventListener("click", async () => {
    if (!currentUser || !currentProfile || currentProfile.isActive !== true) return;
    const unread = radioNotifications.filter(item => !item.readAt);
    if (!unread.length) return;
    elements.markAllNotificationsRead.disabled = true;
    try {
        const batch = writeBatch(db);
        unread.forEach(item => batch.update(
            doc(db, "radioNotifications", currentUser.uid, "items", item.id),
            { readAt: serverTimestamp() }
        ));
        await batch.commit();
        showToast("All Radio notifications marked as read.");
    } catch (error) {
        console.error("Could not mark Radio notifications as read:", error);
        showToast("Notifications could not be updated.", "error");
        elements.markAllNotificationsRead.disabled = false;
    }
});
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
    stopCommentSubscriptions();
    if (unsubscribeRadioNotifications) {
        unsubscribeRadioNotifications();
        unsubscribeRadioNotifications = null;
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
            startRadioNotifications();
            return;
        }

        currentProfile = profile;
        startDailyFeed();
        startRadioNotifications();
    } catch (error) {
        console.error("Could not verify STELLARS Radio membership:", error);
        renderSignedOutState();
        elements.mySongStatus.textContent = "Membership could not be checked. You can still browse today's song wall.";

    }
});

updateDailyClock();
setInterval(updateDailyClock, 1000);
