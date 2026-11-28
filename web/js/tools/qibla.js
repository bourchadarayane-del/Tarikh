// Qibla : angle calculé hors-ligne + boussole en direct (capteurs de l'appareil).
import { t, fmtNum } from '../i18n.js';
import { h, clear } from '../ui.js';
import { qiblaBearing, qiblaDistanceKm } from '../qibla.js';
import { getLocation, locationPicker } from '../location.js';
import { hapticSuccess } from '../native.js';

export function render(body) {
  let handler = null, aligned = false;
  const stop = () => { if (handler) { window.removeEventListener('deviceorientationabsolute', handler, true); window.removeEventListener('deviceorientation', handler, true); handler = null; } };
  const draw = () => {
    clear(body);
    const loc = getLocation();
    if (!loc) { body.append(h('p', t('qibla.needLocation')), locationPicker(draw)); return; }
    const bearing = qiblaBearing(loc.lat, loc.lon);
    const km = qiblaDistanceKm(loc.lat, loc.lon);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('qibla.aria', { deg: Math.round(bearing) }));
    svg.innerHTML = `<g class="compass-dial" id="compass-dial"><circle class="compass-ring" cx="100" cy="100" r="92" fill="#0F0800" stroke="#9B7E3A" stroke-width="2"/>
      <g fill="#B5A583" font-size="13" text-anchor="middle" font-family="Inter,sans-serif"><text x="100" y="24" fill="#E5604D" font-weight="700">N</text><text x="180" y="105">E</text><text x="100" y="186">S</text><text x="20" y="105">W</text></g>
      <g transform="rotate(${bearing.toFixed(1)} 100 100)"><path d="M100 22 L110 100 L100 92 L90 100 Z" fill="#C9A84C"/><rect x="92" y="6" width="16" height="16" rx="2" fill="#111" stroke="#C9A84C" stroke-width="1.5"/><rect x="92" y="10" width="16" height="3" fill="#C9A84C"/></g>
      <circle cx="100" cy="100" r="5" fill="#C9A84C"/></g>`;
    const wrap = h('div.compass', svg);
    const status = h('p.muted.center', { 'aria-live': 'polite' }, t('qibla.static'));
    const start = h('button.btn.primary.block', { type: 'button', onclick: async () => {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') { status.textContent = t('qibla.noSensor'); return; }
        }
      } catch { status.textContent = t('qibla.noSensor'); return; }
      stop();
      let got = false;
      handler = (e) => {
        let heading = null;
        if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading; // iOS : cap magnétique direct
        else if (e.absolute && typeof e.alpha === 'number') heading = 360 - e.alpha;
        if (heading == null || isNaN(heading)) return;
        got = true;
        const dial = document.getElementById('compass-dial');
        if (!dial) { stop(); return; }
        dial.style.transform = `rotate(${-heading}deg)`;
        const diff = Math.abs(((bearing - heading + 540) % 360) - 180);
        const ok = diff < 5;
        wrap.classList.toggle('qibla-aligned', ok);
        if (ok && !aligned) hapticSuccess();
        aligned = ok;
        status.textContent = ok ? t('qibla.aligned') : t('qibla.turn');
      };
      window.addEventListener('deviceorientationabsolute', handler, true);
      window.addEventListener('deviceorientation', handler, true);
      start.hidden = true;
      status.textContent = t('qibla.calibrate');
      setTimeout(() => { if (!got) { status.textContent = t('qibla.noSensor'); start.hidden = false; } }, 3000);
    } }, '🧭 ', t('qibla.start'));
    body.append(
      h('div.stats', h('div.stat', h('b.ltr', { id: 'qibla-deg' }, `${bearing.toFixed(0)}°`), h('span', t('qibla.bearing'))),
        h('div.stat', h('b.ltr', fmtNum(Math.round(km))), h('span', t('qibla.km'))), h('div.stat', h('b', '🕋'), h('span', loc.name))),
      wrap, status, start, h('p.muted', t('qibla.help')),
      h('button.btn.ghost.small', { type: 'button', onclick: () => { stop(); clear(body); body.append(locationPicker(draw)); } }, t('location.change')));
  };
  draw();
  return stop;
}
