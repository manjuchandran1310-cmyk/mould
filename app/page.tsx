'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Code2, GitBranch, Highlighter, MessageCircle, MousePointer2, Pencil, Play, Plus, RotateCcw, Sparkles, X } from 'lucide-react'

type Tool = 'select' | 'point' | 'circle' | 'note'
type Level = 'beginner' | 'familiar' | 'engineer'
type Line = { no: number; code: string; label: string; explain: string; question: string; why: string; risk: string }
type Thread = { id: number; prompt: string; answer: string; lines: number[] }

type Mark = { id: number; tool: 'point' | 'circle' | 'note'; line: number; text?: string }

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
  1: { label: 'The function boundary', explain: 'This creates a reusable recipe called recommend. It accepts history: a list of activity objects, then returns one suggested category and the minutes behind it.', why: 'Knowing the input and output lets you use this code safely in another screen or API.', risk: 'If history is empty or has the wrong shape, later lines may fail.', question: 'What shape must history have?' },
  2: { label: 'Build one summary', explain: 'reduce visits every activity and compresses the list into one totals object. sum is the running summary; item is the current activity.', why: 'This is efficient because the recommendation only needs totals, not the full history after this step.', risk: 'A bad item can poison the summary for every later decision.', question: 'Why use reduce here?' },
  3: { label: 'Group by category', explain: 'The category becomes a property name, such as totals.Work or totals.Leisure. This turns separate records into comparable buckets.', why: 'The grouping rule defines what the program considers similar.', risk: 'Spelling or casing differences can create accidental duplicate categories.', question: 'What happens if a category is missing?' },
  4: { label: 'Accumulate minutes', explain: 'Read the category’s current total, use 0 when it has not appeared yet, and add this activity’s minutes.', why: 'The fallback is what makes the first activity in a new category work.', risk: 'Non-numeric minutes can make the total become NaN.', question: 'Why is there a || 0?' },
  5: { label: 'Pass the summary forward', explain: 'Returning sum gives the updated totals object to the next loop iteration. It is the hand-off that keeps previous work alive.', why: 'Without this return, reduce cannot build a complete result.', risk: 'Remove it and the next iteration receives undefined.', question: 'What breaks if return is removed?' },
  8: { label: 'Order the evidence', explain: 'Convert the totals object into category/value pairs, then sort those pairs from the largest minute total to the smallest.', why: 'Ranking makes the next line’s choice explicit instead of arbitrary.', risk: 'The original totals object is not ordered; this creates a new ranked list.', question: 'Is sorting changing the original history?' },
  9: { label: 'Choose the recommendation', explain: 'Take the first ranked pair, then take its category. This is where the program turns evidence into a recommendation.', why: 'This is the highest-impact decision: changing the sort changes what the user gets recommended.', risk: 'A tie has no custom rule, so whichever pair appears first wins.', question: 'What if two categories tie?' },
  11: { label: 'Return an explainable result', explain: 'Return both the suggested category and its total minutes. The caller can show the recommendation and the evidence behind it.', why: 'Returning the reason makes the output inspectable instead of a black box.', risk: 'If the caller only displays suggestion, the evidence is lost from the interface.', question: 'Where would this result be displayed?' },
}

