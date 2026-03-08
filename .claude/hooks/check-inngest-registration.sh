#!/bin/bash
# PostToolUse hook: after writing/editing inngest/functions/, remind about registration
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *"inngest/functions/"* ]] && [[ "$FILE_PATH" == *.ts ]]; then
  FUNC_NAME=$(basename "$FILE_PATH" .ts)
  if ! grep -q "$FUNC_NAME" "$(dirname "$FILE_PATH")/../../app/api/inngest/route.ts" 2>/dev/null; then
    echo "REMINDER: New Inngest function '$FUNC_NAME' -- make sure to register it in app/api/inngest/route.ts in the same commit."
  fi
fi
exit 0
