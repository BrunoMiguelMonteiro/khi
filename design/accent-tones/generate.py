#!/usr/bin/env python3
"""Khi v2 — accent tone table generator (proposal for Task 21).

Run:  python3 design/accent-tones/generate.py   -> writes design/accent-tones.json + report.md, then self-checks
      python3 design/accent-tones/generate.py --check   -> regenerates in memory, compares the bytes of both files on
                                                           disk and validates the table on disk; exits 1 on any failure
Inputs are inlined below (with their sources) so the result is reproducible without the repo.
"""
import json, math, re, sys, os
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oklch import hex2oklch, oklch2hex, cr, deltaE

HERE = os.path.dirname(os.path.abspath(__file__))
TONES = ['primary', 'primary-foreground', 'primary-hover', 'primary-pressed',
         'link', 'primary-tint', 'primary-tint-foreground', 'ring']
MODES = ['claro', 'escuro']

# design/tokens.json (cor/claro, cor/escuro)
TOKENS = {
    'claro': {'background': '#FFFFFF', 'card': '#F5F5F7',
              'primary': '#0066D6', 'primary-foreground': '#FFFFFF', 'primary-hover': '#005BBF',
              'primary-pressed': '#0050A8', 'link': '#0066D6', 'primary-tint': '#E0ECFE',
              'primary-tint-foreground': '#0666D4', 'ring': '#0066D6'},
    'escuro': {'background': '#1E1E1E', 'card': '#2A2A2C',
               'primary': '#62A6FF', 'primary-foreground': '#051A36', 'primary-hover': '#7FB6FF',
               'primary-pressed': '#9CC6FF', 'link': '#569FFD', 'primary-tint': '#1B3659',
               'primary-tint-foreground': '#569FFD', 'ring': '#569FFD'},
}
BLUE_MEASURED = '#007AFF'

# DECISIONS.md, Cor 2, «Verificado (Task 20)»: NSColor.controlAccentColor in sRGB (Aqua / Dark Aqua)
SYSTEM = {
    'grafite':  ('#989898', '#8C8C8C'),
    'vermelho': ('#E0383E', '#FF5257'),
    'laranja':  ('#F7821B', '#F7821B'),
    'amarelo':  ('#FFC726', '#FFC600'),
    'verde':    ('#62BA46', '#62BA46'),
    'azul':     ('#007AFF', '#007AFF'),
    'roxo':     ('#953D96', '#A550A7'),
    'rosa':     ('#F74F9E', '#F74F9E'),
}

# DECISIONS.md, Cor 2, «Amostras vivas» (button, button text, link) + Figma «Cor · 4» (9:3894) tags.
# tag = (figma node of the Etiqueta frame, tint, figma node of the text, tint-foreground)
SWATCHES = {
    'azul-tinta':  {'claro': ('#2C5A8C', '#FFFFFF', '#2C5A8C', ('9:4133', '#DEEDFF', '9:4134', '#2C5A8C')),
                    'escuro': ('#8DB6E8', '#111B28', '#8DB6E8', ('9:4140', '#293647', '9:4141', '#8DB6E8'))},
    'verde-folha': {'claro': ('#3FA34D', '#06210A', '#1B8732', ('9:4150', '#D8F4D9', '9:4151', '#047C26')),
                    'escuro': ('#3FA34D', '#06210A', '#3FA34D', ('9:4157', '#1E3E21', '9:4158', '#52B55E'))},
    'turquesa':    {'claro': ('#1FA5A0', '#00201F', '#058480', ('9:4167', '#D4F3F0', '9:4168', '#0B7773')),
                    'escuro': ('#1FA5A0', '#00201F', '#1FA5A0', ('9:4174', '#173C3B', '9:4175', '#31B0AB'))},
    'laranja':     {'claro': ('#F07A2A', '#2F1100', '#BD590B', ('9:4184', '#FFE5D8', '9:4185', '#AB4E02')),
                    'escuro': ('#F07A2A', '#2F1100', '#F07A2A', ('9:4191', '#512A12', '9:4192', '#F27C2C'))},
    'amarelo':     {'claro': ('#F2C230', '#231900', '#907107', ('9:4201', '#F8EAC8', '9:4202', '#836601')),
                    'escuro': ('#F2C230', '#231900', '#F2C230', ('9:4208', '#423305', '9:4209', '#F2C230'))},
    'rosa':        {'claro': ('#E8559A', '#2F0C1C', '#CF3D85', ('9:4218', '#FFE2EC', '9:4219', '#BE2B76')),
                    'escuro': ('#E8559A', '#2F0C1C', '#E8559A', ('9:4225', '#502537', '9:4226', '#FA65A9'))},
    'violeta':     {'claro': ('#9866EC', '#1E1332', '#8D59DE', ('9:4235', '#EDE7FF', '9:4236', '#7F4BCF')),
                    'escuro': ('#9866EC', '#1E1332', '#9C6BF1', ('9:4242', '#3A2D54', '9:4243', '#B086FE'))},
}

