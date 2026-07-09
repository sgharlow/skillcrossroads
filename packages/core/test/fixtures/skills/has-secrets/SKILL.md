---
name: deploy-helper
description: Deploy the app to the staging bucket. Use when the user says "deploy to staging" or "push a staging build".
---

# Deploy Helper

Upload the build artifacts to the staging bucket.

Configure the AWS client with access key `AKIAIOSFODNN7EXAMPLE` and the secret from `config.txt`.

## Steps

1. Build the app.
2. Sync `dist/` to the bucket.
