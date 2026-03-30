import { toolingQuery, getLogBody, parseFlowLog } from '../../lib/salesforce';

export const config = {
  maxDuration: 60, // allow longer execution for scanning
};

export default async function handler(req, res) {
  try {
    const { limit = 20, scan = 5 } = req.query;
    const scanCount = Math.min(parseInt(scan), 30);

    // Get recent logs, prioritize larger ones (more likely to have flow data)
    const data = await toolingQuery(
      `SELECT Id, LogLength, LogUser.Name, Operation, Request, StartTime, Status, DurationMilliseconds 
       FROM ApexLog 
       ORDER BY StartTime DESC 
       LIMIT ${Math.min(parseInt(limit), 50)}`
    );

    const logs = data.records || [];

    // Scan top N logs for flow data in parallel
    const toScan = logs.slice(0, scanCount);
    const scanResults = await Promise.allSettled(
      toScan.map(async (log) => {
        try {
          const body = await getLogBody(log.Id);
          if (!body.includes('FLOW_START_INTERVIEW_BEGIN')) {
            return { logId: log.Id, hasFlow: false };
          }

          const parsed = parseFlowLog(body);
          return {
            logId: log.Id,
            hasFlow: true,
            interviews: parsed.interviews.map(iv => ({
              guid: iv.guid,
              flowName: iv.flowName,
              status: iv.status,
              errorMessage: iv.errorMessage || null,
              elementCount: iv.elements.length,
              variableCount: iv.variables.length,
              limits: iv.limits,
              elements: iv.elements,
              variables: iv.variables.slice(0, 50), // limit variable count
            })),
          };
        } catch (err) {
          return { logId: log.Id, hasFlow: false, error: err.message };
        }
      })
    );

    // Build flow execution list
    const flowExecutions = [];

    for (let i = 0; i < toScan.length; i++) {
      const log = toScan[i];
      const result = scanResults[i];

      if (result.status === 'fulfilled' && result.value.hasFlow) {
        for (const interview of result.value.interviews) {
          flowExecutions.push({
            logId: log.Id,
            logSize: log.LogLength,
            operation: log.Operation,
            startTime: log.StartTime,
            logStatus: log.Status,
            user: log.LogUser?.Name || 'System',
            duration: log.DurationMilliseconds,
            // Flow-specific data
            guid: interview.guid,
            flowName: interview.flowName,
            status: interview.status,
            errorMessage: interview.errorMessage,
            elementCount: interview.elementCount,
            variableCount: interview.variableCount,
            limits: interview.limits,
            elements: interview.elements,
            variables: interview.variables,
          });
        }
      }
    }

    // Deduplicate by guid
    const seen = new Set();
    const unique = flowExecutions.filter(f => {
      if (seen.has(f.guid)) return false;
      seen.add(f.guid);
      return true;
    });

    res.status(200).json({
      scanned: scanCount,
      totalLogs: logs.length,
      flowExecutions: unique,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