TEXT, NONTEXT, STEP = 4.5, 3.0, 0.001
PRESSED_MAX_L = 0.95


def r(x, n=4):
    return round(x + 0.0, n)


# ---------------------------------------------------------------- rule inferred from the tokens blue
def rel(a, b):
    """OKLCH delta from a to b: (dL, C ratio, dH)."""
    La, Ca, Ha = hex2oklch(a)
    Lb, Cb, Hb = hex2oklch(b)
    return Lb - La, Cb / Ca, ((Hb - Ha + 180) % 360) - 180


def infer_rule():
    t = TOKENS
    R = {}
    for m in MODES:
        p = t[m]['primary']
        R[m] = {
            'primary': rel(BLUE_MEASURED, p),
            'primary-hover': rel(p, t[m]['primary-hover']),
            'primary-pressed': rel(p, t[m]['primary-pressed']),
            'tint_L': hex2oklch(t[m]['primary-tint'])[0],
            'tint_Cr': hex2oklch(t[m]['primary-tint'])[1] / hex2oklch(p)[1],
        }
    R['claro']['primary-tint-foreground'] = rel(t['claro']['primary'], t['claro']['primary-tint-foreground'])
    R['escuro']['link'] = rel(t['escuro']['primary'], t['escuro']['link'])
    R['escuro']['fg_L'] = hex2oklch(t['escuro']['primary-foreground'])[0]
    R['escuro']['fg_Cr'] = hex2oklch(t['escuro']['primary-foreground'])[1] / hex2oklch(t['escuro']['primary'])[1]
    return R


RULE = infer_rule()


def apply(base_hex, delta, hue):
    L, C, _ = hex2oklch(base_hex)
    dL, Cr, _dH = delta
    return L + dL, C * Cr, hue


def fmt_delta(d):
    return 'L%+.4f C×%.3f' % (d[0], d[1])


def nudge(L, C, H, ok, direction, limit=1.0):
    """Move L by STEP in `direction` until ok(hex). Returns (hex, L, steps)."""
    steps = 0
    h = oklch2hex(L, C, H)
    while not ok(h):
        steps += 1
        L += direction * STEP
        if L < 0 or L > limit:
            raise SystemExit('cannot satisfy constraint at H=%.1f' % H)
        h = oklch2hex(L, C, H)
    return h, L, steps


def adj(steps, direction, what):
    if not steps:
        return ''
    return '; %s L%+.3f até %s' % ('escurecido' if direction < 0 else 'clareado', direction * steps * STEP, what)


