#!/usr/bin/env bash
# Sync worktree with latest origin/main and set up dev environment.
# Only runs in worktrees (not the main checkout) to avoid rebasing main itself.
#
# IMPORTANT: No `set -e` — this is a session-start hook and must be maximally
# forgiving for dev-env setup. But git sync DOES hard-block when the worktree
# is behind origin/main and can't auto-rebase (dirty tree). Planning on stale
# code wastes the entire session.

set -uo pipefail

# Detect if we're in a worktree (`.git` is a file, not a directory)
GIT_DIR_ENTRY="$(git rev-parse --git-dir 2>/dev/null)" || exit 0
if [ -d ".git" ]; then
  # Main checkout — skip
  exit 0
fi

# --- CRLF phantom diff cleanup ---
# After .gitattributes changes (eol=lf), working tree files may still have CRLF
# while the index expects LF. `git add --renormalize .` aligns the index with
# .gitattributes rules, eliminating phantom diffs that would otherwise block
# auto-rebase. This is idempotent — if nothing needs renormalizing, it's a no-op.
cleanup_crlf_phantoms() {
  if [ ! -f ".gitattributes" ]; then
    return 0
  fi

  # Check: are there unstaged "modifications" that are actually zero-byte diffs?
  local TOTAL_MODS REAL_MODS
  TOTAL_MODS=$(git diff --name-only 2>/dev/null | wc -l)
  REAL_MODS=$(git diff --numstat 2>/dev/null | awk '$1 != 0 || $2 != 0' | wc -l)

  if [ "$TOTAL_MODS" -gt 0 ] && [ "$REAL_MODS" -eq 0 ]; then
    echo "CRLF phantom diffs detected (${TOTAL_MODS} files) — renormalizing..."
    git add --renormalize . 2>/dev/null
    # If renormalize staged changes, commit them so the tree is clean
    if ! git diff --cached --quiet 2>/dev/null; then
      git commit -m "fix: renormalize line endings to LF" --no-verify --quiet 2>/dev/null \
        && echo "CRLF: committed renormalization ✓" \
        || { git reset HEAD --quiet 2>/dev/null; echo "CRLF: renormalize staged but commit skipped"; }
    else
      echo "CRLF: phantom diffs resolved ✓"
    fi
  fi
}

# --- Git sync ---
sync_git() {
  git fetch origin main --quiet 2>/dev/null || {
    echo "WARN: Could not fetch origin/main — check network/auth." >&2
    return 0
  }

  # Clean CRLF phantom diffs BEFORE dirty-tree detection.
  # This prevents line-ending noise from blocking auto-rebase.
  cleanup_crlf_phantoms

  local LOCAL MERGE_BASE REMOTE BEHIND_COUNT AHEAD_COUNT
  LOCAL=$(git rev-parse HEAD 2>/dev/null) || return 0
  MERGE_BASE=$(git merge-base HEAD origin/main 2>/dev/null) || return 0
  REMOTE=$(git rev-parse origin/main 2>/dev/null) || return 0

  BEHIND_COUNT=$(git rev-list "$MERGE_BASE".."$REMOTE" --count 2>/dev/null || echo "?")
  AHEAD_COUNT=$(git rev-list "$REMOTE"..HEAD --count 2>/dev/null || echo "?")

  if [ "$MERGE_BASE" = "$REMOTE" ]; then
    echo "Git: up-to-date with origin/main (ahead ${AHEAD_COUNT} commits)."
    return 0
  fi

  # Check if working tree has REAL changes (not just CRLF phantom diffs).
  # On Windows with core.autocrlf=true, `git worktree add` checks out files
  # with CRLF while the index has LF, causing `git diff --quiet` to report
  # phantom modifications on shell scripts. .gitattributes fixes this for new
  # worktrees, but we also filter here as defense-in-depth.
  local IS_DIRTY=false
  local REAL_CHANGES
  REAL_CHANGES=$(git diff --numstat HEAD 2>/dev/null | awk '$1 != 0 || $2 != 0 { print }' | head -1)
  local STAGED_CHANGES
  STAGED_CHANGES=$(git diff --cached --numstat HEAD 2>/dev/null | awk '$1 != 0 || $2 != 0 { print }' | head -1)
  if [ -n "$REAL_CHANGES" ] || [ -n "$STAGED_CHANGES" ]; then
    IS_DIRTY=true
  fi
  # Also check for untracked files that might matter (not in .gitignore)
  local UNTRACKED
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | grep -v '\.claude/' | head -1)
  if [ -n "$UNTRACKED" ]; then
    IS_DIRTY=true
  fi

  if [ "$IS_DIRTY" = "true" ]; then
    # HARD BLOCK: behind origin/main + dirty tree = planning on stale code.
    # The agent will read outdated files and produce a plan that doesn't match
    # what's actually on main. This wastes the entire session.
    echo ""
    echo "========================================================================="
    echo "BLOCKED: Worktree is ${BEHIND_COUNT} commit(s) behind origin/main"
    echo "         AND has uncommitted changes (auto-rebase not possible)."
    echo ""
    echo "Planning or coding on stale code wastes the session — you'll hit"
    echo "conflicts on every file that changed on main since you branched."
    echo ""
    echo "Fix (pick one):"
    echo ""
    echo "  Option A — Stash, rebase, pop:"
    echo "    git stash"
    echo "    git rebase origin/main"
    echo "    git stash pop"
    echo ""
    echo "  Option B — Commit WIP first, then rebase:"
    echo "    git add -A && git commit -m 'wip: save progress'"
    echo "    git rebase origin/main"
    echo ""
    echo "  Option C — Discard local changes and rebase (DESTRUCTIVE):"
    echo "    git checkout -- ."
    echo "    git rebase origin/main"
    echo ""
    echo "Uncommitted files:"
    git status --short | head -10
    echo "========================================================================="
    echo ""
    exit 2
  fi

  # Auto-discard CRLF-only phantom diffs before rebasing.
  # We already know IS_DIRTY=false (no real content changes), but git rebase
  # does its own working-tree check and refuses to run if it sees ANY unstaged
  # changes — including zero-content CRLF normalization diffs. Silently clean
  # them so the rebase can proceed.
  if ! git diff --quiet HEAD 2>/dev/null; then
    git checkout -- . 2>/dev/null
    echo "Git: discarded CRLF phantom diffs (0 real content changes) ✓"
  fi

  if ! git rebase origin/main --quiet 2>/dev/null; then
    git rebase --abort 2>/dev/null || true
    echo ""
    echo "⚠️  Auto-rebase onto origin/main FAILED (conflicts). Run manually:"
    echo "     git rebase origin/main"
    echo ""
    return 0
  fi

  echo "Git: rebased ${BEHIND_COUNT} commits from origin/main ✓"
}

