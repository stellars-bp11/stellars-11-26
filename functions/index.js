const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

initializeApp();

const db = getFirestore();

/**
 * Remove every STELLARS Radio song submitted before the current Jakarta day.
 * The live website only reads today's date-keyed subcollection; this scheduled
 * cleanup permanently deletes older documents so no archive is retained.
 */
exports.clearExpiredRadioSongs = onSchedule(
    {
        schedule: "5 0 * * *",
        timeZone: "Asia/Jakarta",
        region: "asia-southeast2",
        memory: "256MiB",
        timeoutSeconds: 540
    },
    async () => {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
        const todayKey = `${date.year}-${date.month}-${date.day}`;

        let totalDeleted = 0;

        while (true) {
            const expired = await db.collectionGroup("songs")
                .where("dayKey", "<", todayKey)
                .orderBy("dayKey", "asc")
                .limit(400)
                .get();

            if (expired.empty) break;

            const batch = db.batch();
            expired.docs.forEach(document => batch.delete(document.ref));
            await batch.commit();

            totalDeleted += expired.size;
            if (expired.size < 400) break;
        }

        logger.info("STELLARS Radio daily cleanup completed.", {
            todayKey,
            deletedSubmissions: totalDeleted
        });
    }
);

/**
 * One-time STELLARS account reset.
 *
 * Keeps only Jasper Vladino Alvis and Quinetta Aulya Winata as active
 * Super Admins. Deletes all other STELLARS Auth users, their user profiles,
 * student NIM index entries, and previous student activation codes.
 *
 * It refuses to run if score documents already exist. It never deletes
 * academic scores, assessments, uploads, published-import manifests, or
 * non-STELLARS Auth users.
 */
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const RESET_SUPER_ADMINS = [
    "jasper vladino alvis",
    "quinetta aulya winata"
];
const STELLARS_AUTH_SUFFIX = "@class-web-7241e.firebaseapp.com";

function normalizeAccountName(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .split(" ").filter(Boolean).join(" ");
}

async function listAllAuthUsers() {
    const users = [];
    let pageToken;
    do {
        const page = await getAuth().listUsers(1000, pageToken);
        users.push(...page.users);
        pageToken = page.pageToken;
    } while (pageToken);
    return users;
}

async function commitInChunks(operations, chunkSize = 400) {
    for (let index = 0; index < operations.length; index += chunkSize) {
        const batch = db.batch();
        operations.slice(index, index + chunkSize).forEach(operation => {
            if (operation.type === "delete") batch.delete(operation.ref);
            else if (operation.type === "update") batch.update(operation.ref, operation.data);
            else batch.set(operation.ref, operation.data, operation.options || {});
        });
        await batch.commit();
    }
}

