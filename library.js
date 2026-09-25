
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// =========================================================
// STELLARS LIBRARY — CLOUDINARY + FIREBASE FIRESTORE
// =========================================================

// FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
    authDomain: "class-web-7241e.firebaseapp.com",
    projectId: "class-web-7241e",
    storageBucket: "class-web-7241e.firebasestorage.app",
    messagingSenderId: "167560389153",
    appId: "1:167560389153:web:f61f4f821275c48373f960",
    measurementId: "G-DTHTZNT135"
};

// CLOUDINARY CONFIG
const CLOUD_NAME = "b88nrr3l";
const UPLOAD_PRESET = "stellar-library";

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const memoriesRef = collection(db, "memories");

// LOCAL STORAGE
const LIKES_KEY = "stellars-library-likes";
const DELETED_STATIC_KEY = "stellars-library-deleted-static";

// ELEMENTS
const libraryGrid = document.getElementById("libraryGrid");
const addMemoryBtn = document.getElementById("addMemoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const memoryForm = document.getElementById("memoryForm");
const memoryPhotoInput = document.getElementById("memoryPhoto");
const memoryCategoryInput = document.getElementById("memoryCategory");
const memoryTitleInput = document.getElementById("memoryTitle");
const memoryDescriptionInput = document.getElementById("memoryDescription");
const modalPreview = document.getElementById("modalPreview");
const submitBtn = memoryForm.querySelector(".modal-submit");

// =========================================================
// MODAL
// =========================================================

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

modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
});

// =========================================================
// PHOTO PREVIEW
// =========================================================

memoryPhotoInput.addEventListener("change", () => {
    const file = memoryPhotoInput.files[0];

    modalPreview.innerHTML = "";

    if (!file) {
        modalPreview.classList.remove("show");
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        memoryPhotoInput.value = "";
        modalPreview.classList.remove("show");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Maximum photo size is 5 MB.");
        memoryPhotoInput.value = "";
        modalPreview.classList.remove("show");
        return;
    }

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "Photo preview";

    modalPreview.appendChild(img);
    modalPreview.classList.add("show");
});

// =========================================================
// LOCAL STORAGE HELPERS
// =========================================================

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

function getDeletedStaticIds() {
    try {
        return JSON.parse(localStorage.getItem(DELETED_STATIC_KEY)) || [];
    } catch {
        return [];
    }
}

function saveDeletedStaticIds(ids) {
    localStorage.setItem(DELETED_STATIC_KEY, JSON.stringify(ids));
}

// =========================================================
// CARD BUILDER
// =========================================================

function buildMemoryCard(memory) {
    const article = document.createElement("article");
    article.className = "memory-card";
    article.dataset.id = memory.id;

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "memory-image";

    const img = document.createElement("img");
    img.src = memory.imageUrl;
    img.alt = memory.title;
    img.loading = "lazy";

    imageWrapper.appendChild(img);

    const info = document.createElement("div");
    info.className = "memory-info";

    const category = document.createElement("p");
    category.className = "memory-category";
    category.textContent = memory.category;

    const title = document.createElement("h3");
    title.textContent = memory.title;

    const description = document.createElement("p");
    description.className = "memory-description";
    description.textContent = memory.description;

    const likeBtn = document.createElement("button");
    likeBtn.className = "memory-like";
    likeBtn.type = "button";
    likeBtn.setAttribute("aria-label", "Like memory");

    const heart = document.createElement("i");
    heart.className = "bx bx-heart";
    likeBtn.appendChild(heart);

    info.append(category, title, description, likeBtn);
    article.append(imageWrapper, info);

    return article;
}

// =========================================================
// STATIC CARD
// =========================================================

function hideDeletedStaticCards() {
    const deletedIds = getDeletedStaticIds();

    deletedIds.forEach((id) => {
        const card = libraryGrid.querySelector(
            `.memory-card[data-id="${id}"]`
        );

        if (card) card.remove();
    });
}

