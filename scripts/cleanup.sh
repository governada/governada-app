#!/usr/bin/env bash
# Workspace cleanup: worktrees, orphaned dirs, stale branches, uncommitted changes.
# Run periodically (weekly or before major work sessions).
#
# Usage:
#   bash scripts/cleanup.sh              # dry-run (report only)
#   bash scripts/cleanup.sh --clean      # delete stale worktrees/dirs + prune branches
#   bash scripts/cleanup.sh --clean-all  # also delete orphaned dirs (no .git)
#
# Run from anywhere inside the repo.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="$(cd "$REPO_ROOT/.." && pwd)"
MODE="${1:-dry-run}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Governada Workspace Cleanup ===${NC}"
echo "Workspace: $WORKSPACE"
echo "Mode: $MODE"
echo ""

# ─── 1. Prune stale worktree metadata ───────────────────────────────
echo -e "${CYAN}[1/8] Pruning git worktree metadata...${NC}"
cd "$REPO_ROOT"
git worktree prune 2>/dev/null
echo "  Done."
echo ""

# ─── 2. Detect orphaned directories (no .git at all) ────────────────
echo -e "${CYAN}[2/8] Scanning for orphaned directories...${NC}"
ORPHANED=()
for dir in "$WORKSPACE"/governada-*/; do
  [ -d "$dir" ] || continue
  dirname="$(basename "$dir")"
  [ "$dirname" = "governada-app" ] && continue
  if [ ! -f "$dir/.git" ] && [ ! -d "$dir/.git" ]; then
    ORPHANED+=("$dir")
    echo -e "  ${RED}ORPHANED${NC}: $dirname (no .git -- leftover from removed worktree)"
  fi
