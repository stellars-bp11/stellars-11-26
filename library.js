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

    apiKey:
        "AIzaSyD3ptwKTlqFCmvrTVJFooFiVLE63mh83c",

    authDomain:
        "class-web-7241e.firebaseapp.com",

    projectId:
        "class-web-7241e",

    storageBucket:
        "class-web-7241e.firebasestorage.app",

    messagingSenderId:
        "167560389153",

    appId:
        "1:167560389153:web:f61f4f821275c48373f960",

    measurementId:
        "G-DTHTZNT135"
};


/* =========================================================
   ADMIN UID
========================================================= */

/*
    GANTI NILAI DI BAWAH INI DENGAN
    UID AKUN ADMIN KAMU.

    Contoh:
    const ADMIN_UID = "abc123xyz456";
*/

const ADMIN_UID =
    "GANTI_DENGAN_UID_KAMU";


/* =========================================================
   CLOUDINARY
========================================================= */

const CLOUD_NAME =
    "b88nrr3l";

const UPLOAD_PRESET =
    "stellar-library";

const MAX_FILE_SIZE =
    5 * 1024 * 1024;


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app =
    initializeApp(firebaseConfig);

const db =
    getFirestore(app);

const auth =
    getAuth(app);

const memoriesRef =
    collection(db, "memories");


/* =========================================================
   LOCAL STORAGE
========================================================= */

const LIKES_KEY =
    "stellars-library-likes";


/* =========================================================
   ADMIN STATE
========================================================= */

let isAdmin =
    false;


/* =========================================================
   ELEMENTS
========================================================= */

const libraryGrid =
    document.getElementById("libraryGrid");

const addMemoryBtn =
    document.getElementById("addMemoryBtn");

const modalOverlay =
    document.getElementById("modalOverlay");

const modalCloseBtn =
    document.getElementById("modalCloseBtn");

const memoryForm =
    document.getElementById("memoryForm");

const memoryPhotoInput =
    document.getElementById("memoryPhoto");

const memoryCategoryInput =
    document.getElementById("memoryCategory");

const memoryTitleInput =
    document.getElementById("memoryTitle");

const memoryDescriptionInput =
    document.getElementById("memoryDescription");

const modalPreview =
    document.getElementById("modalPreview");

const submitBtn =
    document.querySelector(".modal-submit");


/* =========================================================
   ADMIN ELEMENTS
========================================================= */

const adminLoginBtn =
    document.getElementById("adminLoginBtn");

const adminModalOverlay =
    document.getElementById("adminModalOverlay");

const adminModalClose =
    document.getElementById("adminModalClose");

const adminLoginForm =
    document.getElementById("adminLoginForm");

const adminEmail =
    document.getElementById("adminEmail");

const adminPassword =
    document.getElementById("adminPassword");

const adminStatus =
    document.getElementById("adminStatus");


/* =========================================================
   MODAL HELPERS
========================================================= */

function openModal() {

    modalOverlay.classList.add("open");

    modalOverlay.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

}


function closeModal() {

    modalOverlay.classList.remove("open");

    modalOverlay.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

    memoryForm.reset();

    modalPreview.classList.remove(
        "show"
    );

    modalPreview.innerHTML = "";

    submitBtn.disabled =
        false;

    submitBtn.textContent =
        "Save Memory";

}


/* =========================================================
   ADD MEMORY MODAL EVENTS
========================================================= */

addMemoryBtn.addEventListener(
    "click",
    openModal
);


modalCloseBtn.addEventListener(
    "click",
    closeModal
);


modalOverlay.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            modalOverlay
        ) {

            closeModal();

        }

    }
);


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key !== "Escape"
        ) {
            return;
        }


        if (
            modalOverlay.classList.contains(
                "open"
            )
        ) {

            closeModal();

        }


        if (
            adminModalOverlay.classList.contains(
                "open"
            )
        ) {

            closeAdminModal();

        }

    }
);


/* =========================================================
   IMAGE PREVIEW
========================================================= */

