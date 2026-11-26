(() => {
    if (window.location.pathname.toLowerCase().endsWith("/letters.html")) return;
    if (document.querySelector(".letters-launcher")) return;

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "letters-launcher.css?v=open-letters-v1-20261126";
    document.head.append(stylesheet);

    const link = document.createElement("a");
    link.className = "letters-launcher";
    link.href = "letters.html";
    link.setAttribute("aria-label", "Letters from the Stars");
    link.setAttribute("title", "Letters from the Stars");
    link.innerHTML = '<span class="letters-launcher-tooltip" aria-hidden="true">Letters from the Stars</span>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="14" rx="2.2"></rect>' +
        '<path d="m4 7 8 6 8-6"></path>' +
        '<path d="M8 10.2 4 14"></path>' +
        '<path d="m16 10.2 4 3.8"></path>' +
        '</svg>';

    document.body.append(link);
})();
