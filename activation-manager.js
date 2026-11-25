import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    collection,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
    authDomain: "class-web-7241e.firebaseapp.com",
    projectId: "class-web-7241e",
    storageBucket: "class-web-7241e.firebasestorage.app",
    messagingSenderId: "167560389153",
    appId: "1:167560389153:web:f61f4f821275c48373f960",
    measurementId: "G-DTHTZNT135"
};

const SHEETJS_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{16}$/;
const NIM_PATTERN = /^\d{5,24}$/;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function normalizeHeader(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[\s-]/g, "");
}

function hashCode(code) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
        .then(buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join(""));
}

function setStatus(element, message, type = "info") {
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
}

export function initActivationManager(profile, authUser) {
    const allowedRoles = ["admin", "superAdmin", "super_admin"];
    if (!profile || !authUser || !allowedRoles.includes(profile.role)) return;

    const fileInput = document.getElementById("activationWorkbookFile");
    const uploadButton = document.getElementById("activationImportButton");
    const status = document.getElementById("activationManagerStatus");
    const result = document.getElementById("activationManagerResult");

    if (!fileInput || !uploadButton || !status) return;

    fileInput.addEventListener("change", () => {
        uploadButton.disabled = !fileInput.files?.[0];
        if (result) result.textContent = "";
        setStatus(status, fileInput.files?.[0]
            ? "File siap diperiksa. NIM dan kode harus terisi untuk setiap baris."
            : "Belum ada file dipilih.", "info");
    });

    uploadButton.addEventListener("click", async () => {
        const file = fileInput.files?.[0];
        if (!file || uploadButton.disabled) return;

        uploadButton.disabled = true;
        uploadButton.querySelector("span").textContent = "Checking workbook…";
        setStatus(status, "Memeriksa roster, NIM, dan kode aktivasi…", "info");
        if (result) result.textContent = "";

        try {
            if (file.size > 5 * 1024 * 1024) {
                throw new Error("Ukuran file melebihi batas 5 MB.");
            }

            const XLSX = await import(SHEETJS_URL);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
            const sheetName = workbook.Sheets["Aktivasi"] ? "Aktivasi" : workbook.SheetNames[0];
            if (!sheetName) throw new Error("Workbook tidak memiliki worksheet.");

            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
            if (!rows.length) throw new Error("Worksheet Aktivasi belum berisi data mahasiswa.");

            const records = [];
            const seenNims = new Set();
            const seenCodes = new Set();
            const missing = [];

            rows.forEach((row, index) => {
                const normalized = {};
                Object.keys(row).forEach(key => {
                    normalized[normalizeHeader(key)] = row[key];
                });

                const fullName = String(
                    normalized.nama || normalized.nama_lengkap || normalized.full_name || normalized.name || ""
                ).trim().replace(/\s+/g, " ");
                const nim = String(normalized.nim ?? "").trim().replace(/\.0$/, "");
                const code = normalizeCode(
                    normalized.kode_aktivasi || normalized.activation_code || normalized.code || ""
                );

                if (!fullName && !nim && !code) return;

                const rowNumber = index + 2;
                if (!fullName || !NIM_PATTERN.test(nim) || !CODE_PATTERN.test(code)) {
                    missing.push("Baris " + rowNumber + ": " + (fullName || "Nama kosong") +
                        (NIM_PATTERN.test(nim) ? "" : " — NIM belum valid") +
                        (CODE_PATTERN.test(code) ? "" : " — kode belum valid"));
                    return;
                }

                if (seenNims.has(nim)) {
                    missing.push("Baris " + rowNumber + ": NIM duplikat (" + nim + ").");
                    return;
                }
                if (seenCodes.has(code)) {
                    missing.push("Baris " + rowNumber + ": kode aktivasi duplikat.");
                    return;
                }

                seenNims.add(nim);
                seenCodes.add(code);
                records.push({ fullName, nim, code, rowNumber });
            });

            if (missing.length) {
                throw new Error(
                    "Ada data yang belum siap. Lengkapi atau perbaiki " + missing.length +
                    " baris terlebih dahulu. " + missing.slice(0, 5).join(" ")
                );
            }
            if (!records.length) throw new Error("Tidak ada baris mahasiswa yang valid.");
            if (records.length > 400) throw new Error("Maksimal 400 akun per satu kali unggah.");

            const hashes = await Promise.all(records.map(record => hashCode(record.code)));
            const conflicts = await Promise.all(records.map(async (record, index) => {
                const [codeSnapshot, nimCodeSnapshot] = await Promise.all([
                    getDoc(doc(db, "activationCodes", hashes[index])),
                    getDocs(query(
                        collection(db, "activationCodes"),
                        where("nim", "==", record.nim)
                    ))
                ]);
                if (codeSnapshot.exists()) {
                    return "Kode pada baris " + record.rowNumber + " sudah pernah didaftarkan.";
                }
                if (!nimCodeSnapshot.empty) {
                    return "NIM " + record.nim + " sudah memiliki kode aktivasi. Jangan membuat kode kedua untuk NIM yang sama.";
                }
                return "";
            }));
            const conflict = conflicts.find(Boolean);
            if (conflict) throw new Error(conflict + " Tidak ada kode dari file ini yang disimpan.");

            const batch = writeBatch(db);
            records.forEach((record, index) => {
                batch.set(doc(db, "activationCodes", hashes[index]), {
                    fullName: record.fullName,
                    nim: record.nim,
                    status: "available",
                    createdAt: serverTimestamp(),
                    createdBy: authUser.uid
                });
            });
            await batch.commit();

            const exportWorkbook = XLSX.utils.book_new();
            const outputRows = [
                ["No", "Nama", "NIM", "Kode Aktivasi", "Status"],
                ...records.map((record, index) => [
                    index + 1,
                    record.fullName,
                    record.nim,
                    record.code.match(/.{1,4}/g).join("-"),
                    "TERDAFTAR DI FIRESTORE"
                ])
            ];
            const outputSheet = XLSX.utils.aoa_to_sheet(outputRows);
            outputSheet["!cols"] = [
                { wch: 6 }, { wch: 34 }, { wch: 18 }, { wch: 25 }, { wch: 27 }
            ];
            XLSX.utils.book_append_sheet(exportWorkbook, outputSheet, "Aktivasi");
            XLSX.writeFile(exportWorkbook, "STELLARS-Activation-Codes-Registered.xlsx");

            setStatus(status,
                records.length + " kode berhasil didaftarkan. Kode asli tetap hanya ada di file Excel admin.",
                "success");
            if (result) result.textContent =
                "Berhasil: " + records.length + " kode terdaftar. Mahasiswa yang sudah punya akun harus login dengan akun lamanya lalu pilih Secure My Account untuk mengganti password. Mahasiswa yang belum punya akun dapat memakai First-time Activation.";
            fileInput.value = "";
        } catch (error) {
            console.error("STELLARS activation workbook import failed:", error);
            setStatus(status, error.message || "File aktivasi belum berhasil diproses.", "error");
        } finally {
            uploadButton.disabled = !fileInput.files?.[0];
            uploadButton.querySelector("span").textContent = "Register Activation Codes";
        }
    });
}
