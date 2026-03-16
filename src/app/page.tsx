'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

type Status = 'idle' | 'submitting' | 'done' | 'error';
const PROJECTS = ['','maat','rdti','level23','research','signal','infra','product','finance'];

export default function DropZone() {
  const [text, setText]           = useState('');
  const [url, setUrl]             = useState('');
  const [project, setProject]     = useState('');
  const [tags, setTags]           = useState('');
  const [notes, setNotes]         = useState('');
  const [status, setStatus]       = useState<Status>('idle');
  const [jobId, setJobId]         = useState('');
  const [errMsg, setErrMsg]       = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [history, setHistory]     = useState<{id:string;proj:string;chars:number;ts:string}[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clip = e.clipboardData;
    const pasted = clip.getData('text/plain');
    if (/^https?:\/\//.test(pasted.trim()) && !pasted.includes('\n')) {
      e.preventDefault(); setUrl(pasted.trim()); return;
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.getData('text/plain');
    if (dropped) { setText(p => p ? p + '\n\n' + dropped : dropped); setCharCount(p => p + dropped.length); }
    const droppedUrl = e.dataTransfer.getData('text/uri-list');
    if (droppedUrl && !url) setUrl(droppedUrl.split('\n')[0].trim());
  }, [url]);

  const reset = () => {
    setText(''); setUrl(''); setProject(''); setTags(''); setNotes('');
    setStatus('idle'); setJobId(''); setErrMsg(''); setCharCount(0);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const submit = async () => {
    if (!text.trim() || status === 'submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: text, source_url: url || null,
          project: project || null,
          topic_tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'enqueue failed');
      setJobId(data.job_id);
      setStatus('done');
      setHistory(h => [{id:data.job_id,proj:project||'—',chars:charCount,ts:new Date().toLocaleTimeString()},...h].slice(0,10));
    } catch(e:any) { setErrMsg(e.message); setStatus('error'); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey||e.ctrlKey) && e.key==='Enter') submit(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [text, url, project, tags, notes]);

  const codeBlockCount = (text.match(/```/g)||[]).length >> 1;
  const paraCount = text.split(/\n\n+/).filter(p=>p.trim().length>80).length;

  const inputStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '9px 12px',
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const labelStyle = {
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: '5px',
    display: 'block',
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)'}}>

      {/* Header */}
      <header style={{borderBottom:'1px solid var(--border)',padding:'0 24px',display:'flex',alignItems:'center',gap:'0',background:'var(--surface)',boxShadow:'var(--shadow)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 0',borderRight:'1px solid var(--border)',paddingRight:'20px',marginRight:'20px'}}>
          <div style={{width:'8px',height:'8px',background:'var(--accent)',borderRadius:'1px'}}/>
          <span style={{fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600,color:'var(--text)',letterSpacing:'0.12em'}}>
            T4H // KNOWLEDGE INTAKE
          </span>
        </div>
        <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)',letterSpacing:'0.1em'}}>
          DROP ZONE v1.0
        </span>
        <div style={{marginLeft:'auto',display:'flex',gap:'20px',alignItems:'center'}}>
          <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)'}}>
            WORKER <span style={{color:'var(--green)',fontWeight:600}}>● LIVE</span>
          </span>
          <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)'}}>
            POLL <span style={{color:'var(--amber)',fontWeight:500}}>5 MIN</span>
          </span>
        </div>
      </header>

      <div style={{display:'flex',flex:1,gap:0}}>

        {/* Main */}
        <main style={{flex:1,padding:'28px 24px',display:'flex',flexDirection:'column',gap:'16px',maxWidth:'820px'}}>

          {/* Banner */}
          {status==='done' && (
            <div style={{animation:'fadeUp 0.25s ease',background:'var(--green-bg)',border:'1px solid #a8d8aa',borderRadius:'4px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'var(--shadow)'}}>
              <span style={{color:'var(--green)',fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600}}>✓ QUEUED</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-dim)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{jobId}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)'}}>extracts in ≤5 min</span>
              <button onClick={reset} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--accent2)',background:'none',border:'1px solid var(--accent2)',borderRadius:'3px',padding:'4px 12px',cursor:'pointer',letterSpacing:'0.08em',fontWeight:600}}>
                NEW DROP
              </button>
            </div>
          )}
          {status==='error' && (
            <div style={{animation:'fadeUp 0.25s ease',background:'var(--red-bg)',border:'1px solid #f5c6c2',borderRadius:'4px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{color:'var(--red)',fontFamily:'var(--mono)',fontSize:'11px',fontWeight:600}}>✗ ERROR</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-dim)',flex:1}}>{errMsg}</span>
              <button onClick={()=>setStatus('idle')} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--red)',background:'none',border:'1px solid var(--red)',borderRadius:'3px',padding:'4px 12px',cursor:'pointer'}}>
                RETRY
              </button>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            style={{
              background:'var(--surface)',
              border:`1.5px solid ${dragOver?'#1e7e2e':'var(--border)'}`,
              borderRadius:'6px',
              boxShadow: dragOver ? '0 0 0 3px rgba(30,126,46,0.1)' : 'var(--shadow)',
              transition:'border-color 0.15s,box-shadow 0.15s',
              overflow:'hidden',
              position:'relative',
            }}>
            {dragOver && (
              <div style={{position:'absolute',inset:0,background:'rgba(30,126,46,0.03)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,pointerEvents:'none',borderRadius:'6px'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'12px',color:'var(--green)',fontWeight:600,letterSpacing:'0.15em'}}>RELEASE TO DROP</span>
              </div>
            )}

            {/* Toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface2)'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.12em',fontWeight:600}}>CONTENT</span>
              {charCount > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)',marginLeft:'4px'}}>{charCount.toLocaleString()} chars</span>}
              {codeBlockCount > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--amber)',background:'var(--amber-bg)',padding:'1px 7px',borderRadius:'3px',fontWeight:500}}>⌥ {codeBlockCount} code block{codeBlockCount>1?'s':''}</span>}
              {paraCount > 0 && <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)'}}>¶ {paraCount} para</span>}
              {text && <button onClick={()=>{setText('');setCharCount(0);}} style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)',background:'none',border:'none',cursor:'pointer',padding:'2px 8px',borderRadius:'3px',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--border)')} onMouseLeave={e=>(e.currentTarget.style.background='none')}>clear</button>}
            </div>

            <textarea
              ref={textRef}
              value={text}
              onChange={e=>{setText(e.target.value);setCharCount(e.target.value.length)}}
              onPaste={handlePaste}
              placeholder={"Paste content here — LLM responses, code blocks, article text, chat transcripts.\n\nLLM explanations and code blocks are extracted automatically.\n\nDrag & drop text or URLs also works."}
              autoFocus
              disabled={status==='submitting'}
              style={{
                width:'100%', minHeight:'300px', resize:'vertical',
                background:'var(--surface)', border:'none', outline:'none',
                fontFamily:'var(--mono)', fontSize:'13px', lineHeight:'1.7',
                color:'var(--text)', padding:'16px 14px',
                letterSpacing:'0.01em',
              }}
            />
          </div>

          {/* Metadata */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div style={{display:'flex',flexDirection:'column'}}>
              <label style={labelStyle}>Source URL</label>
              <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." disabled={status==='submitting'} style={inputStyle}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 0 0 2px rgba(0,0,0,0.06)'}}
                onBlur={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column'}}>
              <label style={labelStyle}>Project</label>
              <select value={project} onChange={e=>setProject(e.target.value)} disabled={status==='submitting'}
                style={{...inputStyle,appearance:'none',cursor:'pointer',color:project?'var(--text)':'var(--text-faint)'}}>
                {PROJECTS.map(p=><option key={p} value={p}>{p||'— none —'}</option>)}
              </select>
            </div>
            <div style={{display:'flex',flexDirection:'column'}}>
              <label style={labelStyle}>Tags <span style={{color:'var(--text-faint)',textTransform:'none',letterSpacing:0}}>comma-separated</span></label>
              <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="rdti, supabase, bridge" disabled={status==='submitting'} style={inputStyle}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 0 0 2px rgba(0,0,0,0.06)'}}
                onBlur={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column'}}>
              <label style={labelStyle}>Notes</label>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="optional context" disabled={status==='submitting'} style={inputStyle}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 0 0 2px rgba(0,0,0,0.06)'}}
                onBlur={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none'}}
              />
            </div>
          </div>

          {/* Submit row */}
          <div style={{display:'flex',alignItems:'center',gap:'14px',paddingTop:'2px'}}>
            <button
              onClick={submit}
              disabled={!text.trim()||status==='submitting'||status==='done'}
              style={{
                fontFamily:'var(--mono)', fontSize:'11px', letterSpacing:'0.15em', fontWeight:600,
                background: text.trim()&&status==='idle' ? 'var(--accent)' : 'var(--surface2)',
                color: text.trim()&&status==='idle' ? '#fff' : 'var(--text-faint)',
                border: `1px solid ${text.trim()&&status==='idle'?'var(--accent)':'var(--border)'}`,
                borderRadius:'4px', padding:'11px 28px', cursor: text.trim()&&status==='idle'?'pointer':'default',
                transition:'all 0.15s', textTransform:'uppercase',
                boxShadow: text.trim()&&status==='idle' ? 'var(--shadow)' : 'none',
              }}
              onMouseEnter={e=>{if(text.trim()&&status==='idle')e.currentTarget.style.background='#333'}}
              onMouseLeave={e=>{if(status==='idle')e.currentTarget.style.background=text.trim()?'var(--accent)':'var(--surface2)'}}
            >
              {status==='submitting'?'Queuing...':status==='done'?'Queued ✓':'Drop into Queue'}
            </button>
            <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)'}}>⌘↵</span>
          </div>
        </main>

        {/* Sidebar */}
        <aside style={{width:'220px',borderLeft:'1px solid var(--border)',padding:'20px 16px',display:'flex',flexDirection:'column',gap:'10px',background:'var(--surface)'}}>
          <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em',fontWeight:600,marginBottom:'2px'}}>RECENT DROPS</div>
          {history.length===0 ? (
            <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-faint)',lineHeight:'1.8'}}>Nothing yet</div>
          ) : history.map(h=>(
            <div key={h.id} style={{borderLeft:'2px solid var(--border-hi)',paddingLeft:'10px',animation:'fadeUp 0.25s ease'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text)',fontWeight:500}}>{h.proj}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)'}}>{h.chars.toLocaleString()} chars</div>
              <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)'}}>{h.ts}</div>
            </div>
          ))}

          <div style={{marginTop:'auto',borderTop:'1px solid var(--border)',paddingTop:'16px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.12em',fontWeight:600,marginBottom:'10px'}}>PIPELINE</div>
            {['INTAKE','CLAIM','EXTRACT','PERSIST'].map(step=>(
              <div key={step} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--green)',flexShrink:0}}/>
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.08em'}}>{step}</span>
              </div>
            ))}
            <div style={{marginTop:'10px',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-faint)',lineHeight:'1.7'}}>
              Worker polls every 5m.<br/>
              Artifacts in ≤5 min.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
