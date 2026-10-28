# AI Mystery Room — Specification Sheet

Version 1.0 · Status: Ready for build · Audience: Codex (implementing agent) and the project owner · 28 Oct 2026

## 0. How to Use This Spec

1. This document is the **single source of truth**. If code, a prompt, or a chat message disagrees with it, the spec wins. Update the spec first, then the code.
2. MUST / SHOULD / MAY follow RFC 2119. Every requirement has an ID (FR-, API-, AC-). Cite IDs in commit messages and test names.
3. Do not add features, endpoints, or dependencies that are not listed here. If something is missing, pick the simplest option consistent with this spec and record it in section 15.
4. Build in the order of section 14. A milestone is done only when lint, typecheck, tests, and a local run all pass.
5. Never hardcode secrets or Gemini model IDs; read them from env (section 12). Before implementing section 5, check Google's current Gemini API docs for the SDK (`@google/genai`), model IDs, structured JSON output, and image generation.

## 1. Product Overview

**One-liner.** The player types a short scenario (for example: a jewel disappears during a wedding at a hill-station resort). AI invents a complete fictional investigation: suspects, one hidden culprit, and a trail of fabricated evidence (WhatsApp-style chats, photos, CCTV footage). The player studies the evidence and accuses a suspect.

**Core loop.** Scenario → Generate → Investigate → Accuse → Reveal.

**Goals**
- G1: Every case has exactly one culprit and is solvable from the evidence the player can see.
- G2: Evidence looks authentic (chat UI, camera overlays, photo metadata).
- G3: The solution never reaches the browser before the case is resolved.
- G4: A playable case is ready in 60 seconds or less at p90 (medium difficulty, text evidence).

**Non-goals (v1):** multiplayer, generated video, native mobile apps, payments, public sharing, voice, languages other than English.

**Personas:** *Casual Player* wants a quick, fun puzzle (easy/medium). *Mystery Buff* wants hard cases with red herrings and cross-referencing.

## 2. Scope

| Priority | Features |
|---|---|
| P0 (MVP) | Auth; scenario → case generation; difficulty levels; chat, image, and CCTV evidence; suspect profiles; accusation; reveal with explanation; My Cases; input moderation; rate limits |
| P1 | Document evidence (call log, receipt, email); detective notebook; up to 3 hints; score |
| P2 | Real video clips; shareable cases; daily case; multiplayer |

Build P1 only after every P0 milestone passes.

## 3. User Flows

**A. Create and play**
1. A signed-in user opens *New Case*, enters a scenario (20–1000 chars), picks a difficulty (Easy / Medium / Hard), and submits.
2. The server validates and moderates the scenario, creates a Case with status `generating`, and returns 202.
3. The client shows a progress screen and polls status every 2 seconds. Stages shown: Building the story → Writing evidence → Checking solvability → Developing photos.
4. At `ready`, the user lands in the **Case Room**: briefing, suspect cards, and the evidence board.
5. The user opens evidence items and (P1) takes notes or asks for hints.
6. The user picks a suspect and confirms the accusation, with optional reasoning (max 500 chars).
7. The server checks the answer. Wrong: show 'Not quite' and attempts left. Correct, or out of attempts: the case becomes `resolved` and the **Reveal** page shows the culprit, motive, method, timeline, and key clues.

**B. Generation failure.** If generation fails after retries, status becomes `failed`. The UI shows a friendly error with a *Try again* button. A failed case does not count against the daily quota.

**C. Revisit.** *My Cases* lists the user's cases. Resolved cases open the Reveal page; in-progress cases reopen the Case Room.

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-A1 | Users MUST register and log in with email + password. Passwords are hashed with bcrypt (cost 12 or higher). |
| FR-A2 | Session = JWT in an httpOnly, SameSite=Lax cookie (Secure in production), 7-day expiry. |
| FR-C1 | A case is created from `scenario` (20–1000 chars) + `difficulty`. |
| FR-C2 | The scenario MUST pass moderation (section 11) before any generation call. |
| FR-C3 | Each user gets a limited number of generations per UTC day (default 5, env-configurable). |
| FR-G1 | Generation MUST follow the staged pipeline in section 5 and MUST be asynchronous. |
| FR-G2 | A case MUST have exactly one culprit, 3–6 suspects (by difficulty), and 6–16 evidence items. |
| FR-G3 | A case MUST pass the blind-solver check (5.4) before becoming `ready`. |
| FR-G4 | Image failures MUST NOT fail the case; the item falls back to a text placeholder. |
| FR-I1 | The Case Room MUST show the briefing, suspect cards, and an evidence board filterable by type and by suspect. |
| FR-I2 | Evidence MUST render per type (section 6): chat as chat bubbles, images with metadata, CCTV in a frame player. |
| FR-X1 | An accusation = `suspectId` + optional reasoning. Max attempts = `MAX_ACCUSATIONS` (default 2). |
| FR-X2 | Only the server decides correctness. |
| FR-X3 | After resolution, the Reveal page shows the solution details. |
| FR-S1 | The `solution` object and any `clueRole`, `clueNote`, or `imagePrompt` field MUST NOT appear in any API response while status is not `resolved`. |
| FR-S2 | All AI content is labeled 'AI-generated fiction' in the UI. |

