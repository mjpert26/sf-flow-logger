import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const STEP_ICONS = { FlowActionCall: '⚡', FlowRecordLookup: '⊙', FlowRecordUpdate: '↻', FlowRecordCreate: '✦', FlowRecordDelete: '✕', FlowDecision: '◆', FlowAssignment: '←', FlowLoop: '↺', FlowSubflow: '⊞', FlowScreen: '▢', FlowStart: '▶', FlowWait: '◷' };
const STEP_COLORS = { FlowActionCall: '#ec4899', FlowRecordLookup: '#06b6d4', FlowRecordUpdate: '#3b82f6', FlowRecordCreate: '#10b981', FlowRecordDelete: '#ef4444', FlowDecision: '#f59e0b', FlowAssignment: '#8b5cf6', FlowLoop: '#f97316', FlowSubflow: '#6366f1', FlowScreen: '#14b8a6', FlowStart: '#22c55e', FlowWait: '#64748b' };
const FRIENDLY_TYPES = { FlowActionCall: 'Action', FlowRecordLookup: 'Get Records', FlowRecordUpdate: 'Update Records', FlowRecordCreate: 'Create Records', FlowRecordDelete: 'Delete Records', FlowDecision: 'Decision', FlowAssignment: 'Assignment', FlowLoop: 'Loop', FlowSubflow: 'Subflow', FlowScreen: 'Screen', FlowStart: 'Start', FlowWait: 'Wait' };

const STATUS = {
  success: { bg: '#071a0e', text: '#4ade80', border: '#166534' },
  error: { bg: '#1f0a0a', text: '#f87171', border: '#7f1d1d' },
  running: { bg: '#0a1a2e', text: '#60a5fa', border: '#1e40af' },
};

const M = { fontFamily: "'JetBrains Mono', monospace" };

function getS(status) {
  if (status === 'success') return STATUS.success;
  if (status === 'error') return STATUS.error;
  return STATUS.running;
}

function fmt(ms) {
  if (!ms && ms !== 0) return '-';
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(2) + 's';
}

function fmtNanos(nanos) { return fmt(Math.round(nanos / 1000000)); }

