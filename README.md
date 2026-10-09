# SchrodingerPad

A Solana launchpad on pump.fun where every coin is born inside a sealed box. The first buy observes the box and collapses it into a random identity: name, art, rarity, lore, and a fate, Alive or Dead. The outcome comes from a seed drawn from a quantum random number generator and committed on-chain before the coin exists.

- **Alive** coins pay their creator fees to holders in SOL.
- **Dead** coins use their creator fees to buy the coin back and burn it.
- The launching user earns `CREATOR_FEE_SHARE_PERCENT` of their coin's creator fees either way.

## How it works

1. **Launch.** The user pays `LAUNCH_COST_SOL` to the launcher wallet. The server verifies the payment on-chain, then:
   - fetches a 32-byte seed from the ANU quantum RNG (or the labelled classical fallback),
   - writes `SchrodingerPad Box #N commitment sha256:<hash>` to Solana in a memo from the launcher,
   - creates the coin on pump.fun through PumpPortal as **"SchrodingerPad Box #N"** with a sealed-box image.
2. **Observation.** The worker polls each coin's bonding curve; a Helius raw webhook can push the same transactions. The first buy by anyone other than the launcher is recorded as the observer and collapses the box. With no buy within `DECOHERENCE_MINUTES`, the box collapses on its own.
3. **Reveal.** The seed is published. The identity is a deterministic function of the seed (`src/lib/identity.ts`), so anyone can re-derive it. At collapse the server re-reads the memo from chain and marks the box verified. On the coin page, **Verify this collapse** does the same check in the visitor's browser against a public Solana node.
4. **Fees.** Every `FEE_CYCLE_MINUTES` the launcher collects pump.fun creator fees through PumpPortal. pump.fun pools a creator's fees across all of its coins, so the SOL actually received is split across boxes in proportion to the creator fees each box earned in its own trade events. Nothing is credited beyond what arrived. Each box's share is split into the creator part and the pool.
5. **Fate.** Alive pools are paid to holders by their average balance over the last 60 minutes; Dead pools buy back the coin and burn it. Sealed boxes keep their pool until they collapse.

On-chain token names never change. The collapsed identity, fate and rarity live on the site and its X account.

### Payout safety

- Pending amounts move into a payout batch with a compare-and-set update, so only one runner can take them.
- Every payout row is claimed `PENDING -> SENDING` by exactly one runner before any SOL moves.
- A failed send is marked `FAILED` and never retried automatically, because it might have landed. Review it in `/admin`.
- Fee collection and distribution also run under a database lease.
- `/admin` has a pause switch for payouts and burns.

## Stack

Next.js 14 (App Router, TypeScript, Tailwind), Prisma + Postgres, Solana wallet-adapter (Phantom, Solflare), Helius (RPC, DAS holder lists, webhook), PumpPortal (create, collect fees, buy), sharp (art), framer-motion, lucide-react, twitter-api-v2.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `TEST_MODE` | yes | `true`: devnet, fake pump.fun launches, buys, fees and holders. Commitment memos are still real devnet transactions. `false`: mainnet. |
| `LAUNCHER_PRIVATE_KEY` | yes | Launcher wallet secret key (base58 or JSON array). It creates coins, writes memos, collects fees, pays out and buys back, so keep it funded. Never commit it. |
| `HELIUS_API_KEY` | mainnet | Helius RPC and DAS `getTokenAccounts` for holder lists. Without it the public RPC is used, which is slow and often refuses holder queries. |
| `HELIUS_WEBHOOK_SECRET` | optional | Required for `/api/webhooks/helius`, sent by Helius as the `Authorization` header |
| `SOLANA_RPC_URL` | optional | Overrides the RPC URL |
| `QRNG_API_KEY` | optional | ANU quantum API key (api.quantumnumbers.anu.edu.au). Without it the free ANU endpoint is used, which allows about one request per minute. If neither answers, the classical fallback is used and labelled. |
| `CREATOR_FEE_SHARE_PERCENT` | no, 20 | Launching user's share of their coin's creator fees |
| `DECOHERENCE_MINUTES` | no, 10 | A sealed box collapses on its own after this long without a buy |
| `ALIVE_ODDS_PERCENT` | no, 50 | Chance a box collapses Alive |
| `FEE_CYCLE_MINUTES` | no, 10 | Fee collection and distribution interval |
| `MIN_PAYOUT_SOL` | no, 0.0005 | Smaller holder shares stay in the pool |
| `MIN_BUYBACK_SOL` | no, 0.01 | Dead pools buy back once they reach this |
| `LAUNCH_COST_SOL` | no, 0.05 | Price of a launch, paid to the launcher |
| `DEV_BUY_SOL` | no, 0 | Launcher dev buy at creation. Launcher buys never observe a box. |
| `ADMIN_PASSWORD` | yes | `/admin` password. Admin is disabled when this is empty. |
| `SESSION_SECRET` | yes | Signs the admin session cookie |
| `PUBLIC_URL` | recommended | Public site URL for X posts and coin metadata |
| `X_POSTING` | no | `true` posts each collapse to X |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | with X_POSTING | X app and user tokens (OAuth 1.0a, read and write) |
| `X_HANDLE`, `GITHUB_URL` | no | Footer links |
| `SERVICE_ROLE` | Railway | `worker` on the worker service. Leave it unset on web. |

