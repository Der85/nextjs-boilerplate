# ADHDer.io

> Brain dump. Get tasks. Check them off. See your progress.

An AI-powered productivity app built for people with ADHD. Converts free-form brain dumps into organized, categorized tasks — then helps you understand your life balance across 8 key domains.

## Features

- **Brain Dump** — Paste or speak anything on your mind; Gemini AI parses it into tasks with categories, priorities, and due dates
- **Recurring Tasks & Streaks** — Track daily habits with automatic next-occurrence creation and streak counters
- **Life Priorities** — Rank 8 domains (Work, Health, Home, Finance, Social, Personal Growth, Admin, Family) and get a daily balance score
- **AI Insights** — "Sherlock" engine detects patterns: avoidance, streaks, priority drift, category imbalances
- **Task Suggestions** — AI generates 3–5 personalized tasks targeting your highest-priority gaps
- **Weekly Reviews** — AI-powered end-of-week summaries with wins, gaps, and focus suggestions
- **Task Templates** — Reusable blueprints for recurring activities (steps, energy level, time estimate)
- **Smart Reminders** — Priority-aware notifications with quiet hours and daily limits
- **Filters & Saved Views** — Filter by status, category, priority, date; save views for quick access

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| AI | Google Gemini 2.0 Flash |
| Styling | Tailwind CSS 4, Framer Motion |
| Charts | Recharts |
| Drag & Drop | dnd-kit |
| Testing | Vitest, Playwright, Testing Library |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)

### Setup

1. Clone and install dependencies:

```bash
git clone <repo-url>
cd <repo>
npm install
```

2. Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

This app uses Supabase. The required tables are:

`tasks`, `categories`, `dumps`, `user_priorities`, `balance_scores`, `user_insights`, `task_suggestions`, `task_templates`, `weekly_reviews`, `reminders`, `reminder_preferences`, `priority_reviews`

Apply the migrations from your Supabase project dashboard or CLI before first use.

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Production server
npm run lint             # ESLint
npm run test             # Unit tests (Vitest)
npm run test:ui          # Vitest UI dashboard
npm run test:coverage    # Coverage report
npm run test:e2e         # E2E tests (Playwright)
npm run test:e2e:ui      # Playwright UI
```

## Project Structure

```
app/
  (app)/           # Authenticated pages (dump, tasks, insights, priorities, templates, …)
  (auth)/          # Login & signup
  api/             # API routes (tasks, dump, balance, insights, suggestions, reminders, …)
components/        # Shared React components
lib/
  ai/              # Gemini integration (parseBrainDump, categorizeTask, insights, suggestions)
  supabase/        # Supabase client helpers (server + client)
  utils/           # Shared utilities (dates, categories, task stats, filters, recurrence)
  hooks/           # Custom React hooks
  types.ts         # All TypeScript types
  rateLimiter.ts   # Per-endpoint in-memory rate limiting
  theme.ts         # Design token helpers
tests/             # Unit tests mirroring lib/ structure
```

## Architecture Notes

**Rate Limiting** — Each API endpoint has its own in-memory rate limiter keyed by user ID. Limits reset on server restart and are not shared across serverless instances; migrate to Redis/Upstash for multi-instance production deployments.

**AI Caching** — Insights are cached for 10 minutes per user to reduce Gemini API calls. Weekly reviews generate once per week (Monday–Wednesday only). Suggestions enforce a 24-hour minimum between generation runs.

**Balance Score** — A daily 0–100 score weighted by your 8-domain priority rankings. Each domain scores on completion rate (70 pts), task volume (20 pts), and recency (10 pts). Zero-activity days carry forward the previous score.

**Recurring Tasks** — Completing or skipping a recurring task automatically creates the next occurrence. Completing increments the streak; skipping resets it to zero.
