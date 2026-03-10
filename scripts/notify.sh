#!/usr/bin/env bash
# Notify the founder via configured channels when agent attention is needed.
#
# Usage:
#   bash scripts/notify.sh "decision_gate" "Step 7 build plan ready" "5 chunks proposed, 2 migrations, est. ~45 min build time"
#   bash scripts/notify.sh "deploy_blocked" "Smoke test failed" "PR #185 merged but /api/health returns 503. Remaining 3 PRs paused."
#   bash scripts/notify.sh "escalation" "Unexpected schema conflict" "Chunk 3 needs drep_scores table but chunk 1 renamed it."
#   bash scripts/notify.sh "complete" "Build step 7 finished" "4/5 chunks deployed. Post-build audit: UX 8/10, Security 7/10."
#
# Alert types: decision_gate | deploy_blocked | escalation | complete | info
#
# Channels (sends to all configured):
#   - Discord agent alerts (DISCORD_AGENT_WEBHOOK_URL) -- dedicated #agent-alerts channel
#   - Discord fallback (DISCORD_WEBHOOK_URL) -- used only if agent webhook not set
#   - Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_FOUNDER_CHAT_ID)
#
# Set NOTIFY_DISABLED=1 to suppress all notifications (e.g., during testing).

set -euo pipefail

# --- Auto-source .env.local ---
# Find .env.local relative to script location or common paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for ENV_PATH in \
  "$SCRIPT_DIR/../.env.local" \
  "$SCRIPT_DIR/../../governada-app/.env.local" \
  "/c/Users/dalto/governada/governada-app/.env.local"; do
  if [ -f "$ENV_PATH" ]; then
    # Source only the vars we need (avoid breaking on Next.js-specific syntax)
    while IFS='=' read -r key value; do
      case "$key" in
        DISCORD_AGENT_WEBHOOK_URL|DISCORD_WEBHOOK_URL|TELEGRAM_BOT_TOKEN|TELEGRAM_FOUNDER_CHAT_ID)
          # Strip surrounding quotes if present
          value="${value#\"}"
          value="${value%\"}"
          export "$key=$value"
          ;;
      esac
    done < "$ENV_PATH"
    break
  fi
done

# --- Args ---
ALERT_TYPE="${1:?Usage: notify.sh <alert_type> <title> [details]}"
TITLE="${2:?Usage: notify.sh <alert_type> <title> [details]}"
DETAILS="${3:-}"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")

if [ "${NOTIFY_DISABLED:-0}" = "1" ]; then
  echo "Notifications disabled. Would have sent: [$ALERT_TYPE] $TITLE -- $DETAILS"
  exit 0
fi

# --- Alert type configuration ---
# Color codes (decimal): red=16711680, orange=16744448, yellow=16776960, green=5763719, blue=5814783
case "$ALERT_TYPE" in
  decision_gate)
    EMOJI="⏸️"
    COLOR=16776960  # yellow
    ACTION="Review the proposed plan and approve or request changes"
    URGENCY="WAITING FOR YOUR INPUT"
    ;;
  deploy_blocked)
    EMOJI="🚨"
    COLOR=16711680  # red
    ACTION="Check the error details and decide how to proceed"
    URGENCY="DEPLOY HALTED -- ACTION REQUIRED"
    ;;
  escalation)
    EMOJI="⚠️"
    COLOR=16744448  # orange
    ACTION="Agent hit an unexpected situation and needs your guidance"
    URGENCY="AGENT BLOCKED -- NEEDS GUIDANCE"
    ;;
  complete)
    EMOJI="✅"
    COLOR=5763719   # green
    ACTION="Review the results at your convenience"
    URGENCY="COMPLETED"
    ;;
  *)
    EMOJI="ℹ️"
    COLOR=5814783   # blue
    ACTION="No immediate action required"
    URGENCY="INFO"
    ;;
esac

SENT=0

# --- Discord ---
DISCORD_URL="${DISCORD_AGENT_WEBHOOK_URL:-${DISCORD_WEBHOOK_URL:-}}"

if [ -n "$DISCORD_URL" ]; then
  # Build fields array
  FIELDS="[{\"name\": \"Status\", \"value\": \"$URGENCY\", \"inline\": true}"

  if [ -n "$DETAILS" ]; then
    # Escape special JSON characters in details
    ESCAPED_DETAILS=$(echo "$DETAILS" | python3 -c 'import json,sys; print(json.loads(json.dumps(sys.stdin.read().strip())))')
    FIELDS="$FIELDS, {\"name\": \"Details\", \"value\": \"$ESCAPED_DETAILS\", \"inline\": false}"
  fi

  FIELDS="$FIELDS, {\"name\": \"Next Step\", \"value\": \"$ACTION\", \"inline\": false}]"

  # Build payload with python for safe JSON encoding
  PAYLOAD=$(python3 -c "
import json
payload = {
    'embeds': [{
        'title': '$EMOJI $TITLE',
        'color': $COLOR,
        'footer': {'text': 'Governada Agent \u2022 $TIMESTAMP'},
        'fields': json.loads('''$FIELDS''')
    }]
}
print(json.dumps(payload))
")

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$DISCORD_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "Discord: sent ($ALERT_TYPE)"
    SENT=$((SENT + 1))
  else
    echo "Discord: failed (HTTP $HTTP_CODE)"
  fi
fi

# --- Telegram ---
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_FOUNDER_CHAT_ID:-}" ]; then
  TELEGRAM_TEXT="$EMOJI *$TITLE*

*$URGENCY*"

  if [ -n "$DETAILS" ]; then
    TELEGRAM_TEXT="$TELEGRAM_TEXT

$DETAILS"
  fi

  TELEGRAM_TEXT="$TELEGRAM_TEXT

_Next: $ACTION_

_Governada Agent \u2022 $TIMESTAMP_"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${TELEGRAM_FOUNDER_CHAT_ID}\", \"text\": $(echo "$TELEGRAM_TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"parse_mode\": \"Markdown\"}" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "Telegram: sent ($ALERT_TYPE)"
    SENT=$((SENT + 1))
  else
    echo "Telegram: failed (HTTP $HTTP_CODE)"
  fi
fi

# --- Summary ---
if [ "$SENT" -eq 0 ]; then
  echo "WARNING: No notification channels configured or all failed."
  echo "Set DISCORD_AGENT_WEBHOOK_URL and/or TELEGRAM_BOT_TOKEN + TELEGRAM_FOUNDER_CHAT_ID"
  exit 1
fi

echo "Notified via $SENT channel(s)"
