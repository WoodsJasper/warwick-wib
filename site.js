const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const closeMenu = () => {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
};
menuButton.hidden = false;
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);

// Ordinary anchors work without JavaScript; this only marks the section in view.
const departmentLinks = [...document.querySelectorAll('.department-nav a')];
if (departmentLinks.length && 'IntersectionObserver' in window) {
  const highlight = id => departmentLinks.forEach(link => {
    if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  highlight(location.hash.slice(1) || 'board');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) highlight(entry.target.id); });
  }, {rootMargin: '-10% 0px -65% 0px', threshold: 0});
  document.querySelectorAll('.department').forEach(section => observer.observe(section));
  departmentLinks.forEach(link => link.addEventListener('click', () => highlight(link.hash.slice(1))));
}

// Keep dated events accurate even when the static site has not been rebuilt.
function refreshEventDates() {
  document.querySelectorAll('[data-event][data-end]').forEach(event => {
    const past = Date.now() >= Date.parse(event.dataset.end);
    event.dataset.status = past ? 'past' : 'upcoming';
    event.querySelectorAll('[data-event-status]').forEach(label => { label.textContent = past ? 'Past event' : 'Upcoming event'; });
    event.querySelectorAll('[data-calendar]').forEach(link => { link.hidden = past; });
    event.querySelectorAll('[data-past-notice]').forEach(note => { note.hidden = !past; });
  });
}
refreshEventDates();

const eventBrowser = document.querySelector('[data-event-browser]');
let filterEvents = () => {};
if (eventBrowser) {
  const category = eventBrowser.querySelector('#event-category');
  const period = eventBrowser.querySelector('#event-period');
  const cards = [...eventBrowser.querySelectorAll('[data-event]')];
  const params = new URLSearchParams(location.search);
  if ([...category.options].some(o => o.value === params.get('type'))) category.value = params.get('type');
  if ([...period.options].some(o => o.value === params.get('when'))) period.value = params.get('when');
  eventBrowser.querySelector('[data-browser-controls]').hidden = false;
  filterEvents = (updateURL = false) => {
    let count = 0;
    cards.forEach(card => {
      card.hidden = !((category.value === 'all' || category.value === card.dataset.category) && (period.value === 'all' || period.value === card.dataset.status));
      if (!card.hidden) count++;
    });
    eventBrowser.querySelector('[data-results]').textContent = `${count} ${count === 1 ? 'event' : 'events'}`;
    eventBrowser.querySelector('[data-empty]').hidden = count > 0;
    eventBrowser.querySelector('.reset-filter').disabled = category.value === 'all' && period.value === 'all';
    if (updateURL) {
      const query = new URLSearchParams();
      if (category.value !== 'all') query.set('type', category.value);
      if (period.value !== 'all') query.set('when', period.value);
      history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + location.hash);
    }
  };
  [category, period].forEach(input => input.addEventListener('change', () => filterEvents(true)));
  eventBrowser.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => { category.value = 'all'; period.value = 'all'; filterEvents(true); category.focus(); }));
  filterEvents();
}
let eventExpiryTimer;
function scheduleEventExpiry() {
  clearTimeout(eventExpiryTimer);
  refreshEventDates();
  filterEvents();
  const remaining = [...document.querySelectorAll('[data-event][data-end]')]
    .map(event => Date.parse(event.dataset.end) - Date.now()).filter(ms => ms > 0);
  if (remaining.length) eventExpiryTimer = setTimeout(scheduleEventExpiry, Math.min(Math.min(...remaining) + 50, 2147483647));
}
scheduleEventExpiry();
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleEventExpiry(); });

// Bookmarks contain resource identifiers only, stored on this device.
const saveKey = 'wib-saved-resources-v1';
let saved = new Set();
let persistentSaves = true;
try {
  const stored = JSON.parse(localStorage.getItem(saveKey) || '[]');
  if (Array.isArray(stored)) saved = new Set(stored.filter(id => typeof id === 'string'));
} catch { persistentSaves = false; }
const saveButtons = [...document.querySelectorAll('[data-save]')];
let filterResources = () => {};
function updateSavedControls() {
  saveButtons.forEach(button => {
    const active = saved.has(button.dataset.save);
    button.hidden = false;
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? 'Saved' : 'Save';
    button.setAttribute('aria-label', `${active ? 'Remove' : 'Save'} ${button.dataset.saveTitle}${active ? ' from saved resources' : ''}`);
  });
  const available = [...document.querySelectorAll('[data-resource-id]')];
  document.querySelectorAll('[data-saved-count]').forEach(count => { count.textContent = available.filter(card => saved.has(card.dataset.resourceId)).length; });
  const explanation = document.querySelector('.save-explanation');
  if (explanation) explanation.textContent = persistentSaves ? 'Saved resources stay on this device.' : 'Your browser cannot keep saved resources between visits. They are available for this visit.';
}
saveButtons.forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.save;
  if (saved.has(id)) saved.delete(id); else saved.add(id);
  try { localStorage.setItem(saveKey, JSON.stringify([...saved])); persistentSaves = true; } catch { persistentSaves = false; }
  updateSavedControls();
  const feedback = document.querySelector('[data-save-feedback]');
  feedback.textContent = `${button.dataset.saveTitle} ${saved.has(id) ? 'saved' : 'removed from saved resources'}.${persistentSaves ? '' : ' Saved for this visit only.'}`;
  // Keep focus usable if removing the last visible saved item.
  const removingVisibleItem = button.closest('[data-resource]') && !saved.has(id) && document.querySelector('[data-view="saved"][aria-pressed="true"]');
  filterResources();
  if (removingVisibleItem) document.querySelector('[data-view="saved"]').focus();
}));
updateSavedControls();
window.addEventListener('storage', event => {
  if (event.key !== saveKey) return;
  try { const ids = JSON.parse(event.newValue || '[]'); saved = new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []); } catch { saved = new Set(); }
  updateSavedControls(); filterResources();
});

