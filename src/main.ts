import './base.css';
import './style.css';
import { h, toast, uid, langToggle, icon, showSaveBanner, hideSaveBanner, promptDialog, confirmDialog } from './ui';
import { initDb, loadState, saveState } from './db';
import { dicts, type Lang, type Dict } from './i18n';

type ColDef = 'todo' | 'doing' | 'done';
interface Column { id: string; name: string; def: ColDef | null }
interface Card { id: string; columnId: string; title: string; note: string }
interface Board { id: string; name: string; columns: Column[]; cards: Card[] }
interface State { lang: Lang; boards: Board[]; currentId: string }

const DEFAULTS: Record<ColDef, { ja: string; en: string }> = {
  todo: { ja: 'やること', en: 'To do' },
  doing: { ja: 'やっている', en: 'Doing' },
  done: { ja: '完了', en: 'Done' },
};

function emptyBoard(name: string): Board {
  return {
    id: uid(),
    name,
    columns: (['todo', 'doing', 'done'] as ColDef[]).map((def) => ({
      id: uid(),
      name: DEFAULTS[def].ja,
      def,
    })),
    cards: [],
  };
}

function fresh(): State {
  const b = emptyBoard('マイボード');
  return { lang: 'ja', boards: [b], currentId: b.id };
}

function isDef(v: unknown): v is ColDef {
  return v === 'todo' || v === 'doing' || v === 'done';
}

function sanitize(s: State): State {
  const boards: Board[] = [];
  if (Array.isArray(s.boards)) {
    for (const raw of s.boards) {
      if (!raw || typeof raw !== 'object') continue;
      const b = raw as Board;
      if (typeof b.id !== 'string') continue;
      const columns: Column[] = Array.isArray(b.columns)
        ? b.columns.filter((c) => c && typeof c.id === 'string').map((c) => ({
          id: c.id,
          name: typeof c.name === 'string' && c.name ? c.name : '列',
          def: isDef(c.def) ? c.def : null,
        }))
        : [];
      const colIds = new Set(columns.map((c) => c.id));
      const cards: Card[] = Array.isArray(b.cards)
        ? b.cards.filter((c) => c && typeof c.id === 'string' && typeof c.columnId === 'string' && colIds.has(c.columnId)).map((c) => ({
          id: c.id,
          columnId: c.columnId,
          title: typeof c.title === 'string' ? c.title : '',
          note: typeof c.note === 'string' ? c.note : '',
        }))
        : [];
      if (!columns.length) continue;
      boards.push({
        id: b.id,
        name: typeof b.name === 'string' && b.name.trim() ? b.name : 'ボード',
        columns,
        cards,
      });
    }
  }
  if (!boards.length) return fresh();
  const currentId = boards.some((b) => b.id === s.currentId) ? s.currentId : boards[0].id;
  return { lang: s.lang === 'en' ? 'en' : 'ja', boards, currentId };
}

let state = fresh();
let t: Dict = dicts.ja;
const app = document.getElementById('app')!;
let saveTimer = 0;

function current(): Board {
  return state.boards.find((b) => b.id === state.currentId) ?? state.boards[0];
}
function colLabel(col: Column): string {
  if (col.def) return DEFAULTS[col.def][state.lang];
  return col.name;
}

async function persist(): Promise<void> {
  const ok = await saveState(state);
  if (ok) hideSaveBanner();
  else showSaveBanner();
}
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void persist(); }, 250);
}

function setLang(l: Lang) {
  state.lang = l;
  t = dicts[l];
  document.documentElement.lang = l;
  document.title = t.app;
  void persist();
  render();
}

function moveCard(cardId: string, colId: string, beforeId: string | null) {
  const board = current();
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return;
  if (!board.columns.some((c) => c.id === colId)) return;
  const rest = board.cards.filter((c) => c.id !== cardId);
  card.columnId = colId;
  if (beforeId && beforeId !== cardId) {
    const i = rest.findIndex((c) => c.id === beforeId);
    if (i >= 0) rest.splice(i, 0, card);
    else rest.push(card);
  } else {
    let last = -1;
    rest.forEach((c, i) => { if (c.columnId === colId) last = i; });
    if (last < 0) rest.push(card);
    else rest.splice(last + 1, 0, card);
  }
  board.cards = rest;
}

