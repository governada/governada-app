#!/usr/bin/env bash
# Notify the founder via configured channels when agent attention is needed.
#
# Usage:
#   bash scripts/notify.sh "Decision gate reached" "Step 7 build plan ready for review"
#   bash scripts/notify.sh "Deploy blocked" "Smoke test failed on PR #185"
#   bash scripts/notify.sh "Edge case" "Chunk agent hit unexpected fork — needs input"
#
# Channels (sends to all configured):
#   - Discord webhook (DISCORD_WEBHOOK_URL)
#   - Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_FOUNDER_CHAT_ID)
#
# Set NOTIFY_DISABLED=1 to suppress all notifications (e.g., during testing).

set -euo pipefail

TITLE="${1:?Usage: notify.sh <title> <message>}"
MESSAGE="${2:-No details provided}"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")

if [ "${NOTIFY_DISABLED:-0}" = "1" ]; then
  echo "Notifications disabled. Would have sent: [$TITLE] $MESSAGE"
  exit 0
fi

SENT=0

# --- Discord ---
if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
  # Discord embed for rich formatting
  PAYLOAD=$(cat <<ENDJSON
{
  "embeds": [{
    "title": "🔔 $TITLE",
    "description": "$MESSAGE",
    "color": 5814783,
    "footer": {"text": "Civica Agent • $TIMESTAMP"},
    "fields": [
      {"name": "Action Required", "value": "Check your Claude Code session", "inline": true}
    ]
  }]
}
ENDJSON
  )

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "Discord: sent"
    SENT=$((SENT + 1))
  else
    echo "Discord: failed (HTTP $HTTP_CODE)"
  fi
fi

# --- Telegram ---
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_FOUNDER_CHAT_ID:-}" ]; then
  TELEGRAM_TEXT="🔔 *$TITLE*

$MESSAGE

_Civica Agent • $TIMESTAMP_"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${TELEGRAM_FOUNDER_CHAT_ID}\", \"text\": $(echo "$TELEGRAM_TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"parse_mode\": \"Markdown\"}" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "Telegram: sent"
    SENT=$((SENT + 1))
  else
    echo "Telegram: failed (HTTP $HTTP_CODE)"
  fi
fi

# --- Summary ---
if [ "$SENT" -eq 0 ]; then
  echo "WARNING: No notification channels configured or all failed."
  echo "Set DISCORD_WEBHOOK_URL and/or TELEGRAM_BOT_TOKEN + TELEGRAM_FOUNDER_CHAT_ID"
  exit 1
fi

echo "Notified via $SENT channel(s)"
