import { toolingQuery } from '../../lib/salesforce';

export default async function handler(req, res) {
  try {
    const data = await toolingQuery(
      "SELECT Id, MasterLabel, Status, ProcessType FROM Flow WHERE Status = 'Active' LIMIT 50"
    );
    res.status(200).json(data.records || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
