(function (root) {
  'use strict';
  const STATE_KEY = 'floralabNavigation';
  const TABS = ['work', 'explore', 'render', 'recipe', 'structure', 'build', 'feedback', 'history'];
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,180}$/.test(value) ? value : null;
  function normalize(route) {
    if (!route || typeof route !== 'object') return null;
    if (route.page === 'home' || route.page === 'create') return { page: route.page };
    if (route.page === 'materials') {
      const materialId = id(route.materialId);
      return materialId ? { page: 'materials', materialId } : { page: 'materials' };
    }
    if (route.page === 'result' && id(route.projectId)) {
      return { page: 'result', projectId: route.projectId, tab: TABS.includes(route.tab) ? route.tab : 'work' };
    }
    return null;
  }
  function format(route) {
    const next = normalize(route);
    if (!next) return '#/home';
    if (next.page === 'result') return `#/project/${encodeURIComponent(next.projectId)}/${next.tab}`;
    return `#/${next.page}${next.materialId ? '/' + encodeURIComponent(next.materialId) : ''}`;
  }
  function parse(hash) {
    if (typeof hash !== 'string' || !hash.startsWith('#/')) return null;
    let parts;
    try { parts = hash.slice(2).split('/').map(decodeURIComponent); } catch { return null; }
    if (parts.length === 1 && ['home', 'create', 'materials'].includes(parts[0])) return { page: parts[0] };
    if (parts.length === 2 && parts[0] === 'materials' && id(parts[1])) return { page: 'materials', materialId: parts[1] };
    if (parts[0] === 'project' && parts.length === 3 && id(parts[1]) && TABS.includes(parts[2])) {
      return { page: 'result', projectId: parts[1], tab: parts[2] };
    }
    return null;
  }
  const scrollValue = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  const same = (a, b) => Boolean(a && b && format(a) === format(b));

  function create({ window: win, onNavigate, onError = error => win.console?.error(error) }) {
    if (!win?.history || typeof onNavigate !== 'function') throw new TypeError('Navigation requires window and onNavigate');
    const history = win.history;
    const previousScrollRestoration = history.scrollRestoration;
    let route = parse(win.location.hash) || { page: 'home' };
    let savedScroll = scrollValue(win.scrollY);
    let epoch = 0, pending = null, disposed = false;
    try { history.scrollRestoration = 'manual'; } catch { /* Browser may restrict history access. */ }

    function stateFor(next, scrollY) {
      const previous = history.state && typeof history.state === 'object' && !Array.isArray(history.state) ? history.state : {};
      return { ...previous, [STATE_KEY]: { version: 1, route: normalize(next), scrollY: scrollValue(scrollY) } };
    }
    function write(method, next, scrollY, keepURL = false) {
      try {
        const url = keepURL ? undefined : `${win.location.pathname}${win.location.search}${format(next)}`;
        history[method](stateFor(next, scrollY), '', url);
        return true;
      } catch { return false; }
    }
    function entryScroll(next) {
      const state = history.state?.[STATE_KEY];
      return state?.version === 1 && same(state.route, next) ? scrollValue(state.scrollY) : 0;
    }
    function captureScroll() {
      if (disposed || pending) return;
      savedScroll = scrollValue(win.scrollY);
      write('replaceState', route, savedScroll, true);
    }
    function record(value, { replace = false } = {}) {
      const next = normalize(value);
      if (!next || disposed) return false;
      // Rendering the destination of a traversal must not create a new entry.
      if (pending && same(next, pending.route)) {
        route = next;
        return write('replaceState', next, pending.scrollY);
      }
      if (pending) { epoch++; pending = null; }
      if (same(next, route)) {
        route = next;
        return write('replaceState', next, savedScroll);
      }
      // Scroll events saved the departing page before a new render can shorten it.
      if (!replace) write('replaceState', route, savedScroll, true);
      route = next;
      savedScroll = 0;
      const written = write(replace ? 'replaceState' : 'pushState', next, 0);
      win.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      return written;
    }
    async function navigate(next, source) {
      if (disposed) return false;
      const token = ++epoch;
      const targetScroll = entryScroll(next);
      route = next;
      savedScroll = targetScroll;
      pending = { token, route: next, scrollY: targetScroll };
      const isCurrent = () => !disposed && token === epoch;
      try {
        await onNavigate({ ...next }, { source, isCurrent });
        if (!isCurrent()) return false;
        // Wait until the restored DOM has participated in layout before scrolling.
        await new Promise(resolve => win.requestAnimationFrame ? win.requestAnimationFrame(resolve) : resolve());
        if (!isCurrent()) return false;
        savedScroll = targetScroll;
        write('replaceState', next, savedScroll);
        win.scrollTo({ left: 0, top: savedScroll, behavior: 'instant' });
        return true;
      } finally {
        if (pending?.token === token) pending = null;
      }
    }
    function onPopState() {
      navigate(parse(win.location.hash) || { page: 'home' }, 'popstate').catch(onError);
    }
    function restore() {
      const initial = parse(win.location.hash);
      return initial ? navigate(initial, 'restore') : Promise.resolve(false);
    }
    function dispose() {
      disposed = true;
      epoch++;
      pending = null;
      win.removeEventListener('popstate', onPopState);
      win.removeEventListener('scroll', captureScroll);
      win.removeEventListener('pagehide', captureScroll);
      try { history.scrollRestoration = previousScrollRestoration; } catch { /* No recovery needed. */ }
    }
    win.addEventListener('popstate', onPopState);
    win.addEventListener('scroll', captureScroll, { passive: true });
    win.addEventListener('pagehide', captureScroll);
    return { record, restore, current: () => ({ ...route }), dispose };
  }
  const api = { create, normalize, parse, format };
  root.FloraLabNavigation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
