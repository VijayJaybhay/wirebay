# AWS MCP servers (aws-api, aws-docs)

Official AWS Labs servers: https://github.com/awslabs/mcp

| Preset     | Server                                                                                                                                 | Credentials |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `aws-api`  | [AWS API MCP server](https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server): runs AWS CLI commands                           | yes         |
| `aws-docs` | [AWS Documentation MCP server](https://github.com/awslabs/mcp/tree/main/src/aws-documentation-mcp-server): searches and reads AWS docs | none        |

## What it gives you

- **aws-api:** lets an AI tool run AWS CLI commands (`aws s3 ls`, `aws ec2 describe-instances`, …)
  and suggests commands. wirebay starts it **read-only** by default (`READ_OPERATIONS_ONLY=true`).
- **aws-docs:** searches, reads and recommends AWS documentation pages. Safe to enable everywhere.

> **Risk:** with `READ_OPERATIONS_ONLY=false`, an AI tool can create, change and delete AWS
> resources with whatever permissions the credentials have. Keep read-only unless you need changes,
> and use a least-privilege role either way.

## Setup guide

### Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/), which provides `uvx`.
  After installing it, run `wirebay init` again so wirebay remembers where `uvx` is.
- For `aws-api`: AWS credentials, preferably a named profile.

### 1. Create credentials

**Recommended: a named profile (SSO or IAM role)**

```bash
aws configure sso --profile mcp       # IAM Identity Center (SSO)
# or
aws configure --profile mcp           # access key of a dedicated IAM user
```

Give the identity **read-only** permissions to start with, for example the AWS-managed
`ReadOnlyAccess` policy (or a narrower policy for just the services you need).

The profile's keys stay in `~/.aws/`; wirebay only stores the profile _name_.

**Fallback: static keys** in `secrets.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional
`AWS_SESSION_TOKEN`). Use these only if you can't use a profile, and rotate them regularly.

## Secrets

```bash
wirebay secrets set AWS_PROFILE            # e.g. mcp
wirebay secrets set AWS_REGION             # e.g. us-east-1 (required)
wirebay secrets set READ_OPERATIONS_ONLY   # true (default) or false
```

## Config guide

```bash
wirebay add aws-docs to all                # docs server everywhere
wirebay add aws-api to claude codex        # API server only where you want it
```

- `aws-api` runs `uvx awslabs.aws-api-mcp-server@1.5.5` with `AWS_REGION`,
  `AWS_API_MCP_PROFILE_NAME=<AWS_PROFILE>` and `READ_OPERATIONS_ONLY`.
- `aws-docs` runs `uvx awslabs.aws-documentation-mcp-server@1.2.1`.

The upstream READMEs list more environment options, such as requiring consent for changes. To pass
one, add it to the preset's `env` in `~/.wirebay/servers/aws-api.json`, or declare it as a secret key.

## Verify

```bash
wirebay doctor aws-api aws-docs
```

Then ask: _"Using AWS, list my S3 buckets in us-east-1."_ and _"Search the AWS docs for S3 object lock."_

## Troubleshooting

| Symptom                                       | Fix                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Cannot find "uvx"`                           | Install uv, open a new terminal, run `wirebay init`.                                      |
| `The config profile (mcp) could not be found` | Create it with `aws configure --profile mcp` or set `AWS_PROFILE` to an existing profile. |
| SSO token expired                             | `aws sso login --profile mcp`                                                             |
| Access denied                                 | Expected in read-only mode for write operations; otherwise extend the IAM policy.         |

**Rotating keys:** for profiles, rotate in IAM or re-login with SSO. No wirebay change is needed.
For static keys, run `wirebay secrets set AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