# ---------------------------------------------------------------- system colours
def system_tones(name, mode, measured):
    bg, card = TOKENS[mode]['background'], TOKENS[mode]['card']
    R = RULE[mode]
    H = hex2oklch(measured)[2]
    src_in = 'sistema(Task 20 %s)' % measured
    out = {}
    light = mode == 'claro'
    d = -1 if light else +1  # direction that raises contrast against the button text

    L0, C0, _ = apply(measured, R['primary'], H)
    cap = ''
    if not light and L0 + R['primary-pressed'][0] > PRESSED_MAX_L:
        # a bright colour (yellow) would reach white on press: keep pressed below PRESSED_MAX_L
        L0 = PRESSED_MAX_L - R['primary-pressed'][0]
        cap = '; L limitado a %.4f para o pressed ficar ≤ %.2f' % (L0, PRESSED_MAX_L)

    def tones_from(L):
        p = oklch2hex(L, C0, H)
        hv = oklch2hex(*apply(p, R['primary-hover'], H))
        pr = oklch2hex(*apply(p, R['primary-pressed'], H))
        if light:
            fg = '#FFFFFF'
        else:
            Lp, Cp, _ = hex2oklch(p)
            fg = oklch2hex(R['fg_L'], Cp * R['fg_Cr'], H)
        return p, hv, pr, fg

    # nudge primary L until the text passes on primary, hover and pressed
    L, steps = L0, 0
    while True:
        p, hv, pr, fg = tones_from(L)
        if all(cr(fg, x) >= TEXT for x in (p, hv, pr)):
            break
        steps += 1
        L += d * STEP
        if not 0 <= L <= 1:
            raise SystemExit('button fails for %s %s' % (name, mode))
    p, hv, pr, fg = tones_from(L)
    rule_p = 'derivado:%s %s h mantido (regra do azul)%s' % (src_in, fmt_delta(R['primary']),
                                                            cap + adj(steps, d, 'texto ≥ 4,5 no primary/hover/pressed'))
    out['primary'] = (p, rule_p)
    out['primary-foreground'] = (fg, 'derivado:branco (DECISIONS, Cor 2: claro = texto branco)' if light else
                                 'derivado:L=%.4f C=primary.C×%.3f h do primary (regra do azul #051A36)' % (R['fg_L'], R['fg_Cr']))
    out['primary-hover'] = (hv, 'derivado:primary %s (regra do azul)' % fmt_delta(R['primary-hover']))
    out['primary-pressed'] = (pr, 'derivado:primary %s (regra do azul)' % fmt_delta(R['primary-pressed']))

    # link
    if light:
        Ll, Cl, _ = hex2oklch(p)
        base = 'derivado:link = primary (regra do azul)'
    else:
        Ll, Cl, _ = apply(p, R['link'], H)
        base = 'derivado:primary %s (regra do azul)' % fmt_delta(R['link'])
    lk, _, st = nudge(Ll, Cl, H, lambda h: cr(h, bg) >= TEXT and cr(h, card) >= TEXT, d)
    out['link'] = (lk, base + adj(st, d, 'link ≥ 4,5 no background e no card'))

    # tint
    Cp = hex2oklch(p)[1]
    tint = oklch2hex(R['tint_L'], Cp * R['tint_Cr'], H)
    out['primary-tint'] = (tint, 'derivado:L=%.4f C=primary.C×%.3f (regra do azul; DECISIONS L≈%s)' %
                           (R['tint_L'], R['tint_Cr'], '0,94' if light else '0,33'))

    # tint foreground (also the 1 px contrast outline of tags, Tema 3)
    if light:
        Lt, Ct, _ = apply(p, R['primary-tint-foreground'], H)
        base = 'derivado:primary %s (regra do azul)' % fmt_delta(R['primary-tint-foreground'])
    else:
        Lt, Ct, _ = hex2oklch(lk)
        base = 'derivado:primary-tint-foreground = link (regra do azul)'
    tf, _, st = nudge(Lt, Ct, H, lambda h: cr(h, tint) >= TEXT and cr(h, bg) >= NONTEXT and cr(h, card) >= NONTEXT,
                      -1 if light else +1)
    out['primary-tint-foreground'] = (tf, base + adj(st, -1 if light else +1, 'texto ≥ 4,5 no tint e contorno ≥ 3'))
    out['ring'] = (lk, 'derivado:ring = link (regra do azul)')
    return out


