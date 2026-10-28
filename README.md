# AI Mystery Room

A noir-style mystery game built with React, TypeScript, Express, MongoDB, and Gemini. The API owns the solution and only returns it after the player resolves the case.

## Run locally

1. Install Node.js 20+ and MongoDB (local or Atlas).
2. Copy `.env.example` to `server/.env` and set `MONGODB_URI` and a long `JWT_SECRET`. Keep `MOCK_AI=true` for deterministic local cases without an API key.
3. From the repository root run `npm install`, then `npm run dev`.
4. Open http://localhost:5173. The API listens on port 5000.

For live AI, set `MOCK_AI=false`, `GEMINI_API_KEY`, and the three model IDs after checking availability for your Google AI account. All provider calls stay on the server. `STORAGE_DIR` controls generated image storage.

## Scripts

`npm run dev`, `npm run build`, `npm run lint`, and `npm test` run the workspace tasks. Case generation is asynchronous and runs in the API process; use a persistent MongoDB and disk when deploying. This MVP does not include a durable job queue.

## Product rules

Cases are private to their creator, require an account, have one fixed culprit, and are checked against visible evidence before publication. The API DTO strips solution and clue internals while a case is ready. Generated evidence is fiction. CCTV is presented as still frames.

## Configuration

See `.env.example`. Gemini model IDs are intentionally not hardcoded. Never expose server environment values through the client build.
