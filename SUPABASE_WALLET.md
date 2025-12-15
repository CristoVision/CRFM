# Supabase Wallet Artifacts (CRFM)

Run these SQL changes in Supabase (SQL editor or psql) to enable secure wallet flows. Keep this file updated when wallet tables/RPCs change.

## Quick apply
1) Open Supabase SQL editor and run `wallet_actions.sql` from repo root.
2) Verify tables exist: `wallet_action_requests`, `wallet_methods`, `wallet_redeem_codes`.
3) Verify RPC: `request_wallet_action(p_user_id uuid, p_action_type text, p_amount numeric, p_code text, p_metadata jsonb)`.

## Tables
- `wallet_action_requests`
  - Fields: id (uuid pk), user_id (uuid, auth.users fk), action_type (add_funds | withdraw | redeem_code), amount (numeric), code (text), metadata (jsonb), status (pending|processing|approved|rejected), requested_at, processed_at, processed_by, admin_notes.
  - RLS: users can insert/select their own; admins can select/update.
- `wallet_methods`
  - Admin-managed methods shown to users in add funds/withdraw flows.
  - Fields: id, method_type (add_funds|withdraw), name, provider, instructions, is_active, config (jsonb), created_by, created_at, updated_at.
  - RLS: authenticated can select; only admins insert/update.
- `wallet_redeem_codes`
  - Admin-created promo/gift codes.
  - Fields: code (pk), amount (numeric > 0), expires_at, max_uses, usage_count, is_active, metadata (jsonb), created_by, created_at, updated_at.
  - RLS: only admins select/insert/update.

## RPC
- `request_wallet_action` (SECURITY DEFINER)
  - Validates action type/amount/code, enforces user/admin ownership, inserts into `wallet_action_requests`.

## Processing guidance
- Clients only submit requests. Actual balance changes must be done server-side by admins/service-role (e.g., after payment confirmation or payout review).
- For redeem codes: validate server-side (check is_active, expiry, remaining uses), increment usage_count, insert `wallet_transactions`, update `profiles.wallet_balance`.
- For withdrawals: review fraud/AML, then insert `wallet_transactions` with a negative amount and update `profiles.wallet_balance` atomically via RPC or transaction.
- Keep `wallet_methods` curated by admins to control allowed channels for top-ups and payouts. 

## Memberships + promo codes (recommended)
To support creator memberships, membership grants, and subscription-style discounts without Edge Functions:
1) Apply `memberships_and_promo_codes.sql`.
2) Use RPCs:
   - `redeem_code(p_code text, p_metadata jsonb)` → redeems wallet credit codes (`wallet_redeem_codes`) and membership-grant promo codes (`promo_codes`).
   - `purchase_creator_membership(p_creator_id uuid, p_tier_id uuid, p_code text, p_metadata jsonb)` → charges `profiles.wallet_balance`, logs `billing_events`, and applies discount codes.
3) Admins create membership promo codes in `promo_codes`; users redeem grants via Wallet, and apply discounts at membership checkout.
