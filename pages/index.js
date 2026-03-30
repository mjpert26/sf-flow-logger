import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const ICONS = { FlowActionCall: '⚡', FlowRecordLookup: '⊙', FlowRecordUpdate: '↻', FlowRecordCreate: '✦', FlowRecordDelete: '✕', FlowDecision: '◆', FlowAssignment: '←', FlowLoop: '↺', FlowSubflow: '⊞', FlowScreen: '▢', FlowStart: '▶', FlowWait: '◷' };
const COLORS = { FlowActionCall: '#ec4899', FlowRecordLookup: '#06b6d4', FlowRecordUpdate: '#3b82f6', FlowRecordCreate: '#10b981', FlowRecordDelete: '#ef4444', FlowDecision: '#f59e0b', FlowAssignment: '#8b5cf6', FlowLoop: '#f97316', FlowSubflow: '#6366f1', FlowScreen: '#14b8a6', FlowStart: '#22c55e', FlowWait: '#64748b' };
const LABELS = { FlowActionCall: 'Action', FlowRecordLookup: 'Get Records', FlowRecordUpdate: 'Update Records', FlowRecordCreate: 'Create Records', FlowRecordDelete: 'Delete Records', FlowDecision: 'Decision', FlowAssignment: 'Assignment', FlowLoop: 'Loop', FlowSubflow: 'Subflow', FlowScreen: 'Screen', FlowStart: 'Start', FlowWait: 'Wait' };

const SC = {
  success: { bg: '#071a0e', text: '#4ade80', border: '#166534', label: 'SUCCESS' },
  error: { bg: '#1f0a0a', text: '#f87171', border: '#7f1d1d', label: 'ERROR' },
  running: { bg: '#0a1a2e', text: '#60a5fa', border: '#1e40af', label: 'RUNNING' },
};

