# Untire Coach — AI Coaching Prototype

## Overview
AI coaching component for the **Untire Now** app by Tired of Cancer B.V.
Supports users with cancer-related fatigue (CRF) through structured, empathetic conversations.
**Prototype only** — output feeds into a future production architecture session.

---

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000
```

Default admin login: `admin` / `UntireAdmin2024!` — change after first login.

To ingest RAG content (add .txt/.md files to `data/app-content/` first):
```bash
npm run ingest
```

## Environment variables (`.env.local`)

```
OPENROUTER_API_KEY=       # OpenRouter API key
PRIMARY_MODEL=anthropic/claude-sonnet-4-5
EVAL_MODEL=anthropic/claude-haiku-4-5
EMBEDDING_MODEL=openai/text-embedding-3-small
SESSION_SECRET=           # Random string
NODE_ENV=development
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router + TypeScript + Tailwind CSS |
| Database | `node:sqlite` (built-in, Node 22+) |
| LLM | OpenRouter API — Claude Sonnet (primary), Claude Haiku (eval) |
| Auth | bcryptjs + session cookies (7-day expiry) |
| Embeddings | `text-embedding-3-small` via OpenRouter |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Login
│   ├── chat/page.tsx             # 4-step coaching session UI
│   ├── admin/page.tsx            # Admin dashboard
│   └── api/
│       ├── auth/                 # login, logout, me
│       ├── chat/                 # Main flow engine
│       ├── profile/              # User profile
│       └── admin/                # Stats + user management
├── lib/
│   ├── db.ts                     # SQLite (node:sqlite) — all queries
│   ├── llm.ts                    # OpenRouter client + cost tracking
│   ├── flow.ts                   # 4-step state machine + prompts
│   ├── risk.ts                   # Distress detection + crisis response
│   ├── rag.ts                    # Embedding + cosine similarity retrieval
│   ├── eval.ts                   # Async LLM-as-judge quality scoring
│   └── auth.ts                   # Session helpers
└── prompts/                      # (future) extracted prompt templates
data/
└── app-content/                  # Untire Now content for RAG ingestion
scripts/
└── ingest.ts                     # RAG ingestion pipeline
```

---

## Coaching flow (4 steps — R4)

| Step | Name | Behaviour |
|------|------|-----------|
| 0 | Check-in | User selects from predefined cards (up to 3) |
| 1 | Acknowledgement | AI responds empathetically to selections |
| 2 | Reflection | AI reflects on progress — **max 4 sentences** |
| 3 | Connect | AI links state to energy patterns; optional user reply |
| 4 | Close | Gentle, autonomy-based closing |

Steps 1→2→4 auto-advance. Step 3 allows optional free text. After step 4: new session or free chat mode.

---

## Key constraints

- **Never** provide medical advice, diagnoses, or treatment recommendations
- **Never** make promises or suggest medical causation
- **Always** ≤ 4 sentences in step 2 (reflection)
- **Always** empathetic, calm, autonomy-supportive tone
- Responses grounded in Untire Now app content via RAG

## Risk protocol (R5)

Triggers on: hopelessness keywords, suicidal ideation, self-harm signals.
Action: override flow → empathetic response + crisis helpline → log to `risk_events`.

---

## Database tables

| Table | Purpose |
|---|---|
| `users` | Auth credentials |
| `sessions` | Session tokens (7-day TTL) |
| `profiles` | User profile + dynamic summary |
| `chats` | Sessions with `flow_step` + `flow_state` |
| `messages` | Messages with step metadata |
| `rag_documents` | Chunked content + embeddings |
| `llm_traces` | Per-request observability (latency, tokens, cost) |
| `eval_scores` | Async quality scores per AI response |
| `risk_events` | Logged risk protocol triggers |

---

## GitHub

Repo: https://github.com/tired-of-cancer/AI-prototype
Always push to `main` on this repo.
