'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Code2, GitBranch, Highlighter, MessageCircle, MousePointer2, Pencil, Play, Plus, RotateCcw, Sparkles, X } from 'lucide-react'

type Tool = 'select' | 'point' | 'circle'
type Line = { no: number; code: string; label: string; explain: string; question: string }
type Thread = { id: number; prompt: string; answer: string; lines: number[] }

const sampleCode = `function recommend(history) {
  const totals = history.reduce((sum, item) => {
    sum[item.category] = (sum[item.category] || 0) + item.minutes
    return sum
  }, {})

  const favorite = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])[0][0]

  return { suggestion: favorite, reason: totals[favorite] }
}`

const explanations: Record<number, Omit<Line, 'no' | 'code'>> = {
  1: { label: 'The promise', explain: 'This function expects a list of activities and promises to recommend one category. Nothing has been chosen yet.', question: 'What does this function need as input?' },
  2: { label: 'Start a tally', explain: 'reduce walks through every activity. sum is the running notebook; item is the activity currently being read.', question: 'Why use reduce here?' },
  3: { label: 'Use the category as a key', explain: 'The category becomes a label in the totals object, like “Leisure” or “Work”. This is where raw history becomes grouped evidence.', question: 'What happens if a category is missing?' },
  4: { label: 'Add the minutes', explain: 'The old total is read, then this activity’s minutes are added. The fallback 0 means the first activity in a category can still be counted.', question: 'Why is there a || 0?' },
  5: { label: 'Keep the notebook', explain: 'Returning sum passes the updated tally to the next activity. Without this return, the next loop would lose the work so far.', question: 'What breaks if return is removed?' },
  8: { label: 'Rank the evidence', explain: 'Object.entries turns the tally into pairs. sort puts the largest total first by comparing each pair’s minutes.', question: 'Is sorting changing the original history?' },
  9: { label: 'Pick the winner', explain: '[0] means “take the first pair”. [0] again means “take its category”. This is the exact decision line.', question: 'What if two categories tie?' },
  11: { label: 'Explain the recommendation', explain: 'The function returns both the winner and its supporting number, so another screen can show not only what to try but why.', question: 'Where would this result be displayed?' },
}

