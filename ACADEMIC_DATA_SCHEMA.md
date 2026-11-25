# STELLARS Academic Portal — Firestore Data Schema

This document is the reference schema for the Academic Portal branch.
It is not a list of hard-coded assessment categories. Assessment names and
categories are generated dynamically from the administrator's imported file.

## 1. `users/{uid}`

One profile per Firebase Authentication UID. The document ID must equal the
Firebase Auth UID.

Required fields:

- `fullName` — student's or administrator's full name.
- `username` — login username shown to the user.
- `nim` — student NIM; may be an empty string for a non-student admin.
- `role` — exactly `student`, `admin`, or `superAdmin`.
- `isActive` — boolean.
- `birthDate` — date string in `YYYY-MM-DD` format, editable by the account owner.
- `slogan` — personal slogan string up to 120 characters, editable by the account owner.

Optional fields:

- `activationCodeHash` — SHA-256 hash of the one-time activation code used at registration; present for self-registered students.
- `canPublish` — boolean. Only meaningful for an `admin`; grants publishing
  permission when true.

Example:

```js
{
  fullName: "Student Example",
  username: "student.example",
  nim: "1100000000",
  role: "student",
  isActive: true
}
```

Student profiles are created through the one-time activation flow described
below. Student self-registration is limited to the `student` role; admin and
super-admin roles remain provisioned through a trusted administrator process.
A user must never be able to edit their own role.

## 2. Student activation codes

Administrators import the activation workbook through the Academic Portal.
Each row contains a full name, NIM, and a unique high-entropy activation code.
The browser normalizes the code and stores only its SHA-256 hash as the
`activationCodes/{codeHash}` document ID.

Available activation documents contain:

```js
{
  fullName: "Student Example",
  nim: "1100000000",
  status: "available",
  createdAt: "Firestore Timestamp",
  createdBy: "admin-firebase-uid"
}
```

During registration, the student supplies the registered full name, NIM,
activation code, and a self-created password. Firebase Authentication uses
the NIM as the student's login identifier; the password is separate and is
never derived from the NIM. A Firestore batch atomically creates the student
profile and `nimIndex` entry while marking the activation code as redeemed
and binding it to the new Authentication UID. Firestore Rules prevent code
enumeration, unauthorised code creation, NIM duplication, and code reuse.

The original activation code is not stored in Firestore. The administrator
must keep the workbook private and distribute each code only to the matching
student.

## 3. `nimIndex/{nim}`

Private lookup index maintained by the trusted provisioning process.

```js
{
  uid: "firebase-auth-uid",
  fullName: "Student Example",
  isActive: true
}
```

Only administrators can read this collection. Students must not be able to
enumerate classmates' NIMs or account IDs.

## 4. `subjects/{subjectId}`

One document per subject.

```js
{
  subjectName: "Introduction to Accounting",
  subjectCode: "ACC101",
  isActive: true
}
```

## 5. `assessments/{assessmentId}`

One document per assessment component for a subject. The `category` and
`assessmentName` are dynamic strings derived from the uploaded file. Do not
restrict them to a fixed list.

Examples include Kuis 1, Tugas, UTC, UTS, UAS, Praktikum, and Presentasi,
but these examples are not an allowed-values list.

```js
{
  subjectId: "subject-document-id",
  subjectName: "Introduction to Accounting",
  assessmentName: "Kuis 1",
  category: "Kuis",
  maxScore: 100,
  isPublished: false,
  examDate: null,
  sourceUploadId: "upload-document-id",
  createdBy: "admin-firebase-uid",
  createdAt: "Firestore Timestamp"
}
```

## 6. `scores/{scoreId}`

One student's result for one assessment. The `studentId` is the student's
Firebase Authentication UID, not their name or NIM.

```js
{
  studentId: "student-firebase-uid",
  subjectId: "subject-document-id",
  subjectName: "Introduction to Accounting",
  assessmentId: "assessment-document-id",
  assessmentName: "Kuis 1",
  score: 87.5,
  maxScore: 100,
  isPublished: false,
  examDate: null,
  sourceUploadId: "upload-document-id",
  createdAt: "Firestore Timestamp",
  publishedAt: null
}
```

Rules:

- Scores may contain decimals.
- A score must be between 0 and its `maxScore`; `maxScore` cannot exceed 100.
- A blank cell must remain `null`, never be converted to zero.
- A score is visible to the student only when `isPublished == true`.
- The student dashboard first queries `publishedImports` with `status == "published"`, then queries scores by the student's own UID, the specific `sourceUploadId`, and `isPublished == true`.

## 7. `uploads/{uploadId}`

Admin-only import staging and review metadata. The original uploaded file is
not stored in Firestore or Firebase Storage.

Suggested fields:

- `fileName`
- `fileType`
- `status` — includes `processing`, `ready`, `failed`, `published`,
  `deleting`, and `deleted`.
- `uploadedBy` — admin UID.
- `createdAt`
- `subjectCount`
- `assessmentCount`
- `rowCount`
- `issueCount`
- `publishedAt`
- `deletedAt`, `deletedBy`, `deletedAssessmentCount`, and
  `deletedScoreCount` — deletion audit metadata.
- `deletionRequiresPublisher` — records whether publisher-level permission
  is required to resume an interrupted deletion.

