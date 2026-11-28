// Lecture d'une histoire : récit complet, leçon, partage en image, favori, écoute, mode lecture.
import { t, lang, LANGS } from '../i18n.js';
import { h, openSheet, paragraphs, toast } from '../ui.js';
import { isFavorite, toggleFavorite } from '../content.js';
import { isPremium } from '../premium.js';
import { shareImage, shareText, hapticTap } from '../native.js';
import { storyImage } from '../shareimage.js';
import { addDeed } from '../deeds.js';

let speaking = false;
function stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } speaking = false; }

export function openStory(story, { today = false } = {}) {
  if (today) addDeed('story', { once: 'story' });
  openSheet({
    title: t('story.label'),
    onClose: stopSpeech,
    render: (body) => {
      const article = h('article.stack');
      const fav = h('button.btn.small', { type: 'button', 'aria-pressed': String(isFavorite(story)), onclick: () => {
        if (!isPremium()) { location.hash = '#/paywall'; return; }
        const on = toggleFavorite(story);
        fav.setAttribute('aria-pressed', String(on));
        hapticTap();
        toast(on ? t('story.favAdded') : t('story.favRemoved'));
      } }, '♥ ', t('story.favorite'));
      const listen = h('button.btn.small', { type: 'button', 'aria-pressed': 'false', onclick: () => {
        const synth = window.speechSynthesis;
        if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { toast(t('story.noSpeech')); return; }
        if (speaking) { stopSpeech(); listen.setAttribute('aria-pressed', 'false'); return; }
        const u = new SpeechSynthesisUtterance(`${story.title}. ${story.story} ${story.lesson}`);
        u.lang = LANGS[lang()].speech; u.rate = 0.95;
        u.onend = u.onerror = () => { speaking = false; listen.setAttribute('aria-pressed', 'false'); };
        speaking = true; listen.setAttribute('aria-pressed', 'true');
        synth.cancel(); synth.speak(u);
      } }, '🔊 ', t('story.listen'));
      const share = h('button.btn.small.primary', { type: 'button', onclick: async () => {
        share.disabled = true;
        try {
          const blob = await storyImage({ label: `${story.era || ''} · ${story.period || ''}`, title: story.title, body: story.teaser || story.lesson });
          const res = await shareImage(blob, { title: story.title, text: `${story.title} — Tarikh`, filename: 'tarikh-histoire.png' });
          if (res === 'downloaded') toast(t('share.downloaded'));
        } catch (err) {
          console.error(err);
          const r = await shareText({ title: story.title, text: `${story.title}\n\n${story.teaser || ''}\n\n— Tarikh` });
          if (r === 'copied') toast(t('share.copied'));
        } finally { share.disabled = false; }
      } }, '↗ ', t('common.share'));
      const reading = h('button.btn.small.ghost', { type: 'button', 'aria-pressed': 'false', onclick: () => {
        const on = article.classList.toggle('reading');
        reading.setAttribute('aria-pressed', String(on));
      } }, 'Aa ', t('story.reading'));

      article.append(
        h('p.label', [story.era, story.period].filter(Boolean).join(' · ')),
        h('h3.title', story.title),
        h('div.story-text', paragraphs(story.story)),
        h('div.lesson', h('p.label', t('story.lesson')), h('p.quote', story.lesson)),
        h('div.actions', share, fav, listen, reading),
        h('p.muted', t('ai.notice')),
      );
      body.append(article);
    },
  });
}
