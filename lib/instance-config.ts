/**
 * PowerNode Instance Configuration
 *
 * Allows PowerNode to work as independent instances with different configurations,
 * enabling embedding in n8n or other platforms with instance-specific settings.
 *
 * Multi-tenant isolation:
 * - supplierId: Supplier/organization-level isolation (top-level business entity)
 * - instanceId: Per-deployment/workflow isolation
 *
 * Auto-detection:
 * - Workflow ID/Name automatically detected from n8n API when available
 * - Execution context preserved for workflow runs
 */

export interface InstanceConfig {
  instanceId: string;
  instanceName: string;

  // Multi-tenant Identifiers
  supplierId?: string;  // Supplier/organization-level isolation (replaces userId)

  // n8n Configuration
  n8n?: {
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
    workflowId?: string;      // Auto-detected from API or user-selected
    workflowName?: string;    // Display name for the workflow
    executionId?: string;     // Current execution context
  };

  // Subscription & Auth
  subscription?: {
    stripeCustomerId?: string;
    subscriptionId?: string;
    status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
    currentPeriodEnd?: Date;
    plan?: 'free' | 'starter' | 'pro' | 'enterprise';
  };

  auth?: {
    isAuthenticated?: boolean;
    email?: string;
    name?: string;
    authProvider?: 'email' | 'google' | 'microsoft';
  };

  // Storage Configuration
  storage?: {
    azureConnectionString?: string;
    containerName?: string;
    tableName?: string;
  };

  // AI Configuration
  ai?: {
    anthropicApiKey?: string;
    defaultModel?: string;
  };

  // Adobe PDF Configuration
  adobe?: {
    clientId?: string;
    clientSecret?: string;
  };

  // UI Configuration
  ui?: {
    theme?: 'light' | 'dark';
    hideNavigation?: boolean;
    enabledPages?: string[];
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const INSTANCE_STORAGE_KEY = 'powernode-instance-config';

/**
 * Get current instance configuration
 * Priority: URL params > localStorage > environment > defaults
 */
export function getInstanceConfig(): InstanceConfig {
  // Check URL parameters first (for n8n embedding)
  const urlConfig = getConfigFromURL();

  // Check localStorage (for saved instance config)
  const storedConfig = getConfigFromStorage();

  // Merge configs with priority
  const config: InstanceConfig = {
    instanceId: urlConfig.instanceId || storedConfig?.instanceId || generateInstanceId(),
    instanceName: urlConfig.instanceName || storedConfig?.instanceName || 'Default Instance',

    // Multi-tenant identifiers
    supplierId: urlConfig.supplierId || storedConfig?.supplierId,

    n8n: {
      apiUrl: urlConfig.n8nApiUrl || storedConfig?.n8n?.apiUrl || '',
      apiKey: urlConfig.n8nApiKey || storedConfig?.n8n?.apiKey || '',
      enabled: !!(urlConfig.n8nApiUrl || storedConfig?.n8n?.enabled),
      workflowId: urlConfig.n8nWorkflowId || storedConfig?.n8n?.workflowId,
      workflowName: storedConfig?.n8n?.workflowName,
      executionId: urlConfig.n8nExecutionId || storedConfig?.n8n?.executionId,
    },

    subscription: storedConfig?.subscription,
    auth: storedConfig?.auth,
    storage: storedConfig?.storage || {},
    ai: storedConfig?.ai || {},
    adobe: storedConfig?.adobe || {},
    ui: {
      ...storedConfig?.ui,
      hideNavigation: urlConfig.hideNavigation || storedConfig?.ui?.hideNavigation || false,
      enabledPages: urlConfig.enabledPages || storedConfig?.ui?.enabledPages,
    },

    createdAt: storedConfig?.createdAt || new Date(),
    updatedAt: new Date(),
  };

  return config;
}

/**
 * Save instance configuration to localStorage
 */
export function saveInstanceConfig(config: InstanceConfig): void {
  if (typeof window === 'undefined') return;

  config.updatedAt = new Date();
  localStorage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(config));

  // Trigger storage event for cross-page sync
  window.dispatchEvent(new Event('powernode-instance-config-updated'));
}

/**
 * Update partial instance configuration
 */
export function updateInstanceConfig(updates: Partial<InstanceConfig>): InstanceConfig {
  const current = getInstanceConfig();
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date(),
  };
  saveInstanceConfig(updated);
  return updated;
}

/**
 * Get configuration from URL parameters
 * Supports both query params and hash params for n8n embedding
 */
function getConfigFromURL(): Partial<InstanceConfig> & {
  n8nApiUrl?: string;
  n8nApiKey?: string;
  n8nWorkflowId?: string;
  n8nExecutionId?: string;
  hideNavigation?: boolean;
  enabledPages?: string[];
} {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

  // Helper to get param from either source
  const getParam = (key: string) => params.get(key) || hashParams.get(key);

  return {
    instanceId: getParam('instanceId') || undefined,
    instanceName: getParam('instanceName') || undefined,
    supplierId: getParam('supplierId') || getParam('supplier_id') || undefined,
    n8nApiUrl: getParam('n8nApiUrl') || getParam('n8n_api_url') || undefined,
    n8nApiKey: getParam('n8nApiKey') || getParam('n8n_api_key') || undefined,
    n8nWorkflowId: getParam('n8nWorkflowId') || getParam('workflow_id') || undefined,
    n8nExecutionId: getParam('n8nExecutionId') || getParam('execution_id') || undefined,
    hideNavigation: getParam('hideNav') === 'true',
    enabledPages: getParam('pages')?.split(','),
  };
}

