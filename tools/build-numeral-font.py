#!/usr/bin/env python3
"""Build fonts/nepali-numerals-{300,400,700}.woff2 — the ten Devanagari digits, in their NEPALI forms (T68).

The Devanagari digits have one code point each but regional shapes: the everyday Nepali 5 and 8
differ from the Hindi-style forms most fonts (every Apple system font included) draw. Noto Sans
Devanagari carries the Nepali forms as `locl` alternates that switch on only for text tagged
lang="ne" — which would mean tagging every place a numeral can appear. So this bakes them in:
the NEP `locl` substitutions are applied to the cmap itself, the font is cut down to U+0966–096F,
and css/fonts.css declares the result under the app's own family names for that range only.
Every numeral on every screen then gets the Nepali forms with no markup, and nothing else changes.
(Reviewed against a native speaker's reference, Ross 2026-09-20.)

Source: Noto Sans Devanagari (SIL OFL 1.1, no Reserved Font Name — see
fonts/OFL-NotoSansDevanagari.txt), https://github.com/notofonts/devanagari — the shipped files were
cut from **Version 2.007** (the hinted TTFs; name ID 5 says so). Not committed, so a rebuild from a
later release can change the outlines: check the version, and compare a render, before committing. Each
argument is `<css weight>=<source ttf>`: the CSS weight is the Lato/Neuton slot the file fills, and
the source is deliberately a step LIGHTER than the slot — Noto's strokes run heavier than Lato's,
so Noto Bold beside Lato Bold read as too thick (Ross, 2026-09-20). As shipped:

    python3 -m venv venv && venv/bin/pip install fonttools brotli
    venv/bin/python tools/build-numeral-font.py 300=NotoSansDevanagari-Light.ttf \
        400=NotoSansDevanagari-Regular.ttf 700=NotoSansDevanagari-Medium.ttf

Re-run only to change the source font; the outputs are committed.
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

DIGITS = range(0x0966, 0x0970)
OUT = Path(__file__).resolve().parent.parent / 'fonts'


def nepali_substitutions(font):
    """Glyph -> glyph for every single substitution in the `locl` lookups of the NEP language system."""
    gsub = font['GSUB'].table
    lookups = set()
    for script in gsub.ScriptList.ScriptRecord:
        for lang in script.Script.LangSysRecord:
            if lang.LangSysTag.strip() != 'NEP':
                continue
            for index in lang.LangSys.FeatureIndex:
                feature = gsub.FeatureList.FeatureRecord[index]
                if feature.FeatureTag == 'locl':
                    lookups.update(feature.Feature.LookupListIndex)
    mapping = {}
    for index in lookups:
        for sub in gsub.LookupList.Lookup[index].SubTable:
            sub = getattr(sub, 'ExtSubTable', sub)
            if hasattr(sub, 'mapping'):
                mapping.update(sub.mapping)
    return mapping


def build(src, weight):
    font = TTFont(src)
    subs = nepali_substitutions(font)
    cmap = font.getBestCmap()
    swapped = {cp: subs[cmap[cp]] for cp in DIGITS if cmap[cp] in subs}
    if not swapped:
        sys.exit(f'{src}: no Nepali digit forms found in locl/NEP — wrong font?')
    for table in font['cmap'].tables:
        if table.isUnicode():
            for cp, glyph in swapped.items():
                table.cmap[cp] = glyph

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = []  # the forms are in the cmap now; no shaping needed for bare digits
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # keep copyright + licence (OFL)
    options.notdef_outline = True
    options.hinting = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=list(DIGITS))
    subsetter.subset(font)
    for record in font['name'].names:  # a modified version: don't pass as the original
        if record.nameID in (1, 4, 6):
            record.string = 'Sano Nepali Numerals' if record.nameID != 6 else 'SanoNepaliNumerals'
    out = OUT / f'nepali-numerals-{weight}.woff2'
    font.save(out)
    print(f'{out.name}: {out.stat().st_size} bytes; Nepali forms for ' + ' '.join(f'U+{cp:04X}' for cp in sorted(swapped)))


if __name__ == '__main__':
    pairs = [arg.split('=', 1) for arg in sys.argv[1:]]
    if not pairs or any(len(pair) != 2 or not pair[0].isdigit() for pair in pairs):
        sys.exit(__doc__)
    for weight, src in pairs:
        build(src, int(weight))
