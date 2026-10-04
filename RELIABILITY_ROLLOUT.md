# Reliability rollout

The reliability tables are prepared locally but must be applied to the production database only after an approved migration window.

They support:

- `provider_events`: idempotent webhook receipt, retry state, and replay.
- `jobs`: durable follow-up, notification, and provider work with backoff.
- `audit_events`: workspace-scoped history for owner and support actions.
- `completed_jobs`: explicit completed work and collected revenue attribution linked to a booking.

Before applying migration `0006_reliability_operations.sql`:

1. Create and verify a database backup.
2. Apply the migration in staging.
3. Run schema, tenant-isolation, webhook, and restore tests.
4. Confirm the live database can be rolled back or restored.
5. Apply in production during an approved maintenance window.

The job helpers claim work with a compare-and-set transition, cap each batch at 50, retry failures with exponential backoff, and mark jobs failed after five attempts. A scheduler must call them only after the migration and backup gates above are complete.
