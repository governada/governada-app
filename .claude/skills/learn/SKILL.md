---
name: learn
description: Record a lesson learned from the current session into persistent memory
---

A lesson was learned during this session. Record it properly:

1. Read the current memory files:
   - `~/.claude/projects/c--Users-dalto-governada/memory/MEMORY.md`
   - `~/.claude/projects/c--Users-dalto-governada/memory/lessons-detailed.md`

2. Check if this lesson already exists (avoid duplicates)

3. If new:
   - Add a concise entry to the appropriate section in `MEMORY.md` (keep under 200 lines total)
   - Add detailed context (what happened, root cause, fix, pattern) to `lessons-detailed.md`

4. If it updates an existing lesson, edit the existing entry

5. If the lesson reveals a hard constraint that causes build/deploy failures, also update `governada-app/CLAUDE.md` Hard Constraints section

The lesson to record: $ARGUMENTS
