import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const STEP_ICONS = { START: '▶', END: '■', DECISION: '◆', ASSIGNMENT: '←', UPDATE: '↻', GET: '⊙', ACTION: '⚡', LOOP: '↺', SUBFLOW: '⊞', SCREEN: '▢', CREATE: '✦', DELETE: '✕', WAIT: '◷', FlowActionCall: '⚡', FlowRecordLookup: '⊙', FlowRecordUpdate: '↻', FlowRecordCreate: '✦', FlowRecordDelete: '✕', FlowDecision: '◆', FlowAssignment: '←', FlowLoop: '↺', FlowSubflow: '⊞', FlowScreen: '▢', FlowStart: '▶', FlowWait: '◷' };
const STEP_COLORS = { START: '#22c55e', END: '#64748b', DECISION: '#f59e0b', ASSIGNMENT: '#8b5cf6', UPDATE: '#3b82f6', GET: '#06b6d4', ACTION: '#ec4899', LOOP: '#f97316', SUBFLOW: '#6366f1', SCREEN: '#14b8a6', CREATE: '#10b981', DELETE: '#ef4444', WAIT: '#64748b', FlowActionCall: '#ec4899', FlowRecordLookup: '#06b6d4', FlowRecordUpdate: '#3b82f6', FlowRecordCreate: '#10b981', FlowRecordDelete: '#ef4444', FlowDecision: '#f59e0b', FlowAssignment: '#8b5cf6', FlowLoop: '#f97316', FlowSubflow: '#6366f1', FlowScreen: '#14b8a6', FlowStart: '#22c55e', FlowWait: '#64748b' };
const STATUS_STYLES = {
  success: { bg: '#071a0e', text: '#4ade80', border: '#166534' },
  Success: { bg: '#071a0e', text: '#4ade80', border: '#166534' },
  error: { bg: '#1f0a0a', text: '#f87171', border: '#7f1d1d' },
  running: { bg: '#0a1a2e', text: '#60a5fa', border: '#1e40af' },
};

const S = {
  mono: { fontFamily: "'JetBrains Mono', monospace" },
};

function getStatusStyle(status) {
  if (!status) return STATUS_STYLES.running;
  if (status === 'Success' || status === 'success') return STATUS_STYLES.success;
  return STATUS_STYLES.error;
}

function fmt(ms) {
  if (!ms && ms !== 0) return '–';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function fmtNanos(nanos) {
  const ms = nanos / 1000000;
  return fmt(Math.round(ms));
}

function fmtTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtSize(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)}MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

