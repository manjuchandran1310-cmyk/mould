'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Code2, GitBranch, Highlighter, MousePointer2, Pencil, Play, Plus, RotateCcw, Sparkles, X, Zap } from 'lucide-react'

type NodeKind = 'input' | 'transform' | 'decision' | 'output'
type MapNode = { id: string; kind: NodeKind; title: string; body: string; detail: string; x: number; y: number; accent: string }

const sampleCode = `function recommend(history) {
  const totals = history.reduce((sum, item) => {
    sum[item.category] = (sum[item.category] || 0) + item.minutes
    return sum
  }, {})

  const favorite = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])[0][0]

  return { suggestion: favorite, reason: totals[favorite] }
}`

const baseNodes: MapNode[] = [
  { id: 'input', kind: 'input', title: 'history', body: 'A list of past activities enters the function.', detail: 'The function cannot infer intent from nowhere. This is the evidence it is allowed to use.', x: 8, y: 25, accent: '#c58b31' },
  { id: 'transform', kind: 'transform', title: 'totals', body: 'reduce() groups minutes by category.', detail: 'Many events become one summary object. This is the first engineering choice: what signal should count?', x: 34, y: 25, accent: '#5a83a7' },
  { id: 'decision', kind: 'decision', title: 'favorite', body: 'sort() chooses the largest total.', detail: 'This is the decision boundary. Change the totals and the winner changes. Nothing here is random.', x: 59, y: 25, accent: '#b86d57' },
  { id: 'output', kind: 'output', title: 'recommendation', body: 'The winner and its reason leave the function.', detail: 'Returning the reason makes the behavior inspectable instead of a black box.', x: 82, y: 25, accent: '#69947c' },
]

const answers = ['What if two categories tie?', 'Which line makes the choice?', 'What could go wrong here?']

