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

function normalizeFullName(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .split(" ").filter(Boolean).join(" ");
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
            const grid = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
                raw: false,
                blankrows: false
            });
            if (!grid.length) throw new Error("Worksheet Aktivasi belum berisi data mahasiswa.");

            // Detect the real header row instead of assuming it is always row 1.
            // This supports workbooks with title/instruction rows above the table.
            const headerRowIndex = grid.findIndex(row => {
                const headers = row.map(normalizeHeader);
                const hasName = headers.some(value =>
                    ["nama", "nama_lengkap", "full_name", "name"].includes(value)
                );
                const hasNim = headers.includes("nim");
                const hasCode = headers.some(value =>
                    ["kode_aktivasi", "kode_aktivasi_baru", "activation_code", "code"].includes(value)
                );
                return hasName && hasNim && hasCode;
            });

            if (headerRowIndex < 0) {
                throw new Error("Header tabel tidak ditemukan. Pastikan ada kolom Nama, NIM, dan Kode Aktivasi.");
            }

            const headerKeys = grid[headerRowIndex].map(normalizeHeader);
            const rows = grid.slice(headerRowIndex + 1)
                .map((values, index) => {
                    const row = { __rowNumber: headerRowIndex + index + 2 };
                    headerKeys.forEach((key, columnIndex) => {
                        if (key) row[key] = values[columnIndex] ?? "";
                    });
                    return row;
                })
                .filter(row => Object.keys(row).some(key =>
                    key !== "__rowNumber" && String(row[key] ?? "").trim() !== ""
                ));

            if (!rows.length) throw new Error("Tidak ada baris mahasiswa setelah header tabel.");

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
                    normalized.kode_aktivasi || normalized.kode_aktivasi_baru ||
                    normalized.activation_code || normalized.code || ""
                );

                if (!fullName && !nim && !code) return;

                const rowNumber = row.__rowNumber || index + 2;
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
            if (records.length !== 43) {
                throw new Error("Workbook baru harus berisi tepat 43 mahasiswa. Jasper Vladino Alvis dan Quinetta Aulya Winata adalah Super Admin, bukan akun siswa.");
            }
            const reservedSuperAdmins = new Set([
                "jasper vladino alvis",
                "quinetta aulya winata"
            ]);
            const includedAdmin = records.find(record => reservedSuperAdmins.has(normalizeFullName(record.fullName)));
            if (includedAdmin) {
                throw new Error(includedAdmin.fullName + " adalah Super Admin dan tidak boleh dimasukkan ke workbook aktivasi mahasiswa.");
            }
            if (records.length > 400) throw new Error("Maksimal 400 akun per satu kali unggah.");

            const hashes = await Promise.all(records.map(record => hashCode(record.code)));

            // Reissue safely without a privileged Cloud Function:
            // - unused ("available") codes may be replaced by an admin;
            // - already redeemed codes remain untouched and are not reissued;
            // - existing student profiles and Auth identities are never deleted.
            const inspections = await Promise.all(records.map(async (record, index) => {
                const [codeSnapshot, nimCodeSnapshot, nimIndexSnapshot] = await Promise.all([
                    getDoc(doc(db, "activationCodes", hashes[index])),
                    getDocs(query(
                        collection(db, "activationCodes"),
                        where("nim", "==", record.nim)
                    )),
                    getDoc(doc(db, "nimIndex", record.nim))
                ]);

                if (codeSnapshot.exists()) {
                    const existingCode = codeSnapshot.data() || {};
                    if (String(existingCode.nim || "").trim() !== record.nim ||
                        normalizeFullName(existingCode.fullName) !== normalizeFullName(record.fullName)) {
                        return { error: "Kode pada baris " + record.rowNumber + " sudah terhubung ke identitas lain." };
                    }
                    if (!["available", "redeemed"].includes(existingCode.status)) {
                        return { error: "Status kode pada baris " + record.rowNumber + " tidak dikenal. Periksa dokumen lama sebelum melanjutkan." };
                    }
                }

                const nimCodeDocs = nimCodeSnapshot.docs;
                const unsupportedStatus = nimCodeDocs.find(item =>
                    !["available", "redeemed"].includes(String(item.data()?.status || ""))
                );
                if (unsupportedStatus) {
                    return { error: "NIM " + record.nim + " memiliki kode lama dengan status tidak dikenal. Tidak ada data yang diubah." };
                }

                let existingStudent = false;
                if (nimIndexSnapshot.exists()) {
                    const indexData = nimIndexSnapshot.data() || {};
                    if (normalizeFullName(indexData.fullName) !== normalizeFullName(record.fullName) ||
                        indexData.isActive !== true ||
                        typeof indexData.uid !== "string" || !indexData.uid) {
                        return { error: "NIM " + record.nim + " masih terhubung ke identitas berbeda atau tidak aktif." };
                    }

                    const profileSnapshot = await getDoc(doc(db, "users", indexData.uid));
                    if (!profileSnapshot.exists()) {
                        return { error: "NIM " + record.nim + " memiliki tautan akun lama tanpa profil. Perlu pemeriksaan admin sebelum impor." };
                    }
                    const profile = profileSnapshot.data() || {};
                    if (profile.role !== "student" || profile.isActive !== true ||
                        String(profile.nim || "").trim() !== record.nim ||
                        normalizeFullName(profile.fullName) !== normalizeFullName(record.fullName)) {
                        return { error: "NIM " + record.nim + " terhubung ke akun yang datanya tidak cocok. Tidak ada kode yang disimpan." };
                    }
                    existingStudent = true;
                }

                const hasRedeemedCode = nimCodeDocs.some(item => item.data()?.status === "redeemed");
                const allAvailableDocs = nimCodeDocs.filter(item => item.data()?.status === "available");

                if (hasRedeemedCode && !nimIndexSnapshot.exists()) {
                    return { error: "NIM " + record.nim + " memiliki kode yang sudah redeemed, tetapi tautan akunnya tidak ditemukan. Perlu pemeriksaan admin." };
                }

                if (hasRedeemedCode || (codeSnapshot.exists() && codeSnapshot.data()?.status === "redeemed")) {
                    return {
                        record,
                        hash: hashes[index],
                        action: "already-secured",
                        oldAvailableDocs: allAvailableDocs,
                        existingStudent
                    };
                }

                const oldAvailableDocs = allAvailableDocs.filter(item => item.id !== hashes[index]);
                return {
                    record,
                    hash: hashes[index],
                    action: codeSnapshot.exists() ? "already-available" : (oldAvailableDocs.length ? "reissued" : "created"),
                    oldAvailableDocs,
                    existingStudent
                };
            }));

            const conflict = inspections.find(item => item.error)?.error;
            if (conflict) throw new Error(conflict + " Tidak ada kode dari file ini yang disimpan.");

            const batch = writeBatch(db);
            const oldCodeIdsToDelete = new Set();
            inspections.forEach(item => {
                item.oldAvailableDocs.forEach(oldDoc => {
                    if (!oldCodeIdsToDelete.has(oldDoc.id)) {
                        batch.delete(oldDoc.ref);
                        oldCodeIdsToDelete.add(oldDoc.id);
                    }
                });

                if (item.action === "created" || item.action === "reissued") {
                    batch.set(doc(db, "activationCodes", item.hash), {
                        fullName: item.record.fullName,
                        nim: item.record.nim,
                        status: "available",
                        createdAt: serverTimestamp(),
                        createdBy: authUser.uid
                    });
                }
            });
            const hasWriteOperations =
                inspections.some(item => item.action === "created" || item.action === "reissued") ||
                oldCodeIdsToDelete.size > 0;
            if (hasWriteOperations) await batch.commit();

            const exportWorkbook = XLSX.utils.book_new();
            const outputRows = [
                ["No", "Nama", "NIM", "Kode Aktivasi", "Status"],
                ...inspections.map((item, index) => [
                    index + 1,
                    item.record.fullName,
                    item.record.nim,
                    item.action === "already-secured"
                        ? ""
                        : item.record.code.match(/.{1,4}/g).join("-"),
                    item.action === "already-secured"
                        ? "AKUN SUDAH DISECURE — JANGAN BAGIKAN KODE BARU"
                        : item.action === "reissued"
                            ? "KODE LAMA DIGANTI"
                            : item.action === "already-available"
                                ? "KODE SUDAH TERDAFTAR"
                                : "KODE BARU TERDAFTAR"
                ])
            ];
            const outputSheet = XLSX.utils.aoa_to_sheet(outputRows);
            outputSheet["!cols"] = [
                { wch: 6 }, { wch: 34 }, { wch: 18 }, { wch: 25 }, { wch: 27 }
            ];
            XLSX.utils.book_append_sheet(exportWorkbook, outputSheet, "Aktivasi");
            XLSX.writeFile(exportWorkbook, "STELLARS-Activation-Codes-Registered.xlsx");

            const createdCount = inspections.filter(item => item.action === "created").length;
            const reissuedCount = inspections.filter(item => item.action === "reissued").length;
            const existingCount = inspections.filter(item => item.action === "already-available").length;
            const securedCount = inspections.filter(item => item.action === "already-secured").length;
            const availableCount = createdCount + reissuedCount + existingCount;

            setStatus(status,
                availableCount + " kode tersedia untuk aktivasi/secure account; " +
                securedCount + " akun sudah menggunakan kode sebelumnya.",
                "success");
            if (result) result.textContent =
                createdCount + " kode baru, " + reissuedCount + " kode lama yang belum dipakai diganti, " +
                existingCount + " kode tetap dipertahankan, dan " + securedCount +
                " akun yang sudah Secure My Account tidak diterbitkan kode baru. " +
                "Mahasiswa yang sudah memiliki akun harus Sign In lalu gunakan Secure My Account bila perlu; " +
                "mahasiswa yang belum memiliki akun dapat memakai First-time Activation.";
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
