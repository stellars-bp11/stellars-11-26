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
                <span class="stellars-drawer-unread-badge" hidden aria-label="Unread private letters"></span>
                <i class="bx bx-chevron-right stellars-drawer-item-arrow" aria-hidden="true"></i>
            </a>
        </div>
        <div class="stellars-drawer-footer"><i class="bx bxs-star" aria-hidden="true"></i><span>MORE STELLARS FEATURES CAN FIND A HOME HERE.</span></div>
    `;

    document.body.append(scrim, drawer);

    const closeButton = drawer.querySelector(".stellars-drawer-close");
    const featureLink = drawer.querySelector(".stellars-drawer-item");
    const unreadLogoBadge = document.createElement("span");
    unreadLogoBadge.className = "stellars-mail-badge";
    unreadLogoBadge.hidden = true;
    unreadLogoBadge.setAttribute("aria-hidden", "true");
    trigger.append(unreadLogoBadge);
    const unreadDrawerBadge = drawer.querySelector(".stellars-drawer-unread-badge");

    const setUnreadMailCount = count => {
        const unread = Math.max(0, Number(count) || 0);
        const label = unread > 99 ? "99+" : String(unread);
        unreadLogoBadge.textContent = label;
        unreadLogoBadge.hidden = unread === 0;
        unreadDrawerBadge.textContent = unread ? `${label} new` : "";
        unreadDrawerBadge.hidden = unread === 0;
        trigger.setAttribute(
            "aria-label",
            unread
                ? `Open STELLARS quick access. ${unread} unread private letter(s).`
                : "Open STELLARS quick access"
        );
        trigger.title = unread ? `${unread} unread private letter(s)` : "STELLARS quick access";
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
            let stopInbox = null;
            let authGeneration = 0;

            authModule.onAuthStateChanged(auth, async user => {
                const generation = ++authGeneration;
                if (stopInbox) {
                    stopInbox();
                    stopInbox = null;
                }
                setUnreadMailCount(0);
                if (!user) return;

                try {
                    const profileSnapshot = await firestoreModule.getDoc(
                        firestoreModule.doc(db, "users", user.uid)
                    );
                    if (generation !== authGeneration) return;
                    if (!profileSnapshot.exists() || profileSnapshot.data().isActive !== true) return;

                    const inboxQuery = firestoreModule.query(
                        firestoreModule.collection(db, "privateLetters"),
                        firestoreModule.where("recipientUid", "==", user.uid),
                        firestoreModule.limit(100)
                    );
                    stopInbox = firestoreModule.onSnapshot(inboxQuery, snapshot => {
                        if (generation !== authGeneration) return;
                        const unread = snapshot.docs.filter(item => !item.data().readAt).length;
                        setUnreadMailCount(unread);
                    }, error => {
                        console.warn("STELLARS unread private-letter counter unavailable:", error);
                        setUnreadMailCount(0);
                    });
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

    if (window.location.pathname.toLowerCase().endsWith("/letters.html")) {
        featureLink.setAttribute("aria-current", "page");
    }

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
    featureLink.addEventListener("click", () => closeDrawer());
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
