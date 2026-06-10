# Nouky

Nouky is a Vercel-ready Next.js app for medical consultation simulation.

The Mistral API key is used only in server routes under `src/app/api/*`, so it is never sent to the browser.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `MISTRAL_API_KEY` in `.env.local`, then open http://127.0.0.1:3000.

## Vercel

Add these environment variables in the Vercel project settings:

```bash
MISTRAL_API_KEY=...
MISTRAL_MODEL=mistral-large-latest
```

Then deploy as a standard Next.js project.

## App Flow

- The specialty selection is a centered standalone start page.
- `/api/case` creates a hidden case and returns only patient-facing symptoms.
- `/api/chat` handles patient answers and exam results server-side.
- `/api/evaluate` evaluates the proposed diagnosis server-side.
