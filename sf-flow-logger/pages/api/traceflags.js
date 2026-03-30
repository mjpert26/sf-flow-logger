import { toolingQuery, getAccessToken } from '../../lib/salesforce';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const data = await toolingQuery(
        "SELECT Id, TracedEntity.Name, LogType, StartDate, ExpirationDate, DebugLevel.MasterLabel FROM TraceFlag WHERE ExpirationDate > TODAY ORDER BY StartDate DESC LIMIT 20"
      );
      res.status(200).json(data.records || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const token = await getAccessToken();
      const { tracedEntityId, debugLevelId, hours = 24 } = req.body;

      const now = new Date();
      const expiry = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const sfRes = await fetch(
        `${process.env.SF_INSTANCE_URL}/services/data/v61.0/tooling/sobjects/TraceFlag/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            TracedEntityId: tracedEntityId,
            DebugLevelId: debugLevelId,
            LogType: 'USER_DEBUG',
            StartDate: now.toISOString(),
            ExpirationDate: expiry.toISOString(),
          }),
        }
      );

      const data = await sfRes.json();
      if (!sfRes.ok) {
        return res.status(400).json(data);
      }
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