function getS(s) { return SC[s] || SC.running; }
function fmt(ms) { if (!ms && ms !== 0) return '-'; return ms < 1000 ? ms + 'ms' : (ms/1000).toFixed(2) + 's'; }
function fmtN(n) { return fmt(Math.round(n / 1000000)); }
function fmtT(iso) { if (!iso) return '-'; return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function fmtSz(b) { if (b > 1048576) return (b/1048576).toFixed(1)+'MB'; if (b > 1024) return (b/1024).toFixed(1)+'KB'; return b+'B'; }

export default function Home() {
  const [conn, setConn] = useState(null);
  const [execs, setExecs] = useState([]);
  const [sel, setSel] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanCount, setScanCount] = useState(10);
  const [info, setInfo] = useState(null);
  const iRef = useRef(null);

  useEffect(() => { fetch('/api/status').then(r=>r.json()).then(setConn).catch(()=>setConn({connected:false})); }, []);

  const fetchFlows = useCallback(async () => {
    setScanning(true);
    try {
      const r = await fetch('/api/flow-executions?limit=50&scan='+scanCount);
      const d = await r.json();
      if (d.flowExecutions) { setExecs(d.flowExecutions); setInfo({scanned:d.scanned,total:d.totalLogs}); }
    } catch(e) { console.error(e); }
    setScanning(false); setLoading(false);
  }, [scanCount]);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);
  useEffect(() => {
    if (autoRefresh) { iRef.current = setInterval(fetchFlows, 15000); }
    else { clearInterval(iRef.current); }
    return () => clearInterval(iRef.current);
  }, [autoRefresh, fetchFlows]);

  const filtered = execs.filter(e => {
    if (filter === 'error' && e.status !== 'error') return false;
    if (filter === 'success' && e.status !== 'success') return false;
    if (search && !e.flowName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const errCt = execs.filter(e => e.status === 'error').length;
  const okCt = execs.filter(e => e.status === 'success').length;

  // Find variables associated with a specific element by matching guid + proximity
  function getVarsForElement(exec, elIndex) {
    if (!exec.variables || exec.variables.length === 0) return [];
    // Simple approach: distribute variables evenly or show all for single-element flows
    if (exec.elements.length <= 1) return exec.variables;
    // Show variables that were assigned near this element
    const el = exec.elements[elIndex];
    const nextEl = exec.elements[elIndex + 1];
    return exec.variables.filter(v => {
      // Match by element name appearing in variable name
      if (v.name && el.elementName && v.name.toLowerCase().includes(el.elementName.toLowerCase())) return true;
      return false;
    });
  }

  return (
    <>
      <Head>
        <title>SF Flow Logger</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ fontFamily:"'DM Sans',sans-serif", background:'#0b0d11', color:'#cbd5e1', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <header style={{ background:'#10131a', borderBottom:'1px solid #1e2433', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15, color:'#fff', letterSpacing:'-0.5px' }}>SF</div>
            <div>
              <div style={{ fontWeight:700, fontSize:16, color:'#f1f5f9', letterSpacing:'-0.3px' }}>Flow Execution Logger</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#64748b', marginTop:1 }}>{info ? `Scanned ${info.scanned} of ${info.total} logs` : 'Connecting...'}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <select value={scanCount} onChange={e=>setScanCount(parseInt(e.target.value))} style={{ fontFamily:"'JetBrains Mono',monospace", background:'#171c28', border:'1px solid #2a3142', color:'#94a3b8', padding:'6px 10px', borderRadius:7, fontSize:12, cursor:'pointer' }}>
              <option value={5}>Scan 5</option>
              <option value={10}>Scan 10</option>
              <option value={20}>Scan 20</option>
              <option value={30}>Scan 30</option>
            </select>
            <label style={{ fontFamily:"'JetBrains Mono',monospace", display:'flex', alignItems:'center', gap:6, fontSize:12, color:autoRefresh?'#4ade80':'#64748b', cursor:'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} style={{ accentColor:'#22c55e' }} /> Auto
            </label>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:8, fontSize:12, background:conn?.connected?'#071a0e':'#1f0a0a', border:'1px solid '+(conn?.connected?'#166534':'#7f1d1d'), color:conn?.connected?'#4ade80':'#f87171' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:conn?.connected?'#22c55e':'#ef4444', boxShadow:'0 0 8px '+(conn?.connected?'#22c55e55':'#ef444455') }} />
              {conn?.connected ? conn.user : 'Disconnected'}
            </div>
          </div>
        </header>

        <div style={{ display:'flex', flex:1, minHeight:0 }}>

          {/* Sidebar */}
          <div style={{ width:380, borderRight:'1px solid #1e2433', background:'#0d1017', display:'flex', flexDirection:'column', flexShrink:0 }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #1e2433' }}>
              <input type="text" placeholder="Search flow names..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:'100%', padding:'10px 14px', borderRadius:8, background:'#171c28', border:'1px solid #2a3142', color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                {[
                  { key:'all', label:'All ('+execs.length+')', c:'#93c5fd', bg:'#1a1f33', bc:'#2d3a5c' },
                  { key:'error', label:'Errors ('+errCt+')', c:'#f87171', bg:'#1f0a0a', bc:'#7f1d1d' },
                  { key:'success', label:'OK ('+okCt+')', c:'#4ade80', bg:'#071a0e', bc:'#166534' },
                ].map(f => (
                  <button key={f.key} onClick={()=>setFilter(f.key)} style={{
                    flex:1, padding:'7px 0', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:600, transition:'all 0.15s',
                    background: filter===f.key ? f.bg : 'transparent',
                    border: '1px solid '+(filter===f.key ? f.bc : '#1e2433'),
                    color: filter===f.key ? f.c : '#4a5568'
                  }}>{f.label}</button>
                ))}
                <button onClick={fetchFlows} disabled={scanning} style={{ padding:'7px 14px', borderRadius:6, fontSize:14, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:600, background:'#0f1d35', border:'1px solid #1e40af', color:'#60a5fa', opacity:scanning?0.4:1 }}>{scanning?'...':'↻'}</button>
              </div>
            </div>

            <div style={{ flex:1, overflowY:'auto' }}>
              {loading && <div style={{ padding:32, textAlign:'center', color:'#60a5fa', fontSize:14 }}>Scanning logs for flow executions...</div>}
              {!loading && filtered.length === 0 && <div style={{ padding:32, textAlign:'center', color:'#64748b', fontSize:14 }}>No flow executions found</div>}
              {filtered.map((exec, i) => {
                const sc = getS(exec.status);
                const active = sel?.guid === exec.guid;
                return (
                  <div key={exec.guid+i} onClick={()=>{setSel(exec);setExpandedNode(null);}} style={{ padding:'14px 16px', cursor:'pointer', borderBottom:'1px solid #151a24', background:active?'#131a2b':'transparent', borderLeft:'3px solid '+(active?'#3b82f6':'transparent'), transition:'background 0.1s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <span style={{ fontWeight:600, fontSize:14, color:'#f1f5f9', lineHeight:1.4, flex:1 }}>{exec.flowName}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'3px 8px', borderRadius:6, background:sc.bg, color:sc.text, border:'1px solid '+sc.border, fontWeight:600, flexShrink:0, marginLeft:10 }}>{sc.label}</span>
                    </div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#64748b', display:'flex', gap:10 }}>
                      <span>{fmtT(exec.startTime)}</span>
                      <span style={{ color:'#2a3142' }}>·</span>
                      <span>{exec.elementCount} steps</span>
                      <span style={{ color:'#2a3142' }}>·</span>
                      <span>{exec.user}</span>
                    </div>
                    {exec.status === 'error' && exec.errorMessage && (
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#fca5a5', marginTop:7, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{exec.errorMessage}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center: n8n-style node view */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
            {!sel && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'#475569' }}>
                <div style={{ fontSize:40, opacity:0.2 }}>⚡</div>
                <div style={{ fontSize:15 }}>Select a flow execution to inspect</div>
                <div style={{ fontSize:12, color:'#334155' }}>Click any flow on the left to see node-by-node execution</div>
              </div>
            )}

            {sel && (
              <>
                {/* Flow Header */}
                <div style={{ padding:'16px 28px', borderBottom:'1px solid #1e2433', background:'#10131a', flexShrink:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:18, color:'#f1f5f9' }}>{sel.flowName}</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#64748b', marginTop:4 }}>{sel.guid}</div>
                    </div>
                    <div style={{ display:'flex', gap:28 }}>
                      {[
                        { label:'Steps', val:sel.elementCount, color:'#e2e8f0' },
                        { label:'Variables', val:sel.variableCount, color:'#e2e8f0' },
                        { label:'Status', val:sel.status, color:getS(sel.status).text },
                        { label:'Log Size', val:fmtSz(sel.logSize), color:'#e2e8f0' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600, color:s.color }}>{s.val}</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginTop:2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {sel.status === 'error' && sel.errorMessage && (
                  <div style={{ padding:'14px 28px', background:'#1a0808', borderBottom:'1px solid #7f1d1d', flexShrink:0 }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:'#fca5a5', lineHeight:1.7 }}>{sel.errorMessage}</div>
                  </div>
                )}

                {/* Node Timeline + Detail */}
                <div style={{ display:'flex', flex:1, minHeight:0 }}>
                  {/* Nodes */}
                  <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>
                    {/* Governor Limits */}
                    {sel.limits && Object.keys(sel.limits).length > 0 && (
                      <div style={{ marginBottom:20, padding:'14px 18px', background:'#10131a', borderRadius:10, border:'1px solid #1e2433' }}>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:10, fontWeight:600 }}>Governor Limits</div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                          {Object.entries(sel.limits).map(([name, {used, max}]) => {
                            const pct = max > 0 ? (used/max)*100 : 0;
                            const clr = pct > 75 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e';
                            return (
                              <div key={name} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#94a3b8' }}>{name}</span>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:clr, fontWeight:600 }}>{used}/{max}</span>
                                </div>
                                <div style={{ height:4, borderRadius:2, background:'#1e2433', overflow:'hidden' }}>
                                  <div style={{ width:pct+'%', height:'100%', borderRadius:2, background:clr, transition:'width 0.3s' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Step Nodes */}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:14, fontWeight:600 }}>Execution Flow ({sel.elementCount} nodes)</div>

                    {sel.elements?.map((el, i) => {
                      const color = COLORS[el.elementType] || '#64748b';
                      const icon = ICONS[el.elementType] || '•';
                      const label = LABELS[el.elementType] || el.elementType;
                      const prevN = i > 0 ? sel.elements[i-1].nanos : el.nanos;
                      const delta = el.nanos - prevN;
                      const isExpanded = expandedNode === i;
                      const nodeVars = getVarsForElement(sel, i);

                      return (
                        <div key={i}>
                          {/* Connector */}
                          {i > 0 && (
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:36, position:'relative' }}>
                              <div style={{ width:2, height:'100%', background: el.status==='error' ? '#7f1d1d' : '#1e2433' }} />
                              <div style={{ position:'absolute', fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#475569', background:'#0b0d11', padding:'2px 8px', borderRadius:4 }}>+{fmtN(delta)}</div>
                            </div>
                          )}

                          {/* Node Card */}
                          <div onClick={()=>setExpandedNode(isExpanded?null:i)} style={{
                            border:'1px solid '+(el.status==='error' ? '#7f1d1d' : isExpanded ? '#2d4a7c' : '#1e2433'),
                            borderRadius:12, overflow:'hidden', cursor:'pointer',
                            background: isExpanded ? '#111827' : '#10131a',
                            boxShadow: el.status==='error' ? '0 0 20px #ef444415' : isExpanded ? '0 0 20px #3b82f615' : 'none',
                            transition:'all 0.15s'
                          }}>
                            {/* Node Header */}
                            <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                              <div style={{
                                width:42, height:42, borderRadius:11, flexShrink:0,
                                background:color+'18', border:'2px solid '+(el.status==='error'?'#ef4444':color),
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:18, color:el.status==='error'?'#ef4444':color
                              }}>{icon}</div>
                              <div style={{ flex:1 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <span style={{ fontWeight:600, fontSize:15, color:'#f1f5f9' }}>{el.elementName}</span>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'3px 8px', borderRadius:5, background:color+'20', color:color, fontWeight:600 }}>{label}</span>
                                </div>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#64748b', marginTop:3 }}>
                                  Elapsed: {fmtN(el.nanos)} {el.status==='error' && <span style={{ color:'#f87171', marginLeft:8 }}>FAILED</span>}
                                </div>
                              </div>
                              <div style={{ color:'#475569', fontSize:16, transform:isExpanded?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s' }}>▾</div>
                            </div>

                            {/* Expanded: Node Detail */}
                            {isExpanded && (
                              <div style={{ borderTop:'1px solid #1e2433' }}>
                                {/* Node metadata */}
                                <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                                  {[
                                    { label:'Type', val:el.elementType },
                                    { label:'Elapsed', val:fmtN(el.nanos) },
                                    { label:'Delta', val:'+'+fmtN(delta) },
                                  ].map(m => (
                                    <div key={m.label} style={{ padding:'10px 12px', background:'#0b0f18', borderRadius:8, border:'1px solid #1a2030' }}>
                                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{m.label}</div>
                                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{m.val}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Variables for this node */}
                                {nodeVars.length > 0 && (
                                  <div style={{ padding:'0 18px 14px' }}>
                                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Variables</div>
                                    <div style={{ background:'#0b0f18', borderRadius:8, border:'1px solid #1a2030', overflow:'hidden' }}>
                                      {nodeVars.map((v,vi) => (
                                        <div key={vi} style={{ padding:'8px 14px', borderBottom:vi<nodeVars.length-1?'1px solid #151a28':'none', display:'flex', gap:14 }}>
                                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#60a5fa', minWidth:140, flexShrink:0, fontWeight:500 }}>{v.name}</span>
                                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#94a3b8', wordBreak:'break-all', lineHeight:1.5 }}>{v.value || '(empty)'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* End Node */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:36 }}>
                      <div style={{ width:2, height:'100%', background:sel.status==='error'?'#7f1d1d':'#1e2433' }} />
                    </div>
                    <div style={{ border:'1px solid '+(sel.status==='error'?'#7f1d1d':'#1e2433'), borderRadius:12, padding:'14px 18px', background:'#10131a', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:42, height:42, borderRadius:11, background:sel.status==='error'?'#ef444418':'#64748b18', border:'2px solid '+(sel.status==='error'?'#ef4444':'#64748b'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:sel.status==='error'?'#ef4444':'#64748b' }}>■</div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:15, color:sel.status==='error'?'#f87171':'#94a3b8' }}>{sel.status==='error'?'Flow Failed':'Flow Complete'}</div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#64748b', marginTop:2 }}>
                          {sel.elementCount} nodes executed · {sel.variableCount} variables
                        </div>
                      </div>
                    </div>

                    <div style={{ height:40 }} />
                  </div>

                  {/* Right Panel: All Variables */}
                  {sel.variables?.length > 0 && (
                    <div style={{ width:380, borderLeft:'1px solid #1e2433', background:'#0d1017', display:'flex', flexDirection:'column', flexShrink:0 }}>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", padding:'14px 18px', fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, borderBottom:'1px solid #1e2433', flexShrink:0, fontWeight:600 }}>
                        All Variables ({sel.variables.length})
                      </div>
                      <div style={{ flex:1, overflowY:'auto' }}>
                        {sel.variables.map((v, i) => (
                          <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid #151a24' }}>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#60a5fa', fontWeight:500, marginBottom:3 }}>{v.name}</div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#94a3b8', wordBreak:'break-all', lineHeight:1.5 }}>{v.value || '(empty)'}</div>
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

        {/* Footer */}
        <div style={{ fontFamily:"'JetBrains Mono',monospace", padding:'8px 24px', borderTop:'1px solid #1e2433', background:'#0d1017', display:'flex', justifyContent:'space-between', fontSize:11, color:'#475569', flexShrink:0 }}>
          <span>SF Flow Logger v2.2 · Tooling API · {conn?.instanceUrl || '...'}</span>
          <span>{autoRefresh ? 'Polling 15s' : 'Manual'} · {execs.length} executions</span>
        </div>
      </div>
    </>
  );
}
