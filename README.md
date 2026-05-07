# bertyl.com

Source code for https://bertyl.com, built with Astro, Neon Postgres + Drizzle, Resend, and Vercel.

## Development

1. Install dependencies:

```sh
npm install
```

2. Create `.env`:

```dotenv
NEON_DATABASE_URL=postgres://...
```

NOTE: If `NEON_DATABASE_URL` is unset, the app falls back to a fake that logs subscriptions instead of writing to a database.

3. Create and run migrations:

```sh
npm run db:generate
npm run db:migrate
```

4. Start local dev server:

```sh
npm run dev
```

Open `http://localhost:4321`.

## Writing Posts

Add a new `src/content/blog/{YYYY-MM-DD}_{slug}.md` file. It will later resolve to `/blog/{slug}`.

It must include frontmatter like:

```md
---
title: My new post
description: A summary of this new post.
date: 2026-04-27
tag: projects
---
```

Where `tag` is one of:

- `projects`
- `thoughts`

## Data flows

This app handles subscription, authentication, and notification all via email.

### New subscriber

1. Alice visits the home page (`GET /`), enters `alice@email.com` and clicks "Subscribe" (`POST /subscribe(email)`)
1. App generates long-lived, all-purpose token
1. App inserts to `subscribers` table: `email=normalize(alice@email.com), token={token}, token_created_at={now}, active=false`
1. App (using Resend) sends email with a confirmation link with the token. It should say something like "You're almost subscribed! Just click the link below to receive future posts in your inbox. `<Button>Confirm subscription</Button>` Don't want to subscribe? Feel free to ignore this email."
1. App renders "Check your email for a confirmation link. If you don't receive an email, you might already be a subscriber."
1. Alice opens inbox and clicks confirmation link (`GET /subscribe?t={token}`)
1. App validates token, updates `active=true`, and redirects immediately to `GET /preferences?t={token}`

#### Preventing spam

The app sends at most one subscription-related email per subscriber every 5 minutes, using `subscribers.last_email_sent_at`.

### Unconfirmed subscriber re-subscribes

1. Alice, before clicking the "Confirm subscription" link in their email, visits the home page and enters `alice@email.com` again (`POST /subscribe(email)`)
1. App sees existing `email={email} and active={false}` entry in `subscribers` so it follows this behavior: if the token was created more than 5 minutes ago, the app can regenerate a new one: update `token` and `token_created_at` and send another email.
1. App still renders "Check your email for a confirmation link. If you don't receive an email, you might already be a subscriber."

### Confirmed subscriber re-subscribes

1. Alice clicked "Confirm subscription" in the past, but visits the home page and enters their email again (`POST /subscribe(email)`)
1. App sees existing `email={email} and active=true` entry in `subscribers` and does not send an email
1. App still renders "Check your email for a confirmation link. If you don't receive an email, you might already be a subscriber."

### New post

1. Commit new post to `main`: `src/content/blog/YYYY-MM-DD_foo.md`
1. Manually triggered GitHub Action sends emails to anyone in `subscribers(active=true, {post_tag}=true)`

### Manage preferences

1. Alice opens the emailed new post and clicks "Manage preferences" (`GET /preferences?t={token}`)
1. App validates and renders form with current preferences
1. Alice submits any changes (`POST /preferences?t={token}(name, topics)`)

### Unsubscribe

1. Alice opens the emailed new post and clicks "Unsubscribe" (`GET /unsubscribe?t={token}`)
1. App validates and renders a "Confirm unsubscribe" form,
1. Alice submits (`POST /unsubscribe?t={token}(topics, delete)`) which fully deletes the account and lets her know what happened

### Subscriber forwards email

1. Alice forwards the email to her friend Bob
1. Bob is able to click "Manage preferences" and "Unsubscribe", authenticated as Alice

This is a known but unlikely risk.
