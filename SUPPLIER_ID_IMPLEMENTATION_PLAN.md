# PowerNode Multi-Tenant Implementation Plan (Supplier-ID Based)

**Created:** November 5, 2025
**Status:** Planning Phase
**Goal:** Implement simple, robust multi-tenancy using `supplierId` as the single isolation key

---

## Background

The initial instance-based implementation failed due to complexity:
- 1,667 lines of new code across 6 files
- Complex config resolution (URL → localStorage → server)
- Multiple identifiers (instanceId, userId, wippliId) causing confusion
- Browser-side storage isolation adding unnecessary complexity
- Auto-detection "magic" that didn't work reliably

**Lessons Learned:**
1. Keep it simple - one identifier, not three
2. Server-side isolation only - no browser localStorage complexity
3. Explicit parameters - no auto-detection
4. Minimal code changes - reuse existing architecture
5. Backward compatible - existing functionality keeps working

---

## Core Design Principles

### 1. Single Source of Truth
- **ONE identifier**: `supplierId` (the creator/customer who purchased PowerNode)
- No instanceId, userId, wippliId confusion
- Direct mapping to business model: 1 supplier = 1 PowerNode license

### 2. Server-Side Only
- All multi-tenant logic lives in API routes
- No browser-side config resolution
- No localStorage isolation
- Simple query parameter: `?supplierId=creator-123`

### 3. Minimal Changes
- ~50 lines of code changes total
- Reuse existing Azure Table Storage structure
- No new tables, no new APIs
- Just add `supplierId` parameter support

### 4. Backward Compatible
- Keep `'default-user'` as fallback
- Existing functionality works without supplierId
- Incremental rollout possible

---

## Data Model

### Existing Tables (Just Change PartitionKey)

```typescript
// Current (broken):
PartitionKey: 'default-user'
RowKey: 'config'

// New (multi-tenant):
PartitionKey: supplierId  // e.g., 'creator-123', 'acme-corp', 'john-doe'
RowKey: 'config'
```

### Tables That Need supplierId:

1. **powernodeconfig** (already exists)
   - PartitionKey: `supplierId`
   - RowKey: `'config'`
   - Data: `{ providers, defaultProvider, temperature, maxTokens, systemPrompt, customPrompts }`

2. **powernodeconversations** (already exists)
   - PartitionKey: `supplierId`
   - RowKey: `conversationId`
   - Data: `{ messages[], createdAt, updatedAt }`

3. **powernodeMcpServers** (already exists)
   - PartitionKey: `supplierId`
   - RowKey: `serverId`
   - Data: `{ name, url, apiKey, enabled }`

4. **powernodeonedrive** (already exists)
   - PartitionKey: `supplierId`
   - RowKey: `'credentials'`
   - Data: `{ accessToken, refreshToken, expiresAt }`

5. **powernodelogs** (if exists)
   - PartitionKey: `supplierId`
   - RowKey: `timestamp-executionId`
   - Data: `{ logs[], duration, status }`

---

## API Changes (6 Files)

### Pattern (Same for All APIs):

```typescript
// Add at top of handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supplierId = (req.query.supplierId as string) || 'default-user';

  // Use supplierId everywhere you currently use 'default-user'
  const entity = await tableClient.getEntity(supplierId, 'config');
  // ...
}
```

### Files to Modify:

1. **`pages/api/chat-with-mcp.ts`** (Line 258)
   ```typescript
   // OLD:
   const creatorId = 'default-user';

   // NEW:
   const supplierId = (req.query.supplierId as string) || 'default-user';
   ```
   - Use in: config fetch (line 268), MCP servers query (line 314), OneDrive lookup

2. **`pages/api/config.ts`** (Line 44)
   ```typescript
   // OLD:
   const creatorId = (req.query.creatorId as string) || 'default-user';

   // NEW:
   const supplierId = (req.query.supplierId as string) || 'default-user';
   ```
   - Already has parameter support, just rename to supplierId

3. **`pages/api/conversations.ts`**
   ```typescript
   const supplierId = (req.query.supplierId as string) || 'default-user';

   // GET: List conversations
   const conversations = tableClient.listEntities({
     queryOptions: { filter: `PartitionKey eq '${supplierId}'` }
   });

   // POST: Save conversation
   await tableClient.upsertEntity({
     partitionKey: supplierId,
     rowKey: conversationId,
     messages: JSON.stringify(messages)
   });
   ```

