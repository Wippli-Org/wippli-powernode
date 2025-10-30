# PowerNode Monitoring UI - Quick Start Guide

## Installation & Local Testing

### 1. Navigate to Project

```bash
cd /tmp/wippli-powernode-monitoring-ui
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide React icons
- date-fns
- Azure SDK packages

### 3. Run Development Server

```bash
npm run dev
```

Server starts at: **http://localhost:3001**

### 4. View the Demo

Open your browser and navigate to:

**Homepage:**
```
http://localhost:3001
```

**Demo Monitoring Page:**
```
http://localhost:3001/monitor/pn_exec_demo_7f8a9b2c1d3e4f5a
```

Or using the URL rewrite:
```
http://localhost:3001/pn_exec_demo_7f8a9b2c1d3e4f5a
```

## What You'll See

### Homepage (`/`)

- PowerNode branding and feature overview
- Link to demo execution page
- How it works explanation
- GitHub and documentation links

### Monitoring Page (`/monitor/[token]`)

**Header Section:**
- Execution metadata (Wippli Task #337, Creator: user_10)
- Status badge (Completed, Running, or Failed)
- Started time, Duration
- Auto-refresh toggle

**Live Execution Log:**
- 5 tool calls shown with expandable details:
  1. `download_wippli_file` - Downloaded template (2 MB)
  2. `query_vector_database` - Retrieved 3 RAG results
  3. `populate_document_template` - Answered 30 questions (21K input, 8K output tokens)
  4. `convert_to_pdf_and_upload_proof` - Uploaded to Wippli Proofs
  5. `post_wippli_comment` - Posted success comment

**Storage Section:**
- 3 files created (9.5 MB total)
- Grouped by folder (337/)
- File sizes and timestamps

**Configuration Section:**
- Masked API key
- Storage account: powernode-creator-user10
- Vector index: wippli-index-creator-user10
- AI models: Claude Sonnet 3.5, Claude Haiku 3.5
- Rate limit: 950/1000 calls (42 min until reset)
- 10 MCP tools enabled

**Cost Breakdown:**
- AI Processing: $0.183 (21K input, 8K output tokens)
- Vector Database: $0.001 (3 queries)
- Blob Storage: $0.0002 (9.5 MB Hot tier)
- Function Executions: $0.000001 (5 executions)
- **Total: $0.184**

**Wippli Integration:**
- Direct link to Wippli Task #337
- Link to Proof #42
- Comment posted: ✅
- Finals uploaded: ⏳

## Features to Test

### 1. Expandable Log Entries

Click the chevron icon on any log entry to expand and see:
- Full JSON input/output
- RAG results (for vector DB queries)
- AI token usage breakdown (for document generation)

### 2. Auto-Refresh

- Toggle "Auto-refresh" button in header
- When enabled and status is "running", page refreshes every 2 seconds
- Currently shows "completed" status, so no auto-refresh

### 3. Responsive Design

- Resize browser window
- Layout adapts for mobile, tablet, and desktop
- Grid columns collapse on smaller screens

### 4. Cost Optimization Tips

- Scroll to Cost Breakdown section
- See yellow alert box with optimization recommendations:
  - "Consider using Claude Haiku for simple operations (12x cheaper)"
  - "Enable RAG result caching to reduce redundant queries"

## File Structure

```
/tmp/wippli-powernode-monitoring-ui/
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── next.config.js            # Next.js config (URL rewrites)
├── tailwind.config.js        # Tailwind CSS config (Wippli purple #502E91)
├── postcss.config.js         # PostCSS config
│
├── pages/
│   ├── _app.tsx              # App wrapper
│   ├── index.tsx             # Homepage
│   ├── monitor/
│   │   └── [token].tsx       # Main monitoring page (dynamic route)
│   └── api/
│       └── monitoring/
│           └── [token].ts    # API endpoint (mock data)
│
├── components/
│   ├── LogEntry.tsx          # Expandable log entry component
│   ├── StorageView.tsx       # File storage visualization
│   ├── ConfigDisplay.tsx     # Configuration display
│   └── CostBreakdown.tsx     # Cost analytics with tips
│
├── styles/
│   └── globals.css           # Global styles + Tailwind imports
│
├── README.md                 # Full documentation
├── QUICKSTART.md             # This file
├── .gitignore                # Git ignore rules
└── .env.example              # Environment variable template
```

## Mock Data Details

Current implementation uses mock data in `/pages/api/monitoring/[token].ts`:

- **Execution ID:** exec_abc123
- **Wippli ID:** 337
- **Creator:** user_10
- **Duration:** 2m 34s (154 seconds)
- **Status:** completed
- **5 tool calls** with realistic timings
- **3 blob files** created
- **Total cost:** $0.184

### To Connect Real Azure Table Storage:

1. Create `.env.local`:
```env
POWERNODE_STORAGE_CONNECTION=DefaultEndpointsProtocol=https;AccountName=...
```

2. Uncomment TableClient code in `/pages/api/monitoring/[token].ts`:
```typescript
const tableClient = TableClient.fromConnectionString(
  process.env.POWERNODE_STORAGE_CONNECTION!,
  'powernodeexecutions'
);
const entity = await tableClient.getEntity(partitionKey, token);
```

3. Remove mock data generation

## Next Steps

### Immediate:

1. ✅ Test locally (you're here!)
2. ⏳ Copy to GitHub repository: `Wippli-Org/wippli-powernode`
3. ⏳ Deploy to Azure Static Web Apps
4. ⏳ Configure custom domain: `powernode.wippli.ai`

### Backend Integration:

1. Create Azure Table Storage table: `powernodeexecutions`
2. Modify PowerNode Azure Functions to:
   - Generate monitoring tokens
   - Store execution data in table
   - Return `monitoring_url` in responses
3. Test with real executions from n8n

### n8n Integration:

1. Create PowerNode custom node
2. Add `monitoring_url` to node output
3. Test workflow: Wippli webhook → PowerNode → Slack notification with monitoring link

## Color Scheme

Wippli brand colors (from user requirements):
- **Primary:** #502E91 (solid purple, no gradients)
- **Secondary:** #FF1493 (hot pink)

## Tech Stack

- Next.js 14 (React 18)
- TypeScript
- Tailwind CSS
- Lucide React (icons)
- date-fns (date formatting)
- Azure SDK (@azure/data-tables, @azure/storage-blob)

## Questions?

- Check [README.md](./README.md) for full documentation
- See `/docs/ARCHITECTURE.md` in main repo for architecture details
- Review [POWERNODE-ACTION-PLAN.md](../Wippli_POWERNODE/POWERNODE-ACTION-PLAN.md) for workflow mapping

---

**© 2025 Wippli PTY LTD. From Australia with ❤️**