// =========================================================
// LIKE STATE
// =========================================================

function applyLikedState() {
    const likedIds = getLikedIds();

    document.querySelectorAll(".memory-card").forEach((card) => {
        const likeBtn = card.querySelector(".memory-like");
        if (!likeBtn) return;

        const liked = likedIds.includes(card.dataset.id);

        likeBtn.classList.toggle("liked", liked);

        const icon = likeBtn.querySelector("i");
        if (icon) {
            icon.className = liked ? "bx bxs-heart" : "bx bx-heart";
        }
    });
}

// =========================================================
// CLOUDINARY UPLOAD
// =========================================================

async function uploadToCloudinary(file) {
    const endpoint =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(endpoint, {
        method: "POST",
        body: formData
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message || "Cloudinary upload failed."
        );
    }

    return result.secure_url;
}

// =========================================================
// ADD MEMORY
// =========================================================

memoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = memoryPhotoInput.files[0];
    const category = memoryCategoryInput.value.trim();
    const title = memoryTitleInput.value.trim();
    const description = memoryDescriptionInput.value.trim();

    if (!file || !category || !title || !description) {
        alert("Please complete all fields.");
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Please select a valid image.");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Maximum photo size is 5 MB.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";

    try {
        // 1. Upload photo to Cloudinary
        const imageUrl = await uploadToCloudinary(file);

        // 2. Save metadata to Firestore
        await addDoc(memoriesRef, {
            imageUrl,
            category,
            title,
            description,
            createdAt: serverTimestamp()
        });

        closeModal();
        alert("Memory uploaded successfully!");
    } catch (error) {
        console.error("Upload error:", error);
        alert(`Upload failed: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Memory";
    }
});

// =========================================================
// LOAD SHARED MEMORIES
// =========================================================

const memoriesQuery = query(
    memoriesRef,
    orderBy("createdAt", "desc")
);

onSnapshot(
    memoriesQuery,
    (snapshot) => {
        // Remove previously rendered Firestore cards
        libraryGrid
            .querySelectorAll(".cloud-memory")
            .forEach((card) => card.remove());

        snapshot.forEach((doc) => {
            const memory = {
                id: doc.id,
                ...doc.data()
            };

            const card = buildMemoryCard(memory);
            card.classList.add("cloud-memory");

            libraryGrid.appendChild(card);
        });

        hideDeletedStaticCards();
        applyLikedState();
    },
    (error) => {
        console.error("Firestore error:", error);
        alert("Could not load shared memories. Please check Firestore settings.");
    }
);

// =========================================================
// LIKE + DELETE
// =========================================================

libraryGrid.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".memory-delete");

    if (deleteBtn) {
        const card = deleteBtn.closest(".memory-card");
        const cardId = card.dataset.id;

        // Only the static card can be removed locally.
        if (!cardId.startsWith("static-")) {
            alert("Shared memories cannot be deleted from this page.");
            return;
        }

        if (!confirm("Delete this memory from your view?")) return;

        const deletedIds = getDeletedStaticIds();

        if (!deletedIds.includes(cardId)) {
            saveDeletedStaticIds([...deletedIds, cardId]);
        }

        saveLikedIds(getLikedIds().filter((id) => id !== cardId));
        card.remove();
        return;
    }

    const likeBtn = event.target.closest(".memory-like");
    if (!likeBtn) return;

    const card = likeBtn.closest(".memory-card");
    const cardId = card.dataset.id;

    const likedIds = getLikedIds();
    const isLiked = likedIds.includes(cardId);

    if (isLiked) {
        saveLikedIds(likedIds.filter((id) => id !== cardId));
    } else {
        saveLikedIds([...likedIds, cardId]);
    }

    applyLikedState();
});

// =========================================================
// INIT
// =========================================================

hideDeletedStaticCards();
applyLikedState();