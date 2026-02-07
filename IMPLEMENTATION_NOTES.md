# Outcome-Linked Tasks Implementation Notes

## Overview

This document describes the implementation of outcome-linked tasks, where every active task must be linked to either an Outcome or a Commitment (which itself links to an Outcome).

## Design Decisions

### 1. Outcomes vs Goals: Coexistence

**Decision:** Outcomes and the existing Goals system coexist as separate constructs.

**Rationale:**
- The existing `goals` table serves a different purpose (plant-garden style goals with micro-steps and progress tracking)
- Outcomes represent higher-level planning constructs with time horizons (weekly/monthly/quarterly)
- Tasks can optionally link to both systems via `related_goal_id` (existing) and `outcome_id`/`commitment_id` (new)

### 2. Task Table: Extend `focus_plans`

**Decision:** Extended the existing `focus_plans` table rather than creating a new `tasks` table.

**Rationale:**
- Preserves all existing data and functionality
- Maintains compatibility with existing components (TriageModal, auto-archive, etc.)
- No data migration required for existing tasks

### 3. "Needs Linking" Approach: New Status Value

**Decision:** Added `'needs_linking'` as a new task status.

**Rationale:**
- More explicit than relying on null FK checks
- Works with existing status-based UI filtering patterns
- Clear transition rule: `needs_linking` → `active` happens when task is linked

### 4. Testing Framework: Vitest + Playwright

**Decision:** Vitest for unit/integration tests, Playwright for E2E tests.

**Rationale:**
- Vitest is fast, TypeScript-native, and integrates well with Next.js
- Playwright provides cross-browser E2E testing with good developer experience
- Both are modern and actively maintained

## Database Schema

### New Tables

#### `outcomes`
```sql
CREATE TABLE outcomes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  horizon text NOT NULL CHECK (horizon IN ('weekly', 'monthly', 'quarterly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  priority_rank integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `commitments`
```sql
CREATE TABLE commitments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Extended Table

#### `focus_plans` (new columns)
```sql
ALTER TABLE focus_plans
ADD COLUMN outcome_id uuid REFERENCES outcomes(id) ON DELETE SET NULL,
ADD COLUMN commitment_id uuid REFERENCES commitments(id) ON DELETE SET NULL;
```

## Business Rules

### Task Creation
1. **Quick Add without link:** Task is created with status `'needs_linking'`
2. **Task with explicit link:** Task is created with status `'active'`
3. **Status transition:** `needs_linking` → `active` only when linked

### Linkage Validation
- A task can be linked directly to an Outcome OR to a Commitment
- When linked to a Commitment, the task also inherits the Commitment's `outcome_id`
- This maintains consistency and allows querying tasks by outcome even if linked via commitment

### Commitment Relinking
When a commitment's `outcome_id` changes:
1. All child tasks are updated in the same transaction
2. The bulk-relink endpoint handles this automatically

### Outcome/Commitment Deletion
- **With active tasks:** Returns 409 Conflict with list of active tasks
- **UI response:** Shows RelinkModal for bulk relinking
- **After relinking:** Deletion proceeds

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/outcomes` | GET | List user's outcomes |
| `/api/outcomes` | POST | Create outcome |
| `/api/outcomes/[id]` | GET | Get outcome with commitments/tasks |
| `/api/outcomes/[id]` | PUT | Update outcome |
| `/api/outcomes/[id]` | DELETE | Delete outcome |
| `/api/commitments` | GET | List commitments |
| `/api/commitments` | POST | Create commitment |
| `/api/commitments/[id]` | GET/PUT/DELETE | CRUD for commitment |
| `/api/tasks/link` | POST | Link task to outcome/commitment |
| `/api/tasks/bulk-relink` | POST | Bulk relink tasks |

## UI Components

| Component | Purpose |
|-----------|---------|
| `ParentSelector` | Tabbed selector for Outcome/Commitment with search |
| `OutcomeChip` | Small chip showing linked outcome name |
| `NeedsLinkingView` | Table of unlinked tasks with one-click link |
| `RelinkModal` | Modal for bulk relinking when deleting outcome |

## File Structure

```
migrations/
├── 003_create_outcomes_table.sql
├── 004_create_commitments_table.sql
├── 005_extend_focus_plans_outcomes.sql
└── 006_backfill_legacy_tasks.sql

lib/types/
└── outcomes.ts              # TypeScript types and type guards

app/api/
├── outcomes/
│   ├── route.ts            # GET list, POST create
│   └── [id]/route.ts       # GET, PUT, DELETE
├── commitments/
│   ├── route.ts
│   └── [id]/route.ts
└── tasks/
    ├── link/route.ts       # POST link single task
    └── bulk-relink/route.ts # POST bulk relink

app/outcomes/
└── page.tsx                 # Outcomes management page

components/
├── ParentSelector.tsx
├── OutcomeChip.tsx
├── NeedsLinkingView.tsx
└── RelinkModal.tsx

tests/
├── setup.ts
├── unit/outcomes.test.ts
└── e2e/outcome-flow.spec.ts
```

## Migration Strategy

### Running Migrations
1. Run migrations in order (003 → 004 → 005 → 006)
2. Each migration is idempotent (safe to re-run)
3. Execute via Supabase Dashboard > SQL Editor

### Backfill Strategy
Migration 006 automatically:
1. Creates "General Maintenance" outcome for each user with unlinked tasks
2. Links all unlinked tasks to that outcome
3. Sets low priority (999) to encourage proper categorization

### Rollback
Each migration includes rollback SQL in comments. To rollback:
```sql
-- In reverse order
-- 006: Unlink tasks, delete General Maintenance outcomes
-- 005: Drop new columns from focus_plans
-- 004: Drop commitments table
-- 003: Drop outcomes table
```

## Testing

### Unit Tests
```bash
npm test                    # Run all unit tests
npm run test:ui            # Interactive UI mode
npm run test:coverage      # Coverage report
```

### E2E Tests
```bash
npm run test:e2e           # Run E2E tests
npm run test:e2e:ui        # Interactive UI mode
```

### Test Coverage
- Type guards and validators
- API endpoint validation logic
- UI component rendering
- Full user flow: outcome → commitment → task → reassign

## Analytics Events (TODO)

The following events are defined but not yet implemented:
- `outcome_created`
- `task_linked_to_outcome`
- `task_linked_to_commitment`
- `task_relinked`

Implementation suggestion: Add an analytics helper in `lib/analytics.ts` that can be called from API routes.

## Follow-up Items

1. **Analytics Integration:** Implement event tracking
2. **Task Form Integration:** Add `ParentSelector` to existing task creation flows
3. **Task List Integration:** Add `OutcomeChip` to task list items
4. **TriageModal Integration:** Add `NeedsLinkingView` as a tab option
5. **Notification Preferences:** Add user settings for outcome-related notifications
6. **Outcome Templates:** Pre-defined outcome/commitment templates for common use cases
7. **Progress Tracking:** Add aggregate progress metrics for outcomes

## Known Limitations

1. **Constraint Enforcement:** The "active tasks must have linkage" constraint is enforced at the application level, not database level, for flexibility
2. **Bulk Operations:** Maximum 100 tasks can be relinked at once (configurable)
3. **Search:** ParentSelector search is client-side only (adequate for typical user volumes)

## Performance Considerations

1. **Indexes:** All FK columns are indexed for efficient queries
2. **Partial Indexes:** `needs_linking` status has a partial index for fast filtering
3. **RLS:** Row Level Security enabled on all tables for defense-in-depth
4. **Rate Limiting:** 30 requests/minute for outcomes API (configurable)