done
if [ ${#ORPHANED[@]} -eq 0 ]; then
  echo -e "  ${GREEN}None found.${NC}"
fi
echo ""

# ─── 3. Detect worktrees with fully-merged branches ─────────────────
echo -e "${CYAN}[3/8] Checking worktrees for merged branches...${NC}"
cd "$REPO_ROOT"
git fetch origin --quiet 2>/dev/null || true

MERGED_WORKTREES=()
STALE_WORKTREES=()
ACTIVE_WORKTREES=()

while IFS= read -r line; do
  wt_path=$(echo "$line" | awk '{print $1}')
  wt_branch=$(echo "$line" | awk '{print $3}' | sed 's/\[//;s/\]//')
  wt_name="$(basename "$wt_path")"

  # Skip main worktree
  [ "$wt_name" = "governada-app" ] && continue

  # Check if branch exists on remote
  remote_branch="${wt_branch}"
  if ! git rev-parse "origin/$remote_branch" >/dev/null 2>&1; then
    # Try without feat/ prefix mapping
    echo -e "  ${YELLOW}NO REMOTE${NC}: $wt_name ($wt_branch -- no remote branch)"
    STALE_WORKTREES+=("$wt_path")
    continue
  fi

  ahead=$(git log --oneline "origin/main..origin/$remote_branch" 2>/dev/null | wc -l | tr -d ' ')
  behind=$(git log --oneline "origin/$remote_branch..origin/main" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$ahead" -eq 0 ]; then
    echo -e "  ${GREEN}MERGED${NC}: $wt_name ($wt_branch -- 0 ahead, $behind behind)"
    MERGED_WORKTREES+=("$wt_path")
  elif [ "$behind" -gt 20 ]; then
    echo -e "  ${YELLOW}STALE${NC}: $wt_name ($wt_branch -- $ahead ahead, $behind behind main)"
    STALE_WORKTREES+=("$wt_path")
  else
    echo -e "  ${GREEN}ACTIVE${NC}: $wt_name ($wt_branch -- $ahead ahead, $behind behind)"
    ACTIVE_WORKTREES+=("$wt_path")
  fi
done < <(git worktree list 2>/dev/null | tail -n +1)

echo ""

# ─── 4. Check for uncommitted changes across all worktrees ──────────
echo -e "${CYAN}[4/8] Checking for uncommitted changes...${NC}"
while IFS= read -r line; do
  wt_path=$(echo "$line" | awk '{print $1}')
  wt_name="$(basename "$wt_path")"
  changes=$(git -C "$wt_path" status --short 2>/dev/null | head -5)
  if [ -n "$changes" ]; then
    echo -e "  ${YELLOW}$wt_name${NC}:"
    echo "$changes" | sed 's/^/    /'
    total=$(git -C "$wt_path" status --short 2>/dev/null | wc -l | tr -d ' ')
    if [ "$total" -gt 5 ]; then
      echo "    ... and $((total - 5)) more"
    fi
  fi
done < <(git worktree list 2>/dev/null)
echo ""

# ─── 5. Check for stale files in workspace root ─────────────────────
echo -e "${CYAN}[5/8] Checking for stale files in workspace root...${NC}"
STALE_FILES=()
for f in "$WORKSPACE"/*.zip "$WORKSPACE"/*.tar.gz "$WORKSPACE"/*.bak; do
  [ -f "$f" ] || continue
  STALE_FILES+=("$f")
  echo -e "  ${YELLOW}STALE FILE${NC}: $(basename "$f") ($(du -h "$f" | cut -f1))"
done
if [ ${#STALE_FILES[@]} -eq 0 ]; then
  echo -e "  ${GREEN}None found.${NC}"
fi
echo ""

# ─── 6. Build manifest sync check ───────────────────────────────────
echo -e "${CYAN}[6/8] Build manifest sync check...${NC}"
VISION="$REPO_ROOT/docs/strategy/ultimate-vision.md"
MANIFEST="$REPO_ROOT/docs/strategy/context/build-manifest.md"
if [ -f "$MANIFEST" ] && [ -f "$VISION" ]; then
  vision_mod=$(stat -c %Y "$VISION" 2>/dev/null || stat -f %m "$VISION" 2>/dev/null)
  manifest_mod=$(stat -c %Y "$MANIFEST" 2>/dev/null || stat -f %m "$MANIFEST" 2>/dev/null)
  if [ "$vision_mod" -gt "$manifest_mod" ]; then
    echo -e "  ${YELLOW}STALE${NC}: build-manifest.md is older than ultimate-vision.md -- consider updating"
  else
    echo -e "  ${GREEN}IN SYNC${NC}: build-manifest.md is up to date"
  fi
else
  if [ ! -f "$MANIFEST" ]; then
    echo -e "  ${YELLOW}MISSING${NC}: docs/strategy/context/build-manifest.md not found"
  fi
fi
echo ""

# ─── 7. Detect local branches with gone remotes ─────────────────────
echo -e "${CYAN}[7/8] Checking for stale local branches...${NC}"
cd "$REPO_ROOT"
git fetch --prune --quiet 2>/dev/null || true

GONE_BRANCHES=()
LOCAL_ONLY_BRANCHES=()

while IFS= read -r line; do
  branch=$(echo "$line" | sed 's/^[ *]*//' | awk '{print $1}')
  [ "$branch" = "main" ] && continue
  [ "$branch" = "master" ] && continue

  if echo "$line" | grep -q '\[.*: gone\]'; then
    GONE_BRANCHES+=("$branch")
  elif ! git config "branch.${branch}.remote" >/dev/null 2>&1; then
    LOCAL_ONLY_BRANCHES+=("$branch")
  fi
done < <(git branch -vv 2>/dev/null)

if [ ${#GONE_BRANCHES[@]} -gt 0 ]; then
  echo -e "  ${YELLOW}${#GONE_BRANCHES[@]} branches with deleted remote${NC} (squash-merged or remote-deleted)"
  # Show first 10
  for b in "${GONE_BRANCHES[@]:0:10}"; do
    echo -e "    ${YELLOW}GONE${NC}: $b"
  done
  if [ ${#GONE_BRANCHES[@]} -gt 10 ]; then
    echo "    ... and $((${#GONE_BRANCHES[@]} - 10)) more"
  fi
else
  echo -e "  ${GREEN}No stale branches.${NC}"
fi

if [ ${#LOCAL_ONLY_BRANCHES[@]} -gt 0 ]; then
  echo -e "  ${YELLOW}${#LOCAL_ONLY_BRANCHES[@]} local-only branches${NC} (never pushed or tracking removed)"
  for b in "${LOCAL_ONLY_BRANCHES[@]:0:5}"; do
    echo -e "    ${YELLOW}LOCAL${NC}: $b"
  done
  if [ ${#LOCAL_ONLY_BRANCHES[@]} -gt 5 ]; then
    echo "    ... and $((${#LOCAL_ONLY_BRANCHES[@]} - 5)) more"
  fi
else
  echo -e "  ${GREEN}No local-only branches.${NC}"
fi
echo ""

# ─── 8. Detect stale stashes ────────────────────────────────────────
echo -e "${CYAN}[8/8] Checking for stale stashes...${NC}"
STASH_COUNT=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
if [ "$STASH_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}$STASH_COUNT stash(es) found${NC}"
  git stash list 2>/dev/null | head -5 | sed 's/^/    /'
  if [ "$STASH_COUNT" -gt 5 ]; then
    echo "    ... and $((STASH_COUNT - 5)) more"
  fi
else
  echo -e "  ${GREEN}No stashes.${NC}"
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────────────
echo -e "${CYAN}=== Summary ===${NC}"
echo "  Orphaned dirs:      ${#ORPHANED[@]}"
echo "  Merged worktrees:   ${#MERGED_WORKTREES[@]}"
echo "  Stale worktrees:    ${#STALE_WORKTREES[@]}"
echo "  Active worktrees:   ${#ACTIVE_WORKTREES[@]}"
echo "  Stale files:        ${#STALE_FILES[@]}"
echo "  Gone branches:      ${#GONE_BRANCHES[@]}"
echo "  Local-only branches: ${#LOCAL_ONLY_BRANCHES[@]}"
echo "  Stashes:            $STASH_COUNT"
echo ""

# ─── Cleanup actions ────────────────────────────────────────────────
if [ "$MODE" = "--clean" ] || [ "$MODE" = "--clean-all" ]; then
  echo -e "${CYAN}=== Cleaning ===${NC}"

  # Remove merged worktrees
  for wt in "${MERGED_WORKTREES[@]+"${MERGED_WORKTREES[@]}"}"; do
    [ -z "$wt" ] && continue
    wt_name="$(basename "$wt")"
    echo -e "  Removing merged worktree: ${GREEN}$wt_name${NC}"
    # Windows: delete node_modules first to break file locks
    if [ -d "$wt/node_modules" ]; then
      cmd.exe //c "rmdir /S /Q $(cygpath -w "$wt/node_modules")" 2>/dev/null || rm -rf "$wt/node_modules" 2>/dev/null || true
    fi
    git worktree remove "$wt" --force 2>/dev/null || true
  done

  # Remove stale worktrees
  for wt in "${STALE_WORKTREES[@]+"${STALE_WORKTREES[@]}"}"; do
    [ -z "$wt" ] && continue
    wt_name="$(basename "$wt")"
    echo -e "  Removing stale worktree: ${YELLOW}$wt_name${NC}"
    if [ -d "$wt/node_modules" ]; then
      cmd.exe //c "rmdir /S /Q $(cygpath -w "$wt/node_modules")" 2>/dev/null || rm -rf "$wt/node_modules" 2>/dev/null || true
    fi
    git worktree remove "$wt" --force 2>/dev/null || true
  done

  # Remove orphaned dirs (only with --clean-all)
  if [ "$MODE" = "--clean-all" ]; then
    for dir in "${ORPHANED[@]+"${ORPHANED[@]}"}"; do
      [ -z "$dir" ] && continue
      dirname="$(basename "$dir")"
      echo -e "  Removing orphaned dir: ${RED}$dirname${NC}"
      if [ -d "$dir/node_modules" ]; then
        cmd.exe //c "rmdir /S /Q $(cygpath -w "$dir/node_modules")" 2>/dev/null || rm -rf "$dir/node_modules" 2>/dev/null || true
      fi
      cmd.exe //c "rmdir /S /Q $(cygpath -w "$dir")" 2>/dev/null || rm -rf "$dir" 2>/dev/null || true
    done
  fi

  # Delete local branches whose remote is gone
  if [ ${#GONE_BRANCHES[@]} -gt 0 ]; then
    echo ""
    echo -e "  Deleting ${#GONE_BRANCHES[@]} branches with gone remotes..."
    DELETED=0
    FAILED=0
    for b in "${GONE_BRANCHES[@]}"; do
      if git branch -D "$b" >/dev/null 2>&1; then
        DELETED=$((DELETED + 1))
      else
        FAILED=$((FAILED + 1))
        echo -e "    ${RED}FAILED${NC}: $b (may be current branch or have unmerged work)"
      fi
    done
    echo -e "    Deleted: ${GREEN}$DELETED${NC}, Failed: $FAILED"
  fi

  # Final prune
  git worktree prune 2>/dev/null

  echo ""
  echo -e "${GREEN}Cleanup complete.${NC}"
else
  TOTAL_ISSUES=$((${#ORPHANED[@]} + ${#MERGED_WORKTREES[@]} + ${#STALE_WORKTREES[@]} + ${#STALE_FILES[@]} + ${#GONE_BRANCHES[@]}))
  if [ "$TOTAL_ISSUES" -gt 0 ]; then
    echo "Run with --clean to remove merged/stale worktrees and prune branches."
    echo "Run with --clean-all to also remove orphaned directories."
  else
    echo -e "${GREEN}Workspace is clean!${NC}"
  fi
fi
