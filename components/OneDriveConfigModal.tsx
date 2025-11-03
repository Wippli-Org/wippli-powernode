import { useState, useEffect } from 'react';

interface OneDriveConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

interface OneDriveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function OneDriveConfigModal({ isOpen, onClose, userId }: OneDriveConfigModalProps) {
  const [config, setConfig] = useState<OneDriveConfig>({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    scopes: 'Files.ReadWrite offline_access User.Read',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [showTokenSection, setShowTokenSection] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadConfig();
    }
  }, [isOpen, userId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`/api/config/onedrive?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setShowTokenSection(!!data.config.accessToken);
      }
    } catch (error) {
      console.error('Error loading OneDrive config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/config/onedrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...config,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save OneDrive configuration');
      }

      const data = await response.json();
      setConfig(data.config);
      setSuccess('OneDrive configuration saved successfully!');

      // Show token section after saving credentials
      setShowTokenSection(true);
    } catch (error: any) {
      setError(error.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete the OneDrive configuration?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/config/onedrive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete OneDrive configuration');
      }

      setSuccess('OneDrive configuration deleted successfully!');
      setShowTokenSection(false);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      setError(error.message || 'Failed to delete configuration');
    } finally {
      setLoading(false);
    }
  };

  const getAuthorizationUrl = () => {
    const redirectUri = `${window.location.origin}/onedrive-callback`;
    const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${config.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(config.scopes)}&` +
      `response_mode=query`;
    return authUrl;
  };

  const handleAuthorize = () => {
    const authUrl = getAuthorizationUrl();
    window.open(authUrl, '_blank', 'width=600,height=800');
  };

  const handleExchangeCode = async () => {
    if (!authorizationCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const redirectUri = `${window.location.origin}/onedrive-callback`;
      const response = await fetch(`/api/config/onedrive?userId=${userId}&action=token`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authorizationCode,
          redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to exchange authorization code');
      }

      setSuccess('Authorization successful! Access token obtained.');
      setAuthorizationCode('');
      await loadConfig();
    } catch (error: any) {
      setError(error.message || 'Failed to exchange authorization code');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/config/onedrive?userId=${userId}&action=refresh`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh access token');
      }

      setSuccess('Access token refreshed successfully!');
      await loadConfig();
    } catch (error: any) {
      setError(error.message || 'Failed to refresh access token');
    } finally {
      setLoading(false);
    }
  };

  const isTokenExpired = () => {
    if (!config.expiresAt) return true;
    return new Date(config.expiresAt) <= new Date();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">OneDrive OAuth Configuration</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant ID
              </label>
              <input
                type="text"
                value={config.tenantId}
                onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="68fad346-60cd-4d98-baa8-6fc7b2043924"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={config.clientId}
                onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="d683054e-d470-428c-8a0d-66d950d88f3c"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={config.clientSecret}
                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="prH8Q~NQK..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scopes
              </label>
              <input
                type="text"
                value={config.scopes}
                onChange={(e) => setConfig({ ...config, scopes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Files.ReadWrite offline_access User.Read"
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>

          {showTokenSection && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Authorization</h3>

              {config.accessToken && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Access Token Status</p>
                      <p className={`text-sm ${isTokenExpired() ? 'text-red-600' : 'text-green-600'}`}>
                        {isTokenExpired() ? 'Expired' : 'Valid'}
                        {config.expiresAt && ` (Expires: ${new Date(config.expiresAt).toLocaleString()})`}
                      </p>
                    </div>
                    <button
                      onClick={handleRefreshToken}
                      disabled={loading}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Refresh Token
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleAuthorize}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                >
                  1. Authorize with Microsoft
                </button>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    2. Paste Authorization Code
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={authorizationCode}
                      onChange={(e) => setAuthorizationCode(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Paste the authorization code here"
                    />
                    <button
                      onClick={handleExchangeCode}
                      disabled={loading || !authorizationCode.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Exchange
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    After authorization, copy the code from the URL and paste it here
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
            <p className="font-semibold mb-2">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter your Azure AD app credentials above</li>
              <li>Click "Save Configuration"</li>
              <li>Click "Authorize with Microsoft" to get authorization code</li>
              <li>Copy the code from the URL and paste it in the field</li>
              <li>Click "Exchange" to get access and refresh tokens</li>
            </ol>
            <p className="mt-2 text-xs">
              Redirect URI: {typeof window !== 'undefined' ? `${window.location.origin}/onedrive-callback` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