## Local development

```bash
npm install
cp .env.example .env              # fill in DATABASE_URL, LAUNCHER_PRIVATE_KEY (a devnet key), ADMIN_PASSWORD
npx prisma migrate deploy
npm run db:seed -- --demo         # optional: devnet demo boxes with real commitment memos
npm run dev                       # http://localhost:3000
npm run worker                    # in a second terminal
```

In TEST_MODE the launcher needs a little devnet SOL for memos (about 0.00002 SOL each). Test tools in `/admin` launch boxes, simulate buys and sells, force decoherence and set fake holders.

## Tests

```bash
npm test        # unit: identity determinism and odds, commitment and memo parsing, fee allocation, payout shares
npm run e2e     # end to end on devnet, in a fresh database schema that is dropped afterwards
```

The e2e test launches boxes with real devnet commitment memos and checks:
- the sealed API hides the seed,
- a first buy collapses the box and records the observer,
- the seed verifies against the on-chain memo, and a tampered seed fails,
- decoherence collapses an unbought box,
- fees are allocated per box,
- an Alive box pays every holder exactly once under 5 simultaneous payout runs,
- the creator is paid once,
- a Dead box buys back and burns exactly once.

## Deploy to Railway

One project with three services: **Postgres**, **web**, **worker**. Both app services deploy this repo; `scripts/start.mjs` picks the role.

1. `railway init`, then `railway add --database postgres`.
2. Create the **web** service from this repo. Set every variable above, with `DATABASE_URL=${{Postgres.DATABASE_URL}}`, and generate a domain.
3. Create the **worker** service from the same repo with the same variables plus `SERVICE_ROLE=worker`.
4. Both services run `prisma migrate deploy` on start. Run `npm run db:seed` once.
5. Optional: in Helius, create a **raw** webhook for the pump.fun program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`. Point it at `https://<domain>/api/webhooks/helius` with the auth header set to `HELIUS_WEBHOOK_SECRET`. The worker's poller works without it.

### Going live on mainnet

- Set `TEST_MODE=false`, a mainnet `LAUNCHER_PRIVATE_KEY`, `HELIUS_API_KEY` and `PUBLIC_URL`.
- Fund the launcher with enough SOL for launches, memos and payout transaction fees.
- Do one launch yourself first, and watch `/admin` through one full fee cycle.

## Known limits

- Creator fees after a coin graduates to PumpSwap are only collected if PumpPortal's `collectCreatorFee` covers them.
- Fee attribution relies on seeing each coin's trade events. SOL that arrives without matching events is recorded as unattributed and not paid out.
- The free ANU endpoint is rate-limited. Busy periods produce classical-fallback boxes, labelled on their pages. Set `QRNG_API_KEY` to avoid that.
