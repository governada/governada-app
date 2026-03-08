#!/bin/bash
# PostToolUse hook: after writing/editing files in app/, check for missing force-dynamic
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file_path // empty')

# Only check app/ route files and pages
if [[ "$FILE_PATH" == *"/app/"* ]] && [[ "$FILE_PATH" =~ (route|page)\.(ts|tsx)$ ]]; then
  # Check if file imports from supabase/data/redis/env
  if grep -qE '(createClient|getSupabaseAdmin|supabase|lib/data|lib/redis|process\.env\.)' "$FILE_PATH" 2>/dev/null; then
    # Check if force-dynamic is present
    if ! grep -q "force-dynamic" "$FILE_PATH" 2>/dev/null; then
      echo "WARNING: $FILE_PATH imports Supabase/env but missing 'export const dynamic = \"force-dynamic\"'. Railway build will fail."
    fi
  fi
fi
exit 0
