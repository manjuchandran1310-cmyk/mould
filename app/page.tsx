'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronRight, Code2, GitBranch, Lightbulb, Play, RotateCcw, Sparkles, X, Zap } from 'lucide-react'

type Step = { id: string; label: string; title: string; color: string; code: string; explanation: string; why: string; output: string }

const steps: Step[] = [
  { id: 'input', label: '1 · Input', title: 'User history', color: 'yellow', code: 'const history = [\n  { category: "running", minutes: 32 },\n  { category: "reading", minutes: 18 },\n  { category: "running", minutes: 24 },\n]', explanation: 'The function starts with evidence. Each item is a tiny record of what the person did before.', why: 'Without history, the recommender has nothing personal to learn from.', output: '3 recent activities' },
  { id: 'score', label: '2 · Score', title: 'Find a pattern', color: 'blue', code: 'const scores = history.reduce((totals, item) => {\n  totals[item.category] =\n    (totals[item.category] || 0) + item.minutes\n  return totals\n}, {})', explanation: 'reduce folds many events into one useful summary. Here it totals minutes for each category.', why: 'The computer cannot “notice” a pattern like a person does. We make the pattern explicit.', output: 'running: 56 min · reading: 18 min' },
  { id: 'decide', label: '3 · Decide', title: 'Pick the best match', color: 'coral', code: 'const favorite = Object.entries(scores)\n  .sort((a, b) => b[1] - a[1])[0][0]\n\nreturn `Try ${favorite} next`', explanation: 'The largest score becomes the recommendation. This is a rule, not magic.', why: 'Every recommendation has a decision boundary. Seeing it makes the output explainable.', output: 'Try running next' },
  { id: 'output', label: '4 · Output', title: 'Explain the result', color: 'green', code: 'return {\n  suggestion: "Try running next",\n  reason: "You spent 56 minutes running"\n}', explanation: 'A good product returns the answer and the reason together. The reason is the bridge back to the code.', why: 'If a user can challenge the reason, they can trust—or correct—the system.', output: 'Suggestion + reason' },
]

export default function Page() {
  const [active, setActive] = useState(0)
  const [showCode, setShowCode] = useState(true)
  const [quiz, setQuiz] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const step = steps[active]
  const progress = useMemo(() => Math.round(((active + 1) / steps.length) * 100), [active])

  function selectStep(index: number) { setActive(index); setQuiz('idle') }
  function reset() { setActive(0); setQuiz('idle'); setShowCode(true) }

  return (
    <main className="lesson-shell">
      <header className="lesson-topbar">
        <div className="brand"><span className="brand-mark"><GitBranch /></span><strong>mould</strong><small>beta</small></div>
        <div className="lesson-title"><span>Interactive lesson</span><b>How a recommender works</b></div>
        <button className="reset-button" onClick={reset}><RotateCcw /> Reset</button>
      </header>

      <section className="lesson-intro"><div><p className="eyebrow"><span className="live-dot" /> Learn by tracing the logic</p><h1>From activity to a recommendation.</h1><p>Click each part of the map to see what the code is doing, why it matters, and how the result is formed.</p></div><div className="progress-wrap"><div><span>Lesson progress</span><b>{progress}%</b></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div></div></section>

      <section className="lesson-layout">
        <div className="lesson-canvas">
          <div className="canvas-caption"><span><Sparkles /> One small recommender</span><span>4 steps · 2 min</span></div>
          <div className="flow-map">
            <div className="flow-line" />
            {steps.map((item, index) => <button key={item.id} onClick={() => selectStep(index)} className={`flow-card ${item.color} ${active === index ? 'active' : ''}`}><div className="flow-card-head"><span className="step-number">{index + 1}</span><span className="flow-label">{item.label}</span>{active === index && <span className="active-dot" />}</div><strong>{item.title}</strong><p>{item.output}</p><span className="click-hint">{active === index ? 'Selected' : 'Click to inspect'} <ChevronRight /></span></button>)}
          </div>
          <div className="canvas-footer"><span><span className="legend-dot yellow" /> input</span><span><span className="legend-dot blue" /> transform</span><span><span className="legend-dot coral" /> decision</span><span><span className="legend-dot green" /> explanation</span></div>
        </div>

        <aside className="inspector"><div className="inspector-head"><div><p className="eyebrow">Selected step</p><h2>{step.title}</h2></div><span className={`status-pill ${step.color}`}><span /> {active === 3 ? 'Explained' : 'Inspecting'}</span></div><div className="explanation-block"><div className="section-kicker"><Lightbulb /> In plain language</div><p>{step.explanation}</p><div className="why-box"><b>Why this exists</b><span>{step.why}</span></div></div><div className="code-section"><button className="code-toggle" onClick={() => setShowCode(!showCode)}><span><Code2 /> The code</span>{showCode ? <ChevronDown /> : <ChevronRight />}</button>{showCode && <pre><code>{step.code}</code></pre>}</div><div className="result-box"><span>What comes out</span><strong>{step.output}</strong></div>{active < steps.length - 1 ? <button className="next-button" onClick={() => selectStep(active + 1)}>Next step <ArrowRight /></button> : <div className="quiz"><div className="quiz-heading"><Zap /> Check your understanding</div><p>Why did the system recommend running?</p><div className="quiz-options"><button className={quiz === 'correct' ? 'chosen correct' : ''} onClick={() => setQuiz('correct')}>It found the most minutes there</button><button className={quiz === 'wrong' ? 'chosen wrong' : ''} onClick={() => setQuiz('wrong')}>It randomly picked an activity</button></div>{quiz !== 'idle' && <div className={`quiz-feedback ${quiz}`}>{quiz === 'correct' ? <><Check /> Exactly. The score made the decision visible.</> : <><X /> Not quite. Trace back to the scoring step.</>}</div>}</div>}</aside>
      </section>

      <footer className="lesson-footer"><span><Play /> <b>Try it yourself</b> Change the minutes in the input step and watch the recommendation change.</span><button onClick={() => selectStep(0)}>Back to input <ArrowRight /></button></footer>
    </main>
  )
}
