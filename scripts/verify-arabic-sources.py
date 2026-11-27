#!/usr/bin/env python3
"""Verify that every Arabic text (`ar`) of web/data/hadiths.json, duas.json and
adhkar.json is copied from a source corpus.

Usage:  python3 -I scripts/verify-arabic-sources.py <dataset-dir>

<dataset-dir> must contain:
  q-ara-quranuthmanihaf.json                    {quran:[{chapter,verse,text}]}
  h-ara-{bukhari,muslim,tirmidhi,abudawud,nawawi}.json   {hadiths:[{hadithnumber,text}]}
  hisn_en.json                                  Hisn al-Muslim (Arabic fields are used)
  adhkar_rn0x.json                              adhkar dataset (every Arabic string is used)

Each `ar` text and each corpus entry is reduced to its bare letter skeleton:
diacritics, tatweel and Qur'anic annotation marks are removed, alef / hamza /
ya / ta-marbuta variants are unified, and whitespace and punctuation are
dropped. The text passes when its skeleton is a contiguous substring of one
corpus entry (for the Qur'an: of the running text of a surah, so that a
supplication spanning consecutive verses is accepted).

Prints every failing id and exits with status 1 if any text fails.
"""
import json
import os
import re
import sys

HADITH_FILES = ['h-ara-bukhari.json', 'h-ara-muslim.json', 'h-ara-tirmidhi.json',
                'h-ara-abudawud.json', 'h-ara-nawawi.json']
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'data')

# harakat, Qur'anic annotation signs, dagger alef, tatweel, extended Arabic marks
MARKS = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]')
ALEFS = re.compile('[آأإٱٲٳٵ]')   # آ أ إ ٱ ... -> ا
NON_LETTERS = re.compile('[^ء-ي]+')
ARABIC = re.compile('[ء-ي]')


def skeleton(text):
    text = MARKS.sub('', text)
    text = ALEFS.sub('ا', text)
    text = (text.replace('ى', 'ي')    # ى -> ي
                .replace('ی', 'ي')    # ی -> ي
                .replace('ؤ', 'و')    # ؤ -> و
                .replace('ئ', 'ي')    # ئ -> ي
                .replace('ة', 'ه'))   # ة -> ه
    return NON_LETTERS.sub('', text)            # drops spaces, punctuation, digits, Latin


def load(path):
    with open(path, encoding='utf-8-sig') as f:
        return json.load(f)


def strings(node):
    """Yield every string found anywhere in a JSON structure."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)


def build_corpus(src):
    entries = []
    # Qur'an: one running text per surah
    surahs = {}
    for v in load(os.path.join(src, 'q-ara-quranuthmanihaf.json'))['quran']:
        surahs.setdefault(v['chapter'], []).append(v['text'])
    entries += [' '.join(verses) for verses in surahs.values()]
    n_quran = len(entries)
    # hadith collections: one entry per hadith
    for name in HADITH_FILES:
        entries += [h['text'] for h in load(os.path.join(src, name))['hadiths'] if h.get('text')]
    n_hadith = len(entries) - n_quran
    # Hisn al-Muslim (Arabic fields) and the adhkar dataset: every Arabic string
    extra = 0
    for name in ['hisn_en.json', 'adhkar_rn0x.json']:
        for s in strings(load(os.path.join(src, name))):
            if ARABIC.search(s):
                entries.append(s)
                extra += 1
    print('corpus: %d surahs, %d hadiths, %d Hisn/adhkar strings' % (n_quran, n_hadith, extra))
    # '|' can never be part of a skeleton, so it safely separates the entries
    return '|'.join(skeleton(e) for e in entries)


def items():
    for h in load(os.path.join(DATA_DIR, 'hadiths.json')):
        yield 'hadiths.json', h['id'], h.get('ar', '')
    for d in load(os.path.join(DATA_DIR, 'duas.json')):
        yield 'duas.json', d['id'], d.get('ar', '')
    for section, lst in load(os.path.join(DATA_DIR, 'adhkar.json')).items():
        for a in lst:
            yield 'adhkar.json', '%s/%s' % (section, a['id']), a.get('ar', '')


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    corpus = build_corpus(sys.argv[1])
    total, failed = 0, []
    per_file = {}
    for fname, ident, ar in items():
        total += 1
        per_file[fname] = per_file.get(fname, 0) + 1
        sk = skeleton(ar)
        if not sk or sk not in corpus:
            failed.append((fname, ident))
            print('FAIL %s %s' % (fname, ident))
    for fname in sorted(per_file):
        bad = sum(1 for f, _ in failed if f == fname)
        print('%s: %d/%d verified' % (fname, per_file[fname] - bad, per_file[fname]))
    if failed:
        print('%d of %d Arabic texts NOT found in the source corpora' % (len(failed), total))
        return 1
    print('OK: all %d Arabic texts found in the source corpora' % total)
    return 0


if __name__ == '__main__':
    sys.exit(main())
