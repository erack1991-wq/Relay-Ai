# Relay Owner AI dashboard integration

The standalone owner Site (`appgprj_6ad6bc25ccc08191beafd744e20adc3a`) is a browser-local planner. PR #13 adds the actual authenticated assistant backend to Relay, a different Site (`appgprj_6ab237665c6881919e6d86e96e5e75ae`).

The integrated dashboard is `/operator/command` in Relay. It reuses the standalone dashboard's visual direction, reads the existing owner-scoped `/api/operator/tasks` endpoint, and shares the existing `/operator/assistant` chat component under the same origin. Rendering chat performs no automatic model requests; the owner sends questions or chooses a starter. The chat keeps its existing proposal review and explicit save flow. Task approval decisions stay in `/operator`. No iframe is used; Relay's existing frame-denial protection is preserved.

The dashboard itself introduces no write endpoint, migration, secret, cross-origin proxy, or permission change. All task reads stay same-origin and bypass caches. Failed refreshes preserve prior tasks with a stale warning; unavailable counts are never replaced with zero. Task summaries cover only the API's latest 100 tasks. Production readiness remains unverified until inspected through the existing health tools. Browser-local leads and evidence entries from the standalone Site are not silently imported or treated as server records.

The branch is reconciled with main commit `fc4b5184abb6e105d42fb479ecfdb4b0d31703a7`. Task and memory APIs retain main's `RELAY_OWNER_EMAIL` gate as well as the Owner AI allowlist. Main's plan-and-queue UI and saved plan results coexist with PR #13's final approval/rejection controls. A focused regression test covers both owner checks, pending-task start/completion rejection, rejection cancellation, atomic decision/audit batching, and saved plan retention.

## Activation

1. Review and release PR #13 through the normal Relay release process. Do not deploy the standalone static archive over the main Relay Site.
2. Verify server-side `OPENAI_API_KEY` and `OWNER_AI_ALLOWED_EMAILS` presence without displaying values. Do not copy credentials between Sites.
3. Verify the existing Operator task/memory migrations are applied through the separately authorized migration procedure.
4. Sign in as an allowed owner and open `/operator/command`. Confirm owner tasks load, send a read-only question, and inspect the returned tools and answer.
5. Verify a non-owner remains denied. Verify missing configuration/storage is reported as unavailable, not an empty success.
6. Only then update the standalone Site's activation message to live. Until verified, label it pending release.

The live `/operator/assistant` route returned 404 during this integration's initial inspection. This is release-preparation work, not evidence that production AI is active.

## Rollback

Revert the dashboard integration commit. Existing assistant and Operator routes continue working without the command-center route. No data migration or deletion is needed.
