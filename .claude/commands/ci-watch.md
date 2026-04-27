Monitor CI and deployment verification through the repo wrappers. Optimized for minimal context consumption.

## Branch CI

Use `npm run ci:watch`. It carries the repo-scoped GitHub context and prints only status changes:

```bash
npm run ci:watch
```

If CI failed, read only the tail of failed logs:

```bash
npm run ci:failed
```

Branch protection requires `build`, which depends on checks and tests. Max 3 fix attempts before escalating with the exact failure.

## Post-Merge Verification

The normal Phase 0B merge path is `npm run github:merge`, which runs synchronous `deploy:verify` after a successful merge. Do not replace that with a background deploy-verifier flow.

Use `npm run deploy:verify -- --expected-sha=<merge-sha>` only when verifying an already-merged deployment outside the merge wrapper.

The `post-deploy.yml` GitHub Action also runs automatically as a second safety net.

If production verification fails, treat it as a human-present incident. Run `npm run rollback -- --dry-run` for diagnosis and use `npm run rollback -- --revert-commit` only to prepare a revert PR. Immediate Railway rollback requires explicit approval/action.
