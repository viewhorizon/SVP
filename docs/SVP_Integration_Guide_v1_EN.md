# Architecture and Integration Guide — SVP Ecosystem
### Global Voting and Points System

| Field | Value |
|---|---|
| **Version** | 1.0 — Final |
| **Date** | November 2026 |
| **Audience** | Developer agent for the SVP core and for client platforms (Global Inventory, Ranking, Local Inventories) |
| **Purpose** | Master integration document: economic model, business rules, linking requirements and API contract |

---

## Index

1. [Vision and Tech Stack](#1-vision-and-tech-stack)
2. [Economic Model and Points Formula](#2-economic-model-and-points-formula)
3. [Voting Rules and Security](#3-voting-rules-and-security)
4. [Identity and Authentication](#4-identity-and-authentication)
5. [Information Required to Link a Platform](#5-information-required-to-link-a-platform)
6. [API Contract (Platform ↔ SVP)](#6-api-contract-platform--svp)
7. [Asset Management and Bidirectional Economy](#7-asset-management-and-bidirectional-economy)
8. [Design Notes for Internal Game Mechanics](#8-design-notes-for-internal-game-mechanics)
9. [Next Steps for the Developer Agent](#9-next-steps-for-the-developer-agent)
10. [Decision Log](#10-decision-log)

---

## 1. Vision and Tech Stack

### 1.1 Role of the SVP in the ecosystem

The SVP (Voting and Points System) is the central infrastructure of the platform ecosystem. It acts as the **Central Bank and Ledger**: it does not manage the internal logic of games or client platforms, but guarantees a unified and auditable economy.

**Core responsibilities:**

1. **Platform registration** — each client platform receives a unique `platform_id` and its `platform_secret`.
2. **Activity logging** — reception of validated hours reported by authenticated platforms.
3. **Points calculation** — application of the official formula and crediting to the user's history.
4. **Voting management** — local and global votes on activities.
5. **Asset ledger** — freezing, release and valuation of points tied to objects.
6. **Identity** — central Identity Provider (IdP): issuance and validation of JWTs.

**Key rule:** the SVP **does not actively push points** to platforms. Platforms *query* the balance (`GET /balance`) and *request* debits (`/spend`), credits (`/valuations`) or releases (`/release`). The SVP is the Single Source of Truth for the ecosystem economy.

### 1.2 Definitive Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + TSX | Deployed on Vercel |
| Backend | NestJS | Migrated from Express; serverless deployment on Vercel |
| Database | PostgreSQL (Neon) | Immutable ledger and source of truth |
| Cache / Security | Redis | Distributed rate limiting and voting-threshold control |

### 1.3 Historical note

The initial prototype was a Telegram chatbot backed by MongoDB. That architecture was discarded for the SVP core: the definitive system uses **PostgreSQL hosted on Neon** (serverless, integrated with the Vercel deployment flow). The original bot README remains only as historical reference for concepts (daily votes, daily points, transfers) that **do not apply** to the current model.

---

## 2. Economic Model and Points Formula

### 2.1 Official Formula

```text
total_points = (local_votes + global_votes) × (accumulated_hours ÷ worldwide_similar_activities_count) + svp_voting_bonus
```

**Components:**

| Term | Meaning | Defined by |
|---|---|---|
| `local_votes` | Votes cast within the scope of a specific platform | User |
| `global_votes` | Votes cast within the scope of the SVP | User |
| `accumulated_hours` | Hours of activity validated and reported by linked platforms | Client platform (source data) |
| `worldwide_similar_activities_count` | Number of activities in the same category registered globally | SVP (anti-inflation divisor) |
| `svp_voting_bonus` | Incentive for voting on the SVP platform | SVP |

### 2.2 Definition of Activities

An **activity** is a real human action — a trade, hobby or task — not an internal digital event of a game:

- Examples: hairdressing, bakery, cyclist, PC repair technician.

Each activity belongs to a **category** (e.g. `technology`, `gastronomy`, `personal_care`, `sports`). The formula's divisor is computed per category: if there are 150 "PC repair technicians" registered globally, a user's hours are divided by 150. This balances point generation in saturated categories.

### 2.3 Generation Flow

```text
User performs an activity (trade/hobby)
        ↓
Platform validates and reports hours → POST /api/v1/activity
        ↓
SVP logs hours in the user's ledger
        ↓
User votes on activities (local/global) → POST /api/v1/votes
        ↓
SVP computes: (votes × hours ÷ similar_activities) + bonus
        ↓
Points credited (permanent)
```

### 2.4 Immutability of Points

Points earned from hours of activity represent the user's **real work** and are **permanent**: they are never removed from the total history. Practical consequences:

- Buying an object **freezes** (locks) points; it does not destroy them.
- Melting an object **releases** the frozen base points: the user always recovers the original investment.
- Depreciation of an object can only subtract **earned appreciation** (available points), never the frozen base points.

---

## 3. Voting Rules and Security

### 3.1 Unlimited votes

There is no daily vote limit. A user may vote on as many activities as desired.

### 3.2 Two-Phase Anti-Abuse System

To prevent unlimited votes from degenerating into meaningless spam:

1. **Phase 1 (single click):** the first N votes from a user are registered with a single click.
2. **Phase 2 (criterion/confirmation):** once the threshold is exceeded, the system requires a confirmation step with a criterion (the `criterion` field) before registering the vote.

The threshold N is configurable by the SVP.

### 3.3 Distributed Rate Limiting (Backend)

Mandatory technical backing: implement `distributedRateLimit.ts` with Redis to limit the voting rate (example: at most 1 vote per second per user/IP, or 100 votes per hour). This prevents automation via scripts without restricting legitimate users.

---

## 4. Identity and Authentication

### 4.1 The SVP as Identity Provider (IdP)

- **Forbidden:** client platforms creating their own users or authentication systems.
- **Mandatory:** consume and validate the JWT issued by the SVP; extract the `user_id` from the token.

### 4.2 User Flow

```text
User → Login on SVP → JWT issued
        ↓
Platform receives the user's JWT
        ↓
Platform validates the JWT against the SVP
        ↓
Access granted + user_id known
```

Header for user requests: `Authorization: Bearer <user_jwt>`

### 4.3 Platform → SVP Authentication (M2M)

For background operations (hours reporting, valuations), each platform uses its service credentials in headers:

- `x-platform-id: <id>`
- `x-platform-secret: <secret>`

---

## 5. Information Required to Link a Platform

Any platform wishing to integrate with the SVP must provide the following information, organized into four blocks.

### Block A — Platform Registration (Onboarding)

| # | Field | Description | Example |
|---|-------|-------------|---------|
| A1 | `platform_id` | Unique identifier assigned by the SVP | `inventory-global` |
| A2 | `platform_secret` | Service secret for M2M authentication | `••••••••` |
| A3 | Commercial name | Human-readable name | `Global Inventory` |
| A4 | Platform type | Functional category | `inventory`, `ranking`, `local` |
| A5 | Technical contact | Integration owner | `tech@platform.app` |
| A6 | Webhook / callback URL | Asynchronous notifications from the SVP | `https://.../svp/webhook` |
| A7 | Estimated volume | Expected reports/day (sizing) | `~5,000` |

### Block B — Activity Data (per report)

| # | Field | Type | Required | Description |
|---|-------|------|-------------|-------------|
| B1 | `user_id` | string | Yes | Unified identity (extracted from the JWT, not created by the platform) |
| B2 | `activity_name` | string | Yes | Real human activity (e.g. `PC Repair Technician`) |
| B3 | `activity_hours` | float | Yes | Hours validated by the platform |
| B4 | `session_id` | string | Yes | Traceability and idempotency |
| B5 | `timestamp` | ISO 8601 | Yes | Moment of the report |

### Block C — User Identity

| # | Requirement | Detail |
|---|-----------|---------|
| C1 | Valid JWT issued by the SVP | Required for actions on behalf of the user |
| C2 | Unified `user_id` | Recognized by the SVP and all platforms |
| C3 | Token validation | The platform validates the JWT against the SVP before operating |

### Block D — Operational Information (Recommended)

| # | Field | Purpose |
|---|-------|-----------|
| D1 | Supported activity types | Cataloging in the points engine |
| D2 | Hours validation policy | How the platform validates before reporting (the SVP trusts the report) |
| D3 | Expected SLA | SVP sizing |
| D4 | Retry strategy | Internal retry/DLQ so hours are not lost if the SVP goes down |

---

## 6. API Contract (Platform ↔ SVP)

Base URL: `/api/v1`. Format: JSON. Timestamps: ISO 8601.

### 6.1 Activity Reporting (Platform → SVP)

**`POST /api/v1/activity`** — Headers: `x-platform-id`, `x-platform-secret`

Request:
```json
{
  "user_id": "usr_abc123",
  "activity_name": "PC Repair Technician",
  "activity_hours": 3.5,
  "session_id": "sess_xyz789",
  "timestamp": "2026-04-18T20:00:00Z"
}
```

Response `200 OK`:
```json
{
  "status": "credited",
  "activity_id": "act_987",
  "hours_registered": 3.5,
  "message": "Hours logged in the user's ledger."
}
```

*Idempotency:* a repeated `session_id` returns the original result without duplicating the record.

### 6.2 Vote Casting (User → SVP)

**`POST /api/v1/votes`** — Headers: `Authorization: Bearer <user_jwt>`

Request:
```json
{
  "activity_id": "act_987",
  "scope": "global",
  "require_confirmation": false
}
```

- `scope`: `global` | `local`
- If `require_confirmation` is `true` (Phase 2 of anti-abuse), the body must include `criterion`:

```json
{
  "activity_id": "act_987",
  "scope": "global",
  "require_confirmation": true,
  "criterion": "Activity personally verified"
}
```

Response `201 Created`:
```json
{
  "status": "vote_registered",
  "activity_id": "act_987",
  "points_generated_this_vote": 15.4,
  "bonus_applied": 2.0
}
```

### 6.3 Balance Query

**`GET /api/v1/users/{user_id}/balance`** — Headers: `Authorization: Bearer <user_jwt>` or M2M credentials.

Response `200 OK`:
```json
{
  "user_id": "usr_abc123",
  "total_points": 1540.75,
  "available_points": 1440.75,
  "frozen_points": 100.0,
  "breakdown": {
    "local_votes": 12,
    "global_votes": 8,
    "total_hours_accumulated": 45.0,
    "similar_activities_worldwide": 150,
    "total_bonus": 20.0
  }
}
```

- `total_points`: permanent earned history (immutable).
- `frozen_points`: points frozen in assets.
- `available_points`: `total_points − frozen_points` (spendable).

### 6.4 Activity Catalog

**`GET /api/v1/activities?category=technology`**

Response `200 OK`:
```json
{
  "activities": [
    {
      "activity_id": "act_987",
      "name": "PC Repair Technician",
      "category": "technology",
      "global_vote_count": 450,
      "similar_activities_count": 150
    }
  ]
}
```

`similar_activities_count` is the formula's divisor; it lets the frontend preview the points to be generated.

### 6.5 Spending / Freezing Points (Points → Object)

**`POST /api/v1/users/{user_id}/spend`** — Headers: `Authorization: Bearer <user_jwt>` + `x-platform-id`

Request:
```json
{
  "amount": 100.0,
  "reason": "Object Redemption: Legendary Sword",
  "reference_id": "inv_obj_998",
  "lock_asset": true
}
```

- `lock_asset: true` → **freezes** (does not destroy) the points and returns a `lock_id`.
- `lock_asset: false` → simple spend (consumption with no associated asset).

Response `200 OK`:
```json
{
  "status": "success",
  "lock_id": "lock_555",
  "points_locked": 100.0,
  "remaining_available": 1340.75,
  "transaction_id": "txn_svp_999"
}
```

Response `400` — insufficient balance:
```json
{
  "status": "error",
  "code": "INSUFFICIENT_FUNDS",
  "message": "The user does not have enough available points."
}
```

### 6.6 Asset Valuation (Appreciation / Depreciation)

**`POST /api/v1/valuations`** — Headers: `x-platform-id`, `x-platform-secret`

Request:
```json
{
  "user_id": "usr_abc123",
  "reference_id": "inv_obj_998",
  "value_delta": 50.0,
  "reason": "Appreciation: Level 2 Evolution"
}
```

- `value_delta > 0` → credits **new** points to the user (appreciation), which are added to the permanent history.
- `value_delta < 0` → subtracts available points from the appreciation, **without being able to exceed the frozen base points** of the associated `lock_id`.

Response `200 OK`:
```json
{
  "status": "valued",
  "points_credited": 50.0,
  "user_new_balance": 1590.75
}
```

### 6.7 Point Release (Object → Available Points)

**`POST /api/v1/users/{user_id}/release`** — Headers: `Authorization: Bearer <user_jwt>` + `x-platform-id`

Request:
```json
{
  "lock_id": "lock_555",
  "reference_id": "inv_obj_998",
  "reason": "Object melted by the user"
}
```

Response `200 OK`:
```json
{
  "status": "released",
  "points_released": 100.0,
  "remaining_frozen": 0.0
}
```

The user recovers the base points in full. The object must be marked inactive in the Inventory and will no longer accept valuations for that `reference_id`.

### 6.8 Common Error Codes

| Code | HTTP | Meaning |
|--------|------|-------------|
| `INVALID_TOKEN` / `TOKEN_EXPIRED` | 401 | Invalid or expired JWT |
| `PLATFORM_NOT_REGISTERED` / `INVALID_PLATFORM_CREDENTIALS` | 401/403 | Invalid M2M credentials |
| `INSUFFICIENT_FUNDS` | 400 | Insufficient available balance |
| `ACTIVITY_NOT_FOUND` | 404 | Nonexistent `activity_id` |
| `LOCK_NOT_FOUND` | 404 | Nonexistent or already-released `lock_id` |
| `DUPLICATE_SESSION` | 409 | `session_id` already processed (see idempotency) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `CONFIRMATION_REQUIRED` | 400 | Threshold exceeded: `criterion` is required |

### 6.9 Endpoint Summary

| Endpoint | Method | Authentication | Purpose |
|---|---|---|---|
| `/api/v1/activity` | POST | M2M | Report validated hours |
| `/api/v1/votes` | POST | User JWT | Cast a vote (triggers points calculation) |
| `/api/v1/users/{user_id}/balance` | GET | JWT or M2M | Balance + formula breakdown |
| `/api/v1/activities` | GET | Public | Catalog and divisor per category |
| `/api/v1/users/{user_id}/spend` | POST | JWT + M2M | Freeze/spend points (asset purchase) |
| `/api/v1/valuations` | POST | M2M | Report asset value delta |
| `/api/v1/users/{user_id}/release` | POST | JWT + M2M | Release frozen points (melting) |

---

## 7. Asset Management and Bidirectional Economy

The Inventory (and any platform with appreciable assets, e.g. Ranking with characters that level up) operates under this model.

### 7.1 Golden Rule

The SVP **does not know or evaluate** the internal logic of objects (static/dynamic, evolution, transformation). The platform is solely responsible for computing the object's value in points at each moment. The SVP only records the reported **value delta**.

### 7.2 Asset Lifecycle

```text
Purchase:      available points → frozen (lock_id)            [POST /spend]
Appreciation:  appreciation → NEW points to the history       [POST /valuations, delta > 0]
Depreciation:  subtracts from appreciation (never from base)  [POST /valuations, delta < 0]
Melting:       frozen → available (full base recovered)       [POST /release]
```

### 7.3 Use Case: Switching Games

The user plays game A with an object bought for 100 points. They abandon game A:

1. Melt the object → `POST /release` → recover the full 100 base points.
2. Buy an object for game B → `POST /spend` with a new `reference_id` → new `lock_id`.

The accumulated appreciation of object A was already credited as new points at the time (or it is settled on melting, depending on the Inventory's mechanics).

---

## 8. Design Notes for Internal Game Mechanics

*This section goes beyond the API contract but guides the design of the Inventory and future games. Managing gameplay impact is the exclusive responsibility of the game/inventory; the SVP only records values.*

**Problem:** revaluing an object can break a game's balance.

**Suggested strategies:**

1. **Weakening (Nerf):** if an object accumulates a lot of appreciation, the game may reduce its internal stats to preserve gameplay, justifying its higher acquisition cost.
2. **Slot Sale:** the user may sell the slot/revalued object to another user within the platform in exchange for available points, transferring asset ownership (the `lock_id` changes owner).

Whatever internal mechanic is chosen, the final result in points is communicated to the SVP via `/valuations` (or through `lock_id` transfer between users, if the SVP supports it in future versions).

---

## 9. Next Steps for the Developer Agent

### 9.1 Initial Setup

1. NestJS project connected to PostgreSQL (Neon) via an ORM (Prisma or Drizzle recommended for serverless).
2. Redis for `distributedRateLimit.ts`.
3. JWT issuance (SVP as IdP).

### 9.2 SVPMockClient

Implement the mock first (same interface as the real client) so frontend development is not blocked:

- Deterministic data + simulated latency (200–800 ms).
- Error scenarios (DLQ, rate-limit, insufficient balance).
- Coverage of all 7 contract endpoints.

### 9.3 Initial SQL Migrations

| Table | Key contents |
|---|---|
| `users` | `user_id`, JWT subject, `created_at` |
| `platforms` | `platform_id`, secret hash, type, status, webhook |
| `activities` | `activity_id`, name, category |
| `activity_reports` | `user_id`, `platform_id`, `activity_id`, hours, `session_id` (unique) |
| `votes` | `user_id`, `activity_id`, `scope`, `criterion`, timestamp |
| `points_ledger` | `transaction_id`, `user_id`, type (credit/freeze/release/valuation), amount, reference — **immutable** |
| `asset_locks` | `lock_id`, `user_id`, `platform_id`, `reference_id`, amount, status (active/released) |

### 9.4 Sprint Plan (6 × 15–20 days)

| Sprint | Scope |
|--------|---------|
| 1 | SVPMockClient + activity/balance UI + TypeScript types for the contract |
| 2 | Real backend: `POST /activity` + JWT and M2M authentication |
| 3 | First real integration (Ranking ↔ SVP) |
| 4 | Complete voting module (incl. two-phase anti-abuse) |
| 5 | Accounting reconciliation, DLQ, operational alerts |
| 6 | Integration protocol for local inventories + SDK documentation |

---

## 10. Decision Log

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Points model | `(local_votes + global_votes) × (hours ÷ similar_activities) + bonus`. Votes are the main driver; there are no free daily points and no limited daily votes |
| 2 | Vote limit | Unlimited; two-phase anti-abuse (click → confirmation with criterion) + Redis rate limit |
| 3 | Backend | NestJS on Vercel (migrated from Express) |
| 4 | Database | PostgreSQL on Neon (MongoDB discarded for the SVP; it was only for the Telegram chatbot) |
| 5 | Identity | SVP as IdP; JWT for end users |
| 6 | Platform M2M | `x-platform-id` + `x-platform-secret` |
| 7 | Activity definition | Real human trade/hobby, grouped by category |
| 8 | Immutability | Points from hours = permanent; purchase freezes, melting releases |
| 9 | Asset economy | Freezing + appreciation (new points) + depreciation bounded by the lock |
| 10 | Gameplay | Nerf / slot sale: responsibility of the game/inventory, communicated via `/valuations` |

---

*Master integration document. Any change to the API contract requires updating this document and notifying connected platforms.*

---

## Developer-Agent Review Addendum — updated 2026-11-27

This addendum records implementation findings, user-confirmed decisions, and remaining questions. The user has confirmed that v1 is the target integration contract, including its endpoint set; the current repository is not yet aligned and must be brought to that target. This addendum does not change the original v1 contract.

### A. Verified differences from the current repository

| Guide v1 statement | Current implementation observed | Impact |
|---|---|---|
| NestJS backend | The current backend uses Express route factories and `express()` application setup. | The framework migration described in v1 is not reflected in this codebase. |
| Formula `((local_votes + global_votes) ÷ similar_activities) × hours + bonus` | External event ingestion currently calculates `activityHours × totalVotes` (or `score` for an achievement signal), then applies configured source rates and policy rules. The canonical `/api/svp/votes` endpoint grants points from `point_rules`. It does not implement the v1 divisor or `svp_voting_bonus`. | The user confirmed v1 is the target. Example: `((1200 + 1200) ÷ 150) × 3 = 48` points before any bonus. The current calculation must be migrated; this is not an open product decision. |
| Unlimited votes and threshold-triggered `criterion` confirmation | The canonical vote endpoint enforces a configurable daily limit from `point_limits` (fallback 5) and a rate limiter. Its validated request does not implement the guide's two-phase `criterion` field. | Vote limits and anti-abuse behavior contradict the guide. |
| `/api/v1/activity`, `/api/v1/votes`, balance, spend, valuation and release routes | The repository exposes different contracts, including `/api/events/results`, `/api/v1/events/results`, `/api/svp/votes`, `/api/v1/svp/votes`, `/api/points/*`, and `/api/inventory/*`. The guide's listed paths were not found as implemented routes. | A client built directly against v1 endpoints will not interoperate with the current API. |
| SVP-issued user JWT and per-platform `x-platform-id` / `x-platform-secret` | User vote routes use the existing `requireAuth` middleware; external event routes rely on the optional shared webhook secret and identity links. The inspected event routes do not validate the guide's platform credential pair or a Bearer JWT. | Identity and M2M authentication contracts are not aligned. |
| Spending freezes points in an `asset_lock`; melting releases the frozen base | Current inventory routes use a points wallet and ledger with inventory purchase/lifecycle operations; the guide's `spend` / `release` lock contract and `asset_locks` model were not found. | The permanent-earned / available / frozen accounting model is not implemented as described in v1. |
| Redis-backed distributed rate limiting | The canonical vote route currently attaches `votesRateLimit`; the guide's Redis-based `distributedRateLimit.ts` requirement is not evidence of an active Redis implementation. | Confirm the production rate-limit backend before claiming distributed enforcement. |

The code supports PostgreSQL and an Express backend, so the high-level database choice aligns; v1's NestJS status does not.

### B. Security finding for external events

`POST /api/events/validate` and `POST /api/events/results` only compare `x-webhook-secret` when `WEBHOOK_SHARED_SECRET` is configured. If the secret is absent, those routes currently continue without it. They do not verify `x-platform-id` / `x-platform-secret`, Bearer JWT, or HMAC timestamp/signature. HMAC handling on `POST /api/webhooks/points/credit` is a separate route and does not secure event ingestion. Do not expose event ingestion publicly on the assumption that v1's authentication headers are enforced.

### C. Contributions and recommendations recorded

1. Treat the points ledger as append-only: never edit or delete a confirmed posting. Correct mistakes with compensating entries linked to the original, preserving the audit trail.
2. Keep operational records (such as profile, catalog, and identity-link data) mutable only where the workflow needs it, and record actor, timestamp, reason, and before/after values. The current identity-link upsert can reassign an existing `sourceApp + externalUserId` to another `svpUserId`; decide whether this requires versioning and explicit approval/audit.
3. A hash chain detects many alterations but cannot alone stop a privileged operator from rewriting the whole chain. Recommended, not implemented: periodically anchor signed ledger-close hashes outside the transactional database, with independent retention, hash/version metadata, timestamp, and a verification procedure.
4. Interpret gold/Bitcoin as inspiration for scarcity, predictable rules, and verifiability—not as proof that SVP points are money, a marketable asset, or redeemable for external value.
5. Require production event authentication, HMAC over the original request body and timestamp, replay protection, and contract tests before publishing the M2M integration contract.

### D. Direction confirmed by the user — 2026-11-27

- v1 is the target integration specification; its endpoint set is authoritative. Contributions added to the API contract must be implemented, not left as documentation-only proposals.
- Target formula: `((global_votes + local_votes) / worldwide_similar_activities_count) * registered_user_activity_hours + svp_voting_bonus`. The clarified example produces 48 points before bonus: `((1200 + 1200) / 150) * 3`.
- Global/local example: a global hair-salon activity and a local hair-salon brand are rated; the similar-activity denominator is the relevant hairdresser activity population.
- Vault is a linked inventory/trading platform. SVP remains the source of truth for points. Points converted to Vault objects remain in SVP but are locked and unavailable for SVP spending/transfers until converted back.
- Object properties gained/lost through gameplay and market demand can change the object's Vault market price, denominated in points. This is object valuation, not permission to mint or alter SVP points outside the defined conversion/settlement rules.

### E. Decision checklist

#### Confirmed

- [x] Use the v1 endpoint set as the target contract; implement its contracts and accepted contributions.
- [x] Use the clarified votes/divisor/hours formula above; the supplied example yields 48 points before bonus.
- [x] Keep global and local voting scopes and distinguish the rated global activity, local brand, and similar-activity category.
- [x] Keep points in SVP. Vault owns object/gameplay/market behavior; SVP owns point balances and locking.
- [x] Lock converted points against an object; they cannot be spent or transferred inside SVP while locked; conversion back releases them.
- [x] Model appreciation/depreciation as changes to Vault objects and their point-denominated market price, not automatic changes to SVP's point supply.
- [x] Integrate the documented contributions into implementation, not docs alone: append-only ledger corrections via compensating entries; durable idempotency on mutations; authenticated, replay-protected M2M requests; and periodic signed ledger-hash anchors stored independently of the transactional database.

#### Still needs an answer before the affected feature is implemented

**Formula and voting**

- [ ] Define `worldwide_similar_activities_count` precisely: count of active registered people, activity records, or another unit? Confirm that hairdressers are the denominator for the salon example; define category ownership, eligibility, zero handling, minimum, and the as-of timestamp/snapshot.
- [ ] Confirm whether one user may cast both a local and global vote on the same subject, whether local votes also feed global totals, and the deduplication rule for each scope.
- [ ] Define how registered-user hours are validated, capped per report/period, corrected, and attributed to an activity/category.
- [ ] Define `svp_voting_bonus`: eligibility, calculation, caps, and whether it is awarded per vote, period, or activity.
- [ ] Set rounding/precision and persist the formula version plus input snapshot with every ledger posting so past credits are reproducible.
- [ ] Confirm the anti-abuse policy that coexists with v1's unlimited votes and its confirmation threshold: threshold value, what counts as a criterion, and what evidence makes a vote eligible. Rate limits alone do not stop Sybil or duplicate voting.

**Vault conversion and trading**

- [ ] Define the immutable 1:1 base precisely: what is the unit (one object, one property unit, or one point), and does the buyer lock the base amount or the full purchase price?
- [ ] On object-to-points conversion, does SVP release the original locked quantity or the current Vault market price? If the market price has fallen, can the holder still redeem the original lock?
- [ ] When an upgraded/high-demand object costs more points, specify where the premium goes and whether it is locked, transferred to the seller, or otherwise settled. Define atomic buyer payment, seller proceeds, object ownership transfer, and lock ownership.
- [ ] Define the accounting when an object's market price differs from its immutable 1:1 base, so trading or redemption cannot silently create, destroy, or double-lock SVP points. The confirmed model is that revaluation changes the Vault object price, not the SVP point supply.
- [ ] Specify who is authoritative for gameplay properties, demand, market price, and valuation reports (Vault, SVP policy, or another trusted service); define stale/out-of-order update handling and post-melt valuation rejection.

**API, identity, and operations**

- [ ] Define durable idempotency for every mutating v1 endpoint: key scope, replay response, and conflict behavior when the same key is reused with a different payload. `session_id` alone is underspecified for multi-platform use.
- [ ] Specify the contributed HMAC-SHA256 contract for M2M writes: canonical signed method/path/timestamp/raw-body (and idempotency key), timestamp tolerance, key storage/rotation, and durable replay handling. Keep `x-platform-id` as the key identifier; never transmit a platform secret as a substitute for signature verification. The current event routes allow requests through when their optional shared secret is unset.
- [ ] Define user consent and authorization boundaries for platform-reported hours, point spending, object release, and user-ID/path matching; specify JWT issuer/audience, key discovery, expiry/revocation, and platform scopes.
- [ ] Resolve the callback URL in platform onboarding against the pull-based rule that SVP does not push points. If callbacks remain, define event types, signatures, retries, and delivery guarantees.
- [ ] Confirm the required deployment timing for the guide's NestJS and Redis architecture; the present backend is Express, and the current vote limiter is not evidence of a production Redis-backed distributed limiter.
- [ ] Set hash-anchor cadence, signing-key custody/rotation, independent storage, retention, and verification procedure for the recommended periodic signed ledger hashes. This is audit hardening, distinct from point accounting correctness.

Until these answers are recorded, implementation can proceed on clearly defined API scaffolding and tests, but must not invent Vault redemption, premium settlement, denominator, bonus, or issuance semantics. Keep the original v1 text intact; this dated addendum records the confirmed direction and open decisions.
