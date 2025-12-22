# CRFM Assistant Workflow

## Overview
- Non-invasive assistant: minimized by default, persistent per device, no modal blocks.
- Context-aware prompts by route section (home, wallet, hub, upload, admin).
- Safe by design: all data access goes through Supabase with RLS.

## Architecture
- UI: `src/components/assistant/AssistantWidget.jsx`
- Context: `src/contexts/AssistantContext.jsx`
- Client: `src/lib/assistantClient.js`
- Backend: Supabase Edge Function `assistant-chat`
- Knowledge base: `crfm_help_articles`
- Memory: `assistant_conversations`, `assistant_messages`

## Supabase (RLS)
- `crfm_help_articles` can be read by `public` or role-matched users. Admins can write.
- `assistant_conversations` and `assistant_messages` are scoped to `auth.uid()` (admins can read all).
- Actions are gated in the Edge Function by role + RLS.

## Tools (current)
- `search_help` and `list_help`
- `get_wallet_balance`
- `create_playlist`
- `list_creator_tracks`
- `update_track_metadata`
- `list_beta_applications` (admin)
- `list_content_flags` (admin)

## Notes
- Guest sessions can read public help content but do not persist conversations.
- The assistant will answer only from internal help content. If no evidence exists, it replies with "not available yet".

## QA Checklist
- Guest can open assistant and read "how it works", no private data.
- User can see wallet balance and get top-up guidance.
- Creator can list/update own tracks, not others.
- Admin can review beta applications and flags, no extra data beyond admin scope.
- Forbidden requests always respond with RLS/role denial.
