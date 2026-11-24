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

Optional fields:

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

Profiles and roles are provisioned through a trusted process, not from the
browser. A user must never be able to edit their own role.

## 2. `nimIndex/{nim}`

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

## 3. `subjects/{subjectId}`

One document per subject.

```js
{
  subjectName: "Introduction to Accounting",
  subjectCode: "ACC101",
  isActive: true
}
```

## 4. `assessments/{assessmentId}`

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

## 5. `scores/{scoreId}`

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
- The student dashboard queries by their own UID and published status.

## 6. `uploads/{uploadId}`

Admin-only import staging and review metadata. The original uploaded file is
not stored in Firestore or Firebase Storage.

Suggested fields:

- `fileName`
- `fileType`
- `status` — for example `processing`, `needs_review`, `ready`,
  `published`, or `rejected`.
- `uploadedBy` — admin UID.
- `createdAt`
- `subjectCount`
- `assessmentCount`
- `rowCount`
- `issueCount`
- `publishedAt`

Parsed rows can be staged as subcollection documents later if required.

## 7. `activityLogs/{logId}`

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

The Firestore Security Rules in `firestore.rules` must also be copied into
Firebase Console > Firestore Database > Rules. Committing that file to GitHub
does not deploy the rules to Firebase automatically.
