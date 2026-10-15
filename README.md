# VidyaLog

Mobile-first learning continuity app for NGO volunteer drives.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Create a MongoDB Atlas database user and add the cluster connection string to `MONGODB_URI`. Set `MONGODB_DB` if you want a different database name.
3. Set `ADMIN_SETUP_SECRET` to a long, random secret (at least 24 characters). Keep it private.
4. Set `ACCESS_CODE_ENCRYPTION_KEY` to a separate random secret (at least 32 characters). Keep the same value across local and deployed environments so coordinators can view encrypted codes in history.
5. Run `npm run dev`, open `http://localhost:3000/first-admin`, and use the setup secret to create the first admin access code. Save that code securely.
6. Sign in at the home page with that admin code. The admin can then add child profiles and create volunteer, manager, and reviewer codes.

Never commit `.env.local` or paste its values into chat. `.env.example` contains placeholders only.

## Current data and access design

- MongoDB stores access-code hashes, encrypted access codes for authorized coordinator history, sessions, child profiles, daily drives, and lesson records.
- Session identifiers are random, stored as hashes in MongoDB, and sent in an HttpOnly, SameSite cookie. The server checks the active code on every authenticated request so a reset/revocation takes effect immediately.
- Access codes are 6 letters. Volunteer codes expire after 2 hours; Manager and Reviewer codes expire after 30 days. Sign-in is limited to 10 failed attempts per IP address every 15 minutes. Volunteer sign-ins join a shared drive record for that chapter and calendar date (Asia/Kolkata); Manager sign-ins do not create drives.
- Only Volunteers can add lesson records. Managers who want to teach can create a Volunteer code for themselves and assign children to it.
- Child photos are resized in the browser and stored as compressed binary data in a separate MongoDB collection. The photo route checks the session and child assignment before returning the image.
- Volunteer endpoints return only assigned children and omit private feedback. Manager, Reviewer, and Admin endpoints can read private feedback within their allowed scope.
- Admins can manually reset their access code; other active sessions from the previous Admin code are revoked.
- Coordinators can view active codes again in code history; revoked and expired codes are not decrypted. Managers can revoke volunteer and reviewer codes in their chapter; only admins can revoke manager codes.
- Session notes can record every subject covered that day, each with its own progress level (Needs help / Getting there / Confident). The child page summarizes the latest level per subject. Notes saved with the earlier single-subject fields still display.

Before adding real child data to a hosted deployment, review the hosting provider's current data terms and turn off any use of submitted content for model training. In particular, Vercel's current Hobby and trial Pro terms describe model-training use of content; verify the applicable account setting or use a plan/provider with terms suitable for this data.

## App routes

- `/` — access-code entry.
- `/first-admin` — one-time first-admin code setup; requires `ADMIN_SETUP_SECRET` and no active admin code.
- `/dashboard` — child history, drive history, stationery, and (for Admin/Manager) access-code management. The open tab and child are kept in the URL (`?tab=codes`, `?kid=<id>`), so refresh and the Back button work.

## Environment variables

`vercel.json` pins the API functions to Vercel’s Mumbai region (`bom1`) so they run next to the MongoDB Atlas cluster; if the database moves, update the region to match.

See `.env.example` for the required names. For deployed Vercel environments, add the same values through the project’s Environment Variables settings. Keep `ACCESS_CODE_ENCRYPTION_KEY` stable; changing it makes saved codes unreadable in history.
