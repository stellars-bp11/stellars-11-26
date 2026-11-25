/* STELLARS — subtle inverse pointer response for selected cards */
(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const selector = [
        ".academic-page .academic-login-card",
        ".academic-page .academic-access-card",
        ".academic-page .academic-grade-card",
        ".academic-page .academic-personal-results-panel",
        ".academic-page .student-personal-results-panel",
        ".academic-page .activation-manager-panel",
        ".academic-page .academic-import-step-card",
        ".academic-page .academic-import-history-card",
        ".academic-page .admin-results-stat",
        ".academic-page .academic-result-card",
        ".academic-page .academic-result-row",
        ".library-page .memory-card",
        ".crewmates-page .crew-card",
        ".crewmates-page .crewmate-card",
        ".lecturers-page .featured-lecturer",
        ".lecturers-page .lecturer-card"
    ].join(",");

    document.querySelectorAll(selector).forEach((card) => {
        const updateFromPointer = (event) => {
            const rect = card.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const nx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
            const ny = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));

            // The surface moves slightly opposite to the pointer's position.
            card.classList.add("st-pointer-reactive");
            card.style.setProperty("--st-repel-x", `${-nx * 4}px`);
            card.style.setProperty("--st-repel-y", `${-ny * 4}px`);
            card.style.setProperty("--st-tilt-x", `${ny * 1.15}deg`);
            card.style.setProperty("--st-tilt-y", `${-nx * 1.15}deg`);
        };

        const resetPointer = () => {
            card.style.setProperty("--st-repel-x", "0px");
            card.style.setProperty("--st-repel-y", "0px");
            card.style.setProperty("--st-tilt-x", "0deg");
            card.style.setProperty("--st-tilt-y", "0deg");
        };

        card.addEventListener("pointermove", updateFromPointer, { passive: true });
        card.addEventListener("pointerleave", resetPointer, { passive: true });
    });
})();
