import { toolingQuery } from '../../lib/salesforce';

export default async function handler(req, res) {
  try {
    const { limit = 20, status, since } = req.query;

    let where = '';
    const conditions = [];

    if (since) {
      conditions.push(`StartTime > ${since}`);
    }
    if (status === 'error') {
      conditions.push("Status != 'Success'");
    }

    if (conditions.length > 0) {
      where = 'WHERE ' + conditions.join(' AND ');
    }

    const data = await toolingQuery(
      `SELECT Id, LogLength, LogUser.Name, Operation, Request, StartTime, Status, DurationMilliseconds 
       FROM ApexLog ${where}
       ORDER BY StartTime DESC 
       LIMIT ${Math.min(parseInt(limit), 100)}`
    );

    res.status(200).json(data.records || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