memoryPhotoInput.addEventListener(
    "change",
    () => {

        const file =
            memoryPhotoInput.files[0];


        modalPreview.innerHTML =
            "";

        modalPreview.classList.remove(
            "show"
        );


        if (!file) {
            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "Please select an image file."
            );

            memoryPhotoInput.value =
                "";

            return;
        }


        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            alert(
                "Maximum photo size is 5 MB."
            );

            memoryPhotoInput.value =
                "";

            return;
        }


        const image =
            document.createElement(
                "img"
            );


        const objectUrl =
            URL.createObjectURL(
                file
            );


        image.src =
            objectUrl;

        image.alt =
            "Photo preview";


        image.onload =
            () => {

                URL.revokeObjectURL(
                    objectUrl
                );

            };


        modalPreview.appendChild(
            image
        );

        modalPreview.classList.add(
            "show"
        );

    }
);


/* =========================================================
   LIKE STORAGE
========================================================= */

function getLikedIds() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    LIKES_KEY
                ) || "[]"
            );


        return Array.isArray(data)
            ? data
            : [];

    } catch {

        return [];

    }

}


function saveLikedIds(
    ids
) {

    localStorage.setItem(
        LIKES_KEY,
        JSON.stringify(ids)
    );

}


/* =========================================================
   ADMIN UI
========================================================= */

function updateAdminButton() {

    if (!adminLoginBtn) {
        return;
    }


    if (isAdmin) {

        adminLoginBtn.innerHTML =
            `
                <i class="bx bx-log-out"></i>
                <span>Logout</span>
            `;

    } else {

        adminLoginBtn.innerHTML =
            `
                <i class="bx bx-lock-alt"></i>
                <span>Admin</span>
            `;

    }

}


function updateDeleteButtons() {

    document
        .querySelectorAll(
            ".memory-delete"
        )
        .forEach(
            (button) => {

                button.style.display =
                    isAdmin
                        ? "flex"
                        : "none";

            }
        );

}


/* =========================================================
   ADMIN MODAL
========================================================= */

function openAdminModal() {

    if (isAdmin) {
        return;
    }


    adminStatus.textContent =
        "";

    adminModalOverlay.classList.add(
        "open"
    );

}


function closeAdminModal() {

    adminModalOverlay.classList.remove(
        "open"
    );

    adminStatus.textContent =
        "";

}


adminLoginBtn.addEventListener(
    "click",
    async () => {

        /*
            Kalau sudah login sebagai admin,
            tombol berubah menjadi Logout.
        */

        if (isAdmin) {

            try {

                await signOut(
                    auth
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                alert(
                    "Could not log out."
                );

            }

            return;
        }


        openAdminModal();

    }
);


adminModalClose.addEventListener(
    "click",
    closeAdminModal
);


adminModalOverlay.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            adminModalOverlay
        ) {

            closeAdminModal();

        }

    }
);


/* =========================================================
   ADMIN LOGIN
========================================================= */

adminLoginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const email =
            adminEmail.value.trim();

        const password =
            adminPassword.value;


        if (
            !email ||
            !password
        ) {

            return;

        }


        adminStatus.textContent =
            "Logging in...";


        try {

            const credentials =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            /*
                Login berhasil secara Firebase,
                tapi kita tetap cek apakah UID
                adalah UID admin yang ditentukan.
            */

            if (
                credentials.user.uid !==
                ADMIN_UID
            ) {

                await signOut(
                    auth
                );

                throw new Error(
                    "This account is not the admin account."
                );

            }


            adminStatus.textContent =
                "Login successful.";

            adminLoginForm.reset();


            setTimeout(
                () => {

                    closeAdminModal();

                },
                400
            );


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            adminStatus.textContent =
                "Login failed. Check your email and password.";

        }

    }
);


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
    auth,
    (user) => {

        /*
            Hanya UID yang sudah ditentukan
            yang dianggap admin.
        */

        isAdmin =
            !!user &&
            user.uid === ADMIN_UID;


        updateAdminButton();

        updateDeleteButtons();

    }
);


/* =========================================================
   BUILD MEMORY CARD
========================================================= */

