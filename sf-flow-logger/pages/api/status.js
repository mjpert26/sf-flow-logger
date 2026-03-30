import { getAccessToken, toolingQuery } from '../../lib/salesforce';

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();

    // Get org info
    const userRes = await fetch(
      `${process.env.SF_INSTANCE_URL}/services/data/v61.0/chatter/users/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const user = await userRes.json();

    // Get log count
    const logData = await toolingQuery('SELECT COUNT() FROM ApexLog');

    // Get active trace flags
    const tfData = await toolingQuery(
      'SELECT COUNT() FROM TraceFlag WHERE ExpirationDate > TODAY'
    );

    res.status(200).json({
      connected: true,
      instanceUrl: process.env.SF_INSTANCE_URL,
      user: user.displayName,
      email: user.email,
      logCount: logData.totalSize || 0,
      activeTraceFlags: tfData.totalSize || 0,
    });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
}
