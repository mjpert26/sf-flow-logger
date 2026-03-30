import { getLogBody, parseFlowLog } from '../../../lib/salesforce';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing log ID' });
  }

  try {
    const body = await getLogBody(id);
    const hasFlowData = body.includes('FLOW_');

    if (!hasFlowData) {
      return res.status(200).json({
        hasFlowData: false,
        interviews: [],
        eventCount: 0,
        rawLineCount: body.split('\n').length,
      });
    }

    const parsed = parseFlowLog(body);

    res.status(200).json({
      hasFlowData: true,
      ...parsed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
