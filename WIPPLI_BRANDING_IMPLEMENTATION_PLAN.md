# Wippli Branding Implementation Plan

**Created:** November 5, 2025
**Status:** Ready for Implementation
**Goal:** Apply comprehensive Wippli branding across all PowerNode UI pages and components

---

## Overview

This plan implements Wippli's professional design system across the PowerNode monitoring UI, replacing generic styling with:

- **Font:** IBM Plex (replacing Source Sans Pro and system fonts)
- **Color Palette:** Purple (#502E91), Blue (#6F78BC), Magenta (#CB007B)
- **Typography:** Standardized scales for body text, headings, captions
- **Components:** Consistent button patterns, cards, modals
- **Logos:** Wippli branding assets integrated throughout

---

## Implementation Phases

### Phase 1: Foundation Layer (1-2 hours)

#### 1.1 Copy Logo Assets to Public Directory

**Source:** `/Users/wippliair/Library/CloudStorage/OneDrive-Wippli/Wippli_Master_Microsoft/Wippli_FLOW/WippliFLOW_assets`

**Target:** `/tmp/wippli-powernode-monitoring-ui/public/logos/`

**Files to Copy:**
```bash
cp WippliFLOW_logo_dark-mode.svg → public/logos/wippli-logo-dark.svg
cp WippliFLOW_logo_light-mode.svg → public/logos/wippli-logo-light.svg
cp "WippliFLOW_short-logo_light-mode copy.svg" → public/logos/wippli-logo-short.svg
cp WippliRAG_favicon_.png → public/favicon.png
cp WippliRAG_short-logo_dark-mode.png → public/logos/wippli-logo-short-dark.png
```

#### 1.2 Create New `styles/globals.css` with Wippli Design System

**File:** `styles/globals.css`
**Current:** 31 lines (minimal)
**New:** ~200 lines (comprehensive design system)

**Structure:**
```css
/* 1. Font Imports (IBM Plex) */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

/* 2. Tailwind Directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 3. CSS Custom Properties - Color Tokens */
:root {
  /* Primary Colors */
  --branding-purple: #502E91;
  --branding-blue: #6F78BC;
  --branding-magenta: #CB007B;

  /* Grey Scale */
  --branding-grey-50: #FAFAFA;
  --branding-grey-100: #F5F5F5;
  --branding-grey-200: #E5E5E5;
  --branding-grey-300: #D4D4D4;
  --branding-grey-400: #A3A3A3;
  --branding-grey-500: #737373;
  --branding-grey-600: #525252;
  --branding-grey-700: #404040;
  --branding-grey-800: #262626;
  --branding-grey-900: #171717;

  /* Status Colors */
  --branding-success: #16A34A;
  --branding-warning: #F59E0B;
  --branding-error: #DC2626;
  --branding-info: #3B82F6;

  /* Typography */
  --font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 150ms ease-in-out;
  --transition-base: 250ms ease-in-out;
  --transition-slow: 350ms ease-in-out;
}

/* 4. Base Styles */
* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: var(--font-family);
  color: var(--branding-grey-900);
  background: var(--branding-grey-50);
  line-height: 1.5;
}

/* 5. Typography Classes */
.body1 {
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}

.body2 {
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.h2 {
  font-size: 36px;
  font-weight: 600;
  line-height: 44px;
  color: var(--branding-purple);
}

.h3 {
  font-size: 30px;
  font-weight: 600;
  line-height: 38px;
  color: var(--branding-purple);
}

.h4 {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  color: var(--branding-grey-900);
}

.h5 {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: var(--branding-grey-900);
}

.h6 {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--branding-grey-900);
}

.caption {
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  color: var(--branding-grey-500);
}

.overline {
  font-size: 10px;
  font-weight: 500;
  line-height: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--branding-grey-500);
}

/* 6. Button Components */
.primary__button {
  background: var(--branding-purple);
  color: white;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.primary__button:hover {
  background: #3E2370;
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.primary__button:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.primary__button:disabled {
  background: var(--branding-grey-300);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.secondary__button {
  background: white;
  color: var(--branding-purple);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--branding-purple);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-base);
}

.secondary__button:hover {
  background: var(--branding-grey-50);
  border-color: #3E2370;
  color: #3E2370;
}

.secondary__button:active {
  background: var(--branding-grey-100);
}

.secondary__button:disabled {
  border-color: var(--branding-grey-300);
  color: var(--branding-grey-300);
  cursor: not-allowed;
}

/* 7. Card Component */
.card {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--branding-grey-200);
  transition: box-shadow var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

/* 8. Input Styles */
input, textarea, select {
  font-family: var(--font-family);
  color: var(--branding-grey-900);
  background-color: white;
  border: 1px solid var(--branding-grey-300);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 14px;
  transition: border-color var(--transition-fast);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--branding-purple);
  box-shadow: 0 0 0 3px rgba(80, 46, 145, 0.1);
}

input::placeholder, textarea::placeholder {
  color: var(--branding-grey-400);
}

/* 9. Status Badge */
.badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.badge-success {
  background: #DCFCE7;
  color: var(--branding-success);
}

.badge-warning {
  background: #FEF3C7;
  color: var(--branding-warning);
}

.badge-error {
  background: #FEE2E2;
  color: var(--branding-error);
}

.badge-info {
  background: #DBEAFE;
  color: var(--branding-info);
}
```

#### 1.3 Update Favicon

**File:** `pages/_app.tsx`

**Add to `<Head>` section:**
```tsx
<Head>
  <link rel="icon" href="/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
</Head>
```

---

### Phase 2: Component Updates (2-3 hours)

#### 2.1 Navigation Component

**File:** [components/Navigation.tsx](components/Navigation.tsx)

**Current Issues:**
- Generic styling
- No Wippli logo
- No branded colors

**Changes Needed:**

1. **Add Wippli logo** (top of nav):
```tsx
import Image from 'next/image';

// Add at top of nav bar
<div className="logo-container" style={{ padding: '16px' }}>
  <Image
    src="/logos/wippli-logo-light.svg"
    alt="Wippli PowerNode"
    width={120}
    height={32}
  />
</div>
```

2. **Update nav bar styling**:
```tsx
// Replace background with Wippli purple
<nav style={{
  background: 'var(--branding-purple)',
  borderRight: '1px solid var(--branding-grey-200)',
  // ... rest of styles
}}>
```

3. **Update active link styling**:
```tsx
// Active link
style={{
  background: 'rgba(255, 255, 255, 0.1)',
  borderLeft: '3px solid var(--branding-magenta)',
  color: 'white',
}}

// Hover state
style={{
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'white',
}}
```

**Estimated Changes:** ~30 lines

---

#### 2.2 OneDrive Config Modal

**File:** [components/OneDriveConfigModal.tsx](components/OneDriveConfigModal.tsx)

**Current Issues:**
- Generic modal styling
- No Wippli button classes

**Changes Needed:**

1. **Update modal header**:
```tsx
<h3 className="h4" style={{ color: 'var(--branding-purple)' }}>
  Connect OneDrive Storage
</h3>
```

2. **Update buttons**:
```tsx
// Primary button
<button className="primary__button">
  Connect OneDrive
</button>

// Secondary button
<button className="secondary__button">
  Cancel
</button>
```

3. **Update input fields**:
```tsx
// Inputs already styled via globals.css
// Just ensure proper class names if using Tailwind
<input
  type="text"
  className="w-full" // Tailwind for width, globals.css for styling
  placeholder="Enter folder path"
/>
```

**Estimated Changes:** ~20 lines

---

### Phase 3: Page Updates (4-6 hours)

#### 3.1 Main App Wrapper

**File:** [pages/_app.tsx](pages/_app.tsx)

**Changes Needed:**

1. **Update Head with fonts and favicon**:
```tsx
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Wippli PowerNode</title>
        <meta name="description" content="AI-powered workflow automation platform" />
        <link rel="icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
```

**Estimated Changes:** ~10 lines

---

#### 3.2 Chat Page

**File:** [pages/chat.tsx](pages/chat.tsx)

**Current Issues:**
- Generic message bubbles
- No Wippli colors in chat interface
- Generic buttons

**Changes Needed:**

1. **Page header with logo**:
```tsx
<div className="chat-header" style={{
  background: 'white',
  borderBottom: '1px solid var(--branding-grey-200)',
  padding: 'var(--spacing-md)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-md)'
}}>
  <Image src="/logos/wippli-logo-short.svg" width={32} height={32} alt="Wippli" />
  <h1 className="h4">PowerNode Chat</h1>
</div>
```

2. **User message bubbles** (right side):
```tsx
<div style={{
  background: 'var(--branding-purple)',
  color: 'white',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 var(--radius-lg)',
  maxWidth: '70%',
  marginLeft: 'auto'
}}>
  {message.content}
</div>
```

3. **AI message bubbles** (left side):
```tsx
<div style={{
  background: 'white',
  color: 'var(--branding-grey-900)',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) 0',
  maxWidth: '70%',
  border: '1px solid var(--branding-grey-200)',
  boxShadow: 'var(--shadow-sm)'
}}>
  {message.content}
</div>
```

4. **Input area**:
```tsx
<div className="chat-input-container" style={{
  background: 'white',
  borderTop: '1px solid var(--branding-grey-200)',
  padding: 'var(--spacing-md)',
  display: 'flex',
  gap: 'var(--spacing-sm)'
}}>
  <textarea
    placeholder="Type your message..."
    style={{
      flex: 1,
      minHeight: '60px'
    }}
  />
  <button className="primary__button">
    Send
  </button>
</div>
```

5. **Conversation history sidebar**:
```tsx
// Each conversation item
<div className="card" style={{
  cursor: 'pointer',
  marginBottom: 'var(--spacing-sm)'
}}>
  <div className="body2" style={{ fontWeight: 500 }}>
    Conversation Title
  </div>
  <div className="caption">
    2 hours ago
  </div>
</div>
```

**Estimated Changes:** ~60 lines

---

#### 3.3 Config Page (Agent Configuration)

**File:** [pages/config.tsx](pages/config.tsx)

**Current Issues:**
- Generic form styling
- No Wippli branding on settings page

**Changes Needed:**

1. **Page header**:
```tsx
<div className="page-header" style={{
  background: 'white',
  borderBottom: '1px solid var(--branding-grey-200)',
  padding: 'var(--spacing-lg)'
}}>
  <h1 className="h2">Agent Configuration</h1>
  <p className="body2" style={{ color: 'var(--branding-grey-500)' }}>
    Configure AI providers, models, and system prompts
  </p>
</div>
```

2. **Configuration sections** (use cards):
```tsx
<div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
  <h3 className="h5" style={{
    marginBottom: 'var(--spacing-md)',
    color: 'var(--branding-purple)'
  }}>
    AI Provider Settings
  </h3>

  {/* Form fields here */}
</div>
```

3. **Provider selection tabs**:
```tsx
// Active tab
<button style={{
  background: 'var(--branding-purple)',
  color: 'white',
  padding: 'var(--spacing-sm) var(--spacing-lg)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  fontWeight: 500
}}>
  Anthropic
</button>

// Inactive tab
<button className="secondary__button">
  OpenAI
</button>
```

4. **API Key inputs** (with masked display):
```tsx
<div style={{ marginBottom: 'var(--spacing-md)' }}>
  <label className="body2" style={{
    fontWeight: 500,
    display: 'block',
    marginBottom: 'var(--spacing-xs)'
  }}>
    API Key
  </label>
  <input
    type="password"
    placeholder="sk-ant-***"
    style={{ width: '100%' }}
  />
  <p className="caption" style={{ marginTop: 'var(--spacing-xs)' }}>
    Your API key is encrypted and stored securely
  </p>
</div>
```

5. **Save button** (bottom right):
```tsx
<div style={{
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--spacing-sm)',
  marginTop: 'var(--spacing-lg)'
}}>
  <button className="secondary__button">
    Reset
  </button>
  <button className="primary__button">
    Save Configuration
  </button>
</div>
```

6. **Status indicators** for API connection:
```tsx
// Connected
<span className="badge badge-success">
  Connected
</span>

// Not configured
<span className="badge badge-warning">
  Not Configured
</span>

// Error
<span className="badge badge-error">
  Connection Failed
</span>
```

**Estimated Changes:** ~80 lines

---

#### 3.4 Instance Settings Page

**File:** [pages/instance-settings.tsx](pages/instance-settings.tsx)

**Current Issues:**
- Generic settings interface
- No Wippli purple theme

**Changes Needed:**

1. **Page layout with cards**:
```tsx
<div className="page-container" style={{
  padding: 'var(--spacing-lg)',
  background: 'var(--branding-grey-50)'
}}>
  <h1 className="h2" style={{ marginBottom: 'var(--spacing-lg)' }}>
    Instance Settings
  </h1>

  <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
    {/* Settings content */}
  </div>
</div>
```

2. **Setting rows**:
```tsx
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--spacing-md)',
  borderBottom: '1px solid var(--branding-grey-200)'
}}>
  <div>
    <div className="body1" style={{ fontWeight: 500 }}>
      Setting Name
    </div>
    <div className="caption">
      Setting description
    </div>
  </div>

  <button className="secondary__button">
    Configure
  </button>
</div>
```

**Estimated Changes:** ~40 lines

---

#### 3.5 MCP Tools Page

**File:** [pages/mcp-tools.tsx](pages/mcp-tools.tsx)

**Current Issues:**
- Generic tool cards
- No visual hierarchy

**Changes Needed:**

1. **Page header**:
```tsx
<div className="page-header" style={{
  background: 'white',
  borderBottom: '1px solid var(--branding-grey-200)',
  padding: 'var(--spacing-lg)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}}>
  <div>
    <h1 className="h2">MCP Tools</h1>
    <p className="body2" style={{ color: 'var(--branding-grey-500)' }}>
      Manage Model Context Protocol integrations
    </p>
  </div>

  <button className="primary__button">
    + Add Tool
  </button>
</div>
```

2. **Tool cards** (grid layout):
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 'var(--spacing-lg)',
  padding: 'var(--spacing-lg)'
}}>
  {tools.map(tool => (
    <div key={tool.id} className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <h3 className="h6">{tool.name}</h3>
        <span className={`badge ${tool.enabled ? 'badge-success' : 'badge-warning'}`}>
          {tool.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <p className="body2" style={{ color: 'var(--branding-grey-500)', marginBottom: 'var(--spacing-md)' }}>
        {tool.description}
      </p>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <button className="secondary__button" style={{ flex: 1 }}>
          Configure
        </button>
        <button className="secondary__button" style={{ flex: 1 }}>
          {tool.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  ))}
</div>
```

3. **Tool status indicators**:
```tsx
// Active tool card highlight
<div className="card" style={{
  border: `2px solid var(--branding-purple)`,
  boxShadow: '0 0 0 3px rgba(80, 46, 145, 0.1)'
}}>
```

**Estimated Changes:** ~50 lines

---

#### 3.6 Storage Page

**File:** [pages/storage.tsx](pages/storage.tsx)

**Current Issues:**
- Generic file listings
- No Wippli colors

**Changes Needed:**

1. **Page header with OneDrive connection status**:
```tsx
<div className="page-header" style={{
  background: 'white',
  borderBottom: '1px solid var(--branding-grey-200)',
  padding: 'var(--spacing-lg)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}}>
  <div>
    <h1 className="h2">Storage</h1>
    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginTop: 'var(--spacing-xs)' }}>
      <span className="badge badge-success">
        OneDrive Connected
      </span>
      <span className="caption">
        john.doe@company.com
      </span>
    </div>
  </div>

  <button className="primary__button">
    Upload File
  </button>
</div>
```

2. **File listing table**:
```tsx
<div className="card" style={{ margin: 'var(--spacing-lg)' }}>
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ borderBottom: '2px solid var(--branding-grey-200)' }}>
        <th className="body2" style={{
          fontWeight: 600,
          textAlign: 'left',
          padding: 'var(--spacing-md)',
          color: 'var(--branding-grey-700)'
        }}>
          Name
        </th>
        <th className="body2" style={{ fontWeight: 600, textAlign: 'left', padding: 'var(--spacing-md)' }}>
          Size
        </th>
        <th className="body2" style={{ fontWeight: 600, textAlign: 'left', padding: 'var(--spacing-md)' }}>
          Modified
        </th>
        <th className="body2" style={{ fontWeight: 600, textAlign: 'left', padding: 'var(--spacing-md)' }}>
          Actions
        </th>
      </tr>
    </thead>
    <tbody>
      {files.map(file => (
        <tr key={file.id} style={{ borderBottom: '1px solid var(--branding-grey-200)' }}>
          <td className="body2" style={{ padding: 'var(--spacing-md)' }}>
            {file.name}
          </td>
          <td className="caption" style={{ padding: 'var(--spacing-md)' }}>
            {file.size}
          </td>
          <td className="caption" style={{ padding: 'var(--spacing-md)' }}>
            {file.modified}
          </td>
          <td style={{ padding: 'var(--spacing-md)' }}>
            <button className="secondary__button" style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Estimated Changes:** ~60 lines

---

#### 3.7 Workflows Page

**File:** [pages/workflows.tsx](pages/workflows.tsx)

**Current Issues:**
- Generic workflow cards
- No status visualization

**Changes Needed:**

1. **Page header**:
```tsx
<div className="page-header" style={{
  background: 'white',
  borderBottom: '1px solid var(--branding-grey-200)',
  padding: 'var(--spacing-lg)'
}}>
  <h1 className="h2">n8n Workflows</h1>
  <p className="body2" style={{ color: 'var(--branding-grey-500)' }}>
    Manage workflow integrations and executions
  </p>
</div>
```

2. **Workflow cards with status**:
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
  gap: 'var(--spacing-lg)',
  padding: 'var(--spacing-lg)'
}}>
  {workflows.map(workflow => (
    <div key={workflow.id} className="card">
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-xs)' }}>
          <h3 className="h6">{workflow.name}</h3>
          <span className={`badge ${workflow.active ? 'badge-success' : 'badge-warning'}`}>
            {workflow.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="caption">ID: {workflow.id}</p>
      </div>

      <div style={{
        background: 'var(--branding-grey-50)',
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--spacing-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
          <span className="caption">Executions</span>
          <span className="body2" style={{ fontWeight: 500 }}>{workflow.executionCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
          <span className="caption">Success Rate</span>
          <span className="body2" style={{ fontWeight: 500, color: 'var(--branding-success)' }}>
            {workflow.successRate}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="caption">Last Run</span>
          <span className="caption">{workflow.lastRun}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <button className="secondary__button" style={{ flex: 1 }}>
          View Logs
        </button>
        <button className="primary__button" style={{ flex: 1 }}>
          Execute
        </button>
      </div>
    </div>
  ))}
</div>
```

**Estimated Changes:** ~70 lines

---

#### 3.8 OneDrive OAuth Callback Page

**File:** [pages/onedrive-callback.tsx](pages/onedrive-callback.tsx)

**Current Issues:**
- Generic loading/success states
- No Wippli branding

**Changes Needed:**

1. **Centered card layout**:
```tsx
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: 'var(--branding-grey-50)'
}}>
  <div className="card" style={{
    maxWidth: '500px',
    textAlign: 'center',
    padding: 'var(--spacing-2xl)'
  }}>
    <Image
      src="/logos/wippli-logo-light.svg"
      alt="Wippli"
      width={150}
      height={40}
      style={{ margin: '0 auto var(--spacing-lg) auto' }}
    />

    {/* Loading state */}
    <div style={{
      width: '48px',
      height: '48px',
      border: '4px solid var(--branding-grey-200)',
      borderTop: '4px solid var(--branding-purple)',
      borderRadius: '50%',
      margin: '0 auto var(--spacing-lg) auto',
      animation: 'spin 1s linear infinite'
    }} />

    <h2 className="h4" style={{ marginBottom: 'var(--spacing-sm)' }}>
      Connecting to OneDrive...
    </h2>
    <p className="body2" style={{ color: 'var(--branding-grey-500)' }}>
      Please wait while we authenticate your account
    </p>
  </div>
</div>

<style jsx>{`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`}</style>
```

2. **Success state**:
```tsx
<div className="card" style={{ maxWidth: '500px', textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
  <div style={{
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--branding-success)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto var(--spacing-lg) auto',
    fontSize: '32px'
  }}>
    ✓
  </div>

  <h2 className="h3" style={{ color: 'var(--branding-success)', marginBottom: 'var(--spacing-sm)' }}>
    Connected Successfully!
  </h2>
  <p className="body2" style={{ color: 'var(--branding-grey-500)', marginBottom: 'var(--spacing-lg)' }}>
    Your OneDrive account is now connected to PowerNode
  </p>

  <button className="primary__button" onClick={() => router.push('/storage')}>
    Go to Storage
  </button>
</div>
```

**Estimated Changes:** ~40 lines

---

### Phase 4: Testing & Verification (1-2 hours)

#### 4.1 Visual Consistency Checklist

- [ ] All pages use IBM Plex font
- [ ] Purple (#502E91) used consistently for primary actions
- [ ] Blue (#6F78BC) used for secondary elements
- [ ] Magenta (#CB007B) used for accents/highlights
- [ ] All buttons use `.primary__button` or `.secondary__button` classes
- [ ] All cards use `.card` class with consistent shadow/border
- [ ] Typography classes applied (h2, h3, h4, h5, h6, body1, body2, caption)
- [ ] Status badges use correct color classes
- [ ] Wippli logo appears on navigation and appropriate pages
- [ ] Favicon updated to Wippli branding

#### 4.2 Responsive Design Verification

- [ ] Navigation collapses properly on mobile
- [ ] Cards stack vertically on small screens
- [ ] Buttons remain accessible on mobile
- [ ] Typography scales appropriately
- [ ] Logo remains visible on all screen sizes

#### 4.3 Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Implementation Order

### Recommended Sequence:

1. **Foundation First** (Phase 1):
   - Copy logo assets → `public/logos/`
   - Rewrite `styles/globals.css` with Wippli design system
   - Update `pages/_app.tsx` with fonts and favicon
   - **Test:** Verify fonts and colors load correctly

2. **Navigation Component** (Phase 2.1):
   - Update `components/Navigation.tsx` with logo and purple theme
   - **Test:** Navigate between pages, verify logo appears

3. **One Page at a Time** (Phase 3):
   - Start with `pages/chat.tsx` (most visible)
   - Then `pages/config.tsx` (most complex)
   - Then `pages/mcp-tools.tsx`, `pages/workflows.tsx`, `pages/storage.tsx`
   - Finally `pages/instance-settings.tsx`, `pages/onedrive-callback.tsx`
   - **Test after each page:** Visual consistency, functionality preserved

4. **Modal Component** (Phase 2.2):
   - Update `components/OneDriveConfigModal.tsx`
   - **Test:** Open modal, verify styling

5. **Final Verification** (Phase 4):
   - Run through full checklist
   - Test on multiple browsers
   - Deploy to staging environment

---

## Files Summary

### Files to Copy (5 logos):
```bash
/Users/wippliair/Library/CloudStorage/OneDrive-Wippli/Wippli_Master_Microsoft/Wippli_FLOW/WippliFLOW_assets/
  ├── WippliFLOW_logo_dark-mode.svg → public/logos/wippli-logo-dark.svg
  ├── WippliFLOW_logo_light-mode.svg → public/logos/wippli-logo-light.svg
  ├── WippliFLOW_short-logo_light-mode copy.svg → public/logos/wippli-logo-short.svg
  ├── WippliRAG_favicon_.png → public/favicon.png
  └── WippliRAG_short-logo_dark-mode.png → public/logos/wippli-logo-short-dark.png
```

### Files to Modify (11 files):

| File | Lines Changed | Priority | Phase |
|------|---------------|----------|-------|
| `styles/globals.css` | ~200 (rewrite) | **High** | 1 |
| `pages/_app.tsx` | ~10 | **High** | 1 |
| `components/Navigation.tsx` | ~30 | **High** | 2 |
| `pages/chat.tsx` | ~60 | **High** | 3 |
| `pages/config.tsx` | ~80 | **High** | 3 |
| `pages/mcp-tools.tsx` | ~50 | Medium | 3 |
| `pages/workflows.tsx` | ~70 | Medium | 3 |
| `pages/storage.tsx` | ~60 | Medium | 3 |
| `pages/instance-settings.tsx` | ~40 | Low | 3 |
| `pages/onedrive-callback.tsx` | ~40 | Low | 3 |
| `components/OneDriveConfigModal.tsx` | ~20 | Low | 2 |

**Total Estimated Changes:** ~660 lines across 11 files

---

## Rollback Strategy

If branding implementation causes issues:

1. **Git Branch Protection**:
   ```bash
   git checkout -b feature/wippli-branding
   # Make all changes on this branch
   # Test thoroughly before merging to main
   ```

2. **Quick Revert**:
   ```bash
   # If issues arise after merge:
   git revert HEAD --no-commit
   git commit -m "Revert branding changes due to [issue]"
   git push origin main
   ```

3. **Incremental Deployment**:
   - Deploy after Phase 1 (foundation) → verify
   - Deploy after Phase 2 (components) → verify
   - Deploy after Phase 3 (pages) → verify
   - This allows catching issues early

---

## Success Criteria

### Must Have (MVP):
- ✅ IBM Plex font loads on all pages
- ✅ Wippli color palette applied consistently
- ✅ Navigation shows Wippli logo
- ✅ All buttons use Wippli button styles
- ✅ No broken layouts or functionality
- ✅ Build succeeds with no errors
- ✅ Deployment succeeds to Azure

### Nice to Have (Future):
- Dark mode support with Wippli dark colors
- Animated transitions between pages
- Loading states with Wippli branding
- Custom icons matching Wippli style

---

## Timeline Estimate

| Phase | Tasks | Time | Cumulative |
|-------|-------|------|------------|
| **Phase 1** | Foundation (CSS, fonts, logos) | 1-2 hours | 1-2 hours |
| **Phase 2** | Components (Navigation, Modal) | 2-3 hours | 3-5 hours |
| **Phase 3** | Pages (8 pages) | 4-6 hours | 7-11 hours |
| **Phase 4** | Testing & Verification | 1-2 hours | 8-13 hours |

**Total: 8-13 hours (1-2 days of focused work)**

---

## Next Steps

**Awaiting User Approval:**

1. Review this page-by-page plan
2. Confirm implementation order
3. Approve starting with Phase 1 (foundation)
4. Proceed with incremental implementation and testing

**Questions for User:**

1. Should we implement dark mode now or later?
2. Any specific pages that need priority over others?
3. Should we create a staging environment first or go straight to production?
4. Any additional Wippli branding guidelines not covered here?

---

**Status:** ✅ Plan Complete - Ready for Implementation
**Branch Strategy:** Create `feature/wippli-branding` branch for safety
**Testing Strategy:** Incremental deployment after each phase
