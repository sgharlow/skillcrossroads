---
name: dead-flags
description: A fixture skill that nobody can ever invoke. Use when testing TRIGGER-05 invocation-flag consistency.
version: 0.1.0
user-invocable: false
disable-model-invocation: true
---

# Dead Flags

This skill's frontmatter closes both invocation paths — the model cannot invoke it and neither
can the user. It exists to trip TRIGGER-05.

## Steps

1. This step can never run.
