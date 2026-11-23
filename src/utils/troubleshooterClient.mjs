// Browser side of /troubleshooting/. The page is complete without this: every
// step is in the HTML and the answers are links to the next step's anchor.
// This narrows it to one step at a time and lists the answers given so far.
//
// The address stays in charge. An answer is still a plain link, so this only
// reacts to the fragment changing, which keeps the back button, reload and a
// copied link all working.
import { nextTrail, parseAnchor, rememberPath, stepAnchor } from './troubleshooting.mjs';

/**
 * @param {HTMLElement} root The element holding the problem list and the flows.
 * @param {Window} [win]
 */
export function enhanceTroubleshooter(root, win = window) {
  const doc = win.document;
  /** @type {HTMLElement | null} */
  const problems = root.querySelector('[data-ts-problems]');
  /** @type {HTMLElement[]} */
  const flows = [...root.querySelectorAll('[data-ts-flow]')];
  if (!problems || flows.length === 0) return;

  /** @param {HTMLElement} flow @returns {HTMLElement[]} */
  const stepsOf = (flow) => [...flow.querySelectorAll('[data-ts-step]')];
  /** @param {HTMLElement} flow @param {string} id */
  const stepIn = (flow, id) => stepsOf(flow).find((step) => step.dataset.tsStep === id) ?? null;
  /** The links that lead on from a step. @param {HTMLElement} step @returns {HTMLAnchorElement[]} */
  const onwardLinks = (step) => [...step.querySelectorAll('.ts-answers a[href^="#"]')];
  /** @param {HTMLAnchorElement} link */
  const linkedStep = (link) => parseAnchor(link.getAttribute('href') ?? '')?.stepId ?? null;

  /** The flow on screen and the steps taken in it, oldest first. */
  let current = { flowId: '', trail: /** @type {string[]} */ ([]) };

  // The path last taken through each flow, kept for the tab's lifetime so the
  // answers survive a reload, "Start over" followed by Back, and a detour into
  // another flow. Storage can be unavailable (private windows, blocked site
  // data); the page then simply forgets on reload.
  const storageKey = (/** @type {string} */ flowId) => `troubleshooter:${flowId}`;
  /** @type {Map<string, string[]>} */
  const paths = new Map();
  /** @param {HTMLElement} flow @returns {string[]} */
  function knownPath(flow) {
    const held = paths.get(flow.id);
    if (held) return held;
    /** @type {string[]} */
    let stored = [];
    try {
      const parsed = JSON.parse(win.sessionStorage.getItem(storageKey(flow.id)) ?? '[]');
      // Written before the tree was last edited? Then it may name steps that
      // are gone; drop it rather than show a broken list.
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string' && stepIn(flow, id))) stored = parsed;
    } catch {
      // Unreadable or unavailable: start with nothing remembered.
    }
    paths.set(flow.id, stored);
    return stored;
  }
  /** @param {HTMLElement} flow @param {string[]} trail */
  function remember(flow, trail) {
    const path = rememberPath(knownPath(flow), trail);
    paths.set(flow.id, path);
    try {
      win.sessionStorage.setItem(storageKey(flow.id), JSON.stringify(path));
    } catch {
      // See above.
    }
  }

  /** @param {HTMLElement} flow @param {string[]} trail */
  function renderTrail(flow, trail) {
    /** @type {HTMLElement | null} */
    const box = flow.querySelector('[data-ts-trail]');
    const list = box?.querySelector('ol');
    if (!box || !list) return;

    const items = trail.slice(0, -1).map((id, index) => {
      const step = stepIn(flow, id);
      const title = step?.querySelector('[data-ts-title]')?.textContent ?? id;
      // The answer given is the link that leads to the next step on the trail.
      const taken = step ? onwardLinks(step).find((link) => linkedStep(link) === trail[index + 1]) : undefined;
      const answer = taken?.dataset.tsAnswer;

      const item = doc.createElement('li');
      const link = doc.createElement('a');
      link.href = `#${stepAnchor(flow.id, id)}`;
      link.textContent = answer ? title : `${box.dataset.triedLabel ?? ''} ${title}`.trim();
      item.append(link);
      if (answer) {
        const label = doc.createElement('span');
        label.className = 'ts-trail-answer';
        label.textContent = answer;
        item.append(' ', label);
      }
      return item;
    });

    list.replaceChildren(...items);
    box.hidden = items.length === 0;
  }

  /** @param {{ focus: boolean }} options */
  function render({ focus }) {
    const target = parseAnchor(win.location.hash);
    const flow = target ? flows.find((candidate) => candidate.id === target.flowId) : undefined;

    if (!flow) {
      current = { flowId: '', trail: [] };
      problems.hidden = false;
      for (const other of flows) other.hidden = true;
      // Only take the focus when the visitor asked to come back here.
      if (focus && win.location.hash === `#${problems.id}`) {
        problems.querySelector('h2')?.focus({ preventScroll: true });
        problems.scrollIntoView({ block: 'start' });
      }
      return;
    }

    const start = flow.dataset.start ?? '';
    const step = stepIn(flow, target?.stepId ?? start) ?? stepIn(flow, start);
    if (!step) return;
    const stepId = step.dataset.tsStep ?? '';

    const trail = current.flowId === flow.id ? current.trail : [];
    const last = trail.length > 0 ? stepIn(flow, trail[trail.length - 1]) : null;
    const reachable = last ? onwardLinks(last).map(linkedStep).filter((id) => id !== null) : [];
    current = { flowId: flow.id, trail: nextTrail(trail, stepId, reachable, knownPath(flow)) };
    remember(flow, current.trail);

    problems.hidden = true;
    for (const other of flows) other.hidden = other !== flow;
    for (const other of stepsOf(flow)) other.hidden = other !== step;
    renderTrail(flow, current.trail);

    // The flow's heading, the step and its answers fit a phone screen from
    // here; the answers so far sit below them.
    flow.scrollIntoView({ block: 'start' });
    // Move the focus to the new step, so a screen reader announces it and the
    // next Tab lands on its answers.
    if (focus) step.querySelector('[data-ts-title]')?.focus({ preventScroll: true });
  }

  // Paper cannot follow one step at a time: print the whole list.
  win.addEventListener('beforeprint', () => {
    delete root.dataset.enhanced;
    problems.hidden = false;
    for (const flow of flows) {
      flow.hidden = false;
      for (const step of stepsOf(flow)) step.hidden = false;
      const trail = flow.querySelector('[data-ts-trail]');
      if (trail) trail.hidden = true;
    }
  });
  win.addEventListener('afterprint', () => {
    root.dataset.enhanced = '';
    render({ focus: false });
  });

  // Each step is scrolled into place by render(). Left on, the browser would
  // then restore the scroll position it recorded for a history entry, measured
  // against a page that was showing a different step.
  if ('scrollRestoration' in win.history) win.history.scrollRestoration = 'manual';

  win.addEventListener('hashchange', () => render({ focus: true }));
  root.dataset.enhanced = '';
  render({ focus: false });
}