export default function Page() {
  const [code, setCode] = useState(sampleCode)
  const [selectedLine, setSelectedLine] = useState(8)
  const [level, setLevel] = useState<Level>('beginner')
  const [tool, setTool] = useState<Tool>('select')
  const [analyzed, setAnalyzed] = useState(true)
  const [marks, setMarks] = useState<Mark[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [circle, setCircle] = useState<{x:number;y:number;w:number;h:number} | null>(null)
  const [drawing, setDrawing] = useState(false)
  const circleStart = useRef<{x:number;y:number} | null>(null)
  const lines = useMemo(() => code.split('\n'), [code])
  const detail = explanations[selectedLine] ?? { label: 'Read this line', explain: 'Select a line with a clear job and Mould will translate it into plain engineering language.', why: 'This helps you connect syntax to the program’s behavior.', risk: 'The effect depends on the surrounding lines.', question: 'What should I look at next?' }
  const wholeCode = 'This snippet turns a person’s activity history into a recommendation. It adds minutes by category, ranks those categories, and returns the category with the most time plus the evidence used to choose it.'
  const levelCopy: Record<Level, string> = {
    beginner: 'No code knowledge needed. Start with the story: what goes in, what changes, and what comes out.',
    familiar: 'You know basic functions and objects. Focus on the data shape and the assumptions behind each step.',
    engineer: 'Inspect the trade-offs: complexity, invalid inputs, tie-breaking, and what would change in production.',
  }

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
  function reset() { setCode(sampleCode); setSelectedLine(8); setLevel('beginner'); setTool('select'); setThreads([]); setCircle(null); setNote(''); setMarks([]); setAnalyzed(true) }
  function selectLine(no: number) {
    setSelectedLine(no); setCircle(null)
    if (tool === 'point') setMarks(m => [...m, { id: Date.now(), tool: 'point', line: no }])
  }
  function addNote() {
    const text = window.prompt(`Note for line ${selectedLine}:`, note || `Review line ${selectedLine}`)
    if (!text?.trim()) return
    setNote(text.trim()); setMarks(m => [...m, { id: Date.now(), tool: 'note', line: selectedLine, text: text.trim() }])
  }
  function startCircle(e: React.PointerEvent) { if (tool !== 'circle') return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); circleStart.current = { x: e.clientX-r.left, y: e.clientY-r.top }; setDrawing(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  function moveCircle(e: React.PointerEvent) { if (!drawing || !circleStart.current) return; const r=(e.currentTarget as HTMLElement).getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top,s=circleStart.current; setCircle({x:Math.min(s.x,x),y:Math.min(s.y,y),w:Math.abs(x-s.x),h:Math.abs(y-s.y)}) }
  function endCircle() { setDrawing(false); circleStart.current=null }

  return <main className="mould-app">
    <header className="app-bar"><div className="wordmark"><span className="mark"><GitBranch /></span><b>mould</b><small>code, made visible</small></div><div className="bar-center"><span className="live"/> LIVE SESSION <span className="slash">/</span> Untitled analysis</div><div className="bar-actions"><button onClick={reset} aria-label="Reset session"><RotateCcw/></button><button className="avatar">J</button></div></header>
    <section className="hero"><div><p className="eyebrow"><Sparkles/> A code conversation</p><h1>Point at the part<br/><em>you don&apos;t understand.</em></h1><p className="hero-copy">Paste code on the left. Select a line, point to it, or circle a group. Mould keeps the engineer&apos;s explanation attached to your question.</p></div><div className="analyze-status"><span className={analyzed?'status-dot ready':'status-dot'}/>{analyzed?'Code mapped':'Reading code…'}<button onClick={analyze} disabled={!analyzed}><Play/> Analyze</button></div></section>
    <section className="workspace">
      <div className="code-pane widget"><div className="pane-head"><div><span className="pane-label">Widget 01 · Source</span><h2>Your code</h2></div><span className="js-badge">JS</span></div><div className="instruction">Start with the story, then point at the exact line where you get stuck.</div><div className="code-toolbar"><button className={tool==='select'?'tool-active':''} onClick={()=>setTool('select')}><MousePointer2/> Select <small>inspect</small></button><button className={tool==='point'?'tool-active':''} onClick={()=>setTool('point')}><Highlighter/> Point <small>pin</small></button><button className={tool==='circle'?'tool-active':''} onClick={()=>setTool('circle')}><CircleHelp/> Circle <small>group</small></button><span/><button className={tool==='note'?'tool-active':''} onClick={()=>{setTool('note'); addNote()}}><Plus/> Note <small>save</small></button></div><div className="editor"><div className="line-numbers">{lines.map((_,i)=><button key={i} className={selectedLine===i+1?'line-active':''} onClick={()=>selectLine(i+1)}>{String(i+1).padStart(2,'0')}</button>)}</div><textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false} aria-label="Paste or edit code"/></div><div className="code-foot"><span>{lines.length} lines · editable</span><span>{tool==='circle'?'Drag around lines to circle them':tool==='point'?'Click a line to pin a question':'Select a line to inspect it'}</span></div>{note&&<div className="inline-note"><Pencil/> {note}<button onClick={()=>setNote('')} aria-label="Remove note"><X/></button></div>}</div>
      <div className="explain-pane widget"><div className="pane-head"><div><span className="pane-label">Widget 02 · Engineer&apos;s view</span><h2>Understand the code</h2></div><span className="map-meta">line {selectedLine}</span></div><div className="level-tabs" aria-label="Explanation level">{(['beginner','familiar','engineer'] as Level[]).map(item=><button key={item} className={level===item?'level-active':''} onClick={()=>setLevel(item)}>{item}</button>)}</div><div className="whole-code"><span className="plain-label">What this whole snippet does</span><p>{wholeCode}</p><small>{levelCopy[level]}</small></div><div className="selected-context"><span className="context-line">{String(selectedLine).padStart(2,'0')}</span><div><b>{detail.label}</b><code>{lines[selectedLine-1] || '// choose a line'}</code></div><span className="tether-dot"/></div><div className="explain-body"><span className="plain-label">This line, explained</span><p>{detail.explain}</p><div className="decision-strip"><span>Why this matters in a real product</span><b>{detail.why}</b></div><div className="risk-row"><span>What could go wrong</span><p>{detail.risk}</p></div></div><div className="thread"><div className="thread-head"><MessageCircle/> Your questions <span>{threads.length}</span></div>{threads.length===0?<div className="empty-thread"><span>Ask anything about line {selectedLine}.</span><small>Try the prompt below. The answer will stay attached to this selection.</small></div>:threads.map(t=><div className="thread-item" key={t.id}><div className="you">You · line {t.lines.join(', ')}</div><b>{t.prompt}</b><p><span className="eng-dot"/> {t.answer}</p></div>)}<div className="suggestions"><span className="plain-label">Questions you can ask about line {selectedLine}</span><div className="quick-list"><button onClick={()=>ask(detail.question)}>{detail.question}<ArrowRight/></button><button onClick={()=>ask('What could go wrong here?')}>What could go wrong here?<ArrowRight/></button><button onClick={()=>ask('Explain this without code words')}>Explain this without code words<ArrowRight/></button></div></div><div className="question-row"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)ask()}} placeholder={`Ask about line ${selectedLine}…`} aria-label="Ask the engineer"/><button onClick={()=>ask()} aria-label="Send question"><ArrowRight/></button></div></div></div>
    </section>
    <section className="below"><div className="use-case-card"><span className="pane-label">Why this example matters</span><p>This pattern appears in recommendation feeds, activity dashboards, and “most used” summaries. Mould helps you see the assumption behind the output before you reuse it.</p></div><div className="map-card"><div className="map-card-head"><span className="pane-label">How to use Mould</span><span>three simple moves</span></div><div className="relationship"><span>1 · read the story</span><b>→</b><strong>2 · point at a line</strong><b>→</b><span>3 · ask why</span></div><p>The right panel is not a second static diagram. It is the explanation and conversation for the exact code you selected.</p></div></section>
    <footer className="footer-note"><span><Code2/> Mould translates engineering decisions into a conversation.</span><span>Hackathon prototype · local session</span></footer>
  </main>
}
