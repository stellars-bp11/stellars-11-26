import {
    getApp,
    getApps,
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDoc,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


/* =========================================================
   FIREBASE CONFIG
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


/* =========================================================
   CLOUDINARY
========================================================= */

const CLOUD_NAME = "b88nrr3l";
const UPLOAD_PRESET = "stellar-library";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;     // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;    // 50 MB


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const memoriesRef = collection(db, "memories");


/* =========================================================
   LOCAL STORAGE
========================================================= */

const LIKES_KEY = "stellars-library-likes";


/* =========================================================
   ADMIN STATE
========================================================= */

let isSuperAdmin = false;
let isLibraryEditor = false;
let isActiveMember = false;
let stopMemoriesListener = null;
let editingMemoryId = null;
const memoryCache = new Map();


/* =========================================================
   ELEMENTS
========================================================= */

const libraryGrid = document.getElementById("libraryGrid");
const addMemoryBtn = document.getElementById("addMemoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const memoryForm = document.getElementById("memoryForm");
const memoryPhotoInput = document.getElementById("memoryPhoto");
const memoryCategoryInput = document.getElementById("memoryCategory");
const memoryTitleInput = document.getElementById("memoryTitle");
const memoryDescriptionInput = document.getElementById("memoryDescription");
const memoryVisibilityInput = document.getElementById("memoryVisibility");
const memoryPublicConsentInput = document.getElementById("memoryPublicConsent");
const modalTitle = document.getElementById("modalTitle");
const modalPreview = document.getElementById("modalPreview");
const submitBtn = document.querySelector(".modal-submit");



/* =========================================================
   LOADER
========================================================= */

const stellarsLoader = document.getElementById("stellars-loader");
const loaderTeks = document.getElementById("loader-teks");

function tampilkanLoading(pesan = "Memuat") {

    loaderTeks.textContent = pesan;
    stellarsLoader.hidden = false;
    stellarsLoader.classList.remove("hilang");

}

function sembunyikanLoading() {

    if (stellarsLoader.hidden) return;

    stellarsLoader.classList.add("hilang");

    setTimeout(() => {
        stellarsLoader.hidden = true;
    }, 400);

}

// Pengaman: kalau Firestore lambat atau gagal, loader tetap hilang
setTimeout(sembunyikanLoading, 8000);


/* =========================================================
   POPUP (SETELAH UPLOAD)
========================================================= */

const popup = document.getElementById("stellars-popup");
const popupIkon = document.getElementById("popup-ikon");
const popupJudul = document.getElementById("popup-judul");
const popupPesan = document.getElementById("popup-pesan");
const popupPreview = document.getElementById("popup-preview");
const popupUtama = document.getElementById("popup-utama");
const popupKedua = document.getElementById("popup-kedua");

function tampilkanPopup({
    tipe = "sukses",            // "sukses" atau "gagal"
    judul = "Berhasil!",
    pesan = "",
    urlPreview = null,
    jenis = "image",            // "image" atau "video"
    teksUtama = "Lihat di Library",
    teksKedua = "Upload lagi",
    onUtama = null,
    onKedua = null
} = {}) {

    popupIkon.textContent = tipe === "sukses" ? "★" : "!";
    popupIkon.classList.toggle("gagal", tipe !== "sukses");
    popupJudul.textContent = judul;
    popupPesan.textContent = pesan;
    popupUtama.textContent = teksUtama;
    popupKedua.textContent = teksKedua;

    popupPreview.innerHTML = "";

    if (urlPreview) {

        const img = document.createElement("img");

        // Video Cloudinary: ganti ekstensi jadi .jpg untuk gambar poster
        img.src = jenis === "video"
            ? urlPreview.replace(/\.[^./]+$/, ".jpg")
            : urlPreview;

        img.alt = "Pratinjau unggahan";

        img.onerror = () => {
            popupPreview.hidden = true;
        };

        popupPreview.appendChild(img);
        popupPreview.hidden = false;

    } else {

        popupPreview.hidden = true;

    }

    popupUtama.onclick = () => {
        tutupPopup();
        if (onUtama) onUtama();
    };

    popupKedua.onclick = () => {
        tutupPopup();
        if (onKedua) onKedua();
    };

    popup.hidden = false;

    requestAnimationFrame(() => {
        popup.classList.add("tampil");
    });

    popupUtama.focus();

}

function tutupPopup() {

    popup.classList.remove("tampil");

    setTimeout(() => {
        popup.hidden = true;
        popupPreview.innerHTML = "";
    }, 250);

}

popup.addEventListener("click", (event) => {

    if (event.target === popup) {
        tutupPopup();
    }

});


/* =========================================================
   MEDIA HELPERS
========================================================= */

function getMediaType(file) {

    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";

    return null;

}


function validateFile(file) {

    const type = getMediaType(file);

    if (!type) {
        return "Please select an image or video file.";
    }

    if (type === "image" && file.size > MAX_IMAGE_SIZE) {
        return "Maximum photo size is 5 MB.";
    }

    if (type === "video" && file.size > MAX_VIDEO_SIZE) {
        return "Maximum video size is 50 MB.";
    }

    return null;

}


/*
    Memory lama (foto) tidak punya field mediaType.
    Kalau kosong, anggap image. Sebagai pengaman,
    URL Cloudinary video juga dikenali dari "/video/upload/".
*/
function resolveMediaType(memory) {

    if (memory.mediaType === "video") return "video";
    if (memory.mediaType === "image") return "image";

    if ((memory.imageUrl || "").includes("/video/upload/")) {
        return "video";
    }

    return "image";

}


/* =========================================================
   MODAL HELPERS
========================================================= */

function clearPreview() {

    // hentikan video preview sebelum dibuang
    modalPreview
        .querySelectorAll("video")
        .forEach((video) => {
            video.pause();
            video.removeAttribute("src");
            video.load();
        });

    modalPreview.innerHTML = "";
    modalPreview.classList.remove("show");

}


function requestMemberSignIn() {
    const accountButton = document.getElementById("siteAccountButton");
    const loginButton = document.getElementById("siteAccountLoginButton");
    if (accountButton && loginButton) {
        accountButton.click();
        loginButton.click();
    } else {
        alert("Sign in with an active STELLARS account to upload a memory.");
    }
}

function openModal(memory = null) {
    if (!isActiveMember) {
        requestMemberSignIn();
        return;
    }

    editingMemoryId = memory?.id || null;
    memoryForm.reset();
    clearPreview();

    memoryPhotoInput.required = !memory;
    memoryVisibilityInput.value = "public";
    memoryPublicConsentInput.checked = false;
    memoryPublicConsentInput.disabled = false;

    if (memory) {
        modalTitle.textContent = "Edit a Memory";
        memoryCategoryInput.value = memory.category || "";
        memoryTitleInput.value = memory.title || "";
        memoryDescriptionInput.value = memory.description || "";
        const previouslyConfirmedPublic = memory.visibility === "public" && memory.publicConsent === true;
        memoryPublicConsentInput.checked = previouslyConfirmedPublic;
        memoryPublicConsentInput.disabled = previouslyConfirmedPublic;
        submitBtn.textContent = "Save Changes";

        if (memory.imageUrl) {
            const preview = resolveMediaType(memory) === "video"
                ? document.createElement("video")
                : document.createElement("img");
            preview.src = memory.imageUrl;
            preview.alt = memory.title || "Existing memory";
            if (preview.tagName === "VIDEO") {
                preview.controls = true;
                preview.muted = true;
                preview.playsInline = true;
            }
            modalPreview.appendChild(preview);
            modalPreview.classList.add("show");
        }
    } else {
        modalTitle.textContent = "Add a Memory";
        submitBtn.textContent = "Save Memory";
    }

    modalOverlay.classList.add("open");
    modalOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}


function closeModal() {

    modalOverlay.classList.remove("open");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    memoryForm.reset();
    clearPreview();
    editingMemoryId = null;
    memoryPhotoInput.required = true;
    memoryPublicConsentInput.disabled = false;
    modalTitle.textContent = "Add a Memory";

    submitBtn.disabled = false;
    submitBtn.textContent = "Save Memory";

}


/* =========================================================
   ADD MEMORY MODAL EVENTS
========================================================= */

addMemoryBtn.addEventListener("click", () => {
    if (!isActiveMember) {
        requestMemberSignIn();
        return;
    }
    openModal();
});

modalCloseBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (event) => {

    if (event.target === modalOverlay) {
        closeModal();
    }

});


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener("keydown", (event) => {

    if (event.key !== "Escape") return;

    if (!popup.hidden) {
        tutupPopup();
        return;
    }

    if (modalOverlay.classList.contains("open")) {
        closeModal();
    }


});


/* =========================================================
   FILE PREVIEW (PHOTO / VIDEO)
========================================================= */

memoryPhotoInput.addEventListener("change", () => {

    const file = memoryPhotoInput.files[0];

    clearPreview();

    if (!file) return;

    const error = validateFile(file);

    if (error) {
        alert(error);
        memoryPhotoInput.value = "";
        return;
    }

    const objectUrl = URL.createObjectURL(file);
    let element;

    if (getMediaType(file) === "video") {

        element = document.createElement("video");
        element.src = objectUrl;
        element.controls = true;
        element.muted = true;
        element.playsInline = true;
        element.preload = "metadata";

        element.onloadeddata = () => {
            URL.revokeObjectURL(objectUrl);
        };

    } else {

        element = document.createElement("img");
        element.src = objectUrl;
        element.alt = "Photo preview";

        element.onload = () => {
            URL.revokeObjectURL(objectUrl);
        };

    }

    modalPreview.appendChild(element);
    modalPreview.classList.add("show");

});


/* =========================================================
   LIKE STORAGE
========================================================= */

function getLikedIds() {

    try {

        const data = JSON.parse(
            localStorage.getItem(LIKES_KEY) || "[]"
        );

        return Array.isArray(data) ? data : [];

    } catch {

        return [];

    }

}


function saveLikedIds(ids) {

    try {
        localStorage.setItem(LIKES_KEY, JSON.stringify(ids));
    } catch (error) {
        console.error("Could not save likes:", error);
    }

}


/* =========================================================
   SHARED SUPER ADMIN ACCESS
========================================================= */

function updateDeleteButtons() {
    document.querySelectorAll(".memory-edit").forEach(button => {
        button.style.display = isLibraryEditor ? "flex" : "none";
    });
    document.querySelectorAll(".memory-delete").forEach(button => {
        button.style.display = isSuperAdmin ? "flex" : "none";
    });

    if (addMemoryBtn) {
        addMemoryBtn.innerHTML = isActiveMember
            ? '<i class="bx bx-plus"></i> Add Memory'
            : '<i class="bx bx-lock-alt"></i> Sign in to upload';
        addMemoryBtn.setAttribute("aria-label", isActiveMember ? "Add Memory" : "Sign in to upload a memory");
    }

    document.querySelectorAll(".memory-like").forEach(button => {
        button.style.display = isActiveMember ? "flex" : "none";
        button.disabled = !isActiveMember;
        button.title = isActiveMember ? "Like memory" : "Sign in to use member features";
    });
}

function startMemoriesListener() {
    if (stopMemoriesListener) {
        stopMemoriesListener();
        stopMemoriesListener = null;
    }
    memoryCache.clear();

    // Guest queries must explicitly constrain results to public records.
    const memoriesQuery = isActiveMember
        ? query(memoriesRef, orderBy("createdAt", "desc"))
        : query(memoriesRef, where("visibility", "==", "public"));

    stopMemoriesListener = onSnapshot(memoriesQuery, (snapshot) => {
        libraryGrid.querySelectorAll(".cloud-memory").forEach((card) => {
            card.querySelectorAll("video").forEach((video) => video.pause());
            card.remove();
        });

        memoryCache.clear();
        const visibleMemories = snapshot.docs.map(memoryDoc => ({
            id: memoryDoc.id,
            ...memoryDoc.data()
        })).sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
        visibleMemories.forEach(memory => {
            memoryCache.set(memory.id, memory);
            libraryGrid.appendChild(buildMemoryCard(memory));
        });

        applyLikedState();
        updateDeleteButtons();
        sembunyikanLoading();
    }, (error) => {
        console.error("Firestore Library read failed:", error);
        libraryGrid.querySelectorAll(".cloud-memory").forEach(card => card.remove());
        sembunyikanLoading();
    });
}

onAuthStateChanged(auth, async (user) => {
    isActiveMember = false;
    isSuperAdmin = false;
    isLibraryEditor = false;
    updateDeleteButtons();

    if (user) {
        try {
            const profileSnapshot = await getDoc(doc(db, "users", user.uid));
            if (auth.currentUser?.uid !== user.uid) return;

            const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
            const allowedRoles = ["student", "admin", "superAdmin", "super_admin"];
            isActiveMember = !!profile &&
                profile.isActive === true &&
                allowedRoles.includes(profile.role);
            isSuperAdmin = isActiveMember &&
                ["superAdmin", "super_admin"].includes(profile.role);
            isLibraryEditor = isActiveMember &&
                (isSuperAdmin || profile.canManageLibrary === true);
        } catch (error) {
            console.error("Could not verify Library member role:", error);
            isActiveMember = false;
            isSuperAdmin = false;
            isLibraryEditor = false;
        }
    }

    updateDeleteButtons();
    startMemoriesListener();
});


/* =========================================================
   BUILD MEMORY CARD
========================================================= */

function buildMemoryCard(memory) {

    const card = document.createElement("article");

    card.className = "memory-card cloud-memory";
    card.dataset.id = memory.id;


    /* ---------- MEDIA (PHOTO / VIDEO) ---------- */

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "memory-image";

    const mediaType = resolveMediaType(memory);
    let media;

    if (mediaType === "video") {

        media = document.createElement("video");
        media.src = memory.imageUrl || "";
        media.controls = true;
        media.preload = "metadata";
        media.playsInline = true;
        media.setAttribute("aria-label", memory.title || "Memory video");

        media.onerror = () => {
            media.style.objectFit = "contain";
        };

        card.classList.add("is-video");

    } else {

        media = document.createElement("img");
        media.src = memory.imageUrl || "";
        media.alt = memory.title || "Memory";
        media.loading = "lazy";
        media.decoding = "async";

        media.onerror = () => {
            media.style.objectFit = "contain";
            media.style.padding = "50px";
            media.alt = "Image unavailable";
        };

    }

    imageWrapper.appendChild(media);


    /* ---------- DELETE ---------- */

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "memory-edit";
    editButton.dataset.action = "edit";
    editButton.title = "Edit memory";
    editButton.setAttribute("aria-label", "Edit memory");
    editButton.style.display = isLibraryEditor ? "flex" : "none";
    editButton.innerHTML = '<i class="bx bx-edit-alt"></i>';
    imageWrapper.appendChild(editButton);

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "memory-delete";
    deleteButton.dataset.action = "delete";
    deleteButton.title = "Delete memory";
    deleteButton.setAttribute("aria-label", "Delete memory");
    deleteButton.style.display = isSuperAdmin ? "flex" : "none";

    const deleteIcon = document.createElement("i");
    deleteIcon.className = "bx bx-trash";

    deleteButton.appendChild(deleteIcon);
    imageWrapper.appendChild(deleteButton);


    /* ---------- INFO ---------- */

    const info = document.createElement("div");
    info.className = "memory-info";

    const category = document.createElement("p");
    category.className = "memory-category";
    category.textContent = memory.category || "MEMORY";

    const title = document.createElement("h3");
    title.textContent = memory.title || "Untitled Memory";

    const description = document.createElement("p");
    description.className = "memory-description";
    description.textContent = memory.description || "";


    /* ---------- LIKE ---------- */

    const likeButton = document.createElement("button");

    likeButton.type = "button";
    likeButton.className = "memory-like";
    likeButton.dataset.action = "like";
    likeButton.title = "Like memory";
    likeButton.setAttribute("aria-label", "Like memory");

    const likeIcon = document.createElement("i");
    likeIcon.className = "bx bx-heart";

    likeButton.appendChild(likeIcon);

    info.append(category, title, description, likeButton);
    card.append(imageWrapper, info);

    return card;

}


/* =========================================================
   APPLY LIKE STATE
========================================================= */

function applyLikedState() {

    const likedIds = getLikedIds();

    document
        .querySelectorAll(".memory-card")
        .forEach((card) => {

            const button = card.querySelector(".memory-like");

            if (!button) return;

            const icon = button.querySelector("i");
            const liked = likedIds.includes(card.dataset.id);

            button.classList.toggle("liked", liked);
            button.setAttribute("aria-pressed", String(liked));

            icon.className = liked ? "bx bxs-heart" : "bx bx-heart";

        });

}


/* =========================================================
   CLOUDINARY UPLOAD (IMAGE / VIDEO, WITH PROGRESS)
========================================================= */

function uploadToCloudinary(file, mediaType, onProgress) {

    return new Promise((resolve, reject) => {

        // endpoint beda: /image/upload atau /video/upload
        const endpoint =
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${mediaType}/upload`;

        const formData = new FormData();

        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        const xhr = new XMLHttpRequest();

        xhr.open("POST", endpoint);

        xhr.upload.onprogress = (event) => {

            if (event.lengthComputable && onProgress) {
                onProgress(
                    Math.round((event.loaded / event.total) * 100)
                );
            }

        };

        xhr.onerror = () => {
            reject(new Error("Network error while uploading."));
        };

        xhr.onload = () => {

            let result;

            try {

                result = JSON.parse(xhr.responseText);

            } catch {

                reject(new Error("Cloudinary returned an invalid response."));
                return;

            }

            if (xhr.status < 200 || xhr.status >= 300) {

                reject(new Error(
                    result?.error?.message || "Cloudinary upload failed."
                ));
                return;

            }

            if (!result?.secure_url) {

                reject(new Error("Cloudinary did not return a media URL."));
                return;

            }

            resolve({
                imageUrl: result.secure_url,
                publicId: result.public_id || null
            });

        };

        xhr.send(formData);

    });

}


/* =========================================================
   ADD MEMORY
========================================================= */

memoryForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!isActiveMember) {
        requestMemberSignIn();
        return;
    }
    if (editingMemoryId && !isLibraryEditor) {
        alert("This account does not have permission to edit existing Library memories.");
        return;
    }

    const file = memoryPhotoInput.files[0];
    const category = memoryCategoryInput.value.trim();
    const title = memoryTitleInput.value.trim();
    const description = memoryDescriptionInput.value.trim();

    if ((!editingMemoryId && !file) || !category || !title || !description) {
        alert("Please complete all required fields.");
        return;
    }
    if (!memoryPublicConsentInput.checked) {
        alert("Please confirm that you have permission to publish this media publicly.");
        return;
    }
    if (memoryVisibilityInput.value !== "public") {
        alert("Class Only uploads are unavailable until protected media delivery is configured.");
        return;
    }

    if (file) {
        const fileError = validateFile(file);
        if (fileError) {
            alert(fileError);
            return;
        }
    }

    const mediaType = file ? getMediaType(file) : null;


    /* BUTTON */

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";


    try {
        let upload = null;

        if (file) {
            upload = await uploadToCloudinary(file, mediaType, (percent) => {
                submitBtn.textContent = `Uploading... ${percent}%`;
            });
        }

        submitBtn.textContent = editingMemoryId ? "Updating..." : "Saving...";

        if (editingMemoryId) {
            const payload = {
                category,
                title,
                description,
                visibility: "public",
                publicConsent: true,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser.uid
            };
            if (upload) {
                payload.imageUrl = upload.imageUrl;
                payload.mediaType = mediaType;
                payload.cloudinaryPublicId = upload.publicId;
            }
            await updateDoc(doc(db, "memories", editingMemoryId), payload);
        } else {
            if (!upload) throw new Error("Please select a photo or video.");
            await addDoc(memoriesRef, {
                imageUrl: upload.imageUrl,
                mediaType,
                cloudinaryPublicId: upload.publicId,
                category,
                title,
                description,
                createdAt: serverTimestamp(),
                uploadedBy: auth.currentUser.uid,
                visibility: "public",
                publicConsent: true
            });
        }

        const isEditing = Boolean(editingMemoryId);
        closeModal();

        tampilkanPopup({
            tipe: "sukses",
            judul: isEditing ? "Memory updated!" : "Memory saved!",
            pesan: isEditing
                ? "The Library memory has been updated."
                : (mediaType === "video"
                    ? "Your video has been added to the Library."
                    : "Your photo has been added to the Library."),
            urlPreview: upload?.imageUrl || null,
            jenis: mediaType || "image",
            onUtama: () => libraryGrid.scrollIntoView({ behavior: "smooth", block: "start" }),
            onKedua: isActiveMember ? () => openModal() : null
        });

    } catch (error) {

        console.error("Upload error:", error);

        submitBtn.disabled = false;
        submitBtn.textContent = editingMemoryId ? "Save Changes" : "Save Memory";

        tampilkanPopup({
            tipe: "gagal",
            judul: "Upload gagal",
            pesan: error.message || "Coba lagi ya. Pastikan koneksi stabil.",
            teksUtama: "Coba lagi",
            teksKedua: "Tutup"
        });

    }

});


/* =========================================================
   FIRESTORE LISTENER
   Started only after the visitor/member role is resolved.
========================================================= */




/* =========================================================
   DELETE MEMORY
========================================================= */

async function deleteCloudMemory(card) {

    /*
        Double protection:
        1. UI hanya menampilkan tombol untuk admin.
        2. Firestore Rules tetap memeriksa UID.
    */

    if (!isSuperAdmin) {
        alert("Only an active SuperAdmin can delete memories.");
        return;
    }

    const cardId = card.dataset.id;

    if (!cardId) return;

    const title =
        card.querySelector("h3")?.textContent || "this memory";

    const confirmed = confirm(
        `Delete "${title}"?\n\nThis memory will be removed for everyone.`
    );

    if (!confirmed) return;

    const deleteButton = card.querySelector(".memory-delete");

    deleteButton.disabled = true;

    try {

        await deleteDoc(doc(db, "memories", cardId));

        // onSnapshot() otomatis menghapus card dari UI.

        saveLikedIds(
            getLikedIds().filter((id) => id !== cardId)
        );

    } catch (error) {

        console.error("Delete error:", error);

        alert(`Could not delete memory: ${error.message}`);

        deleteButton.disabled = false;

    }

}


/* =========================================================
   CARD CLICK EVENTS
========================================================= */

libraryGrid.addEventListener("click", async (event) => {

    const button = event.target.closest("button");

    if (!button) return;

    const card = button.closest(".memory-card");

    if (!card) return;

    const action = button.dataset.action;


    /* EDIT */

    if (action === "edit") {
        if (!isLibraryEditor) return;
        const memory = memoryCache.get(card.dataset.id);
        if (memory) openModal(memory);
        return;
    }

    /* DELETE */

    if (action === "delete") {

        await deleteCloudMemory(card);

        return;

    }


    /* LIKE */

    if (action === "like") {
        if (!isActiveMember) return;

        const cardId = card.dataset.id;
        const likedIds = getLikedIds();

        if (likedIds.includes(cardId)) {

            saveLikedIds(likedIds.filter((id) => id !== cardId));

        } else {

            saveLikedIds([...likedIds, cardId]);

        }

        applyLikedState();

    }

});


/* =========================================================
   INITIAL UI
========================================================= */

updateDeleteButtons();
applyLikedState();