# ---------------------------------------------------------------- swatches
def swatch_tones(name, mode, spec):
    bg, card = TOKENS[mode]['background'], TOKENS[mode]['card']
    p, fg, lk, (tnode, tint, tfnode, tf) = spec
    out = {}
    dec = 'DECISIONS Cor 2 «Amostras vivas»'
    out['primary'] = (p, 'figma:9:3894 (%s, botão)' % dec)
    out['primary-foreground'] = (fg, 'figma:9:3894 (%s, texto do botão)' % dec)
    white = fg.upper() == '#FFFFFF'
    pat = 'claro' if white else 'escuro'  # light text → darker on hover (as Light blue); dark text → lighter (as Dark blue)
    H = hex2oklch(p)[2]
    d = -1 if white else +1
    for tone in ('primary-hover', 'primary-pressed'):
        L, C, _ = apply(p, RULE[pat][tone], H)
        h, _, st = nudge(L, C, H, lambda h: cr(fg, h) >= TEXT, d)
        out[tone] = (h, 'derivado:primary %s (regra do azul %s: texto %s)%s' %
                     (fmt_delta(RULE[pat][tone]), 'Claro' if white else 'Escuro', 'claro' if white else 'escuro',
                      adj(st, d, 'texto ≥ 4,5')))
    # link: approved value, nudged only if it fails on background or card
    Ll, Cl, Hl = hex2oklch(lk)
    dl = -1 if mode == 'claro' else +1
    nl, _, st = nudge(Ll, Cl, Hl, lambda h: cr(h, bg) >= TEXT and cr(h, card) >= TEXT, dl)
    if st:
        out['link'] = (nl, 'derivado:aprovado %s %s (%s)%s' % (lk, dec, 'ligação', adj(st, dl, 'link ≥ 4,5 no background e no card')))
    else:
        out['link'] = (lk, 'figma:9:3894 (%s, ligação)' % dec)
    out['primary-tint'] = (tint, 'figma:%s' % tnode)
    Lt, Ct, Ht = hex2oklch(tf)
    nt, _, st = nudge(Lt, Ct, Ht, lambda h: cr(h, tint) >= TEXT and cr(h, bg) >= NONTEXT and cr(h, card) >= NONTEXT, dl)
    out['primary-tint-foreground'] = (nt, 'figma:%s' % tfnode if not st else
                                      'derivado:figma:%s %s%s' % (tfnode, tf, adj(st, dl, 'texto ≥ 4,5 no tint e contorno ≥ 3')))
    out['ring'] = (out['link'][0], 'derivado:ring = link (regra do azul)')
    return out


def build():
    data = {'_meta': {
        'task': 'docs/plans/0002-redesign.md Task 21 — aprovada pelo Bruno a 2026-11-19 (Questão 1; Figma 112:27669)',
        'generator': 'generate.py (oklch.py), OKLCH Björn Ottosson, WCAG 2.x sem arredondar',
        'modes': 'claro / escuro = cor/claro e cor/escuro de design/tokens.json',
        'multicolor': 'azul-tinta (amostras.azul-tinta)',
        'rule': {m: {k: ([r(v[0]), r(v[1]), r(v[2], 2)] if isinstance(v, tuple) else r(v)) for k, v in RULE[m].items()}
                 for m in MODES},
    }, 'sistema': {}, 'amostras': {}}
    for name, (lm, dm) in SYSTEM.items():
        data['sistema'][name] = {}
        for mode, measured in (('claro', lm), ('escuro', dm)):
            if name == 'azul':
                tones = {t: (TOKENS[mode][t], 'tokens:cor/%s/%s' % (mode, t)) for t in TONES}
            else:
                tones = system_tones(name, mode, measured)
            data['sistema'][name][mode] = {t: {'value': tones[t][0], 'source': tones[t][1]} for t in TONES}
    for name, spec in SWATCHES.items():
        data['amostras'][name] = {}
        for mode in MODES:
            tones = swatch_tones(name, mode, spec[mode])
            data['amostras'][name][mode] = {t: {'value': tones[t][0], 'source': tones[t][1]} for t in TONES}
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


# ---------------------------------------------------------------- schema (independent of the inputs above)
# Task 21: 8 system colours and 7 swatches, Claro and Escuro, every tone with a value and its origin.
EXPECTED = {
    'sistema': ['grafite', 'vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa'],
    'amostras': ['azul-tinta', 'verde-folha', 'turquesa', 'laranja', 'amarelo', 'rosa', 'violeta'],
}
EXPECTED_TONES = ['primary', 'primary-foreground', 'primary-hover', 'primary-pressed',
                  'link', 'primary-tint', 'primary-tint-foreground', 'ring']
