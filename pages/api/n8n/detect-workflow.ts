import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Auto-detect n8n workflow context from API credentials
 *
 * This endpoint takes n8n API URL and API key, and automatically detects:
 * - Current workflow ID (if available from execution context)
 * - Workflow name
 * - Execution ID (if in execution context)
 *
 * Usage: PowerNode will call this when n8n credentials are provided
 * to automatically populate workflow information without user selection
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { n8nApiUrl, n8nApiKey } = req.body;

    if (!n8nApiUrl || !n8nApiKey) {
      return res.status(400).json({
        error: 'Missing required parameters: n8nApiUrl and n8nApiKey'
      });
    }

    // Try to get current execution context first (if called from within a workflow)
    let workflowId: string | undefined;
    let workflowName: string | undefined;
    let executionId: string | undefined;

    // Attempt 1: Try to get execution from headers (if PowerNode is called from n8n webhook/node)
    const n8nExecutionId = req.headers['x-n8n-execution-id'] as string | undefined;
    const n8nWorkflowId = req.headers['x-n8n-workflow-id'] as string | undefined;

    if (n8nWorkflowId) {
      workflowId = n8nWorkflowId;
      executionId = n8nExecutionId;

      // Get workflow details
      try {
        const workflowResponse = await fetch(`${n8nApiUrl}/workflows/${workflowId}`, {
          headers: {
            'X-N8N-API-KEY': n8nApiKey,
          },
        });

        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json();
          workflowName = workflowData.name;
        }
      } catch (error) {
        console.error('Failed to fetch workflow details:', error);
      }
    }

    // Attempt 2: If no context headers, try to get from recent executions
    if (!workflowId) {
      try {
        const executionsResponse = await fetch(`${n8nApiUrl}/executions?limit=1`, {
          headers: {
            'X-N8N-API-KEY': n8nApiKey,
          },
        });

        if (executionsResponse.ok) {
          const executionsData = await executionsResponse.json();
          if (executionsData.data && executionsData.data.length > 0) {
            const latestExecution = executionsData.data[0];
            workflowId = latestExecution.workflowId;
            workflowName = latestExecution.workflowData?.name;
            executionId = latestExecution.id;
          }
        }
      } catch (error) {
        console.error('Failed to fetch executions:', error);
      }
    }

    // Attempt 3: If still no workflow, get list of workflows and use the first active one
    if (!workflowId) {
      try {
        const workflowsResponse = await fetch(`${n8nApiUrl}/workflows?active=true&limit=10`, {
          headers: {
            'X-N8N-API-KEY': n8nApiKey,
          },
        });

        if (workflowsResponse.ok) {
          const workflowsData = await workflowsResponse.json();
          if (workflowsData.data && workflowsData.data.length > 0) {
            // Return list of workflows for user to select
            const workflows = workflowsData.data.map((wf: any) => ({
              id: wf.id,
              name: wf.name,
              active: wf.active,
            }));

            return res.status(200).json({
              success: true,
              detected: false,
              workflows,
              message: 'No active execution context. Please select a workflow.',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
      }
    }

    // Return detected workflow info
    if (workflowId) {
      return res.status(200).json({
        success: true,
        detected: true,
        workflowId,
        workflowName,
        executionId,
      });
    }

    // No workflow could be detected
    return res.status(200).json({
      success: false,
      detected: false,
      message: 'Could not auto-detect workflow. Please verify n8n API credentials.',
    });

  } catch (error: any) {
    console.error('Error detecting n8n workflow:', error);
    return res.status(500).json({
      error: error.message || 'Failed to detect workflow'
    });
  }
}
