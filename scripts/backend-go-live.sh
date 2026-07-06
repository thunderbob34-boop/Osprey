#!/usr/bin/env bash
# OSPREY backend go-live — runs the full 🔴 sequence from docs/TODO.md §1.
# Safe to re-run: repair/push/deploy are all idempotent.
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd)"

command -v supabase >/dev/null || { echo "❌ supabase CLI not found — brew install supabase/tap/supabase"; exit 1; }

echo "════ 1/5 · Migration history ════"
echo "Migrations 001–015 were originally applied by hand, so the CLI doesn't"
echo "know about them. Current state:"
echo
supabase migration list --linked
echo
read -r -p "Mark 20260628000001 → 20260702000015 as already applied? [y/N] " yn
if [[ "${yn}" =~ ^[Yy]$ ]]; then
  for v in 20260628000001 20260628000002 20260628000003 20260628000004 \
           20260628000005 20260628000006 20260628000007 20260628000008 \
           20260628000009 20260628000010 20260701000011 20260701000012 \
           20260701000013 20260701000014 20260702000015; do
    supabase migration repair --status applied "$v"
  done
  echo "✓ History repaired."
else
  echo "Skipped. (If db push fails with 'already exists' errors, re-run and say yes.)"
fi

echo
echo "════ 2/5 · Apply migrations 016–026 ════"
supabase db push --linked
echo "✓ Database up to date."

echo
echo "════ 3/5 · Deploy edge functions ════"
for f in ozzie-daily-brief ozzie-generate-plan ozzie-nutrition-coach \
         ozzie-meal-photo ozzie-voice-log ozzie-race-briefing \
         ozzie-race-retro ozzie-data-export; do
  echo "→ $f"
  supabase functions deploy "$f"
done
echo "✓ All 8 functions deployed."

echo
echo "════ 4/5 · Secrets ════"
existing=$(supabase secrets list 2>/dev/null || true)

ensure_secret() {
  local name="$1" note="$2"
  if echo "$existing" | grep -q "$name"; then
    echo "✓ $name already set."
  else
    read -r -s -p "Paste $name ($note — Enter to skip): " val; echo
    if [[ -n "$val" ]]; then
      supabase secrets set "$name=$val"
      echo "✓ $name set."
    else
      echo "⚠ $name skipped — set later with: supabase secrets set $name=..."
    fi
  fi
}

ensure_secret OPENAI_API_KEY   "sk-... from platform.openai.com"
ensure_secret ELEVENLABS_API_KEY "from elevenlabs.io profile"
ensure_secret RESEND_API_KEY   "re_... from resend.com; needs verified sending domain"

echo
echo "════ 5/5 · Final state ════"
supabase secrets list
echo
echo "Done. Two things this script CAN'T do (dashboard only):"
echo "  1. Auth → enable Apple + Google providers, add redirect: osprey://auth-callback"
echo "  2. Verify RLS is enabled on all tables (Table Editor)"
echo
echo "Then smoke-test: open the app → generate a plan / trigger the daily brief."
echo "Function logs: https://supabase.com/dashboard/project/jslbutpmgoushkzcghtg/functions"