function bindDrag(grip: HTMLElement, article: HTMLElement, cardId: string) {
  grip.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const startX = ev.clientX;
    const startY = ev.clientY;
    let moved = false;
    let active = true;
    const rect = article.getBoundingClientRect();
    const ox = ev.clientX - rect.left;
    const oy = ev.clientY - rect.top;
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.style.height = `${Math.max(rect.height, 48)}px`;
    article.before(placeholder);
    article.classList.add('dragging');
    article.style.width = `${rect.width}px`;
    article.style.position = 'fixed';
    article.style.left = `${rect.left}px`;
    article.style.top = `${rect.top}px`;
    article.style.zIndex = '40';
    article.style.pointerEvents = 'none';
    grip.setPointerCapture(ev.pointerId);

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) moved = true;
      article.style.left = `${e.clientX - ox}px`;
      article.style.top = `${e.clientY - oy}px`;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (!under || under === placeholder || placeholder.contains(under)) return;
      const col = under.closest('[data-col]') as HTMLElement | null;
      if (!col) return;
      document.querySelectorAll('.col.drop').forEach((n) => n.classList.remove('drop'));
      col.classList.add('drop');
      const list = col.querySelector('.cards');
      if (!list) return;
      const cardEl = under.closest('[data-card]') as HTMLElement | null;
      let before: Element | null = null;
      if (cardEl && cardEl !== article) {
        const r = cardEl.getBoundingClientRect();
        before = e.clientY < r.top + r.height / 2 ? cardEl : cardEl.nextElementSibling;
        if (before === placeholder) return;
      }
      if (placeholder.parentElement === list && placeholder.nextElementSibling === before) return;
      if (before && before.parentElement === list) list.insertBefore(placeholder, before);
      else list.append(placeholder);
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onUp);
      if (moved) {
        const col = placeholder.closest('[data-col]') as HTMLElement | null;
        const colId = col?.dataset.col ?? '';
        let beforeId: string | null = null;
        let n: Element | null = placeholder.nextElementSibling;
        while (n) {
          const id = (n as HTMLElement).dataset.card;
          if (id && id !== cardId) { beforeId = id; break; }
          n = n.nextElementSibling;
        }
        if (colId) moveCard(cardId, colId, beforeId);
        void persist();
      }
      render();
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
  });
}

function openEditor(existing: Card | null, columnId: string) {
  const board = current();
  let created = false;
  let card = existing;
  if (!card) {
    card = { id: uid(), columnId, title: '', note: '' };
    board.cards.push(card);
    created = true;
  }
  const live = card;
  const title = h('input', { class: 'input', value: live.title, 'aria-label': t.cardTitle, placeholder: t.cardTitle });
  const note = h('textarea', { class: 'input', value: live.note, 'aria-label': t.note, placeholder: t.note });
  const sync = () => {
    live.title = title.value;
    live.note = note.value;
    persistSoon();
  };
  title.addEventListener('input', sync);
  note.addEventListener('input', sync);
  const dlg = h('dialog', {},
    h('h2', {}, created ? t.addCard : t.editCard),
    h('label', { class: 'field' }, t.cardTitle, title),
    h('label', { class: 'field' }, t.note, note),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => dlg.close('cancel') }, t.cancel),
      h('button', { class: 'btn primary', type: 'button', onclick: () => dlg.close('ok') }, t.done),
    ),
  );
  dlg.addEventListener('close', () => {
    sync();
    if (dlg.returnValue !== 'ok' && created && !live.title.trim() && !live.note.trim()) {
      board.cards = board.cards.filter((c) => c.id !== live.id);
    }
    dlg.remove();
    render();
    void persist();
  });
  document.body.append(dlg);
  dlg.showModal();
  title.focus();
}

function deleteCard(card: Card) {
  const board = current();
  const idx = board.cards.findIndex((c) => c.id === card.id);
  if (idx < 0) return;
  board.cards.splice(idx, 1);
  void persist();
  render();
  toast(t.deleted, {
    label: t.undo,
    run: () => {
      const b = state.boards.find((x) => x.id === board.id);
      if (!b || b.cards.some((c) => c.id === card.id)) return;
      b.cards.splice(Math.min(idx, b.cards.length), 0, card);
      void persist();
      render();
    },
  });
}

