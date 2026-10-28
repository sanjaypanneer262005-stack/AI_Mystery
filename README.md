# AI Mystery Room

AI Mystery Room is a noir detective game built with React/Vite, Express, MongoDB, and Gemini. The server owns the culprit and private solution; the client receives them only after a case is resolved.

## Deploy with MongoDB Atlas + Render + Vercel

### 1. Rotate local credentials first

The local `.env` file contains credentials. Do not commit it. Rotate the MongoDB database password and Gemini API key in their respective dashboards before deploying, then replace the values in your local `.env`. `.gitignore` excludes environment files.

### 2. Create the database

Create a MongoDB Atlas cluster, database user, and Network Access rule for Render. Copy the `mongodb+srv://.../ai-mystery-room` connection string for `MONGODB_URI`.

### 3. Deploy the API to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository. Render reads `render.yaml`.
3. Set `MONGODB_URI`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_FAST_MODEL`, and `GEMINI_IMAGE_MODEL`.
4. Keep `MOCK_AI=false` for Gemini-backed cases, or use `true` while validating deployment without a Gemini key.
5. Open `https://YOUR-API.onrender.com/api/health`; it should return `{ "status": "ok" }`.

Render supplies `PORT` automatically. The server listens on `0.0.0.0` and has a production `start` script.

### 4. Deploy the client to Vercel

1. Import the repository into Vercel and set the project root to `client`.
2. Use build command `npm run build` and output directory `dist`.
3. Add `VITE_API_URL=https://YOUR-API.onrender.com`.
4. Deploy and copy the Vercel URL.
5. In Render, set `CLIENT_ORIGIN` to that exact URL, including `https://` and no trailing slash.
6. Keep `COOKIE_SAME_SITE=none` for this split-domain deployment. It is required for the secure httpOnly session cookie to travel between Vercel and Render.

The `client/vercel.json` rewrite keeps React Router routes working on refresh.

### 5. Verify the deployed app

Register, create a scenario of at least 20 characters, wait for generation, inspect evidence, submit an accusation, resolve the case, and revisit it from **My cases**. If login fails, check the exact `CLIENT_ORIGIN` and `COOKIE_SAME_SITE=none`. If generation fails, inspect Render logs and verify the Gemini model variables.

## Local development

Copy `.env.example` to `.env`, set `MONGODB_URI` and a long `JWT_SECRET`, keep `MOCK_AI=true` for deterministic local cases, then run `npm install` and `npm run dev`. Open `http://localhost:5173`.

For live AI, set `MOCK_AI=false`, `GEMINI_API_KEY`, and all three Gemini model IDs. Provider calls stay on the server.

## Commands

`npm run dev` starts both workspaces. `npm run build` creates production builds. `npm run lint` and `npm test` run workspace checks. Case generation is an in-process job; move it to a durable queue before running multiple API instances.
