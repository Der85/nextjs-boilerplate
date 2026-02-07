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

---

# Rapid Capture & Triage System

## Overview

The capture-to-triage workflow enables ADHD users to capture thoughts in under 3 seconds, then process them later with a guided decision flow.

## Design Decisions

### 1. Inbox Items vs Direct Task Creation

**Decision:** Captures go to an `inbox_items` table, not directly to tasks.

**Rationale:**
- Zero friction capture - no required fields
- Decouples capture from processing
- Preserves raw text and source metadata
- Enables analytics on capture-to-triage time

### 2. One-Item-at-a-Time Triage

**Decision:** Triage shows one item at a time, not a list.

**Rationale:**
- Reduces decision fatigue (ADHD-optimized)
- Keyboard shortcuts for each action
- Clear progress indicator
- Skip option for items needing more thought

### 3. Token Parsing

**Decision:** Parse tokens from raw text (@today, #project, !high) but preserve original.

**Rationale:**
- Quick capture with inline metadata
- Original text preserved for reference
- Tokens influence urgency display
- Clean task name after conversion

## Database Schema

### `inbox_items` Table
```sql
CREATE TABLE inbox_items (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  source text NOT NULL CHECK (source IN ('quick_capture', 'mobile', 'email_forward', 'voice', 'other')),
  parsed_tokens jsonb DEFAULT '{}',
  triage_status text NOT NULL DEFAULT 'pending' CHECK (triage_status IN ('pending', 'triaged', 'discarded')),
  triage_action text CHECK (triage_action IN ('do_now', 'schedule', 'delegate', 'park', 'drop')),
  triage_metadata jsonb DEFAULT '{}',
  triaged_at timestamptz,
  proposed_task_id uuid REFERENCES focus_plans(id),
  converted_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## Token Syntax

| Token | Meaning | Example |
|-------|---------|---------|
| `@today` | Due today | "Call dentist @today" |
| `@thisweek` | Due this week | "Review proposal @thisweek" |
| `#project` | Tag/project | "Fix bug #backend" |
| `!high` | High priority | "Urgent meeting !high" |
| `!medium` | Medium priority | "Follow up !medium" |
| `!low` | Low priority | "Nice to have !low" |

## Triage Actions

| Action | Shortcut | Result |
|--------|----------|--------|
| **Do Now** | D | Convert to task, optionally start timer |
| **Schedule** | S | Convert to task with specific date |
| **Delegate** | G | Store assignee and follow-up date |
| **Park** | P | Move to someday/maybe list |
| **Drop** | X | Archive with optional reason |

Additional shortcuts:
- **Tab** - Skip to next item
- **Ctrl+Z** - Undo last action (10 second window)

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/inbox` | GET | List pending inbox items |
| `/api/inbox` | POST | Create capture (frictionless) |
| `/api/inbox/triage` | POST | Triage an item |
| `/api/inbox/undo` | POST | Undo last triage (within 10s) |

## UI Components

| Component | Purpose |
|-----------|---------|
| `QuickCapture` | Modal for fast text entry, shows token preview |
| `MobileCaptureButton` | Sticky FAB for mobile capture |
| `QuickCaptureProvider` | Global context with Cmd/Ctrl+K shortcut |

## File Structure (Capture/Triage)

```
migrations/
└── 007_create_inbox_items_table.sql

lib/types/
└── inbox.ts              # Types, guards, token parsing

app/api/inbox/
├── route.ts              # GET list, POST capture
├── triage/route.ts       # POST triage action
└── undo/route.ts         # POST undo

app/triage/
└── page.tsx              # One-at-a-time triage UI

components/
├── QuickCapture.tsx      # Capture modal
└── MobileCaptureButton.tsx

context/
└── QuickCaptureContext.tsx

hooks/
└── useGlobalShortcuts.ts
```

## Conversion Logic

When triaging as Do Now, Schedule, or Delegate:
1. Strip tokens from raw text to get clean task name
2. Apply parsed due date if present
3. Apply priority if present
4. Create task with `needs_linking` status if no outcome/commitment selected
5. Link inbox item to created task via `proposed_task_id`

## Analytics Events

| Event | When Emitted |
|-------|--------------|
| `capture_created` | New inbox item created |
| `triage_opened` | User opens triage page |
| `inbox_item_triaged` | Item triaged (not dropped) |
| `inbox_item_discarded` | Item dropped |
| `capture_to_triage_time_ms` | Time between capture and triage |
| `triage_undo` | User undoes triage |

## Usage

### Enable Global Quick Capture

Wrap your app layout with the provider:

```tsx
import { QuickCaptureProvider } from '@/context/QuickCaptureContext'

export default function Layout({ children }) {
  return (
    <QuickCaptureProvider>
      {children}
    </QuickCaptureProvider>
  )
}
```

Users can then press **Cmd/Ctrl + K** from anywhere to open capture.

### Add Mobile Capture Button

Include on pages where quick capture is useful:

```tsx
import MobileCaptureButton from '@/components/MobileCaptureButton'

export default function Page() {
  return (
    <div>
      {/* page content */}
      <MobileCaptureButton />
    </div>
  )
}
```

## Notification Configuration (TODO)

Optional gentle reminder when inbox pending > threshold:
- User-configurable threshold (default: 10 items)
- Configurable reminder frequency (daily, twice daily)
- No shame language - encouraging tone

---

# Now Mode - Cognitive Load Limiter

## Overview

Now Mode limits active cognitive load to a maximum of 3 actionable tasks, preventing overwhelm by narrowing attention to a small, intentional set.

## Design Decisions

### 1. Fixed 3-Slot Limit

**Decision:** Hard cap of 3 tasks in Now Mode.

**Rationale:**
- Research-backed cognitive load limit
- Forces intentional prioritization
- Reduces decision fatigue
- Clear visual representation (3 cards)

### 2. Linkage Requirement

**Decision:** Tasks must be linked to Outcome/Commitment before pinning.

**Rationale:**
- Ensures tasks align with higher-level goals
- Prevents random task accumulation
- Maintains outcome-linked architecture

### 3. Time Estimate Warning

**Decision:** Warn (but allow override) for tasks > 90 minutes.

**Rationale:**
- Encourages task breakdown
- 90 min is ~2 Pomodoro cycles
- User can override with explicit acknowledgment

### 4. Strict vs Non-Strict Mode

**Decision:** User-configurable enforcement level.

**Rationale:**
- Strict: Blocks 4th task completely
- Non-Strict: Warns but allows overflow
- Accommodates different user preferences

## Database Schema

### Extended Tables

#### `focus_plans` (new columns)
```sql
ALTER TABLE focus_plans
ADD COLUMN now_slot INTEGER CHECK (now_slot >= 1 AND now_slot <= 3),
ADD COLUMN estimated_minutes INTEGER CHECK (estimated_minutes >= 1 AND estimated_minutes <= 480);
```

#### `user_stats` (new columns)
```sql
ALTER TABLE user_stats
ADD COLUMN now_mode_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN now_mode_strict_limit BOOLEAN DEFAULT TRUE;
```

### New Tables

#### `now_mode_events`
```sql
CREATE TABLE now_mode_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'now_mode_enabled', 'now_mode_disabled', 'task_pinned',
    'task_unpinned', 'task_swapped', 'all_slots_completed',
    'time_override_warning'
  )),
  task_id UUID REFERENCES focus_plans(id),
  slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 3),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Business Rules

