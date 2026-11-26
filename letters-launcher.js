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
    stylesheet.href = "letters-launcher.css?v=open-letters-drawer-v3-20261126";
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
                    <small>Leave a thought for the crew</small>
                </span>
                <i class="bx bx-chevron-right stellars-drawer-item-arrow" aria-hidden="true"></i>
            </a>
        </div>
        <div class="stellars-drawer-footer"><i class="bx bxs-star" aria-hidden="true"></i><span>MORE STELLARS FEATURES CAN FIND A HOME HERE.</span></div>
    `;

    document.body.append(scrim, drawer);

    const closeButton = drawer.querySelector(".stellars-drawer-close");
    const featureLink = drawer.querySelector(".stellars-drawer-item");

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
