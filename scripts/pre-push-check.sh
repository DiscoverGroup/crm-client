#!/bin/bash
# ==============================================================================
# Pre-Push Error/Bug Check Script
# Run this before pushing changes to GitHub to catch issues early.
# Usage: ./pre-push-check.sh          (check only)
#        ./pre-push-check.sh --fix     (check + auto-fix what's possible)
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

AUTO_FIX=false
if [[ "$1" == "--fix" ]]; then
  AUTO_FIX=true
fi

PASS=0
FAIL=0
WARN=0
ERRORS=""

# Fixable issue tracking
declare -a FIX_LABELS
declare -a FIX_COMMANDS
FIX_COUNT=0

register_fix() {
  FIX_LABELS[$FIX_COUNT]="$1"
  FIX_COMMANDS[$FIX_COUNT]="$2"
  FIX_COUNT=$((FIX_COUNT + 1))
}

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
  echo -e "\n${BLUE}▸${NC} ${BOLD}$1${NC}"
}

pass() {
  echo -e "  ${GREEN}✓ $1${NC}"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}✗ $1${NC}"
  FAIL=$((FAIL + 1))
  ERRORS="${ERRORS}\n  ${RED}✗ $1${NC}"
}

warn() {
  echo -e "  ${YELLOW}⚠ $1${NC}"
  WARN=$((WARN + 1))
}

# ==============================================================================
print_header "Pre-Push Error & Bug Check"
echo -e "  ${BLUE}Project:${NC} crm-client"
echo -e "  ${BLUE}Date:${NC}    $(date '+%Y-%m-%d %H:%M:%S')"

# ==============================================================================
# 1. Check node_modules exist
# ==============================================================================
print_step "Checking dependencies..."
if [ -d "node_modules" ]; then
  pass "node_modules present"
else
  fail "node_modules missing — run 'npm install'"
  register_fix "Install dependencies" "npm install"
fi

# ==============================================================================
# 2. TypeScript type checking (frontend — src/)
# ==============================================================================
print_step "TypeScript type check (src/)..."
if npx tsc --noEmit --project tsconfig.app.json 2>/tmp/tsc_app_errors.txt; then
  pass "No type errors in src/"
else
  ERROR_COUNT=$(grep -c "error TS" /tmp/tsc_app_errors.txt 2>/dev/null || echo "0")
  fail "TypeScript errors in src/ (${ERROR_COUNT} errors)"
  echo ""
  # Show first 30 lines of errors
  head -30 /tmp/tsc_app_errors.txt | sed 's/^/    /'
  if [ "$ERROR_COUNT" -gt 10 ]; then
    echo -e "    ${YELLOW}... and more. See full output: /tmp/tsc_app_errors.txt${NC}"
  fi
fi

# ==============================================================================
# 3. TypeScript type checking (vite config — tsconfig.node.json)
# ==============================================================================
print_step "TypeScript type check (vite config)..."
if npx tsc --noEmit --project tsconfig.node.json 2>/tmp/tsc_node_errors.txt; then
  pass "No type errors in vite config"
else
  ERROR_COUNT=$(grep -c "error TS" /tmp/tsc_node_errors.txt 2>/dev/null || echo "0")
  fail "TypeScript errors in vite config (${ERROR_COUNT} errors)"
  head -15 /tmp/tsc_node_errors.txt | sed 's/^/    /'
fi

# ==============================================================================
# 4. ESLint
# ==============================================================================
print_step "ESLint check..."
if npx eslint . 2>/tmp/eslint_errors.txt; then
  pass "No lint errors"
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 1 ]; then
    LINT_SUMMARY=$(tail -1 /tmp/eslint_errors.txt 2>/dev/null)
    fail "ESLint found issues — ${LINT_SUMMARY}"
    head -30 /tmp/eslint_errors.txt | sed 's/^/    /'
    register_fix "Auto-fix ESLint issues" "npx eslint . --fix"
  else
    warn "ESLint exited with code ${EXIT_CODE} — check config"
  fi
fi

# ==============================================================================
# 5. Vite production build
# ==============================================================================
print_step "Production build (vite build)..."
if npx vite build 2>/tmp/build_errors.txt 1>/tmp/build_output.txt; then
  BUILD_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
  pass "Build succeeded (${BUILD_SIZE:-?})"
else
  fail "Build failed"
  echo ""
  tail -20 /tmp/build_errors.txt | sed 's/^/    /'
fi