### Pinning Validation
1. Task must NOT already be in Now Mode
2. Current slot count must be < 3 (strict mode) or warn (non-strict)
3. Task must be linked to Outcome OR Commitment
4. Task status must NOT be 'completed'
5. If estimated_minutes > 90, require override confirmation

### Slot Assignment
- User can specify slot (1, 2, or 3)
- If not specified, auto-assigns to first available slot
- Slots are always numbered 1-3 (no gaps)

### Task Completion in Now Mode
- When task is marked complete, it stays in its slot (visually indicated)
- When ALL occupied slots are completed, trigger celebration
- User can unpin completed tasks or add new ones

### Swap Flow
1. User selects task to swap out
2. System shows recommended replacements (scored by urgency, time estimate)
3. User selects replacement
4. Atomic swap: unpin current, pin replacement to same slot

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/now-mode` | GET | Get current Now Mode state |
| `/api/now-mode` | PUT | Update Now Mode preferences |
| `/api/now-mode/pin` | POST | Pin task to Now Mode slot |
| `/api/now-mode/unpin` | POST | Unpin task from Now Mode |
| `/api/now-mode/swap` | POST | Swap task in Now Mode |
| `/api/now-mode/recommended` | GET | Get recommended tasks to pin |

## UI Components

| Component | Purpose |
|-----------|---------|
| `NowModePanel` | Main panel with 3 slot cards |
| `NowModeSlotCard` | Individual slot card (empty or filled) |
| `NowModeSection` | Self-contained integration component |
| `SwapTaskModal` | Modal for swapping tasks |
| `TaskPickerModal` | Modal for selecting tasks to pin |

## File Structure (Now Mode)

```
migrations/
└── 008_create_now_mode.sql

