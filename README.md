# TeachAssist (private)

A fast, ad-free, private TeachAssist (YRDSB) app for one person. Install it on an iPhone as a Home Screen app.

- **Courses:** every course with its mark, midterm, block and room, grouped by semester, plus your current average.
- **Course detail:** a category breakdown read from each report's own columns (K/T/C/A, Term/Attendance/Final, or the newer "Term Work {65}" expectation reports), plus every evaluation with its feedback.
- **What-if:** add, edit or remove evaluations to see a projected mark. Changes reset when you close the app.
- **What do I need?** shows the mark you need on the next evaluation to reach a target.
- **Updates:** new evaluations, mark changes, midterms and average changes found on each sync.
- **Settings:** 9 colour themes (Purple, Indigo, Blue, Teal, Green, Orange, Pink, Brown, Graphite), Automatic/Light/Dark appearance, and an optional 6-digit PIN that encrypts everything on the device (AES-GCM, PBKDF2 310k). Ten wrong PINs erase the data.

## How it stays private

```
iPhone (app + your data) ──HTTPS──▶ /api/sync relay (your Cloudflare) ──HTTPS──▶ ta.yrdsb.ca
```

- Your student number, password and marks are stored **only on your phone**.
- Browsers can't talk to TeachAssist directly, so a tiny relay (`worker/index.ts`, shared code in `shared/ta.ts`) runs on your own Cloudflare account. For each sync it logs in, downloads the course list and report pages, returns the raw HTML, and forgets everything. It doesn't log or store anything, only ever contacts `ta.yrdsb.ca`, and refuses calls from other websites.
- The phone does all the parsing (`src/lib/parse.ts`).
- Optional: set a `RELAY_KEY` environment variable in Cloudflare and enter the same key in the app (Settings → Advanced) so nobody else can use your relay.
- Security headers (CSP, no framing, no referrer, noindex) are in `public/_headers`.

## Deploy (one time, free)

This repo is set up for Cloudflare Workers (`wrangler.jsonc` + `worker/index.ts`).

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Import a repository** and pick this repo.
2. Keep the defaults: project name `ta` (must match `name` in `wrangler.jsonc`), build command `npm run build`, deploy command `npx wrangler deploy`.
3. Click **Deploy**. You'll get a URL like `https://ta.<your-subdomain>.workers.dev`.
4. On the iPhone, open that URL in **Safari**, tap **Share → Add to Home Screen**, then open it from the Home Screen and sign in.

Every push to the production branch redeploys automatically. (The `functions/` folder also lets the same repo deploy on Cloudflare Pages.)

## Development

```bash
npm install
npm run dev     # app + relay at http://localhost:5173
npm test        # parser / calculator / relay / updates tests
npm run build   # type-check + production build
```

The test fixtures in `tests/fixtures` are synthetic pages that copy TeachAssist's layouts with made-up data. **Never commit real TeachAssist pages:** they contain your student number. `samples/` and `*.pdf` are git-ignored for that reason.

## Mark calculation

TeachAssist's formula, implemented in `src/lib/calc.ts`:

- **Category average** = Σ(mark / out-of × weight) ÷ Σ weight, over counted evaluations. Evaluations that are pink (not handed in) or "No Mark" are skipped.
- **Course mark** = Σ(category average × course weighting) ÷ Σ weighting, over categories that have marks.

When TeachAssist doesn't publish category weightings, the app works them out from the printed course mark where it can. Otherwise it estimates them and labels them as estimated. You can correct them per course under **Weightings**, and those corrections are saved.

Not affiliated with YRDSB or the teachassist foundation.
