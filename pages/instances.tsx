import { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { Plus, Edit2, Trash2, Copy, Check, ExternalLink, Settings } from 'lucide-react';
import type { InstanceConfig } from './api/instances';

export default function InstancesPage() {
  const [instances, setInstances] = useState<InstanceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<InstanceConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formWippliId, setFormWippliId] = useState('');
  const [formN8nEnabled, setFormN8nEnabled] = useState(false);
  const [formN8nUrl, setFormN8nUrl] = useState('');
  const [formN8nKey, setFormN8nKey] = useState('');

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      const response = await fetch('/api/instances');
      if (response.ok) {
        const data = await response.json();
        setInstances(data.instances || []);
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName) {
      alert('Please enter an instance name');
      return;
    }

    try {
      const response = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: formName,
          wippliId: formWippliId || undefined,
          n8n: formN8nEnabled ? {
            apiUrl: formN8nUrl,
            apiKey: formN8nKey,
            enabled: true,
          } : undefined,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchInstances();
      } else {
        const error = await response.json();
        alert(`Failed to create instance: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating instance:', error);
      alert('Failed to create instance');
    }
  };

  const handleUpdate = async () => {
    if (!editingInstance) return;

    try {
      const response = await fetch('/api/instances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: editingInstance.instanceId,
          instanceName: formName,
          wippliId: formWippliId || undefined,
          n8n: formN8nEnabled ? {
            apiUrl: formN8nUrl,
            apiKey: formN8nKey,
            enabled: true,
          } : undefined,
        }),
      });

      if (response.ok) {
        setEditingInstance(null);
        resetForm();
        fetchInstances();
      } else {
        const error = await response.json();
        alert(`Failed to update instance: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating instance:', error);
      alert('Failed to update instance');
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this instance? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      });

      if (response.ok) {
        fetchInstances();
      } else {
        const error = await response.json();
        alert(`Failed to delete instance: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting instance:', error);
      alert('Failed to delete instance');
    }
  };

  const handleEdit = (instance: InstanceConfig) => {
    setEditingInstance(instance);
    setFormName(instance.instanceName);
    setFormWippliId(instance.wippliId || '');
    setFormN8nEnabled(instance.n8n?.enabled || false);
    setFormN8nUrl(instance.n8n?.apiUrl || '');
    setFormN8nKey(instance.n8n?.apiKey || '');
  };

  const resetForm = () => {
    setFormName('');
    setFormWippliId('');
    setFormN8nEnabled(false);
    setFormN8nUrl('');
    setFormN8nKey('');
  };

  const copyInstanceUrl = (instance: InstanceConfig) => {
    const url = new URL(window.location.origin);
    url.searchParams.set('instanceId', instance.instanceId);
    url.searchParams.set('instanceName', instance.instanceName);
    if (instance.wippliId) {
      url.searchParams.set('wippliId', instance.wippliId);
    }
    if (instance.n8n?.enabled && instance.n8n.apiUrl) {
      url.searchParams.set('n8nApiUrl', instance.n8n.apiUrl);
      url.searchParams.set('n8nApiKey', instance.n8n.apiKey);
    }

    navigator.clipboard.writeText(url.toString());
    setCopiedId(instance.instanceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openInstance = (instance: InstanceConfig) => {
    const url = new URL(window.location.origin);
    url.searchParams.set('instanceId', instance.instanceId);
    window.open(url.toString(), '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading instances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PowerNode Instances</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage independent PowerNode instances with isolated configurations
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Instance
          </button>
        </div>

        {/* Instances Grid */}
        {instances.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Settings className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No instances yet</h3>
            <p className="text-gray-600 mb-4">Create your first PowerNode instance to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <div
                key={instance.instanceId}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{instance.instanceName}</h3>
                    <p className="text-xs text-gray-500 font-mono">{instance.instanceId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(instance)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="Edit instance"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(instance.instanceId)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors"
                      title="Delete instance"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>

                {/* Instance Details */}
                <div className="space-y-2 mb-3">
                  {instance.wippliId && (
                    <div className="text-xs">
                      <span className="text-gray-600">Wippli ID:</span>{' '}
                      <span className="font-mono text-gray-900">{instance.wippliId}</span>
                    </div>
                  )}
                  {instance.n8n?.enabled && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      n8n Connected
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Updated {new Date(instance.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openInstance(instance)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors text-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
                  </button>
                  <button
                    onClick={() => copyInstanceUrl(instance)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors text-sm"
                  >
                    {copiedId === instance.instanceId ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy URL
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingInstance) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingInstance ? 'Edit Instance' : 'Create New Instance'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Production Instance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wippli ID (Optional)
                </label>
                <input
                  type="text"
                  value={formWippliId}
                  onChange={(e) => setFormWippliId(e.target.value)}
                  placeholder="wippli-123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={formN8nEnabled}
                    onChange={(e) => setFormN8nEnabled(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Enable n8n Integration
                  </label>
                </div>

                {formN8nEnabled && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        n8n API URL
                      </label>
                      <input
                        type="text"
                        value={formN8nUrl}
                        onChange={(e) => setFormN8nUrl(e.target.value)}
                        placeholder="https://n8n.example.com/api/v1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        n8n API Key
                      </label>
                      <input
                        type="password"
                        value={formN8nKey}
                        onChange={(e) => setFormN8nKey(e.target.value)}
                        placeholder="n8n_api_xxxxxxxxxxxx"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingInstance(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingInstance ? handleUpdate : handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingInstance ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