## 5. AI Generation Pipeline

All Gemini calls go through one `GeminiService`, the only module that imports the SDK. With `MOCK_AI=true` it returns fixtures so tests and local dev need no API key.

### 5.1 Stages

| # | Stage | Input → Output | Model tier |
|---|---|---|---|
| 1 | Intake and moderation | scenario → `{allowed, reason, sanitizedScenario}` | fast text |
| 2 | Case Bible | sanitized scenario + difficulty → hidden truth JSON (5.2) | strong text |
| 3 | Evidence authoring | Case Bible → evidence items JSON (section 6) with clue annotations | strong text |
| 4 | Blind-solver check | player-visible data only → `{suspectId, confidence, reasoning}` | fast text |
| 5 | Image generation | every image prompt and CCTV frame prompt → image files | image model |
| 6 | Persist and publish | save; set `ready` after stage 4; images fill in asynchronously | none |

If stage 4 fails, regenerate stages 2–3 (feeding the solver's reasoning back as feedback), up to `MAX_REGENERATIONS` (default 2). After that, set status `failed`.

### 5.2 Case Bible (hidden truth, stage 2 output)

```ts
interface CaseBible {
  title: string; setting: string; briefing: string;          // briefing is player-visible
  suspects: {
    id: string; name: string; age: number; role: string; relationship: string;
    appearance: string; bio: string;                          // player-visible
    motive: string; means: string; opportunity: string;       // hidden
    claimedAlibi: string; alibiIsTrue: boolean; secret: string; // hidden
  }[];
  culpritId: string; method: string; motive: string;
  timeline: { time: string; event: string; knownBy: string[] }[];
  keyClueIdeas: string[]; redHerringIdeas: string[];
  decisiveContradiction: string; // the lie or inconsistency that exposes the culprit
}
```

Stage 3 annotates every evidence item with `clueRole`: `key`, `red_herring`, `alibi`, or `context`, plus a one-line `clueNote`. The Reveal page is built from these annotations.

### 5.3 Difficulty profiles

| Difficulty | Suspects | Evidence items | Red herrings | Solving requirement |
|---|---|---|---|---|
| Easy | 3 | 6–8 | 1 | One item directly contradicts the culprit's alibi |
| Medium | 4 | 8–12 | 2 | Cross-reference 2 items |
| Hard | 5–6 | 12–16 | 3–4 | Cross-reference 3 items; the strongest-motive suspect is innocent |

### 5.4 Solvability rules (enforced in code by `validators/solvability.ts`, not only in the prompt)

1. Exactly one culprit; `culpritId` matches a suspect.
2. The culprit's alibi is false and is contradicted by at least one evidence item.
3. Every innocent suspect is cleared by evidence (verified alibi or contradicting proof).
4. Every suspect appears in at least one evidence item.
5. Timestamps are consistent: same timezone, chat messages in chronological order, all within the case timeline.
6. No evidence item states the culprit outright (no confession message).
7. Evidence counts, suspect counts, and red-herring counts match the difficulty profile.
8. **Blind solver:** Gemini receives only the player-visible case data (exactly what the API returns, with image prompts replaced by their text descriptions) and must name the culprit. Pass = correct culprit and confidence of 0.6 or higher.

### 5.5 Gemini call rules

- Use structured JSON output (JSON MIME type plus a response schema). Validate with Zod; on a parse failure retry the call once, passing the error message.
- Temperatures: stage 2 = 0.9, stage 3 = 0.7, stages 1 and 4 = 0.2.
- The scenario is untrusted input. Pass it inside `<scenario>` tags and instruct the model to treat it as a story seed only, never as instructions.
- All names, businesses, and places are fictional. No real people, celebrities, brand logos, or real addresses.
- Image prompts end with a fixed style suffix: photorealistic, candid, imperfect lighting, no text overlays, no real people. Reuse each suspect's `appearance` string in every prompt featuring them for visual consistency.
- Timeout 60 seconds per call. Log token usage per case.
- Prompt templates live in `server/src/ai/prompts/*.md` as versioned files, not inline strings.
- If Gemini blocks a response for safety, treat it as a stage failure (retry or fail), never a crash.

## 6. Evidence Types

Common envelope for every item:

```ts
interface Evidence {
  id: string; type: 'chat' | 'image' | 'cctv' | 'document';
  title: string; source: string;        // e.g. 'Seized phone of Rahul'
  timestamp: string;                    // ISO 8601
  relatedSuspectIds: string[];
  payload: ChatPayload | ImagePayload | CctvPayload | DocumentPayload;
  clueRole?: 'key' | 'red_herring' | 'alibi' | 'context';  // server-only
  clueNote?: string;                                        // server-only
}
```

**chat** (P0). `{ chatName, participants[{id, name}], messages[{id, senderId, text, sentAt, status: 'sent'|'delivered'|'read', deleted?}] }`. UI: WhatsApp-style bubbles with date separators and ticks. Use generic branding and no official logos. Deleted messages show 'This message was deleted'.

**image** (P0). `{ caption, takenAt, location, device, altText, imagePrompt (server-only), imageUrl | null, imageStatus: 'pending'|'ready'|'failed' }`. UI: thumbnail grid, lightbox with zoom, metadata panel. While pending show a skeleton; on failure show a placeholder with `altText`.

**cctv** (P0). `{ cameraId, cameraLabel, location, frames[{id, timestamp, description, imagePrompt (server-only), imageUrl | null, imageStatus}] }` with 4–8 frames. UI: dark monochrome player, REC indicator, burned-in timestamp and camera label, previous/next/scrubber, optional autoplay at 1 frame per second. See assumption A1.

**document** (P1). `{ kind: 'call_log'|'receipt'|'email'|'note', rows? , body? }`. UI: simple card or table.

## 7. Data Model (MongoDB + Mongoose)

```ts
User { _id, email (unique, lowercase), passwordHash, displayName, createdAt }

Case {
  _id, userId (indexed), scenario, difficulty: 'easy'|'medium'|'hard',
  status: 'generating'|'ready'|'resolved'|'failed',
  progress: { stage: 'story'|'evidence'|'validation'|'images'|'done', percent: number },
  title, briefing,                               // player-visible
  suspects: [{ id, name, age, role, relationship, appearance, bio, avatarUrl }], // player-visible
  evidence: [Evidence],                          // server-only fields stripped in the DTO
  solution: {                                    // select:false, returned only when resolved
    culpritId, motive, method, timeline[], decisiveContradiction, explanation,
    suspectTruth[{ suspectId, motive, means, opportunity, claimedAlibi, alibiIsTrue, secret }]
  },
  attempts: [{ suspectId, reasoning, correct, at }],
  hintsUsed: number, notes: string, score: number | null,   // P1 fields
  generationMeta: { regenerations, models, tokenUsage, error? },
  createdAt, updatedAt, resolvedAt
}
```

Indexes: `{ userId: 1, createdAt: -1 }` and `{ userId: 1, status: 1 }`. The daily quota is computed from cases created since UTC midnight (no extra collection). Suspects stored for players never contain hidden fields; hidden truth lives only in `solution`.

## 8. REST API

Base path `/api`, JSON only. Errors use `{ error: { code, message, details? } }`. All bodies validated with Zod. Auth via cookie.

| ID | Endpoint | Notes | Success |
|---|---|---|---|
| API-1 | `POST /auth/register` | `{ email, password (8+ chars), displayName }` | 201 `{ user }` |
| API-2 | `POST /auth/login` | `{ email, password }` | 200 `{ user }` |
| API-3 | `POST /auth/logout` | | 204 |
| API-4 | `GET /auth/me` | | 200 `{ user }` |
| API-5 | `POST /cases` | `{ scenario, difficulty }`. Errors: 400 validation, 422 `moderation_rejected`, 429 `quota_exceeded` | 202 `{ caseId, status }` |
| API-6 | `GET /cases/:id/status` | polled by the client | 200 `{ status, progress, error? }` |
| API-7 | `GET /cases` | the user's cases | 200 `{ cases[{ id, title, difficulty, status, createdAt, score }] }` |
| API-8 | `GET /cases/:id` | player-safe DTO; 404 if not owner | 200 `{ case }` |
| API-9 | `POST /cases/:id/accuse` | `{ suspectId, reasoning? }`. 409 if case is not `ready` | 200 `{ correct, attemptsLeft, resolved, solution? }` |
| API-10 | `POST /cases/:id/retry` | only for `failed` cases | 202 |
| API-11 | `DELETE /cases/:id` | also deletes stored images | 204 |
| API-12 | `GET /media/:caseId/:file` | owner-checked image bytes | 200 |
| API-13 | `GET /health` | | 200 |
| API-14 (P1) | `PUT /cases/:id/notes` | `{ notes }` | 200 |
| API-15 (P1) | `POST /cases/:id/hint` | max 3 | 200 `{ hint, hintsLeft }` |

The `solution` field in API-9 appears only when `resolved` is true.

## 9. Frontend

**Stack:** React 18 + Vite, TypeScript (strict), React Router, TanStack Query, Tailwind CSS, Axios.

| Route | Page |
|---|---|
| `/` | Landing: pitch, example scenarios, call to action |
| `/login`, `/register` | Auth forms |
| `/cases` | My Cases list |
| `/cases/new` | Scenario form: textarea with character counter, difficulty picker, example prompts |
| `/cases/:id` | Renders by status: Generating (progress stepper), Case Room (`ready`), Reveal (`resolved`), Error with retry (`failed`) |

**Components:** `AppShell`, `ScenarioForm`, `DifficultyPicker`, `ProgressStepper`, `CaseBriefing`, `SuspectCard`, `EvidenceBoard`, `EvidenceFilters`, `ChatViewer`, `ImageViewer`, `CctvPlayer`, `AccuseModal`, `RevealView`, `AiDisclaimerBadge`. P1: `DocumentViewer`, `Notebook`, `HintButton`.

**UX requirements**
- Dark 'noir' theme with an amber accent; fully responsive down to 360 px width.
- Keyboard accessible, visible focus states, WCAG AA contrast, alt text for every image.
- Skeleton loaders, empty states, and error states on every data view.
- Accusing requires a confirmation dialog that shows the chosen suspect and remaining attempts.
- AI-generated text is rendered as plain text (never `dangerouslySetInnerHTML`).

## 10. Backend Structure

Monorepo with npm workspaces:

```
/server/src
  app.ts, server.ts
  config/env.ts                 # Zod-validated env
  models/User.ts, Case.ts
  modules/auth, cases, media    # routes, controllers, services
  ai/GeminiService.ts
  ai/pipeline/intake.ts, bible.ts, evidence.ts, solver.ts, images.ts
  ai/prompts/*.md
  ai/schemas/*.ts               # Zod schemas mirroring section 5.2 and 6
  ai/validators/solvability.ts
  jobs/generateCase.ts          # in-process async runner
  storage/StorageProvider.ts, LocalDiskProvider.ts
  middleware/auth, validate, rateLimit, error
/client/src  pages, components, api, hooks
```

**Libraries.** Server: express, mongoose, zod, bcrypt, jsonwebtoken, cookie-parser, helmet, cors, express-rate-limit, pino, `@google/genai`. Dev: vitest, supertest, mongodb-memory-server, eslint, prettier. Client: vitest, React Testing Library.

**Job runner.** Generation runs in-process after the 202 response. Progress is written to the Case document. On server boot, any case stuck in `generating` for more than 10 minutes is marked `failed`. Images are generated after the case is `ready`, updating each item's `imageStatus` as they complete.

## 11. Security, Safety, and Abuse Controls

- **Moderation (stage 1).** Reject scenarios with sexual content, harm to minors, graphic gore, hate, self-harm instructions, real named people, or real unresolved crimes. Return 422 with a friendly reason. Tone is PG-13 whodunit: theft, fraud, sabotage, disappearance, or off-screen murder with no graphic detail.
- **Prompt injection.** See 5.5. Also never execute or render AI output as code or HTML.
- **Authorization.** Every case and media route checks that the case belongs to the requesting user; otherwise return 404.
- **Rate limits.** Global 100 requests per 15 minutes per IP; auth routes 10 per 15 minutes; accuse 20 per minute; case creation per FR-C3.
- **Hardening.** helmet, CORS allowlist (`CLIENT_ORIGIN`), request body limit 100 kb, `GEMINI_API_KEY` server-side only.
- **Privacy.** No scenario text or PII in info-level logs. Deleting a case deletes its images.

## 12. Configuration (`.env.example`)

```
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/ai-mystery-room
JWT_SECRET=change-me
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=      # strong text model id (verify in Gemini docs)
GEMINI_FAST_MODEL=      # fast, cheap model id for moderation and solver
GEMINI_IMAGE_MODEL=     # image-capable model id
MOCK_AI=false
DAILY_CASE_LIMIT=5
MAX_ACCUSATIONS=2
MAX_REGENERATIONS=2
STORAGE_DIR=./storage
```

The server MUST refuse to boot if a required variable is missing (the three Gemini variables and the API key are optional when `MOCK_AI=true`).

## 13. Testing and Acceptance

**Unit:** each solvability rule in 5.4, the DTO sanitizer, Zod schemas, score calculation.
**Integration** (Supertest + mongodb-memory-server, `MOCK_AI=true`): auth, quota, create → poll → ready, wrong and right accusations, resolve and reveal, owner isolation.
**Frontend:** render each evidence type from fixtures; the accuse flow.

| ID | Acceptance criterion |
|---|---|
| AC-1 | Given a `ready` case, `GET /cases/:id` returns JSON containing no key named `solution`, `clueRole`, `clueNote`, `imagePrompt`, or `culpritId` at any depth (automated test). |
| AC-2 | Given a `ready` case, one wrong accusation returns `correct:false`, `attemptsLeft:1`, and no solution. |
| AC-3 | Given the correct suspect, the response has `resolved:true` and includes the solution. |
| AC-4 | Given a scenario rejected by moderation, no generation calls are made and no quota is consumed. |
| AC-5 | Given an image generation failure, the case still reaches `ready` and the UI shows a placeholder with alt text. |
| AC-6 | Given the daily limit already used, the next creation returns 429. |
| AC-7 | Given a server restart mid-generation, the case is marked `failed` within 10 minutes and can be retried. |
| AC-8 | Ten mock fixtures per difficulty all pass the solvability validator; deliberately broken fixtures each fail on the intended rule. |

**Definition of done:** lint and typecheck clean; tests pass; README with run steps; `.env.example` current; commits reference spec IDs.

## 14. Build Milestones

| # | Milestone | Covers |
|---|---|---|
| M0 | Scaffolding: monorepo, env validation, health route, lint/test scripts | API-13 |
| M1 | Auth | FR-A1, FR-A2, API-1 to API-4 |
| M2 | Case model, create/status/list/get with `MOCK_AI`, DTO sanitizer | FR-C1, FR-C3, API-5 to API-8, AC-1, AC-6 |
| M3 | Real text pipeline: GeminiService, stages 1–4, solvability validator | FR-G1 to FR-G3, AC-4, AC-7, AC-8 |
| M4 | Case Room UI and evidence viewers | FR-I1, FR-I2 |
| M5 | Accuse and Reveal | FR-X1 to FR-X3, API-9, AC-2, AC-3 |
| M6 | Image generation, storage, fallbacks | FR-G4, API-12, AC-5 |
| M7 | Hardening: rate limits, moderation polish, accessibility, README | FR-S1, FR-S2, FR-C2 |
| M8 | P1 features: documents, notebook, hints, score | API-14, API-15 |

## 15. Assumptions and Open Questions

**Assumptions (change here first, then the code):**
- **A1.** A CCTV 'recording' is a sequence of AI-generated stills shown in a camera-style player, not real video, because video generation is slow and costly. Video clips are P2.
- **A2.** TypeScript is used on both client and server. It can be swapped for plain JavaScript if preferred.
- **A3.** No Redis or job queue in v1; generation runs in-process. Move to a queue (for example BullMQ) before running multiple server instances.
- **A4.** Images are stored on local disk behind `StorageProvider`. Swap in an S3-compatible provider before deploying to a host with ephemeral disk.
- **A5.** English only; an account is required to play.
- **A6.** Gemini model IDs are supplied through env and verified against current Google docs at build time.

**Open questions:**
- **Q1.** Scoring formula (P1). Default proposal: `max(0, 1000 - 300 x wrongAttempts - 100 x hintsUsed)`.
- **Q2.** Should guests be able to play one case without signing up?
- **Q3.** Hosting target for the client, server, and image storage?