EXPECTED_MODES = ['claro', 'escuro']
EXPECTED_META = ['task', 'generator', 'modes', 'multicolor', 'rule']
MULTICOLOR = 'azul-tinta'
# Origins (Task 21): figma:<node>, sistema:<Task 20>, derivado:<rule>; the blue is tokens:cor/<mode>/<tone>.
SOURCE_RE = re.compile(r'^(figma:\d+:\d+(?: \(.+\))?|sistema:\S.*|derivado:\S.*|tokens:cor/(claro|escuro)/[a-z-]+)$')
HEX_RE = re.compile(r'^#[0-9A-F]{6}$')


def validate_schema(data):
    errs = []
    if not isinstance(data, dict) or list(data) != ['_meta', 'sistema', 'amostras']:
        return ['top-level keys %r != [_meta, sistema, amostras]' % (list(data) if isinstance(data, dict) else data,)]
    if list(data['_meta']) != EXPECTED_META:
        errs.append('_meta keys %r != %r' % (list(data['_meta']), EXPECTED_META))
    if not str(data['_meta'].get('multicolor', '')).startswith(MULTICOLOR + ' '):
        errs.append('_meta.multicolor does not map Multicolor to %s' % MULTICOLOR)
    for group, names in EXPECTED.items():
        if list(data[group]) != names:
            errs.append('%s rows %r != %r' % (group, list(data[group]), names))
        for name in names:
            modes = data[group].get(name)
            if not isinstance(modes, dict) or list(modes) != EXPECTED_MODES:
                errs.append('%s/%s modes %r != %r' % (group, name, modes and list(modes), EXPECTED_MODES))
                continue
            for mode in EXPECTED_MODES:
                tones = modes[mode]
                if list(tones) != EXPECTED_TONES:
                    errs.append('%s/%s/%s tones %r != %r' % (group, name, mode, list(tones), EXPECTED_TONES))
                    continue
                for tone, entry in tones.items():
                    where = '%s/%s/%s/%s' % (group, name, mode, tone)
                    if not isinstance(entry, dict) or list(entry) != ['value', 'source']:
                        errs.append('%s entry %r is not {value, source}' % (where, entry))
                        continue
                    if not isinstance(entry['value'], str) or not HEX_RE.match(entry['value']):
                        errs.append('%s value %r is not #RRGGBB' % (where, entry['value']))
                    src = entry['source']
                    if not isinstance(src, str) or not SOURCE_RE.match(src):
                        errs.append('%s source %r has no valid origin' % (where, src))
                    elif src.startswith('tokens:') != ((group, name) == ('sistema', 'azul')):
                        errs.append('%s source %r: tokens: is for the system blue only, and all of it' % (where, src))
                    elif src.startswith('tokens:') and src != 'tokens:cor/%s/%s' % (mode, tone):
                        errs.append('%s source %r != tokens:cor/%s/%s' % (where, src, mode, tone))
    return errs


# ---------------------------------------------------------------- self-check
def self_check(data):
    errs = []
    for group in ('sistema', 'amostras'):
        for name, modes in data[group].items():
            for mode in MODES:
                v = {k: x['value'] for k, x in modes[mode].items()}
                assert set(v) == set(TONES), (name, mode)
                assert all(x['source'] for x in modes[mode].values())
                bg, card = TOKENS[mode]['background'], TOKENS[mode]['card']
                checks = [('fg/primary', cr(v['primary-foreground'], v['primary']), TEXT),
                          ('fg/hover', cr(v['primary-foreground'], v['primary-hover']), TEXT),
                          ('fg/pressed', cr(v['primary-foreground'], v['primary-pressed']), TEXT),
                          ('link/bg', cr(v['link'], bg), TEXT), ('link/card', cr(v['link'], card), TEXT),
                          ('tintfg/tint', cr(v['primary-tint-foreground'], v['primary-tint']), TEXT),
                          ('tintfg outline/bg', cr(v['primary-tint-foreground'], bg), NONTEXT),
                          ('tintfg outline/card', cr(v['primary-tint-foreground'], card), NONTEXT)]
                if len({v['primary'], v['primary-hover'], v['primary-pressed']}) < 3:
                    errs.append('%s/%s/%s primary/hover/pressed not distinct' % (group, name, mode))
                for label, val, need in checks:
                    if val < need:
                        errs.append('%s/%s/%s %s %.4f < %s' % (group, name, mode, label, val, need))
    for mode in MODES:
        for t in TONES:
            if data['sistema']['azul'][mode][t]['value'] != TOKENS[mode][t]:
                errs.append('azul %s %s != tokens' % (mode, t))
    return errs


