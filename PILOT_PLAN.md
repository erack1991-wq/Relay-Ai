# Relay: first customer pilot

## Positioning to test

Start with independent HVAC businesses in one local area. This is a hypothesis to validate, not a claim that this is the largest or least competitive market.

Proposed promise: **See which missed calls need follow-up and turn the next conversation into a booked visit.**

Jobber already offers an AI receptionist and hang-up follow-up, and Housecall Pro offers missed-call automation. A broad feature list is not a defensible advantage. Test whether simpler setup, clear follow-up ownership, and visible booking outcomes are worth paying for.

Sources checked September 22, 2026:
- https://www.getjobber.com/features/ai-receptionist/
- https://productupdates.getjobber.com/117865-receptionist-now-turns-hang-ups-into-booked-jobs
- https://help.housecallpro.com/en/articles/6750234-voice-settings-overview

## First 30 days

1. Interview 10 owners through personal introductions and individually researched outreach. Ask how they handle missed calls today, how often follow-up fails, what software they already use, and what would make switching worthwhile. Do not invent missed-revenue estimates.
2. Show the three-minute sandbox demo to interested owners. Label every simulated message and appointment. Ask three businesses to help design a pilot; no subscription sale until live delivery is ready.
3. Connect one business end to end: a phone/SMS provider, verified webhooks, explicit messaging permissions, calendar availability, delivery receipts, and human handoff. Add durable background processing, retry handling, monitoring, and backups. Verify real delivery using controlled test numbers before customer use.
4. Measure missed calls captured, replies, booked appointments, completed jobs confirmed by the business, opt-outs, delivery failures, and actual provider cost. A booked estimate is not earned revenue. Compare with the business's previous process and report attribution limitations.
5. Interview the pilot users again. Test a monthly subscription offer only once reliability and willingness to pay are demonstrated. Set a usage allowance from measured costs; avoid unlimited calling or guaranteed revenue claims.

## Outreach draft — not sent

Hi [name], I'm building Relay for small HVAC teams. It brings missed-call follow-ups and appointment tracking into one simple workspace. I have a working demo, and I'm looking for a few owners to help shape the first live pilot. Could I show you the three-minute workflow and hear how you handle missed calls today?

## Three-minute demo

1. Open the local workspace and explain that communication is simulated.
2. Add a fictional customer with service-text permission.
3. Use Overview → Test call, choose that customer, and record a missed call.
4. Open Autopilot → Prepare follow-ups → Review → Simulate delivery.
5. In the opportunity register, click Book. Choose a future whole-hour slot and save.
6. Show the appointment and customer history. Reload to demonstrate persistence.

## Current limits

This is a local sandbox. The receptionist uses scripted replies. There is no live telephony, SMS, AI model connection, external calendar sync, background scheduler, payment processing, subscription billing, or public customer onboarding. Workspace ownership is checked by the backend; local sign-in is a development identity. Production security, operational readiness, and real provider behavior need separate verification before onboarding live businesses.
