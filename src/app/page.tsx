'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

type Status = 'idle' | 'submitting' | 'done' | 'error';

const PROJECTS = ['','level23','maat','rdti','research','signal','infra','product','finance'];
const PROJECT_COLORS: Record<string,string> = {
  level23:'#1a4e8a', maat:'#1a6e28', rdti:'#7a3b00', research:'#5a1a6e',
  signal:'#6e4a1a', infra:'#1a5a6e', product:'#3b1a6e', finance:'#1a6e5a',
};

const SUPA_URL  = 'https://lzfgigiyqpuuxslsygjt.supabase.co';
const ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmdpZ2l5cXB1dXhzbHN5Z2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MTc0NjksImV4cCI6MjA1OTk5MzQ2OX0.qUNzDEr2rxjRSClh5P4jeDv_18_yCCkFXTizJqNYSgg';

type Stats = { edu: number; code: number; jobs: number; today: number; queued: number; errors: number; retrying: number };

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:'3px',padding:'2px 8px 2px 8px',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-2)'}}>
      {label}
      <button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-4)',fontSize:'11px',lineHeight:1,padding:'0 0 0 2px'}} title="remove">×</button>
    </span>
  );
}

export default function DropZone() {
  const [text, setText]         = useState('');
  const [url, setUrl]           = useState('');
  const [project, setProject]   = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags]         = useState<string[]>([]);
  const [notes, setNotes]       = useState('');
  const [status, setStatus]     = useState<Status>('idle');
  const [jobId, setJobId]       = useState('');
  const [errMsg, setErrMsg]     = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [stats, setStats]       = useState<Stats|null>(null);
  const [history, setHistory]   = useState<{id:string;proj:string;chars:number;ts:string;tags:string[]}[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const tagRef  = useRef<HTMLInputElement>(null);

  // Live stats from Supabase
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/rpc/knowledge_stats`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); const t = setInterval(fetchStats, 30000); return () => clearInterval(t); }, [fetchStats]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(280, ta.scrollHeight) + 'px';
  }, [text]);

  const addTag = (raw: string) => {
    const newTags = raw.split(/[,\s]+/).map(t=>t.trim().toLowerCase()).filter(t=>t && !tags.includes(t));
    if (newTags.length) setTags(prev => [...prev, ...newTags]);
    setTagInput('');
  };

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key==='Enter'||e.key===','||e.key===' ') { e.preventDefault(); addTag(tagInput); }
    if (e.key==='Backspace' && !tagInput && tags.length) setTags(t=>t.slice(0,-1));
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain');
    if (/^https?:\/\//.test(pasted.trim()) && !pasted.includes('\n')) {
      e.preventDefault(); setUrl(pasted.trim());
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.getData('text/plain');
    if (dropped) setText(p => p ? p+'\n\n'+dropped : dropped);
    const droppedUrl = e.dataTransfer.getData('text/uri-list');
    if (droppedUrl && !url) setUrl(droppedUrl.split('\n')[0].trim());
  }, [url]);

  const pasteFromClipboard = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setUrl(t.trim()); } catch {}
  };

  const reset = () => {
    setText(''); setUrl(''); setProject(''); setTags([]); setTagInput(''); setNotes('');
    setStatus('idle'); setJobId(''); setErrMsg('');
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const submit = async () => {
    if (!text.trim() || status==='submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/enqueue', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ raw_text:text, source_url:url||null, project:project||null, topic_tags:tags.length?tags:null, notes:notes||null }),
      });
      const data = await res.json();
      if (!res.ok||data.error) throw new Error(data.error||'enqueue failed');
      setJobId(data.job_id);
      setStatus('done');
      setHistory(h=>[{id:data.job_id,proj:project||'—',chars:text.length,ts:new Date().toLocaleTimeString(),tags},...h].slice(0,8));
      fetchStats();
    } catch(e:any) { setErrMsg(e.message); setStatus('error'); }
  };

  useEffect(() => {
    const h = (e:KeyboardEvent) => { if((e.metaKey||e.ctrlKey)&&e.key==='Enter') submit(); };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  });

  const codeCount = (text.match(/```/g)||[]).length>>1;
  const paraCount = text.split(/\n\n+/).filter(p=>p.trim().length>80).length;
  const charCount = text.length;

  const I = (extra={}) => ({
    background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)',
    padding:'9px 11px', fontFamily:'var(--mono)', fontSize:'12px', color:'var(--text)',
    outline:'none', width:'100%', transition:'border-color 0.12s, box-shadow 0.12s', ...extra
  });

  const focusStyle = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent)';
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(17,17,17,0.06)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.boxShadow   = 'none';
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>

      {/* Header */}
      <header style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'0 24px',display:'flex',alignItems:'center',gap:'0',boxShadow:'var(--sh)',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'13px 0',borderRight:'1px solid var(--border)',paddingRight:'20px',marginRight:'20px'}}>
          <div style={{width:'7px',height:'7px',background:'var(--accent)',borderRadius:'1px',transform:'rotate(45deg)'}}/>
          <span style={{fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600,letterSpacing:'0.1em',color:'var(--text)'}}>T4H // KNOWLEDGE INTAKE</span>
        </div>
        <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',letterSpacing:'0.08em'}}>DROP ZONE v1.1</span>

        {/* Live stats */}
        {stats && (
          <div style={{marginLeft:'28px',display:'flex',gap:'20px',alignItems:'center'}}>
            <div style={{display:'flex',gap:'4px',alignItems:'baseline'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:'15px',fontWeight:600,color:'var(--text)'}}>{stats.edu}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.08em'}}>EDU</span>
            </div>
            <div style={{width:'1px',height:'14px',background:'var(--border)'}}/>
            <div style={{display:'flex',gap:'4px',alignItems:'baseline'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:'15px',fontWeight:600,color:'var(--text)'}}>{stats.code}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.08em'}}>CODE</span>
            </div>
            <div style={{width:'1px',height:'14px',background:'var(--border)'}}/>
            <div style={{display:'flex',gap:'4px',alignItems:'baseline'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:'15px',fontWeight:600,color:'var(--blue)'}}>{stats.today}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.08em'}}>TODAY</span>
            </div>
          </div>
        )}

        <div style={{marginLeft:'auto',display:'flex',gap:'16px',alignItems:'center'}}>
          <span style={{fontFamily:'var(--mono)',fontSize:'10px'}}>
            <span style={{color:'var(--green)',fontWeight:700,marginRight:'5px'}}>●</span>
            <span style={{color:'var(--text-3)'}}>WORKER LIVE</span>
          </span>
          <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)'}}>↻ 5 MIN</span>
        </div>
      </header>

      <div style={{display:'flex',flex:1}}>
        {/* Main */}
        <main style={{flex:1,padding:'24px',display:'flex',flexDirection:'column',gap:'14px'}}>

          {/* Banners */}
          {status==='done' && (
            <div style={{animation:'fadeUp 0.2s ease',background:'var(--green-bg)',border:'1px solid var(--green-bd)',borderRadius:'var(--r)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'var(--sh)'}}>
              <span style={{color:'var(--green)',fontFamily:'var(--mono)',fontSize:'11px',fontWeight:700}}>✓ QUEUED</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-3)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{jobId}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',whiteSpace:'nowrap'}}>extracts in ≤5 min</span>
              <button onClick={reset} style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:600,color:'var(--green)',background:'none',border:'1px solid var(--green)',borderRadius:'3px',padding:'4px 12px',cursor:'pointer',whiteSpace:'nowrap',letterSpacing:'0.06em'}}>
                + NEW DROP
              </button>
            </div>
          )}
          {status==='error' && (
            <div style={{animation:'fadeUp 0.2s ease',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:'var(--r)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{color:'var(--red)',fontFamily:'var(--mono)',fontSize:'11px',fontWeight:700}}>✗ ERROR</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-3)',flex:1}}>{errMsg}</span>
              <button onClick={()=>setStatus('idle')} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--red)',background:'none',border:'1px solid var(--red-bd)',borderRadius:'3px',padding:'4px 12px',cursor:'pointer'}}>RETRY</button>
            </div>
          )}

          {/* Textarea card */}
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            style={{background:'var(--surface)',border:`1.5px solid ${dragOver?'var(--green)':'var(--border)'}`,borderRadius:'var(--r)',boxShadow:dragOver?'0 0 0 3px rgba(26,110,40,0.08)':'var(--sh)',transition:'all 0.12s',overflow:'hidden',position:'relative'}}>
            {dragOver && (
              <div style={{position:'absolute',inset:0,background:'rgba(26,110,40,0.03)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,pointerEvents:'none'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'12px',color:'var(--green)',fontWeight:700,letterSpacing:'0.15em',background:'var(--green-bg)',padding:'8px 20px',borderRadius:'4px',border:'1px solid var(--green-bd)'}}>DROP HERE</span>
              </div>
            )}

            {/* Toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',borderBottom:'1px solid var(--border)',background:'var(--surface2)'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:600,color:'var(--text-3)',letterSpacing:'0.1em'}}>CONTENT</span>
              <div style={{height:'12px',width:'1px',background:'var(--border)',margin:'0 2px'}}/>
              {charCount > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)'}}>{charCount.toLocaleString()} chars</span>}
              {codeCount > 0 && (
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',background:'var(--amber-bg)',color:'var(--amber)',border:'1px solid var(--amber-bd)',borderRadius:'3px',padding:'1px 7px',fontWeight:500}}>
                  {codeCount} code block{codeCount>1?'s':''}
                </span>
              )}
              {paraCount > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)'}}>¶ {paraCount}</span>}
              {charCount > 0 && (
                <button onClick={()=>setText('')} style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',background:'none',border:'none',cursor:'pointer',padding:'2px 6px',borderRadius:'3px',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  clear ×
                </button>
              )}
            </div>

            <textarea
              ref={textRef}
              value={text}
              onChange={e=>setText(e.target.value)}
              onPaste={handlePaste}
              placeholder={"Paste content here — LLM responses, code blocks, articles, chat transcripts.\n\nExplanations and code blocks are extracted and saved automatically.\n\nDrag & drop text or URLs also works."}
              autoFocus
              disabled={status==='submitting'}
              style={{width:'100%',minHeight:'280px',resize:'none',overflow:'hidden',background:'var(--surface)',border:'none',outline:'none',fontFamily:'var(--mono)',fontSize:'13px',lineHeight:'1.75',color:'var(--text)',padding:'16px 14px',letterSpacing:'0.01em',display:'block'}}
            />
          </div>

          {/* Meta grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            {/* Source URL */}
            <div>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>
                Source URL
              </label>
              <div style={{position:'relative'}}>
                <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." disabled={status==='submitting'}
                  style={{...I({paddingRight:'60px'})}}
                  onFocus={focusStyle as any} onBlur={blurStyle as any}
                />
                {!url && (
                  <button onClick={pasteFromClipboard} title="Paste from clipboard"
                    style={{position:'absolute',right:'6px',top:'50%',transform:'translateY(-50%)',fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'3px',padding:'2px 6px',cursor:'pointer',letterSpacing:'0.06em'}}>
                    PASTE
                  </button>
                )}
                {url && (
                  <button onClick={()=>setUrl('')}
                    style={{position:'absolute',right:'6px',top:'50%',transform:'translateY(-50%)',fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-4)',background:'none',border:'none',cursor:'pointer',padding:'0 4px'}}>
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Project */}
            <div>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Project</label>
              <div style={{position:'relative'}}>
                {project && <div style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',width:'8px',height:'8px',borderRadius:'50%',background:PROJECT_COLORS[project]||'var(--text-4)',zIndex:1,pointerEvents:'none'}}/>}
                <select value={project} onChange={e=>setProject(e.target.value)} disabled={status==='submitting'}
                  style={{...I({appearance:'none' as any,cursor:'pointer',paddingLeft:project?'26px':'11px',color:project?'var(--text)':'var(--text-4)'}),paddingRight:'28px'}}
                  onFocus={focusStyle as any} onBlur={blurStyle as any}>
                  {PROJECTS.map(p=><option key={p} value={p}>{p||'— none —'}</option>)}
                </select>
                <div style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-4)',fontSize:'10px'}}>▾</div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Tags</label>
              <div
                onClick={()=>tagRef.current?.focus()}
                style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'6px 8px',minHeight:'38px',display:'flex',flexWrap:'wrap',gap:'4px',alignItems:'center',cursor:'text',transition:'border-color 0.12s,box-shadow 0.12s'}}
                onFocus={()=>{}} >
                {tags.map(t=>(
                  <Tag key={t} label={t} onRemove={()=>setTags(prev=>prev.filter(x=>x!==t))}/>
                ))}
                <input
                  ref={tagRef}
                  value={tagInput}
                  onChange={e=>setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={()=>{ if(tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length?'':'rdti, supabase…'}
                  disabled={status==='submitting'}
                  style={{background:'none',border:'none',outline:'none',fontFamily:'var(--mono)',fontSize:'12px',color:'var(--text)',minWidth:'80px',flex:1,padding:'1px 2px'}}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',letterSpacing:'0.1em',color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:'5px',textTransform:'uppercase'}}>Notes</label>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="optional context" disabled={status==='submitting'}
                style={I()} onFocus={focusStyle as any} onBlur={blurStyle as any}/>
            </div>
          </div>

          {/* Submit */}
          <div style={{display:'flex',alignItems:'center',gap:'12px',paddingTop:'2px'}}>
            <button
              onClick={submit}
              disabled={!text.trim()||status==='submitting'||status==='done'}
              style={{
                fontFamily:'var(--mono)',fontSize:'11px',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',
                background:text.trim()&&status==='idle'?'var(--accent)':'var(--surface3)',
                color:text.trim()&&status==='idle'?'#fff':'var(--text-4)',
                border:`1.5px solid ${text.trim()&&status==='idle'?'var(--accent)':'var(--border)'}`,
                borderRadius:'var(--r)',padding:'11px 28px',
                cursor:text.trim()&&status==='idle'?'pointer':'default',
                transition:'all 0.12s',
                boxShadow:text.trim()&&status==='idle'?'var(--sh)':'none',
                display:'flex',alignItems:'center',gap:'8px',
              }}>
              {status==='submitting' && <span style={{width:'11px',height:'11px',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>}
              {status==='submitting'?'Queuing…':status==='done'?'Queued ✓':'Drop into Queue'}
            </button>
            <kbd style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:'3px',padding:'2px 6px'}}>⌘↵</kbd>
          </div>
        </main>

        {/* Sidebar */}
        <aside style={{width:'210px',borderLeft:'1px solid var(--border)',padding:'20px 16px',display:'flex',flexDirection:'column',gap:'12px',background:'var(--surface)',flexShrink:0}}>

          {/* Stats */}
          {stats && (
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'12px',marginBottom:'4px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                {([['var(--green)','EDU',stats.edu],['var(--amber)','CODE',stats.code]] as [string,string,number][]).map(([color,label,val])=>(
                  <div key={label}>
                    <div style={{fontFamily:'var(--mono)',fontSize:'18px',fontWeight:700,color,lineHeight:1}}>{val}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)',letterSpacing:'0.1em',marginTop:'2px'}}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:'1px solid var(--border)',paddingTop:'8px',marginTop:'10px',display:'flex',flexDirection:'column',gap:'3px'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-4)'}}>{stats.jobs} done · {stats.today} today</span>
                {stats.queued > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--blue)',fontWeight:500}}>⟳ {stats.queued} in queue</span>}
                {stats.retrying > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--amber)',fontWeight:500}}>↻ {stats.retrying} retrying</span>}
                {stats.errors > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--red)',fontWeight:500}}>✗ {stats.errors} dead (3 attempts)</span>}
              </div>
            </div>
          )}

          <div style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:700,color:'var(--text-3)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Recent Drops</div>

          {history.length===0
            ? <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-4)',lineHeight:1.7}}>Nothing yet this session</div>
            : history.map(h=>(
              <div key={h.id} style={{animation:'fadeUp 0.2s ease',borderLeft:`2px solid ${PROJECT_COLORS[h.proj]||'var(--border-hi)'}`,paddingLeft:'10px'}}>
                <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text)',fontWeight:500}}>{h.proj}</div>
                {h.tags.length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:'3px',marginTop:'3px'}}>{h.tags.slice(0,3).map(t=><span key={t} style={{fontFamily:'var(--mono)',fontSize:'9px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'2px',padding:'0 5px',color:'var(--text-3)'}}>{t}</span>)}</div>}
                <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',marginTop:'2px'}}>{h.chars.toLocaleString()} chars · {h.ts}</div>
              </div>
            ))
          }

          <div style={{marginTop:'auto',borderTop:'1px solid var(--border)',paddingTop:'14px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'10px',fontWeight:700,color:'var(--text-3)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'10px'}}>Pipeline</div>
            {['INTAKE','CLAIM','EXTRACT','PERSIST'].map(s=>(
              <div key={s} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px'}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--green)',flexShrink:0,boxShadow:'0 0 4px rgba(26,110,40,0.4)'}}/>
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-3)',letterSpacing:'0.08em'}}>{s}</span>
              </div>
            ))}
            <p style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-4)',lineHeight:1.7,marginTop:'10px'}}>Worker polls every 5m.<br/>Artifacts in ≤5 min.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