async function renameColumn(col: Column) {
  const next = await promptDialog(t.renameCol, t.save, t.cancel, colLabel(col));
  if (next === null) return;
  const name = next.trim();
  if (!name) return;
  col.name = name;
  col.def = null;
  render();
  void persist();
}

async function addBoard() {
  const next = await promptDialog(t.boardName, t.save, t.cancel, '', state.lang === 'ja' ? '新しいボード' : 'New board');
  if (next === null) return;
  const board = emptyBoard(next.trim() || (state.lang === 'ja' ? '新しいボード' : 'New board'));
  state.boards.push(board);
  state.currentId = board.id;
  render();
  void persist();
}

async function renameBoard() {
  const b = current();
  const next = await promptDialog(t.renameBoard, t.save, t.cancel, b.name);
  if (next === null) return;
  const name = next.trim();
  if (!name) return;
  b.name = name;
  render();
  void persist();
}

async function deleteBoard() {
  if (state.boards.length <= 1) {
    toast(t.lastBoard);
    return;
  }
  const b = current();
  const ok = await confirmDialog(t.deleteBoard, t.deleteBoardBody, t.del, t.cancel, true);
  if (!ok) return;
  state.boards = state.boards.filter((x) => x.id !== b.id);
  state.currentId = state.boards[0].id;
  render();
  void persist();
}

function renderCard(card: Card) {
  const article = h('article', { class: 'kcard' });
  article.dataset.card = card.id;
  const grip = h('button', { class: 'grip', type: 'button', 'aria-label': 'drag' }, icon('grip'));
  const body = h('button', { class: 'kbody', type: 'button' },
    h('div', { class: 'k-title' }, card.title.trim() || t.untitled),
    card.note.trim() ? h('div', { class: 'k-note' }, card.note) : null,
  );
  body.addEventListener('click', () => openEditor(card, card.columnId));
  const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.del }, icon('trash'));
  del.addEventListener('click', () => deleteCard(card));
  article.append(grip, body, del);
  bindDrag(grip, article, card.id);
  return article;
}

function render() {
  t = dicts[state.lang];
  const board = current();
  const select = h('select', { class: 'input', 'aria-label': t.boardLabel },
    ...state.boards.map((b) => h('option', { value: b.id, selected: b.id === board.id }, b.name)),
  );
  select.addEventListener('change', () => {
    state.currentId = select.value;
    void persist();
    render();
  });

  const cols = board.columns.map((col) => {
    const cards = board.cards.filter((c) => c.columnId === col.id);
    const section = h('section', { class: 'col' });
    section.dataset.col = col.id;
    const nameBtn = h('button', { class: 'col-name', type: 'button' }, colLabel(col));
    nameBtn.addEventListener('click', () => { void renameColumn(col); });
    const list = h('div', { class: 'cards' }, ...(cards.length ? cards.map(renderCard) : [h('p', { class: 'empty' }, t.emptyCol)]));
    const add = h('button', { class: 'btn add', type: 'button' }, t.addCard);
    add.addEventListener('click', () => openEditor(null, col.id));
    section.append(
      h('div', { class: 'col-head' }, nameBtn, h('span', { class: 'col-count' }, String(cards.length))),
      list,
      add,
    );
    return section;
  });

  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('h1', {}, t.app),
      langToggle(state.lang, setLang),
    ),
    h('main', {},
      select,
      h('div', { class: 'tools' },
        h('button', { class: 'btn', type: 'button', onclick: () => { void addBoard(); } }, t.addBoard),
        h('button', { class: 'btn', type: 'button', onclick: () => { void renameBoard(); } }, t.renameBoard),
        h('button', { class: 'btn danger', type: 'button', onclick: () => { void deleteBoard(); } }, t.deleteBoard),
      ),
      h('p', { class: 'hint muted small' }, t.hint),
      h('div', { class: 'scroller' }, ...cols),
      h('p', { class: 'foot' }, t.privacy),
    ),
  );
}

async function boot() {
  const ok = await initDb('kanban-kami');
  if (!ok) showSaveBanner();
  state = sanitize(await loadState(fresh()));
  t = dicts[state.lang];
  document.documentElement.lang = state.lang;
  document.title = t.app;
  render();
  window.addEventListener('pagehide', () => { void persist(); });
}
void boot();
