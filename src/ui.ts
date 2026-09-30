export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...kids: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'value' || k === 'checked') (el as unknown as Record<string, unknown>)[k] = v;
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return el;
}

const ICONS: Record<string, string> = {
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.4"/><circle cx="15" cy="7" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="17" r="1.4"/><circle cx="15" cy="17" r="1.4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
};

export function icon(name: keyof typeof ICONS): HTMLElement {
  const s = h('span', { class: 'ic' });
  s.innerHTML = ICONS[name];
  return s;
}

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;
export function toast(msg: string, action?: { label: string; run: () => void }, ms = 3200): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  const t = toastEl;
  t.replaceChildren(h('span', {}, msg));
  if (action) {
    t.append(h('button', {
      onclick: () => {
        action.run();
        t.classList.remove('show');
      },
    }, action.label));
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), action ? Math.max(ms, 5000) : ms);
}

export function confirmDialog(title: string, body: string, ok: string, cancel: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = h('dialog', {},
      h('h2', {}, title),
      body ? h('p', { class: 'muted', style: 'margin:0' }, body) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => dlg.close('no') }, cancel),
        h('button', { class: 'btn primary' + (danger ? ' danger-bg' : ''), onclick: () => dlg.close('yes') }, ok),
      ),
    );
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'yes');
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function promptDialog(title: string, ok: string, cancel: string, initial = '', placeholder = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', value: initial, placeholder, 'aria-label': title });
    const dlg = h('dialog', {},
      h('h2', {}, title),
      input,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => dlg.close('no') }, cancel),
        h('button', { class: 'btn primary', onclick: () => dlg.close('yes') }, ok),
      ),
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dlg.close('yes');
      }
    });
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'yes' ? input.value : null);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
    input.focus();
    input.select();
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function langToggle(lang: 'ja' | 'en', set: (l: 'ja' | 'en') => void): HTMLElement {
  return h('div', { class: 'lang-toggle', role: 'group', 'aria-label': 'Language' },
    h('button', { 'aria-pressed': String(lang === 'ja'), onclick: () => set('ja') }, '日本語'),
    h('button', { 'aria-pressed': String(lang === 'en'), onclick: () => set('en') }, 'EN'),
  );
}

const BANNER = '保存できませんでした。入力した内容はこの画面に残しています。端末の空き容量を確認してください。 / Could not save. What you typed is still on this screen — nothing was cleared. Free up space on this device and try again.';

function placeBanner(el: HTMLElement) {
  const apply = () => {
    document.documentElement.style.setProperty('--save-banner-h', `${el.offsetHeight}px`);
    document.body.classList.add('has-save-banner');
  };
  apply();
  requestAnimationFrame(apply);
}

export function showSaveBanner(): void {
  let el = document.getElementById('save-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'save-banner';
    el.className = 'save-banner';
    el.setAttribute('role', 'alert');
    document.body.prepend(el);
  }
  el.textContent = BANNER;
  placeBanner(el);
}

export function hideSaveBanner(): void {
  document.getElementById('save-banner')?.remove();
  document.body.classList.remove('has-save-banner');
  document.documentElement.style.setProperty('--save-banner-h', '0px');
}