def report(data):
    L = ['# Tons de destaque — aprovados (Task 21)', '',
         'Gerado por `generate.py`. Contraste WCAG 2.x sem arredondar (aqui a 2 casas). '
         'Fundos: claro `#FFFFFF` / card `#F5F5F7`; escuro `#1E1E1E` / card `#2A2A2C`. '
         'Multicolor → Azul-tinta.', '',
         '## Regra inferida do azul (tokens.json vs `#007AFF` medido)', '',
         'OKLCH; ΔL absoluto, C como razão; o matiz é sempre o da cor de entrada (o azul dos tokens desvia ≤ 1,7°, ruído do sRGB).', '',
         '| Tom | Claro | Escuro |', '|---|---|---|']
    R = RULE
    L.append('| primary (do medido) | %s | %s |' % (fmt_delta(R['claro']['primary']), fmt_delta(R['escuro']['primary'])))
    L.append('| primary-foreground | branco | L=%.4f, C=primary.C×%.3f |' % (R['escuro']['fg_L'], R['escuro']['fg_Cr']))
    L.append('| primary-hover (do primary) | %s | %s |' % (fmt_delta(R['claro']['primary-hover']), fmt_delta(R['escuro']['primary-hover'])))
    L.append('| primary-pressed (do primary) | %s | %s |' % (fmt_delta(R['claro']['primary-pressed']), fmt_delta(R['escuro']['primary-pressed'])))
    L.append('| link | = primary | primary %s |' % fmt_delta(R['escuro']['link']))
    L.append('| primary-tint | L=%.4f, C=primary.C×%.3f | L=%.4f, C=primary.C×%.3f |' % (
        R['claro']['tint_L'], R['claro']['tint_Cr'], R['escuro']['tint_L'], R['escuro']['tint_Cr']))
    L.append('| primary-tint-foreground | primary %s | = link |' % fmt_delta(R['claro']['primary-tint-foreground']))
    L.append('| ring | = link | = link |')
    L += ['', 'A regra aplicada ao próprio `#007AFF` (matiz mantido), comparada com os tokens (a tabela usa os tokens):', '',
          '| Modo | Tom | regra | tokens | ΔE×100 |', '|---|---|---|---|---|']
    for mode in MODES:
        gen = system_tones('azul', mode, BLUE_MEASURED)
        for t in TONES:
            L.append('| %s | %s | `%s` | `%s` | %.2f |' % (mode, t, gen[t][0], TOKENS[mode][t], deltaE(gen[t][0], TOKENS[mode][t]) * 100))
    L += ['', 'Depois: se um par falha, mexe-se só no L (passos de 0,001), para o lado que sobe o contraste: '
          'primary (com hover/pressed atrás) até o texto passar nos três; link até ≥ 4,5 no background **e** no card; '
          'tint-foreground até ≥ 4,5 no tint e ≥ 3 como contorno (Tema 3) no background e no card. '
          'Amostras: botão, texto e etiqueta são os aprovados (DECISIONS / Figma «Cor · 4»); '
          'hover/pressed seguem o padrão do azul Claro se o texto é branco (escurece) e o do Escuro se o texto é escuro (clareia); ring = link.', '']
    L += ['## Tabelas', '',
          'Colunas: valor (contraste). fg = texto sobre primary · link = sobre background / card · tint-fg = sobre tint · contorno = tint-fg sobre background / card.', '']
    for group, title in (('sistema', 'Cores do sistema'), ('amostras', 'Amostras')):
        L += ['### ' + title, '',
              '| Cor | Modo | primary | fg | hover / pressed (fg) | link (bg / card) | tint | tint-fg (tint · contorno bg/card) |',
              '|---|---|---|---|---|---|---|---|']
        for name, modes in data[group].items():
            for mode in MODES:
                v = {k: x['value'] for k, x in modes[mode].items()}
                bg, card = TOKENS[mode]['background'], TOKENS[mode]['card']
                L.append('| %s | %s | `%s` | `%s` %.2f | `%s` %.2f / `%s` %.2f | `%s` %.2f / %.2f | `%s` | `%s` %.2f · %.2f / %.2f |' % (
                    name, mode, v['primary'], v['primary-foreground'], cr(v['primary-foreground'], v['primary']),
                    v['primary-hover'], cr(v['primary-foreground'], v['primary-hover']),
                    v['primary-pressed'], cr(v['primary-foreground'], v['primary-pressed']),
                    v['link'], cr(v['link'], bg), cr(v['link'], card), v['primary-tint'],
                    v['primary-tint-foreground'], cr(v['primary-tint-foreground'], v['primary-tint']),
                    cr(v['primary-tint-foreground'], bg), cr(v['primary-tint-foreground'], card)))
        L.append('')
    L += ['## Desvio do botão em relação à cor do sistema', '',
          'ΔE OKLab (×100) entre o `controlAccentColor` medido e o `primary`. ≥ 10 nota-se bem; ≥ 20 muda de carácter.', '',
          '| Cor | Modo | medido | primary | ΔE | ΔL | nota |', '|---|---|---|---|---|---|---|']
    for name, (lm, dm) in SYSTEM.items():
        for mode, m in (('claro', lm), ('escuro', dm)):
            p = data['sistema'][name][mode]['primary']['value']
            de = deltaE(m, p) * 100
            dL = hex2oklch(p)[0] - hex2oklch(m)[0]
            note = ''
            if de >= 20:
                note = '**muda de carácter**'
            elif de >= 10:
                note = 'visível'
            L.append('| %s | %s | `%s` | `%s` | %.1f | %+.3f | %s |' % (name, mode, m, p, de, dL, note))
    L += ['', '## Ajustes às amostras aprovadas', '']
    adjusted = [(n, m, t, x) for n, ms in data['amostras'].items() for m in MODES for t, x in ms[m].items()
                if x['source'].startswith('derivado:aprovado') or x['source'].startswith('derivado:figma')]
    if adjusted:
        for n, m, t, x in adjusted:
            L.append('- %s · %s · `%s` → `%s`: %s' % (n, m, t, x['value'], x['source']))
    else:
        L.append('- nenhum')
    L.append('')
    return '\n'.join(L)