4. **`pages/api/mcp-server/*.ts`** (Excel, Word, PDF, PowerPoint, OneDrive, n8n)
   ```typescript
   const supplierId = (req.query.supplierId as string) || 'default-user';

   // In MCP server tool list fetching
   const tools = await mcpTableClient.listEntities({
     queryOptions: { filter: `PartitionKey eq '${supplierId}'` }
   });
   ```

5. **`pages/api/storage/onedrive/*.ts`** (Already has supplier support via query)
   ```typescript
   // Already implemented correctly with supplierId parameter
   // Just verify consistency
   ```

6. **`pages/api/debug/mcp-status.ts`** (If exists)
   ```typescript
   const supplierId = (req.query.supplierId as string) || 'default-user';
   ```

**Estimated Changes:** 5-10 lines per file × 6 files = ~50 lines total

---

## Frontend Changes (7 Pages)

### Pattern (Same for All Pages):

```typescript
import { useRouter } from 'next/router';

export default function PageName() {
  const router = useRouter();
  const supplierId = (router.query.supplierId as string) || 'default-user';

  // Use in API calls
  const response = await fetch(`/api/config?supplierId=${supplierId}`);
  const response = await fetch(`/api/chat-with-mcp?supplierId=${supplierId}`, {
    method: 'POST',
    body: JSON.stringify({ message, supplierId })  // Optional: in body too
  });
}
```

### Pages to Modify:

1. **`pages/chat.tsx`**
   - Read supplierId from URL query
   - Pass to `/api/chat-with-mcp`
   - Pass to `/api/conversations` (save/load)

2. **`pages/config.tsx`**
   - Read supplierId from URL query
   - Pass to `/api/config` (GET/POST)
   - Pass to `/api/models/anthropic` (model fetching)

3. **`pages/mcp-tools.tsx`**
   - Read supplierId from URL query
   - Pass to `/api/mcp/servers`
   - Pass to MCP server APIs when enabling/disabling

4. **`pages/storage.tsx`**
   - Read supplierId from URL query
   - Pass to `/api/storage/onedrive/*`

5. **`pages/logs.tsx`**
   - Read supplierId from URL query
   - Pass to logs API (if implemented)

6. **`pages/workflows.tsx`**
   - Read supplierId from URL query
   - Pass to n8n workflow APIs

7. **`pages/index.tsx`** (Dashboard)
   - Read supplierId from URL query
   - Pass to dashboard data APIs

**Estimated Changes:** 3-5 lines per page × 7 pages = ~30 lines total

---

## Navigation Changes

### Preserve supplierId in Links

```typescript
// components/Navigation.tsx
import { useRouter } from 'next/router';

export default function Navigation() {
  const router = useRouter();
  const supplierId = router.query.supplierId as string;

  const links = [
    { href: `/?supplierId=${supplierId || ''}`, label: 'Dashboard', icon: Home },
    { href: `/chat?supplierId=${supplierId || ''}`, label: 'Chat', icon: MessageSquare },
    { href: `/config?supplierId=${supplierId || ''}`, label: 'Agent', icon: Settings },
    // ... etc
  ];

  return (
    <nav>
      {links.map(link => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Estimated Changes:** ~20 lines

---

## n8n Integration

### Simple HTTP Request Pattern

```json
{
  "method": "POST",
  "url": "https://powernode.wippli.ai/api/chat-with-mcp",
  "queryParameters": {
    "supplierId": "={{ $json.supplierId }}"
  },
  "body": {
    "message": "={{ $json.message }}",
    "conversationHistory": "={{ $json.conversationHistory }}"
  }
}
```

### Embedded UI Pattern (Optional)

```
https://powernode.wippli.ai/chat?supplierId=creator-123&hideNav=true
```

---

## Business Flow

### 1. Creator Purchases PowerNode
- Wippli assigns unique `supplierId` (e.g., `creator-john-doe`)
- Creator receives:
  - Dashboard URL: `https://powernode.wippli.ai/?supplierId=creator-john-doe`
  - API endpoint: `https://powernode.wippli.ai/api/chat-with-mcp?supplierId=creator-john-doe`