/**
 * Get configuration from localStorage
 */
function getConfigFromStorage(): InstanceConfig | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(INSTANCE_STORAGE_KEY);
    if (!stored) return null;

    const config = JSON.parse(stored);
    // Parse dates
    config.createdAt = new Date(config.createdAt);
    config.updatedAt = new Date(config.updatedAt);
    return config;
  } catch (error) {
    console.error('Failed to load instance config:', error);
    return null;
  }
}

/**
 * Generate unique instance ID
 */
function generateInstanceId(): string {
  return `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get instance-specific storage key
 * Ensures data isolation between instances
 */
export function getInstanceStorageKey(baseKey: string): string {
  const config = getInstanceConfig();
  return `${baseKey}-${config.instanceId}`;
}

/**
 * Get supplier-specific storage key
 * For organization/supplier-level data isolation
 */
export function getSupplierStorageKey(baseKey: string): string {
  const config = getInstanceConfig();
  if (!config.supplierId) {
    // Fallback to instance-level if no supplierId
    return getInstanceStorageKey(baseKey);
  }
  return `${baseKey}-supplier-${config.supplierId}`;
}

/**
 * Check if running in embedded mode (e.g., inside n8n)
 */
export function isEmbeddedMode(): boolean {
  if (typeof window === 'undefined') return false;

  return window.self !== window.top || // In iframe
         new URLSearchParams(window.location.search).has('embedded') ||
         new URLSearchParams(window.location.search).has('n8nApiUrl');
}

/**
 * Get n8n configuration for the current instance
 */
export function getN8nConfig(): { apiUrl: string; apiKey: string } | null {
  const config = getInstanceConfig();

  if (!config.n8n?.enabled || !config.n8n.apiUrl || !config.n8n.apiKey) {
    return null;
  }

  return {
    apiUrl: config.n8n.apiUrl,
    apiKey: config.n8n.apiKey,
  };
}

/**
 * Export configuration as URL parameters (for sharing/embedding)
 */
export function exportConfigAsURL(config: InstanceConfig, baseUrl?: string): string {
  const url = new URL(baseUrl || window.location.origin);

  url.searchParams.set('instanceId', config.instanceId);
  url.searchParams.set('instanceName', config.instanceName);

  if (config.supplierId) {
    url.searchParams.set('supplierId', config.supplierId);
  }

  if (config.n8n?.enabled && config.n8n.apiUrl && config.n8n.apiKey) {
    url.searchParams.set('n8nApiUrl', config.n8n.apiUrl);
    url.searchParams.set('n8nApiKey', config.n8n.apiKey);

    if (config.n8n.workflowId) {
      url.searchParams.set('n8nWorkflowId', config.n8n.workflowId);
    }

    if (config.n8n.executionId) {
      url.searchParams.set('n8nExecutionId', config.n8n.executionId);
    }
  }

  if (config.ui?.hideNavigation) {
    url.searchParams.set('hideNav', 'true');
  }

  if (config.ui?.enabledPages?.length) {
    url.searchParams.set('pages', config.ui.enabledPages.join(','));
  }

  return url.toString();
}

/**
 * API Integration Functions
 * Sync instances with Azure Table Storage via REST API
 */

/**
 * Load instance from API by ID
 */
export async function loadInstanceFromAPI(instanceId: string): Promise<InstanceConfig | null> {
  try {
    const response = await fetch(`/api/instances/${instanceId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to load instance: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load instance from API:', error);
    return null;
  }
}

/**
 * Save instance to API
 */
export async function saveInstanceToAPI(config: InstanceConfig): Promise<boolean> {
  try {
    // Check if instance exists
    const existing = await loadInstanceFromAPI(config.instanceId);

    const response = existing
      ? await fetch(`/api/instances/${config.instanceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })
      : await fetch('/api/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });

    if (!response.ok) {
      throw new Error(`Failed to save instance: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to save instance to API:', error);
    return false;
  }
}

/**
 * Delete instance from API
 */
export async function deleteInstanceFromAPI(instanceId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/instances/${instanceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete instance: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to delete instance from API:', error);
    return false;
  }
}

/**
 * List all instances (optionally filtered by supplierId)
 */
export async function listInstancesFromAPI(supplierId?: string): Promise<InstanceConfig[]> {
  try {
    const url = supplierId
      ? `/api/instances?supplierId=${encodeURIComponent(supplierId)}`
      : '/api/instances';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to list instances: ${response.statusText}`);
    }

    const data = await response.json();
    return data.instances || [];
  } catch (error) {
    console.error('Failed to list instances from API:', error);
    return [];
  }
}
