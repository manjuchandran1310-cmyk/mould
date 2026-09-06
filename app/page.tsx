'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Code2, GitBranch, Highlighter, MessageCircle, MousePointer2, Pencil, Play, Plus, RotateCcw, Sparkles, X } from 'lucide-react'

type Tool = 'select' | 'point'
type Level = 'beginner' | 'familiar' | 'advanced'
type View = 'explainer' | 'playground'
type Stroke = { points: { x: number; y: number }[] }
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
  const [selectedRange, setSelectedRange] = useState<[number, number]>([8, 8])
  const [level, setLevel] = useState<Level>('beginner')
  const [tool, setTool] = useState<Tool>('select')
  const [view, setView] = useState<View>('explainer')
  const [analyzed, setAnalyzed] = useState(true)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [drawingStroke, setDrawingStroke] = useState<Stroke | null>(null)
  const [featureBrief, setFeatureBrief] = useState('Save a favorite from a list')
  const [playMode, setPlayMode] = useState<'story' | 'trace' | 'change' | 'break'>('story')
  const [isRunning, setIsRunning] = useState(false)
  const [playResult, setPlayResult] = useState('')
  const [goal, setGoal] = useState<'story' | 'trace' | 'change' | 'break'>('story')
  const [modelInput, setModelInput] = useState('activity = { category: "Work", minutes: 45 }')
  const [modelOutput, setModelOutput] = useState('Run Analyze to see the value move through the selected code.')
  const [isModelRunning, setIsModelRunning] = useState(false)
  const [marks, setMarks] = useState<Mark[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [pointing, setPointing] = useState(false)
  const [pointReady, setPointReady] = useState(false)
  const [pointStart, setPointStart] = useState<number | null>(null)
  const lines = useMemo(() => code.split('\n'), [code])
  function inferDetail(no: number): Omit<Line, 'no' | 'code'> {
    const text = (lines[no - 1] || '').trim()
    if (!text) return { label: 'Blank line', explain: 'This line separates ideas or creates breathing room. It does not change the program by itself.', why: 'Whitespace helps a reader see the structure of the program.', risk: 'Nothing happens here until code is added.', question: 'Which nearby line should I inspect?' }
    if (/^(function|const .*=>|async |export )/.test(text)) return { label: 'Define a reusable step', explain: `This line introduces a piece of behavior named ${text.match(/(?:function|const)\s+([\w$]+)/)?.[1] || 'this code'}. Other code can call it instead of repeating the same work.`, why: 'A clear boundary makes this behavior easier to test and reuse.', risk: 'The function can still fail if callers pass unexpected data.', question: 'What goes into this function and what comes out?' }
    if (/return\b/.test(text)) return { label: 'Send a result back', explain: 'return stops this function and hands a value back to whoever called it. Follow that value to understand the output of this snippet.', why: 'This is the point where internal work becomes useful to the rest of the app.', risk: 'Returning the wrong shape can break every caller that relies on it.', question: 'Where does this returned value go next?' }
    if (/\.(map|filter|reduce|find|some|every|sort)\s*\(/.test(text)) return { label: 'Transform a collection', explain: `This line uses ${text.match(/\.(map|filter|reduce|find|some|every|sort)/)?.[1] || 'a collection method'} to process a list. It reads items and creates, keeps, or orders a result.`, why: 'Collection operations are often where raw data becomes something a user can see.', risk: 'Empty lists, unexpected item shapes, or expensive loops can change the result.', question: 'What does one item look like at this point?' }
    if (/\bif\b|\?|&&|\|\|/.test(text)) return { label: 'Make a decision', explain: 'This line checks a condition and chooses which value or path to use. Read the expression as a question: “is this true?”', why: 'This is an assumption that controls what users eventually see.', risk: 'A surprising value can send execution down the wrong path.', question: 'What happens when this condition is false?' }
    if (/\b(import|from|require)\b/.test(text)) return { label: 'Bring in a dependency', explain: 'This line makes code from another file or package available here. The snippet depends on that external behavior.', why: 'Dependencies define capabilities this file does not implement itself.', risk: 'A missing or changed dependency can stop the code before it runs.', question: 'What does this dependency provide?' }
    if (/\b(console|log|debug)\b/.test(text)) return { label: 'Observe the program', explain: 'This line writes information for a developer to inspect while the code runs. It helps reveal actual values and timing.', why: 'Observability makes invisible program state easier to debug.', risk: 'Sensitive data or noisy logs should not leak into production.', question: 'What value is this trying to reveal?' }
    return { label: 'Change the program state', explain: `This line reads or changes a value: “${text}”. Trace the names on the line to see what information enters and leaves it.`, why: 'Most code is a series of small state changes that build the final result.', risk: 'An unexpected value here can affect every later line.', question: 'What values does this line depend on?' }
  }
  const detail = inferDetail(selectedLine)
  const wholeCode = useMemo(() => {
    const clean = code.trim()
    if (!clean) return 'Paste code on the left and Analyze it to get a plain-language walkthrough.'
    const count = lines.filter(line => line.trim()).length
    const hasInput = /function|=>|\bconst\b|\bclass\b/.test(clean)
    const behavior = /fetch|axios|http|api/i.test(clean) ? 'calls a service' : /map|filter|reduce|sort|find/.test(clean) ? 'transforms a collection of data' : /if|switch|\?/.test(clean) ? 'makes decisions based on conditions' : 'reads and changes values'
    return `This ${hasInput ? 'snippet' : 'piece of code'} has ${count} active lines. At a high level, it ${behavior}; the selected lines show one part of that flow.`
  }, [code, lines])
  const levelCopy: Record<Level, string> = {
    beginner: 'No code knowledge needed. Start with the story: what goes in, what changes, and what comes out.',
    familiar: 'You know basic functions and objects. Focus on the data shape and the assumptions behind each step.',
    advanced: 'Inspect trade-offs: complexity, invalid inputs, tie-breaking, and what would change in production.',
  }
  const levelExplain = level === 'beginner' ? detail.explain : level === 'familiar' ? `${detail.explain} The important data flow is visible in the selected range: values are read, transformed, and passed to the next decision.` : `${detail.explain} Review the contract, edge cases, and whether this decision is deterministic enough for production. ${detail.risk}`
  const codeKind = /fetch|axios|http/i.test(code) ? 'request flow' : /map|filter|reduce|sort/i.test(code) ? 'collection flow' : /if|switch|\?|&&|\|\|/.test(code) ? 'decision flow' : /useState|setState|className|<\w+/.test(code) ? 'interface flow' : 'value flow'
  const modelSteps = codeKind === 'request flow' ? ['request', 'response', 'state'] : codeKind === 'collection flow' ? ['items', 'transform', 'result'] : codeKind === 'decision flow' ? ['input', 'condition', 'path'] : codeKind === 'interface flow' ? ['event', 'state', 'screen'] : ['input', 'change', 'output']

  function answerFor(prompt: string) {
    if (prompt.toLowerCase().includes('tie')) return 'If two categories have the same total, sort has no explicit tie-breaker. JavaScript keeps their order, so the first one encountered wins. An engineer might add a second comparison if that matters.'
    if (prompt.toLowerCase().includes('reduce')) return 'reduce is useful because it turns many activity records into one compact summary. Think of it as one notebook that gets updated once per activity.'
    if (prompt.toLowerCase().includes('break')) return 'Without return sum, the next loop receives undefined. The tally disappears after the first activity, so the recommendation cannot be trusted.'
    if (prompt.toLowerCase().includes('missing')) return 'A missing category becomes the key undefined. Production code would usually validate the input before this function starts.'
    const rangeText = selectedRange[0] === selectedRange[1] ? `line ${selectedLine}` : `lines ${selectedRange[0]}–${selectedRange[1]}`
    return `${rangeText} is the part you pointed at. ${detail.explain} The key thing to verify is: ${detail.risk}`
  }
  function ask(prompt = question) {
    const clean = prompt.trim(); if (!clean) return
    setThreads(t => [...t, { id: Date.now(), prompt: clean, answer: answerFor(clean), lines: [selectedLine] }])
    setQuestion('')
  }
  function analyze() { setAnalyzed(false); setIsModelRunning(true); window.setTimeout(() => { setAnalyzed(true); setIsModelRunning(false); setModelOutput(goal === 'story' ? 'The program reads this value, groups it with similar items, and returns a result another screen can show.' : goal === 'trace' ? 'Input → line ' + selectedLine + ' → transformed value → returned output. The highlighted line is the current hand-off.' : goal === 'change' ? 'Changing the input changes the path: test empty, large, and unexpected values before calling this production-ready.' : 'Try an empty list, missing property, or failed request. These are the assumptions the current code does not guard yet.') }, 600) }
  function reset() { setCode(sampleCode); setSelectedLine(8); setSelectedRange([8, 8]); setLevel('beginner'); setTool('select'); setThreads([]); setNote(''); setMarks([]); setStrokes([]); setDrawingStroke(null); setAnalyzed(true); setPointing(false); setPointReady(false); setPointStart(null) }
  function selectLine(no: number, extend = false) {
    if (tool === 'point') { setSelectedLine(no); setSelectedRange([no, no]); setPointing(true); setPointStart(no); return }
    const range: [number, number] = extend ? [Math.min(selectedLine, no), Math.max(selectedLine, no)] : [no, no]
    setSelectedRange(range); setSelectedLine(no)
  }
  function startDrawing(event: React.PointerEvent<HTMLDivElement>) {
    if (tool !== 'point') return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setDrawingStroke({ points: [point] }); event.currentTarget.setPointerCapture(event.pointerId)
  }
  function draw(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingStroke) return
    const rect = event.currentTarget.getBoundingClientRect()
    setDrawingStroke({ points: [...drawingStroke.points, { x: event.clientX - rect.left, y: event.clientY - rect.top }] })
  }
  function finishDrawing() { if (drawingStroke && drawingStroke.points.length > 3) setStrokes(s => [...s, drawingStroke]); setDrawingStroke(null) }
  function finishPoint(no: number) { setSelectedRange([Math.min(pointStart ?? no, no), Math.max(pointStart ?? no, no)]); setSelectedLine(no); setPointing(false); setPointReady(true); setPointStart(null) }
  function askAboutPoint() { ask(`Explain the highlighted code from lines ${selectedRange[0]}–${selectedRange[1]} in simple terms.`) }
  function runPlayground() {
    setIsRunning(true)
    window.setTimeout(() => {
      const idea = featureBrief.trim() || 'this feature'
      const results: Record<typeof playMode, string> = {
        story: `A person wants to ${idea.toLowerCase()}. The product needs a clear action, feedback that it worked, and a way to remember the choice.`,
        trace: `The shared decision is the data shape: { userId, itemId, savedAt }. Design owns the moment of intent; engineering owns persistence and failure states.`,
        change: `If the user is offline, keep the optimistic UI but show “Will sync when you’re back.” This preserves confidence without pretending the save succeeded.`,
        break: `Ask what happens when the item is already saved, the request fails, or two tabs disagree. Those are the edges worth agreeing on before handoff.`,
      }
      setPlayResult(results[playMode]); setIsRunning(false)
    }, 500)
  }

  return <main className="mould-app">
    <header className="app-bar"><div className="wordmark"><span className="mark"><GitBranch /></span><b>mould</b><small>code, made visible</small></div><div className="bar-center"><span className="live"/> LIVE SESSION <span className="slash">/</span> {view === 'explainer' ? 'Code explainer' : 'Design ↔ engineering playground'}</div><nav className="view-switcher" aria-label="Workspace"><button className={view==='explainer'?'view-active':''} onClick={()=>setView('explainer')}>Explain code</button><button className={view==='playground'?'view-active':''} onClick={()=>setView('playground')}>Playground</button></nav><div className="bar-actions"><button onClick={reset} aria-label="Reset session"><RotateCcw/></button><button className="avatar">J</button></div></header>
    <section className="hero"><div><p className="eyebrow"><Sparkles/> A code conversation</p><h1>Point at the part<br/><em>you don&apos;t understand.</em></h1><p className="hero-copy">Paste code on the left. Select a range, or switch to Point and drag across the lines you want explained. Mould keeps the engineer&apos;s explanation attached to your question.</p></div><div className="analyze-status"><span className={analyzed?'status-dot ready':'status-dot'}/>{analyzed?'Code mapped':'Reading code…'}<button onClick={analyze} disabled={!analyzed}><Play/> Analyze</button></div></section>
    {view === 'explainer' ? <section className="workspace">
      <div className="code-pane widget"><div className="pane-head"><div><span className="pane-label">Source · editable</span><h2>Your code</h2></div><span className="js-badge">JS</span></div><div className="instruction">Start with the story, then point at the exact line where you get stuck.</div><div className="code-toolbar"><button type="button" className={tool==='select'?'tool-active':''} onClick={()=>{setTool('select');setPointing(false)}}><MousePointer2/> Select <small>range</small></button><button type="button" className={tool==='point'?'tool-active':''} onClick={()=>{setTool('point');setPointing(false)}}><Highlighter/> Point <small>draw</small></button><span/><button onClick={reset}><RotateCcw/> Reset</button></div><div className="editor"><div className="line-numbers">{lines.map((_,i)=><button key={i} className={i+1>=selectedRange[0]&&i+1<=selectedRange[1]?'line-active':''} onPointerDown={()=>{if(tool==='point'){setPointing(true);setPointStart(i+1)}}} onPointerEnter={()=>{if(tool==='point'&&pointing) setSelectedRange([Math.min(pointStart??i+1,i+1),Math.max(pointStart??i+1,i+1)])}} onPointerUp={()=>{if(tool==='point') finishPoint(i+1)}} onClick={(event)=>selectLine(i+1,event.shiftKey)}>{String(i+1).padStart(2,'0')}</button>)}</div><textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false} aria-label="Paste or edit code"/><div className={`ink-layer ${tool==='point'?'ink-active':''}`} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} aria-label="Point and draw over code">{[...strokes, ...(drawingStroke?[drawingStroke]:[])].map((stroke,index)=><svg key={index} className="ink-stroke" aria-hidden="true"><polyline points={stroke.points.map(point=>`${point.x},${point.y}`).join(' ')}/></svg>)}</div></div><div className="code-foot"><span>{lines.length} lines · editable</span><span>{tool==='point'?'Drag across line numbers to highlight a range':'Click one line to explain it; Shift-click another line to explain the range'}</span></div>{note&&<div className="inline-note"><Pencil/> {note}<button onClick={()=>setNote('')} aria-label="Remove note"><X/></button></div>}</div>
      <div className="explain-pane widget"><div className="pane-head"><div><span className="pane-label">Live model · code understanding</span><h2>Understand the code</h2></div><span className="map-meta">lines {selectedRange[0]}–{selectedRange[1]}</span></div><div className="level-tabs" aria-label="Explanation level">{(['beginner','familiar','advanced'] as Level[]).map(item=><button type="button" key={item} aria-pressed={level===item} className={level===item?'level-active':''} onClick={(event)=>{event.stopPropagation();setLevel(item)}}>{item}</button>)}</div><div className="whole-code"><span className="plain-label">What this whole snippet does</span><p>{wholeCode}</p><small>{levelCopy[level]}</small></div><div className="selected-context"><span className="context-line">{selectedRange[0] === selectedRange[1] ? String(selectedLine).padStart(2,'0') : `${selectedRange[0]}–${selectedRange[1]}`}</span><div><b>{selectedRange[0] === selectedRange[1] ? detail.label : 'A connected block of code'}</b><code>{lines.slice(selectedRange[0]-1, selectedRange[1]).join(' ').trim() || '// choose lines'}</code></div><span className="tether-dot"/></div>{tool==='point'&&(pointing||pointReady)&&<div className="point-overlay"><b>{pointing?'Point mode':'Range selected'}</b><span>{pointing?'Drag across line numbers to highlight.':'Ask a question about the highlighted code.'}</span>{pointReady&&<button type="button" onClick={()=>{setPointReady(false);askAboutPoint()}}>Ask about this</button>}</div>}<div className="visual-model"><div className="model-head"><div><span className="plain-label">Live model · {codeKind}</span><b>{goal === 'story' ? 'What the code is trying to do' : goal === 'trace' ? 'Follow one value through the code' : goal === 'change' ? 'Change the input and predict the output' : 'Find the assumption that can break'}</b></div><span className={isModelRunning?'model-status running':'model-status'}>{isModelRunning?'mapping…':'mapped from your code'}</span></div><div className="model-tabs">{([['story','Story'],['trace','Trace'],['change','Change preview'],['break','Break it']] as const).map(([key,label])=><button type="button" className={goal===key?'model-tab-active':''} onClick={()=>{setGoal(key);setModelOutput('Run Analyze to update this view.')}} key={key}>{label}</button>)}</div><div className="model-flow">{modelSteps.map((step,index)=><div className="model-step" key={step}><span>{index+1}</span><b>{step}</b>{index<modelSteps.length-1&&<ArrowRight/>}</div>)}</div><div className="model-input"><label htmlFor="model-input">Try a value</label><input id="model-input" value={modelInput} onChange={e=>setModelInput(e.target.value)}/><button type="button" onClick={analyze}><Play/> Run</button></div><p className="model-output">{modelOutput}</p><div className="model-badges"><span><Check/> Verified: line {selectedLine} is connected</span><span>Inferred: edge cases need your review</span></div></div><div className="explain-body"><span className="plain-label">This line, explained</span><p>{selectedRange[0] === selectedRange[1] ? levelExplain : `These ${selectedRange[1] - selectedRange[0] + 1} lines work together: ${levelExplain}`}</p><div className="decision-strip"><span>Why this matters in a real product</span><b>{detail.why}</b></div><div className="risk-row"><span>What could go wrong</span><p>{detail.risk}</p></div></div><div className="thread"><div className="thread-head"><MessageCircle/> Your questions <span>{threads.length}</span></div>{threads.length===0?<div className="empty-thread"><span>Ask anything about line {selectedLine}.</span><small>Try the prompt below. The answer will stay attached to this selection.</small></div>:threads.map(t=><div className="thread-item" key={t.id}><div className="you">You · line {t.lines.join(', ')}</div><b>{t.prompt}</b><p><span className="eng-dot"/> {t.answer}</p></div>)}<div className="suggestions"><span className="plain-label">Questions you can ask about line {selectedLine}</span><div className="quick-list"><button onClick={()=>ask(detail.question)}>{detail.question}<ArrowRight/></button><button onClick={()=>ask('What could go wrong here?')}>What could go wrong here?<ArrowRight/></button><button onClick={()=>ask('Explain this without code words')}>Explain this without code words<ArrowRight/></button></div></div><div className="question-row"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)ask()}} placeholder={`Ask about line ${selectedLine}…`} aria-label="Ask the engineer"/><button onClick={()=>ask()} aria-label="Send question"><ArrowRight/></button></div></div></div>
    </section>
    : <section className="playground"><div className="playground-header"><div><span className="pane-label">Playground · make a handoff</span><h2>Bring a real feature. See where design and engineering meet.</h2><p>Describe the feature in your own words. Mould turns it into the questions, data, and edge cases both people can work on together.</p></div><button className="run-button" onClick={runPlayground} disabled={isRunning}><Play/> {isRunning?'Working…':'Run playground'}</button></div><div className="playground-input"><label htmlFor="feature-brief">What are you building?</label><textarea id="feature-brief" value={featureBrief} onChange={e=>{setFeatureBrief(e.target.value);setPlayResult('')}} placeholder="e.g. Let users save a favorite article"/><div className="example-row"><span>Try an example:</span><button onClick={()=>setFeatureBrief('Invite a teammate to a project')}>Invite a teammate</button><button onClick={()=>setFeatureBrief('Show a helpful empty state')}>Empty state</button><button onClick={()=>setFeatureBrief('Let users undo a deletion')}>Undo delete</button></div></div><div className="playground-tabs">{([['story','User story'],['trace','Shared data'],['change','Change it'],['break','Break it']] as const).map(([key,label])=><button key={key} className={playMode===key?'play-tab-active':''} onClick={()=>{setPlayMode(key);setPlayResult('')}}>{label}</button>)}</div><div className="playground-result"><div className="result-map"><div className="result-node"><span>Design intent</span><b>{featureBrief || 'Your feature'}</b></div><ArrowRight/><div className="result-node"><span>Shared decision</span><b>{playMode==='story'?'What should the user feel?':playMode==='trace'?'What data must exist?':playMode==='change'?'What changes in the UI?':'What can fail?'}</b></div><ArrowRight/><div className="result-node"><span>Engineering handoff</span><b>{playMode==='break'?'Agree on edge cases':'A testable next step'}</b></div></div><div className="result-copy">{playResult ? <><span className="pane-label">Mould says</span><p>{playResult}</p></> : <><span className="pane-label">Your result will appear here</span><p>Choose a lens, then run the playground. This is where the vague idea becomes a shared decision.</p></>}</div></div><div className="question-dock"><span className="pane-label">Continue the conversation</span><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask what to clarify with engineering…"/><button onClick={()=>{setView('explainer');setQuestion(question || 'What should I clarify before handing this off?')}}>Ask Mould <ArrowRight/></button></div></section>}
    <section className="below"><div className="use-case-card"><span className="pane-label">Why this example matters</span><p>This pattern appears in recommendation feeds, activity dashboards, and “most used” summaries. Mould helps you see the assumption behind the output before you reuse it.</p></div><div className="map-card"><div className="map-card-head"><span className="pane-label">How to use Mould</span><span>three simple moves</span></div><div className="relationship"><span>1 · read the story</span><b>→</b><strong>2 · point at a line</strong><b>→</b><span>3 · ask why</span></div><p>The right panel is not a second static diagram. It is the explanation and conversation for the exact code you selected.</p></div></section>
    <footer className="footer-note"><span><Code2/> Mould translates engineering decisions into a conversation.</span><span>Hackathon prototype · local session</span></footer>
  </main>
}
