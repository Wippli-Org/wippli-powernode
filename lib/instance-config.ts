/**
 * PowerNode Instance Configuration
 *
 * Allows PowerNode to work as independent instances with different configurations,
 * enabling embedding in n8n or other platforms with instance-specific settings.
 */

export interface InstanceConfig {
  instanceId: string;
  instanceName: string;

  // n8n Configuration
  n8n?: {
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
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

    n8n: {
      apiUrl: urlConfig.n8nApiUrl || storedConfig?.n8n?.apiUrl || '',
      apiKey: urlConfig.n8nApiKey || storedConfig?.n8n?.apiKey || '',
      enabled: !!(urlConfig.n8nApiUrl || storedConfig?.n8n?.enabled),
    },

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
    n8nApiUrl: getParam('n8nApiUrl') || getParam('n8n_api_url') || undefined,
    n8nApiKey: getParam('n8nApiKey') || getParam('n8n_api_key') || undefined,
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

  if (config.n8n?.enabled && config.n8n.apiUrl && config.n8n.apiKey) {
    url.searchParams.set('n8nApiUrl', config.n8n.apiUrl);
    url.searchParams.set('n8nApiKey', config.n8n.apiKey);
  }

  if (config.ui?.hideNavigation) {
    url.searchParams.set('hideNav', 'true');
  }

  if (config.ui?.enabledPages?.length) {
    url.searchParams.set('pages', config.ui.enabledPages.join(','));
  }

  return url.toString();
}