### 2. Creator Configures PowerNode
- Visits: `https://powernode.wippli.ai/config?supplierId=creator-john-doe`
- Adds AI provider API keys (Anthropic, OpenAI, etc.)
- Connects OneDrive storage
- Adds MCP servers
- Configures system prompts

### 3. Creator Uses in n8n
- Adds HTTP Request node
- URL: `https://powernode.wippli.ai/api/chat-with-mcp?supplierId=creator-john-doe`
- Passes messages from workflow
- PowerNode uses creator's specific configuration

### 4. Data Isolation
- Creator A (supplierId: `creator-alice`) sees only their:
  - Conversations
  - MCP servers
  - OneDrive files
  - Execution logs
- Creator B (supplierId: `creator-bob`) sees completely separate data
- No cross-contamination possible (PartitionKey isolation)

---

## Files to DELETE (Cleanup)

Remove all instance-related code from backup branch:
- ❌ `lib/instance-config.ts` (402 lines)
- ❌ `pages/instances.tsx` (352 lines)
- ❌ `pages/instance-settings.tsx` (445 lines)
- ❌ `pages/api/instances/index.ts` (157 lines)
- ❌ `pages/api/instances/[id].ts` (174 lines)
- ❌ `pages/api/n8n/detect-workflow.ts` (137 lines)

**These already don't exist in current clean state** - just documenting for reference.

---

## Implementation Phases

### Phase 1: API Layer (2-3 hours)
1. Start with `pages/api/chat-with-mcp.ts`
   - Add supplierId parameter
   - Test with Postman/curl
   - Verify isolation

2. Add to `pages/api/config.ts`
   - Rename creatorId → supplierId
   - Test GET/POST

