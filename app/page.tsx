'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CirclePlus,
  Clock3,
  Copy,
  Crosshair,
  GitBranch,
  Grip,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  MousePointer2,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'

type NodeKind = 'core' | 'input' | 'process' | 'output' | 'risk'
type MapNode = { id: string; title: string; detail: string; kind: NodeKind; x: number; y: number; tags: string[]; open?: boolean }

type Concept = { name: string; group: string; status: 'explored' | 'confident'; count: number }

const initialNodes: MapNode[] = [
  { id: 'brief', title: 'Product brief', detail: 'The user describes a lightweight task board for a small team.', kind: 'input', x: 72, y: 80, tags: ['context', 'must-have'] },
  { id: 'board', title: 'Shared task board', detail: 'A single place where tasks can be created, assigned, and moved through a simple workflow.', kind: 'core', x: 355, y: 116, tags: ['core concept', 'high impact'], open: true },
  { id: 'auth', title: 'Team access', detail: 'Invite-only access with a small role model: owner, member, viewer.', kind: 'process', x: 670, y: 60, tags: ['security', 'medium'] },
  { id: 'tasks', title: 'Task model', detail: 'Title, status, assignee, due date, and activity history.', kind: 'process', x: 660, y: 205, tags: ['data', 'high impact'] },
  { id: 'realtime', title: 'Live updates', detail: 'Keep collaborators in sync without asking them to refresh.', kind: 'risk', x: 355, y: 330, tags: ['complexity', 'unknown'] },
  { id: 'deploy', title: 'Deployable MVP', detail: 'A focused version that can ship with a hosted database and a responsive web app.', kind: 'output', x: 680, y: 370, tags: ['ship', 'confidence 82%'] },
]

const concepts: Concept[] = [
  { name: 'Shared task board', group: 'Core idea', status: 'confident', count: 3 },
  { name: 'Task model', group: 'Data', status: 'explored', count: 2 },
  { name: 'Live updates', group: 'Complexity', status: 'explored', count: 1 },
  { name: 'Team access', group: 'Security', status: 'explored', count: 1 },
]

const colors: Record<NodeKind, string> = {
  core: 'node-coral', input: 'node-yellow', process: 'node-blue', output: 'node-green', risk: 'node-violet',
}

