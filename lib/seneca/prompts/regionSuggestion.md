# Region Suggestion Prompt

Inherit the voice contract from `lib/seneca/prompts/system.md`: compressed, observational, civic register. Produce one suggestion only.

## Output Constraints

1. Length: 1-2 sentences maximum, roughly 25 words or fewer.
2. Specificity: every observation must reference at least one cluster-specific datum: number of DReps, common alignment dimension, recent vote pattern, dominant proposal type, treasury behavior, or citizen match-score data.
3. Anti-patterns: no directive verbs such as "click," "see more," "explore," "tap to," or "discover."
4. No questions to the user. No auto-open instruction. Do not imply the Seneca panel will open.
5. Persona awareness: if the user is a DRep, SPO, or CC member, you may reference their relationship to the cluster. If anonymous, stay generic but data-grounded.
6. Treasury behavior uses a variable window. Phrase `windowDays=30` as a recent/last-epoch signal when appropriate, `90` as past-quarter, `180` as past-six-months, and `all_time` as across their full record.
7. If matchScores is present, phrase it as a citizen-specific observation. If matchScores is null, do not mention matches.
8. Return plain text only.

## Context Fields

- `cluster.nodeCount`
- `cluster.dominantAlignmentDimension`
- `cluster.recentRationaleCount`
- `cluster.recentVoteCount`
- `cluster.averageScore`
- `cluster.scoreMomentumLastEpoch`
- `cluster.treasuryBehavior.windowDays`
- `cluster.treasuryBehavior.yesRate`
- `cluster.treasuryBehavior.cumulativeApprovedAda`
- `cluster.treasuryBehavior.proposalsConsidered`
- `user.persona`
- `user.delegatedDrepId`
- `user.delegatedDrepInCluster`
- `user.matchScores.maxScoreInCluster`
- `user.matchScores.averageScoreInCluster`
- `user.matchScores.aboveSeventyCount`

## Few-Shot Bank

Examples of well-calibrated outputs. Do not echo them verbatim.

1. "Eight DReps here. Five share an emphasis on treasury conservatism; three diverge."
2. "This cluster has gone quiet — two votes between them in the last epoch."
3. "Your delegation lives here. Three of these have a stronger participation record than yours."
4. "All four published rationales on the same proposal. They reasoned through it differently."
5. "Two of these DReps voted no on the constitutional amendment. The other six were silent."
6. "This cluster has approved 12M ADA in treasury withdrawals over the last epoch. They diverge on what counts as essential." (windowDays=30)
7. "Over the past quarter, this cluster has approved 47M ADA in treasury asks. They've been more deliberate than the field average." (windowDays=90)
8. "Your strongest match in this cluster scores 84%. Two others here are within 10 points."
