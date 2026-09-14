'use strict';
const assert = require('assert/strict');
const Navigation = require('../public/core/navigation');
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const eq = (value, expected, message) => { assert.deepEqual(value, expected, message); checks++; };
const tick = () => new Promise(resolve => setImmediate(resolve));

function browser(hash = '') {
  const listeners = new Map();
  const entries = [{ url: `/floralab/${hash}`, state: null }];
  let index = 0;
  const location = { pathname: '/floralab/', search: '', hash };
  function updateLocation(url) {
    const parsed = new URL(url, 'https://example.test');
    Object.assign(location, { pathname: parsed.pathname, search: parsed.search, hash: parsed.hash });
  }
  const dispatch = type => { for (const listener of listeners.get(type) || []) listener({ type }); };
  const win = {
    location, scrollY: 0, console,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    requestAnimationFrame(fn) { fn(); },
    scrollTo(x, y) { this.scrollY = typeof x === 'object' ? x.top : y; this.lastScroll = x; dispatch('scroll'); },
    history: {
      scrollRestoration: 'auto',
      get state() { return entries[index].state; },
      get length() { return entries.length; },
      replaceState(state, title, url) { entries[index] = { state: structuredClone(state), url: url || entries[index].url }; updateLocation(entries[index].url); },
      pushState(state, title, url) { entries.splice(index + 1); entries.push({ state: structuredClone(state), url }); index++; updateLocation(url); },
      back() { if (index) { index--; updateLocation(entries[index].url); dispatch('popstate'); } },
      forward() { if (index + 1 < entries.length) { index++; updateLocation(entries[index].url); dispatch('popstate'); } }
    }
  };
  return win;
}