# --- Dev environment setup ---
setup_dev_env() {
  # Resolve the main checkout path from git common dir
  local MAIN_CHECKOUT
  MAIN_CHECKOUT="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')" || return 0

  if [ -z "$MAIN_CHECKOUT" ] || [ ! -d "$MAIN_CHECKOUT" ]; then
    return 0
  fi

  # Copy .env.local if missing (plain copy so each worktree is independent)
  if [ ! -f ".env.local" ] && [ -f "$MAIN_CHECKOUT/.env.local" ]; then
    cp "$MAIN_CHECKOUT/.env.local" .env.local
    echo ".env.local: copied from main checkout ✓"
  fi

  # Junction node_modules from main checkout if missing and package.json matches.
  # mklink /J requires Admin rights on Windows — if it fails, fall back to npm install.
  if [ ! -d "node_modules" ] && [ -d "$MAIN_CHECKOUT/node_modules" ]; then
    if diff -q package.json "$MAIN_CHECKOUT/package.json" > /dev/null 2>&1; then
      local JUNCTION_TARGET JUNCTION_SOURCE
      JUNCTION_TARGET="$(cygpath -w "$(pwd)/node_modules")"
      JUNCTION_SOURCE="$(cygpath -w "$MAIN_CHECKOUT/node_modules")"
      if cmd.exe //c "mklink /J $JUNCTION_TARGET $JUNCTION_SOURCE" > /dev/null 2>&1; then
        echo "node_modules: junctioned from main checkout ✓"
      else
        echo "node_modules: junction failed (needs Admin) — running npm install..."
        npm install --prefer-offline --silent 2>/dev/null \
          && echo "node_modules: installed ✓" \
          || echo "WARN: npm install failed — run it manually." >&2
      fi
    else
      echo "node_modules: package.json differs from main — running npm install..."
      npm install --prefer-offline --silent 2>/dev/null \
        && echo "node_modules: installed ✓" \
        || echo "WARN: npm install failed — run it manually." >&2
    fi
  fi
}

# --- Git push credential setup ---
# Ensures HTTPS remotes work without hanging on credential prompts.
setup_git_credentials() {
  if gh auth status --hostname github.com > /dev/null 2>&1; then
    gh auth setup-git --hostname github.com > /dev/null 2>&1 \
      && echo "Git credentials: HTTPS push configured via gh ✓" \
      || true
  fi
}

# Git sync runs first and can HARD BLOCK (exit 2) if behind + dirty.
# Dev env and credential setup only run if sync passes.
echo "=== Worktree setup: $(git rev-parse --abbrev-ref HEAD) ==="
sync_git
setup_dev_env || true
setup_git_credentials || true
echo "=== Setup complete ==="
