# Firestore Security Specification (Credential-Capability Architecture, Tanpa Google Login)

## 1. Data Invariants
1. Default-deny catch-all (`/{document=**}`) denies all reads and writes unless explicitly authorized.
2. Public login-portal metadata (`/school_settings/main`, `/academic_settings/main`) permits single-document `get` only (`allow list: if false`) and restricts all writes atomically via `hasAdminWriteProof()`.
3. Full student directory (`/workspaces/{adminKey}/students/{studentId}`) contains PII (NISN, Nama, TTL) and is strictly isolated under a 256-bit SHA-256 admin capability key (`isAuthorizedAdminKey(adminKey)`). No top-level `/students` collection is exposed.
4. Student self-service login (`/transcripts/{tokenId}`) maps 1:1 to a cryptographic 64-char hex SHA-256 token of `NIS:NISN`. `allow list` is strictly `false` to make student enumeration/scraping impossible; `allow get` requires a valid 64-char hex `tokenId`. Writes require `hasAdminWriteProof()`.
5. Every `create` and `update` enforces `isValid[Entity](incoming())`, `hasAll`/`hasOnly` key allowlisting, strict string `.size()` bounds, `createdAt == request.time` on create, immutable `createdAt`, and `updatedAt == request.time`.

## 2. Dirty Dozen Attack Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated `list` on `/workspaces/wrongkey/students` -> Denied (`isAuthorizedAdminKey` fails).
2. Unauthenticated `list` on `/transcripts` -> Denied (`allow list: if false`).
3. Unauthenticated `list` on `/school_settings` or `/academic_settings` -> Denied (`allow list: if false`).
4. Unauthenticated `get` on `/transcripts/invalid_short_id` -> Denied (`isValidHexToken` fails).
5. Unauthenticated `update` on `/school_settings/main` without atomic `write_proof` in batch -> Denied (`hasAdminWriteProof()` fails).
6. Shadow field injection (`{ ...validStudent, isAdmin: true }`) on `/workspaces/{adminKey}/students` -> Denied (`keys().hasOnly` rejects).
7. Resource exhaustion (`nama` > 150 chars or `studentId` > 128 chars) -> Denied (`isValidId` and `.size()` fail).
8. Client-spoofed `createdAt` or `updatedAt` timestamp -> Denied (`request.time` equality fails).
9. Update attempting to mutate `createdAt` -> Denied (`incoming().createdAt == existing().createdAt` fails).
10. Invalid `status` value (`status: "HACKED"`) -> Denied (`status in ['LULUS', 'DITANGGUHKAN']` fails).
11. Unbounded `subjects` array (> 50 items) on `/academic_settings/main` -> Denied (`subjects.size() <= 50` fails).
12. `delete` on `/school_settings/main` or `/academic_settings/main` -> Denied (`allow delete: if false`).
