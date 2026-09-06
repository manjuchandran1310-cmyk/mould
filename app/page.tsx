'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Code2, GitBranch, Highlighter, MousePointer2, Pencil, Play, Plus, RotateCcw, Sparkles, X } from 'lucide-react'

type Tool = 'select' | 'point' | 'draw'
type Node = { id: string; title: string; kind: string; body: string; lines: number[]; x: number; y: number }

const sampleCode = `function recommend(history) {
  const totals = history.reduce((sum, item) => {
    sum[item.category] = (sum[item.category] || 0) + item.minutes
    return sum
  }, {})

  const favorite = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])[0][0]

  return { suggestion: favorite, reason: totals[favorite] }
}`

const initialNodes: Node[] = [
  { id:'input', title:'history', kind:'INPUT', body:'A list of activity records enters the function.', lines:[1,2], x:8, y:28 },
  { id:'group', title:'totals', kind:'TRANSFORM', body:'reduce groups minutes by category.', lines:[2,3,4,5], x:34, y:18 },
  { id:'choose', title:'favorite', kind:'DECISION', body:'sort ranks the categories and selects the winner.', lines:[8,9], x:58, y:34 },
  { id:'output', title:'recommendation', kind:'OUTPUT', body:'The winner and evidence leave the function.', lines:[11], x:82, y:22 },
]