The import history document is retained as an audit record after deletion.
The related assessment and score documents are removed. The subject catalogue
document is retained because it may be shared by other imports or used as a
course-level record.

## 8. `activityLogs/{logId}`

Admin-only audit trail. Suggested fields include `actorUid`, `action`,
`uploadId`, `createdAt`, and a short non-sensitive description.

## Publication flow

1. The administrator selects an Excel or text-based PDF file.
2. The browser extracts data and shows a review screen.
3. The administrator resolves unmatched students, duplicate rows, invalid
   values, and missing data.
4. Draft `assessments` and `scores` are saved with `isPublished: false`.
5. An authorized publisher marks the reviewed records as published.
6. Student accounts can read only their own published score records.

## Deletion flow

1. An active admin can delete a saved draft or a failed import. The operation
   removes every related assessment and score document identified by
   `sourceUploadId`.
2. Only a Super Admin or an admin with `canPublish: true` can delete a
   published import. Published assessment and score records are first
   withdrawn (`isPublished: false`) so students cannot see a partial result
   set while batched deletion is running.
3. The upload history record is not physically deleted. It is marked
   `deleting` while cleanup runs, then `deleted` after all related records
   are removed. If a batch fails, the admin can retry cleanup from history.
4. A successful deletion is recorded in `activityLogs`. Deleting an import
   does not delete the subject catalogue document.


## Browser importer behavior

The Academic Results workspace supports Excel workbooks (`.xlsx`, `.xls`),
CSV files, and PDFs that contain selectable text. Spreadsheet files are read
with SheetJS Community Edition 0.20.3. PDF text extraction uses Mozilla PDF.js
6.5.438. Scanned/image-only PDFs are not OCR-processed and must be converted
to a text-based or spreadsheet source before automatic import.

For a spreadsheet, the administrator selects one worksheet and identifies
the header row, student-name column, and NIM column. Every other non-metadata
column is detected as a potential assessment component. The administrator can
exclude non-score columns and set each component's maximum score. A worksheet
is imported as one subject; separate subject worksheets can be imported
separately.

Before saving, each included row is matched against active records in
`nimIndex`. Missing or unmatched NIMs, duplicate NIMs, and invalid scores
must be corrected or excluded. Name differences are shown as warnings for
manual review. Empty score cells remain `null`.

The original file is processed locally in the browser and is not uploaded to
Firestore or Firebase Storage. Firestore stores the import metadata, subject,
assessment components, and score documents. Imported scores remain
`isPublished: false` until an authorized publisher publishes the import.
Only `superAdmin` accounts and admins with `canPublish: true` can publish.

The Firestore Security Rules in `firestore.rules` must also be copied into
Firebase Console > Firestore Database > Rules. Committing that file to GitHub
does not deploy the rules to Firebase automatically.


## Personal results scoreboards

Student and administrator accounts use the same personal subject-card
scoreboard design, including subject/component summaries, score progress bars,
and publication badges.

Student accounts query scores only for their own Firebase Authentication UID
and only where `isPublished == true`. Students can search their own subject
and assessment names, filter by subject, and refresh their published results.

Administrator accounts additionally verify the NIM in the signed-in profile
against an active document ID in `nimIndex`. Results are loaded only when the
matched roster UID is identical to the signed-in Firebase Authentication UID.
The admin scoreboard then queries score documents for that UID only and can
show both Draft and Published status for the admin's own records. It does not
display classmates' records or list every user profile.

This logic is role-generic: both Super Admin accounts use the NIM and UID on
the currently signed-in profile. Each account must have an active matching
`nimIndex` entry before any personal result is displayed.


## Reliability and recovery safeguards

- Draft imports are written in Firestore batches and each score/assessment
  carries its `sourceUploadId`. If the browser stops during import, the upload
  can remain in `processing`; administrators can use **Recover Import** to
  remove any partial assessment and score documents, while retaining history.
- Failed imports can be deleted by querying all remaining documents by
  `sourceUploadId`. Repeating deletion processes only documents that remain.
  Deletion totals are retained on the upload record for the audit summary.
- Student score visibility is gated by both the score's `isPublished` flag
  and its parent upload's `status == "published"`. The importer publishes
  assessment/score batches first and changes the upload status to `published`
  only after all batches succeed. Partial publication therefore remains hidden
  from students. When deletion begins, the upload status changes to `deleting`,
  withdrawing student visibility before cleanup batches run.
- This visibility gate is enforced by Firestore Security Rules, not only by
  browser UI. The updated `firestore.rules` must be published in Firebase
  Console for the protection to take effect.
- Batch operations are not one Firestore transaction. If publishing fails,
  the upload remains `ready`; retrying Publish re-reads all related records
  and applies the published flag to the complete set. If cleanup fails, the
  upload remains `deleting` and can be resumed with **Retry Delete**.


## Published import manifests

Student visibility is gated by both `scores.isPublished == true` and a matching `publishedImports/{uploadId}.status == "published"` manifest. Students first query published manifests, then query their own scores separately for each `sourceUploadId`. The manifest contains only publication metadata and is moved to `withdrawing` before deletion begins. Older published uploads are backfilled with manifests when an administrator refreshes import history.
