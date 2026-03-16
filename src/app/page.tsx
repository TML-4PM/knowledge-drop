'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

type Status = 'idle' | 'submitting' | 'queued' | 'processing' | 'done' | 'error';
type ArtifactRef = { id: string; title?: string; language?: string; topic_tags?: string[] };
type JobResult = {
  status: string; retry_count: number; error?: string; project?: string;
  edu_count: number; code_count: number; edu: ArtifactRef[]; code: ArtifactRef[];
};
type Stats = { edu: number; code: number; jobs: number; today: number; queued: number; errors: number; retrying: number };

const PROJECTS = ['','level23','maat','rdti','research','signal','infra','product','finance'];
const PROJECT_COLORS: Record<string,string> = {
  level23:'#1a4e8a', maat:'#1a6e28', rdti:'#7a3b00', research:'#5a1a6e',
  signal:'#6e4a1a', infra:'#1a5a6e', product:'#3b1a6e', finance:'#1a6e5a',
};

const SUPA_URL = 'https://lzfgigiyqpuuxslsygjt.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmdpZ2l5cXB1dXhzbHN5Z2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MTc0NjksImV4cCI6MjA1OTk5MzQ2OX0.qUNzDEr2rxjRSClh5P4jeDv_18_yCCkFXTizJqNYSgg';
const CC_BASE  = 'https://mcp-command-centre.vercel.app';

function supa(fn: string, body: object) {
  return fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:'3px',padding:'2px 8px',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-2)'}}>
      {label}
      <button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-4)',fontSize:'11px',lineHeight:1,padding:'0 0 0 2px'}}>×</button>
    </span>
  );
}

