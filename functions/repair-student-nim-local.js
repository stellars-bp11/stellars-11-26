#!/usr/bin/env node
"use strict";

/*
 * One-time local repair for a registered STELLARS student whose
 * users/{uid}.nim has already been corrected to the official NIM.
 *
 * Run locally with a trusted Firebase service-account credential.
 * Never commit or share the JSON credential file.
 *
 * Usage from the functions directory:
 *   node repair-student-nim-local.js 202612010118 "Carmella Wibowo Widhianto"
 */

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "class-web-7241e";
const AUTH_SUFFIX = "@class-web-7241e.firebaseapp.com";

function normalizeName(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
}

function authAliasFromNim(value) {
    const normalized = String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    if (!normalized) throw new Error("NIM tidak valid untuk membentuk alias login.");
    return normalized + AUTH_SUFFIX;
}

async function getUserByEmailOrNull(auth, email) {
    try {
        return await auth.getUserByEmail(email);
    } catch (error) {
        if (error.code === "auth/user-not-found") return null;
        throw error;
    }
}

async function main() {
    const newNim = String(process.argv[2] || "").trim();
    const expectedName = String(process.argv[3] || "").trim();

    if (!/^\d{5,24}$/.test(newNim) || !expectedName) {
        throw new Error(
            'Format perintah: node repair-student-nim-local.js 202612010118 "Carmella Wibowo Widhianto"'
        );
    }

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error(
            "GOOGLE_APPLICATION_CREDENTIALS belum diatur. Atur ke lokasi file service-account JSON yang disimpan di luar repository."
        );
    }

    initializeApp({
        credential: applicationDefault(),
        projectId: PROJECT_ID
    });

    const auth = getAuth();
    const db = getFirestore();

    // The profile NIM must already have been corrected manually in Firestore.
    const targetSnapshot = await db.collection("users").where("nim", "==", newNim).get();
    if (targetSnapshot.size !== 1) {
        throw new Error(
            "Harus ditemukan tepat satu profil users dengan NIM baru. Pastikan users.nim sudah dikoreksi dan tidak duplikat."
        );
    }

    const targetDoc = targetSnapshot.docs[0];
    const profile = targetDoc.data() || {};
    const uid = targetDoc.id;
    const fullName = String(profile.fullName || "").trim();

    if (normalizeName(fullName) !== normalizeName(expectedName)) {
        throw new Error("Nama profil tidak cocok dengan nama konfirmasi. Tidak ada data yang diubah.");
    }
    if (profile.role !== "student" || profile.isActive !== true) {
        throw new Error("Profil yang ditemukan bukan akun student aktif. Tidak ada data yang diubah.");
    }

    const [authUser, indexesByUid, redeemedCodes, newIndexSnapshot, codesForNewNim] = await Promise.all([
        auth.getUser(uid),
        db.collection("nimIndex").where("uid", "==", uid).get(),
        db.collection("activationCodes").where("redeemedBy", "==", uid).get(),
        db.collection("nimIndex").doc(newNim).get(),
        db.collection("activationCodes").where("nim", "==", newNim).get()
    ]);

    if (newIndexSnapshot.exists && String(newIndexSnapshot.data()?.uid || "") !== uid) {
        throw new Error("NIM baru sudah terhubung ke akun lain. Tidak ada data yang diubah.");
    }

    const matchingCodes = redeemedCodes.docs.filter(codeDoc => {
        const code = codeDoc.data() || {};
        return code.status === "redeemed" && normalizeName(code.fullName) === normalizeName(fullName);
    });

    if (matchingCodes.length !== 1) {
        throw new Error(
            "Harus ditemukan tepat satu activationCodes record berstatus redeemed yang terhubung ke UID dan nama siswa ini. Tidak ada data yang diubah."
        );
    }

    const activationDoc = matchingCodes[0];
    const activation = activationDoc.data() || {};
    const conflictingCode = codesForNewNim.docs.find(doc => doc.id !== activationDoc.id);
    if (conflictingCode) {
        throw new Error("NIM baru sudah dipakai record activationCodes lain. Periksa workbook aktivasi; tidak ada data yang diubah.");
    }

    const oldNims = new Set([
        String(profile.username || "").trim(),
        ...indexesByUid.docs.map(doc => String(doc.id).trim()),
        String(activation.nim || "").trim()
    ].filter(value => /^\d{5,24}$/.test(value)));

    const oldEmail = String(authUser.email || "").trim().toLowerCase();
    const newEmail = authAliasFromNim(newNim);
    const expectedEmails = new Set([newEmail, ...[...oldNims].map(authAliasFromNim)]);

    if (!oldEmail.endsWith(AUTH_SUFFIX) || !expectedEmails.has(oldEmail)) {
        throw new Error(
            "Email alias Authentication tidak cocok dengan NIM pada profil, indeks, atau activation code. Hentikan proses dan lakukan pemeriksaan manual."
        );
    }

    const authConflict = await getUserByEmailOrNull(auth, newEmail);
    if (authConflict && authConflict.uid !== uid) {
        throw new Error("Alias login untuk NIM baru sudah dipakai akun lain. Tidak ada data yang diubah.");
    }

    console.log("\nProfil yang akan diperbaiki:");
    console.log("Nama :", fullName);
    console.log("NIM baru :", newNim);
    console.log("UID :", uid);
    console.log("NIM lama terdeteksi :", [...oldNims].join(", ") || "(tidak ditemukan)");
    console.log("\nUID dan kepemilikan scores tidak akan berubah.");

    const rl = readline.createInterface({ input, output });
    const phrase = "SYNC " + fullName + " " + newNim;
    const answer = await rl.question('\nKetik persis "' + phrase + '" untuk melanjutkan: ');
    rl.close();

    if (answer !== phrase) {
        console.log("Dibatalkan. Tidak ada data yang diubah.");
        return;
    }

    // Update Auth first. If the Firestore batch fails afterwards, rerunning
    // this script is safe because the new email alias is accepted as valid.
    if (oldEmail !== newEmail) {
        await auth.updateUser(uid, { email: newEmail });
    }

    const batch = db.batch();
    batch.update(targetDoc.ref, { username: newNim });
    batch.set(db.collection("nimIndex").doc(newNim), {
        uid,
        fullName,
        isActive: true
    });

    indexesByUid.docs.forEach(indexDoc => {
        if (indexDoc.id !== newNim) batch.delete(indexDoc.ref);
    });

    batch.update(activationDoc.ref, { nim: newNim });
    await batch.commit();

    console.log("\nBERHASIL: identitas akun telah disinkronkan.");
    console.log("- users.nim      :", newNim, "(sudah dikoreksi sebelumnya)");
    console.log("- users.username :", newNim);
    console.log("- nimIndex        : NIM baru dibuat; indeks lama milik UID ini dibersihkan");
    console.log("- Authentication  : email alias login diperbarui");
    console.log("- activationCodes : NIM pada kode redeemed diperbarui");
    console.log("- Firebase UID    : tetap sama");
    console.log("- scores          : tidak disentuh");
    console.log("\nCarmella selanjutnya login menggunakan NIM baru dan password yang sama.");
}

main().catch(error => {
    console.error("\nGAGAL:", error.message || error);
    process.exitCode = 1;
});
