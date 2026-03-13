# Untire Coach — AI Coaching Prototype

## Project Context
AI coaching component for the **Untire Now** app by Tired of Cancer B.V.
Supports users with cancer-related fatigue (CRF) through structured, empathetic conversations.
This is a **prototype only** — output feeds into a future production architecture session.

Built by Diogo in collaboration with Tired of Cancer B.V.

---

## Stack

### Frontend
- **Next.js 15** App Router + TypeScript
- **Tailwind CSS** + **Shadcn/ui** components
- **Framer Motion** for step transitions
- Mobile-first, calming healthcare aesthetic

### Backend
- **Next.js API routes** (consolidated — no separate Express server)
- **SQLite** via `better-sqlite3` (prototype; migrate to PostgreSQL for production)
- **OpenRouter API** with Claude as the LLM (`anthropic/claude-sonnet-4-5` primary, `anthropic/claude-haiku-4-5` for eval)
- Uses OpenAI SDK with `baseURL: https://openrouter.ai/api/v1`

### RAG
- Documents: Untire Now app content (themes, exercises, psychoeducational materials)
- Embeddings: `text-embedding-3-small` via OpenRouter, stored as JSON vectors in SQLite
- Retrieval: cosine similarity, top-3 chunks injected at steps 2–3
- Admin can upload/manage RAG documents

### Observability
- Custom middleware logs every LLM call to `llm_traces` table
- Fields: `trace_id`, `user_id`, `session_id`, `flow_step`, `model`, `tokens_in`, `tokens_out`, `latency_ms`, `cost_usd`, `rag_chunks_retrieved`, `risk_triggered`
- Admin dashboard shows: avg latency, token usage, cost, RAG hit rate, risk events

### Evaluation
- Async eval after each AI response using Claude Haiku via OpenRouter
- Scores stored in `eval_scores`: `tone_score` (1–5), `flow_compliance` (bool), `length_compliance` (bool), `safety_pass` (bool)
- Admin can view aggregate scores + drill into individual responses

---

## 4-Step Coaching Flow (Core Requirement — R4)

Every session follows this fixed structure:

| Step | Name | Description | User Input |
|------|------|-------------|------------|
| 0 | Opening | "How are you?" — predefined answer cards | Selects from cards |
| 1 | Acknowledgement | AI responds empathetically to selection | None (auto-advance) |
| 2 | Reflection | AI reflects on progress (≤ 4 sentences) | None (auto-advance) |
| 3 | Connect | AI links state to energy givers/leaks | Optional free text |
| 4 | Close | Gentle, autonomy-based invitation/encouragement | None |

After step 4: option to start new session or continue in free conversation mode.

`flow_step` is tracked per session in the DB. Backend enforces step transitions.

---

## Risk Protocol (R5)

Triggered by: hopelessness signals, suicidal ideation keywords, severe distress, or 3+ consecutive very negative check-ins.

When triggered:
1. Override normal flow
2. Return empathetic acknowledgement (never diagnose)
3. State clearly: not a healthcare professional
4. Provide crisis helpline reference
5. Log to `risk_events` table for admin review

---

## Key Constraints (from project brief)
- **Never** provide medical advice or diagnoses
- **Never** make promises or suggest medical causation
- **Always** stay ≤ 4 sentences in the reflection step (step 2)
- **Always** be empathetic, calm, and autonomy-supportive
- LLM responses must draw on Untire Now app content (via RAG), not generic answers
- No live app data in this prototype phase

---

## Database Schema (SQLite)

### Core tables (from MVP — kept)
- `users` — auth credentials, admin flag
- `sessions` — session tokens (7-day expiry)
- `profiles` — user profile + dynamic_profile text
- `user_settings` — behavior_type, agentic_features, chat_only
- `chats` — conversation threads with `flow_step` field
- `messages` — individual messages with media JSON

### New tables (added for v2)
- `rag_documents` — chunked app content with embedding vectors
- `llm_traces` — per-request observability logs
- `eval_scores` — async quality evaluation per message
- `risk_events` — logged risk protocol triggers

---

## Environment Variables

```env
OPENROUTER_API_KEY=        # OpenRouter API key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
PRIMARY_MODEL=anthropic/claude-sonnet-4-5
EVAL_MODEL=anthropic/claude-haiku-4-5
EMBEDDING_MODEL=openai/text-embedding-3-small
SESSION_SECRET=            # Random string for session signing
NODE_ENV=development
PORT=3000
```

---

## Project Structure (target)

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Login / root redirect
│   │   ├── chat/page.tsx             # Main coaching session UI
│   │   ├── admin/page.tsx            # Admin dashboard
│   │   └── api/
│   │       ├── auth/[...route]/      # Login, logout, me
│   │       ├── chat/route.ts         # 4-step flow engine + LLM call
│   │       ├── rag/route.ts          # Document ingestion + retrieval
│   │       ├── eval/route.ts         # Async evaluation endpoint
│   │       └── admin/[...route]/     # Admin CRUD + stats
│   ├── components/
│   │   ├── chat/
│   │   │   ├── SessionFlow.tsx       # 4-step progress indicator
│   │   │   ├── AnswerCards.tsx       # Predefined selection cards (step 0)
│   │   │   ├── MessageBubble.tsx     # Chat message rendering
│   │   │   └── RiskBanner.tsx        # Risk protocol UI
│   │   └── admin/
│   │       ├── TracesTable.tsx       # Observability logs
│   │       ├── EvalScores.tsx        # Quality scores
│   │       └── RagManager.tsx        # Document upload/manage
│   ├── lib/
│   │   ├── llm.ts                    # OpenRouter client + calls
│   │   ├── rag.ts                    # Embedding + retrieval
│   │   ├── flow.ts                   # 4-step flow state machine
│   │   ├── risk.ts                   # Risk detection
│   │   ├── eval.ts                   # Async evaluation
│   │   ├── observability.ts          # Trace logging middleware
│   │   └── db.ts                     # SQLite client + queries
│   └── prompts/
│       ├── step0.ts                  # Opening prompt template
│       ├── step1.ts                  # Acknowledgement prompt
│       ├── step2.ts                  # Reflection prompt (≤4 sentences)
│       ├── step3.ts                  # Connect prompt
│       ├── step4.ts                  # Close prompt
│       └── risk.ts                   # Risk protocol prompt
├── data/
│   └── app-content/                  # Untire Now content for RAG ingestion
├── CLAUDE.md
└── package.json
```

---

## What was kept from the student MVP
- Auth pattern (session-based cookies) — upgraded to bcrypt
- SQLite schema structure — extended with new tables
- Profile + dynamic profile extraction concept
- Video/breathing exercise media tools
- Admin panel concept

## What was rebuilt
- Frontend: vanilla HTML → Next.js + React
- LLM provider: OpenAI SDK → OpenRouter (Claude)
- Chat flow: free-form → 4-step structured coaching engine
- RAG: none → vector search on app content
- Risk protocol: none → keyword + semantic detection
- Observability: none → full trace logging
- Evaluation: none → async quality scoring per response

---

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
```

First run auto-creates admin user: `admin` / `UntireAdmin2024!` — change immediately.

To ingest RAG content:
```bash
npm run ingest     # Processes /data/app-content/ into embeddings
```
