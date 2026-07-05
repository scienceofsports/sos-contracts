# SOS Contracts — CLAUDE.md

Bespoke e-signing platform for Science of Sports (SCIOS) club/federation contracts —
a mini DocuSign/PandaDoc built specifically for SOS's contracts. Evidence-grade
(eIDAS Simple Electronic Signature): email-OTP identity, server timestamp + real IP,
full-document SHA-256 hash, tamper-evident append-only audit ledger, and a generated
PDF Certificate of Completion. Built for real €8K–€48K B2B deals, so the evidence must
be legally defensible.

Global identity/working-style lives in `~/.claude/CLAUDE.md`; SCIOS business context in
`1. SCIOS/CLAUDE.md`. This file is the project's technical map.

## Stack

- **Frontend:** React 18 + Vite, Tailwind v4. One large `src/App.jsx` (~3300 lines).
  Deployed to **GitHub Pages** at `contracts.scienceofsports.net` via GitHub Actions
  (`.github/workflows/deploy.yml`) — **push to `main` = deploy**.
- **Backend:** Supabase (project ref `dljcowpbplqdqjulnvyy`, EU Frankfurt) — Postgres +
  Auth + Storage (private buckets: `signatures`, `certificates`, `contract-attachments`,
  `logos`) + Edge Functions (Deno) + Row Level Security.
- **Email:** Resend (from "Science of Sports <info@scienceofsports.net>").

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # Production build → dist/  (run this to catch errors before pushing)
git push origin main   # Deploys the FRONTEND via GitHub Actions

# Deploy an Edge Function (needs a Supabase access token — see memory):
SUPABASE_ACCESS_TOKEN="sbp_..." npx supabase functions deploy <name> --project-ref dljcowpbplqdqjulnvyy
```

## Architecture

**Service seam:** `src/services/*` — each service (`companyService`, `userService`,
`clientService`, `contractService`, `paymentService`, `signingService`) returns Promises
and hides Supabase behind stable method signatures. `src/services/mappers.js` does
camelCase↔snake_case row mapping.

**Signing flow** (server-authoritative Edge Functions, `supabase/functions/`):
`create-signing-request` → `get-signing-request` → `send-otp`/`verify-otp` →
`record-signature` (the core evidence function) → `get-certificate`/`get-signed-contract`.
Also `invite-user`, `decline-signing-request`.

**Two PDF generators kept in visual sync — edit BOTH together:**
- `src/lib/contractPdf.js` (jsPDF, browser) — the DRAFT / pre-sign preview PDF.
- `supabase/functions/_shared/contractPdf.ts` (pdf-lib, Deno) — the SENT and SIGNED
  PDFs (bundled into `record-signature`, so redeploy that function after editing).
- `supabase/functions/_shared/certificate.ts` — the Certificate of Completion.
- Shared palette: NAVY `#0A1A3F`, CYAN `#22C7E6`, rainbow hairline.
- A change to the contract document's *look* usually means editing all of:
  `ContractDocumentBody` in App.jsx + `contractPdf.js` + `contractPdf.ts`.

**Evidence protection:** migration `0004` adds a trigger `contracts_block_signed_delete`
that blocks deleting a contract with a recorded signature. This is intentional. See memory
for the SQL to force-delete TEST contracts.

**`normalizeSnapshot`** (App.jsx) translates the frozen `document_snapshot` (snake/camel)
for the signing page. **`computeServiceLineItems` + `SERVICE_GROUPS` + `platformSeatsSummary`**
(`src/lib/constants.js`, ported into both PDF generators) build the structured service catalog.

## Migrations

`supabase/migrations/0001`–`0007` all run. Apply new ones via the Supabase SQL Editor or CLI.

## Secrets — never commit

Resend API key + Supabase **service-role** key live ONLY in Supabase function secrets.
Supabase **access token** (`sbp_...`) is for CLI deploys only — never in git/`.env.local`.
The anon/publishable key (`.env.local`, `VITE_SUPABASE_ANON_KEY`) is public/safe.