export default function Page() {
  const [code, setCode] = useState(sampleCode)
  const [nodes, setNodes] = useState(initialNodes)
  const [selectedLine, setSelectedLine] = useState(8)
  const [selected, setSelected] = useState('choose')
  const [tool, setTool] = useState<Tool>('select')
  const [paths, setPaths] = useState<string[]>([])
  const [annotations, setAnnotations] = useState<{line:number;text:string}[]>([])
  const [branch, setBranch] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [editingAnnotation, setEditingAnnotation] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drawing = useRef<string[]>([])
  const lines = useMemo(() => code.split('\n'), [code])
  const activeNode = nodes.find(n => n.id === selected) ?? nodes[2]
  const connected = nodes.filter(n => n.lines.includes(selectedLine))

  function analyze() { setAnalyzing(true); setAnswer(''); window.setTimeout(() => { setAnalyzing(false); setSelectedLine(1) }, 500) }
  function reset() { setCode(sampleCode); setNodes(initialNodes); setSelected('choose'); setSelectedLine(8); setPaths([]); setAnnotations([]); setBranch(false); setAnswer(''); setTool('select') }
  function moveNode(id:string, e:React.PointerEvent) { if (tool !== 'select' || !canvasRef.current) return; const r=canvasRef.current.getBoundingClientRect(); const x=Math.max(2,Math.min(88,(e.clientX-r.left)/r.width*100-7)); const y=Math.max(8,Math.min(76,(e.clientY-r.top)/r.height*100-7)); setNodes(ns=>ns.map(n=>n.id===id?{...n,x,y}:n)) }
  function selectLine(line:number) { setSelectedLine(line); const match=nodes.find(n=>n.lines.includes(line)); if(match) setSelected(match.id) }
  function pointerDown(e:React.PointerEvent) { if(tool !== 'draw' || !canvasRef.current) return; const r=canvasRef.current.getBoundingClientRect(); drawing.current=[`${((e.clientX-r.left)/r.width*100).toFixed(1)},${((e.clientY-r.top)/r.height*100).toFixed(1)}`]; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  function pointerMove(e:React.PointerEvent) { if(tool !== 'draw' || !drawing.current.length || !canvasRef.current) return; const r=canvasRef.current.getBoundingClientRect(); drawing.current.push(`${((e.clientX-r.left)/r.width*100).toFixed(1)},${((e.clientY-r.top)/r.height*100).toFixed(1)}`); setPaths(p=>[...p.slice(0,-1), drawing.current.join(' ')]) }
  function pointerUp() { if(drawing.current.length){ setPaths(p=>[...p, drawing.current.join(' ')]); drawing.current=[] } }
  function ask(q:string) { setQuestion(q); setAnswer(q.toLowerCase().includes('tie') ? 'There is no explicit tie-breaker. Equal totals resolve by order, so the first item wins even when the evidence is identical.' : q.toLowerCase().includes('wrong') ? 'Empty history, missing minutes, and equal totals are the main risks. Try annotating this line to leave a review note.' : `This line connects to ${activeNode.title}: ${activeNode.body}`) }
  function addAnnotation() { setEditingAnnotation(true) }
  function saveAnnotation(e:React.FormEvent<HTMLFormElement>) { e.preventDefault(); const text=new FormData(e.currentTarget).get('note')?.toString().trim(); if(text) setAnnotations(a=>[...a,{line:selectedLine,text}]); setEditingAnnotation(false) }

  return <main className="mould-app">
    <header className="app-bar"><div className="wordmark"><span className="mark"><GitBranch /></span><b>mould</b><small>code, made visible</small></div><div className="bar-center"><span className="live"/> LIVE CANVAS <span className="slash">/</span> Untitled analysis</div><div className="bar-actions"><button onClick={reset} aria-label="Reset canvas"><RotateCcw/></button><button className="avatar">J</button></div></header>
    <section className="hero"><div><p className="eyebrow"><Sparkles/> Open code explainability</p><h1>Bring code.<br/><em>See the reasoning.</em></h1><p className="hero-copy">Paste any function, then point at the exact lines you want to understand. Mould turns the code into a live map you can move, mark, draw on, and question.</p></div><div className="analyze-status"><span className={analyzing?'status-dot':'status-dot ready'}/>{analyzing?'Reading your code…':'Analysis ready'}<button onClick={analyze} disabled={analyzing}><Play/> Analyze</button></div></section>
    <section className="workspace">
      <div className="code-pane"><div className="pane-head"><div><span className="pane-label">01 / Source</span><h2>Paste or edit code</h2></div><span className="js-badge">JS</span></div><div className="code-toolbar"><button className={tool==='select'?'tool-active':''} onClick={()=>setTool('select')}><MousePointer2/> Select</button><button className={tool==='point'?'tool-active':''} onClick={()=>setTool('point')}><Highlighter/> Point</button><button className={tool==='draw'?'tool-active':''} onClick={()=>setTool('draw')}><Pencil/> Draw</button><span/><button onClick={addAnnotation}><Plus/> Note line {selectedLine}</button></div><div className={`editor ${tool}`}><div className="line-numbers">{lines.map((_,i)=><button key={i} className={selectedLine===i+1?'line-active':''} onClick={()=>selectLine(i+1)}>{String(i+1).padStart(2,'0')}</button>)}</div><textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false} aria-label="Code editor"/></div><div className="code-foot"><span>{lines.length} lines · editable</span><span>{tool==='point'?'Click a line to trace its meaning':tool==='draw'?'Draw directly on the map':'Click line numbers to inspect'}</span></div>{annotations.length>0&&<div className="annotations"><b>Notes on this code</b>{annotations.map((a,i)=><span key={i}><Pencil/>L{a.line} — {a.text}</span>)}</div>}</div>
      <div className="map-pane"><div className="pane-head"><div><span className="pane-label">02 / Live model</span><h2>What the code is doing</h2></div><span className="map-meta">select · drag · draw</span></div><div ref={canvasRef} className={`map-canvas ${tool}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>{<svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M15 37 C23 13, 29 13, 41 27"/><path d="M41 27 C49 42, 53 42, 65 41"/><path d="M66 41 C73 22, 78 22, 88 31"/>{branch&&<path className="branch-line" d="M65 45 C70 65, 80 63, 87 70"/>}{paths.map((p,i)=><polyline key={i} className="draw-line" points={p}/>)}</svg>}{nodes.map(n=><button key={n.id} className={`map-node ${selected===n.id?'node-selected':''}`} style={{left:`${n.x}%`,top:`${n.y}%`}} onClick={()=>{setSelected(n.id); if(tool==='point') setSelectedLine(n.lines[0])}} onPointerDown={e=>{e.stopPropagation(); if(tool==='select') moveNode(n.id,e)}} onPointerMove={e=>{if(tool==='select'&&e.buttons===1) moveNode(n.id,e)}}><span className="node-kind">{n.kind}</span><strong>{n.title}</strong><p>{n.body}</p><span className="node-grip">drag</span></button>)}{branch&&<button className="map-node branch-node" onClick={()=>ask('What if two categories tie?')}><span className="node-kind">WHAT IF</span><strong>tie case</strong><p>Both categories score 40.</p></button>}<div className="map-hint">{tool==='draw'?'Release to keep your mark':'Click a node to connect it to code'}</div></div><div className="map-foot"><button onClick={()=>setBranch(true)}><GitBranch/> Branch a what-if</button><span>{connected.length?`Line ${selectedLine} maps to ${connected.map(n=>n.title).join(', ')}`:'Select a line to see its path'}</span></div></div>
    </section>
    <section className="insight-row"><div className="insight-card"><div className="insight-kicker"><span className="number">03</span><span>Line {selectedLine} · {activeNode.kind.toLowerCase()}</span></div><h2>{activeNode.title}: why this exists</h2><p>{activeNode.body}</p><div className="line-context"><code>{lines[selectedLine-1]||'// select a line'}</code><span>↳ {activeNode.title} is connected here</span></div></div><div className="ask-card"><div className="ask-head"><CircleHelp/> Ask about line {selectedLine}</div><div className="question-chips"><button onClick={()=>ask('What if two categories tie?')}>What if two categories tie?</button><button onClick={()=>ask('Which line makes the choice?')}>Which line makes the choice?</button><button onClick={()=>ask('What could go wrong here?')}>What could go wrong here?</button></div><div className="ask-input"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)ask(question)}} placeholder="Ask a follow-up…"/><button onClick={()=>ask(question)}><ArrowRight/></button></div>{answer&&<div className="answer"><Check/> {answer}<button onClick={()=>setAnswer('')} aria-label="Clear answer"><X/></button></div>}</div></section>
    {editingAnnotation&&<div className="note-dialog"><form onSubmit={saveAnnotation}><b>Annotate line {selectedLine}</b><input name="note" autoFocus placeholder="What should you remember or review?"/><div><button type="button" onClick={()=>setEditingAnnotation(false)}>Cancel</button><button className="save-note">Save note</button></div></form></div>}
    <footer className="footer-note"><span><Code2/> Mould turns code into a surface you can question.</span><span>Hackathon prototype · local session</span></footer>
  </main>
}
