# Nouky

Nouky est une plateforme Next.js de préparation aux dossiers thérapeutiques et biologiques de l'internat de pharmacie.

Le modèle Mistral est appelé uniquement depuis les routes serveur. La clé API doit rester dans `.env.local` en local ou dans les variables d'environnement Vercel.

## Local

```bash
npm install
cp -n .env.example .env
cp -n .env.example .env.local
npx prisma db push
npm run dev
```

Renseigner `DATABASE_URL` et `MISTRAL_API_KEY` dans `.env.local`, puis ouvrir `http://127.0.0.1:3000`.

## Variables

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
MISTRAL_API_KEY=""
MISTRAL_MODEL="mistral-large-latest"
NEXTAUTH_SECRET="change-me"
```

## Fonctionnalités

- Dossiers progressifs concours par matière et difficulté.
- Correction immédiate avec barème, mots-clés, oublis et erreurs graves.
- Cartes de révision Leitner générées depuis les erreurs.
- Progression par score, matière faible et compétence faible.
- Concours blanc de 3 à 5 dossiers.

## Routes principales

- `POST /api/cases/generate`
- `POST /api/cases/answer`
- `GET /api/leitner/due`
- `POST /api/leitner/review`
- `GET /api/progress`
- `POST /api/mock-exam/generate`

## Vercel

Déployer comme projet Next.js standard. Ajouter au minimum `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `NEXTAUTH_SECRET` et `DATABASE_URL` dans les variables d'environnement du projet.

La base doit être PostgreSQL pour une vraie persistance sur Vercel. Une base Neon, Supabase, Vercel Postgres ou tout Postgres managé compatible Prisma convient.

Après avoir configuré `DATABASE_URL`, appliquer le schéma :

```bash
npx prisma db push
```
