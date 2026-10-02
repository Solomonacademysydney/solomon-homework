# -*- coding: utf-8 -*-
"""툴체인 단원 색인 — 쌓인 「단원 프로그램(문제 생성기)」을 한 장으로 모은다 (2026-10-02).

    python prep_worker/툴체인_색인.py <툴체인 폴더> <색인.json>

무엇을 모으나
  tracks/<트랙>/ 와 tracks/<트랙>/history/<회차>/ 의 .py 가운데 **문제를 만드는 파일**
  (회차 설정·본문·검산 규칙·한국어 주석·배선 파일은 뺀다). 파일마다
    · 첫 설명 줄(단원 이름) · TAX / CAT 상수(분류) · 문제 함수 수(슬롯)
    · 내용 해시 — 같은 파일이 여러 회차에 복사돼 있으면 하나로 센다
  어느 트랙·회차에 처음 나왔는지, 몇 회차에 쓰였는지.

⛔ 툴체인 파일은 읽기만 한다. 고치지 않는다.
"""
import ast
import hashlib
import json
import os
import re
import sys

빼기 = re.compile(r'^(weekcfg|wbtext.*|rules.*|koann.*|sections|slotlib|rows|boot|verify.*|build_.*|mkjson.*|prev.*|__init__|common|doc|figs|figlib|figparse|mathlib|shapes|vals|ko|kobuild|koprobe)\.py$')


def 한파일(p):
    s = open(p, encoding='utf-8').read()
    try:
        t = ast.parse(s)
    except SyntaxError:
        return None
    doc = (ast.get_docstring(t) or '').strip()
    상수 = {}
    for n in t.body:
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and n.targets[0].id in ('TAX', 'CAT', 'UNIT', 'TOPIC'):
            try:
                상수[n.targets[0].id] = ast.literal_eval(n.value)
            except Exception:
                pass
    함수 = [n.name for n in t.body if isinstance(n, ast.FunctionDef) and not n.name.startswith('_')]
    return {
        '제목': doc.split('\n')[0][:200] if doc else '',
        '분류': 상수,
        '함수수': len(함수),
        '줄': s.count('\n') + 1,
        '해시': hashlib.sha256(s.encode('utf-8')).hexdigest()[:16],
    }


def main(root, out):
    모음 = {}
    for 트랙 in sorted(os.listdir(os.path.join(root, 'tracks'))):
        밑 = os.path.join(root, 'tracks', 트랙)
        if not os.path.isdir(밑):
            continue
        자리들 = [('지금', 밑)]
        h = os.path.join(밑, 'history')
        if os.path.isdir(h):
            자리들 += [(w, os.path.join(h, w)) for w in sorted(os.listdir(h)) if os.path.isdir(os.path.join(h, w))]
        for 회차, 폴더 in 자리들:
            for 이름 in sorted(os.listdir(폴더)):
                if not 이름.endswith('.py') or 빼기.match(이름):
                    continue
                for 하위 in ([폴더] if True else []):
                    p = os.path.join(하위, 이름)
                    r = 한파일(p)
                    if not r or r['함수수'] == 0:
                        continue
                    k = r['해시']
                    if k not in 모음:
                        모음[k] = dict(r, 파일=이름, 트랙=트랙, 처음=회차, 쓰인곳=[])
                    모음[k]['쓰인곳'].append(트랙 + '/' + 회차)
            # banks/ 아래 은행 파일(y5sel 등)
            b = os.path.join(폴더, 'banks')
            if os.path.isdir(b):
                for 이름 in sorted(os.listdir(b)):
                    if not 이름.endswith('.py') or 빼기.match(이름):
                        continue
                    r = 한파일(os.path.join(b, 이름))
                    if not r or r['함수수'] == 0:
                        continue
                    k = r['해시']
                    if k not in 모음:
                        모음[k] = dict(r, 파일='banks/' + 이름, 트랙=트랙, 처음=회차, 쓰인곳=[])
                    모음[k]['쓰인곳'].append(트랙 + '/' + 회차)
    줄 = sorted(모음.values(), key=lambda x: (x['트랙'], x['파일'], x['처음']))
    json.dump({'툴체인': os.path.abspath(root), '단원수': len(줄), '단원': 줄}, open(out, 'w', encoding='utf-8', newline=''), ensure_ascii=False, indent=1)
    return 줄


if __name__ == '__main__':
    줄 = main(sys.argv[1], sys.argv[2])
    print('단원 프로그램', len(줄), '개')
