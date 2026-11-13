# Nouky

Préparation locale à l'internat de pharmacie avec annales, QCM et suivi de progression.

## Démarrage local

```bash
npm install
cp .env.example .env
# Pour un usage local sans PostgreSQL, remplacer DATABASE_URL par file:./dev.db.
# Remplacer NEXTAUTH_SECRET par une valeur aléatoire longue.
npm run db:local
npm run dev:local
```

Ouvrir http://localhost:3000 et créer un compte. La base SQLite locale est créée dans `prisma/dev.db`. Les 132 sources MedShake publiques (44 sessions de 1991 à 2026, dossiers, exercices et QCM) sont conservées dans `data/annales/` et ne sont pas poussées sur GitHub. Le fichier `src/data/annales-qcm.json` contient 2 632 QCM à grille vérifiée. Huit questions sans bonne réponse exploitable sont exclues du mode quiz. Le script d'import garde les URL, tailles et empreintes SHA-256 dans `data/annales/manifest.json`.

Pour actualiser le corpus : installer `lxml` avec `python3 -m pip install lxml`, puis lancer `python3 scripts/import-annales.py` et `python3 scripts/build-qcm-bank.py`.

Les séries « Annales mélangées » et les annales QCM fonctionnent sans API IA. Les PDF scannés sont consultables localement et peuvent être marqués comme terminés. Une correction automatique fiable des dossiers et exercices demande une transcription OCR et un corrigé vérifié ; Nouky n'invente pas de note pour ces sujets.

## IA facultative

Pour les séries par matière, dossiers générés et corrections libres, renseigner une clé dans `.env` et choisir `AI_PROVIDER=groq`, `mistral` ou `deepseek`. La clé reste côté serveur. Le fournisseur Groq est configuré par défaut avec `openai/gpt-oss-120b`. Les appels sans clé retournent une erreur explicite ; les quiz d'annales restent disponibles.

```env
AI_PROVIDER="groq"
GROQ_API_KEY="..."
AI_MODEL="openai/gpt-oss-120b"
```

Sur Vercel, Nouky utilise PostgreSQL avec `prisma/schema.prisma` et les variables `DATABASE_URL` et `DATABASE_URL_UNPOOLED`. Les PDF sont lus depuis la copie locale si elle existe et depuis MedShake sinon. La génération du client Prisma utilise le schéma PostgreSQL lors de `npm run build`.