export default function Page() {
  const [code, setCode] = useState(sampleCode)
  const [nodes, setNodes] = useState(baseNodes)
  const [selected, setSelected] = useState('decision')
  const [selectedLine, setSelectedLine] = useState(8)
  const [analyzed, setAnalyzed] = useState(true)
  const [mode, setMode] = useState<'select' | 'point' | 'draw'>('select')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [annotations, setAnnotations] = useState<string[]>([])
  const [branch, setBranch] = useState(false)
  const activeNode = nodes.find((node) => node.id === selected) ?? nodes[2]
  const lines = useMemo(() => code.split('\n'), [code])

  function analyze() {
    setAnalyzed(false)
    setAnswer('')
    window.setTimeout(() => setAnalyzed(true), 450)
  }

  function reset() {
    setCode(sampleCode); setNodes(baseNodes); setSelected('decision'); setSelectedLine(8); setAnnotations([]); setBranch(false); setMode('select'); setAnswer(''); setQuestion(''); setAnalyzed(true)
  }

  function dragNode(id: string, event: React.DragEvent<HTMLButtonElement>) {
    event.dataTransfer.setData('node-id', id)
  }

  function dropNode(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const id = event.dataTransfer.getData('node-id')
    if (!id) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(3, Math.min(88, ((event.clientX - rect.left) / rect.width) * 100 - 8))
    const y = Math.max(8, Math.min(72, ((event.clientY - rect.top) / rect.height) * 100 - 8))
    setNodes((current) => current.map((node) => node.id === id ? { ...node, x, y } : node))
  }

  function ask(value: string) {
    setQuestion(value)
    setAnswer(value.includes('tie') ? 'A tie is not handled explicitly. JavaScript keeps the first item after sorting, so equal evidence creates an arbitrary winner.' : value.includes('choice') ? 'The choice happens on the sort line. It compares the accumulated values and takes the first, largest entry.' : 'Empty history, missing minutes, and equal totals are all edge cases this function should make explicit.')
  }

  function addAnnotation() {
    setAnnotations((current) => [...current, `Line ${selectedLine}: ask why this matters`])
  }

  return <main className="mould-app">
    <header className="app-bar"><div className="wordmark"><span className="mark"><GitBranch /></span><b>mould</b><small>code, made visible</small></div><div className="bar-center"><span className="live" /> Live canvas <span className="slash">/</span> untitled analysis</div><div className="bar-actions"><button onClick={reset} aria-label="Reset canvas"><RotateCcw /></button><button className="avatar">J</button></div></header>

    <section className="hero"><div><p className="eyebrow"><Sparkles /> Bring any code</p><h1>Make the invisible<br /><em>feel obvious.</em></h1><p className="hero-copy">Paste a piece of code. Mould maps the inputs, transformations, decisions, and what-ifs so you can reason about it like an engineer.</p></div><div className="analyze-status"><span className={analyzed ? 'status-dot ready' : 'status-dot'} />{analyzed ? 'Analysis ready' : 'Reading your code…'}<button onClick={analyze}><Play /> Analyze</button></div></section>

    <section className="workspace">
      <div className="code-pane">
        <div className="pane-head"><div><span className="pane-label">01 / Source</span><h2>Drop in your code</h2></div><span className="js-badge">JS</span></div>
        <div className="code-toolbar"><button className={mode === 'select' ? 'tool-active' : ''} onClick={() => setMode('select')}><MousePointer2 /> Select</button><button className={mode === 'point' ? 'tool-active' : ''} onClick={() => setMode('point')}><Highlighter /> Point</button><button className={mode === 'draw' ? 'tool-active' : ''} onClick={() => setMode('draw')}><Pencil /> Draw</button><span /> <button onClick={addAnnotation}><Plus /> Annotate</button></div>
        <div className={`editor ${mode}`}><div className="line-numbers">{lines.map((_, index) => <button key={index} className={selectedLine === index + 1 ? 'line-active' : ''} onClick={() => setSelectedLine(index + 1)}>{String(index + 1).padStart(2, '0')}</button>)}</div><textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} aria-label="Code editor" /></div>
        <div className="code-foot"><span>{lines.length} lines · editable</span><span>{mode === 'point' ? 'Click a line to point' : mode === 'draw' ? 'Draw mode active' : 'Select a line to inspect'}</span></div>
        {annotations.length > 0 && <div className="annotations"><b>Your annotations</b>{annotations.map((item, index) => <span key={index}><Pencil />{item}</span>)}</div>}
      </div>

      <div className="map-pane"><div className="pane-head"><div><span className="pane-label">02 / Model</span><h2>How it thinks</h2></div><span className="map-meta">drag nodes · click to inspect</span></div><div className="map-canvas" onDragOver={(event) => event.preventDefault()} onDrop={dropNode}><svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M16 33 C24 18, 27 18, 40 33" /><path d="M42 33 C50 18, 54 18, 65 33" /><path d="M67 33 C75 18, 79 18, 88 33" />{branch && <path className="branch-line" d="M65 36 C73 52, 78 58, 87 59" />}</svg>{nodes.map((node) => <button key={node.id} draggable onDragStart={(event) => dragNode(node.id, event)} onClick={() => setSelected(node.id)} className={`map-node ${selected === node.id ? 'node-selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%`, '--accent': node.accent } as React.CSSProperties}><span className="node-kind">{node.kind}</span><strong>{node.title}</strong><p>{node.body}</p><span className="node-grip">•••</span></button>)}{branch && <button className="map-node branch-node" onClick={() => setSelected('decision')}><span className="node-kind">what if</span><strong>tie?</strong><p>Both categories score 40.</p></button>}<div className="map-hint"><span><Zap /> Trace the path</span><span>input → decision → output</span></div></div><div className="map-foot"><button onClick={() => setBranch(true)}><GitBranch /> Branch a what-if</button><span>Nodes are a living explanation, not a diagram.</span></div></div>
    </section>

    <section className="insight-row"><div className="insight-card"><div className="insight-kicker"><span className="number">03</span><span>Selected line {selectedLine}</span></div><h2>What is happening here?</h2><p>{activeNode.detail}</p><div className="line-context"><code>{lines[selectedLine - 1] || '// select a line'}</code><span>↳ connected to <b>{activeNode.title}</b></span></div></div><div className="ask-card"><div className="ask-head"><CircleHelp /> Ask about this code</div><div className="question-chips">{answers.map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}</div><div className="ask-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) ask(question) }} placeholder="Ask a follow-up…" /><button onClick={() => ask(question)}><ArrowRight /></button></div>{answer && <div className="answer"><Check /> {answer}</div>}</div></section>
    <footer className="footer-note"><span><Code2 /> Mould turns code into a surface you can question.</span><span>Hackathon prototype · state is local to this session</span></footer>
  </main>
}
