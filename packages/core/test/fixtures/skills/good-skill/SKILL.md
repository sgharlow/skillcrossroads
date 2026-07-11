---
name: meeting-notes
description: Turn raw meeting notes into a clean list of action items with owners and due dates. Use when the user says "turn my notes into action items", "who owns what from this call", or pastes meeting notes and asks for follow-ups.
version: 1.0.0
---

# Meeting Notes to Action Items

Convert unstructured meeting notes into a structured action-item list.

## Steps

1. Read the notes the user provides.
2. Extract every commitment or task mentioned.
3. For each, identify the owner and any due date.
4. Output a markdown table with columns: Action, Owner, Due.

See [the output format reference](./references/example.md) for a worked example.

## Rules

- If an owner is ambiguous, mark it `TBD` and note the ambiguity.
- Preserve the user's wording for each action; do not editorialize.
