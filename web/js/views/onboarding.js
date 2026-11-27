// Accueil en 3 écrans au premier lancement : langue, ville (horaires de prière), rappels.
import { t, lang, setLang, LANGS } from '../i18n.js';
import { h, clear } from '../ui.js';
import { store } from '../store.js';
import { locationPicker, getLocation } from '../location.js';
import { notificationsSupported, requestNotificationPermission, rescheduleNotifications, setPushLanguage } from '../notifications.js';

export function maybeOnboard() {
  if (store.get('onboarded')) return;
  const root = document.getElementById('onboarding');
  let step = 0;
  const finish = () => { store.set('onboarded', true); root.hidden = true; clear(root); document.dispatchEvent(new CustomEvent('tarikh:settings')); document.getElementById('main')?.focus(); };
  const dots = () => h('div.ob-dots', { 'aria-hidden': 'true' }, [0, 1, 2].map((i) => h('span' + (i === step ? '.on' : ''))));
  const nextBtn = (label, fn) => h('button.btn.primary.block', { type: 'button', id: 'ob-next', onclick: fn }, label);
  const skip = () => h('button.btn.ghost.block', { type: 'button', id: 'ob-skip', onclick: finish }, t('ob.skip'));
  const go = (n) => { step = n; paint(); };
  const paint = () => {
    clear(root);
    root.setAttribute('aria-label', t('ob.aria'));
    if (step === 0) {
      root.append(h('div.ob-step', h('div.ob-ico', { lang: 'ar' }, 'تاريخ'), h('h1.title', t('ob.1.title')), h('p.muted', t('ob.1.text')),
        h('div.lang-grid', Object.entries(LANGS).map(([code, l]) => h('button.btn' + (code === lang() ? '.primary' : ''), { type: 'button', lang: code, dataset: { lang: code }, onclick: () => { setLang(code); setPushLanguage(); document.dispatchEvent(new CustomEvent('tarikh:lang')); paint(); } }, l.name)))),
        dots(), nextBtn(t('ob.next'), () => go(1)), skip());
    } else if (step === 1) {
      root.append(h('div.ob-step', h('div.ob-ico', '🕌'), h('h1.title', t('ob.2.title')), h('p.muted', t('ob.2.text')),
        getLocation() ? h('p.chip.ok', '📍 ' + getLocation().name) : h('div', { style: 'width:100%;text-align:start' }, locationPicker(() => go(2)))),
        dots(), nextBtn(getLocation() ? t('ob.next') : t('ob.later'), () => go(2)), skip());
    } else {
      const native = notificationsSupported();
      root.append(h('div.ob-step', h('div.ob-ico', '🔔'), h('h1.title', t('ob.3.title')), h('p.muted', t(native ? 'ob.3.text' : 'ob.3.textWeb'))),
        dots(),
        native ? nextBtn(t('ob.3.enable'), async () => {
          const ok = await requestNotificationPermission();
          if (ok) { store.set('notif', { ...store.get('notif', {}), enabled: true }); await rescheduleNotifications(); }
          finish();
        }) : nextBtn(t('ob.start'), finish),
        native ? h('button.btn.ghost.block', { type: 'button', id: 'ob-skip', onclick: finish }, t('ob.later')) : null);
    }
    root.querySelector('h1')?.setAttribute('tabindex', '-1');
    root.querySelector('h1')?.focus({ preventScroll: true });
  };
  root.hidden = false;
  paint();
}
