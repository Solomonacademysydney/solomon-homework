# -*- coding: utf-8 -*-
r"""조판.py — 제작 일꾼의 문항 JSON → PDF (기존 툴체인 core/preamble.tex 모양 그대로)

    python prep_worker\조판.py 입력.json

입력: { coreDir, outDir, title, studentName, lessonDate, layout:{fontSize,answerCols,margin,workSpace,bilingual},
        order:[칸…], mr:{칸id: 문항}, ts:{칸id: 문항}, edge }
나오는 것(outDir): test.pdf · book.pdf · hw.pdf · student.pdf(앞 셋을 차례대로) · teacher.pdf(답지) · 조판보고.json

⛔ 지키는 선
  · 문항 글은 **글자로만** 받는다 — $…$ 밖의 LaTeX 특수 글자는 모두 막는다(조판 명령 끼워넣기 방지).
  · 학생용 PDF 에는 정답·해설을 넣지 않는다(교재 예제의 풀이는 가르치는 글이라 넣는다).
  · 문항마다 회색 꼬리표 [칸id] 를 찍는다 — 일꾼이 PDF 글자를 뽑아 **문항 수·빠짐·겹침**을 잰다.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

_TXT = [("\\", r"\textbackslash{}"), ("&", r"\&"), ("%", r"\%"), ("#", r"\#"), ("_", r"\_"), ("{", r"\{"), ("}", r"\}"),
        ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}")]
_MAP = dict(_TXT)                      # 한 글자씩 바꾼다(바꾼 글을 다시 바꾸지 않게)
_BAD_MATH = re.compile(r"\\(input|include|write|immediate|openout|openin|catcode|def|let|csname|read|newcommand|renewcommand|special|directlua)\b")


def 글(s):
    """$…$ 안은 수식 그대로(위험 명령은 거절), 밖은 특수 글자를 다 막는다."""
    s = str(s or "")
    parts = s.split("$")
    if len(parts) % 2 == 0:            # $ 짝이 안 맞으면 모두 글자로
        parts = [s.replace("$", "")]
    out = []
    for i, p in enumerate(parts):
        if i % 2 == 1:
            if _BAD_MATH.search(p):
                raise ValueError("위험한 수식 명령: %r" % p[:40])
            out.append("$" + p + "$")
        else:
            out.append("".join(_MAP.get(ch, ch) for ch in p))
    return "".join(out)


def 단계글(steps):
    """창고 풀이 단계는 마침표 없이 끝난다 — 이어 붙일 때 문장마다 마침표를 찍는다(실측 10-01)."""
    out = []
    for x in steps or []:
        x = str(x or "").strip()
        if x:
            out.append(글(x if x[-1] in ".!?" else x + "."))
    return " ".join(out)


def 꼬리(cid):
    return r"\hfill{\tiny\color{gray}[%s]}" % cid


def 보기표(choices):
    sys.path.insert(0, CORE)
    import common
    from vals import V
    vs = [V(글(c), 글(c), str(c)) for c in choices]
    return common.option_table(vs)


def svg_pdf(svg, path, edge):
    m = re.search(r'viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"', svg)
    w, h = (float(m.group(1)), float(m.group(2))) if m else (400.0, 200.0)
    html = path[:-4] + ".html"
    open(html, "w", encoding="utf-8").write(
        '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:%dpx %dpx;margin:0}html,body{margin:0}svg{display:block;width:%dpx;height:%dpx}</style></head><body>%s</body></html>'
        % (w, h, w, h, svg))
    ud = os.path.join(os.path.dirname(path), "_edge")
    subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--user-data-dir=" + ud,
                    "--print-to-pdf=" + path, "file:///" + html.replace("\\", "/")], capture_output=True, timeout=60)
    for _ in range(100):               # 엣지는 먼저 돌아오고 파일은 뒤에 생긴다
        if os.path.exists(path) and os.path.getsize(path) > 0:
            time.sleep(0.2)
            return w, h
        time.sleep(0.2)
    raise RuntimeError("그림 변환 실패: " + path)


def mr문항(n, cid, it, a, 학생용):
    out = [r"\needspace{4\baselineskip}", r"\textbf{%d.} %s%s\par" % (n, 글(it["stem"]), 꼬리(cid))]
    if it.get("calculator"):
        out.insert(1, r"{\small\color{navylt}\sffamily [Calculator allowed]}\par")
    if it["type"] == "mc":
        out.append(r"\vspace{\hwspace}" + 보기표(it["choices"]) + r"\vspace{\hwspace}")
    elif it["type"] == "written":
        out.append(r"\vspace{4pt}" + (r"\rule{\linewidth}{0.4pt}\par\vspace{14pt}" * 4))
    else:
        out.append(r"\arule\par\vspace{6pt}")
    if (a.get("layout") or {}).get("bilingual") and it.get("stem_ko"):
        out.insert(2, r"\ko{%s}" % 글(it["stem_ko"]))
    return "\n".join(out)


def mr예제(n, cid, it):
    return "\n".join([r"\ExHead{%d}%s%s\par" % (n, 글(it["stem"]), 꼬리(cid)), r"\SolHead",
                      글(it.get("working") or "") + r"\par", r"\Ans{%s}" % 글(it["answer"]), r"\ExSep"])


def ts문항(n, cid, t, a, figdir, 풀이):
    out = [r"\needspace{6\baselineskip}", r"\textbf{%d.} %s%s\par" % (n, 글(t["stem_en"]), 꼬리(cid))]
    if (a.get("layout") or {}).get("bilingual") and t.get("stem_ko"):
        out.append(r"\ko{%s}" % 글(t["stem_ko"]))
    if t.get("figurePdf"):
        sc = (a.get("figureScale") or 100) / 100.0
        out.append(r"\begin{center}\includegraphics[width=%.2f\linewidth,height=7cm,keepaspectratio]{%s}\end{center}"
                   % (min(1.0, 0.8 * sc), t["figurePdf"].replace("\\", "/")))
    out.append(보기표([o["en"] for o in t["options"]]))
    if 풀이:
        out.append(r"\SolHead " + 단계글(t.get("solution_en")) + r"\par\Ans{%s}\ExSep" % t["answerLetter"])
    else:
        out.append(r"\vspace{\hwspace}")
    return "\n".join(out)


def 답줄(n, cid, it, src):
    if src == "ts":
        why = 단계글(it.get("solution_en"))
        return r"\needspace{3\baselineskip}\textbf{%d.\ %s}\ {\tiny\color{gray}[%s]}\par{\small %s}\par\vspace{3pt}" % (n, it["answerLetter"], cid, why)
    let = ""
    if it["type"] == "mc":
        let = "ABCD"[int(it["answerIndex"])] + r"\ "     # 일꾼이 값으로 맞춰 둔 자리(글자 모양이 달라도)
    return r"\needspace{3\baselineskip}\textbf{%d.\ %s}%s\ {\tiny\color{gray}[%s]}\par{\small %s}\par\vspace{3pt}" % (
        n, let, 글(it["answer"]), cid, 글(it.get("working") or ""))


이름 = {"test": ("Check Test", "Last lesson's range"), "book": ("Workbook", "Concepts, examples and practice"), "hw": ("Homework", "Paper homework sets")}
부분 = {"front-test": "Check Test", "mr-unit-example": "Worked Examples", "mr-unit-practice": "Practice", "mr-review": "Review",
       "ts-unit": "Thinking Skills", "ts-combined": "Thinking Skills", "paper-hw": "Homework"}


def 구역글(sec, order, a, figdir, 학생용=True):
    body, n, 앞 = [], 0, None
    rows = [c for c in order if c["section"] == sec]
    if not rows:
        return None
    t, sub = 이름[sec]
    body.append(r"\SetRunHead{%s}\PartBanner{%s}{%s}" % (t, t, sub))
    for c in rows:
        key = (c["part"], c.get("set"))
        if key != 앞:
            제목 = 부분.get(c["part"], c["part"]) + ("" if c.get("set") is None else " --- Set %d" % (c["set"] + 1))
            body.append(r"\SecBar{%s}{}" % 제목)
            n, 앞 = 0, key
        n += 1
        if c["src"] == "mr":
            it = a["mr"][c["id"]]
            body.append(mr예제(n, c["id"], it) if c.get("worked") else mr문항(n, c["id"], it, a, 학생용))
        else:
            body.append(ts문항(n, c["id"], a["ts"][c["id"]], a, figdir, bool(c.get("worked"))))
    body.append(r"\clearpage")
    return "\n".join(body)


def 답지글(order, a):
    body = [r"\SetRunHead{Teacher Answer Key}\PartBanner{Teacher Answer Key}{Not for students --- %s}" % 글(a.get("studentName"))]
    for sec in ("test", "book", "hw"):
        rows = [c for c in order if c["section"] == sec]
        if not rows:
            continue
        body.append(r"\SecBar{%s}{}" % 이름[sec][0])
        cols = int((a.get("layout") or {}).get("answerCols") or 2)
        if cols == 2:
            body.append(r"\begin{multicols}{2}")
        n, 앞 = 0, None
        for c in rows:
            key = (c["part"], c.get("set"))
            if key != 앞:
                body.append(r"\SubHead{%s}" % (부분.get(c["part"], c["part"]) + ("" if c.get("set") is None else " --- Set %d" % (c["set"] + 1))))
                n, 앞 = 0, key
            n += 1
            it = a["mr"][c["id"]] if c["src"] == "mr" else a["ts"][c["id"]]
            body.append(답줄(n, c["id"], it, c["src"]))
        if cols == 2:
            body.append(r"\end{multicols}")
    return "\n".join(body)


def 문서(a, body, outdir, name):
    lay = a.get("layout") or {}
    fs = int(lay.get("fontSize") or 11)
    fs = 10 if fs <= 10 else (11 if fs == 11 else 12)
    ws = {"tight": "6pt", "normal": "12pt", "wide": "22pt"}.get(lay.get("workSpace"), "12pt")
    margin = int(lay.get("margin") or 20)
    ko = ""
    if lay.get("bilingual"):
        # 영한 병기만 fontspec 을 쓴다(korean_local 이 부른다)
        ko = r"\input{korean_local}"
    tex = ("\\documentclass[%dpt]{article}\n\\input{preamble}\n%s\n\\begin{document}\n"
           "\\newgeometry{margin=%dmm,top=22mm}\\setlength{\\hwspace}{%s}\n"
           "{\\Large\\sffamily\\bfseries\\color{navylt} %s}\\par{\\small %s --- %s}\\par\\vspace{6pt}\n%s\n\\end{document}\n"
           % (fs, ko, margin, ws, 글(a.get("title") or "Weekly Pack"), 글(a.get("studentName")), 글(a.get("lessonDate")), body))
    p = os.path.join(outdir, name + ".tex")
    open(p, "w", encoding="utf-8").write(tex)
    for _ in range(2):                 # 쪽 나눔이 자리 잡도록 두 번
        # --disable-installer: 없는 꾸러미를 「설치할까요」 창으로 묻지 않고 바로 실패한다(창 하나로 밤새 멈추지 않게)
        r = subprocess.run(["xelatex", "--disable-installer", "-interaction=nonstopmode", "-halt-on-error", name + ".tex"], cwd=outdir,
                           capture_output=True, timeout=300)
    log = open(os.path.join(outdir, name + ".log"), encoding="utf-8", errors="replace").read()
    errs = re.findall(r"^! .*$", log, re.M)
    over = [float(x) for x in re.findall(r"Overfull \\hbox \(([\d.]+)pt too wide\)", log)]
    pdf = os.path.join(outdir, name + ".pdf")
    if r.returncode != 0 or errs or not os.path.exists(pdf):
        raise RuntimeError("%s 조판 실패: %s" % (name, (errs or [log[-400:]])[0]))
    return {"file": name + ".pdf", "overfullMaxPt": max(over) if over else 0, "overfullCount": len(over)}


def main(inp):
    global CORE
    a = json.load(open(inp, encoding="utf-8"))
    CORE = a["coreDir"]
    out = a["outDir"]
    os.makedirs(out, exist_ok=True)
    shutil.copy(os.path.join(CORE, "preamble.tex"), os.path.join(out, "preamble.tex"))
    if (a.get("layout") or {}).get("bilingual"):
        k = open(os.path.join(CORE, "korean.tex"), encoding="utf-8").read()
        # Noto CJK 는 이 PC 에 없다(0단계 실측) → 윈도우 맑은 고딕. 굵기 옵션도 맑은 고딕에 맞게 뺀다
        k = re.sub(r"\\newfontfamily\\kofontface\{[^}]*\}\[[^\]]*\]", lambda m: r"\newfontfamily\kofontface{%s}" % (a.get("koFont") or "Malgun Gothic"), k)
        open(os.path.join(out, "korean_local.tex"), "w", encoding="utf-8").write(k)
    figdir = os.path.join(out, "fig")
    os.makedirs(figdir, exist_ok=True)
    for cid, t in (a.get("ts") or {}).items():
        if t.get("figureSvg"):
            p = os.path.join(figdir, cid + ".pdf")
            if not os.path.exists(p):
                svg_pdf(t["figureSvg"], p, a["edge"])
            t["figurePdf"] = "fig/" + cid + ".pdf"
    order = a["order"]
    보고 = {"files": []}
    secs = {}
    for sec in ("test", "book", "hw"):
        b = 구역글(sec, order, a, figdir)
        if b:
            secs[sec] = b
            보고["files"].append(dict(문서(a, b, out, sec), kind=sec))
    보고["files"].append(dict(문서(a, "\n".join(secs[s] for s in ("test", "book", "hw") if s in secs), out, "student"), kind="student"))
    보고["files"].append(dict(문서(a, 답지글(order, a), out, "teacher"), kind="teacher"))
    json.dump(보고, open(os.path.join(out, "조판보고.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("조판 끝:", ", ".join(f["file"] for f in 보고["files"]))


def 검사(pdf):
    """쪽마다 {text, ink} — 글자는 pdftotext, 잉크(흰색 아닌 점의 비율)는 낮은 해상도 회색 그림으로."""
    from PIL import Image
    import tempfile
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True).stdout.decode("utf-8", "replace").split("\f")
    d = tempfile.mkdtemp()
    subprocess.run(["pdftoppm", "-gray", "-r", "20", "-png", pdf, os.path.join(d, "p")], capture_output=True)
    pages = []
    for i, f in enumerate(sorted(os.listdir(d))):
        im = Image.open(os.path.join(d, f)).convert("L")
        px = im.getdata()
        ink = sum(1 for v in px if v < 200) / float(len(px))
        pages.append({"text": txt[i] if i < len(txt) else "", "ink": round(ink, 5)})
        im.close()
    shutil.rmtree(d, ignore_errors=True)
    print(json.dumps(pages, ensure_ascii=False))


CORE = None
if __name__ == "__main__":
    if sys.argv[1] == "--검사":
        검사(sys.argv[2])
    else:
        main(sys.argv[1])
