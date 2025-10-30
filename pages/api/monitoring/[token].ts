import type { NextApiRequest, NextApiResponse } from 'next';

// This is a MOCK implementation for testing
// In production, this would query Azure Table Storage

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid token' });
  }

  // Validate token format
  if (!token.match(/^pn_exec_[a-zA-Z0-9_]+$/)) {
    return res.status(400).json({ error: 'Invalid token format' });
  }

  // TODO: In production, query Azure Table Storage
  // const tableClient = TableClient.fromConnectionString(
  //   process.env.POWERNODE_STORAGE_CONNECTION!,
  //   'powernodeexecutions'
  // );
  // const entity = await tableClient.getEntity(partitionKey, token);

  // MOCK DATA FOR TESTING
  const mockExecutionData = generateMockExecutionData(token);

  if (!mockExecutionData) {
    return res.status(404).json({ error: 'Execution not found or expired' });
  }

  return res.status(200).json(mockExecutionData);
}

function generateMockExecutionData(token: string) {
  const wippli_id = 337;
  const creator_id = 'prologistik_admin';

  const startTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
  const endTime = new Date();

  return {
    execution: {
      execution_id: 'exec_abc123',
      wippli_id,
      creator_id,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      status: 'completed',
      duration_ms: 154000, // 2m 34s
    },
    logs: [
      {
        timestamp: new Date(startTime.getTime() + 0).toISOString(),
        tool: 'download_wippli_file',
        input: {
          wippli_id,
          file_url: 'https://wippli-files.blob.core.windows.net/tasks/337/template.docx',
        },
        output: {
          success: true,
          blob_path: '337/template.docx',
          size_mb: 2.1,
        },
        duration_ms: 1200,
        status: 'success',
        cost: 0.0001,
      },
      {
        timestamp: new Date(startTime.getTime() + 2000).toISOString(),
        tool: 'query_vector_database',
        input: {
          queries: ['data encryption policy', 'backup procedures', 'ISO 27001 compliance'],
          top_k: 5,
        },
        output: {
          success: true,
          results: [
            {
              query: 'data encryption policy',
              content:
                'proLogistik uses AES-256 encryption for data at rest and TLS 1.3 for data in transit. All cryptographic keys are managed via Azure Key Vault with automatic rotation every 90 days.',
              score: 0.89,
              source: 'policies/information-security-policy-2024.pdf',
            },
            {
              query: 'backup procedures',
              content:
                'Automated daily backups to geo-redundant Azure Storage (Australia East + Southeast). RTO: 4 hours, RPO: 24 hours. Disaster recovery drills conducted quarterly.',
              score: 0.85,
              source: 'procedures/backup-dr-procedures-v2.docx',
            },
            {
              query: 'ISO 27001 compliance',
              content:
                'proLogistik is ISO 27001:2013 certified. Annual surveillance audits conducted by BSI. Certificate valid until December 2025.',
              score: 0.92,
              source: 'compliance/iso-27001-certificate.pdf',
            },
          ],
        },
        duration_ms: 3400,
        status: 'success',
        cost: 0.001,
      },
      {
        timestamp: new Date(startTime.getTime() + 25000).toISOString(),
        tool: 'populate_document_template',
        input: {
          wippli_id,
          template_path: '337/template.docx',
          ai_model: 'claude-sonnet-3.5',
          use_rag: true,
        },
        output: {
          success: true,
          output_path: '337/questionnaire_draft_v1.docx',
          questions_answered: 30,
          ai_model: 'claude-sonnet-3.5',
          tokens: {
            input: 21000,
            output: 8000,
          },
        },
        duration_ms: 24800,
        status: 'success',
        cost: 0.183,
      },
      {
        timestamp: new Date(startTime.getTime() + 120000).toISOString(),
        tool: 'convert_to_pdf_and_upload_proof',
        input: {
          wippli_id,
          document_path: '337/questionnaire_draft_v1.docx',
          version: 1,
        },
        output: {
          success: true,
          pdf_path: '337/questionnaire_draft_v1.pdf',
          wippli_proof_id: 42,
          wippli_proof_url: 'https://wippli.com/proofs/42',
          version: 1,
        },
        duration_ms: 2100,
        status: 'success',
        cost: 0.0002,
      },
      {
        timestamp: new Date(startTime.getTime() + 148000).toISOString(),
        tool: 'post_wippli_comment',
        input: {
          wippli_id,
          text: '✅ Security questionnaire draft v1 completed. Ready for review in Proofs.',
        },
        output: {
          success: true,
          comment_id: 123,
        },
        duration_ms: 300,
        status: 'success',
        cost: 0.0001,
      },
    ],
    storage: {
      blobs: [
        {
          name: '337/template.docx',
          size: 2097152, // 2 MB
          created: new Date(startTime.getTime() + 1200).toISOString(),
        },
        {
          name: '337/questionnaire_draft_v1.docx',
          size: 4194304, // 4 MB
          created: new Date(startTime.getTime() + 49800).toISOString(),
        },
        {
          name: '337/questionnaire_draft_v1.pdf',
          size: 3670016, // 3.5 MB
          created: new Date(startTime.getTime() + 122100).toISOString(),
        },
      ],
      total_size: 9961472, // ~9.5 MB
    },
    config: {
      api_key: 'pk_creator_prologistik_***', // masked
      storage_account: 'powernode-creator-prologistik',
      vector_index: 'wippli-index-creator-prologistik',
      ai_models: ['claude-sonnet-3.5', 'claude-haiku-3.5'],
      rate_limit: {
        current: 950,
        max: 1000,
        resets_in_minutes: 42,
      },
      mcp_tools_enabled: [
        'download_wippli_file',
        'query_vector_database',
        'populate_document_template',
        'convert_to_pdf_and_upload_proof',
        'get_wippli_comments',
        'apply_feedback_and_regenerate',
        'move_to_finals',
        'post_wippli_comment',
        'get_wippli_task',
        'list_task_files',
      ],
    },
    wippli_integration: {
      task_url: `https://dev.wippli.com/client/dashboard/wipplis/${wippli_id}`,
      proof_url: 'https://wippli.com/proofs/42',
      comment_posted: true,
      finals_uploaded: false,
    },
  };
}
