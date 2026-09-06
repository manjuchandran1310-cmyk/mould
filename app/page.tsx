'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Code2, GitBranch, Highlighter, MessageCircle, MousePointer2, Pencil, Play, Plus, RotateCcw, Sparkles, X } from 'lucide-react'

type Tool = 'select' | 'point'
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

type FeatureInsight = { tag: string; subject: string; summary: string; data: string; states: string; edges: string; designer: { question: string; points: string[] }; engineer: { question: string; points: string[] }; handoff: string }

const STOPWORDS = new Set(['a','an','the','my','their','his','her','its','our','your','to','of','for','from','on','with','that','which','so','and','let','users','user','people','person','someone','a user','allow','enable'])

function extractSubject(text: string): string {
  const patterns = [
    /(?:delete|remove|archive|discard|save|unsave|favorite|bookmark|like|unlike|edit|update|rename|change|upload|attach|share|unshare|invite|schedule|book|reserve|cancel|search|filter|find|sort|comment on|message|reply to|notify|remind|pay for|checkout|subscribe to|log in to|sign up for|sign into|view|open|create|add|remove from)\s+(?:a|an|the|my|their|his|her|its|our|your)?\s*([a-z][a-z0-9'\- ]{1,40}?)(?:\s+(?:from|in|to|for|on|with|that|which|so|and|when|while|before|after)\b|[.,!?]|$)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const cleaned = match[1].trim().replace(/\s+/g, ' ')
      if (cleaned.length > 1) return cleaned
    }
  }
  const words = text.replace(/[.,!?]/g, '').split(/\s+/).filter(w => w && !STOPWORDS.has(w.toLowerCase()))
  const tail = words.slice(-3).join(' ')
  return tail || text.trim() || 'this feature'
}

function detectModifiers(text: string) {
  const lower = text.toLowerCase()
  return {
    multiUser: /\bteam\b|everyone|shared with|collaborat|multiple (people|users)|together/.test(lower),
    offline: /offline|no connection|slow (network|connection)|poor signal|flaky/.test(lower),
    realtime: /real.?time|instant(ly)?|live update|sync(hronize)?/.test(lower),
    permissioned: /\badmin\b|owner only|permission|role|private|restricted|only (i|they) can/.test(lower),
    mobile: /\bmobile\b|\bphone\b|on the go|small screen/.test(lower),
    scale: /thousands|large (list|number|amount)|many (items|users|people)|at scale/.test(lower),
    public: /\bpublic\b|anyone (can|with)|external (user|visitor)/.test(lower),
  }
}

function modifierBullets(mods: ReturnType<typeof detectModifiers>, subject: string) {
  const designer: string[] = []
  const engineer: string[] = []
  if (mods.multiUser) { designer.push(`Show whose change to "${subject}" is currently active when more than one person is looking at it.`); engineer.push(`Decide how conflicting updates to "${subject}" from different people are resolved, not just detected.`) }
  if (mods.offline) { designer.push(`Design what "${subject}" looks like the moment connectivity drops mid-action.`); engineer.push(`Queue the action on "${subject}" locally and reconcile it once the connection returns.`) }
  if (mods.realtime) { designer.push(`Make updates to "${subject}" feel instant without a manual refresh.`); engineer.push(`Push changes to "${subject}" over a live channel instead of polling, and handle a dropped connection.`) }
  if (mods.permissioned) { designer.push(`Make it obvious who is currently allowed to act on "${subject}" before they try.`); engineer.push(`Enforce who can act on "${subject}" on the server, not just by hiding the button.`) }
  if (mods.mobile) { designer.push(`Design the "${subject}" action for a thumb-sized target and a spotty connection.`); engineer.push(`Keep the payload for "${subject}" small and the request tolerant of a slow mobile network.`) }
  if (mods.scale) { designer.push(`Decide how "${subject}" behaves when the list behind it has thousands of entries, not ten.`); engineer.push(`Paginate or index "${subject}" — an operation that scans everything will not survive real data volume.`) }
  if (mods.public) { designer.push(`Be explicit about what a stranger can and cannot do with "${subject}".`); engineer.push(`Treat any request touching "${subject}" from an anonymous or external caller as untrusted input.`) }
  return { designer, engineer }
}

function analyzeFeature(brief: string): FeatureInsight {
  const name = brief.trim() || 'this feature'
  const text = name.toLowerCase()
  const subject = extractSubject(name)
  const mods = detectModifiers(name)
  const tag = /delete|remove|archive|discard/.test(text) ? 'delete'
    : /invite|invit|team member|collaborat/.test(text) ? 'invite'
    : /upload|attach|photo|image|\bfile/.test(text) ? 'upload'
    : /pay|checkout|subscription|billing|price|cart/.test(text) ? 'payment'
    : /search|filter|sort|find/.test(text) ? 'search'
    : /comment|chat|message|reply/.test(text) ? 'messaging'
    : /notify|notification|alert|remind/.test(text) ? 'notification'
    : /login|sign in|signup|sign up|password|\bauth/.test(text) ? 'auth'
    : /share|permission|access|visib|public|private/.test(text) ? 'sharing'
    : /save|favorite|bookmark|\blike\b/.test(text) ? 'save'
    : /edit|update|rename|change/.test(text) ? 'edit'
    : /schedule|calendar|book|reserve|appointment/.test(text) ? 'scheduling'
    : 'generic'
  const library: Record<string, Omit<FeatureInsight, 'subject'>> = {
    delete: {
      tag, summary: `Removing something is a one-way door for the user; "${name}" needs a safety net before it needs a button.`,
      data: 'A soft-delete flag and a deleted_at timestamp — not a hard row delete.',
      states: 'Idle → confirming → deleting → undo window → gone.',
      edges: 'Deleting the last item, deleting mid-edit, and double-tapping delete on a slow connection.',
      designer: { question: 'Can the person recover from this?', points: ['Show a confirm step only when the action is destructive and hard to reverse.', 'Give a short undo window (a toast with "Undo") instead of a modal for low-risk deletes.', 'Design the empty state that appears right after the last item is removed.'] },
      engineer: { question: 'What actually happens to the record?', points: ['Soft-delete first; hard-delete on a delayed job so undo stays possible.', 'Check what else references this row, and whether it also disappears.', 'Make the delete request idempotent so a retried tap cannot double-fire.'] },
      handoff: `Write one acceptance example: "When I delete the last item in ${name}, I see an empty state, not an error."`,
    },
    invite: {
      tag, summary: `Invites live between two accounts that do not trust each other yet — most of the hard part of "${name}" happens before acceptance.`,
      data: 'An invite record with status (pending / accepted / expired), a token, and an expiry time — separate from the membership row it becomes.',
      states: 'Sent → pending → accepted / declined / expired.',
      edges: 'Inviting someone already invited, an expired link, and an invite to an email that already has an account.',
      designer: { question: 'What does a pending invite look like to everyone involved?', points: ['Show pending invites as their own list state, not mixed in with active members.', 'Let the inviter resend or revoke without leaving the page.', 'Design what the invitee sees when the link is expired or already used.'] },
      engineer: { question: 'What guarantees does the token need?', points: ['Expire the token server-side, not just by hiding it in the UI.', 'Make accepting an invite idempotent if the link is opened twice.', 'Decide what happens if the invited email already has an account.'] },
      handoff: `Write one acceptance example: "When an invite to ${name} expires, resending creates a new token, not a reused one."`,
    },
    upload: {
      tag, summary: `"${name}" hands the user's file to a system that can fail in the middle — the interface has to narrate that.`,
      data: 'File URL, size, mime type, owner id, and an upload status per file — not one "done" flag for the batch.',
      states: 'Selected → uploading (progress) → processing → ready / failed.',
      edges: 'A file that is too large, an unsupported type, and a connection that drops mid-upload.',
      designer: { question: 'How does progress feel, not just look?', points: ['Show per-file progress, not one spinner for a whole batch.', 'Design the retry path for a failed upload without losing the other files.', 'Say exactly why a file was rejected — size, type, or count.'] },
      engineer: { question: 'What constraints does the server enforce?', points: ['Validate size and mime type server-side, not just in the file picker.', 'Decide if uploads are chunked and resumable, or one shot.', 'Define what "ready" means: uploaded, or processed and safe to display?'] },
      handoff: `Write one acceptance example: "When a file over the size limit is dropped into ${name}, the person sees why before the upload starts."`,
    },
    payment: {
      tag, summary: `Money makes every ambiguity expensive — "${name}" needs the same total shown to the user and charged by the server.`,
      data: 'Amount, currency, an idempotency key per attempt, and a status (pending / succeeded / failed / refunded).',
      states: 'Reviewing → submitting → succeeded / declined / needs action.',
      edges: 'A double-submitted charge, a declined card mid-flow, and a webhook that arrives before the redirect.',
      designer: { question: 'How does the person recover from a decline?', points: ['Show the decline reason in plain language, not a raw processor code.', 'Keep the entered details when a payment fails so nothing is retyped.', 'Make the "processing" state impossible to double-tap through.'] },
      engineer: { question: 'What must never happen twice?', points: ['Use an idempotency key so a retried request cannot double-charge.', 'Treat the webhook, not the redirect, as the source of truth for success.', 'Recompute the total server-side — never trust a client-sent amount.'] },
      handoff: `Write one acceptance example: "When ${name} is submitted twice in a row, only one charge is created."`,
    },
    search: {
      tag, summary: `"${name}" is judged by its empty and slow states far more than by a perfect match.`,
      data: 'A query string, applied filters, and a result set with a total count and a next-page cursor.',
      states: 'Idle → typing (debounced) → loading → results / zero results / error.',
      edges: 'Zero results, a query that returns thousands of rows, and a filter combination with no matches.',
      designer: { question: 'What does "nothing found" actually say?', points: ['Design a zero-results state that suggests a next action, not just "no results".', 'Show a loading state that does not flash for fast queries.', 'Decide how active filters stay visible while scrolling results.'] },
      engineer: { question: 'What keeps this fast at scale?', points: ['Debounce the request, and cancel the stale one when a new query starts.', 'Paginate or virtualize — never return an unbounded result set.', 'Decide whether search runs client-side or needs a real index.'] },
      handoff: `Write one acceptance example: "When ${name} returns zero results, the person sees a next step, not a dead end."`,
    },
    messaging: {
      tag, summary: `"${name}" has to feel instant even though the network is not — ordering and delivery become the real design problem.`,
      data: 'Message text, sender id, a client-generated id (for dedup), a timestamp, and a delivery status.',
      states: 'Composing → sending (optimistic) → delivered / failed → read.',
      edges: 'Two messages arriving out of order, a message sent while offline, and the same message sent twice.',
      designer: { question: 'What does "sending" look like before the server confirms?', points: ['Show the message optimistically, then reconcile or roll it back.', 'Design a clear failed-to-send state with a retry, not a silent drop.', 'Decide how read receipts or typing indicators degrade offline.'] },
      engineer: { question: 'What guarantees ordering and no duplicates?', points: ['Use a client-generated id so a retried send is deduplicated, not doubled.', 'Order messages by server timestamp, not client clock.', 'Decide the reconnect behavior: replay missed messages, or just the latest.'] },
      handoff: `Write one acceptance example: "When ${name} is sent offline, it appears once, correctly ordered, after reconnect."`,
    },
    notification: {
      tag, summary: `"${name}" competes for attention it has not earned yet — most of the design work is deciding when to stay silent.`,
      data: 'A notification type, target user, read/unread state, and a delivery channel (push / email / in-app).',
      states: 'Triggered → queued → delivered → read / dismissed.',
      edges: 'The same event firing twice, a user muting a channel, and a burst of events needing grouping.',
      designer: { question: 'When does this deserve interrupting someone?', points: ['Group repeated events instead of sending one notification per event.', 'Design what read vs. unread looks like across every channel.', 'Give a clear, specific mute or preference control, not an all-or-nothing switch.'] },
      engineer: { question: 'What stops duplicate or lost notifications?', points: ['Deduplicate on the triggering event id, not on a timer.', 'Decide the delivery guarantee: at-least-once with dedup, or best effort.', 'Respect user channel preferences server-side before sending.'] },
      handoff: `Write one acceptance example: "When the same event fires twice for ${name}, only one notification is delivered."`,
    },
    auth: {
      tag, summary: `"${name}" is the one flow where a confusing error message becomes a security question, not just a UX one.`,
      data: 'A hashed credential, session token, failed-attempt count, and lockout/reset state — never a plaintext password.',
      states: 'Entering → checking → success / invalid credentials / locked / needs verification.',
      edges: 'Repeated failed attempts, an expired session mid-action, and a reset link opened twice.',
      designer: { question: 'What does the person learn from an error?', points: ['Give one honest error for wrong credentials without confirming which field was wrong.', 'Design the locked-out state with a clear, safe way forward.', 'Show session-expired as a recoverable moment, not a lost form.'] },
      engineer: { question: 'What is the system guaranteeing about identity?', points: ['Rate-limit and lock after repeated failures, tracked server-side.', 'Hash and salt credentials; never log or return them.', 'Expire and rotate reset tokens after first use.'] },
      handoff: `Write one acceptance example: "When ${name} is attempted with the wrong password five times, the account is temporarily locked."`,
    },
    sharing: {
      tag, summary: `"${name}" means two people can now disagree about who is allowed to see what — that disagreement needs a visible answer.`,
      data: 'A permission level per user or link (view / edit / owner), and whether access is scoped to a person or anyone with the link.',
      states: 'Private → shared (pending / active) → access changed → revoked.',
      edges: 'Revoking access someone is actively using, a link shared further than intended, and two editors at once.',
      designer: { question: 'Can everyone tell who can see this?', points: ['Always show the current access level somewhere visible, not buried in settings.', 'Design what happens the moment access is revoked mid-session.', 'Make link-based sharing visually distinct from person-based sharing.'] },
      engineer: { question: 'What enforces the permission, not just displays it?', points: ['Check permission on every read and write server-side, not only in the UI.', 'Decide what happens to an active session when access is revoked.', "Scope shareable links with their own revocable token, not the owner's."] },
      handoff: `Write one acceptance example: "When access to ${name} is revoked, the next request from that user is denied, not just hidden."`,
    },
    save: {
      tag, summary: `"${name}" looks trivial until two devices disagree about what was saved.`,
      data: 'A saved/favorited flag or join row per user and item, with the timestamp it happened.',
      states: 'Unsaved → saving (optimistic) → saved → removed.',
      edges: 'Saving the same item twice, saving while offline, and unsaving mid-request.',
      designer: { question: 'How does the toggle feel instantly?', points: ['Update the UI optimistically on tap; reconcile silently if the request fails.', 'Design where saved items live and how someone finds them again.', 'Decide how the failed-save state looks without feeling broken.'] },
      engineer: { question: 'What keeps this idempotent?', points: ['Make saving the same item twice a no-op, not a duplicate row.', 'Decide if saved state syncs across devices in real time or on refresh.', 'Handle the race between rapid save/unsave taps.'] },
      handoff: `Write one acceptance example: "When ${name} is tapped twice quickly, exactly one saved state results."`,
    },
    edit: {
      tag, summary: `"${name}" introduces a second writer to data that used to have one — conflicts are now possible, not hypothetical.`,
      data: 'The field being changed, a version or updated_at value, and who made the last change.',
      states: 'Viewing → editing → saving → saved / conflict / discarded.',
      edges: 'Two people editing the same field, closing the tab mid-edit, and editing stale data.',
      designer: { question: 'What happens when someone else changed this first?', points: ['Show unsaved changes clearly so nothing is lost by navigating away.', 'Design a real conflict state, not a silent overwrite.', 'Confirm a save succeeded without forcing an extra click.'] },
      engineer: { question: 'What decides whose edit wins?', points: ['Use a version check so a stale save is rejected or merged, not overwritten silently.', 'Autosave or explicit save — pick one, and make failure states match.', 'Decide what "who last edited this" means when edits overlap.'] },
      handoff: `Write one acceptance example: "When two people edit ${name} at once, the second save is warned, not silently lost."`,
    },
    scheduling: {
      tag, summary: `"${name}" is really a negotiation over a shared resource: time — most bugs live in double-booking, not the calendar UI.`,
      data: 'A start/end time with timezone, an owner, and a status (tentative / confirmed / cancelled).',
      states: 'Choosing a time → holding it → confirmed → rescheduled / cancelled.',
      edges: 'Two people booking the same slot, a timezone mismatch, and a cancellation after confirmation.',
      designer: { question: 'How does the person know a slot is really theirs?', points: ['Show a slot as "held" the moment it is picked, before final confirmation.', 'Always display the timezone being used, not just a bare time.', 'Design the cancellation and reschedule flow with the same care as booking.'] },
      engineer: { question: 'What prevents two bookings for one slot?', points: ['Lock or check availability atomically at confirmation, not just at page load.', 'Store times in UTC and convert for display — never store local time.', 'Decide the hold duration before an unconfirmed slot releases back.'] },
      handoff: `Write one acceptance example: "When two people try to book the same slot in ${name}, only the first confirmation succeeds."`,
    },
    generic: {
      tag, summary: `"${name}" is still a phrase, not a spec — the fastest way to sharpen it is to pick the first real action inside it.`,
      data: `Name the one thing "${name}" creates, reads, or changes after a refresh — what is the noun here?`,
      states: 'Before the action, during it, right after success, and after it fails.',
      edges: 'Empty input, a slow network, and the same action fired twice.',
      designer: { question: 'What should the person feel right after doing this?', points: [`Sketch what "${name}" looks like with zero data, not just the happy path.`, 'Decide what confirms the action worked without forcing an extra click.', 'Write the one error message that would actually help someone recover.'] },
      engineer: { question: 'What does the system have to promise?', points: [`Name the data "${name}" needs to persist, and where it lives after a refresh.`, 'Decide what happens if the request is sent twice.', 'Decide who owns validation: the form, the API, or both.'] },
      handoff: `Turn "${name}" into one sentence an engineer can test: "When ___, the system should ___."`,
    },
  }
  const base = library[tag]
  const extra = modifierBullets(mods, subject)
  return {
    ...base,
    subject,
    designer: { question: base.designer.question, points: [...base.designer.points, ...extra.designer] },
    engineer: { question: base.engineer.question, points: [...base.engineer.points, ...extra.engineer] },
  }
}

export default function Page() {
  const [code, setCode] = useState(sampleCode)
  const [selectedLine, setSelectedLine] = useState(8)
  const [selectedRange, setSelectedRange] = useState<[number, number]>([8, 8])
  const [tool, setTool] = useState<Tool>('select')
  const [view, setView] = useState<View>('explainer')
  const [analyzed, setAnalyzed] = useState(true)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [drawingStroke, setDrawingStroke] = useState<Stroke | null>(null)
  const [featureBrief, setFeatureBrief] = useState('Save a favorite from a list')
 
  const [feedback, setFeedback] = useState<'unreviewed' | 'approved' | 'corrected' | 'rejected'>('unreviewed')
  const [modelInput, setModelInput] = useState('[{"category":"Work","minutes":45},{"category":"Health","minutes":20}]')
  const [modelOutput, setModelOutput] = useState('Select Analyze to generate a walkthrough from the code you pasted.')
  const [isModelRunning, setIsModelRunning] = useState(false)

  const [runResult, setRunResult] = useState<{ suggestion: string; reason: number } | null>(null)
  const [runError, setRunError] = useState('')
  const [marks, setMarks] = useState<Mark[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [pointing, setPointing] = useState(false)
  const [pointReady, setPointReady] = useState(false)
  const [pointStart, setPointStart] = useState<number | null>(null)
  const [drawOverlay, setDrawOverlay] = useState<{ x: number; y: number } | null>(null)
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
  const codeKind = /fetch|axios|http/i.test(code) ? 'API request' : /map|filter|reduce|sort/i.test(code) ? 'data transformation' : /if|switch|\?|&&|\|\|/.test(code) ? 'conditional logic' : /useState|setState/.test(code) ? 'state logic' : /onClick|addEventListener/.test(code) ? 'button handler' : /className|<\w+/.test(code) ? 'React component' : /margin|padding|display|grid|flex|font-size/.test(code) ? 'CSS layout' : 'JavaScript values'
  const modelSteps = codeKind === 'API request' ? ['request', 'response', 'render'] : codeKind === 'data transformation' ? ['input items', 'transform each', 'output result'] : codeKind === 'conditional logic' ? ['input', 'condition', 'chosen branch'] : codeKind === 'state logic' ? ['event', 'state change', 'screen'] : codeKind === 'button handler' ? ['click', 'handler', 'result'] : codeKind === 'React component' ? ['props', 'component tree', 'preview'] : codeKind === 'CSS layout' ? ['rules', 'box model', 'layout'] : ['input', 'operation', 'output']
  const codeInputHint = codeKind === 'API request' ? 'Paste a request payload or URL used by this code.' : codeKind === 'data transformation' ? 'Paste one real item from the list this code processes.' : codeKind === 'React component' ? 'Paste the props this component receives.' : codeKind === 'CSS layout' ? 'Paste the element size or content you want to preview.' : 'Paste a real input value used by this code.'
  const hasUserInput = modelInput.trim().length > 0
  const inputContract = useMemo(() => { const param = code.match(/function\s+\w+\s*\(([^)]*)\)|\(([^)]*)\)\s*=>/)?.[1] || code.match(/function\s+\w+\s*\(([^)]*)\)|\(([^)]*)\)\s*=>/)?.[2] || 'input'; const objectKeys = [...code.matchAll(/\b(\w+)\s*:/g)].map(m=>m[1]).slice(0,4); const collectionKeys = /\w+\[\w+\.(\w+)\]/g; const accessedKeys = [...code.matchAll(collectionKeys)].map(m=>m[1]); const itemKeys = [...code.matchAll(/\bitem\.(\w+)/g)].map(m=>m[1]); const keys = itemKeys.length ? [...new Set([...accessedKeys, ...itemKeys])] : accessedKeys.length ? [...new Set(accessedKeys)] : objectKeys; const example = /reduce|map|filter|sort/.test(code) ? `[${keys.length ? `{${keys.map(key=>`"${key}": ${/minutes|count|size|age|price|total/i.test(key) ? '1' : '"example"'}`).join(', ')}}` : '"example"'}]` : keys.length ? `{${keys.map(key=>`"${key}": ${/minutes|count|size|age|price|total/i.test(key) ? '1' : '"example"'}`).join(', ')}}` : /fetch|axios|http/.test(code) ? '{"query":"example"}' : /if|switch|\?/.test(code) ? 'true' : '"example"'; const shape = /reduce|map|filter|sort/.test(code) ? `a list of items with ${keys.join(', ') || 'the fields this code reads'}` : keys.length ? `a value with ${keys.join(', ')} so this code can read those fields` : 'the value passed into this code'; return { name: param.trim(), shape, example } }, [code])
  useEffect(() => { setModelInput(inputContract.example); setRunResult(null); setRunError(''); setModelOutput(`Edit ${inputContract.name}, then run it to see the result.`) }, [code])
  const modelResult = hasUserInput ? modelOutput : `${detail.label} is line ${selectedLine}. Edit the input below and press Run to see the real returned value.`
  const featureName = featureBrief.trim() || 'this feature'
  const insight = useMemo(() => analyzeFeature(featureBrief), [featureBrief])
  const collaborationMap = useMemo(() => [
    { key: 'intent', label: 'Design intent', value: featureName, detail: insight.summary },
    { key: 'data', label: 'Data to share', value: insight.data.split(/[.,—]/)[0], detail: insight.data },
    { key: 'states', label: 'UI states', value: insight.states.split('→')[0].trim(), detail: insight.states },
    { key: 'edges', label: 'Edge cases', value: insight.edges.split(',')[0], detail: insight.edges },
    { key: 'handoff', label: 'Handoff', value: 'One testable decision', detail: insight.handoff },
  ], [featureName, insight])
  const [selectedConcern, setSelectedConcern] = useState('intent')
  const selectedConcernData = collaborationMap.find(item => item.key === selectedConcern) || collaborationMap[0]
  const codeQuestions = [detail.question, `What value enters line ${selectedLine}?`, `What would a user see after this line?`]

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
  function analyze() {
    if (!hasUserInput) { setRunError(`Paste JSON for ${codeKind === 'data transformation' ? 'the list this code processes' : 'the value this code receives'}.`); setRunResult(null); return }
    setRunError(''); setAnalyzed(false); setIsModelRunning(true)
    window.setTimeout(() => {
      try {
        const parsed = JSON.parse(modelInput)
        if (codeKind === 'data transformation' && Array.isArray(parsed)) {
          const totals: Record<string, number> = parsed.reduce((sum: Record<string, number>, item: { category?: string; minutes?: number }) => { if (item.category) sum[item.category] = (sum[item.category] || 0) + Number(item.minutes || 0); return sum }, {})
          const winner = Object.entries(totals).sort((a, b) => (b[1] as number) - (a[1] as number))[0]
          if (!winner) throw new Error('The list has no category values.')
          setRunResult({ suggestion: winner[0], reason: winner[1] })
          setModelOutput(`Returned { suggestion: "${winner[0]}", reason: ${winner[1]} } from ${parsed.length} items.`)
        } else {
          setRunResult(null)
          setModelOutput(`Input received by ${inputContract.name}: ${JSON.stringify(parsed)}\n\nSelected code: ${lines[selectedLine - 1]?.trim() || 'the selected line'}\n\nThis is the live value available at this point. The visual output updates from your input; arbitrary code execution is not simulated.`)
        }
        setAnalyzed(true); setIsModelRunning(false)
      } catch {
        setRunError('That input does not match the expected JSON shape. Try the example shown below.'); setRunResult(null); setAnalyzed(true); setIsModelRunning(false)
      }
    }, 300)
  }
  function chooseAction(action: 'why' | 'break' | 'change') { setModelOutput(action === 'why' ? `Line ${selectedLine} matters because it changes what the user ultimately sees: ${detail.explain}` : action === 'break' ? `Try an empty value, a missing property, a failed request, and repeated clicks. Watch which step cannot produce a valid output.` : `Edit the input, run again, and compare the output with the previous run. The selected line is the change point.`) }
  function reset() { setCode(sampleCode); setSelectedLine(8); setSelectedRange([8, 8]); setTool('select'); setThreads([]); setNote(''); setMarks([]); setStrokes([]); setDrawingStroke(null); setAnalyzed(true); setPointing(false); setPointReady(false); setPointStart(null); setDrawOverlay(null); setFeedback('unreviewed'); setModelInput('[{"category":"Work","minutes":45},{"category":"Health","minutes":20}]'); setRunResult(null); setRunError(''); setModelOutput('Press Run example to see the returned value.') }
  function selectLine(no: number, extend = false) {
    if (tool === 'point') { setSelectedLine(no); setSelectedRange([no, no]); setPointing(true); setPointStart(no); return }
    const range: [number, number] = extend ? [Math.min(selectedLine, no), Math.max(selectedLine, no)] : [no, no]
    setSelectedRange(range); setSelectedLine(no)
  }
  function startDrawing(event: React.PointerEvent<HTMLDivElement>) {
    if (tool !== 'point') return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setDrawingStroke({ points: [point] })
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer capture is best-effort */ }
  }
  function draw(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingStroke) return
    const rect = event.currentTarget.getBoundingClientRect()
    setDrawingStroke({ points: [...drawingStroke.points, { x: event.clientX - rect.left, y: event.clientY - rect.top }] })
  }
  function finishDrawing() {
    if (drawingStroke && drawingStroke.points.length > 3) {
      setStrokes(s => [...s, drawingStroke])
      const ys = drawingStroke.points.map(p => p.y)
      const xs = drawingStroke.points.map(p => p.x)
      const lineHeight = 22, topPad = 15
      const topLine = Math.max(1, Math.min(lines.length, Math.round((Math.min(...ys) - topPad) / lineHeight) + 1))
      const bottomLine = Math.max(1, Math.min(lines.length, Math.round((Math.max(...ys) - topPad) / lineHeight) + 1))
      const lo = Math.min(topLine, bottomLine), hi = Math.max(topLine, bottomLine)
      setSelectedRange([lo, hi]); setSelectedLine(hi); setPointReady(true)
      setDrawOverlay({ x: Math.max(...xs), y: drawingStroke.points[drawingStroke.points.length - 1].y })
    }
    setDrawingStroke(null)
  }
  function finishPoint(no: number) { setSelectedRange([Math.min(pointStart ?? no, no), Math.max(pointStart ?? no, no)]); setSelectedLine(no); setPointing(false); setPointReady(true); setPointStart(null) }
  function askAboutPoint() { ask(`Explain the highlighted ${codeKind.toLowerCase()} from lines ${selectedRange[0]}–${selectedRange[1]} using the pasted code.`) }
  return <main className="mould-app">
    <header className="app-bar"><div className="wordmark"><span className="mark"><GitBranch /></span><b>mould</b><small>code, made visible</small></div><div className="bar-center"><span className="live"/> LIVE SESSION <span className="slash">/</span> {view === 'explainer' ? 'Code explainer' : 'Be friends with engineer'}</div><nav className="view-switcher" aria-label="Workspace"><button className={view==='explainer'?'view-active':''} onClick={()=>setView('explainer')}>Explain code</button><button className={view==='playground'?'view-active':''} onClick={()=>setView('playground')}>Be friends with engineer</button></nav><div className="bar-actions"><button onClick={reset} aria-label="Reset session"><RotateCcw/></button><button className="avatar">J</button></div></header>
    <section className="hero"><div><p className="eyebrow"><Sparkles/> {view==='playground'?'A design & engineering conversation':'A code conversation'}</p><h1>{view==='playground'?<>Turn intent into<br/><em>a shared decision.</em></>:<>Point at the part<br/><em>you don&apos;t understand.</em></>}</h1><p className="hero-copy">{view==='playground'?'Describe what you are building below. Mould reads the intent and builds a designer and engineer view around it — not a generic checklist.':'Select a line to understand it, then run the example below to see the real returned output. Change the input to explore how the behavior changes.'}</p></div>{view==='explainer'&&<div className="analyze-status"><span className={analyzed?'status-dot ready':'status-dot'}/>{analyzed?'Code mapped':'Reading code…'}<button onClick={analyze} disabled={!analyzed}><Play/> Analyze</button></div>}</section>
    {view === 'explainer' ? <section className="workspace">
      <div className="code-pane widget"><div className="pane-head"><div><span className="pane-label">Source · editable</span><h2>Your code</h2></div><span className="js-badge">JS</span></div><div className="instruction">Click a line to understand it. Shift-click another line to explain a range. Use Trace from here to draw over the code.</div><div className="code-toolbar"><button type="button" className={tool==='select'?'tool-active':''} onClick={()=>{setTool('select');setPointing(false);setDrawOverlay(null)}}><MousePointer2/> Select <small>line</small></button><button type="button" className={tool==='point'?'tool-active':''} onClick={()=>{setTool('point');setPointing(false);setDrawOverlay(null)}}><Highlighter/> Trace from here <small>draw</small></button><span/><button onClick={reset}><RotateCcw/> Reset</button></div><div className="editor"><div className="line-numbers">{lines.map((_,i)=><button key={i} className={i+1>=selectedRange[0]&&i+1<=selectedRange[1]?'line-active':''} onPointerDown={()=>{if(tool==='point'){setPointing(true);setPointStart(i+1)}}} onPointerEnter={()=>{if(tool==='point'&&pointing) setSelectedRange([Math.min(pointStart??i+1,i+1),Math.max(pointStart??i+1,i+1)])}} onPointerUp={()=>{if(tool==='point') finishPoint(i+1)}} onClick={(event)=>selectLine(i+1,event.shiftKey)}>{String(i+1).padStart(2,'0')}</button>)}</div><textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false} aria-label="Paste or edit code"/><div className={`ink-layer ${tool==='point'?'ink-active':''}`} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} aria-label="Point and draw over code">{[...strokes, ...(drawingStroke?[drawingStroke]:[])].map((stroke,index)=><svg key={index} className="ink-stroke" aria-hidden="true"><polyline points={stroke.points.map(point=>`${point.x},${point.y}`).join(' ')}/></svg>)}</div>{drawOverlay&&pointReady&&tool==='point'&&<div className="trace-overlay" style={{left:Math.min(drawOverlay.x+14,300),top:Math.max(drawOverlay.y-8,0)}}><span>Traced lines {selectedRange[0]}–{selectedRange[1]}</span><button type="button" onClick={()=>{setDrawOverlay(null);setPointReady(false);askAboutPoint()}}>Ask about this <ArrowRight/></button></div>}</div><div className="code-foot"><span>{lines.length} lines · editable</span><span>{tool==='point'?'Drag across line numbers to highlight a range':'Click one line to explain it; Shift-click to extend the selection'}</span></div>{note&&<div className="inline-note"><Pencil/> {note}<button onClick={()=>setNote('')} aria-label="Remove note"><X/></button></div>}</div>
      <div className="explain-pane"><div className="pane-head"><div><span className="pane-label">Your selection</span><h2>Understand this code</h2></div><span className="map-meta">lines {selectedRange[0]}–{selectedRange[1]}</span></div><div className="selected-context"><span className="context-line">{selectedRange[0] === selectedRange[1] ? String(selectedLine).padStart(2,'0') : `${selectedRange[0]}–${selectedRange[1]}`}</span><div><b>{selectedRange[0] === selectedRange[1] ? detail.label : 'A connected block of code'}</b><code>{lines.slice(selectedRange[0]-1, selectedRange[1]).join(' ').trim() || '// choose lines'}</code></div><span className="tether-dot"/></div>{tool==='point'&&(pointing||pointReady)&&<div className="point-overlay"><b>{pointing?'Point mode':'Range selected'}</b><span>{pointing?'Drag across line numbers to highlight.':'Ask a question about the highlighted code.'}</span>{pointReady&&<button type="button" onClick={()=>{setPointReady(false);askAboutPoint()}}>Ask about this</button>}</div>}<div className="visual-model"><div className="model-head"><div><span className="plain-label">Live model · {codeKind}</span><b>Input → selected line → output</b></div><span className={isModelRunning?'model-status running':'model-status'}>{isModelRunning?'mapping…':'mapped from your code'}</span></div><div className="visual-stage"><div className="value-card"><span>Input from you</span><b>{modelInput || 'Add a value below to see it move'}</b></div><ArrowRight/><div className="value-card active-value"><span>Selected line {selectedLine}</span><b>{lines[selectedLine-1]?.trim() || 'Choose a line'}</b></div><ArrowRight/><div className="value-card"><span>What the user sees</span><b>{modelOutput || 'Run to see the result'}</b></div></div><div className="model-input"><div className="input-label"><label htmlFor="model-input">What should this function receive?</label><small><code>history</code> is a list of activity items. Edit the example or paste your own list.</small></div><textarea id="model-input" value={modelInput} onChange={e=>{setModelInput(e.target.value);setRunError('');setRunResult(null);setModelOutput('Press Run to calculate a new result from this input.')}} aria-label="Input data for the selected code"/><button type="button" onClick={analyze} disabled={isModelRunning}><Play/> {isModelRunning ? 'Running' : 'Run example'}</button></div><div className="input-helper"><span>Example shape</span><code>[&#123; &quot;category&quot;: &quot;Work&quot;, &quot;minutes&quot;: 45 &#125;]</code>{runError&&<b>{runError}</b>}</div><p className="model-output">{modelResult}</p><div className="model-badges"><span><Check/> Verified: line {selectedLine} is connected</span><span>Inferred: edge cases need your review</span></div><div className="context-actions">{codeQuestions.map(prompt=><button key={prompt} type="button" onClick={()=>ask(prompt)}>{prompt}</button>)}<button type="button" onClick={()=>chooseAction('why')}>Why does this matter?</button><button type="button" onClick={()=>chooseAction('break')}>What could break?</button><button type="button" onClick={()=>chooseAction('change')}>What if I change it?</button></div><div className="model-actions"><button type="button" aria-label="Mark explanation helpful" onClick={()=>setFeedback('approved')}>Thumbs up</button><button type="button" aria-label="Mark explanation unclear" onClick={()=>setFeedback('corrected')}>Thumbs down</button>{feedback==='approved'&&<b>Saved as a helpful format.</b>}{feedback==='corrected'&&<b>Try a smaller selection or ask a follow-up.</b>}</div></div><div className="explain-body"><span className="plain-label">This line, explained</span><p>{selectedRange[0] === selectedRange[1] ? detail.explain : `These ${selectedRange[1] - selectedRange[0] + 1} lines work together: ${detail.explain}`}</p><div className="decision-strip"><span>Why this matters in a real product</span><b>{detail.why}</b></div><div className="risk-row"><span>What could go wrong</span><p>{detail.risk}</p></div></div><div className="thread"><div className="thread-head"><MessageCircle/> Your questions <span>{threads.length}</span></div>{threads.length===0?<div className="empty-thread"><span>Ask anything about line {selectedLine}.</span><small>Try the prompt below. The answer will stay attached to this selection.</small></div>:threads.map(t=><div className="thread-item" key={t.id}><div className="you">You · line {t.lines.join(', ')}</div><b>{t.prompt}</b><p><span className="eng-dot"/> {t.answer}</p></div>)}<div className="suggestions"><span className="plain-label">Questions you can ask about line {selectedLine}</span><div className="quick-list"><button onClick={()=>ask(detail.question)}>{detail.question}<ArrowRight/></button><button onClick={()=>ask('What could go wrong here?')}>What could go wrong here?<ArrowRight/></button><button onClick={()=>ask('Explain this without code words')}>Explain this without code words<ArrowRight/></button></div></div><div className="question-row"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)ask()}} placeholder={`Ask about line ${selectedLine}…`} aria-label="Ask the engineer"/><button onClick={()=>ask()} aria-label="Send question"><ArrowRight/></button></div></div></div>
    </section>
    : <section className="playground"><div className="playground-header"><div><span className="pane-label">Be friends with engineer · interactive handoff</span><h2>Turn a design idea into a shared decision.</h2><p>Describe one feature in your own words below. Mould reads the intent and adapts the designer and engineer view to it — not a generic checklist everyone already knows.</p></div></div><div className="playground-input"><label htmlFor="feature-brief">What are you building?</label><textarea id="feature-brief" value={featureBrief} onChange={e=>setFeatureBrief(e.target.value)} placeholder="Describe the feature you are designing, e.g. Let users save a favorite article"/></div><div className="collab-board"><div className="collaboration-nodes">{collaborationMap.map(node=><button key={node.key} type="button" className={`collaboration-node ${selectedConcern===node.key?'node-selected':''}`} onClick={()=>setSelectedConcern(node.key)}><span>{node.label}</span><b>{node.value}</b></button>)}</div><div className="collaboration-detail"><span>{selectedConcernData.label}</span><p>{selectedConcernData.detail}</p></div><div className="pov-grid"><article className="pov-card pov-designer"><div className="pov-head"><Pencil/><span>Designer lens</span></div><b>{insight.designer.question}</b><ul>{insight.designer.points.map(point=><li key={point}>{point}</li>)}</ul></article><article className="pov-card pov-engineer"><div className="pov-head"><Code2/><span>Engineer lens</span></div><b>{insight.engineer.question}</b><ul>{insight.engineer.points.map(point=><li key={point}>{point}</li>)}</ul></article></div><div className="handoff-card"><span className="pane-label">Shared handoff for &ldquo;{featureName}&rdquo;</span><p>{insight.handoff}</p></div></div><div className="question-dock"><span className="pane-label">Continue the conversation</span><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229){setView('explainer');setQuestion(question || 'What should I clarify before handing this off?')}}} placeholder="Ask what to clarify with engineering…"/><button onClick={()=>{setView('explainer');setQuestion(question || 'What should I clarify before handing this off?')}}>Ask Mould <ArrowRight/></button></div></section>}
    <footer className="footer-note"><span><Code2/> Mould translates engineering decisions into a conversation.</span><span>Hackathon prototype · local session</span></footer>
  </main>
}
