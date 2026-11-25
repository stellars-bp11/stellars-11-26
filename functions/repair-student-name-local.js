#!/usr/bin/env node
"use strict";

/*
 * One-time, guarded name correction for a registered STELLARS student.
 *
 * It updates only:
 *   - users/{uid}.fullName
 *   - nimIndex documents pointing to the same UID
 *   - activationCodes records for the student's NIM
 *   - Firebase Authentication displayName
 *
 * It does NOT change the UID, login email, password, NIM, or scores.
 *
 * Run locally from functions/ with the service-account JSON stored OUTSIDE
 * the repository:
 *   node repair-student-name-local.js
 */

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "class-web-7241e";
const OLD_NAME = "Vincent Farellius";
const NEW_NAME = "Vincent Farrelius";

function normalizeName(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

async function main() {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error(
            "GOOGLE_APPLICATION_CREDENTIALS belum diatur. Arahkan ke service-account JSON yang disimpan di luar repository."
        );
    }

    initializeApp({
        credential: applicationDefault(),
        projectId: PROJECT_ID
    });

    const auth = getAuth();
    const db = getFirestore();

    // Exact-name lookup: never guess from a first name or a partial match.
    const oldProfiles = await db.collection("users")
        .where("fullName", "==", OLD_NAME)
        .get();

    if (oldProfiles.size !== 1) {
        throw new Error(
            "Harus ditemukan tepat satu users profile dengan nama persis '" +
            OLD_NAME + "'. Ditemukan: " + oldProfiles.size +
            ". Tidak ada data yang diubah."
        );
    }

    const profileDoc = oldProfiles.docs[0];
    const profile = profileDoc.data() || {};
    const uid = profileDoc.id;

    if (profile.isActive !== true ||
        !["student", "admin", "superAdmin", "super_admin"].includes(String(profile.role || ""))) {
        throw new Error("Profil target tidak aktif atau role tidak dikenali. Tidak ada data yang diubah.");
    }

    const duplicateNewName = await db.collection("users")
        .where("fullName", "==", NEW_NAME)
        .get();

    if (duplicateNewName.docs.some(doc => doc.id !== uid)) {
        throw new Error("Nama baru sudah dipakai profil users lain. Tidak ada data yang diubah.");
    }

    const nim = String(profile.nim || "").trim();
    if (!/^\d{5,24}$/.test(nim)) {
        throw new Error("NIM pada profil tidak valid. Tidak ada data yang diubah.");
    }

    const [authUser, indexesByUid, indexAtNim, activationByNim] = await Promise.all([
        auth.getUser(uid),
        db.collection("nimIndex").where("uid", "==", uid).get(),
        db.collection("nimIndex").doc(nim).get(),
        db.collection("activationCodes").where("nim", "==", nim).get()
    ]);

    if (!indexAtNim.exists || String(indexAtNim.data().uid || "") !== uid) {
        throw new Error("nimIndex untuk NIM profil tidak ada atau menunjuk ke akun lain. Tidak ada data yang diubah.");
    }
    if (indexesByUid.empty) {
        throw new Error("Tidak ditemukan dokumen nimIndex untuk UID target. Tidak ada data yang diubah.");
    }

    for (const indexDoc of indexesByUid.docs) {
        const currentName = String((indexDoc.data() || {}).fullName || "");
        if (normalizeName(currentName) !== normalizeName(OLD_NAME) &&
            normalizeName(currentName) !== normalizeName(NEW_NAME)) {
            throw new Error(
                "Nama di nimIndex/" + indexDoc.id +
                " tidak cocok dengan nama lama maupun nama baru. Tidak ada data yang diubah."
            );
        }
    }

    if (activationByNim.empty) {
        throw new Error("Tidak ditemukan activationCodes untuk NIM target. Tidak ada data yang diubah.");
    }

    for (const activationDoc of activationByNim.docs) {
        const activation = activationDoc.data() || {};
        if (normalizeName(activation.fullName) !== normalizeName(OLD_NAME) &&
            normalizeName(activation.fullName) !== normalizeName(NEW_NAME)) {
            throw new Error(
                "Nama pada activationCodes untuk NIM target tidak cocok. Tidak ada data yang diubah."
            );
        }
        if (activation.status === "redeemed" &&
            String(activation.redeemedBy || "") !== uid) {
            throw new Error("Activation code redeemed oleh UID lain. Tidak ada data yang diubah.");
        }
    }

    const authDisplayName = String(authUser.displayName || "");
    if (authDisplayName &&
        normalizeName(authDisplayName) !== normalizeName(OLD_NAME) &&
        normalizeName(authDisplayName) !== normalizeName(NEW_NAME)) {
        throw new Error("Firebase Auth displayName berbeda dari target; perlu pemeriksaan manual.");
    }

    console.log("\nTarget terverifikasi:");
    console.log("Nama lama :", OLD_NAME);
    console.log("Nama baru :", NEW_NAME);
    console.log("NIM       :", "****" + nim.slice(-4));
    console.log("UID       :", uid);
    console.log("nimIndex  :", indexesByUid.size, "dokumen");
    console.log("Activation:", activationByNim.size, "dokumen untuk NIM");
    console.log("\nUID, NIM, login email, password, dan scores tidak akan diubah.");

    const phrase = "RENAME " + OLD_NAME + " => " + NEW_NAME;
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('\nKetik persis "' + phrase + '" untuk melanjutkan: ');
    rl.close();

    if (answer !== phrase) {
        console.log("Dibatalkan. Tidak ada data yang diubah.");
        return;
    }

    // Update Auth first. If the Firestore batch fails afterwards, rerunning is safe:
    // the script accepts either the old or corrected Auth displayName.
    if (normalizeName(authDisplayName) !== normalizeName(NEW_NAME)) {
        await auth.updateUser(uid, { displayName: NEW_NAME });
    }

    const batch = db.batch();
    batch.update(profileDoc.ref, { fullName: NEW_NAME });

    for (const indexDoc of indexesByUid.docs) {
        batch.update(indexDoc.ref, { fullName: NEW_NAME });
    }

    for (const activationDoc of activationByNim.docs) {
        batch.update(activationDoc.ref, { fullName: NEW_NAME });
    }

    await batch.commit();

    console.log("\nBERHASIL: nama akun disinkronkan.");
    console.log("- users.fullName       :", NEW_NAME);
    console.log("- nimIndex.fullName    :", indexesByUid.size, "dokumen diperbarui");
    console.log("- activationCodes.fullName :", activationByNim.size, "dokumen diperbarui");
    console.log("- Auth displayName     :", NEW_NAME);
    console.log("- Firebase UID         : tetap");
    console.log("- NIM / login email    : tetap");
    console.log("- Password             : tetap");
    console.log("- Scores               : tidak disentuh");
}

main().catch(error => {
    console.error("\nGAGAL:", error.message || error);
    process.exitCode = 1;
});
