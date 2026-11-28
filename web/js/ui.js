// Petits utilitaires d'interface : création d'éléments, bottom sheet, toast.
import { t } from './i18n.js';

// h('div.card', { onclick }, 'texte', enfant…) : jamais d'innerHTML avec du contenu externe.
export function h(spec, props, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
// Texte multi-paragraphes ("\n\n") -> <p>…</p>
export const paragraphs = (text, cls = '') => String(text || '').split(/\n{2,}/).filter(Boolean).map((p) => h('p' + (cls ? '.' + cls : ''), p.trim()));

let toastTimer;
export function toast(message, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ----- Bottom sheet (fermeture : ×, Échap, clic sur le fond, glissement vers le bas) -----
let onCloseCb = null;
let lastFocus = null;
const $ = (id) => document.getElementById(id);

export function openSheet({ title, render, onClose, wide = false }) {
  const sheet = $('sheet'), body = $('sheet-body');
  if (!sheet.hidden && onCloseCb) { const cb = onCloseCb; onCloseCb = null; try { cb(); } catch { /* ignore */ } }
  lastFocus = document.activeElement;
  $('sheet-title').textContent = title || '';
  clear(body);
  body.scrollTop = 0;
  sheet.classList.toggle('wide', wide);
  onCloseCb = onClose || null;
  sheet.hidden = false;
  $('sheet-backdrop').hidden = false;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  try { render(body); } catch (err) { console.error(err); body.append(h('p.muted', t('common.error'))); }
  sheet.setAttribute('tabindex', '-1');
  sheet.focus({ preventScroll: true }); // le lecteur d'écran annonce le titre ; pas d'anneau de focus parasite au toucher
  return body;
}

export function closeSheet(updateHash = true) {
  const sheet = $('sheet');
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('open');
  sheet.style.transform = '';
  document.body.classList.remove('sheet-open');
  const cb = onCloseCb; onCloseCb = null;
  if (cb) { try { cb(); } catch (err) { console.error(err); } }
  setTimeout(() => { sheet.hidden = true; $('sheet-backdrop').hidden = true; clear($('sheet-body')); }, 220);
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  if (updateHash && /^#\/(tool|settings|premium\/|story|paywall|account)/.test(location.hash)) {
    history.replaceState(null, '', '#/' + (document.body.dataset.tab || 'today'));
  }
}
export const sheetIsOpen = () => { const s = $('sheet'); return !!s && !s.hidden; };

export function initSheet() {
  $('sheet-close').addEventListener('click', () => closeSheet());
  $('sheet-backdrop').addEventListener('click', () => closeSheet());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetIsOpen()) closeSheet();
    if (e.key === 'Tab' && sheetIsOpen()) { // piège de focus simple
      const f = $('sheet').querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // Glissement vers le bas depuis la poignée / l'en-tête.
  const head = $('sheet-head'), sheet = $('sheet');
  let startY = null, dy = 0;
  head.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
  head.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  head.addEventListener('touchend', () => {
    sheet.style.transition = '';
    if (dy > 110) closeSheet(); else sheet.style.transform = '';
    startY = null;
  });
}

// Chargement paresseux des fichiers de données (mis en cache par le service worker).
const dataCache = new Map();
export async function loadData(name) {
  if (dataCache.has(name)) return dataCache.get(name);
  const res = await fetch(`data/${name}.json`);
  if (!res.ok) throw new Error(`data/${name}.json ${res.status}`);
  const json = await res.json();
  dataCache.set(name, json);
  return json;
}
export const loading = () => h('div.loading', { role: 'status', 'aria-live': 'polite' }, h('span.spinner'), h('span', t('common.loading')));
export const errorBox = (retry) => h('div.error-box', { role: 'alert' }, h('p', t('common.error')), retry ? h('button.btn.ghost', { onclick: retry }, t('common.retry')) : null);