exports.resetStellarsAccounts = onCall(
    {
        region: "asia-southeast2",
        timeoutSeconds: 540,
        memory: "512MiB"
    },
    async request => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Please sign in with a STELLARS administrator account.");
        }
        if (request.data?.confirmation !== "RESET_STELLARS_ACCOUNTS") {
            throw new HttpsError("failed-precondition", "The reset confirmation phrase is missing.");
        }

        const resetMarkerRef = db.collection("systemOperations").doc("initialStellarsAccountReset");
        const resetMarkerSnapshot = await resetMarkerRef.get();
        if (resetMarkerSnapshot.exists && resetMarkerSnapshot.data()?.status === "completed") {
            throw new HttpsError(
                "failed-precondition",
                "Initial account reset has already been completed. This operation cannot be run again."
            );
        }

        const usersRef = db.collection("users");
        const usersSnapshot = await usersRef.get();
        const profilesByName = new Map();

        usersSnapshot.forEach(profileDoc => {
            const profile = profileDoc.data() || {};
            const key = normalizeAccountName(profile.fullName);
            if (RESET_SUPER_ADMINS.includes(key)) {
                if (!profilesByName.has(key)) profilesByName.set(key, []);
                profilesByName.get(key).push({ ref: profileDoc.ref, uid: profileDoc.id, data: profile });
            }
        });

        const keepProfiles = RESET_SUPER_ADMINS.map(name => {
            const matches = profilesByName.get(name) || [];
            if (matches.length !== 1) {
                throw new HttpsError(
                    "failed-precondition",
                    "Reset dibatalkan: profil untuk " + name +
                    " harus ditemukan tepat satu kali. Tidak ada data yang dihapus."
                );
            }
            const profile = matches[0];
            if (profile.data.isActive !== true ||
                !["student", "admin", "superAdmin", "super_admin"].includes(profile.data.role)) {
                throw new HttpsError(
                    "failed-precondition",
                    "Reset dibatalkan: akun " + name +
                    " harus aktif dan memiliki role administrator. Tidak ada data yang dihapus."
                );
            }
            return profile;
        });

        const callerProfile = keepProfiles.find(profile => profile.uid === request.auth.uid);
        if (!callerProfile) {
            throw new HttpsError(
                "permission-denied",
                "Hanya Jasper Vladino Alvis atau Quinetta Aulya Winata yang dapat menjalankan reset ini."
            );
        }

        // Safety gate: this reset must not run after academic scores exist.
        const existingScores = await db.collection("scores").limit(1).get();
        if (!existingScores.empty) {
            throw new HttpsError(
                "failed-precondition",
                "Reset dibatalkan karena sudah ada data scores. Data akademik tidak disentuh."
            );
        }

        const keepUids = new Set(keepProfiles.map(profile => profile.uid));
        try {
            await Promise.all(keepProfiles.map(profile => getAuth().getUser(profile.uid)));
        } catch (error) {
            throw new HttpsError(
                "failed-precondition",
                "Reset dibatalkan: kedua akun Super Admin harus masih tersedia di Firebase Authentication. Tidak ada akun mahasiswa yang dihapus."
            );
        }

        const allAuthUsers = await listAllAuthUsers();
        const oldStellarsAuthUsers = allAuthUsers.filter(user =>
            String(user.email || "").toLowerCase().endsWith(STELLARS_AUTH_SUFFIX) &&
            !keepUids.has(user.uid)
        );

        // If Auth deletion partially fails, stop before clearing NIM indexes.
        // The function is safe to retry: users already deleted will not be listed again.
        if (oldStellarsAuthUsers.length) {
            const deleteResult = await getAuth().deleteUsers(oldStellarsAuthUsers.map(user => user.uid));
            if (deleteResult.failureCount > 0) {
                throw new HttpsError(
                    "failed-precondition",
                    "Sebagian akun lama berhasil dihapus, tetapi " +
                    deleteResult.failureCount +
                    " akun gagal dihapus. Jalankan reset sekali lagi untuk menyelesaikan proses."
                );
            }
        }

        const [nimIndexSnapshot, activationCodesSnapshot] = await Promise.all([
            db.collection("nimIndex").get(),
            db.collection("activationCodes").get()
        ]);

        const keepAdminNims = new Set(
            keepProfiles
                .map(profile => String(profile.data.nim || "").trim())
                .filter(Boolean)
        );
        const keepAdminNames = new Set(RESET_SUPER_ADMINS);
        const operations = [];

        usersSnapshot.forEach(profileDoc => {
            if (!keepUids.has(profileDoc.id)) {
                operations.push({ type: "delete", ref: profileDoc.ref });
            }
        });

        nimIndexSnapshot.forEach(nimDoc => {
            if (!keepAdminNims.has(String(nimDoc.id).trim())) {
                operations.push({ type: "delete", ref: nimDoc.ref });
            }
        });

        let deletedActivationCodes = 0;

        activationCodesSnapshot.forEach(codeDoc => {
            const codeData = codeDoc.data() || {};
            const isSuperAdminCode =
                keepAdminNims.has(String(codeData.nim || "").trim()) ||
                keepAdminNames.has(normalizeAccountName(codeData.fullName));
            if (isSuperAdminCode) return;

            operations.push({ type: "delete", ref: codeDoc.ref });
            deletedActivationCodes += 1;
        });

        keepProfiles.forEach(profile => {
            operations.push({
                type: "update",
                ref: profile.ref,
                data: { role: "superAdmin", isActive: true }
            });

            const nim = String(profile.data.nim || "").trim();
            const fullName = String(profile.data.fullName || "").trim();
            if (nim) {
                operations.push({
                    type: "set",
                    ref: db.collection("nimIndex").doc(nim),
                    data: {
                        uid: profile.uid,
                        fullName,
                        isActive: true
                    }
                });
            }
        });

        await commitInChunks(operations);
        await resetMarkerRef.set({
            status: "completed",
            completedAt: new Date(),
            completedBy: request.auth.uid,
            keptSuperAdminUids: keepProfiles.map(profile => profile.uid)
        });

        logger.warn("STELLARS account reset completed.", {
            requestedBy: request.auth.uid,
            keptSuperAdmins: keepProfiles.map(profile => profile.data.fullName),
            deletedAuthUsers: oldStellarsAuthUsers.length,
            deletedUserProfiles: usersSnapshot.size - keepProfiles.length,
            deletedNimIndexes: nimIndexSnapshot.docs.filter(doc => !keepAdminNims.has(String(doc.id).trim())).length,
            deletedActivationCodes
        });

        return {
            success: true,
            keptSuperAdmins: keepProfiles.map(profile => profile.data.fullName),
            deletedAuthUsers: oldStellarsAuthUsers.length,
            deletedUserProfiles: usersSnapshot.size - keepProfiles.length,
            deletedNimIndexes: nimIndexSnapshot.docs.filter(doc => !keepAdminNims.has(String(doc.id).trim())).length,
            deletedActivationCodes,
            message: "Old STELLARS student accounts and activation codes have been reset. The two Super Admin accounts were preserved."
        };
    }
);


