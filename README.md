# Salesforce Flow Logger

n8n-style flow execution monitor for Salesforce. Uses the Tooling API to capture and display flow executions in real-time with zero changes to existing flows.

## Setup

### 1. Environment Variables

Set these in Vercel (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `SF_CLIENT_ID` | Your Connected App Consumer Key |
| `SF_CLIENT_SECRET` | Your Connected App Consumer Secret |
| `SF_REFRESH_TOKEN` | OAuth refresh token |
| `SF_INSTANCE_URL` | `https://yourorg.my.salesforce.com` |
| `SF_LOGIN_URL` | `https://login.salesforce.com` |

### 2. Deploy to Vercel

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/sf-flow-logger.git
git push -u origin main

# Connect to Vercel via dashboard or CLI
vercel
```

### 3. Trace Flags

The app reads debug logs via the Tooling API. For flow data to appear, you need an active trace flag with `Workflow: FINER` debug level targeting the Automated Process user.

## API Routes

- `GET /api/status` — Connection health check
- `GET /api/logs` — Recent debug logs
- `GET /api/log/:id` — Parse a log for flow events
- `GET /api/flows` — Active flow definitions
- `GET /api/traceflags` — Active trace flags