function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtSize(bytes) {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + 'MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

export default function Home() {
  const [conn, setConn] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanCount, setScanCount] = useState(10);
  const [scanInfo, setScanInfo] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setConn).catch(() => setConn({ connected: false }));
  }, []);

  const fetchFlows = useCallback(async () => {
    setScanning(true);
    try {
      const r = await fetch('/api/flow-executions?limit=50&scan=' + scanCount);
      const data = await r.json();
      if (data.flowExecutions) {
        setExecutions(data.flowExecutions);
        setScanInfo({ scanned: data.scanned, total: data.totalLogs });
      }
    } catch (err) { console.error(err); }
    setScanning(false);
    setLoading(false);
  }, [scanCount]);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  useEffect(() => {
    if (autoRefresh) { intervalRef.current = setInterval(fetchFlows, 15000); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchFlows]);

  const filtered = executions.filter(e => {
    if (filter === 'error' && e.status !== 'error') return false;
    if (filter === 'success' && e.status !== 'success') return false;
    if (search && !e.flowName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const errorCount = executions.filter(e => e.status === 'error').length;
  const successCount = executions.filter(e => e.status === 'success').length;

  return (
    <>
      <Head>
        <title>SF Flow Logger</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#0a0c10', color: '#e2e8f0', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <header style={{ background: '#0e1117', borderBottom: '1px solid #1c2030', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>SF</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Flow Execution Logger</div>
              <div style={{ ...M, fontSize: 10.5, color: '#4a5568' }}>{scanInfo ? 'Scanned ' + scanInfo.scanned + ' of ' + scanInfo.total + ' logs' : 'Connecting...'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={scanCount} onChange={e => setScanCount(parseInt(e.target.value))} style={{ ...M, background: '#141825', border: '1px solid #232a3d', color: '#e2e8f0', padding: '5px 8px', borderRadius: 6, fontSize: 11 }}>
              <option value={5}>Scan 5</option>
              <option value={10}>Scan 10</option>
              <option value={20}>Scan 20</option>
              <option value={30}>Scan 30</option>
            </select>
            <label style={{ ...M, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: autoRefresh ? '#4ade80' : '#4a5568', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto
            </label>
            <div style={{ ...M, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 11, background: conn?.connected ? '#071a0e' : '#1f0a0a', border: '1px solid ' + (conn?.connected ? '#166534' : '#7f1d1d'), color: conn?.connected ? '#4ade80' : '#f87171' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: conn?.connected ? '#22c55e' : '#ef4444' }} />
              {conn?.connected ? conn.user : 'Disconnected'}
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 360, borderRight: '1px solid #1c2030', background: '#0c0f16', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1c2030' }}>
              <input type="text" placeholder="Search flow names..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, background: '#141825', border: '1px solid #232a3d', color: '#e2e8f0', fontSize: 12.5, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                {[
                  { key: 'all', label: 'All (' + executions.length + ')' },
                  { key: 'error', label: 'Errors (' + errorCount + ')' },
                  { key: 'success', label: 'OK (' + successCount + ')' },
                ].map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)} style={{
                    flex: 1, padding: '5px 0', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                    background: filter === f.key ? (f.key === 'error' ? '#1f0a0a' : f.key === 'success' ? '#071a0e' : '#1a1f33') : 'transparent',
                    border: '1px solid ' + (filter === f.key ? (f.key === 'error' ? '#7f1d1d' : f.key === 'success' ? '#166534' : '#2d3a5c') : '#1c2030'),
                    color: filter === f.key ? (f.key === 'error' ? '#f87171' : f.key === 'success' ? '#4ade80' : '#93c5fd') : '#4a5568'
                  }}>{f.label}</button>
                ))}
                <button onClick={fetchFlows} disabled={scanning} style={{ padding: '5px 12px', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: '#0a1a2e', border: '1px solid #1e40af', color: '#60a5fa', opacity: scanning ? 0.5 : 1 }}>{scanning ? '...' : '↻'}</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && <div style={{ padding: 24, textAlign: 'center', color: '#60a5fa', fontSize: 13 }}>Scanning logs for flow executions...</div>}
              {!loading && filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#4a5568', fontSize: 13 }}>No flow executions found. Try increasing scan count.</div>}
              {filtered.map((exec, i) => {
                const sc = getS(exec.status);
                const active = selected?.guid === exec.guid;
                return (
                  <div key={exec.guid + i} onClick={() => setSelected(exec)} style={{ padding: '13px 14px', cursor: 'pointer', borderBottom: '1px solid #12151e', background: active ? '#111827' : 'transparent', borderLeft: '3px solid ' + (active ? '#3b82f6' : 'transparent') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: '#f1f5f9', lineHeight: 1.3, flex: 1 }}>{exec.flowName}</span>
                      <span style={{ ...M, fontSize: 9.5, padding: '2px 7px', borderRadius: 8, background: sc.bg, color: sc.text, border: '1px solid ' + sc.border, fontWeight: 600, flexShrink: 0, marginLeft: 8, textTransform: 'uppercase' }}>{exec.status}</span>
                    </div>
                    <div style={{ ...M, fontSize: 10.5, color: '#4a5568', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{fmtTime(exec.startTime)}</span>
                      <span style={{ color: '#252a3a' }}>·</span>
                      <span>{exec.elementCount} steps</span>
                      <span style={{ color: '#252a3a' }}>·</span>
                      <span>{exec.user}</span>
                    </div>
                    {exec.status === 'error' && exec.errorMessage && (
                      <div style={{ ...M, fontSize: 10, color: '#fca5a5', marginTop: 5, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exec.errorMessage.substring(0, 120)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!selected && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#3a4158' }}>
                <div style={{ fontSize: 32, opacity: 0.3 }}>⚡</div>
                <div style={{ fontSize: 14 }}>Select a flow execution to inspect</div>
              </div>
            )}

            {selected && (
              <>
                <div style={{ padding: '14px 24px', borderBottom: '1px solid #1c2030', background: '#0e1117', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.flowName}</div>
                      <div style={{ ...M, fontSize: 11, color: '#4a5568', marginTop: 3 }}>{selected.guid} · {fmtTime(selected.startTime)} · {selected.user}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}>
                      {[
                        { label: 'Elements', val: selected.elementCount },
                        { label: 'Variables', val: selected.variableCount },
                        { label: 'Status', val: selected.status, color: getS(selected.status).text },
                        { label: 'Log Size', val: fmtSize(selected.logSize) },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ ...M, fontSize: 16, fontWeight: 700, color: s.color || '#f1f5f9' }}>{s.val}</div>
                          <div style={{ ...M, fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selected.status === 'error' && selected.errorMessage && (
                  <div style={{ ...M, padding: '12px 24px', background: '#1f0a0a', borderBottom: '1px solid #7f1d1d', fontSize: 12, color: '#fca5a5', lineHeight: 1.6, flexShrink: 0 }}>{selected.errorMessage}</div>
                )}

                {selected.limits && Object.keys(selected.limits).length > 0 && (
                  <div style={{ padding: '10px 24px', borderBottom: '1px solid #1c2030', flexShrink: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {Object.entries(selected.limits).map(([name, { used, max }]) => {
                      const pct = max > 0 ? (used / max) * 100 : 0;
                      return (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...M, fontSize: 10, color: '#4a5568' }}>{name}:</span>
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: '#141825', overflow: 'hidden' }}>
                            <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: pct > 75 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e' }} />
                          </div>
                          <span style={{ ...M, fontSize: 10, color: pct > 75 ? '#f87171' : '#4a5568' }}>{used}/{max}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                    <div style={{ ...M, fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Execution Steps ({selected.elementCount})</div>
                    {selected.elements?.map((el, i) => {
                      const color = STEP_COLORS[el.elementType] || '#64748b';
                      const icon = STEP_ICONS[el.elementType] || '•';
                      const friendly = FRIENDLY_TYPES[el.elementType] || el.elementType;
                      const prevNanos = i > 0 ? selected.elements[i - 1].nanos : el.nanos;
                      const delta = el.nanos - prevNanos;
                      return (
                        <div key={i}>
                          {i > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 18, height: 22 }}>
                              <div style={{ width: 2, height: '100%', background: el.status === 'error' ? '#7f1d1d' : '#1c2030', position: 'relative' }}>
                                <span style={{ ...M, position: 'absolute', left: 14, top: 3, fontSize: 10, color: '#3a4158', whiteSpace: 'nowrap' }}>+{fmtNanos(delta)}</span>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: color + '12', border: '2px solid ' + (el.status === 'error' ? '#ef4444' : color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: el.status === 'error' ? '#ef4444' : color }}>{icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{el.elementName}</span>
                                <span style={{ ...M, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: color + '15', color: color, fontWeight: 600 }}>{friendly}</span>
                              </div>
                            </div>
                            <span style={{ ...M, fontSize: 10.5, color: '#4a5568' }}>{fmtNanos(el.nanos)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selected.variables?.length > 0 && (
                    <div style={{ width: 380, borderLeft: '1px solid #1c2030', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                      <div style={{ ...M, padding: '12px 16px', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1c2030', flexShrink: 0 }}>Variables ({selected.variables.length})</div>
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        {selected.variables.map((v, i) => (
                          <div key={i} style={{ padding: '7px 16px', borderBottom: '1px solid #12151e', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ ...M, fontSize: 11, color: '#60a5fa', fontWeight: 500 }}>{v.name}</span>
                            <span style={{ ...M, fontSize: 10.5, color: '#7a8599', wordBreak: 'break-all', lineHeight: 1.4 }}>{v.value || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ ...M, padding: '7px 22px', borderTop: '1px solid #1c2030', background: '#0c0f16', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#3a4158', flexShrink: 0 }}>
          <span>SF Flow Logger v2.1 · Live Tooling API · {conn?.instanceUrl || '...'}</span>
          <span>{autoRefresh ? 'Polling every 15s' : 'Manual refresh'} · {executions.length} flow executions</span>
        </div>
      </div>
    </>
  );
}
