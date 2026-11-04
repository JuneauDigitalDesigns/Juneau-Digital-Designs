This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Working in git worktrees (Windows)

- **Run `npm ci` in every worktree before `npm test`, `tsc`, `next build` or `next dev`.** Don't
  borrow the main checkout's `node_modules`, and don't junction or symlink `node_modules`
  between checkouts. `next.config.ts` refuses to start if you do (`scripts/node-modules-guard.cjs`).
- **Why:** Next links sharp as `.next/node_modules/sharp-<hash>`, an NTFS junction to wherever
  sharp resolved. `git worktree remove` follows junctions while deleting, so removing a
  worktree that borrowed the main checkout's packages empties the main checkout's
  `node_modules/sharp`.
- **To remove a worktree that may hold a junction**, delete it with something that unlinks
  junctions instead of following them, then prune:

  ```bash
  node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" .claude/worktrees/<name> && git worktree prune
  ```

## Quote Form Email Setup (Resend)

Create a `.env.local` file in the project root and configure:

```bash
RESEND_API_KEY=your_resend_api_key
QUOTE_TO_EMAIL=you@yourdomain.com
QUOTE_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

- `QUOTE_TO_EMAIL`: inbox that should receive quote requests
- `QUOTE_FROM_EMAIL`: sender identity (use a verified domain in production)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile site key used by the quote form widget
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret key used for server-side token verification

The quote form submits to `/api/quote` and sends a formatted email with all form details.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
