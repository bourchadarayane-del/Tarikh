// Quiz (Premium) : 120 questions, catégories, sessions de 10, explications, score. 5 questions offertes en aperçu.
import { t, lang } from '../i18n.js';
import { h, clear, loading, errorBox } from '../ui.js';
import { store } from '../store.js';
import { isPremium, getPremiumContent } from '../premium.js';
import { premiumCta, premiumIndex } from './common.js';
import { hapticTap, hapticSuccess } from '../native.js';
import { addDeed } from '../deeds.js';

const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

export function render(body) {
  const home = async () => {
    clear(body).append(loading());
    let questions, sample = false;
    try {
      if (isPremium()) questions = await getPremiumContent('quiz');
      else { questions = (await premiumIndex(lang())).quizSample; sample = true; }
    } catch (err) {
      if (err.status === 402) { try { questions = (await premiumIndex(lang())).quizSample; sample = true; } catch { clear(body).append(errorBox(home)); return; } }
      else { clear(body).append(errorBox(home)); return; }
    }
    const best = store.get('quizBest', 0), played = store.get('quizPlayed', 0);
    const cats = ['all', ...new Set(questions.map((q) => q.cat))];
    clear(body).append(
      h('div.stats', h('div.stat', h('b', `${best}/10`), h('span', t('quiz.best'))), h('div.stat', h('b', String(played)), h('span', t('quiz.played'))), h('div.stat', h('b', String(sample ? 120 : questions.length)), h('span', t('quiz.questions')))),
      sample ? h('p.muted', t('quiz.sample')) : h('p.muted', t('quiz.intro')),
      sample ? h('button.btn.primary.block', { type: 'button', id: 'quiz-start', onclick: () => play(questions, true) }, t('quiz.trySample'))
        : h('ul.list', cats.map((c) => h('li', h('button.list-item', { type: 'button', dataset: { cat: c }, onclick: () => play(shuffle(questions.filter((q) => c === 'all' || q.cat === c)).slice(0, 10), false) },
          h('span.grow', t('quiz.cat.' + c)), h('span.muted', String(questions.filter((q) => c === 'all' || q.cat === c).length)))))),
      sample ? premiumCta('quiz.locked') : null);
  };
  const play = (set, sample) => {
    let i = 0, score = 0;
    const step = () => {
      clear(body);
      body.scrollTop = 0;
      if (i >= set.length) {
        if (!sample) { store.set('quizPlayed', store.get('quizPlayed', 0) + 1); if (set.length === 10) store.set('quizBest', Math.max(store.get('quizBest', 0), score)); addDeed('quiz'); }
        hapticSuccess();
        body.append(h('div.price-box', h('p.label', t('quiz.done')), h('p.price', { id: 'quiz-score' }, `${score} / ${set.length}`), h('p', t(score >= set.length * 0.8 ? 'quiz.great' : score >= set.length * 0.5 ? 'quiz.good' : 'quiz.keep'))),
          h('button.btn.primary.block', { type: 'button', onclick: home }, t('quiz.again')), sample ? premiumCta('quiz.locked') : null);
        return;
      }
      const q = set[i];
      const explain = h('div', { 'aria-live': 'polite' });
      const next = h('button.btn.primary.block', { type: 'button', hidden: true, onclick: () => { i++; step(); } }, i === set.length - 1 ? t('quiz.finish') : t('quiz.next'));
      const opts = q.options.map((o, idx) => h('button.quiz-opt', { type: 'button', onclick: () => {
        if (!next.hidden) return;
        opts.forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); });
        if (idx === q.answer) { score++; hapticSuccess(); } else { opts[idx].classList.add('wrong'); hapticTap(true); }
        explain.append(h('div.lesson', h('p.label', idx === q.answer ? t('quiz.correct') : t('quiz.wrong')), h('p', q.explain)));
        next.hidden = false; next.focus();
      } }, o));
      body.append(h('div.row.between', h('p.label', t('quiz.qn', { n: i + 1, total: set.length })), h('span.chip', t('quiz.cat.' + q.cat))),
        h('div.progress', h('span', { style: `width:${(i / set.length) * 100}%` })), h('h3.title.small', q.q), h('div.stack', opts), explain, next);
    };
    step();
  };
  home();
}
