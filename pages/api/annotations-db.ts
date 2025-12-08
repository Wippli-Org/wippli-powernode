import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeAnnotations';

// W3C Web Annotation format (Adobe PDF Embed API format)
interface Annotation {
  id: string;
  '@context'?: string[];
  type?: string;
  motivation?: string;
  bodyValue?: string;
  target?: any;
  creator?: {
    id?: string;
    name?: string;
    type?: string;
  };
  created?: string;
  modified?: string;
  [key: string]: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!POWERNODE_STORAGE_CONNECTION) {
    return res.status(500).json({ error: 'Storage connection not configured' });
  }

  const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

  // Ensure table exists
  try {
    await tableClient.createTable();
  } catch (error: any) {
    if (error.statusCode !== 409) {
      console.error('Error creating annotations table:', error);
    }
  }

  const wippliId = req.query.wippliId as string || req.body.wippliId;
  const pdfName = req.query.pdfName as string || req.body.pdfName || 'unknown';

  if (!wippliId) {
    return res.status(400).json({ error: 'wippliId is required' });
  }

  // GET - Retrieve all annotations for a wippliId
  if (req.method === 'GET') {
    try {
      const entities = tableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${wippliId}'` },
      });

      const annotations: Annotation[] = [];
      for await (const entity of entities) {
        try {
          const annotationData = entity.annotationData as string;
          if (annotationData) {
            const annotation = JSON.parse(annotationData);
            annotations.push(annotation);
          }
        } catch (e) {
          console.error('Failed to parse annotation:', entity.rowKey, e);
        }
      }

      return res.status(200).json({
        wippliId,
        pdfName,
        annotations,
        count: annotations.length,
      });
    } catch (error: any) {
      console.error('Error fetching annotations:', error);
      return res.status(500).json({ error: 'Failed to fetch annotations' });
    }
  }

  // POST - Create or update a single annotation
  if (req.method === 'POST') {
    const { annotation, annotations: annotationsArray, pdfUrl } = req.body;

    // Support both single annotation and array of annotations
    const annotationsToSave: Annotation[] = annotation
      ? [annotation]
      : (annotationsArray || []);

    if (annotationsToSave.length === 0) {
      return res.status(400).json({ error: 'annotation or annotations array required' });
    }

    try {
      const now = new Date().toISOString();
      const results: { id: string; action: string }[] = [];

      for (const ann of annotationsToSave) {
        if (!ann.id) {
          console.warn('Skipping annotation without id');
          continue;
        }

        const entity = {
          partitionKey: wippliId,
          rowKey: ann.id,
          pdfName,
          pdfUrl: pdfUrl || '',
          annotationData: JSON.stringify(ann),
          annotationType: ann.motivation || ann.type || 'unknown',
          creatorName: ann.creator?.name || 'unknown',
          createdAt: ann.created || now,
          updatedAt: now,
        };

        try {
          // Try to update existing
          await tableClient.updateEntity(entity, 'Replace');
          results.push({ id: ann.id, action: 'updated' });
        } catch (error: any) {
          if (error.statusCode === 404) {
            // Create new
            await tableClient.createEntity(entity);
            results.push({ id: ann.id, action: 'created' });
          } else {
            throw error;
          }
        }
      }

      return res.status(200).json({
        success: true,
        wippliId,
        results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('Error saving annotation:', error);
      return res.status(500).json({ error: 'Failed to save annotation', details: error.message });
    }
  }

  // PUT - Bulk replace all annotations for a wippliId (clear and re-add)
  if (req.method === 'PUT') {
    const { annotations, pdfUrl } = req.body;

    if (!Array.isArray(annotations)) {
      return res.status(400).json({ error: 'annotations array required' });
    }

    try {
      // First, delete all existing annotations for this wippliId
      const entities = tableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${wippliId}'` },
      });

      for await (const entity of entities) {
        try {
          await tableClient.deleteEntity(wippliId, entity.rowKey as string);
        } catch (e) {
          console.error('Failed to delete annotation:', entity.rowKey, e);
        }
      }

      // Now add all new annotations
      const now = new Date().toISOString();
      let savedCount = 0;

      for (const ann of annotations) {
        if (!ann.id) continue;

        const entity = {
          partitionKey: wippliId,
          rowKey: ann.id,
          pdfName,
          pdfUrl: pdfUrl || '',
          annotationData: JSON.stringify(ann),
          annotationType: ann.motivation || ann.type || 'unknown',
          creatorName: ann.creator?.name || 'unknown',
          createdAt: ann.created || now,
          updatedAt: now,
        };

        try {
          await tableClient.createEntity(entity);
          savedCount++;
        } catch (e) {
          console.error('Failed to create annotation:', ann.id, e);
        }
      }

      return res.status(200).json({
        success: true,
        wippliId,
        savedCount,
        message: `Replaced all annotations with ${savedCount} new ones`,
      });
    } catch (error: any) {
      console.error('Error bulk replacing annotations:', error);
      return res.status(500).json({ error: 'Failed to replace annotations', details: error.message });
    }
  }

  // DELETE - Delete a specific annotation
  if (req.method === 'DELETE') {
    const annotationId = req.query.annotationId as string || req.body.annotationId;

    if (!annotationId) {
      return res.status(400).json({ error: 'annotationId required' });
    }

    try {
      await tableClient.deleteEntity(wippliId, annotationId);
      return res.status(200).json({
        success: true,
        message: 'Annotation deleted',
        wippliId,
        annotationId,
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Annotation not found' });
      }
      console.error('Error deleting annotation:', error);
      return res.status(500).json({ error: 'Failed to delete annotation' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
