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