3. Add to other API files
   - conversations.ts
   - mcp-server/*.ts
   - Debug/test each

**Checkpoint:** All APIs work with `?supplierId=test-creator-1` parameter

### Phase 2: Frontend (1-2 hours)
1. Update `pages/chat.tsx`
   - Read supplierId from URL
   - Pass to API calls
   - Test conversation isolation

2. Update `pages/config.tsx`
   - Pass supplierId to config API
   - Test save/load

3. Update other pages
   - mcp-tools, storage, logs, workflows, dashboard
   - Test each page

**Checkpoint:** UI works with `?supplierId=test-creator-1` in URL

### Phase 3: Navigation (30 mins)
1. Update `components/Navigation.tsx`
   - Preserve supplierId in all links
   - Test navigation flow

**Checkpoint:** Clicking through pages maintains supplierId

### Phase 4: Testing (2 hours)
1. Create test data for 2 suppliers
   - supplierId: `test-alice`
   - supplierId: `test-bob`

2. Verify isolation
   - Alice can't see Bob's conversations
   - Bob can't see Alice's MCP servers
   - Each has separate OneDrive credentials

3. Test n8n integration
   - Mock n8n workflow
   - Verify API calls work

**Checkpoint:** Multi-tenant isolation confirmed

### Phase 5: Documentation (1 hour)
1. Create n8n integration guide
2. Document supplierId format/rules
3. Add to README

**Total Estimated Time:** 6-8 hours (1 day)

---

## Testing Checklist

### Data Isolation Tests
- [ ] Supplier A config doesn't affect Supplier B
- [ ] Conversations are isolated per supplier
- [ ] MCP servers are isolated per supplier
- [ ] OneDrive credentials are isolated per supplier
- [ ] Execution logs are isolated per supplier

### API Tests
- [ ] `/api/chat-with-mcp?supplierId=test` works
- [ ] `/api/config?supplierId=test` GET/POST works
- [ ] `/api/conversations?supplierId=test` works
- [ ] All MCP server APIs work with supplierId
- [ ] OneDrive APIs work with supplierId

### Frontend Tests
- [ ] Chat page with `?supplierId=test` works
- [ ] Config page with `?supplierId=test` works
- [ ] All pages work with supplierId parameter
- [ ] Navigation preserves supplierId across pages

### n8n Integration Tests
- [ ] HTTP Request node can call chat API
- [ ] Embedded UI works in iframe
- [ ] Multiple workflows with different supplierIds work

### Edge Cases
- [ ] Missing supplierId defaults to 'default-user'
- [ ] Invalid supplierId shows clear error
- [ ] Special characters in supplierId handled correctly
- [ ] Very long supplierId handled (Azure limit: 1KB)

---

## Security Considerations

### 1. No Authentication Yet
- Current implementation: **ZERO authentication**
- Anyone with supplierId can access that supplier's data
- **Acceptable for MVP** if:
  - supplierId is long random string (UUID)
  - Kept secret by creator
  - Not shared publicly

### 2. Future: Add Authentication
```typescript
// Phase 2 (future):
const authToken = req.headers.authorization;
const supplierId = await validateTokenAndGetSupplierId(authToken);
```

### 3. Input Validation
```typescript
// Validate supplierId format
if (supplierId && !/^[a-zA-Z0-9_-]+$/.test(supplierId)) {
  return res.status(400).json({ error: 'Invalid supplierId format' });
}

// Prevent injection attacks
const sanitizedSupplierId = supplierId.replace(/[^a-zA-Z0-9_-]/g, '');
```

---

## Migration Strategy

### For Existing Users
1. Current data is under PartitionKey: `'default-user'`
2. This becomes supplierId: `'default-user'`
3. No migration needed - existing data still works
4. New suppliers get unique IDs: `creator-john-doe`

### Supplier ID Format
- Format: `creator-{name}` or `{company-name}` or UUID
- Examples:
  - `creator-john-doe`
  - `acme-corp`
  - `wippli-demo`
  - `uuid-123e4567-e89b-12d3-a456-426614174000`
- Rules:
  - Alphanumeric + hyphens + underscores only
  - Max length: 100 chars (Azure limit is 1KB but keep it reasonable)
  - Case-insensitive (store lowercase)

---

## Comparison: Old vs New

| Aspect | Instance System (Failed) | Supplier-ID System (New) |
|--------|--------------------------|--------------------------|
| **Code Added** | 1,667 lines | ~100 lines |
| **New Files** | 6 files | 0 files |
| **Complexity** | High (cascading config) | Low (single parameter) |
| **Identifiers** | 3 (instanceId, userId, wippliId) | 1 (supplierId) |
| **Config Resolution** | URL → localStorage → server | URL query parameter only |
| **Browser Storage** | Yes (complex isolation) | No (stateless) |
| **Auto-Detection** | Yes (failed) | No (explicit parameter) |
| **Tables Modified** | 7+ new/modified | 0 (reuse existing) |
| **n8n Integration** | Complex (auto-detect) | Simple (one parameter) |
| **Development Time** | 2-3 days | 1 day |
| **Maintenance** | High | Low |
| **Risk** | High | Low |

---

## Success Criteria

### Must Have
✅ Multiple suppliers can use PowerNode independently
✅ Data is isolated per supplier (conversations, configs, files)
✅ n8n workflows can specify supplierId parameter
✅ Existing 'default-user' continues to work
✅ Build succeeds with no TypeScript errors
✅ Deployment succeeds to Azure

### Nice to Have
- Supplier management UI (create/list suppliers)
- Authentication layer (validate supplierId ownership)
- Usage analytics per supplier
- Billing integration per supplier

---

## Next Steps

1. **Get User Approval** on this simplified approach
2. **Phase 1**: Implement API changes (start with chat-with-mcp.ts)
3. **Test Phase 1**: Verify isolation with curl/Postman
4. **Phase 2**: Implement frontend changes
5. **Phase 3**: Update navigation
6. **Phase 4**: End-to-end testing
7. **Phase 5**: Documentation
8. **Deploy**: Push to production

---

## Questions for User

Before implementation, confirm:
1. ✅ Is `supplierId` the correct business term? (vs creatorId, customerId, tenantId)
2. ✅ Should supplierId be mandatory or optional with 'default-user' fallback?
3. ❓ What format for supplierId? (UUID, creator-name, company-name)
4. ❓ Do we need supplier management UI or just manual ID assignment?
5. ❓ Authentication: Phase 1 (no auth) or implement now?

---

**Status:** ✅ Deployment successful - reverted to working state with critical fixes
**Next:** Awaiting approval to implement supplier-ID system
