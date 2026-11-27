// Paramètres : langue, prière, ville, calendrier, notifications, compte, abonnement, données, légal, à propos.
import { t, lang, setLang, LANGS } from '../i18n.js';
import { h, clear, openSheet, closeSheet, toast } from '../ui.js';
import { store } from '../store.js';
import { METHODS } from '../prayer.js';
import { getLocation, locationPicker } from '../location.js';
import { notifSettings, notificationsSupported, requestNotificationPermission, rescheduleNotifications, setPushLanguage, NOTIF_PRAYERS } from '../notifications.js';
import { authAvailable, currentUser, sendCode, verifyCode, signOut } from '../auth.js';
import { api } from '../api.js';
import { isPremium, premium, refreshPremium, restore, manageSubscription, clearPremiumCache } from '../premium.js';
import { isNative, shareText } from '../native.js';
import { config, SUPPORT_EMAIL } from '../config.js';
import { legalUrl } from './premiumtab.js';
import { openUrl } from '../native.js';

const getS = () => ({ method: 'mwl', asr: 'standard', hijriAdjust: 0, ...store.get('settings', {}) });
function setS(patch) { store.set('settings', { ...getS(), ...patch }); document.dispatchEvent(new CustomEvent('tarikh:settings')); rescheduleNotifications(); }
const group = (title, ...children) => h('section.card.stack', h('p.label', title), ...children);
const link = (page, label) => h('button.list-item', { type: 'button', onclick: () => (isNative() ? openUrl(legalUrl(page)) : window.open(legalUrl(page), '_blank', 'noopener')) }, h('span.grow', label), h('span.muted', '›'));

function accountSection(repaint) {
  if (!authAvailable()) return group(t('account.title'), h('p.muted', t('account.unavailable')));
  const user = currentUser();
  if (user) {
    return group(t('account.title'), h('p', t('account.signedIn', { email: user.email || '' })),
      h('button.btn.ghost.block', { type: 'button', onclick: async () => { await signOut(); clearPremiumCache(); await refreshPremium(); toast(t('account.signedOut')); repaint(); } }, t('account.signOut')),
      h('button.btn.danger.block', { type: 'button', id: 'btn-delete-account', onclick: async () => {
        if (!confirm(t('account.deleteConfirm'))) return;
        try {
          await api('delete-account', { method: 'POST', body: { confirm: true } });
          await signOut(); clearPremiumCache(); await refreshPremium();
          toast(t('account.deleted'), 4000); repaint();
        } catch { toast(t('common.error')); }
      } }, t('account.delete')),
      h('p.muted', t('account.deleteNote')));
  }
  const email = h('input.input', { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'email@exemple.com', 'aria-label': t('account.email') });
  const code = h('input.input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 8, placeholder: '123456', 'aria-label': t('account.code'), hidden: true });
  const verify = h('button.btn.primary.block', { type: 'button', hidden: true }, t('account.verify'));
  const send = h('button.btn.primary.block', { type: 'button' }, t('account.sendCode'));
  send.addEventListener('click', async () => {
    const value = email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) { toast(t('account.badEmail')); return; }
    send.disabled = true;
    try { await sendCode(value); toast(t('account.codeSent'), 4000); code.hidden = false; verify.hidden = false; send.textContent = t('account.resend'); code.focus(); }
    catch { toast(t('common.error')); } finally { send.disabled = false; }
  });
  verify.addEventListener('click', async () => {
    verify.disabled = true;
    try {
      await verifyCode(email.value.trim(), code.value.trim());
      try { await api('link-device', { method: 'POST', body: {} }); } catch { /* le lien sera retenté au prochain lancement */ }
      await refreshPremium({ force: true });
      toast(t('account.welcome')); repaint();
    } catch { toast(t('account.badCode')); } finally { verify.disabled = false; }
  });
  return group(t('account.title'), h('p.muted', t('account.why')), email, send, code, verify);
}

function notifSection(repaint) {
  if (!notificationsSupported()) return group(t('notif.title'), h('p.muted', t('notif.webOnly')));
  const n = notifSettings();
  const save = (patch) => { store.set('notif', { ...notifSettings(), ...patch }); rescheduleNotifications(); };
  const sw = (label, checked, onchange) => h('label.switch-row', h('span', label), h('input.switch', { type: 'checkbox', checked, onchange }));
  return group(t('notif.title'),
    sw(t('notif.enable'), n.enabled, async (e) => {
      if (e.target.checked) { const ok = await requestNotificationPermission(); if (!ok) { e.target.checked = false; toast(t('notif.denied'), 4000); return; } }
      save({ enabled: e.target.checked }); repaint();
    }),
    n.enabled ? [
      ...NOTIF_PRAYERS.map((p) => sw(t('prayer.' + p), n.prayers[p], (e) => save({ prayers: { ...notifSettings().prayers, [p]: e.target.checked } }))),
      sw(t('notif.daily'), n.daily, (e) => save({ daily: e.target.checked })),
      h('label.field', h('span', t('notif.dailyTime')), h('input.input', { type: 'time', value: n.dailyTime, onchange: (e) => save({ dailyTime: e.target.value || '08:00' }) })),
      sw(t('notif.fasting'), n.fasting, (e) => save({ fasting: e.target.checked })),
      !getLocation() ? h('p.muted', t('notif.needLocation')) : null,
    ] : h('p.muted', t('notif.help')));
}

