// Guards the troubleshooter: the checks that keep a decision tree walkable, the
// trail of answers the browser script keeps, and the flows authored in
// src/content/troubleshooting/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextTrail, parseAnchor, rememberPath, stepAnchor, stepTargets, validateFlow } from '../../src/utils/troubleshooting.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const flowsDir = path.join(repoRoot, 'src/content/troubleshooting');

const question = (id, yes, no) => ({ type: 'question', id, question: `${id}?`, yes, no });
const fix = (id, next) => ({ type: 'fix', id, title: id, body: 'Do this.', ...(next ? { next } : {}) });
const ask = (id) => ({ type: 'ask', id, title: id, body: 'Ask.', include: ['Model'] });

const VALID = {
  start: 'antenna',
  steps: [question('antenna', 'region', 'attach'), fix('attach', 'region'), question('region', 'ask', 'set-region'), fix('set-region'), ask('ask')],
};

test('should accept a flow whose steps all join up', () => {
  assert.deepEqual(validateFlow(VALID), []);
});

test('should reject a first step that is missing or not a question', () => {
  assert.match(validateFlow({ ...VALID, start: 'nowhere' }).join('\n'), /first step "nowhere" does not exist/);
  assert.match(validateFlow({ start: 'attach', steps: [fix('attach')] }).join('\n'), /must be a question/);
});

test('should reject an answer that leads to a step that does not exist', () => {
  const flow = { start: 'antenna', steps: [question('antenna', 'ask', 'typo'), ask('ask')] };
  assert.deepEqual(validateFlow(flow), ['Step "antenna" leads to "typo", which does not exist.']);
});

test('should reject two steps with the same id', () => {
  const flow = { start: 'antenna', steps: [question('antenna', 'ask', 'fix'), fix('fix'), fix('fix'), ask('ask')] };
  assert.match(validateFlow(flow).join('\n'), /Two steps share the id "fix"/);
});

test('should reject a step nothing leads to', () => {
  const flow = { ...VALID, steps: [...VALID.steps, fix('orphan')] };
  assert.deepEqual(validateFlow(flow), ['Nothing leads to step "orphan".']);
});

test('should reject a path that loops', () => {
  const flow = { start: 'antenna', steps: [question('antenna', 'ask', 'attach'), fix('attach', 'antenna'), ask('ask')] };
  assert.match(validateFlow(flow).join('\n'), /Step "antenna" leads back to itself/);
});

test('should reject a question whose answers both lead to the same step', () => {
  const flow = { start: 'antenna', steps: [question('antenna', 'ask', 'ask'), ask('ask')] };
  assert.match(validateFlow(flow).join('\n'), /the question decides nothing/);
});

test('should allow two paths to share a step', () => {
  // "attach" and the "yes" answer both lead to "region": a join, not a loop.
  assert.deepEqual(stepTargets(VALID.steps[0]), ['region', 'attach']);
  assert.deepEqual(validateFlow(VALID), []);
});

test('should read a flow and a step out of a URL fragment', () => {
  assert.equal(stepAnchor('no-nodes', 'set-region'), 'no-nodes--set-region');
  assert.deepEqual(parseAnchor('#no-nodes--set-region'), { flowId: 'no-nodes', stepId: 'set-region' });
  assert.deepEqual(parseAnchor('#no-nodes'), { flowId: 'no-nodes', stepId: null });
  assert.deepEqual(parseAnchor('no-nodes'), { flowId: 'no-nodes', stepId: null });
  assert.equal(parseAnchor(''), null);
  assert.equal(parseAnchor('#'), null);
  assert.equal(parseAnchor('#no-nodes--'), null);
  assert.equal(parseAnchor('#%E0%A4%A'), null);
});

test('should add a step to the trail when the current step leads to it', () => {
  assert.deepEqual(nextTrail(['antenna'], 'region', ['region', 'attach']), ['antenna', 'region']);
});

test('should cut the trail back when the visitor returns to an earlier step', () => {
  assert.deepEqual(nextTrail(['antenna', 'region', 'ask'], 'region', []), ['antenna', 'region']);
  assert.deepEqual(nextTrail(['antenna', 'region'], 'region', []), ['antenna', 'region']);
});

test('should bring back the earlier path when the visitor returns to a step on it', () => {
  // "Start over", then the back button to where they had got to.
  assert.deepEqual(nextTrail(['antenna'], 'ask', ['region', 'attach'], ['antenna', 'region', 'ask']), ['antenna', 'region', 'ask']);
  // A reload: nothing on the trail yet.
  assert.deepEqual(nextTrail([], 'region', [], ['antenna', 'region', 'ask']), ['antenna', 'region']);
});

test('should remember the longest path until the visitor takes a different one', () => {
  assert.deepEqual(rememberPath(['antenna', 'region', 'ask'], ['antenna']), ['antenna', 'region', 'ask']);
  assert.deepEqual(rememberPath(['antenna', 'region'], ['antenna', 'region', 'ask']), ['antenna', 'region', 'ask']);
  assert.deepEqual(rememberPath(['antenna', 'region', 'ask'], ['antenna', 'attach']), ['antenna', 'attach']);
  assert.deepEqual(rememberPath([], ['antenna']), ['antenna']);
});

test('should check a long flow without walking every path through it', () => {
  // Each question can be passed two ways (yes, or no then the fix), so 60 of
  // them make 2^60 paths. Walking each step once, this is instant.
  const steps = [];
  for (let i = 0; i < 60; i++) {
    const next = i === 59 ? 'ask' : `q${i + 1}`;
    steps.push(question(`q${i}`, next, `f${i}`), fix(`f${i}`, next));
  }
  assert.deepEqual(validateFlow({ start: 'q0', steps: [...steps, ask('ask')] }), []);
});

test('should start a new trail for a step reached from outside the path', () => {
  assert.deepEqual(nextTrail([], 'antenna', []), ['antenna']);
  assert.deepEqual(nextTrail(['antenna'], 'ask', ['region', 'attach']), ['ask']);
});

const flows = fs
  .readdirSync(flowsDir)
  // A leading underscore marks a draft, which the site leaves out.
  .filter((name) => /^[^_].*\.json$/.test(name))
  .map((name) => ({ id: name.replace(/\.json$/, ''), ...JSON.parse(fs.readFileSync(path.join(flowsDir, name), 'utf8')) }));

test('should cover the four starting problems', () => {
  // The guides link to these by name; more may be added alongside them.
  const ids = flows.map((flow) => flow.id);
  for (const id of ['app-wont-connect', 'battery-drain', 'messages-not-delivered', 'no-nodes']) {
    assert.ok(ids.includes(id), `src/content/troubleshooting/${id}.json is missing`);
  }
});

for (const flow of flows) {
  test(`should have a walkable tree for "${flow.id}"`, () => {
    assert.deepEqual(validateFlow(flow), []);
    // The file name is the flow's anchor, and "--" separates it from a step.
    assert.match(flow.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test(`should only link "${flow.id}" to problems that exist`, () => {
    const links = flow.steps.flatMap((step) => step.links ?? []).filter((link) => link.href.startsWith('#'));
    for (const link of links) {
      assert.ok(flows.some((other) => other.id === link.href.slice(1)), `${link.href} is not a problem on the page`);
    }
  });
}
