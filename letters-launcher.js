(() => {
    if (window.__stellarsFeatureDrawerInitialized) return;
    window.__stellarsFeatureDrawerInitialized = true;

    const trigger = document.querySelector(
        '[data-stellars-drawer-trigger], .site-header .logo, .academic-header .academic-logo, .world-header .world-brand'
    );
    if (!trigger) return;

    trigger.setAttribute("data-stellars-drawer-trigger", "");
    trigger.setAttribute("aria-controls", "stellarsFeatureDrawer");
    trigger.setAttribute("aria-expanded", "false");

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "letters-launcher.css?v=private-mail-notifications-v4-20261126";
    document.head.append(stylesheet);

    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "stellars-drawer-scrim";
    scrim.setAttribute("aria-label", "Close STELLARS quick access");

    const drawer = document.createElement("aside");
    drawer.className = "stellars-feature-drawer";
    drawer.id = "stellarsFeatureDrawer";
    drawer.setAttribute("aria-label", "STELLARS quick access");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
        <div class="stellars-drawer-topline">
            <span class="stellars-drawer-kicker">STELLARS / QUICK ACCESS</span>
            <button class="stellars-drawer-close" type="button" aria-label="Close menu"><i class="bx bx-x" aria-hidden="true"></i></button>
        </div>
        <h2 class="stellars-drawer-title">A little more<br>of our universe.</h2>
        <p class="stellars-drawer-description">Small spaces for the stories, memories, and moments we share as one crew.</p>
        <div class="stellars-drawer-divider"></div>
        <span class="stellars-drawer-section-label">YOUR STELLARS CORNERS</span>
        <div class="stellars-drawer-items" role="navigation" aria-label="STELLARS features">
            <a class="stellars-drawer-item" href="letters.html">
                <span class="stellars-drawer-item-icon"><i class="bx bx-envelope" aria-hidden="true"></i></span>
                <span class="stellars-drawer-item-copy">
                    <strong>Letters from the Stars</strong>
                    <small>Open the mailbox · private notes</small>
                </span>
                <span class="stellars-drawer-unread-badge stellars-mail-unread-badge" hidden aria-label="Unread private letters"></span>
                <i class="bx bx-chevron-right stellars-drawer-item-arrow" aria-hidden="true"></i>
            </a>
            <a class="stellars-drawer-item" href="radio.html">
                <span class="stellars-drawer-item-icon"><i class="bx bx-radio" aria-hidden="true"></i></span>
                <span class="stellars-drawer-item-copy">
                    <strong>STELLARS Radio</strong>
                    <small>Song wall · comments on your song</small>
                </span>
                <span class="stellars-drawer-unread-badge stellars-radio-unread-badge" hidden aria-label="Unread Radio comments"></span>
                <i class="bx bx-chevron-right stellars-drawer-item-arrow" aria-hidden="true"></i>
            </a>
        </div>
        <div class="stellars-drawer-footer"><i class="bx bxs-star" aria-hidden="true"></i><span>MORE STELLARS FEATURES CAN FIND A HOME HERE.</span></div>
    `;

    document.body.append(scrim, drawer);

    const closeButton = drawer.querySelector(".stellars-drawer-close");
    const lettersLink = drawer.querySelector('a[href="letters.html"]');
    const radioLink = drawer.querySelector('a[href="radio.html"]');
    const featureLinks = Array.from(drawer.querySelectorAll(".stellars-drawer-item"));
    const unreadLogoBadge = document.createElement("span");
    unreadLogoBadge.className = "stellars-mail-badge";
    unreadLogoBadge.hidden = true;
    unreadLogoBadge.setAttribute("aria-hidden", "true");
    trigger.append(unreadLogoBadge);
    const unreadMailDrawerBadge = drawer.querySelector(".stellars-mail-unread-badge");
    const unreadRadioDrawerBadge = drawer.querySelector(".stellars-radio-unread-badge");

    const setUnreadNotificationCounts = counts => {
        const mail = Math.max(0, Number(counts.mail) || 0);
        const radio = Math.max(0, Number(counts.radio) || 0);
        const total = mail + radio;
        const label = value => value > 99 ? "99+" : String(value);

        unreadLogoBadge.textContent = label(total);
        unreadLogoBadge.hidden = total === 0;
        unreadMailDrawerBadge.textContent = mail ? label(mail) + " new" : "";
        unreadMailDrawerBadge.hidden = mail === 0;
        unreadRadioDrawerBadge.textContent = radio ? label(radio) + " new" : "";
        unreadRadioDrawerBadge.hidden = radio === 0;

        trigger.setAttribute(
            "aria-label",
            total
                ? "Open STELLARS quick access. " + total + " unread notification(s)."
                : "Open STELLARS quick access"
        );
        trigger.title = total
            ? total + " unread notification(s) · " + mail + " letters · " + radio + " Radio comments"
            : "STELLARS quick access";
    };

    // Only the signed-in recipient's own inbox is queried for the cross-page badge.
    (async () => {
        try {
            const [appModule, authModule, firestoreModule] = await Promise.all([
                import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
                import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
                import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
            ]);

            const firebaseConfig = {
                apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
                authDomain: "class-web-7241e.firebaseapp.com",
                projectId: "class-web-7241e",
                storageBucket: "class-web-7241e.firebasestorage.app",
                messagingSenderId: "167560389153",
                appId: "1:167560389153:web:f61f4f821275c48373f960",
                measurementId: "G-DTHTZNT135"
            };
            const app = appModule.getApps().length
                ? appModule.getApp()
                : appModule.initializeApp(firebaseConfig);
            const auth = authModule.getAuth(app);
            const db = firestoreModule.getFirestore(app);
            let stopInbox = [];
            let authGeneration = 0;

            authModule.onAuthStateChanged(auth, async user => {
                const generation = ++authGeneration;
                stopInbox.forEach(unsubscribe => unsubscribe());
                stopInbox = [];
                setUnreadNotificationCounts({ mail: 0, radio: 0 });
                if (!user) return;

                try {
                    const profileSnapshot = await firestoreModule.getDoc(
                        firestoreModule.doc(db, "users", user.uid)
                    );
                    if (generation !== authGeneration) return;
                    if (!profileSnapshot.exists() || profileSnapshot.data().isActive !== true) return;

                    const unreadCounts = { mailbox: 0, legacy: 0, radio: 0 };
                    const updateBadge = () => setUnreadNotificationCounts({
                        mail: unreadCounts.mailbox + unreadCounts.legacy,
                        radio: unreadCounts.radio
                    });

                    const inboxQuery = firestoreModule.query(
                        firestoreModule.collection(db, "privateMailboxes", user.uid, "received"),
                        firestoreModule.limit(100)
                    );
                    stopInbox.push(firestoreModule.onSnapshot(inboxQuery, snapshot => {
                        if (generation !== authGeneration) return;
                        unreadCounts.mailbox = snapshot.docs.filter(item => !item.data().readAt).length;
                        updateBadge();
                    }, error => {
                        console.warn("STELLARS mailbox notification unavailable:", error);
                    }));

                    // Count old-format private letters too, so earlier test messages
                    // remain reflected in the brand badge during the transition.
                    const legacyInboxQuery = firestoreModule.query(
                        firestoreModule.collection(db, "privateLetters"),
                        firestoreModule.where("recipientUid", "==", user.uid),
                        firestoreModule.limit(100)
                    );
                    stopInbox.push(firestoreModule.onSnapshot(legacyInboxQuery, snapshot => {
                        if (generation !== authGeneration) return;
                        unreadCounts.legacy = snapshot.docs.filter(item => !item.data().readAt).length;
                        updateBadge();
                    }, error => {
                        console.warn("Legacy private-letter notification skipped:", error);
                    }));

                    const radioNotificationsQuery = firestoreModule.query(
                        firestoreModule.collection(db, "radioNotifications", user.uid, "items"),
                        firestoreModule.orderBy("createdAt", "desc"),
                        firestoreModule.limit(100)
                    );
                    stopInbox.push(firestoreModule.onSnapshot(radioNotificationsQuery, snapshot => {
                        if (generation !== authGeneration) return;
                        unreadCounts.radio = snapshot.docs.filter(item => !item.data().readAt).length;
                        updateBadge();
                    }, error => {
                        console.warn("STELLARS Radio comment notifications unavailable:", error);
                    }));
                } catch (error) {
                    console.warn("STELLARS mail notification could not initialize:", error);
                    setUnreadMailCount(0);
                }
            });
        } catch (error) {
            console.warn("STELLARS mail notification could not load Firebase:", error);
            setUnreadMailCount(0);
        }
    })();

    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath.endsWith("/letters.html")) lettersLink.setAttribute("aria-current", "page");
    if (currentPath.endsWith("/radio.html")) radioLink.setAttribute("aria-current", "page");

    const openDrawer = () => {
        drawer.classList.add("is-open");
        scrim.classList.add("is-open");
        drawer.setAttribute("aria-hidden", "false");
        trigger.setAttribute("aria-expanded", "true");
        document.body.classList.add("stellars-drawer-open");
    };

    const closeDrawer = (returnFocus = false) => {
        drawer.classList.remove("is-open");
        scrim.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
        trigger.setAttribute("aria-expanded", "false");
        document.body.classList.remove("stellars-drawer-open");
        if (returnFocus) trigger.focus();
    };

    trigger.addEventListener("click", event => {
        event.preventDefault();
        if (drawer.classList.contains("is-open")) closeDrawer();
        else openDrawer();
    });
    closeButton.addEventListener("click", () => closeDrawer(true));
    scrim.addEventListener("click", () => closeDrawer());
    featureLinks.forEach(link => link.addEventListener("click", () => closeDrawer()));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && drawer.classList.contains("is-open")) {
            closeDrawer(true);
        }
    });
    document.addEventListener("click", event => {
        if (!drawer.classList.contains("is-open")) return;
        if (!drawer.contains(event.target) && !trigger.contains(event.target)) closeDrawer();
    });
})();
