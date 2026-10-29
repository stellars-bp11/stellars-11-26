import {
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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
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
   ADMIN UID
========================================================= */

const ADMIN_UID = "PKHSk7VpN4YJFW9URexjfDEZgjo2";


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

const app = initializeApp(firebaseConfig);
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

let isAdmin = false;


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
const modalPreview = document.getElementById("modalPreview");
const submitBtn = document.querySelector(".modal-submit");

const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminModalOverlay = document.getElementById("adminModalOverlay");
const adminModalClose = document.getElementById("adminModalClose");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminStatus = document.getElementById("adminStatus");


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


function openModal() {

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

    submitBtn.disabled = false;
    submitBtn.textContent = "Save Memory";

}


/* =========================================================
   ADD MEMORY MODAL EVENTS
========================================================= */

addMemoryBtn.addEventListener("click", openModal);

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

    if (adminModalOverlay.classList.contains("open")) {
        closeAdminModal();
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
   ADMIN UI
========================================================= */

function updateAdminButton() {

    if (!adminLoginBtn) return;

    if (isAdmin) {

        adminLoginBtn.innerHTML = `
            <i class="bx bx-log-out"></i>
            <span>Logout</span>
        `;

    } else {

        adminLoginBtn.innerHTML = `
            <i class="bx bx-lock-alt"></i>
            <span>Admin</span>
        `;

    }

}


function updateDeleteButtons() {

    document
        .querySelectorAll(".memory-delete")
        .forEach((button) => {

            button.style.display = isAdmin ? "flex" : "none";

        });

}


/* =========================================================
   ADMIN MODAL
========================================================= */

function openAdminModal() {

    if (isAdmin) return;

    adminStatus.textContent = "";
    adminModalOverlay.classList.add("open");

}


function closeAdminModal() {

    adminModalOverlay.classList.remove("open");
    adminStatus.textContent = "";

}


adminLoginBtn.addEventListener("click", async () => {

    // Kalau sudah login sebagai admin, tombol jadi Logout.
    if (isAdmin) {

        try {

            await signOut(auth);

        } catch (error) {

            console.error("Logout error:", error);
            alert("Could not log out.");

        }

        return;

    }

    openAdminModal();

});


adminModalClose.addEventListener("click", closeAdminModal);

adminModalOverlay.addEventListener("click", (event) => {

    if (event.target === adminModalOverlay) {
        closeAdminModal();
    }

});


/* =========================================================
   ADMIN LOGIN
========================================================= */

adminLoginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = adminEmail.value.trim();
    const password = adminPassword.value;

    if (!email || !password) return;

    adminStatus.textContent = "Logging in...";

    try {

        const credentials = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        // Login Firebase berhasil, tapi UID harus cocok dengan admin.
        if (credentials.user.uid !== ADMIN_UID) {

            await signOut(auth);

            throw new Error("This account is not the admin account.");

        }

        adminStatus.textContent = "Login successful.";
        adminLoginForm.reset();

        setTimeout(closeAdminModal, 400);

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        adminStatus.textContent =
            `${error.code || "Error"}: ${error.message}`;

    }

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, (user) => {

    isAdmin = !!user && user.uid === ADMIN_UID;

    updateAdminButton();
    updateDeleteButtons();

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

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "memory-delete";
    deleteButton.dataset.action = "delete";
    deleteButton.title = "Delete memory";
    deleteButton.setAttribute("aria-label", "Delete memory");
    deleteButton.style.display = isAdmin ? "flex" : "none";

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

    const file = memoryPhotoInput.files[0];
    const category = memoryCategoryInput.value.trim();
    const title = memoryTitleInput.value.trim();
    const description = memoryDescriptionInput.value.trim();


    /* VALIDATION */

    if (!file || !category || !title || !description) {
        alert("Please complete all fields.");
        return;
    }

    const fileError = validateFile(file);

    if (fileError) {
        alert(fileError);
        return;
    }

    const mediaType = getMediaType(file);


    /* BUTTON */

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";


    try {

        /* 1. CLOUDINARY */

        const upload = await uploadToCloudinary(
            file,
            mediaType,
            (percent) => {
                submitBtn.textContent = `Uploading... ${percent}%`;
            }
        );

        submitBtn.textContent = "Saving...";


        /* 2. FIRESTORE */

        await addDoc(memoriesRef, {

            imageUrl: upload.imageUrl,   // tetap dipakai sebagai URL media
            mediaType: mediaType,        // "image" atau "video"
            cloudinaryPublicId: upload.publicId,
            category: category,
            title: title,
            description: description,
            createdAt: serverTimestamp()

        });

        closeModal();


        /* 3. POPUP SUKSES */

        tampilkanPopup({
            tipe: "sukses",
            judul: "Memori tersimpan!",
            pesan: mediaType === "video"
                ? "Videomu sudah masuk ke Library."
                : "Fotomu sudah masuk ke Library.",
            urlPreview: upload.imageUrl,
            jenis: mediaType,
            onUtama: () => {
                libraryGrid.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            },
            onKedua: openModal
        });

    } catch (error) {

        console.error("Upload error:", error);

        submitBtn.disabled = false;
        submitBtn.textContent = "Save Memory";

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
========================================================= */

const memoriesQuery = query(
    memoriesRef,
    orderBy("createdAt", "desc")
);


onSnapshot(

    memoriesQuery,

    (snapshot) => {

        // Hapus hanya card Firebase, card HTML statis tidak disentuh.
        libraryGrid
            .querySelectorAll(".cloud-memory")
            .forEach((card) => {

                // hentikan video sebelum card dibuang
                card.querySelectorAll("video").forEach((video) => {
                    video.pause();
                });

                card.remove();

            });

        snapshot.forEach((memoryDoc) => {

            const memory = {
                id: memoryDoc.id,
                ...memoryDoc.data()
            };

            libraryGrid.appendChild(buildMemoryCard(memory));

        });

        applyLikedState();
        updateDeleteButtons();
        sembunyikanLoading();

    },

    (error) => {

        console.error("Firestore error:", error);
        console.error("Check Firestore Rules and database configuration.");

        sembunyikanLoading();

    }

);


/* =========================================================
   DELETE MEMORY
========================================================= */

async function deleteCloudMemory(card) {

    /*
        Double protection:
        1. UI hanya menampilkan tombol untuk admin.
        2. Firestore Rules tetap memeriksa UID.
    */

    if (!isAdmin) {
        alert("Only the admin can delete memories.");
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


    /* DELETE */

    if (action === "delete") {

        await deleteCloudMemory(card);

        return;

    }


    /* LIKE */

    if (action === "like") {

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

updateAdminButton();
updateDeleteButtons();
applyLikedState();