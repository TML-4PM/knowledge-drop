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
  const dropRef = useRef<HTMLDivElement>(null);

  // Auto-detect URL from clipboard on paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clip = e.clipboardData;
    const pasted = clip.getData('text/plain');
    // If pasted text looks like a URL, put it in url field
    if (/^https?:\/\//.test(pasted.trim()) && pasted.trim().indexOf('\n') === -1) {
      e.preventDefault();
      setUrl(pasted.trim());
      return;
    }
    // Otherwise let it paste normally — also sniff html for source URL
    const html = clip.getData('text/html');
    if (html && !url) {
      const match = html.match(/data-source-url="([^"]+)"|<!--\s*source:\s*(\S+)\s*-->/);
      if (match) setUrl(match[1] || match[2]);
    }
  }, [url]);

  const handleTextChange = (v: string) => {
    setText(v);
    setCharCount(v.length);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.getData('text/plain');
    if (dropped) {
      setText(prev => prev ? prev + '\n\n' + dropped : dropped);
      setCharCount(prev => prev + (prev ? 2 : 0) + dropped.length);
    }
    const droppedUrl = e.dataTransfer.getData('text/uri-list');
    if (droppedUrl && !url) setUrl(droppedUrl.split('\n')[0].trim());
  }, [url]);

  const reset = () => {
    setText(''); setUrl(''); setProject(''); setTags(''); setNotes('');
    setStatus('idle'); setJobId(''); setErrMsg(''); setCharCount(0);
    textRef.current?.focus();
  };

  const submit = async () => {
    if (!text.trim()) { textRef.current?.focus(); return; }
    setStatus('submitting');
    try {
      const res = await fetch('/api/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: text,
          source_url: url || null,
          project: project || null,
          topic_tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'enqueue failed');
      setJobId(data.job_id);
      setStatus('done');
      setHistory(h => [{id:data.job_id, proj:project||'—', chars:charCount, ts:new Date().toLocaleTimeString()},...h].slice(0,10));
    } catch(e:any) {
      setErrMsg(e.message);
      setStatus('error');
    }
  };

  // Cmd/Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, url, project, tags, notes]);

  const codeBlockCount = (text.match(/```/g) || []).length >> 1;
  const paraCount = text.split(/\n\n+/).filter(p => p.trim().length > 80).length;

  return (
    <div style={{minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg)'}}>

      {/* scanline effect */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        <div style={{position:'absolute',left:0,right:0,height:'2px',background:'linear-gradient(transparent,rgba(245,166,35,0.04),transparent)',animation:'scan 8s linear infinite'}} />
      </div>

      {/* Header */}
      <header style={{borderBottom:'1px solid var(--border)',padding:'14px 28px',display:'flex',alignItems:'center',gap:'16px',position:'relative',zIndex:1}}>
        <div style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--amber)',letterSpacing:'0.2em',textTransform:'uppercase'}}>
          T4H // KNOWLEDGE INTAKE
        </div>
        <div style={{width:'1px',height:'16px',background:'var(--border-hi)'}}/>
        <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.1em'}}>
          DROP ZONE v1.0
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:'20px',alignItems:'center'}}>
          <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)'}}>
            WORKER<span style={{color:'var(--green)',marginLeft:'6px'}}>● LIVE</span>
          </div>
          <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)'}}>
            POLL <span style={{color:'var(--amber)'}}>5MIN</span>
          </div>
        </div>
      </header>

      <div style={{display:'flex',flex:1,gap:0,position:'relative',zIndex:1}}>

        {/* Main column */}
        <main style={{flex:1,padding:'32px 28px',display:'flex',flexDirection:'column',gap:'20px',maxWidth:'800px'}}>

          {/* Status banner */}
          {status === 'done' && (
            <div style={{animation:'fadeUp 0.3s ease',background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:'4px',padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{color:'var(--green)',fontFamily:'var(--mono)',fontSize:'12px'}}>✓ QUEUED</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-dim)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{jobId}</span>
              <button onClick={reset} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--amber)',background:'none',border:'1px solid var(--amber-dim)',borderRadius:'2px',padding:'4px 10px',cursor:'pointer',letterSpacing:'0.1em'}}>
                NEW DROP
              </button>
            </div>
          )}
          {status === 'error' && (
            <div style={{animation:'fadeUp 0.3s ease',background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:'4px',padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{color:'var(--red)',fontFamily:'var(--mono)',fontSize:'12px'}}>✗ ERROR</span>
              <span style={{fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text-dim)',flex:1}}>{errMsg}</span>
              <button onClick={() => setStatus('idle')} style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--red)',background:'none',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'2px',padding:'4px 10px',cursor:'pointer'}}>
                RETRY
              </button>
            </div>
          )}

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{position:'relative',borderRadius:'4px',border:`1px solid ${dragOver ? 'var(--amber)' : 'var(--border-hi)'}`,
              transition:'border-color 0.15s, box-shadow 0.15s',
              boxShadow: dragOver ? '0 0 0 1px var(--amber),0 0 24px rgba(245,166,35,0.1)' : 'none',
              animation: dragOver ? 'none' : undefined,
            }}>
            {dragOver && (
              <div style={{position:'absolute',inset:0,background:'rgba(245,166,35,0.04)',borderRadius:'4px',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,pointerEvents:'none'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'12px',color:'var(--amber)',letterSpacing:'0.2em'}}>RELEASE TO DROP</span>
              </div>
            )}
            <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em'}}>CONTENT</span>
              {charCount > 0 && (
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--muted)'}}>{charCount.toLocaleString()} CHARS</span>
              )}
              {codeBlockCount > 0 && (
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--amber)'}}>
                  ⌥ {codeBlockCount} CODE {codeBlockCount===1?'BLOCK':'BLOCKS'}
                </span>
              )}
              {paraCount > 0 && (
                <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)'}}>
                  ¶ {paraCount} PARA
                </span>
              )}
            </div>
            <textarea
              ref={textRef}
              value={text}
              onChange={e => handleTextChange(e.target.value)}
              onPaste={handlePaste}
              placeholder={"Paste content here — LLM responses, code blocks, article text, chat transcripts.\n\nAnything with explanations or code will be extracted automatically.\n\nDrag & drop also works."}
              autoFocus
              disabled={status === 'submitting'}
              style={{
                width:'100%', minHeight:'280px', resize:'vertical',
                background:'transparent', border:'none', outline:'none',
                fontFamily:'var(--mono)', fontSize:'12.5px', lineHeight:'1.7',
                color:'var(--text)', padding:'16px 14px',
                letterSpacing:'0.01em',
              }}
            />
          </div>

          {/* Metadata row */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em'}}>SOURCE URL</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={status==='submitting'}
                style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'3px',padding:'9px 12px',fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text)',outline:'none',transition:'border-color 0.15s'}}
                onFocus={e => e.currentTarget.style.borderColor='var(--border-hi)'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em'}}>PROJECT</label>
              <select
                value={project}
                onChange={e => setProject(e.target.value)}
                disabled={status==='submitting'}
                style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'3px',padding:'9px 12px',fontFamily:'var(--mono)',fontSize:'11px',color:project?'var(--text)':'var(--muted)',outline:'none',appearance:'none',cursor:'pointer'}}
              >
                {PROJECTS.map(p => <option key={p} value={p} style={{background:'var(--bg)'}}>{p || '— none —'}</option>)}
              </select>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em'}}>TAGS <span style={{color:'var(--muted)'}}>comma-sep</span></label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="rdti, supabase, bridge"
                disabled={status==='submitting'}
                style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'3px',padding:'9px 12px',fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text)',outline:'none',transition:'border-color 0.15s'}}
                onFocus={e => e.currentTarget.style.borderColor='var(--border-hi)'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <label style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em'}}>NOTES</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="optional context"
                disabled={status==='submitting'}
                style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'3px',padding:'9px 12px',fontFamily:'var(--mono)',fontSize:'11px',color:'var(--text)',outline:'none',transition:'border-color 0.15s'}}
                onFocus={e => e.currentTarget.style.borderColor='var(--border-hi)'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
              />
            </div>
          </div>

          {/* Submit */}
          <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
            <button
              onClick={submit}
              disabled={!text.trim() || status==='submitting' || status==='done'}
              style={{
                fontFamily:'var(--mono)', fontSize:'11px', letterSpacing:'0.2em',
                background: text.trim() && status==='idle' ? 'var(--amber)' : 'var(--surface)',
                color: text.trim() && status==='idle' ? '#000' : 'var(--muted)',
                border:`1px solid ${text.trim() && status==='idle' ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius:'3px', padding:'11px 28px', cursor: text.trim() ? 'pointer' : 'default',
                transition:'all 0.15s', textTransform:'uppercase',
                opacity: status==='submitting' ? 0.6 : 1,
              }}
            >
              {status==='submitting' ? 'QUEUEING...' : status==='done' ? 'QUEUED ✓' : 'DROP INTO QUEUE'}
            </button>
            <span style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)'}}>
              ⌘↵ to submit
            </span>
            {status==='idle' && text && (
              <button onClick={reset} style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:'10px',color:'var(--muted)',background:'none',border:'none',cursor:'pointer',letterSpacing:'0.1em'}}>
                CLEAR
              </button>
            )}
          </div>
        </main>

        {/* Right sidebar — history */}
        <aside style={{width:'240px',borderLeft:'1px solid var(--border)',padding:'20px 16px',display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.2em',marginBottom:'4px'}}>RECENT DROPS</div>
          {history.length === 0 ? (
            <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--border-hi)',lineHeight:'1.8'}}>
              —<br/>nothing yet
            </div>
          ) : history.map(h => (
            <div key={h.id} style={{borderLeft:'2px solid var(--amber-dim)',paddingLeft:'10px',animation:'fadeUp 0.3s ease'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--amber)',marginBottom:'2px'}}>{h.proj}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-dim)'}}>{h.chars.toLocaleString()} chars</div>
              <div style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--muted)'}}>{h.ts}</div>
            </div>
          ))}

          <div style={{marginTop:'auto',borderTop:'1px solid var(--border)',paddingTop:'16px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.15em',marginBottom:'10px'}}>PIPELINE</div>
            {['INTAKE','CLAIM','EXTRACT','PERSIST'].map((step, i) => (
              <div key={step} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 6px var(--green)',flexShrink:0}} />
                <span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--text-dim)',letterSpacing:'0.1em'}}>{step}</span>
              </div>
            ))}
            <div style={{marginTop:'12px',fontFamily:'var(--mono)',fontSize:'9px',color:'var(--muted)',lineHeight:'1.7'}}>
              Worker polls every 5m.<br/>
              Artifacts in ≤5min.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