function render(body) {
  const repaint = () => { const y = body.scrollTop; clear(body); render(body); body.scrollTop = y; };
  const s = getS();
  const loc = getLocation();
  const select = (value, options, onchange, label) => h('select.input', { 'aria-label': label, onchange: (e) => onchange(e.target.value) }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  const p = premium();
  body.append(
    group(t('settings.language'), select(lang(), Object.entries(LANGS).map(([k, v]) => [k, v.name]), (v) => {
      setLang(v); setPushLanguage(); rescheduleNotifications();
      document.dispatchEvent(new CustomEvent('tarikh:lang'));
      document.getElementById('sheet-title').textContent = t('settings.title'); repaint();
    }, t('settings.language'))),
    group(t('settings.prayer'),
      h('label.field', h('span', t('settings.method')), select(s.method, METHODS.map((m) => [m, t('method.' + m)]), (v) => setS({ method: v, methodManual: true }), t('settings.method'))),
      h('div.field', h('span', t('settings.asr')), h('div.seg', { role: 'group' }, ['standard', 'hanafi'].map((a) => h('button', { type: 'button', 'aria-pressed': String(s.asr === a), onclick: () => { setS({ asr: a, methodManual: true }); repaint(); } }, t('settings.asr.' + a))))),
      h('div.row.between', h('div', h('p.muted', t('settings.city')), h('p', loc ? loc.name : t('settings.noCity'))),
        h('button.btn.small', { type: 'button', onclick: () => { clear(body); body.append(locationPicker(() => { toast(t('location.saved')); rescheduleNotifications(); repaint(); }), h('button.btn.ghost.block', { type: 'button', onclick: repaint }, t('common.back'))); } }, t('location.change')))),
    group(t('settings.calendar'), h('div.field', h('span', t('settings.hijriAdjust')),
      h('div.seg', { role: 'group' }, [-2, -1, 0, 1, 2].map((n) => h('button', { type: 'button', 'aria-pressed': String(s.hijriAdjust === n), onclick: () => { setS({ hijriAdjust: n }); repaint(); } }, n > 0 ? `+${n}` : String(n)))),
      h('p.muted', t('settings.hijriHelp')))),
    notifSection(repaint),
    group(t('settings.subscription'),
      h('p', isPremium() ? (p.trial ? t('premium.status.trial') : t('premium.status.active')) : t('premium.status.free')),
      isPremium() ? h('button.btn.ghost.block', { type: 'button', onclick: () => manageSubscription().catch(() => toast(t('common.error'))) }, t('premium.manage'))
        : h('button.btn.primary.block', { type: 'button', onclick: () => { location.hash = '#/paywall'; } }, t('premium.cta')),
      h('button.btn.ghost.block', { type: 'button', id: 'settings-restore', onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { const ok = await restore(); toast(ok ? t('premium.restored') : t('premium.nothingToRestore')); repaint(); } catch { toast(t('common.error')); }
      } }, t('premium.restore'))),
    accountSection(repaint),
    group(t('settings.data'),
      h('p.muted', t('settings.dataHelp')),
      h('button.btn.ghost.block', { type: 'button', id: 'btn-export', onclick: async () => {
        const data = store.exportAll(); delete data.session;
        const json = JSON.stringify({ app: 'Tarikh', exported_at: new Date().toISOString(), data }, null, 2);
        if (isNative()) { await shareText({ title: 'Tarikh', text: json }); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = 'tarikh-donnees.json'; a.click();
        toast(t('settings.exported'));
      } }, t('settings.export')),
      h('button.btn.danger.block', { type: 'button', id: 'btn-erase', onclick: () => {
        if (!confirm(t('settings.eraseConfirm'))) return;
        const keep = { lang: store.get('lang'), deviceId: store.get('deviceId'), session: store.get('session'), onboarded: true };
        store.clearAll();
        for (const [k, v] of Object.entries(keep)) if (v != null) store.set(k, v);
        toast(t('settings.erased')); document.dispatchEvent(new CustomEvent('tarikh:settings')); rescheduleNotifications(); repaint();
      } }, t('settings.erase'))),
    group(t('settings.legal'), h('ul.list', h('li', link('privacy', t('legal.privacy'))), h('li', link('terms', t('legal.terms'))), h('li', link('support', t('legal.support'))))),
    group(t('settings.about'), h('p', `Tarikh ${config.version}`), h('p.muted', t('ai.about')), h('p.muted', t('about.sources')), h('p.muted', `${t('about.contact')} ${SUPPORT_EMAIL}`)),
  );
}

export function openSettings() {
  openSheet({ title: t('settings.title'), render });
  if (location.hash !== '#/settings') history.replaceState(null, '', '#/settings');
}
// Ouvre directement la partie « compte » (utilisé avant un achat sur le web).
export function openAccount() {
  openSheet({ title: t('account.title'), render: (body) => { const paint = () => { clear(body); body.append(accountSection(() => { if (currentUser()) { closeSheet(); location.hash = '#/paywall'; } else paint(); })); }; paint(); } });
}
