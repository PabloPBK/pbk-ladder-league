# ZZ2 Pickleball website

Standalone Next.js public website housed in the `zz2-site/` folder of the existing repository. Create a separate Vercel project with **Root Directory** set to `zz2-site` so the Operations Hub remains unchanged.

Pages: Home, Tournaments, Leagues, MiLP Events, Consulting, About, Contact.

Tournament listing reads only published ZZ2 events using server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` environment variables. Never prefix the secret with `NEXT_PUBLIC_`. No production domain switch until preview validation.
