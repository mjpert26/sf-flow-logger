// lib/salesforce.js — Handles auth + Tooling API queries

let cachedToken = null;
let tokenExpiry = 0;

export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SF_REFRESH_TOKEN,
      client_id: process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // refresh every 55 min
  return cachedToken;
}

export async function toolingQuery(soql) {
  const token = await getAccessToken();
  const url = `${process.env.SF_INSTANCE_URL}/services/data/v61.0/tooling/query/?q=${encodeURIComponent(soql)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tooling query failed: ${err}`);
  }

  return res.json();
}

export async function standardQuery(soql) {
  const token = await getAccessToken();
  const url = `${process.env.SF_INSTANCE_URL}/services/data/v61.0/query/?q=${encodeURIComponent(soql)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Query failed: ${err}`);
  }

  return res.json();
}

export async function getLogBody(logId) {
  const token = await getAccessToken();
  const url = `${process.env.SF_INSTANCE_URL}/services/data/v61.0/tooling/sobjects/ApexLog/${logId}/Body/`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Log body fetch failed: ${err}`);
  }

  return res.text();
}

// Parse debug log body to extract flow execution data
export function parseFlowLog(logBody) {
  const lines = logBody.split('\n');
  const interviews = {};
  const events = [];

  for (const line of lines) {
    // Extract timestamp
    const tsMatch = line.match(/^([\d:.]+)\s*\((\d+)\)\|/);
    const timestamp = tsMatch ? tsMatch[1] : null;
    const nanos = tsMatch ? parseInt(tsMatch[2]) : 0;

    // FLOW_START_INTERVIEW_BEGIN
    if (line.includes('FLOW_START_INTERVIEW_BEGIN|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      const flowName = parts[2] || 'Unknown Flow';
      interviews[guid] = {
        guid,
        flowName,
        startTime: timestamp,
        startNanos: nanos,
        endTime: null,
        endNanos: 0,
        status: 'running',
        elements: [],
        limits: {},
        variables: [],
      };
      events.push({ type: 'INTERVIEW_START', guid, flowName, timestamp, nanos });
    }

    // FLOW_START_INTERVIEW_END
    if (line.includes('FLOW_START_INTERVIEW_END|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      if (interviews[guid]) {
        interviews[guid].endTime = timestamp;
        interviews[guid].endNanos = nanos;
        if (interviews[guid].status === 'running') {
          interviews[guid].status = 'success';
        }
      }
      events.push({ type: 'INTERVIEW_END', guid, timestamp, nanos });
    }

    // FLOW_ELEMENT_BEGIN
    if (line.includes('FLOW_ELEMENT_BEGIN|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      const elementType = parts[2] || '';
      const elementName = parts[3] || '';
      const element = {
        type: 'ELEMENT_BEGIN',
        guid,
        elementType,
        elementName,
        timestamp,
        nanos,
        status: 'success',
      };
      if (interviews[guid]) {
        interviews[guid].elements.push(element);
      }
      events.push(element);
    }

    // FLOW_ELEMENT_END
    if (line.includes('FLOW_ELEMENT_END|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      const elementType = parts[2] || '';
      const elementName = parts[3] || '';
      events.push({ type: 'ELEMENT_END', guid, elementType, elementName, timestamp, nanos });
    }

    // FLOW_ELEMENT_ERROR
    if (line.includes('FLOW_ELEMENT_ERROR|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      const message = parts.slice(2).join('|');
      if (interviews[guid]) {
        interviews[guid].status = 'error';
        interviews[guid].errorMessage = message;
      }
      events.push({ type: 'ELEMENT_ERROR', guid, message, timestamp, nanos });
    }

    // FLOW_ELEMENT_FAULT
    if (line.includes('FLOW_ELEMENT_FAULT|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      const message = parts.slice(2).join('|');
      if (interviews[guid]) {
        interviews[guid].status = 'error';
        interviews[guid].errorMessage = message;
      }
      events.push({ type: 'ELEMENT_FAULT', guid, message, timestamp, nanos });
    }

    // FLOW_VALUE_ASSIGNMENT
    if (line.includes('FLOW_VALUE_ASSIGNMENT|')) {
      const parts = line.split('|');
      const guid = parts[1] || '';
      const varName = parts[2] || '';
      const varValue = parts.slice(3).join('|').substring(0, 200); // truncate long values
      if (interviews[guid]) {
        interviews[guid].variables.push({ name: varName, value: varValue });
      }
    }

    // FLOW_START_INTERVIEW_LIMIT_USAGE
    if (line.includes('FLOW_START_INTERVIEW_LIMIT_USAGE|')) {
      const parts = line.split('|');
      const limitInfo = parts[parts.length - 1] || '';
      const limitMatch = limitInfo.match(/^(.+?):\s*(\d+)\s*out of\s*(\d+)/);
      if (limitMatch) {
        // Find the most recent interview
        const guids = Object.keys(interviews);
        const lastGuid = guids[guids.length - 1];
        if (lastGuid && interviews[lastGuid]) {
          interviews[lastGuid].limits[limitMatch[1].trim()] = {
            used: parseInt(limitMatch[2]),
            max: parseInt(limitMatch[3]),
          };
        }
      }
    }
  }

  return {
    interviews: Object.values(interviews),
    eventCount: events.length,
  };
}

// Map element types to friendly names
export function friendlyElementType(type) {
  const map = {
    FlowActionCall: 'ACTION',
    FlowRecordLookup: 'GET',
    FlowRecordUpdate: 'UPDATE',
    FlowRecordCreate: 'CREATE',
    FlowRecordDelete: 'DELETE',
    FlowDecision: 'DECISION',
    FlowAssignment: 'ASSIGNMENT',
    FlowLoop: 'LOOP',
    FlowSubflow: 'SUBFLOW',
    FlowScreen: 'SCREEN',
    FlowStart: 'START',
    FlowWait: 'WAIT',
  };
  return map[type] || type;
}
