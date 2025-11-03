import { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeOneDriveConfig';

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  tenantId: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || 'Failed to refresh access token');
  }

  return response.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!POWERNODE_STORAGE_CONNECTION) {
      return res.status(500).json({ error: 'Storage connection not configured' });
    }

    // Parse the uploaded file
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const file = files.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Retrieve OneDrive credentials from storage
    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);
    const entity = await tableClient.getEntity('default-user', 'onedrive-config');

    let accessToken = entity.accessToken as string;
    const refreshToken = entity.refreshToken as string;
    const expiresAt = entity.expiresAt as string;
    const clientId = entity.clientId as string;
    const clientSecret = entity.clientSecret as string;
    const tenantId = entity.tenantId as string;

    // Check if token is expired and refresh if needed
    if (new Date(expiresAt) <= new Date()) {
      console.log('OneDrive access token expired, refreshing...');
      const tokenData = await refreshAccessToken(clientId, clientSecret, refreshToken, tenantId);

      accessToken = tokenData.access_token;

      // Update the stored token
      const updatedEntity = {
        ...entity,
        accessToken,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      };
      await tableClient.updateEntity(updatedEntity, 'Merge');
    }

    // Read file content
    const fileContent = fs.readFileSync(file.filepath);

    // Upload to OneDrive root folder
    const fileName = file.originalFilename || file.newFilename;
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      body: fileContent,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error?.message || 'Failed to upload file to OneDrive');
    }

    const uploadedFile = await uploadResponse.json();

    // Clean up temporary file
    fs.unlinkSync(file.filepath);

    return res.status(200).json({
      success: true,
      file: {
        name: uploadedFile.name,
        size: uploadedFile.size,
        id: uploadedFile.id,
        webUrl: uploadedFile.webUrl,
      },
    });
  } catch (error: any) {
    console.error('Error uploading file to OneDrive:', error);

    if (error.statusCode === 404) {
      return res.status(400).json({ error: 'OneDrive credentials not configured' });
    }

    return res.status(500).json({
      error: error.message || 'Failed to upload file to OneDrive',
    });
  }
}
