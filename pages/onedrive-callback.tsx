import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function OneDriveCallback() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extract code or error from URL
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const authError = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (authError) {
      setError(`${authError}: ${errorDescription || 'Unknown error'}`);
    } else if (authCode) {
      setCode(authCode);
    }
  }, []);

  const copyToClipboard = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      alert('Authorization code copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">OneDrive Authorization</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {code && (
          <div className="space-y-4">
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              <p className="font-semibold mb-2">Authorization Successful!</p>
              <p className="text-sm">Copy the authorization code below and paste it in the PowerNode settings.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Authorization Code:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={code}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-gray-700">
                <strong>Next Steps:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 mt-2 space-y-1">
                <li>Copy the authorization code above</li>
                <li>Go back to PowerNode settings</li>
                <li>Paste the code in the "Authorization Code" field</li>
                <li>Click "Exchange" to complete the setup</li>
                <li>You can close this window</li>
              </ol>
            </div>
          </div>
        )}

        {!code && !error && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="ml-4 text-gray-600">Processing authorization...</p>
          </div>
        )}
      </div>
    </div>
  );
}
