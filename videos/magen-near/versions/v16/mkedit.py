# Writes edit.json for v16: (id, src, a, b, voice, vat). All picture is the landing take or the iPhone takes.
import json
L = 'raw/L-landing.mp4'; P0, P1, P2, P3 = (f'raw/phone/{n}.mp4' for n in ('P0-install', 'P1-home', 'P2-bridge', 'P3-security'))
S = [
 ('landing', L, 0.0, 14.6, 'landing', 0.4, 'web'),
 ('install', P0, 2.5, 8.0, 'install', 0.6), ('open', P0, 12.3, 13.4, None, 0), ('open-1', P0, 14.45, 21.4, None, 0),
 ('name', P0, 49.8, 57.3, 'create', 2.0), ('words', P0, 57.4, 63.0, None, 0),
 ('chains', P0, 64.5, 72.6, 'chains', 0.2), ('create', P0, 73.6, 86.3, 'create-sign', 7.6), ('ready', P0, 86.3, 90.5, None, 0),
 ('create-x', P0, 106.3, 111.2, 'home', 0.3), ('home', P1, 4.6, 9.1, None, 0),
 ('recv-near', P1, 9.1, 16.5, 'receive', 0.5), ('recv-btc', P1, 24.4, 29.6, None, 0),
 ('send-0', P1, 29.6, 31.4, 'send', 0.3), ('send-1', P1, 54.3, 57.5, None, 0), ('send-sheet', P1, 57.5, 64.6, None, 0), ('send-done', P1, 64.6, 69.5, None, 0),
 ('send-x', P1, 76.0, 87.3, 'send-explorer', 0.5),
 ('swap-0', P1, 165.6, 171.1, 'swap', 0.3), ('swap-sheet', P1, 171.1, 176.5, None, 0), ('swap-1', P1, 176.5, 178.5, None, 0), ('swap-done', P1, 181.6, 185.6, None, 0),
 ('swap-x', P1, 187.0, 191.9, 'swap-explorer', 0.4),
 ('bin-home', P2, 6.0, 12.3, 'bridge-in', 3.0), ('bin-addr', P2, 14.3, 19.5, None, 0), ('bin-empty', P2, 32.0, 41.0, 'bridge-demo', 2.0), ('bin-minted', P2, 48.3, 55.2, None, 0),
 ('bin-x', P2, 56.0, 63.0, 'btc-explorer', 0.3), ('btc-x', P2, 139.9, 146.5, None, 0),
 ('zec-0', P2, 446.5, 451.0, 'zec', 0.3), ('zec-1', P2, 465.5, 471.0, None, 0),
 ('out-0', P2, 481.0, 487.6, 'out', 0.3), ('out-sheet-a', P2, 487.6, 491.5, None, 0), ('out-sheet-b', P2, 495.5, 499.2, None, 0),
 ('out-1', P2, 499.2, 503.0, 'out-relay', 1.0), ('out-2', P2, 515.5, 519.0, None, 0), ('out-done', P2, 553.3, 556.5, None, 0),
 ('out-x-near', P2, 530.0, 536.5, 'out-explorer', 0.5), ('out-x-sol', P2, 542.0, 550.0, None, 0),
 ('priv-0', P1, 112.0, 115.4, 'private', 0.3), ('priv-sheet', P1, 115.4, 120.4, None, 0), ('priv-done', P1, 120.4, 125.8, None, 0), ('priv-x', P1, 128.0, 132.5, None, 0),
 ('guard-0', P3, 6.0, 14.0, 'guardians', 0.4), ('guard-sheet', P3, 14.0, 20.5, None, 0), ('guard-done', P3, 20.5, 27.0, 'guard-done', 1.5), ('guard-x', P3, 37.5, 43.5, None, 0),
 ('qday-0', P3, 47.4, 52.6, 'qday', 0.3), ('qday-sheet', P3, 52.6, 59.0, None, 0), ('qday-1', P3, 61.5, 66.0, None, 0), ('qday-on', P3, 71.8, 76.3, None, 0),
 ('qday-x', P3, 76.4, 77.75, None, 0), ('qday-acct', P3, 78.9, 85.0, 'qday-explorer', 0.2),
 ('activity', P3, 91.0, 98.9, 'activity', 0.4), ('activity-x', P3, 101.5, 104.5, None, 0),
 ('lock-0', P3, 112.3, 115.5, 'lock', 0.3), ('lock-1', P3, 119.5, 124.0, None, 0),
 ('card', None, 0, 6.5, 'close', 0.6, 'card'),
]
segs = []
for r in S:
    i, src, a, b, v, vat = r[:6]; kind = r[6] if len(r) > 6 else 'phone'
    d = {'id': i, 'src': src, 'a': a, 'b': b, 'kind': kind}
    if v: d.update(voice=v, vat=vat)
    segs.append(d)
json.dump({'segments': segs}, open('edit.json', 'w'), indent=1)
print(len(segs), 'segments', round(sum(s['b'] - s['a'] for s in segs), 1), 's')