// Completion card shown after job finishes
function CompletionCard({ jobId, result, project, onReset }: {
  jobId: string; result: JobResult; project: string; onReset: () => void;
}) {
  const proj = result.project || project;
  const ccKnowledge = `${CC_BASE}/knowledge`;
  const ccEdu  = `${CC_BASE}/knowledge?tab=edu_snippets`;
  const ccCode = `${CC_BASE}/knowledge?tab=code_snippets`;
  const hasArtifacts = result.edu_count > 0 || result.code_count > 0;

  return (
    <div style={{animation:'fadeUp 0.25s ease',background:'var(--green-bg)',border:'1px solid var(--green-bd)',borderRadius:'6px',overflow:'hidden',boxShadow:'0 2px 12px rgba(26,110,40,0.08)'}}>

      {/* Top bar */}
      <div style={{background:'var(--green)',padding:'11px 16px',display:'flex',alignItems:'center',gap:'10px'}}>
        <span style={{color:'#fff',fontFamily:'var(--mono)',fontSize:'12px',fontWeight:700}}>✓ EXTRACTED</span>
        <span style={{color:'rgba(255,255,255,0.7)',fontFamily:'var(--mono)',fontSize:'10px',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{jobId}</span>
        <button onClick={onReset} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'#fff',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'3px',padding:'3px 12px',cursor:'pointer',letterSpacing:'0.06em',fontWeight:600}}>
          + NEW DROP
        </button>
      </div>

      <div style={{padding:'16px'}}>
        {/* Artifact counts */}
        {hasArtifacts ? (
          <div style={{display:'flex',gap:'12px',marginBottom:'14px'}}>
            {result.edu_count > 0 && (
              <a href={ccEdu} target="_blank" rel="noreferrer"
                style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--surface)',border:'1px solid var(--green-bd)',borderRadius:'5px',padding:'10px 14px',textDecoration:'none',flex:1,transition:'box-shadow 0.12s',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(26,110,40,0.15)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                <span style={{fontSize:'20px',lineHeight:1}}>📚</span>
                <div>
                  <div style={{fontFamily:'var(--mono)',fontSize:'18px',fontWeight:700,color:'var(--green)',lineHeight:1}}>{result.edu_count}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',marginTop:'2px'}}>edu snippets →</div>
                </div>
              </a>
            )}
            {result.code_count > 0 && (
              <a href={ccCode} target="_blank" rel="noreferrer"
                style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--surface)',border:'1px solid var(--amber-bd)',borderRadius:'5px',padding:'10px 14px',textDecoration:'none',flex:1,transition:'box-shadow 0.12s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(154,94,0,0.12)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                <span style={{fontSize:'20px',lineHeight:1}}>⌨️</span>
                <div>
                  <div style={{fontFamily:'var(--mono)',fontSize:'18px',fontWeight:700,color:'var(--amber)',lineHeight:1}}>{result.code_count}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',marginTop:'2px'}}>code snippets →</div>
                </div>
              </a>
            )}
          </div>
        ) : (
          <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-3)',marginBottom:'12px',padding:'10px 12px',background:'var(--surface)',borderRadius:'4px',border:'1px solid var(--border)'}}>
            No extractable artifacts found — content may be too short or non-structured.
          </div>
        )}

        {/* Artifact title previews */}
        {result.edu.length > 0 && (
          <div style={{marginBottom:'10px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.1em',marginBottom:'5px',textTransform:'uppercase'}}>Saved explanations</div>
            {result.edu.slice(0,4).map(e=>(
              <div key={e.id} style={{fontFamily:'var(--sans)',fontSize:'12px',color:'var(--text-2)',padding:'3px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{color:'var(--green)',fontSize:'10px'}}>¶</span>
                {e.title || '(untitled)'}
              </div>
            ))}
            {result.edu.length > 4 && <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',marginTop:'4px'}}>+{result.edu.length-4} more</div>}
          </div>
        )}
        {result.code.length > 0 && (
          <div style={{marginBottom:'12px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.1em',marginBottom:'5px',textTransform:'uppercase'}}>Saved code blocks</div>
            {result.code.slice(0,4).map(c=>(
              <div key={c.id} style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-2)',padding:'3px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{color:'var(--amber)',background:'var(--amber-bg)',borderRadius:'2px',padding:'0 5px',fontSize:'9px'}}>{c.language||'?'}</span>
                {(c.topic_tags||[]).slice(0,3).join(', ') || '(untagged)'}
              </div>
            ))}
            {result.code.length > 4 && <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',marginTop:'4px'}}>+{result.code.length-4} more</div>}
          </div>
        )}

        {/* Action links */}
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',borderTop:'1px solid var(--green-bd)',paddingTop:'12px'}}>
          <a href={ccKnowledge} target="_blank" rel="noreferrer"
            style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:600,color:'var(--green)',background:'none',border:'1px solid var(--green)',borderRadius:'3px',padding:'5px 12px',textDecoration:'none',letterSpacing:'0.06em'}}>
            VIEW IN COMMAND CENTRE →
          </a>
          {proj && (
            <a href={`${ccKnowledge}?project=${proj}`} target="_blank" rel="noreferrer"
              style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',background:'none',border:'1px solid var(--border)',borderRadius:'3px',padding:'5px 12px',textDecoration:'none',letterSpacing:'0.06em'}}>
              FILTER: {proj.toUpperCase()}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DropZone() {
  const [text, setText]           = useState('');
  const [url, setUrl]             = useState('');
  const [project, setProject]     = useState('');
  const [tagInput, setTagInput]   = useState('');
  const [tags, setTags]           = useState<string[]>([]);
  const [notes, setNotes]         = useState('');
  const [status, setStatus]       = useState<Status>('idle');
  const [jobId, setJobId]         = useState('');
  const [jobResult, setJobResult] = useState<JobResult|null>(null);
  const [submitProject, setSubmitProject] = useState('');
  const [errMsg, setErrMsg]       = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [stats, setStats]         = useState<Stats|null>(null);
  const [history, setHistory]     = useState<{id:string;proj:string;chars:number;ts:string;tags:string[];result?:JobResult}[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const tagRef  = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const fetchStats = useCallback(async () => {
    try { const d = await supa('knowledge_stats', {}); if (d && !d.error) setStats(d); } catch {}
  }, []);

  useEffect(() => { fetchStats(); const t = setInterval(fetchStats, 30000); return () => clearInterval(t); }, [fetchStats]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textRef.current; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(280, ta.scrollHeight) + 'px';
  }, [text]);

  // Poll job status after submission
  const startPolling = useCallback((id: string) => {
    let attempts = 0;
    const MAX_POLLS = 72; // 6 minutes at 5s intervals
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const d: JobResult = await supa('knowledge_job_status', { p_job_id: id });
        if (!d || !(d as any).found) return;
        if (d.status === 'done') {
          clearInterval(pollRef.current!);
          setJobResult(d);
          setStatus('done');
          fetchStats();
          // Browser notification if supported
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Knowledge Drop complete', {
              body: `${d.edu_count} explanations · ${d.code_count} code blocks extracted`,
              icon: '/favicon.ico',
            });
          }
        } else if (d.status === 'error') {
          clearInterval(pollRef.current!);
          setErrMsg(d.error || 'Failed after 3 attempts');
          setStatus('error');
        } else if (d.status === 'queued' && d.retry_count > 0) {
          setStatus('processing'); // show as processing while retrying
        }
      } catch {}
      if (attempts >= MAX_POLLS) { clearInterval(pollRef.current!); }
    }, 5000);
  }, [fetchStats]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const addTag = (raw: string) => {
    const newTags = raw.split(/[,\s]+/).map(t=>t.trim().toLowerCase()).filter(t=>t && !tags.includes(t));
    if (newTags.length) setTags(p => [...p, ...newTags]);
    setTagInput('');
  };
  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter',',',' '].includes(e.key)) { e.preventDefault(); addTag(tagInput); }
    if (e.key==='Backspace' && !tagInput && tags.length) setTags(t=>t.slice(0,-1));
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const p = e.clipboardData.getData('text/plain');
    if (/^https?:\/\//.test(p.trim()) && !p.includes('\n')) { e.preventDefault(); setUrl(p.trim()); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const d = e.dataTransfer.getData('text/plain');
    if (d) setText(p => p ? p+'\n\n'+d : d);
    const u = e.dataTransfer.getData('text/uri-list');
    if (u && !url) setUrl(u.split('\n')[0].trim());
  }, [url]);

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setText(''); setUrl(''); setProject(''); setTags([]); setTagInput(''); setNotes('');
    setStatus('idle'); setJobId(''); setJobResult(null); setErrMsg('');
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const submit = async () => {
    if (!text.trim() || status==='submitting') return;
    // Request notification permission on first submit
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setStatus('submitting');
    setSubmitProject(project);
    try {
      const res = await fetch('/api/enqueue', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ raw_text:text, source_url:url||null, project:project||null, topic_tags:tags.length?tags:null, notes:notes||null }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'enqueue failed');
      setJobId(data.job_id);
      setStatus('processing');
      setHistory(h => [{id:data.job_id,proj:project||'—',chars:text.length,ts:new Date().toLocaleTimeString(),tags},...h].slice(0,8));
      startPolling(data.job_id);
      fetchStats();
    } catch(e:any) { setErrMsg(e.message); setStatus('error'); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey||e.ctrlKey) && e.key==='Enter') submit(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  const codeCount = (text.match(/```/g)||[]).length >> 1;
  const paraCount = text.split(/\n\n+/).filter(p=>p.trim().length>80).length;

  const I = (extra: object = {}) => ({
    background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)',
    padding:'9px 11px', fontFamily:'var(--mono)', fontSize:'12px', color:'var(--text)',
    outline:'none', width:'100%', transition:'border-color 0.12s,box-shadow 0.12s', ...extra,
  });
  const focus = (e: React.FocusEvent<any>) => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(17,17,17,0.06)'; };
  const blur  = (e: React.FocusEvent<any>) => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; };

  const isWorking = status === 'submitting' || status === 'processing';

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <header style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'0 24px',display:'flex',alignItems:'center',boxShadow:'var(--sh)',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'13px 0',borderRight:'1px solid var(--border)',paddingRight:'20px',marginRight:'20px'}}>
          <div style={{width:'7px',height:'7px',background:'var(--accent)',borderRadius:'1px',transform:'rotate(45deg)'}}/>
          <span style={{fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600,letterSpacing:'0.1em'}}>T4H // KNOWLEDGE INTAKE</span>
        </div>
        <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',letterSpacing:'0.08em'}}>DROP ZONE v1.2</span>

        {stats && (
          <div style={{marginLeft:'24px',display:'flex',gap:'18px',alignItems:'center'}}>
            {([['var(--green)',stats.edu,'EDU'],['var(--amber)',stats.code,'CODE'],['var(--blue)',stats.today,'TODAY']] as [string,number,string][]).map(([color,val,label])=>(
              <div key={label} style={{display:'flex',gap:'5px',alignItems:'baseline'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'15px',fontWeight:700,color,lineHeight:1}}>{val}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.08em'}}>{label}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{marginLeft:'auto',display:'flex',gap:'16px',alignItems:'center'}}>
          <span style={{fontFamily:'var(--mono)',fontSize:'10px'}}><span style={{color:'var(--green)',fontWeight:700}}>● </span><span style={{color:'var(--text-3)'}}>WORKER LIVE</span></span>
          <a href={`${CC_BASE}/knowledge`} target="_blank" rel="noreferrer"
            style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'3px',padding:'4px 10px',textDecoration:'none',letterSpacing:'0.06em'}}>
            COMMAND CENTRE ↗
          </a>
        </div>
      </header>

      <div style={{display:'flex',flex:1}}>
        <main style={{flex:1,padding:'24px',display:'flex',flexDirection:'column',gap:'14px',minWidth:0}}>

          {/* PROCESSING state */}
          {isWorking && (
            <div style={{animation:'fadeUp 0.2s ease',background:'var(--blue-bg)',border:'1px solid #b8cfe8',borderRadius:'var(--r)',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{width:'14px',height:'14px',border:'2px solid #b8cfe8',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0,display:'inline-block'}}/>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600,color:'var(--blue)'}}>
                  {status==='submitting' ? 'QUEUING…' : 'PROCESSING — waiting for worker'}
                </div>
                {jobId && <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',marginTop:'2px'}}>{jobId}</div>}
                {status==='processing' && <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',marginTop:'2px'}}>Worker runs every 5 min · artifacts appear automatically</div>}
              </div>
            </div>
          )}

          {/* DONE state — completion card */}
          {status==='done' && jobResult && (
            <CompletionCard jobId={jobId} result={jobResult} project={submitProject} onReset={reset} />
          )}

          {/* ERROR state */}
          {status==='error' && (
            <div style={{animation:'fadeUp 0.2s ease',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:'var(--r)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{color:'var(--red)',fontFamily:'var(--mono)',fontSize:'11px',fontWeight:700}}>✗ FAILED</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-3)',flex:1}}>{errMsg}</span>
              <button onClick={reset} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--red)',background:'none',border:'1px solid var(--red-bd)',borderRadius:'3px',padding:'4px 12px',cursor:'pointer'}}>RETRY</button>
            </div>
          )}

          {/* Only show the form when idle or error */}
          {(status==='idle'||status==='error') && (<>

            {/* Drop zone */}
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}
              style={{background:'var(--surface)',border:`1.5px solid ${dragOver?'var(--green)':'var(--border)'}`,borderRadius:'var(--r)',boxShadow:dragOver?'0 0 0 3px rgba(26,110,40,0.08)':'var(--sh)',transition:'all 0.12s',overflow:'hidden',position:'relative'}}>
              {dragOver && <div style={{position:'absolute',inset:0,background:'rgba(26,110,40,0.03)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,pointerEvents:'none'}}><span style={{fontFamily:'var(--mono)',fontSize:'12px',color:'var(--green)',fontWeight:700,background:'var(--green-bg)',padding:'8px 20px',borderRadius:'4px',border:'1px solid var(--green-bd)'}}>DROP HERE</span></div>}
              <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',borderBottom:'1px solid var(--border)',background:'var(--surface2)'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:600,color:'var(--text-3)',letterSpacing:'0.1em'}}>CONTENT</span>
                <div style={{height:'12px',width:'1px',background:'var(--border)',margin:'0 2px'}}/>
                {text.length>0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)'}}>{text.length.toLocaleString()} chars</span>}
                {codeCount>0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',background:'var(--amber-bg)',color:'var(--amber)',border:'1px solid var(--amber-bd)',borderRadius:'3px',padding:'1px 7px',fontWeight:500}}>{codeCount} code block{codeCount>1?'s':''}</span>}
                {paraCount>0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)'}}>¶ {paraCount}</span>}
                {text && <button onClick={()=>setText('')} style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',background:'none',border:'none',cursor:'pointer',padding:'2px 6px',borderRadius:'3px'}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>clear ×</button>}
              </div>
              <textarea ref={textRef} value={text} onChange={e=>setText(e.target.value)} onPaste={handlePaste} autoFocus
                placeholder={"Paste content here — LLM responses, code blocks, articles, chat transcripts.\n\nExplanations and code blocks are extracted and saved automatically.\n\nDrag & drop text or URLs also works."}
                style={{width:'100%',minHeight:'280px',resize:'none',overflow:'hidden',background:'var(--surface)',border:'none',outline:'none',fontFamily:'var(--mono)',fontSize:'13px',lineHeight:'1.75',color:'var(--text)',padding:'16px 14px',display:'block'}}
              />
            </div>

            {/* Meta */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div>
                <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Source URL</label>
                <div style={{position:'relative'}}>
                  <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={{...I({paddingRight:'60px'})}} onFocus={focus} onBlur={blur}/>
                  {!url ? <button onClick={async()=>{try{const t=await navigator.clipboard.readText();if(t)setUrl(t.trim());}catch{}}} style={{position:'absolute',right:'6px',top:'50%',transform:'translateY(-50%)',fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'3px',padding:'2px 6px',cursor:'pointer',letterSpacing:'0.06em'}}>PASTE</button>
                  : <button onClick={()=>setUrl('')} style={{position:'absolute',right:'6px',top:'50%',transform:'translateY(-50%)',fontFamily:'var(--mono)',fontSize:'13px',color:'var(--text-4)',background:'none',border:'none',cursor:'pointer',padding:'0 4px'}}>×</button>}
                </div>
              </div>
              <div>
                <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Project</label>
                <div style={{position:'relative'}}>
                  {project && <div style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',width:'8px',height:'8px',borderRadius:'50%',background:PROJECT_COLORS[project]||'var(--text-4)',zIndex:1,pointerEvents:'none'}}/>}
                  <select value={project} onChange={e=>setProject(e.target.value)} style={{...I({appearance:'none' as any,cursor:'pointer',paddingLeft:project?'26px':'11px',color:project?'var(--text)':'var(--text-4)',paddingRight:'28px'})}} onFocus={focus} onBlur={blur}>
                    {PROJECTS.map(p=><option key={p} value={p}>{p||'— none —'}</option>)}
                  </select>
                  <div style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-4)',fontSize:'10px'}}>▾</div>
                </div>
              </div>
              <div>
                <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Tags</label>
                <div onClick={()=>tagRef.current?.focus()} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'6px 8px',minHeight:'38px',display:'flex',flexWrap:'wrap',gap:'4px',alignItems:'center',cursor:'text'}}>
                  {tags.map(t=><Tag key={t} label={t} onRemove={()=>setTags(p=>p.filter(x=>x!==t))}/>)}
                  <input ref={tagRef} value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={handleTagKey} onBlur={()=>{if(tagInput.trim())addTag(tagInput);}} placeholder={tags.length?'':'rdti, supabase…'} style={{background:'none',border:'none',outline:'none',fontFamily:'var(--mono)',fontSize:'12px',color:'var(--text)',minWidth:'80px',flex:1,padding:'1px 2px'}}/>
                </div>
              </div>
              <div>
                <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Notes</label>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="optional context" style={I()} onFocus={focus} onBlur={blur}/>
              </div>
            </div>

            {/* Submit */}
            <div style={{display:'flex',alignItems:'center',gap:'12px',paddingTop:'2px'}}>
              <button onClick={submit} disabled={!text.trim()}
                style={{fontFamily:'var(--mono)',fontSize:'11px',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',background:text.trim()?'var(--accent)':'var(--surface3)',color:text.trim()?'#fff':'var(--text-4)',border:`1.5px solid ${text.trim()?'var(--accent)':'var(--border)'}`,borderRadius:'var(--r)',padding:'11px 28px',cursor:text.trim()?'pointer':'default',transition:'all 0.12s',boxShadow:text.trim()?'var(--sh)':'none'}}
                onMouseEnter={e=>{if(text.trim())e.currentTarget.style.background='#333'}}
                onMouseLeave={e=>{if(text.trim())e.currentTarget.style.background='var(--accent)'}}>
                Drop into Queue
              </button>
              <kbd style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:'3px',padding:'2px 6px'}}>⌘↵</kbd>
            </div>
          </>)}
        </main>

        {/* Sidebar */}
        <aside style={{width:'210px',borderLeft:'1px solid var(--border)',padding:'20px 16px',display:'flex',flexDirection:'column',gap:'12px',background:'var(--surface)',flexShrink:0}}>
          {stats && (
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'12px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                {([['var(--green)','EDU',stats.edu],['var(--amber)','CODE',stats.code]] as [string,string,number][]).map(([color,label,val])=>(
                  <div key={label}>
                    <div style={{fontFamily:'var(--mono)',fontSize:'18px',fontWeight:700,color,lineHeight:1}}>{val}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.1em',marginTop:'2px'}}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:'1px solid var(--border)',paddingTop:'8px',display:'flex',flexDirection:'column',gap:'3px'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)'}}>{stats.jobs} done · {stats.today} today</span>
                {stats.queued>0 && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--blue)',fontWeight:500}}>⟳ {stats.queued} in queue</span>}
                {stats.retrying>0 && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--amber)',fontWeight:500}}>↻ {stats.retrying} retrying</span>}
                {stats.errors>0 && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--red)',fontWeight:500}}>✗ {stats.errors} dead</span>}
              </div>
            </div>
          )}

          <div style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:700,color:'var(--text-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Recent Drops</div>
          {history.length===0
            ? <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-4)'}}>Nothing yet</div>
            : history.map(h=>(
              <div key={h.id} style={{animation:'fadeUp 0.2s ease',borderLeft:`2px solid ${PROJECT_COLORS[h.proj]||'var(--border-hi)'}`,paddingLeft:'10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text)',fontWeight:500}}>{h.proj}</span>
                  {h.result && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--green)'}}>✓ {h.result.edu_count}e {h.result.code_count}c</span>}
                </div>
                {h.tags.length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px',marginTop:'2px'}}>{h.tags.slice(0,3).map(t=><span key={t} style={{fontFamily:'var(--mono)',fontSize:'9px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'2px',padding:'0 4px',color:'var(--text-3)'}}>{t}</span>)}</div>}
                <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',marginTop:'2px'}}>{h.chars.toLocaleString()} · {h.ts}</div>
              </div>
            ))
          }

          <div style={{marginTop:'auto',borderTop:'1px solid var(--border)',paddingTop:'14px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:700,color:'var(--text-3)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'8px'}}>Links</div>
            {[['📚 Edu Snippets',`${CC_BASE}/knowledge`],['⌨️ Code Snippets',`${CC_BASE}/knowledge`],['📊 All Artifacts',`${CC_BASE}/knowledge`]].map(([label,href])=>(
              <a key={label} href={href} target="_blank" rel="noreferrer" style={{display:'block',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',padding:'4px 0',textDecoration:'none',borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>{label} →</a>
            ))}
            <div style={{marginTop:'12px',fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',lineHeight:1.7}}>Worker polls every 5m.<br/>Browser notif on complete.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