export default function Page() {
  const [prompt, setPrompt] = useState('A simple task board for a small team')
  const [nodes, setNodes] = useState(initialNodes)
  const [selected, setSelected] = useState('board')
  const [loading, setLoading] = useState(false)
  const [askMode, setAskMode] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [understanding, setUnderstanding] = useState(false)
  const [toast, setToast] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Core idea', 'Complexity'])
  const [whatIf, setWhatIf] = useState('')

  useEffect(() => {
    const saved = window.localStorage.getItem('mould-understanding')
    if (saved) setUnderstanding(saved === 'open')
  }, [])

  const selectedNode = nodes.find((node) => node.id === selected)
  const explored = useMemo(() => concepts.filter((concept) => concept.status === 'confident').length, [])

  function generateMap(nextPrompt = prompt) {
    setLoading(true)
    setToast('')
    window.setTimeout(() => {
      setNodes((current) => current.map((node) => node.id === 'brief' ? { ...node, detail: nextPrompt } : node))
      setLoading(false)
      setToast('Map regenerated from your brief')
      window.setTimeout(() => setToast(''), 2800)
    }, 700)
  }

  function submitQuestion() {
    if (!question.trim() || !selectedNode) return
    setAnswer(`The ${selectedNode.title.toLowerCase()} is a ${selectedNode.kind === 'risk' ? 'watch-out' : 'building block'} because it changes what the team needs to make reliable. Start with the smallest version, then validate it with one real workflow.`)
    setQuestion('')
  }

  function deleteNode() {
    if (!selectedNode || selectedNode.id === 'board') return
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    setSelected('board')
    setToast(`${selectedNode.title} removed — connections recalculated`)
    window.setTimeout(() => setToast(''), 2800)
  }

  function submitWhatIf() {
    if (!whatIf.trim()) return
    setNodes((current) => [...current, { id: `what-${Date.now()}`, title: whatIf, detail: 'A new constraint to explore before committing to the build.', kind: 'risk', x: 85, y: 360, tags: ['your what-if', 'needs clarity'] }])
    setWhatIf('')
    setToast('What-if added to the map')
    window.setTimeout(() => setToast(''), 2800)
  }

  return (
    <main className="mould-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><GitBranch /></div><span>mould</span><small>beta</small></div>
        <nav className="topnav" aria-label="Primary navigation"><button className="nav-active">Workspace</button><button>Library</button><button>How it works</button></nav>
        <div className="top-actions"><button className="icon-btn" aria-label="Search"><Search /></button><button className="avatar" aria-label="Account">J</button></div>
      </header>

      <section className="canvas-header">
        <div><p className="eyebrow"><span className="live-dot" /> Untitled workspace</p><h1>Make it buildable.</h1><p className="subhead">Turn a loose idea into the decisions, dependencies, and unknowns that make it real.</p></div>
        <div className="canvas-tools"><button className="tool-btn"><Copy /> Copy map</button><button className="tool-btn"><MoreHorizontal /></button></div>
      </section>

      <section className={`map-area ${loading ? 'is-loading' : ''}`} aria-label="Buildability map">
        <div className="map-grid" />
        <div className="map-legend"><span><i className="legend-dot dot-coral" /> core</span><span><i className="legend-dot dot-blue" /> build</span><span><i className="legend-dot dot-violet" /> watch</span></div>
        <svg className="connections" viewBox="0 0 1000 530" preserveAspectRatio="none" aria-hidden="true">
          <path d="M235 142 C290 142 305 170 355 180" /><path d="M540 190 C600 190 620 100 670 100" /><path d="M540 205 C600 215 615 250 660 255" /><path d="M500 270 C500 330 450 365 445 405" /><path d="M755 275 C755 330 755 350 770 405" /><path d="M790 300 C790 340 800 365 800 405" />
        </svg>
        {loading && <div className="map-loading"><Sparkles /> Re-composing your map</div>}
        {nodes.map((node) => <button key={node.id} className={`map-node ${colors[node.kind]} ${selected === node.id ? 'selected' : ''}`} style={{ left: `${node.x}px`, top: `${node.y}px` }} onClick={() => { setSelected(node.id); if (askMode) setAskMode(false) }}>
          <div className="node-top"><span className="node-type"><span className="node-symbol">{node.kind === 'core' ? <Sparkles /> : node.kind === 'risk' ? <CircleHelp /> : node.kind === 'output' ? <Check /> : <Zap />}</span>{node.kind}</span><span className="node-menu"><MoreHorizontal /></span></div>
          <strong>{node.title}</strong><p>{node.detail}</p><div className="node-tags">{node.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          {node.open && selected === node.id && <div className="node-expanded"><div><span>Buildability</span><b>82%</b></div><div className="meter"><i /></div><small>Clear path with one open question</small></div>}
        </button>)}
        <div className="zoom-controls"><button aria-label="Zoom out"><ArrowDown /></button><span>100%</span><button aria-label="Zoom in"><ArrowUp /></button><button aria-label="Reset canvas"><RotateCcw /></button></div>
      </section>

      <section className="composer-wrap">
        <div className="composer-label"><span className="sparkle-small"><Sparkles /></span><span>Start with an idea</span><span className="composer-rule" /><span className="keyboard-hint">⌘ ↵</span></div>
        <div className="composer"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Describe your idea" /><button className="generate-btn" onClick={() => generateMap()} disabled={loading}><Play /> {loading ? 'Building map' : 'Build the map'}</button></div>
        <div className="sample-row"><span>Try a direction</span><button onClick={() => { setPrompt('A quiet reading app that helps people remember what they learn'); generateMap('A quiet reading app that helps people remember what they learn') }}>reading app</button><button onClick={() => { setPrompt('A studio booking tool for independent makers'); generateMap('A studio booking tool for independent makers') }}>studio booking</button><button onClick={() => { setPrompt('A shared garden planner for a neighborhood'); generateMap('A shared garden planner for a neighborhood') }}>garden planner</button></div>
      </section>

      <div className="floating-palette"><button className={askMode ? 'palette-active' : ''} onClick={() => setAskMode((value) => !value)}><Crosshair /> <span>{askMode ? 'Select a node' : 'Point & ask'}</span></button><span className="palette-divider" /><button onClick={() => setUnderstanding(true)}><Lightbulb /> <span>My understanding</span><b>{explored}</b></button><span className="palette-divider" /><button onClick={deleteNode}><Trash2 /> <span>Remove node</span></button></div>

      {askMode && <div className="ask-popover"><div className="ask-heading"><span><MessageCircle /> Ask about <b>{selectedNode?.title}</b></span><button onClick={() => setAskMode(false)}><X /></button></div><div className="ask-form"><input autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) submitQuestion() }} placeholder="What should I understand here?" /><button onClick={submitQuestion}><ArrowUpRight /></button></div>{answer && <div className="answer"><span className="answer-mark"><Sparkles /></span><p>{answer}</p></div>}</div>}

      <aside className={`understanding-drawer ${understanding ? 'drawer-open' : ''}`} aria-label="My understanding"><div className="drawer-head"><div><p className="eyebrow">Learning model</p><h2>My understanding</h2></div><button className="icon-btn" onClick={() => { setUnderstanding(false); window.localStorage.setItem('mould-understanding', 'closed') }}><X /></button></div><div className="progress-card"><div className="progress-ring"><b>64</b><span>%</span></div><div><strong>Building confidence</strong><p>Keep exploring the edges of your idea.</p></div></div><div className="drawer-section"><div className="section-title"><span>Concepts encountered</span><b>{concepts.length}</b></div>{['Core idea', 'Data', 'Complexity', 'Security'].map((group) => <div key={group} className="concept-group"><button onClick={() => setExpandedGroups((groups) => groups.includes(group) ? groups.filter((item) => item !== group) : [...groups, group])}><span className={`group-dot group-${group.toLowerCase().replace(' ', '-')}`} />{group}{expandedGroups.includes(group) ? <ChevronDown /> : <ChevronRight />}</button>{expandedGroups.includes(group) && concepts.filter((concept) => concept.group === group).map((concept) => <div key={concept.name} className="concept-row"><span>{concept.name}</span><span className={concept.status === 'confident' ? 'confident' : ''}>{concept.status === 'confident' ? 'Confident' : 'Exploring'} <i>{concept.count}</i></span></div>)}</div>)}</div><div className="drawer-footer"><Clock3 /> Last session today <button>View history <ArrowUpRight /></button></div></aside>
      {toast && <div className="toast"><Check /> {toast}</div>}
      <div className="whatif"><span><Zap /> What if...</span><input value={whatIf} onChange={(event) => setWhatIf(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitWhatIf() }} placeholder="add a constraint or a question" /><button onClick={submitWhatIf} aria-label="Add what-if"><CirclePlus /></button></div>
    </main>
  )
}
