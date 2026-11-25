#!/usr/bin/env node
"use strict";

/*
 * Read-only diagnostic for the STELLARS Academic Importer roster.
 * It does not write, update, or delete any Firestore/Auth data.
 *
 * Run from functions/:
 *   node diagnose-student-roster.js Danniel
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "class-web-7241e";
const AUTH_SUFFIX = "@class-web-7241e.firebaseapp.com";

function normalizeName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function normalizeNim(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function maskIdentifier(value) {
    const text = String(value || "");
    if (!text) return "(empty)";
    if (text.length <= 4) return "****";
    return "****" + text.slice(-4);
}

function authAliasFromNim(value) {
    const normalized = String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");
    return normalized ? normalized + AUTH_SUFFIX : "";
}

async function main() {
    const searchTerm = normalizeName(process.argv.slice(2).join(" ") || "Danniel");
    if (!searchTerm) throw new Error("Masukkan nama yang ingin diperiksa.");

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error("GOOGLE_APPLICATION_CREDENTIALS belum diarahkan ke service-account JSON.");
    }

    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
    const auth = getAuth();
    const db = getFirestore();

    const usersSnapshot = await db.collection("users").get();
    const eligibleRoles = new Set(["student", "admin", "superAdmin", "super_admin"]);
    const profiles = usersSnapshot.docs
        .map(doc => ({ ref: doc.ref, uid: doc.id, data: doc.data() || {} }))
        .filter(item => {
            const name = normalizeName(item.data.fullName);
            const username = normalizeName(item.data.username);
            return name.includes(searchTerm) || username.includes(searchTerm);
        });

    if (!profiles.length) {
        console.log("HASIL: Tidak ada profil users yang nama/username-nya mengandung:", searchTerm);
        console.log("Jumlah total profil users yang diperiksa:", usersSnapshot.size);
        return;
    }

    console.log("PROFIL COCOK:", profiles.length);
    console.log("Catatan: NIM/UID tidak ditampilkan penuh; diagnostik ini hanya membaca data.\n");

    for (const item of profiles) {
        const { uid, data } = item;
        const fullName = String(data.fullName || "");
        const nim = String(data.nim || "").trim();
        const username = String(data.username || "").trim();
        const role = String(data.role || "").trim();
        const isActive = data.isActive === true;
        const roleAllowed = eligibleRoles.has(role);
        const fullNameKey = normalizeName(fullName);
        const firstNameKey = fullNameKey.split(" ")[0] || "";

        const duplicateNimProfiles = nim
            ? usersSnapshot.docs.filter(doc => normalizeNim(doc.data()?.nim) === normalizeNim(nim))
            : [];

        const indexByUid = await db.collection("nimIndex").where("uid", "==", uid).get();
        const profileNimIndex = nim
            ? await db.collection("nimIndex").doc(nim).get()
            : null;
        const usernameNimIndex = username && username !== nim
            ? await db.collection("nimIndex").doc(username).get()
            : null;

        let authExists = false;
        let authAliasMatchesNim = false;
        let authAliasMatchesUsername = false;
        let authEmailIsStellarsAlias = false;
        try {
            const authUser = await auth.getUser(uid);
            authExists = true;
            const email = String(authUser.email || "").toLowerCase();
            authEmailIsStellarsAlias = email.endsWith(AUTH_SUFFIX);
            authAliasMatchesNim = !!nim && email === authAliasFromNim(nim);
            authAliasMatchesUsername = !!username && email === authAliasFromNim(username);
        } catch (error) {
            if (error.code !== "auth/user-not-found") throw error;
        }

        const redeemedCodes = await db.collection("activationCodes")
            .where("redeemedBy", "==", uid)
            .get();

        const codeDetails = redeemedCodes.docs.map(doc => {
            const code = doc.data() || {};
            return {
                status: String(code.status || ""),
                sameName: normalizeName(code.fullName) === fullNameKey,
                sameNim: normalizeNim(code.nim) === normalizeNim(nim),
                nimMasked: maskIdentifier(code.nim)
            };
        });

        const sameFirstNameProfiles = usersSnapshot.docs.filter(doc => {
            const profile = doc.data() || {};
            const name = normalizeName(profile.fullName);
            const firstName = name.split(" ")[0] || "";
            return profile.isActive === true &&
                eligibleRoles.has(String(profile.role || "").trim()) &&
                firstName === firstNameKey;
        });

        console.log("--------------------------------------------------");
        console.log("Full name:", fullName || "(empty)");
        console.log("Role:", role || "(empty)");
        console.log("isActive:", isActive);
        console.log("Importer role allowed:", roleAllowed);
        console.log("Importer identity eligible:", isActive && roleAllowed && !!fullNameKey);
        console.log("NIM:", maskIdentifier(nim));
        console.log("Username:", maskIdentifier(username));
        console.log("NIM equals username:", normalizeNim(nim) === normalizeNim(username));
        console.log("NIM format valid:", /^\d{5,24}$/.test(nim));
        console.log("Duplicate profiles using this NIM:", duplicateNimProfiles.length);
        console.log("Active eligible accounts with same first name:", sameFirstNameProfiles.length);
        console.log("Firebase Auth account exists:", authExists);
        console.log("Firebase Auth alias is STELLARS alias:", authAliasIsStellarsAlias = authAliasIsStellarsAlias || authEmailIsStellarsAlias);
        console.log("Auth alias matches profile NIM:", authAliasMatchesNim);
        console.log("Auth alias matches username:", authAliasMatchesUsername);
        console.log("nimIndex documents pointing to this UID:", indexByUid.size);
        console.log("nimIndex at profile NIM exists:", !!profileNimIndex?.exists);
        console.log("nimIndex at profile NIM points to this UID:",
            !!profileNimIndex?.exists && String(profileNimIndex.data()?.uid || "") === uid);
        console.log("nimIndex at username exists:", !!usernameNimIndex?.exists);
        console.log("Redeemed activation records for UID:", codeDetails.length);
        console.log("Redeemed activation record checks:", JSON.stringify(codeDetails));
    }

    console.log("\nDIAGNOSTIC COMPLETE — READ ONLY. Tidak ada data yang diubah.");
}

main().catch(error => {
    console.error("\nDIAGNOSTIC FAILED:", error.message || error);
    process.exitCode = 1;
});