export default function Home() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [flowData, setFlowData] = useState(null);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tab, setTab] = useState('monitor');
  const [flows, setFlows] = useState([]);
  const intervalRef = useRef(null);

  // Check connection status
  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, error: 'Failed to connect' }));
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/logs?limit=30');
      const data = await r.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 10000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchLogs]);

  // Fetch flow definitions
  useEffect(() => {
    fetch('/api/flows')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setFlows(data); })
      .catch(() => {});
  }, []);

  // Fetch and parse a log
  async function loadLog(log) {
    setSelectedLog(log);
    setFlowData(null);
    setSelectedInterview(null);
    setSelectedElement(null);
    setLogLoading(true);
    try {
      const r = await fetch(`/api/log/${log.Id}`);
      const data = await r.json();
      setFlowData(data);
      if (data.interviews?.length > 0) {
        setSelectedInterview(data.interviews[0]);
      }
    } catch (err) {
      console.error('Failed to parse log:', err);
    }
    setLogLoading(false);
  }

  const filteredLogs = logs.filter(log => {
    if (filter === 'error' && log.Status === 'Success') return false;
    if (filter === 'flow' && !log.Operation?.includes('Flow')) return false;
    if (search && !log.Operation?.toLowerCase().includes(search.toLowerCase()) &&
        !log.LogUser?.Name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Head>
        <title>SF Flow Logger</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#0a0c10', color: '#e2e8f0', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ background: '#0e1117', borderBottom: '1px solid #1c2030', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>SF</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Flow Execution Logger</div>
              <div style={{ ...S.mono, fontSize: 10.5, color: '#4a5568' }}>Tooling API Live Monitor</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setTab('monitor')} style={{ ...S.mono, background: tab === 'monitor' ? '#1a1f33' : 'transparent', border: `1px solid ${tab === 'monitor' ? '#2d3a5c' : '#1c2030'}`, color: tab === 'monitor' ? '#93c5fd' : '#4a5568', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Monitor</button>
            <button onClick={() => setTab('flows')} style={{ ...S.mono, background: tab === 'flows' ? '#1a1f33' : 'transparent', border: `1px solid ${tab === 'flows' ? '#2d3a5c' : '#1c2030'}`, color: tab === 'flows' ? '#93c5fd' : '#4a5568', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Flows ({flows.length})</button>
            <label style={{ ...S.mono, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: autoRefresh ? '#4ade80' : '#4a5568', cursor: 'pointer', marginLeft: 8 }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <div style={{ ...S.mono, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10, padding: '6px 14px', borderRadius: 7, fontSize: 11, background: status?.connected ? '#071a0e' : '#1f0a0a', border: `1px solid ${status?.connected ? '#166534' : '#7f1d1d'}`, color: status?.connected ? '#4ade80' : '#f87171' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: status?.connected ? '#22c55e' : '#ef4444' }} />
              {status?.connected ? status.user : 'Disconnected'}
            </div>
          </div>
        </header>

        {/* Flows Tab */}
        {tab === 'flows' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Active Flows ({flows.length})</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {flows.map(f => (
                  <div key={f.Id} style={{ padding: '12px 16px', background: '#0e1220', border: '1px solid #1c2538', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{f.MasterLabel}</div>
                      <div style={{ ...S.mono, fontSize: 11, color: '#4a5568', marginTop: 2 }}>{f.ProcessType} · {f.Id}</div>
                    </div>
                    <span style={{ ...S.mono, fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#071a0e', color: '#4ade80', border: '1px solid #166534' }}>Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Monitor Tab */}
        {tab === 'monitor' && (
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* Sidebar: Log List */}
            <div style={{ width: 340, borderRight: '1px solid #1c2030', background: '#0c0f16', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #1c2030' }}>
                <input type="text" placeholder="Search operations or users..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 7, background: '#141825', border: '1px solid #232a3d', color: '#e2e8f0', fontSize: 12.5, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                  {['all', 'error', 'flow'].map(s => (
                    <button key={s} onClick={() => setFilter(s)} style={{
                      flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5,
                      background: filter === s ? '#1a1f33' : 'transparent',
                      border: `1px solid ${filter === s ? '#2d3a5c' : '#1c2030'}`,
                      color: filter === s ? '#93c5fd' : '#4a5568'
                    }}>{s}</button>
                  ))}
                  <button onClick={fetchLogs} style={{ flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: '#0a1a2e', border: '1px solid #1e40af', color: '#60a5fa' }}>
                    {loading ? '...' : 'Refresh'}
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredLogs.map(log => {
                  const sc = getStatusStyle(log.Status);
                  const active = selectedLog?.Id === log.Id;
                  return (
                    <div key={log.Id} onClick={() => loadLog(log)}
                      style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #12151e', background: active ? '#111827' : 'transparent', borderLeft: `3px solid ${active ? '#3b82f6' : 'transparent'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', flex: 1, lineHeight: 1.3 }}>{log.Operation}</span>
                        <span style={{ ...S.mono, fontSize: 9.5, padding: '2px 7px', borderRadius: 8, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>
                          {log.Status === 'Success' ? 'OK' : 'ERR'}
                        </span>
                      </div>
                      <div style={{ ...S.mono, fontSize: 10.5, color: '#4a5568', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{fmtTime(log.StartTime)}</span>
                        <span style={{ color: '#252a3a' }}>·</span>
                        <span>{fmtSize(log.LogLength)}</span>
                        <span style={{ color: '#252a3a' }}>·</span>
                        <span>{log.LogUser?.Name || 'System'}</span>
                        {log.DurationMilliseconds && <>
                          <span style={{ color: '#252a3a' }}>·</span>
                          <span style={{ color: sc.text }}>{fmt(log.DurationMilliseconds)}</span>
                        </>}
                      </div>
                    </div>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#4a5568', fontSize: 13 }}>
                    {loading ? 'Loading...' : 'No logs found'}
                  </div>
                )}
              </div>
            </div>

            {/* Center: Flow Detail */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {!selectedLog && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4158', fontSize: 14 }}>
                  Select a log from the left to inspect flow executions
                </div>
              )}

              {selectedLog && (
                <>
                  {/* Log Header */}
                  <div style={{ padding: '12px 22px', borderBottom: '1px solid #1c2030', background: '#0e1117', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedLog.Operation}</div>
                        <div style={{ ...S.mono, fontSize: 11, color: '#4a5568', marginTop: 2 }}>
                          {selectedLog.Id} · {fmtTime(selectedLog.StartTime)} · {selectedLog.LogUser?.Name}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 20 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ ...S.mono, fontSize: 16, fontWeight: 700 }}>{flowData?.interviews?.length || 0}</div>
                          <div style={{ ...S.mono, fontSize: 9, color: '#4a5568', textTransform: 'uppercase' }}>Interviews</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ ...S.mono, fontSize: 16, fontWeight: 700 }}>{flowData?.eventCount || 0}</div>
                          <div style={{ ...S.mono, fontSize: 9, color: '#4a5568', textTransform: 'uppercase' }}>Events</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ ...S.mono, fontSize: 16, fontWeight: 700 }}>{fmtSize(selectedLog.LogLength)}</div>
                          <div style={{ ...S.mono, fontSize: 9, color: '#4a5568', textTransform: 'uppercase' }}>Log Size</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {logLoading && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                      <div style={{ ...S.mono, fontSize: 13 }}>Parsing flow data...</div>
                    </div>
                  )}

                  {!logLoading && flowData && !flowData.hasFlowData && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: 13, flexDirection: 'column', gap: 8 }}>
                      <div>No FLOW_ events in this log</div>
                      <div style={{ ...S.mono, fontSize: 11 }}>This log contains Apex/DML operations only</div>
                    </div>
                  )}

                  {!logLoading && flowData?.hasFlowData && (
                    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                      {/* Interview List (if multiple) */}
                      {flowData.interviews.length > 1 && (
                        <div style={{ width: 220, borderRight: '1px solid #1c2030', overflowY: 'auto', flexShrink: 0 }}>
                          <div style={{ ...S.mono, padding: '10px 12px', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1c2030' }}>
                            Interviews ({flowData.interviews.length})
                          </div>
                          {flowData.interviews.map((iv, i) => {
                            const sc = getStatusStyle(iv.status);
                            const active = selectedInterview?.guid === iv.guid;
                            return (
                              <div key={iv.guid} onClick={() => { setSelectedInterview(iv); setSelectedElement(null); }}
                                style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #12151e', background: active ? '#111827' : 'transparent', borderLeft: `2px solid ${active ? '#3b82f6' : 'transparent'}` }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', marginBottom: 3 }}>{iv.flowName}</div>
                                <div style={{ ...S.mono, fontSize: 10, color: '#4a5568' }}>
                                  {iv.elements.length} steps · <span style={{ color: sc.text }}>{iv.status}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Step Timeline */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
                        {selectedInterview && (
                          <>
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedInterview.flowName}</div>
                              <div style={{ ...S.mono, fontSize: 11, color: '#4a5568', marginTop: 2 }}>
                                {selectedInterview.guid} · {selectedInterview.elements.length} elements · 
                                <span style={{ color: getStatusStyle(selectedInterview.status).text }}> {selectedInterview.status}</span>
                              </div>
                            </div>

                            {/* Limits bar */}
                            {Object.keys(selectedInterview.limits).length > 0 && (
                              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                {Object.entries(selectedInterview.limits).map(([name, { used, max }]) => {
                                  const pct = (used / max) * 100;
                                  return (
                                    <div key={name} style={{ ...S.mono, fontSize: 10, color: pct > 75 ? '#f87171' : pct > 50 ? '#fbbf24' : '#4a5568' }}>
                                      {name}: {used}/{max}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Error message */}
                            {selectedInterview.status === 'error' && selectedInterview.errorMessage && (
                              <div style={{ ...S.mono, marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#1f0a0a', border: '1px solid #7f1d1d', fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>
                                {selectedInterview.errorMessage}
                              </div>
                            )}

                            {/* Elements */}
                            {selectedInterview.elements.map((el, i) => {
                              const color = STEP_COLORS[el.elementType] || '#64748b';
                              const icon = STEP_ICONS[el.elementType] || '•';
                              const sel = selectedElement === i;
                              const prevNanos = i > 0 ? selectedInterview.elements[i - 1].nanos : el.nanos;
                              const delta = el.nanos - prevNanos;

                              return (
                                <div key={i}>
                                  {i > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 18, height: 24 }}>
                                      <div style={{ width: 2, height: '100%', background: '#1c2030', position: 'relative' }}>
                                        <span style={{ ...S.mono, position: 'absolute', left: 14, top: 4, fontSize: 10, color: '#3a4158', whiteSpace: 'nowrap' }}>+{fmtNanos(delta)}</span>
                                      </div>
                                    </div>
                                  )}
                                  <div onClick={() => setSelectedElement(sel ? null : i)}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: sel ? '#111827' : 'transparent', border: `1px solid ${sel ? '#1e3050' : 'transparent'}` }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${color}12`, border: `2px solid ${el.status === 'error' ? '#ef4444' : color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: el.status === 'error' ? '#ef4444' : color }}>
                                      {icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 600, fontSize: 13 }}>{el.elementName}</span>
                                          <span style={{ ...S.mono, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${color}15`, color: color, fontWeight: 600, letterSpacing: 0.5 }}>{el.elementType.replace('Flow', '')}</span>
                                        </div>
                                        <span style={{ ...S.mono, fontSize: 10.5, color: '#4a5568' }}>{fmtNanos(el.nanos)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Variables section */}
                            {selectedInterview.variables.length > 0 && (
                              <div style={{ marginTop: 20, borderTop: '1px solid #1c2030', paddingTop: 16 }}>
                                <div style={{ ...S.mono, fontSize: 11, color: '#4a5568', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Variable Assignments ({selectedInterview.variables.length})</div>
                                <div style={{ background: '#080b12', borderRadius: 8, border: '1px solid #1c2030', overflow: 'hidden' }}>
                                  {selectedInterview.variables.slice(0, 30).map((v, i) => (
                                    <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid #12151e', display: 'flex', gap: 12, fontSize: 12 }}>
                                      <span style={{ ...S.mono, color: '#60a5fa', minWidth: 160, flexShrink: 0 }}>{v.name}</span>
                                      <span style={{ ...S.mono, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.value}</span>
                                    </div>
                                  ))}
                                  {selectedInterview.variables.length > 30 && (
                                    <div style={{ ...S.mono, padding: '8px 12px', color: '#4a5568', fontSize: 11, textAlign: 'center' }}>
                                      + {selectedInterview.variables.length - 30} more variables
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ ...S.mono, padding: '7px 22px', borderTop: '1px solid #1c2030', background: '#0c0f16', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#3a4158', flexShrink: 0 }}>
          <span>SF Flow Logger v2.0 · Tooling API · {status?.instanceUrl || '...'}</span>
          <span>{autoRefresh ? 'Polling every 10s' : 'Manual refresh'} · {logs.length} logs loaded</span>
        </div>
      </div>
    </>
  );
}