lib/types/
└── now-mode.ts             # Types, guards, validation

app/api/now-mode/
├── route.ts                # GET state, PUT preferences
├── pin/route.ts            # POST pin task
├── unpin/route.ts          # POST unpin task
├── swap/route.ts           # POST swap task
└── recommended/route.ts    # GET recommended tasks

components/
├── NowModePanel.tsx        # Main panel
├── NowModeSlotCard.tsx     # Slot card
├── NowModeSection.tsx      # Integration component
├── SwapTaskModal.tsx       # Swap modal
└── TaskPickerModal.tsx     # Task picker

context/
└── NowModeContext.tsx      # State management

tests/unit/
└── now-mode.test.ts        # Type/validation tests
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Select/add to slot 1 |
| `2` | Select/add to slot 2 |
| `3` | Select/add to slot 3 |
| `B` | Toggle backlog visibility |
| `Enter` | Start selected task |
| `C` | Complete selected task |
| `S` | Swap selected task |
| `Escape` | Clear selection |

## Usage

### Add Now Mode to Focus Dashboard

```tsx
import NowModeSection from '@/components/NowModeSection'

export default function FocusDashboard({ user }) {
  return (
    <div>
      <NowModeSection
        userId={user.id}
        onStartTask={(taskId) => startTimer(taskId)}
        onTaskCompleted={() => refreshPlans()}
      />
      {/* rest of dashboard */}
    </div>
  )
}
```

### Wrap with Context (optional for global state)

```tsx
import { NowModeProvider } from '@/context/NowModeContext'

export default function Layout({ children }) {
  return (
    <NowModeProvider>
      {children}
    </NowModeProvider>
  )
}
```

## Analytics Events

| Event | When Emitted |
|-------|--------------|
| `now_mode_enabled` | User enables Now Mode |
| `now_mode_disabled` | User disables Now Mode |
| `task_pinned_now_mode` | Task pinned to slot |
| `task_unpinned_now_mode` | Task unpinned from slot |
| `task_swapped_now_mode` | Task swapped with another |
| `now_mode_all_slots_completed` | All occupied slots completed |
| `now_mode_time_override` | User overrode time warning |

## Accessibility

- Full keyboard navigation
- ARIA labels for slot positions
- Screen reader announcements for state changes
- Focus management in modals

## Performance Considerations

1. **Indexes:** `now_slot` column indexed with partial index (WHERE now_slot IS NOT NULL)
2. **Query Optimization:** Single query fetches all Now Mode tasks with joins
3. **Caching:** State cached in context, refreshed on mutations
4. **Optimistic Updates:** UI updates immediately, rollback on error
