# -*- coding: utf-8 -*-
r"""ts_고르기.py — 제작 주문의 TS 칸을 **창고(검수 통과 벌)** 에서만 고른다.

    python prep_worker\ts_고르기.py 입력.json 출력.json

입력: { tsRoot, level, title, figures:'include'|'exclude', slots:[{id,section,worked}], exclude:[id…], seed }
출력: { ok, picks:{칸id: 문항}, short:null | { need, have, why, alternatives:[…] }, release }

⛔ 지키는 선
  · 창고 벌을 읽기만 한다(`build_ts_daily.load_release` — 차단 문항은 이미 빠져 있다).
  · 모자라면 **임의로 안 채운다**. 필요·가능·대안을 돌려주고 일꾼이 주문을 보류한다.
  · 같은 입력이면 같은 답(seed 고정).
"""
import json
import random
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# 커리의 TS 제목 → 창고 유형. 창고 유형 이름을 그대로 쓰면 그것으로.
제목표 = {
    "수열": "규칙 찾기", "규칙": "규칙 찾기", "패턴": "규칙 찾기",
    "배열": "조건 배열", "논리": "조건 배열", "추론": "누구 추론이 옳은가",
    "전개도": "전개도·주사위", "주사위": "전개도·주사위", "공간": "조각 맞추기",
    "그래프": "그래프·표 해석", "표": "그래프·표 해석", "시간표": "시간표 읽기",
    "코드": "기호 변환", "암호": "기호 변환", "벤다이어그램": "벤다이어그램",
}


def 유형고르기(title, 유형들):
    t = (title or "").strip()
    if t in 유형들:
        return t, "제목 그대로"
    for k, v in 제목표.items():
        if k in t:
            return v, "제목표(%s→%s)" % (k, v)
    return None, "제목에 맞는 유형 없음 — 레벨만 맞춤"


def 가볍게(it):
    opts = it.get("options") or []
    letters = "ABCDE"
    ans = [i for i, o in enumerate(opts) if o.get("grade") == "정답"]
    return {
        "id": it["id"], "rev": (it.get("provenance") or {}).get("created_at"), "type": it.get("type"), "level": it.get("level"),
        "stem_en": it.get("question_text_en") or "", "stem_ko": it.get("question_text_ko") or "",
        "options": [{"letter": letters[i], "en": o.get("text_en") or "", "ko": o.get("text_ko") or ""} for i, o in enumerate(opts)],
        "answerLetter": letters[ans[0]] if len(ans) == 1 else None,
        "solution_en": [s.get("en") for s in (it.get("solution_steps") or [])],
        "solution_ko": [s.get("ko") for s in (it.get("solution_steps") or [])],
        "figureSvg": it.get("figure") or None,
    }


def main(inp, outp):
    a = json.load(open(inp, encoding="utf-8"))
    sys.path.insert(0, a["tsRoot"])
    import build_ts_daily as B
    items, 벌 = B.load_release(None)
    유형들 = sorted({i["type"] for i in items})
    유형, 까닭 = 유형고르기(a.get("title"), 유형들)
    빼기 = set(a.get("exclude") or [])
    lv = int(a.get("level") or 3)

    def 맞나(i, t, l):
        if i["id"] in 빼기 or i.get("level") != l:
            return False
        if t and i.get("type") != t:
            return False
        if a.get("figures") == "exclude" and i.get("figure"):
            return False
        opts = i.get("options") or []
        return sum(1 for o in opts if o.get("grade") == "정답") == 1 and 4 <= len(opts) <= 5

    pool = sorted([i for i in items if 맞나(i, 유형, lv)], key=lambda x: x["id"])
    need = len(a["slots"])
    out = {"ok": True, "picks": {}, "short": None, "release": 벌, "typeUsed": 유형, "typeWhy": 까닭, "level": lv}
    if len(pool) < need:
        alt = []
        for l in (lv - 1, lv + 1):
            if 1 <= l <= 5:
                alt.append({"type": 유형, "level": l, "have": sum(1 for i in items if 맞나(i, 유형, l))})
        if 유형:
            alt.append({"type": "(아무 유형)", "level": lv, "have": sum(1 for i in items if 맞나(i, None, lv))})
        out.update(ok=False, short={"need": need, "have": len(pool), "why": "%s L%d 창고 부족" % (유형 or "아무 유형", lv), "alternatives": alt})
    else:
        rng = random.Random(a.get("seed") or 0)
        rng.shuffle(pool)
        for s, it in zip(a["slots"], pool):
            out["picks"][s["id"]] = 가볍게(it)
    json.dump(out, open(outp, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