const resourceBrowser = document.querySelector('[data-resource-browser]');
if (resourceBrowser) {
  const search = resourceBrowser.querySelector('#resource-search');
  const kind = resourceBrowser.querySelector('#resource-kind');
  const cards = [...resourceBrowser.querySelectorAll('[data-resource]')];
  const views = [...resourceBrowser.querySelectorAll('[data-view]')];
  const params = new URLSearchParams(location.search);
  search.value = params.get('q') || '';
  if ([...kind.options].some(o => o.value === params.get('kind'))) kind.value = params.get('kind');
  let view = params.get('view') === 'saved' ? 'saved' : 'all';
  const searchable = new Map(cards.map(card => [card, card.querySelector('.resource-category').textContent + ' ' + card.querySelector('.resource-content h2').textContent + ' ' + card.querySelector('.resource-content>p').textContent]));
  resourceBrowser.querySelector('[data-browser-controls]').hidden = false;
  filterResources = (updateURL = false) => {
    const words = search.value.trim().toLocaleLowerCase('en-GB').split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach(card => {
      const text = searchable.get(card).toLocaleLowerCase('en-GB');
      card.hidden = !(words.every(word => text.includes(word)) && (kind.value === 'all' || kind.value === card.dataset.kind) && (view === 'all' || saved.has(card.dataset.resourceId)));
      if (!card.hidden) count++;
    });
    views.forEach(button => button.setAttribute('aria-pressed', String(view === button.dataset.view)));
    resourceBrowser.querySelector('[data-results]').textContent = `${count} ${count === 1 ? 'resource' : 'resources'}`;
    resourceBrowser.querySelector('[data-empty]').hidden = count > 0;
    resourceBrowser.querySelector('[data-empty-title]').textContent = view === 'saved' && !search.value && kind.value === 'all' ? 'No saved resources yet' : 'No resources match';
    resourceBrowser.querySelector('[data-empty-description]').textContent = view === 'saved' ? 'Use Save on a resource to keep it here on this device.' : 'Try a different search or show all resources.';
    resourceBrowser.querySelector('.reset-filter').disabled = !search.value && kind.value === 'all' && view === 'all';
    if (updateURL) {
      const query = new URLSearchParams();
      if (search.value.trim()) query.set('q', search.value.trim());
      if (kind.value !== 'all') query.set('kind', kind.value);
      if (view === 'saved') query.set('view', view);
      history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + location.hash);
    }
  };
  search.addEventListener('input', () => filterResources(true));
  kind.addEventListener('change', () => filterResources(true));
  views.forEach(button => button.addEventListener('click', () => { view = button.dataset.view; filterResources(true); }));
  resourceBrowser.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => { search.value = ''; kind.value = 'all'; view = 'all'; filterResources(true); search.focus(); }));
  filterResources();
}

// Native dialogs provide focus containment and Escape handling.
const posterDialog = document.querySelector('.poster-viewer');
let posterOpener;
if (posterDialog && typeof posterDialog.showModal === 'function') {
  document.querySelectorAll('[data-poster]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    posterOpener = link;
    const image = document.createElement('img');
    image.width = 1080; image.height = 1350;
    image.src = link.href;
    image.alt = `${link.dataset.posterTitle} poster`;
    posterDialog.querySelector('[data-poster-stage]').replaceChildren(image);
    posterDialog.querySelector('#poster-dialog-title').textContent = link.dataset.posterTitle;
    posterDialog.querySelector('[data-poster-caption]').textContent = `Artwork: ${link.dataset.posterCredit}`;
    posterDialog.querySelector('[data-poster-download]').href = link.href;
    posterDialog.showModal();
    document.body.classList.add('dialog-open');
  }));
  posterDialog.addEventListener('click', event => { if (event.target === posterDialog) { const bounds = posterDialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) posterDialog.close(); } });
  posterDialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); posterOpener?.focus(); });
}

document.querySelectorAll('[data-copy-link]').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const url = new URL(location.href); url.search = ''; url.hash = '';
    const feedback = document.querySelector('[data-copy-feedback]');
    try {
      await navigator.clipboard.writeText(url.href);
      feedback.textContent = 'Link copied.';
    } catch {
      const fallback = document.querySelector('.share-fallback');
      const input = fallback.querySelector('[data-share-url]');
      fallback.hidden = false;
      input.value = url.href; input.focus(); input.select();
      feedback.textContent = 'Select and copy the link below.';
    }
  });
});