async function main() {
  for (const tab of ['work', 'explore', 'render', 'recipe', 'structure', 'build', 'feedback', 'history']) {
    const route = { page: 'result', projectId: 'a-b:12_3', tab };
    eq(Navigation.parse(Navigation.format(route)), route, `round trip ${tab}`);
  }
  for (const hash of ['', '#unfinished', '#/project/secret/unknown', '#/project/%E0%A4%A/work', '#/project/a%2Fb/work', '#/home/extra', '#/materials/x/y']) {
    eq(Navigation.parse(hash), null, `reject malformed route ${hash}`);
  }
  const secret = '送给某人的私人想法';
  eq(Navigation.normalize({ page: 'create', idea: secret, title: secret }), { page: 'create' }, 'only route fields retained');
  ok(!Navigation.format({ page: 'result', projectId: '123', tab: 'work', title: secret }).includes(secret), 'user text excluded from URL');
  eq(Navigation.normalize({ page: 'result', projectId: 'p1', tab: 'unknown' }).tab, 'work', 'unknown tab defaults to overview');

  const win = browser();
  const visits = [];
  let navigation;
  navigation = Navigation.create({ window: win, onNavigate: (route, context) => { visits.push({ route, source: context.source }); navigation.record(route); } });
  eq(await navigation.restore(), false, 'first visit does not resume last project implicitly');
  eq(visits.length, 0, 'empty hash does not trigger rendering');
  navigation.record({ page: 'home' });
  eq(win.history.length, 1, 'first home render replaces initial entry');
  win.scrollTo(0, 475);
  navigation.record({ page: 'create' });
  eq(win.history.length, 2, 'different page pushes once');
  eq(win.scrollY, 0, 'new page starts at top');
  eq(win.lastScroll.behavior, 'instant', 'CSS smooth scrolling cannot pollute a new history entry');
  navigation.record({ page: 'create' });
  eq(win.history.length, 2, 'same-page rerender does not push');
  const project = { page: 'result', projectId: 'p1', tab: 'recipe' };
  navigation.record(project);
  win.scrollTo(0, 612);
  win.scrollY = 0; // The next view is shorter; layout clamps scroll before its record call.
  navigation.record({ page: 'materials', materialId: 'flower:rose' });
  eq(Navigation.parse(win.location.hash), { page: 'materials', materialId: 'flower:rose' }, 'material detail route');
  win.history.back();
  await tick();
  eq(navigation.current(), project, 'back returns to same project and tab');
  eq(win.scrollY, 612, 'back restores departed scroll position');
  eq(win.lastScroll.behavior, 'instant', 'restoration reaches the saved scroll without an animation');
  eq(win.history.length, 4, 'pop rendering does not grow history');
  win.history.forward();
  await tick();
  eq(navigation.current().materialId, 'flower:rose', 'forward restores detail');
  win.history.back();
  await tick();
  win.history.back();
  await tick();
  win.history.back();
  await tick();
  eq(win.scrollY, 475, 'earlier home scroll also restored');
  eq(visits.at(-1).source, 'popstate', 'traversal source provided');
  navigation.dispose();
  eq(win.history.scrollRestoration, 'auto', 'native scroll mode restored on dispose');
  const count = visits.length;
  win.history.forward();
  await tick();
  eq(visits.length, count, 'dispose removes traversal listener');

  const reloadWin = browser('#/project/p2/structure');
  reloadWin.history.replaceState({ foreign: 'preserved', floralabNavigation: { version: 1, route: { page: 'result', projectId: 'p2', tab: 'structure' }, scrollY: 250 } }, '', reloadWin.location.hash);
  let restored;
  const reloadNav = Navigation.create({ window: reloadWin, onNavigate: route => { restored = route; } });
  ok(await reloadNav.restore(), 'refresh restores a hash route');
  eq(restored.tab, 'structure', 'refresh retains the selected tab');
  eq(reloadWin.scrollY, 250, 'refresh retains recorded scroll');
  eq(reloadWin.history.state.foreign, 'preserved', 'other history state preserved');
  reloadNav.record({ page: 'home' }, { replace: true });
  eq(reloadWin.history.length, 1, 'missing-project fallback replaces bad entry');
  eq(reloadWin.location.hash, '#/home', 'fallback repairs URL');
  reloadNav.dispose();

  // An older asynchronous project load must not replace a newer Back/Forward destination.
  const raceWin = browser();
  const waiting = [];
  const rendered = [];
  let raceNav;
  raceNav = Navigation.create({ window: raceWin, onNavigate: async (route, { isCurrent }) => {
    await new Promise(resolve => waiting.push({ route, resolve }));
    if (!isCurrent()) return;
    rendered.push(route);
    raceNav.record(route);
  } });
  raceNav.record({ page: 'home' });
  raceNav.record({ page: 'result', projectId: 'slow', tab: 'work' });
  raceWin.scrollTo(0, 420);
  raceNav.record({ page: 'result', projectId: 'fast', tab: 'recipe' });
  raceWin.history.back();
  raceWin.history.back();
  waiting[1].resolve();
  await tick();
  waiting[0].resolve();
  await tick();
  eq(rendered, [{ page: 'home' }], 'rapid back ignores superseded load');
  eq(raceWin.scrollY, 0, 'stale load cannot restore its scroll position');
  raceWin.history.forward();
  raceNav.record({ page: 'materials' });
  waiting[2].resolve();
  await tick();
  eq(raceNav.current(), { page: 'materials' }, 'new user navigation cancels pending restoration');
  eq(rendered.length, 1, 'cancelled project load does not render');
  raceWin.history.back();
  waiting[3].resolve();
  await tick();
  eq(raceWin.scrollY, 420, 'cancelled restoration retains destination scroll for later return');
  raceNav.dispose();

  const errorWin = browser();
  const errors = [];
  const errorNav = Navigation.create({ window: errorWin, onNavigate: async () => { throw new Error('load failed'); }, onError: error => errors.push(error.message) });
  errorNav.record({ page: 'home' });
  errorNav.record({ page: 'create' });
  errorWin.history.back();
  await tick();
  eq(errors, ['load failed'], 'asynchronous traversal failure is reported');
  errorNav.record({ page: 'materials' });
  eq(errorNav.current(), { page: 'materials' }, 'failed traversal does not leave navigation suppressed');
  errorNav.dispose();

  const restricted = browser();
  restricted.history.replaceState = restricted.history.pushState = () => { throw new Error('restricted'); };
  const restrictedNav = Navigation.create({ window: restricted, onNavigate() {} });
  eq(restrictedNav.record({ page: 'create' }), false, 'history restrictions do not break app rendering');
  eq(restrictedNav.current(), { page: 'create' }, 'app route still tracked when history unavailable');
  restrictedNav.dispose();
  console.log(`navigation: ${checks} checks passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
