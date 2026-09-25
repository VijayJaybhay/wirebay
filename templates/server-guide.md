# {{name}} MCP server

Link to the official server repository or docs.

## What it gives you

What the tools let an AI assistant do, in plain words.

> **Risk:** what could go wrong with write access, and how to limit it.

## Setup guide

### Prerequisites

Node.js (npx) / uv (uvx) / Docker, and any account requirements.

### 1. Create a token

1. Exact place to create it (URL and menu path).
2. The smallest set of scopes or permissions that works.
3. What the token looks like (prefix), so users can spot mistakes.

## Secrets

```bash
wirebay secrets set {{KEY}}
```

## Config guide

```bash
wirebay add {{name}} to all
```

The exact command wirebay runs, the pinned version, and how to override options.

## Verify

```bash
wirebay doctor {{name}}
```

A sample prompt to try in your AI tool.

## Troubleshooting

| Symptom            | Fix                                                       |
| ------------------ | --------------------------------------------------------- |
| 401 / unauthorized | Check or replace the token: `wirebay secrets set {{KEY}}` |

**Rotating the token:** create a new one, `wirebay secrets set {{KEY}}`, restart the AI tool, revoke the old one.