/**
 * Correct a student's NIM after a Super Admin has verified and updated
 * users/{uid}.nim to the official NIM. The Firebase UID and score ownership
 * remain unchanged. This callable synchronizes the login alias, username,
 * nimIndex, and the redeemed activation record for that same account.
 */
function studentAuthAliasFromNim(value) {
    const normalized = String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    if (!normalized) {
        throw new HttpsError("invalid-argument", "NIM tidak valid untuk membentuk alias login.");
    }
    return normalized + STELLARS_AUTH_SUFFIX;
}

exports.repairStudentNim = onCall(
    {
        region: "asia-southeast2",
        timeoutSeconds: 120,
        memory: "256MiB"
    },
    async request => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Silakan login sebagai Super Admin STELLARS.");
        }
        if (request.data?.confirmation !== "SYNC_STUDENT_NIM") {
            throw new HttpsError("failed-precondition", "Konfirmasi sinkronisasi tidak valid.");
        }

        const callerSnapshot = await db.collection("users").doc(request.auth.uid).get();
        const caller = callerSnapshot.exists ? callerSnapshot.data() || {} : {};
        if (caller.isActive !== true || !["superAdmin", "super_admin"].includes(caller.role)) {
            throw new HttpsError("permission-denied", "Hanya Super Admin aktif yang boleh memperbaiki NIM akun.");
        }

        const newNim = String(request.data?.newNim || "").trim();
        if (!/^\d{5,24}$/.test(newNim)) {
            throw new HttpsError("invalid-argument", "Masukkan NIM baru yang benar (5–24 digit).");
        }

        // The profile's nim field was intentionally corrected first in
        // Firestore. Locate exactly one active student with that NIM.
        const targetSnapshot = await db.collection("users").where("nim", "==", newNim).get();
        if (targetSnapshot.size !== 1) {
            throw new HttpsError(
                "failed-precondition",
                "Harus ditemukan tepat satu profil dengan NIM tersebut. Periksa users.nim dan pastikan tidak ada NIM duplikat."
            );
        }

        const targetDoc = targetSnapshot.docs[0];
        const target = targetDoc.data() || {};
        const targetUid = targetDoc.id;
        if (targetUid === request.auth.uid) {
            throw new HttpsError("failed-precondition", "NIM yang dimasukkan mengarah ke akun Super Admin, bukan akun siswa.");
        }
        if (target.role !== "student" || target.isActive !== true) {
            throw new HttpsError("failed-precondition", "Profil dengan NIM tersebut bukan akun siswa aktif.");
        }

        const fullName = String(target.fullName || "").trim();
        if (!fullName) {
            throw new HttpsError("failed-precondition", "Profil siswa tidak memiliki nama lengkap.");
        }

        const [targetAuthUser, indexesByUid, redeemedCodes, newIndexSnapshot] = await Promise.all([
            getAuth().getUser(targetUid),
            db.collection("nimIndex").where("uid", "==", targetUid).get(),
            db.collection("activationCodes").where("redeemedBy", "==", targetUid).get(),
            db.collection("nimIndex").doc(newNim).get()
        ]);

        if (newIndexSnapshot.exists && String(newIndexSnapshot.data()?.uid || "") !== targetUid) {
            throw new HttpsError("already-exists", "NIM baru sudah terhubung ke akun lain. Tidak ada data yang diubah.");
        }

        const matchingActivationCodes = redeemedCodes.docs.filter(codeDoc => {
            const code = codeDoc.data() || {};
            return code.status === "redeemed" &&
                normalizeAccountName(code.fullName) === normalizeAccountName(fullName);
        });
        if (matchingActivationCodes.length !== 1) {
            throw new HttpsError(
                "failed-precondition",
                "Harus ditemukan tepat satu kode aktivasi redeemed yang terhubung ke UID dan nama siswa ini. Tidak ada data yang diubah."
            );
        }

        const activationDoc = matchingActivationCodes[0];
        const activation = activationDoc.data() || {};
        const oldNims = new Set([
            String(target.username || "").trim(),
            ...indexesByUid.docs.map(indexDoc => String(indexDoc.id).trim()),
            String(activation.nim || "").trim()
        ].filter(value => /^\d{5,24}$/.test(value)));

        const expectedAliases = new Set([studentAuthAliasFromNim(newNim)]);
        oldNims.forEach(oldNim => expectedAliases.add(studentAuthAliasFromNim(oldNim)));

        const currentEmail = String(targetAuthUser.email || "").trim().toLowerCase();
        if (!currentEmail.endsWith(STELLARS_AUTH_SUFFIX) || !expectedAliases.has(currentEmail)) {
            throw new HttpsError(
                "failed-precondition",
                "Email alias Firebase Authentication tidak cocok dengan NIM lama maupun NIM baru. Hentikan proses dan periksa akun secara manual."
            );
        }

        const newEmail = studentAuthAliasFromNim(newNim);
        try {
            const existingAuthUser = await getAuth().getUserByEmail(newEmail);
            if (existingAuthUser.uid !== targetUid) {
                throw new HttpsError("already-exists", "Alias login untuk NIM baru sudah dipakai akun lain.");
            }
        } catch (error) {
            if (error instanceof HttpsError) throw error;
            if (error.code !== "auth/user-not-found") throw error;
        }

        // Check any index document named after the previous username before
        // changing Authentication. A collision aborts the entire operation.
        const previousUsername = String(target.username || "").trim();
        if (previousUsername && previousUsername !== newNim) {
            const previousIndex = await db.collection("nimIndex").doc(previousUsername).get();
            if (previousIndex.exists &&
                String(previousIndex.data()?.uid || "") !== targetUid) {
                throw new HttpsError(
                    "already-exists",
                    "NIM lama pada nimIndex ternyata milik akun lain. Tidak ada data yang diubah."
                );
            }
        }

        // Updating email first is retry-safe: if the Firestore batch later
        // fails, a second call accepts either this new alias or the old one.
        if (currentEmail !== newEmail) {
            await getAuth().updateUser(targetUid, { email: newEmail });
        }

        const batch = db.batch();
        batch.update(targetDoc.ref, { username: newNim });
        batch.set(db.collection("nimIndex").doc(newNim), {
            uid: targetUid,
            fullName,
            isActive: true
        });
        indexesByUid.docs.forEach(indexDoc => {
            if (indexDoc.id !== newNim) batch.delete(indexDoc.ref);
        });
        batch.update(activationDoc.ref, { nim: newNim });
        await batch.commit();

        logger.info("STELLARS student NIM synchronization completed.", {
            requestedBy: request.auth.uid,
            targetUid,
            removedOldNimIndexes: indexesByUid.docs.filter(indexDoc => indexDoc.id !== newNim).length
        });

        return {
            success: true,
            fullName,
            nim: newNim,
            loginAliasUpdated: currentEmail !== newEmail,
            message: "NIM, username, login alias, nimIndex, and redeemed activation record are synchronized. The Firebase UID and academic score ownership were preserved."
        };
    }
);
