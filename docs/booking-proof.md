# How the last seat is claimed

The booking row and the seat count change in the same PostgreSQL transaction. A reservation can advance the count only while `reserved < capacity`. If the update affects no row, the trigger raises `Booking closed` and the reservation rolls back. Cancelling a ticket releases a seat on its own session date. [Booking migration](../supabase/migrations/20261122222124_workshop_capacity.sql)

## Run the database tests

From the repository root with Docker and Bash installed, run the same test as the migration workflow. The script starts a disposable PostgreSQL container, applies the migrations and seed, runs pgTAP, and removes the container on exit.

```sh
bash scripts/test-db.sh
```

If you already use the Supabase CLI, you can run the suite in a fresh local project instead.

```sh
supabase start
supabase test db
supabase stop
```

The pgTAP suite checks the last seat, a second request against a full session, cancellation, rescheduling and database access. The tests run sequentially in one transaction and roll back their rows. The recorded concurrency checks below cover interleaved requests. [Test cases](../supabase/tests/workshop.test.sql) · [Supabase testing guide](https://supabase.com/docs/guides/local-development/testing/overview)

## Read the recorded concurrency checks

The video and JSON preserve results from separate database runs. A *tested order* is a sequence in which the engine let the operations from two requests proceed. Each of the two checks below exercised six orders. The historical example is available here as a recorded result. The runnable migration in this repository is the Fieldwork guard. [24-second walkthrough](booking-check.mp4) · [Selected output and revision hashes](booking-check.json)

| Database under test | What the recorded engine run found |
| --- | --- |
| Earlier workshop example | The engine inferred the capacity conflict from the schema. Four of six orders broke capacity in each of its two checks. Both checks pointed to one distinct finding. |
| Advisory-lock candidate | The earlier run also tried an advisory lock per call. The engine marked this candidate proven across six orders for the tested case. |
| Corrected historical example | A separate revision locked the capacity row. Its two checks held across all six tested orders apiece. |
| Shipped Fieldwork migration | Fieldwork uses a conditional update to claim the seat. An engineering build ran both checks against this migration. All six tested orders held for each. |

## Read a migration pull request

`npm run check` reviews the repository. `npm run check:race` asks the published VibeRaven CLI to infer checks from its migrations. Version 1.13.0 loaded this schema and returned **incomplete** with zero inferred checks. The engineering run above used the revision recorded under `shipped_guard.engine_git_revision`. A pull request can show the published review's result without blocking the build. [Commands and pinned version](../package.json) · [Workflow](../.github/workflows/migrations.yml)

The engine revision identifies the VibeRaven build. The migration SHA-256 identifies the exact Fieldwork SQL tested.
