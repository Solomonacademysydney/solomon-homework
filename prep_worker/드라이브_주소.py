# -*- coding: utf-8 -*-
"""드라이브 파일 주소 찾기 — 구글 드라이브 데스크톱 앱의 로컬 목록에서 파일 이름 → 클라우드 id (2026-10-02).

    python prep_worker/드라이브_주소.py <in.json> <out.json>
      in  = [{"name": "Y7_..._Workbook_Stella_2026-10-W2.pdf", "parent": "2026-10-02"}, ...]   (parent = 담긴 폴더 이름, 없어도 됨)
      out = {"<name>": "<id>" | null, ...}

왜: /prep/ 의 PDF 링크가 드라이브 「검색」에 기대면, 새 파일은 검색 색인이 늦어 「없음」이 뜬다(10-02 실측).
    파일 id 를 알면 https://drive.google.com/file/d/<id>/view 로 바로 열린다.
어떻게: %LOCALAPPDATA%/Google/DriveFS/<계정>/metadata_sqlite_db 의 items(id · local_title) + stable_parents.
⛔ 드라이브 앱의 파일은 읽기만 — 잠김을 피하려고 db·wal 을 임시 폴더에 복사해서 읽는다.
⛔ 같은 이름이 여러 곳에 있으면 담긴 폴더 이름(parent)으로 가린다. 그래도 둘 이상이거나 못 찾으면 null(화면은 검색 링크로 물러난다).
"""
import glob
import json
import os
import shutil
import sqlite3
import sys
import tempfile


def 목록db():
    바탕 = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google', 'DriveFS')
    후보 = [p for p in glob.glob(os.path.join(바탕, '*', 'metadata_sqlite_db')) if os.path.isfile(p)]
    if not 후보:
        return None
    후보.sort(key=os.path.getmtime, reverse=True)
    임시 = tempfile.mkdtemp(prefix='dfs_')
    for 꼬리 in ('', '-wal', '-shm'):
        s = 후보[0] + 꼬리
        if os.path.exists(s):
            shutil.copy2(s, os.path.join(임시, 'metadata_sqlite_db' + 꼬리))
    return os.path.join(임시, 'metadata_sqlite_db')


def 찾기(db, 줄):
    c = sqlite3.connect(db)
    c.text_factory = lambda b: b.decode('utf-8', 'replace')
    out = {}
    for x in 줄:
        name, parent = x.get('name'), x.get('parent')
        rows = c.execute(
            "select i.id, i.stable_id from items i where i.local_title = ? and coalesce(i.trashed,0) = 0 and coalesce(i.is_tombstone,0) = 0",
            (name,)).fetchall()
        if parent and len(rows) > 1:
            남 = []
            for rid, sid in rows:
                p = c.execute("select pi.local_title from stable_parents sp join items pi on pi.stable_id = sp.parent_stable_id where sp.item_stable_id = ?", (sid,)).fetchall()
                if any(t == parent for (t,) in p):
                    남.append((rid, sid))
            rows = 남
        out[name] = rows[0][0] if len(rows) == 1 else None
    return out


def main(inp, outp):
    줄 = json.load(open(inp, encoding='utf-8'))
    db = 목록db()
    out = 찾기(db, 줄) if db else {x.get('name'): None for x in 줄}
    json.dump(out, open(outp, 'w', encoding='utf-8', newline=''), ensure_ascii=False)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