# ==============================================================================
# 6. Check for common code issues
# ==============================================================================
print_step "Scanning for common issues..."

# console.log left in code (outside comments)
CONSOLE_COUNT=$(grep -rn "console\.log\|console\.warn\|console\.error" src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "^.*//.*console\." \
  | grep -v "\.md:" \
  | wc -l | tr -d ' ')
if [ "$CONSOLE_COUNT" -gt 0 ]; then
  warn "Found ${CONSOLE_COUNT} console.log/warn/error statements in src/"
else
  pass "No console statements in src/"
fi

# Debugger statements
DEBUGGER_COUNT=$(grep -rn "debugger" src/ --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
if [ "$DEBUGGER_COUNT" -gt 0 ]; then
  fail "Found ${DEBUGGER_COUNT} 'debugger' statements in src/"
  grep -rn "debugger" src/ --include="*.ts" --include="*.tsx" | head -5 | sed 's/^/    /'
  register_fix "Remove debugger statements" "find src/ \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' '/^[[:space:]]*debugger;*[[:space:]]*$/d' {} +"
else
  pass "No debugger statements"
fi

# TODO/FIXME/HACK markers
TODO_COUNT=$(grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
  warn "Found ${TODO_COUNT} TODO/FIXME/HACK comments in src/"
else
  pass "No TODO/FIXME/HACK comments"
fi

# Check for hardcoded localhost URLs (potential prod issues)
LOCALHOST_COUNT=$(grep -rn "localhost\|127\.0\.0\.1" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" \
  | grep -v "// " \
  | wc -l | tr -d ' ')
if [ "$LOCALHOST_COUNT" -gt 0 ]; then
  warn "Found ${LOCALHOST_COUNT} hardcoded localhost references in src/"
  grep -rn "localhost\|127\.0\.0\.1" src/ --include="*.ts" --include="*.tsx" \
    | grep -v "node_modules" | grep -v "// " | head -5 | sed 's/^/    /'
else
  pass "No hardcoded localhost URLs"
fi

# ==============================================================================
# 7. Secret Detection (comprehensive)
# ==============================================================================
print_step "Secret detection scan..."

SECRET_FOUND=0
SECRET_DETAILS=""

# Directories and file types to scan (excludes node_modules, dist, .git, .env.example)
SCAN_DIRS="src/ netlify/ public/"

# Helper: search source files with a regex pattern
scan_secrets() {
  grep -rnI --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --include='*.json' --include='*.html' --include='*.yml' --include='*.yaml' \
    --include='*.toml' -E "$1" $SCAN_DIRS 2>/dev/null || true
}

# --- 7a. .env files tracked by git ---
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ENV_TRACKED=$(git ls-files | grep -E '^\.env$|^\.env\.[^e]' | grep -v '\.example' || true)
  if [ -n "$ENV_TRACKED" ]; then
    SECRET_FOUND=$((SECRET_FOUND + 1))
    SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● .env file tracked by git: ${ENV_TRACKED}${NC}"
    register_fix "Untrack .env files from git" "git rm --cached $ENV_TRACKED && echo '.env*' >> .gitignore"
  fi
fi

# --- 7b. AWS / Cloudflare credentials ---
AWS_HITS=$(scan_secrets 'AKIA[0-9A-Z]{16}' | grep -v '\.example' | head -5)
if [ -n "$AWS_HITS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● AWS Access Key ID found:${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      $line"; done <<< "$AWS_HITS"
fi

# --- 7c. Generic high-entropy secret patterns (key=value with long values) ---
GENERIC_SECRETS=$(scan_secrets \
  '(SECRET_ACCESS_KEY|SECRET_KEY|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|BEARER_TOKEN|JWT_SECRET|APP_PASSWORD|APP_SECRET|CLIENT_SECRET)[[:space:]]*[=:][[:space:]]*[\x27"]?[A-Za-z0-9+/=_-]{16,}' \
  | grep -vi '\.example\|process\.env\|import\.meta\.env\|VITE_\|placeholder\|your_\|<.*>' \
  | head -5)
if [ -n "$GENERIC_SECRETS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Possible secret key/token values:${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      $line"; done <<< "$GENERIC_SECRETS"
fi

# --- 7d. MongoDB connection strings with credentials ---
MONGO_HITS=$(scan_secrets 'mongodb(\+srv)?://[^/[:space:]]*:[^@[:space:]]+@' \
  | grep -vi '\.example\|placeholder\|your_\|<user>' | head -5)
if [ -n "$MONGO_HITS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● MongoDB connection string with credentials:${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      $line"; done <<< "$MONGO_HITS"
fi

# --- 7e. Gmail / SMTP passwords ---
GMAIL_HITS=$(scan_secrets '(GMAIL_APP_PASSWORD|SMTP_PASS|MAIL_PASSWORD)[[:space:]]*[=:][[:space:]]*[\x27"]?[A-Za-z0-9]{8,}' \
  | grep -vi '\.example\|process\.env\|import\.meta\.env\|your_\|placeholder' | head -5)
if [ -n "$GMAIL_HITS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Gmail/SMTP password found:${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      $line"; done <<< "$GMAIL_HITS"
fi

# --- 7f. Private keys (RSA, SSH, PGP) ---
PRIVKEY_HITS=$(grep -rlI -E 'BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY' $SCAN_DIRS 2>/dev/null | head -5)
if [ -n "$PRIVKEY_HITS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Private key file(s):${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      $line"; done <<< "$PRIVKEY_HITS"
fi

# --- 7g. JWT tokens (eyJ...) ---
JWT_HITS=$(scan_secrets 'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' | head -5)
if [ -n "$JWT_HITS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Hardcoded JWT token:${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      ${line:0:80}..."; done <<< "$JWT_HITS"
fi

# --- 7h. Hardcoded passwords in code (e.g. password = "actual_value") ---
PW_HITS=$(scan_secrets '(password|passwd|pwd)[[:space:]]*[=:][[:space:]]*[\x27"][^\x27"]{6,}[\x27"]' \
  | grep -vi 'type\|interface\|placeholder\|example\|your_\|schema\|label\|hint\|error\|message\|\.md\|validation\|required\|comment\|process\.env\|import\.meta\.env' \
  | grep -vi 'reset.password\|forgot.password\|change.password\|update.password\|new.password\|confirm.password\|setPassword\|getPassword\|checkPassword\|hashPassword\|comparePassword\|validatePassword\|passwordMatch\|passwordError\|passwordStrength\|passwordVisible\|showPassword\|togglePassword\|isPassword\|hasPassword' \
  | head -5)
if [ -n "$PW_HITS" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Hardcoded password values:${NC}"
  while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      $line"; done <<< "$PW_HITS"
fi

# --- 7i. Scan git staged files specifically ---
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  STAGED_DIFF=$(git diff --cached -U0 2>/dev/null | grep '^+' | grep -v '^+++' || true)
  if [ -n "$STAGED_DIFF" ]; then
    STAGED_SECRETS=$(echo "$STAGED_DIFF" \
      | grep -iE '(AKIA[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]|mongodb.srv.?://[^/]*:[^@]+@|BEGIN.*PRIVATE KEY|eyJ[A-Za-z0-9_=]+[.]eyJ|SECRET_ACCESS_KEY[[:space:]]*=|APP_PASSWORD[[:space:]]*=)' \
      2>/dev/null || true)
    if [ -n "$STAGED_SECRETS" ]; then
      SECRET_FOUND=$((SECRET_FOUND + 1))
      SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Secrets detected in STAGED changes (about to be committed):${NC}"
      while IFS= read -r line; do SECRET_DETAILS="${SECRET_DETAILS}\n      ${line:0:100}"; done <<< "$STAGED_SECRETS"
    fi
  fi
fi

# --- 7j. Check for sensitive files that shouldn't be committed ---
SENSITIVE_FILES=""
for f in .env .env.local .env.production .env.production.local docs/deployment/ADMIN-CREDENTIALS.md SECRETS.md CREDENTIALS.md id_rsa id_ed25519 .npmrc; do
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      SENSITIVE_FILES="${SENSITIVE_FILES} ${f}"
    fi
  fi
done
if [ -n "$SENSITIVE_FILES" ]; then
  SECRET_FOUND=$((SECRET_FOUND + 1))
  SECRET_DETAILS="${SECRET_DETAILS}\n    ${RED}● Sensitive files tracked by git:${SENSITIVE_FILES}${NC}"
  register_fix "Untrack sensitive files" "git rm --cached${SENSITIVE_FILES}"
fi

# Report results
if [ "$SECRET_FOUND" -gt 0 ]; then
  fail "Found ${SECRET_FOUND} secret issue(s) — DO NOT PUSH"
  echo -e "$SECRET_DETAILS"
else
  pass "No secrets or credentials detected"
fi

# ==============================================================================
# 8. Check for large files that shouldn't be committed
# ==============================================================================
print_step "Checking for large files..."
LARGE_FILES=$(find . -path ./node_modules -prune -o -path ./dist -prune -o -path ./.git -prune -o -path ./.netlify -prune -o \
  -type f -size +2M -print 2>/dev/null)
if [ -n "$LARGE_FILES" ]; then
  warn "Large files (>2MB) found:"
  echo "$LARGE_FILES" | sed 's/^/    /'
  register_fix "Add large files to .gitignore" "echo \"$LARGE_FILES\" | while read f; do echo \"\$f\" >> .gitignore; done"
else
  pass "No large files (>2MB) outside node_modules/dist"
fi

# ==============================================================================
# 9. Git status check
# ==============================================================================
print_step "Git status..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
  STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

  if [ "$UNSTAGED" -gt 0 ]; then
    warn "${UNSTAGED} unstaged changes"
  fi
  if [ "$UNTRACKED" -gt 0 ]; then
    warn "${UNTRACKED} untracked files"
  fi
  if [ "$STAGED" -gt 0 ]; then
    pass "${STAGED} files staged for commit"
  fi

  # Check .env files aren't staged
  ENV_STAGED=$(git diff --cached --name-only 2>/dev/null | grep -cE "\.env" || true)
  if [ "$ENV_STAGED" -gt 0 ]; then
    fail ".env file(s) staged for commit — remove with 'git reset HEAD .env*'"
    register_fix "Unstage .env files" "git reset HEAD .env*"
  else
    pass "No .env files staged"
  fi
else
  warn "Not a git repository"
fi

# ==============================================================================
# Summary
# ==============================================================================
print_header "Results"

TOTAL=$((PASS + FAIL + WARN))
echo -e "  ${GREEN}✓ Passed:${NC}   ${PASS}"
echo -e "  ${YELLOW}⚠ Warnings:${NC} ${WARN}"
echo -e "  ${RED}✗ Failed:${NC}   ${FAIL}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}  ✗ DO NOT PUSH — fix the errors above first:${NC}"
  echo -e "$ERRORS"
  echo ""
fi

# ==============================================================================
# Quick Fix System
# ==============================================================================
if [ "$FIX_COUNT" -gt 0 ]; then
  print_header "Quick Fixes Available (${FIX_COUNT})"
  for i in $(seq 0 $((FIX_COUNT - 1))); do
    echo -e "  ${CYAN}[$((i + 1))]${NC} ${FIX_LABELS[$i]}"
    echo -e "      ${YELLOW}→ ${FIX_COMMANDS[$i]}${NC}"
  done
  echo ""

  if [ "$AUTO_FIX" = true ]; then
    echo -e "${BOLD}  Applying all fixes (--fix mode)...${NC}"
    echo ""
    FIX_OK=0
    FIX_ERR=0
    for i in $(seq 0 $((FIX_COUNT - 1))); do
      echo -e "  ${CYAN}▸${NC} ${FIX_LABELS[$i]}..."
      if eval "${FIX_COMMANDS[$i]}" 2>/tmp/fix_error.txt; then
        echo -e "    ${GREEN}✓ Fixed${NC}"
        FIX_OK=$((FIX_OK + 1))
      else
        echo -e "    ${RED}✗ Failed — $(cat /tmp/fix_error.txt | head -1)${NC}"
        FIX_ERR=$((FIX_ERR + 1))
      fi
    done
    echo ""
    echo -e "  ${GREEN}Fixed: ${FIX_OK}${NC}  ${RED}Failed: ${FIX_ERR}${NC}"
    if [ "$FIX_OK" -gt 0 ]; then
      echo -e "\n  ${YELLOW}${BOLD}Re-run the check to verify fixes:${NC} npm run check"
    fi
    echo ""
    exit 1
  else
    echo -e "  ${BOLD}To auto-fix, run:${NC}  ${CYAN}npm run check:fix${NC}"
    echo -e "  ${BOLD}Or fix one at a time by copying the commands above.${NC}"
    echo ""
  fi
fi

if [ "$FAIL" -gt 0 ]; then
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}${BOLD}  ⚠ Warnings found — review before pushing.${NC}"
  echo ""
  exit 0
else
  echo -e "${GREEN}${BOLD}  ✓ All checks passed — safe to push!${NC}"
  echo ""
  exit 0
fi
