# -*- coding: utf-8 -*-
"""프로젝트 결과물(플랫폼 문제·정답 JSON) → 홈페이지 숙제 세트 꼴 (2026-10-02).

    python prep_worker/결과물_변환.py <tsRoot> <questions.json> <answers.json> <out.json>

홈페이지 「JSON 등록」과 **같은 규칙**인 `C:/TS작업/일꾼/mr_변환.py`(merge · to_sets)를 그대로 부른다.
  · 정답 충돌 · 매칭 실패 · 중복이면 등록하지 않는다(MergeStop) → out.json 에 {ok:false, problems}
  · 성공하면 {ok:true, sets:[{setIdx,title,questions:[…]}], count}
⛔ 변환 규칙을 여기서 새로 짓지 않는다 — 홈페이지와 갈라지면 아이 화면이 달라진다.
"""
import json
import os
import sys


def main(ts_root, qf, af, out):
    sys.path.insert(0, os.path.join(ts_root, "일꾼"))
    import mr_변환 as M
    files = [json.load(open(qf, encoding="utf-8"))]
    if af and os.path.exists(af):
        files.append(json.load(open(af, encoding="utf-8")))
    try:
        qs = M.merge(files)
    except M.MergeStop as e:
        json.dump({"ok": False, "problems": e.문제들}, open(out, "w", encoding="utf-8", newline=""), ensure_ascii=False)
        return
    except SystemExit as e:
        json.dump({"ok": False, "problems": [str(e)]}, open(out, "w", encoding="utf-8", newline=""), ensure_ascii=False)
        return
    sets = M.to_sets(qs, 0)
    for s in sets:   # 등록 날짜·계산기 칸은 홈페이지 칸 꼴이라 공개 묶음에는 안 쓴다
        s.pop("createdAt", None)
        s.pop("calculatorRanges", None)
    json.dump({"ok": True, "sets": sets, "count": sum(len(s["questions"]) for s in sets)},
              open(out, "w", encoding="utf-8", newline=""), ensure_ascii=False)


if __name__ == "__main__":
    main(*sys.argv[1:5])
