# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary users: Fabio and his partner, each with a private personal finance space, plus an optional shared household space (the Casa) that every member of the household can see. Both check the app frequently on iPhone throughout the day — logging a purchase right after making it, or glancing at it before deciding whether to spend.

## Product Purpose

Replaces a Google Sheets budget tracker (Weekly Expense + Income Tracker, fed via Google Forms) that was accurate but unusable from a phone. The product exists to answer one question at a glance, at any moment: "how much can I safely spend right now?" Success is the user trusting that number enough to actually use it instead of guessing from their bank balance.

## Positioning

Unlike a raw bank balance or a generic budgeting app's category totals, this app's headline number ("disponibile libero") already nets out money that is spoken for but not yet spent — money reserved instantly for a goal (bloccato) and money accruing gradually toward a future deadline (dilazionato, e.g. a car tax due in November). A neighboring app that only sums categories or shows the bank balance cannot make the same "safe to spend now" claim truthfully.

## Operating Context

- Daily quick-entry of expenses/income from a phone, ideally under 10 seconds per transaction.
- Periodic manual updates of bank account balances (no bank integration — the user types in the number themselves).
- Occasional creation of budget goals ahead of a known future expense (a trip, a gift, a recurring annual bill) or an immediate one (an upcoming purchase they want to "set aside" money for).
- Reviewing spending history/breakdown by category, less frequently than daily entry.
- Installed to the iPhone Home Screen as a PWA — opened like an app, not typed as a URL each time.

## Capabilities and Constraints

- Supabase Auth accounts, with data protected by Postgres Row Level Security: personal rows (`household_id` null) are readable and writable only by their author; household rows (`household_id` set) are readable and writable by every active member of that household. Personal data is never visible to another member, not even as totals. A household has N members who join with a shareable invite code; no self-service signup.
- Manual-only account balances — deliberately no Open Banking/PSD2 integration (cost and complexity).
- Every write uses optimistic UI (interface updates immediately, write happens in the background); no offline support — the app requires connectivity at the moment of an action, not for the whole session.
- Must run entirely on free tiers: Supabase (Postgres + Auth) and Vercel hosting, €0/month.
- Currency is EUR only, `it-IT` number/date formatting throughout; all UI copy is in Italian.
- Shared household management (common account, monthly contributions, shared expenses and bills) is built in stages; the personal space and the household space stay separate, and the second never exposes the first.

## Brand Commitments

None yet. The app currently has the placeholder name "Budget" and no established visual identity, logo, or color story — this is exactly what's being decided now.

## Evidence on Hand

The original Google Sheet ("Weekly Expense + Income Tracker") exists as a reference for what data and calculations the old system tracked (categories, weekly/monthly rollups, a sinking-fund calculator for irregular expenses), but no historical data is being migrated into the new app — it starts fresh by explicit user decision.

## Product Principles

1. The safe-to-spend number is the product — every screen should make that number feel earned and trustworthy, never like an estimate.
2. Entry speed beats completeness — logging a transaction should never feel like filling out a form.
3. Two private worlds, one shared home: personal finances stay invisible to everyone else in the household, while the household's own money (common account, shared expenses, bills) is visible to all its members. Nothing in the UI should make anyone second-guess which is which.
4. Free-tier-first — no feature should require a paid service or integration.
5. Feels like an app, not a form — the current implementation reads as plain web forms; the product goal is a native-feeling mobile experience (the reason this design pass exists).

## Accessibility & Inclusion

No accessibility standard has been specified by the user. Given the two named users, no specific accessibility need is currently known.
