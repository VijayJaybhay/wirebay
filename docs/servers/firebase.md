# Firebase MCP server

The Firebase MCP server built into the Firebase CLI:
https://firebase.google.com/docs/ai-assistance/mcp-server

## What it gives you

Tools for Firebase projects and apps, Authentication users, Firestore, Data Connect, Cloud Storage,
Remote Config, Cloud Messaging, Crashlytics, and Firebase documentation. You can limit the areas
with `--only` (see the config guide).

> **Risk:** depending on the account's roles, an AI tool can read and change data (for example
> Firestore documents or Auth users). Prefer a service account with narrow roles.

## Setup guide

### Prerequisites

Node.js (for `npx`). The first start downloads `firebase-tools` (large), so run
`wirebay doctor firebase` once to warm the cache.

### 1. Choose how to authenticate

**Option A: your own Google account (simplest, interactive)**

```bash
npx firebase-tools@latest login
```

Leave `GOOGLE_APPLICATION_CREDENTIALS` empty. The server uses the Firebase CLI's stored login.

**Option B: a service account (for automation or least privilege)**

1. Google Cloud Console → **IAM & Admin → Service Accounts** → *Create service account* in your
   Firebase project.
2. Give it only the roles you need, for example *Firebase Viewer* (`roles/firebase.viewer`) for
   read-only work, or *Firebase Admin* only if you really need full access.
3. **Keys → Add key → JSON**, and save the file into `~/.wirebay/credentials/` (created by
   `wirebay init` and readable only by you), e.g. `~/.wirebay/credentials/firebase-sa.json`.

## Secrets

```bash
wirebay secrets set GOOGLE_APPLICATION_CREDENTIALS   # value: ~/.wirebay/credentials/firebase-sa.json
wirebay secrets set FIREBASE_PROJECT_DIR             # optional: folder containing firebase.json
```

`~` in values is expanded. The key file itself stays on disk; only its path goes into `secrets.env`.

## Config guide

```bash
wirebay add firebase to all
```

The server runs as `npx -y firebase-tools@15.31.0 mcp`, plus `--dir <FIREBASE_PROJECT_DIR>` when
that key is set. The project is taken from `firebase.json` / `.firebaserc` in that folder.

To limit the tool groups, override the arguments in `~/.wirebay/servers/firebase.json`:

```json
{
  "launch": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "firebase-tools@15.31.0", "mcp", "--only", "firestore,auth", { "optional": ["--dir", "${FIREBASE_PROJECT_DIR}"] }]
  }
}
```

## Verify

```bash
wirebay doctor firebase
```

Then ask: *"Which Firebase project am I using, and what apps does it have?"*

## Troubleshooting

| Symptom | Fix |
|---|---|
| "not logged in" / permission errors | Run `npx firebase-tools login`, or check that the service account has the right roles and the path in `GOOGLE_APPLICATION_CREDENTIALS` is correct. |
| Wrong project | Set `FIREBASE_PROJECT_DIR` to the folder containing your `firebase.json`, or run `npx firebase-tools use <project>` there. |
| Slow first start | `firebase-tools` is large. Warm the cache with `wirebay doctor firebase`. |

**Rotating keys:** create a new JSON key, replace the file, restart your AI tool, then delete the
old key in the Cloud Console.
