// =========================================================
// STELLARS LIBRARY — ADD MEMORY GALLERY
// =========================================================

const STORAGE_KEY = "stellars-library-memories";
const LIKES_KEY = "stellars-library-likes";

const libraryGrid = document.getElementById("libraryGrid");
const addMemoryBtn = document.getElementById("addMemoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const memoryForm = document.getElementById("memoryForm");
const memoryPhotoInput = document.getElementById("memoryPhoto");
const modalPreview = document.getElementById("modalPreview");


// ---------------------------------------------------------
// MODAL OPEN / CLOSE
// ---------------------------------------------------------

function openModal() {
    modalOverlay.classList.add("open");
}

function closeModal() {
    modalOverlay.classList.remove("open");
    memoryForm.reset();
    modalPreview.classList.remove("show");
    modalPreview.innerHTML = "";
}

addMemoryBtn.addEventListener("click", openModal);
modalCloseBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});


// ---------------------------------------------------------
// PHOTO PREVIEW ON SELECT
// ---------------------------------------------------------

memoryPhotoInput.addEventListener("change", () => {
    const file = memoryPhotoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        modalPreview.innerHTML = `<img src="${reader.result}" alt="Preview">`;
        modalPreview.classList.add("show");
    };
    reader.readAsDataURL(file);
});


// ---------------------------------------------------------
// STORAGE HELPERS
// ---------------------------------------------------------

function getSavedMemories() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveMemories(memories) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

function getLikedIds() {
    try {
        return JSON.parse(localStorage.getItem(LIKES_KEY)) || [];
    } catch {
        return [];
    }
}

function saveLikedIds(ids) {
    localStorage.setItem(LIKES_KEY, JSON.stringify(ids));
}


// ---------------------------------------------------------
// CARD BUILDER (mirrors the existing static card markup)
// ---------------------------------------------------------

function buildMemoryCard(memory) {
    const article = document.createElement("article");
    article.className = "memory-card";
    article.dataset.id = memory.id;

    article.innerHTML = `
        <div class="memory-image">
            <img src="${memory.image}" alt="${memory.title}">
        </div>

        <div class="memory-info">
            <p class="memory-category">${memory.category}</p>
            <h3>${memory.title}</h3>
            <p class="memory-description">${memory.description}</p>

            <button class="memory-like" type="button">
                <i class='bx bx-heart'></i>
            </button>
        </div>
    `;

    return article;
}

function renderSavedMemories() {
    const memories = getSavedMemories();
    memories.forEach((memory) => {
        libraryGrid.appendChild(buildMemoryCard(memory));
    });
    applyLikedState();
}


// ---------------------------------------------------------
// ADD MEMORY — FORM SUBMIT
// ---------------------------------------------------------

memoryForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const file = memoryPhotoInput.files[0];
    const category = document.getElementById("memoryCategory").value.trim();
    const title = document.getElementById("memoryTitle").value.trim();
    const description = document.getElementById("memoryDescription").value.trim();

    if (!file || !category || !title || !description) return;

    const reader = new FileReader();
    reader.onload = () => {
        const memory = {
            id: "mem-" + Date.now(),
            image: reader.result,
            category,
            title,
            description,
        };

        const memories = getSavedMemories();
        memories.push(memory);
        saveMemories(memories);

        libraryGrid.appendChild(buildMemoryCard(memory));

        closeModal();
    };
    reader.readAsDataURL(file);
});


// ---------------------------------------------------------
// LIKE BUTTON (works for static + dynamic cards, persists)
// ---------------------------------------------------------

function applyLikedState() {
    const likedIds = getLikedIds();

    document.querySelectorAll(".memory-card").forEach((card, index) => {
        const cardId = card.dataset.id || "static-" + index;
        card.dataset.id = cardId;

        const likeBtn = card.querySelector(".memory-like");
        if (likedIds.includes(cardId)) {
            likeBtn.classList.add("liked");
        }
    });
}

libraryGrid.addEventListener("click", (e) => {
    const likeBtn = e.target.closest(".memory-like");
    if (!likeBtn) return;

    const card = likeBtn.closest(".memory-card");
    const cardId = card.dataset.id;

    const likedIds = getLikedIds();
    const isLiked = likedIds.includes(cardId);

    if (isLiked) {
        likeBtn.classList.remove("liked");
        saveLikedIds(likedIds.filter((id) => id !== cardId));
    } else {
        likeBtn.classList.add("liked");
        saveLikedIds([...likedIds, cardId]);
    }
});


// ---------------------------------------------------------
// INIT
// ---------------------------------------------------------

renderSavedMemories();