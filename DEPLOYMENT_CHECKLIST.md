# Relay deployment checklist

Relay is ready for a controlled pilot when every item below is true. The local sandbox is not a production deployment.

## Build and data

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Apply every tracked D1 migration to the target database.
- Back up the database before the first live pilot.
- Confirm workspace owner isolation and same-origin POST protection.
- Confirm the `/api/health` response reports the database and provider checks you expect.

## Voice pilot

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `PUBLIC_BASE_URL` are deployment secrets, not source files.
- The public URL is stable HTTPS and reaches `/api/voice`.
- The Twilio number is voice-enabled and the pilot recipient is verified for trial accounts.
- `OPENAI_API_KEY` is present if AI replies are enabled.
- Test greeting, speech recognition, no-input timeout, emergency language, and a human handoff phrase.
- Set a call time limit and a spend alert in Twilio before inviting a pilot.

## Product and operations

- Keep the human review step for outbound follow-ups enabled.
- Collect service-message permission and honor STOP immediately.
- Tell pilot users that simulated messages and bookings are not live revenue.
- Record failed calls, provider errors, opt-outs, and booked appointments.
- Have a manual fallback number and a process for deleting or correcting customer data.

## Launch gate

Do not advertise a guaranteed revenue result. Move from sandbox to one paid pilot only after a real end-to-end call, a confirmed appointment, and a documented provider-cost estimate have all passed.
