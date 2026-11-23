/**
 * Helpers for the troubleshooter at /troubleshooting/, shared by the content
 * schema, the page, its browser script and the tests. Plain JS for the same
 * reason as href.mjs: `npm test` imports it on Node 20, which cannot strip
 * types. Nothing here touches the DOM or the file system.
 *
 * A flow is one starting problem ("I can't see any other nodes"): a JSON file
 * in src/content/troubleshooting/ holding a list of steps that point at each
 * other by id.
 *
 * @typedef {{ label: string, href: string }} FlowLink
 * @typedef {{ type: 'question', id: string, question: string, help?: string, yes: string, no: string }} QuestionStep
 * @typedef {{ type: 'fix', id: string, title: string, body: string, steps?: string[], links?: FlowLink[], next?: string }} FixStep
 * @typedef {{ type: 'ask', id: string, title: string, body: string, include: string[] }} AskStep
 * @typedef {QuestionStep | FixStep | AskStep} FlowStep
 * @typedef {{ start: string, steps: FlowStep[] }} Flow
 */

/** Where the troubleshooter lives on the site. */
export const TROUBLESHOOTING_PATH = '/troubleshooting/';

const SEPARATOR = '--';

/**
 * The id a step has on the page. Flow and step ids are single-hyphenated
 * slugs, so the double hyphen cannot appear inside either.
 *
 * @param {string} flowId
 * @param {string} stepId
 */
export const stepAnchor = (flowId, stepId) => `${flowId}${SEPARATOR}${stepId}`;

/**
 * Split a URL fragment into the flow and step it names. A bare flow id means
 * "that flow, from its first question".
 *
 * @param {string} hash With or without the leading `#`.
 * @returns {{ flowId: string, stepId: string | null } | null}
 */
export function parseAnchor(hash) {
  let anchor = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    anchor = decodeURIComponent(anchor);
  } catch {
    return null;
  }
  if (!anchor) return null;
  const at = anchor.indexOf(SEPARATOR);
  if (at === -1) return { flowId: anchor, stepId: null };
  const flowId = anchor.slice(0, at);
  const stepId = anchor.slice(at + SEPARATOR.length);
  return flowId && stepId ? { flowId, stepId } : null;
}

/**
 * The ids a step can lead to.
 *
 * @param {FlowStep} step
 * @returns {string[]}
 */
export function stepTargets(step) {
  if (step.type === 'question') return [step.yes, step.no];
  if (step.type === 'fix' && step.next) return [step.next];
  return [];
}

/**
 * Check that a flow's steps join up: the problems a schema cannot see field by
 * field. Returns one message per problem, in plain language, because whoever
 * reads them is probably editing the tree in the CMS.
 *
 * A flow has to be a tree that only ever moves forward. A loop would leave a
 * visitor going round in circles, and a step nothing leads to is content
 * nobody can reach.
 *
 * @param {Flow} flow
 * @returns {string[]}
 */
export function validateFlow(flow) {
  const errors = [];
  /** @type {Map<string, FlowStep>} */
  const byId = new Map();

  for (const step of flow.steps) {
    if (byId.has(step.id)) errors.push(`Two steps share the id "${step.id}". Every step needs its own.`);
    else byId.set(step.id, step);
  }

  const start = byId.get(flow.start);
  if (!start) errors.push(`The first step "${flow.start}" does not exist.`);
  else if (start.type !== 'question') errors.push(`The first step "${flow.start}" must be a question.`);

  for (const step of byId.values()) {
    for (const target of stepTargets(step)) {
      if (!byId.has(target)) errors.push(`Step "${step.id}" leads to "${target}", which does not exist.`);
    }
    if (step.type === 'question' && step.yes === step.no) {
      errors.push(`Both answers to "${step.id}" lead to "${step.yes}", so the question decides nothing.`);
    }
  }

  // One depth-first pass from the first step. `open` holds the chain of steps
  // that led here, so meeting one of them again is a loop. Each step is walked
  // once however many paths join at it.
  const reached = new Set();
  const open = new Set();
  const looping = new Set();
  /** @param {string} id */
  const walk = (id) => {
    if (open.has(id)) {
      looping.add(id);
      return;
    }
    const step = byId.get(id);
    if (!step || reached.has(id)) return;
    reached.add(id);
    open.add(id);
    for (const target of stepTargets(step)) walk(target);
    open.delete(id);
  };
  if (start) walk(flow.start);

  for (const id of looping) errors.push(`Step "${id}" leads back to itself, so that path never ends.`);
  if (start) {
    for (const id of byId.keys()) {
      if (!reached.has(id)) errors.push(`Nothing leads to step "${id}".`);
    }
  }

  return errors;
}

/**
 * The steps taken so far, after moving to `target`.
 *
 * Going back to a step already on the trail drops everything after it. A step
 * the current one leads to is added. A step on `known`, the path this visitor
 * took earlier, brings that path back up to it: that is the back button after
 * "Start over", or a reload. Anything else - a link someone was sent - starts a
 * new trail, because the answers that would have led there are unknown.
 *
 * @param {string[]} trail Step ids, oldest first.
 * @param {string} target
 * @param {string[]} reachable Ids the last step on the trail leads to.
 * @param {string[]} [known] The path last taken through this flow.
 * @returns {string[]}
 */
export function nextTrail(trail, target, reachable, known = []) {
  const at = trail.indexOf(target);
  if (at !== -1) return trail.slice(0, at + 1);
  if (trail.length > 0 && reachable.includes(target)) return [...trail, target];
  const before = known.indexOf(target);
  if (before !== -1) return known.slice(0, before + 1);
  return [target];
}

/**
 * The path to remember after the trail changed: the new trail, unless it is
 * just the start of the remembered one (the visitor went back and may yet go
 * forward again).
 *
 * @param {string[]} known
 * @param {string[]} trail
 * @returns {string[]}
 */
export function rememberPath(known, trail) {
  const isPrefix = trail.length <= known.length && trail.every((id, index) => known[index] === id);
  return isPrefix ? known : trail;
}
