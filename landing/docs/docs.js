const search = document.querySelector('.docs-search');
const input = document.querySelector('#docs-search-input');
const results = document.querySelector('#docs-search-results');
const status = document.querySelector('#docs-search-status');
let index;
let pendingIndex;
let timer;
let requestId = 0;

async function loadIndex() {
  if (index) return index;
  if (!pendingIndex) {
    pendingIndex = fetch('./search-index.json').then(response => {
      if (!response.ok) throw new Error('Search unavailable');
      return response.json();
    }).then(data => {
      index = data.map(page => ({ ...page, searchable: `${page.title} ${page.description} ${page.text}`.toLowerCase() }));
      return index;
    }).catch(error => { pendingIndex = undefined; throw error; });
  }
  return pendingIndex;
}

async function searchArticles() {
  const currentRequest = ++requestId;
  const query = input.value.trim().toLowerCase();
  results.replaceChildren();
  results.hidden = true;
  status.textContent = '';
  if (!query) return;
  try {
    const pages = await loadIndex();
    if (currentRequest !== requestId) return;
    const words = query.split(/\s+/);
    const matches = pages.filter(page => words.every(word => page.searchable.includes(word)))
      .map(page => ({ ...page, score: words.reduce((score, word) => score + (page.title.toLowerCase().includes(word) ? 4 : 0) + (page.description.toLowerCase().includes(word) ? 2 : 0), 0) }))
      .sort((a, b) => b.score - a.score).slice(0, 8);
    status.textContent = matches.length ? `${matches.length} guide${matches.length === 1 ? '' : 's'} found` : 'No matching guides. Try a different term.';
    for (const page of matches) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = page.href;
      const title = document.createElement('strong');
      title.textContent = page.title;
      const group = document.createElement('span');
      group.textContent = page.group;
      link.append(title, group);
      item.append(link);
      results.append(item);
    }
    results.hidden = !matches.length;
  } catch {
    if (currentRequest === requestId) status.textContent = 'Search is unavailable. Browse the topics below.';
  }
}

search.hidden = false;
input.addEventListener('input', () => {
  // Invalidate in-flight work immediately, even before the debounce runs.
  requestId++;
  clearTimeout(timer);
  timer = setTimeout(searchArticles, 180);
});
input.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    input.value = '';
    clearTimeout(timer);
    void searchArticles();
  }
  if (event.key === 'ArrowDown' && !results.hidden) {
    event.preventDefault();
    results.querySelector('a')?.focus();
  }
});
results.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    input.focus();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const links = [...results.querySelectorAll('a')];
  const current = links.indexOf(document.activeElement);
  if (event.key === 'ArrowUp' && current <= 0) input.focus();
  else links[Math.min(links.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))]?.focus();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input, textarea, select, [contenteditable="true"]')) {
    event.preventDefault();
    input.focus();
  }
});

// On narrow screens the native disclosure replaces the desktop sidebar.
const topics = document.querySelector('.docs-topic-menu');
const narrowScreen = matchMedia('(max-width: 760px)');
function updateTopics() { topics.open = !narrowScreen.matches; }
updateTopics();
narrowScreen.addEventListener('change', updateTopics);

if ('IntersectionObserver' in window) {
  const anchors = [...document.querySelectorAll('.docs-on-this-page a')];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const anchor of anchors) {
        if (anchor.hash === `#${entry.target.id}`) anchor.setAttribute('aria-current', 'location');
        else anchor.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-15% 0px -65% 0px' });
  document.querySelectorAll('.docs-article h2').forEach(heading => observer.observe(heading));
}