export default function Page() {
  const [code, setCode] = useState(sampleCode)
  const [selectedLine, setSelectedLine] = useState(8)
  const [tool, setTool] = useState<Tool>('select')
  const [analyzed, setAnalyzed] = useState(true)
  const [threads, setThreads] = useState<Thread[]>([])
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [circle, setCircle] = useState<{x:number;y:number;w:number;h:number} | null>(null)
  const [drawing, setDrawing] = useState(false)
  const circleStart = useRef<{x:number;y:number} | null>(null)
  const lines = useMemo(() => code.split('\n'), [code])
  const detail = explanations[selectedLine] ?? { label: 'Read this line', explain: 'Select a line with a clear job and Mould will translate it into plain engineering language.', question: 'What should I look at next?' }

  function answerFor(prompt: string) {
    if (prompt.toLowerCase().includes('tie')) return 'If two categories have the same total, sort has no explicit tie-breaker. JavaScript keeps their order, so the first one encountered wins. An engineer might add a second comparison if that matters.'
    if (prompt.toLowerCase().includes('reduce')) return 'reduce is useful because it turns many activity records into one compact summary. Think of it as one notebook that gets updated once per activity.'
    if (prompt.toLowerCase().includes('break')) return 'Without return sum, the next loop receives undefined. The tally disappears after the first activity, so the recommendation cannot be trusted.'
    if (prompt.toLowerCase().includes('missing')) return 'A missing category becomes the key undefined. Production code would usually validate the input before this function starts.'
    return `Line ${selectedLine} is the part you pointed at. ${detail.explain} In a real system, this is where you would check the assumption before shipping.`
  }
  function ask(prompt = question) {
    const clean = prompt.trim(); if (!clean) return
    setThreads(t => [...t, { id: Date.now(), prompt: clean, answer: answerFor(clean), lines: [selectedLine] }])
    setQuestion('')
  }
  function analyze() { setAnalyzed(false); window.setTimeout(() => setAnalyzed(true), 500) }
  function reset() { setCode(sampleCode); setSelectedLine(8); setTool('select'); setThreads([]); setCircle(null); setNote(''); setAnalyzed(true) }
  function selectLine(no: number) { setSelectedLine(no); setCircle(null) }
  function startCircle(e: React.PointerEvent) { if (tool !== 'circle') return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); circleStart.current = { x: e.clientX-r.left, y: e.clientY-r.top }; setDrawing(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  function moveCircle(e: React.PointerEvent) { if (!drawing || !circleStart.current) return; const r=(e.currentTarget as HTMLElement).getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top,s=circleStart.current; setCircle({x:Math.min(s.x,x),y:Math.min(s.y,y),w:Math.abs(x-s.x),h:Math.abs(y-s.y)}) }
  function endCircle() { setDrawing(false); circleStart.current=null }

  return <main className="mould-app">
    <header className="app-bar"><div className="wordmark"><span className="mark"><GitBranch /></span><b>mould</b><small>code, made visible</small></div><div className="bar-center"><span className="live"/> LIVE SESSION <span className="slash">/</span> Untitled analysis</div><div className="bar-actions"><button onClick={reset} aria-label="Reset session"><RotateCcw/></button><button className="avatar">J</button></div></header>
    <section className="hero"><div><p className="eyebrow"><Sparkles/> A code conversation</p><h1>Point at the part<br/><em>you don&apos;t understand.</em></h1><p className="hero-copy">Paste code on the left. Select a line, point to it, or circle a group. Mould keeps the engineer&apos;s explanation attached to your question.</p></div><div className="analyze-status"><span className={analyzed?'status-dot ready':'status-dot'}/>{analyzed?'Code mapped':'Reading code…'}<button onClick={analyze} disabled={!analyzed}><Play/> Analyze</button></div></section>
    <section className="workspace">
      <div className="code-pane widget"><div className="pane-head"><div><span className="pane-label">Widget 01 · Source</span><h2>Your code</h2></div><span className="js-badge">JS</span></div><div className="instruction">Start here. Click a line number, or use Point / Circle to ask about a precise part.</div><div className="code-toolbar"><button className={tool==='select'?'tool-active':''} onClick={()=>setTool('select')}><MousePointer2/> Select</button><button className={tool==='point'?'tool-active':''} onClick={()=>setTool('point')}><Highlighter/> Point</button><button className={tool==='circle'?'tool-active':''} onClick={()=>setTool('circle')}><CircleHelp/> Circle</button><span/><button onClick={()=>setNote(note?'':`Review line ${selectedLine}`)}><Plus/> Note</button></div><div className="editor"><div className="line-numbers">{lines.map((_,i)=><button key={i} className={selectedLine===i+1?'line-active':''} onClick={()=>selectLine(i+1)}>{String(i+1).padStart(2,'0')}</button>)}</div><textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false} aria-label="Paste or edit code"/></div><div className="code-foot"><span>{lines.length} lines · editable</span><span>{tool==='circle'?'Drag around lines to circle them':tool==='point'?'Click a line to pin a question':'Select a line to inspect it'}</span></div>{note&&<div className="inline-note"><Pencil/> {note}<button onClick={()=>setNote('')} aria-label="Remove note"><X/></button></div>}</div>
      <div className="explain-pane widget"><div className="pane-head"><div><span className="pane-label">Widget 02 · Engineer&apos;s view</span><h2>Ask about your selection</h2></div><span className="map-meta">line {selectedLine}</span></div><div className="selected-context"><span className="context-line">{String(selectedLine).padStart(2,'0')}</span><div><b>{detail.label}</b><code>{lines[selectedLine-1] || '// choose a line'}</code></div><span className="tether-dot"/></div><div className="explain-body"><span className="plain-label">In plain English</span><p>{detail.explain}</p><div className="decision-strip"><span>Why an engineer cares</span><b>{selectedLine === 9 ? 'This is the decision point.' : 'This line changes what the program knows.'}</b></div></div><div className="thread"><div className="thread-head"><MessageCircle/> Your questions <span>{threads.length}</span></div>{threads.length===0?<div className="empty-thread"><span>Ask anything about line {selectedLine}.</span><small>Try the prompt below. The answer will stay attached to this selection.</small></div>:threads.map(t=><div className="thread-item" key={t.id}><div className="you">You · line {t.lines.join(', ')}</div><b>{t.prompt}</b><p><span className="eng-dot"/> {t.answer}</p></div>)}<div className="question-row"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)ask()}} placeholder="Ask the engineer…" aria-label="Ask the engineer"/><button onClick={()=>ask()} aria-label="Send question"><ArrowRight/></button></div></div></div>
    </section>
    <section className="below"><div className="quick-card"><span className="pane-label">Suggested questions for this line</span><div className="quick-list"><button onClick={()=>ask(detail.question)}>{detail.question}<ArrowRight/></button><button onClick={()=>ask('What could go wrong here?')}>What could go wrong here?<ArrowRight/></button><button onClick={()=>ask('Explain this without code words')}>Explain this without code words<ArrowRight/></button></div></div><div className="map-card"><div className="map-card-head"><span className="pane-label">Live relationship</span><span>updates as you select</span></div><div className="relationship"><span>your line</span><b>→</b><strong>{detail.label}</strong><b>→</b><span>program decision</span></div><p>There are no generic cards here. Every explanation is anchored to the line you selected.</p></div></section>
    <footer className="footer-note"><span><Code2/> Mould translates engineering decisions into a conversation.</span><span>Hackathon prototype · local session</span></footer>
  </main>
}