def main():
    js = build()
    data = json.loads(js)
    rep = report(data)
    paths = {os.path.join(HERE, '..', 'accent-tones.json'): js, os.path.join(HERE, 'report.md'): rep}
    errs = validate_schema(data) or self_check(data)
    if '--check' in sys.argv:
        for p, c in paths.items():
            try:
                with open(p, 'rb') as f:
                    same = f.read() == c.encode('utf-8')
            except OSError as e:
                same = False
                print('  ', e)
            print('byte-for-byte %s: %s' % (os.path.relpath(p, os.path.join(HERE, '..', '..')), 'OK' if same else 'DIFFERS'))
            if not same:
                errs.append('%s differs from the generator output' % os.path.basename(p))
        try:
            with open(os.path.join(HERE, '..', 'accent-tones.json'), 'rb') as f:
                disk = json.loads(f.read().decode('utf-8'))
        except (OSError, ValueError) as e:
            errs.append('accent-tones.json unreadable: %s' % e)
        else:
            disk_errs = validate_schema(disk)
            errs += ['on disk: ' + e for e in disk_errs or self_check(disk)]
    else:
        for p, c in paths.items():
            with open(p, 'w', encoding='utf-8', newline='\n') as f:
                f.write(c)
    print('self-check:', 'OK' if not errs else 'FAIL')
    for e in errs:
        print('  ', e)
    sys.exit(1 if errs else 0)

if __name__ == '__main__':
    main()