function buildMemoryCard(
    memory
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "memory-card cloud-memory";


    card.dataset.id =
        memory.id;


    /* =====================================
       IMAGE
    ====================================== */

    const imageWrapper =
        document.createElement(
            "div"
        );


    imageWrapper.className =
        "memory-image";


    const image =
        document.createElement(
            "img"
        );


    image.src =
        memory.imageUrl || "";

    image.alt =
        memory.title || "Memory";

    image.loading =
        "lazy";

    image.decoding =
        "async";


    image.onerror =
        () => {

            image.style.objectFit =
                "contain";

            image.style.padding =
                "50px";

            image.alt =
                "Image unavailable";

        };


    imageWrapper.appendChild(
        image
    );


    /* =====================================
       DELETE
    ====================================== */

    const deleteButton =
        document.createElement(
            "button"
        );


    deleteButton.type =
        "button";

    deleteButton.className =
        "memory-delete";

    deleteButton.dataset.action =
        "delete";

    deleteButton.title =
        "Delete memory";

    deleteButton.setAttribute(
        "aria-label",
        "Delete memory"
    );


    deleteButton.style.display =
        isAdmin
            ? "flex"
            : "none";


    const deleteIcon =
        document.createElement(
            "i"
        );


    deleteIcon.className =
        "bx bx-trash";


    deleteButton.appendChild(
        deleteIcon
    );


    imageWrapper.appendChild(
        deleteButton
    );


    /* =====================================
       INFO
    ====================================== */

    const info =
        document.createElement(
            "div"
        );


    info.className =
        "memory-info";


    const category =
        document.createElement(
            "p"
        );


    category.className =
        "memory-category";

    category.textContent =
        memory.category ||
        "MEMORY";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        memory.title ||
        "Untitled Memory";


    const description =
        document.createElement(
            "p"
        );


    description.className =
        "memory-description";

    description.textContent =
        memory.description ||
        "";


    /* =====================================
       LIKE
    ====================================== */

    const likeButton =
        document.createElement(
            "button"
        );


    likeButton.type =
        "button";

    likeButton.className =
        "memory-like";

    likeButton.dataset.action =
        "like";

    likeButton.title =
        "Like memory";

    likeButton.setAttribute(
        "aria-label",
        "Like memory"
    );


    const likeIcon =
        document.createElement(
            "i"
        );


    likeIcon.className =
        "bx bx-heart";


    likeButton.appendChild(
        likeIcon
    );


    info.append(
        category,
        title,
        description,
        likeButton
    );


    card.append(
        imageWrapper,
        info
    );


    return card;

}


/* =========================================================
   APPLY LIKE STATE
========================================================= */

function applyLikedState() {

    const likedIds =
        getLikedIds();


    document
        .querySelectorAll(
            ".memory-card"
        )
        .forEach(
            (card) => {

                const button =
                    card.querySelector(
                        ".memory-like"
                    );


                if (!button) {
                    return;
                }


                const icon =
                    button.querySelector(
                        "i"
                    );


                const liked =
                    likedIds.includes(
                        card.dataset.id
                    );


                button.classList.toggle(
                    "liked",
                    liked
                );


                button.setAttribute(
                    "aria-pressed",
                    String(liked)
                );


                icon.className =
                    liked
                        ? "bx bxs-heart"
                        : "bx bx-heart";

            }
        );

}


/* =========================================================
   CLOUDINARY UPLOAD
========================================================= */

async function uploadToCloudinary(
    file
) {

    const endpoint =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;


    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    formData.append(
        "upload_preset",
        UPLOAD_PRESET
    );


    const response =
        await fetch(
            endpoint,
            {
                method: "POST",
                body: formData
            }
        );


    let result;


    try {

        result =
            await response.json();

    } catch {

        throw new Error(
            "Cloudinary returned an invalid response."
        );

    }


    if (!response.ok) {

        throw new Error(
            result?.error?.message ||
            "Cloudinary upload failed."
        );

    }


    if (
        !result?.secure_url
    ) {

        throw new Error(
            "Cloudinary did not return an image URL."
        );

    }


    return {

        imageUrl:
            result.secure_url,

        publicId:
            result.public_id || null

    };

}


/* =========================================================
   ADD MEMORY
========================================================= */

memoryForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const file =
            memoryPhotoInput.files[0];

        const category =
            memoryCategoryInput.value.trim();

        const title =
            memoryTitleInput.value.trim();

        const description =
            memoryDescriptionInput.value.trim();


        /* VALIDATION */

        if (
            !file ||
            !category ||
            !title ||
            !description
        ) {

            alert(
                "Please complete all fields."
            );

            return;

        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "Please select a valid image."
            );

            return;

        }


        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            alert(
                "Maximum photo size is 5 MB."
            );

            return;

        }


        /* BUTTON */

        submitBtn.disabled =
            true;

        submitBtn.textContent =
            "Uploading...";


        try {

            /* 1. CLOUDINARY */

            const upload =
                await uploadToCloudinary(
                    file
                );


            /* 2. FIRESTORE */

            await addDoc(
                memoriesRef,
                {

                    imageUrl:
                        upload.imageUrl,

                    cloudinaryPublicId:
                        upload.publicId,

                    category:
                        category,

                    title:
                        title,

                    description:
                        description,

                    createdAt:
                        serverTimestamp()

                }
            );


            closeModal();


            alert(
                "Memory uploaded successfully!"
            );


        } catch (error) {

            console.error(
                "Upload error:",
                error
            );


            alert(
                `Upload failed: ${error.message}`
            );


            submitBtn.disabled =
                false;

            submitBtn.textContent =
                "Save Memory";

        }

    }
);


/* =========================================================
   FIRESTORE LISTENER
========================================================= */

const memoriesQuery =
    query(
        memoriesRef,
        orderBy(
            "createdAt",
            "desc"
        )
    );


onSnapshot(

    memoriesQuery,

    (snapshot) => {

        /*
            HANYA hapus card Firebase.
            Card statis / card HTML lain
            TIDAK disentuh.
        */

        libraryGrid
            .querySelectorAll(
                ".cloud-memory"
            )
            .forEach(
                (card) => {

                    card.remove();

                }
            );


        /*
            Tambahkan memory Firebase.
        */

        snapshot.forEach(
            (memoryDoc) => {

                const memory = {

                    id:
                        memoryDoc.id,

                    ...memoryDoc.data()

                };


                const card =
                    buildMemoryCard(
                        memory
                    );


                libraryGrid.appendChild(
                    card
                );

            }
        );


        applyLikedState();

        updateDeleteButtons();

    },


    (error) => {

        console.error(
            "Firestore error:",
            error
        );

        console.error(
            "Check Firestore Rules and database configuration."
        );

    }

);


/* =========================================================
   DELETE MEMORY
========================================================= */

async function deleteCloudMemory(
    card
) {

    /*
        Double protection:
        1. UI hanya menampilkan tombol
           untuk admin.
        2. Firestore Rules tetap memeriksa UID.
    */

    if (!isAdmin) {

        alert(
            "Only the admin can delete memories."
        );

        return;

    }


    const cardId =
        card.dataset.id;


    if (!cardId) {
        return;
    }


    const title =
        card.querySelector(
            "h3"
        )?.textContent ||
        "this memory";


    const confirmed =
        confirm(
            `Delete "${title}"?\n\nThis memory will be removed for everyone.`
        );


    if (!confirmed) {
        return;
    }


    const deleteButton =
        card.querySelector(
            ".memory-delete"
        );


    deleteButton.disabled =
        true;


    try {

        await deleteDoc(
            doc(
                db,
                "memories",
                cardId
            )
        );


        /*
            onSnapshot()
            akan otomatis
            menghapus card dari UI.
        */


        saveLikedIds(
            getLikedIds().filter(
                (id) =>
                    id !== cardId
            )
        );


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        alert(
            `Could not delete memory: ${error.message}`
        );


        deleteButton.disabled =
            false;

    }

}


/* =========================================================
   CARD CLICK EVENTS
========================================================= */

libraryGrid.addEventListener(
    "click",
    async (event) => {

        const button =
            event.target.closest(
                "button"
            );


        if (!button) {
            return;
        }


        const card =
            button.closest(
                ".memory-card"
            );


        if (!card) {
            return;
        }


        const action =
            button.dataset.action;


        /* DELETE */

        if (
            action === "delete"
        ) {

            await deleteCloudMemory(
                card
            );

            return;

        }


        /* LIKE */

        if (
            action === "like"
        ) {

            const cardId =
                card.dataset.id;


            const likedIds =
                getLikedIds();


            const liked =
                likedIds.includes(
                    cardId
                );


            if (liked) {

                saveLikedIds(
                    likedIds.filter(
                        (id) =>
                            id !== cardId
                    )
                );

            } else {

                saveLikedIds([
                    ...likedIds,
                    cardId
                ]);

            }


            applyLikedState();

        }

    }
);


/* =========================================================
   INITIAL UI
========================================================= */

updateAdminButton();

updateDeleteButtons();

applyLikedState();