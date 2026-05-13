#!/usr/bin/env bash
# Hook script: block agent file edits that introduce VITE_* secrets in source files.
# Called by the PreToolUse hook before any file write/edit tool.
# Reads JSON from stdin, writes decision JSON to stdout.

set -euo pipefail

INPUT=$(cat)

# Extract the tool name and parameters
TOOL=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")

# Only inspect file-write tools
case "$TOOL" in
  str_replace_based_edit_tool|create_file|write_file|replace_string_in_file|multi_replace_string_in_file)
    ;;
  *)
    echo '{"continue": true}'
    exit 0
    ;;
esac

# Extract the new content being written
NEW_CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
params = d.get('tool_input', {})
# Check common field names across tools
for key in ['content', 'new_string', 'newString', 'file_text']:
    if key in params:
        print(params[key])
        sys.exit(0)
print('')
" 2>/dev/null || echo "")

# Secret patterns to block in source files
# Match: VITE_<WORD>_SECRET | VITE_<WORD>_KEY | VITE_<WORD>_PASSWORD | VITE_<WORD>_TOKEN
if echo "$NEW_CONTENT" | grep -qE 'VITE_[A-Z0-9_]*(SECRET|KEY|PASSWORD|TOKEN|PRIVATE)[A-Z0-9_]*\s*[:=]'; then
  MATCH=$(echo "$NEW_CONTENT" | grep -oE 'VITE_[A-Z0-9_]*(SECRET|KEY|PASSWORD|TOKEN|PRIVATE)[A-Z0-9_]*' | head -1)
  cat <<JSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked: detected secret-like VITE_ variable '${MATCH}'. VITE_* env vars are bundled into the client JS bundle. Move this secret to a server-only process.env var inside netlify/functions/ and access it via a presigned URL or API proxy."
  }
}
JSON
  exit 0
fi

echo '{"continue": true}'
