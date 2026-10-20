# Relay Platform Architecture

**Status:** Product direction accepted; production implementation is staged behind authentication, tenant-isolation, and migration decisions.

## Product model

Relay is one platform with two separate application surfaces backed by shared domain services:

- **`/admin` — Relay Operations.** Private operator console for authorized Relay staff. It can show cross-tenant health and aggregate business metrics, inspect a tenant when needed, and perform carefully audited support actions.
- **`/dashboard` — Customer workspace.** The paid product for a business. A signed-in member sees only workspaces they belong to and the features permitted by their plan and role.
- **Shared backend.** Calls, leads, appointments, billing, AI workflows, and integrations use shared services. Every request carries a verified actor and an authorized workspace context.

The admin surface is a separate authorization boundary, not just a different navigation menu. A customer account must never gain platform privileges by changing a URL, request body, or browser state.

## Surface responsibilities

### Relay Operations (`/admin`)

Initial modules:

1. **Overview:** real tenant count, call volume, lead and appointment totals, MRR, AI/telecom costs, automation success, incidents, and service status.
2. **Businesses:** tenant search, plan/status, usage, integration state, and a tenant detail view.
3. **Activity:** calls, events, jobs, errors, and AI traces with tenant and time filters.
4. **Reliability:** queue health, provider failures, retries, feature flags, and incident controls.
5. **Support actions:** account configuration changes and billing adjustments through explicit, audited actions.
6. **Engineering links:** deployment/build status and a constrained RuFlo/agent status view; infrastructure secrets and raw credentials are never displayed.

Metrics must come from persisted events and billing/usage sources. Any mock dashboard data must be visibly labeled as demo data; example figures such as “42 businesses” are not production facts.

### Customer Dashboard (`/dashboard`)

Initial modules:

- Calls and conversations
- Leads and customers
- Appointments and follow-up
- AI receptionist behavior and business hours
- Phone, SMS, and connected integrations
- Workspace analytics and plan usage
- Billing and team members

Only customer-safe configuration and that customer's operational data belong here. Internal prompts, other tenants' data, platform costs/margins, deployment details, staff tools, and global controls stay private.

## Authorization and tenant isolation

- Resolve the signed-in identity on the server. Never trust a workspace ID, role, plan, or admin flag supplied only by the browser.
- Check membership and permission on every server action and data request. Enforce workspace scope in the database query as well as the route handler.
- Use explicit roles such as platform operator, workspace owner, workspace admin, and workspace member. Keep platform roles separate from customer workspace roles.
- Record admin reads of sensitive records and every support mutation in an append-only audit trail with actor, target, reason, timestamp, and result.
- Require confirmation and a reason for consequential support actions; use idempotency and bounded retries where actions can affect billing or live phone service.
- Do not expose database service credentials or provider secrets to browser code. Return only the fields needed by each surface.
- Keep transcripts and traces access-controlled, minimize retention, and redact secrets and unnecessary personal data in logs.

## Data and infrastructure direction

The accepted target is Supabase Postgres with row-level security (RLS) for tenant-owned data, Stripe for subscriptions, Twilio for phone/SMS, and PostHog/Langfuse/Sentry for product analytics, model traces, and error monitoring. RuFlo/Codex remain engineering and orchestration infrastructure behind restricted operator capabilities.

RLS policies must derive access from trusted membership records and the authenticated identity. Enable RLS on every exposed tenant table; test both allowed and denied cross-tenant reads and writes. Server-side authorization remains required even with RLS. Never use user-editable profile metadata as an authorization source, and never send a Supabase service-role key to the browser.

## Current repository state and migration boundary

The current Relay-Ai codebase is a pilot built around Cloudflare D1/Drizzle. It has owner-scoped workspace checks and an `/api/operations` endpoint for a workspace's failed jobs, but it does **not** yet have the production two-dashboard model, Supabase RLS, or a platform-wide admin identity. The current README also describes development sign-in and simulated calls.

Keep this pilot path intact while implementing the production boundary. Before live multi-tenant customer data is introduced, select and document the production identity/session flow, create the Supabase schema and RLS policies, and migrate or deliberately retain each existing D1-backed domain. Do not claim RLS protection for D1 routes.

## Delivery order

1. **Identity and access model:** production auth, platform-operator allowlist/role, workspace membership, and authorization helpers.
2. **Tenant data foundation:** Supabase schema, tenant foreign keys, RLS policies, audit events, and cross-tenant denial tests.
3. **Customer MVP:** `/dashboard` shell and the first paid workflow, using workspace-scoped server APIs.
4. **Admin MVP:** `/admin` overview and business detail with real data, strict operator access, and audited read paths.
5. **Operations actions:** traces, failures, feature controls, support tools, and bounded remediation.
6. **Integrations and expansion:** Stripe/Twilio metering and controls, observability, then future AI employees.

## Initial acceptance checks

- A regular customer receives 403/404 for every admin route and admin API, including direct requests.
- A member of workspace A cannot read or mutate workspace B by changing route parameters or request payloads.
- RLS independently denies cross-tenant access through the Supabase client/Data API.
- Admin access and mutations create audit records; failed authorization does not mutate data.
- Overview totals reconcile to their source records and clearly state their time window.
- Development/demo identities and simulated provider flows cannot be mistaken for production.
