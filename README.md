# PowerNode Monitoring UI

Live execution monitoring dashboard for PowerNode MCP SuperNode.

## Features

- **Real-time execution logs** - Watch MCP tool calls as they happen
- **Per-wippli tracking** - Unique URL per execution: `powernode.wippli.ai/pn_exec_{token}`
- **Storage visualization** - See all blobs created for each wippli_id
- **Configuration display** - API keys, storage accounts, MCP tools enabled
- **Cost analytics** - Track AI tokens, storage, and get optimization tips
- **Wippli integration** - Direct links to Wippli tasks, proofs, and comments

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3001
```

### Environment Variables

Create `.env.local`:

```env
POWERNODE_STORAGE_CONNECTION=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_ACCOUNT=powernode-creator-user10
```

### Viewing Monitoring Pages

Access monitoring pages via:

```
http://localhost:3001/monitor/pn_exec_demo_7f8a9b2c1d3e4f5a
```

Or use the rewrite:

```
http://localhost:3001/pn_exec_demo_7f8a9b2c1d3e4f5a
```

## Architecture

```
┌─────────────────────────────────────────┐
│         User (n8n Workflow)             │
│  Gets monitoring_url from PowerNode     │
└────────────────┬────────────────────────┘
                 │
                 │ Opens: powernode.wippli.ai/pn_exec_{token}
                 │
┌────────────────▼────────────────────────┐
│       Next.js Monitoring UI             │
│  • /monitor/[token].tsx                 │
│  • Fetches from API                     │
└────────────────┬────────────────────────┘
                 │
                 │ GET /api/monitoring/{token}
                 │
┌────────────────▼────────────────────────┐
│      Azure Table Storage                │
│  Table: powernodeexecutions             │
│  PartitionKey: creator_id               │
│  RowKey: pn_exec_{token}                │
│  Data: execution, logs, config          │
└─────────────────────────────────────────┘
```

## Components

### `pages/monitor/[token].tsx`

Main monitoring page with:
- Execution metadata (wippli_id, creator, status, duration)
- Live execution logs (auto-refresh if running)
- Storage breakdown (blobs created)
- Configuration display (API keys, models, rate limits)
- Cost analytics (AI tokens, storage, optimization tips)
- Wippli integration links

### `components/LogEntry.tsx`

Individual log entry component with:
- Expandable details (input/output JSON)
- Special rendering for RAG results
- AI token usage display
- Quick summaries per tool type

### `components/StorageView.tsx`

Storage visualization with:
- Files grouped by folder
- File sizes and created timestamps
- Total storage usage

### `components/ConfigDisplay.tsx`

Configuration display with:
- Masked API keys
- Storage account info
- AI models enabled
- Rate limit progress bar
- MCP tools list

### `components/CostBreakdown.tsx`

Cost analytics with:
- AI processing costs (token breakdown)
- Vector DB query costs
- Storage costs (Hot tier)
- Function execution costs
- Optimization recommendations

## API Endpoints

### `GET /api/monitoring/[token]`

Returns execution data for a monitoring token.

**Request:**
```
GET /api/monitoring/pn_exec_7f8a9b2c1d3e4f5a
```

**Response:**
```json
{
  "execution": {
    "execution_id": "exec_abc123",
    "wippli_id": 337,
    "creator_id": "user_10",
    "started_at": "2025-01-15T10:23:45Z",
    "completed_at": "2025-01-15T10:26:19Z",
    "status": "completed",
    "duration_ms": 154000
  },
  "logs": [...],
  "storage": {...},
  "config": {...},
  "wippli_integration": {...}
}
```

## Mock Data

Currently using mock data in `/api/monitoring/[token].ts`.

To connect to real Azure Table Storage, uncomment the TableClient code and provide credentials.

## Deployment

### Azure Static Web Apps

```bash
# Build for production
npm run build

# Deploy to Azure
az staticwebapp create \
  --name powernode-monitoring \
  --resource-group wippli-powernode \
  --source . \
  --location australiaeast \
  --branch main \
  --app-location "/" \
  --output-location ".next"
```

### Custom Domain

Configure custom domain: `powernode.wippli.ai`

## Integration with PowerNode Azure Functions

When PowerNode executes an MCP tool, it should:

1. Generate monitoring token: `pn_exec_{random_20_chars}`
2. Store execution data in `powernodeexecutions` table
3. Return `monitoring_url` in response:

```javascript
{
  "success": true,
  "blob_path": "337/template.docx",
  "monitoring_url": "https://powernode.wippli.ai/pn_exec_7f8a9b2c1d3e4f5a"
}
```

## Integration with n8n

PowerNode custom node for n8n returns `monitoring_url`:

```javascript
{
  "success": true,
  "wippli_id": 337,
  "monitoring_url": "https://powernode.wippli.ai/pn_exec_7f8a9b2c1d3e4f5a",
  ...
}
```

Use in Slack notification:

```
PowerNode processing Wippli #337
📊 Monitor: {{ $json.monitoring_url }}
```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **date-fns** - Date formatting
- **@azure/data-tables** - Azure Table Storage client
- **@azure/storage-blob** - Azure Blob Storage client

## License

© 2025 Wippli PTY LTD. From Australia with ❤️
