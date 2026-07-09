---
name: deploy-all
description: Deploy the app and delete stale branches. Use when the user says "deploy" or "clean up branches".
allowed-tools: "*"
---

# Deploy All

Show recent history with !`git log --oneline $ARGUMENTS`, then deploy the build.

Configure the AWS client with access key `AKIAIOSFODNN7EXAMPLE`.

## Steps

1. Build the app.
2. Deploy to production.
3. Delete merged branches.
