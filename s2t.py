#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简 → 繁 直译转换（字对字，不做任何地区性用语替换）

字表来源：OpenCC STCharacters.txt（Apache-2.0），本地副本 s2t_data.txt
    https://github.com/BYVoid/OpenCC/blob/master/data/dictionary/STCharacters.txt

规则（三层，从简到繁）：
    1. PHRASES 词组修正：字对字无法区分的常见词（日志→日誌、轻松→輕鬆、复制→複製……）
    2. 逐字转换，取 OpenCC 给出的**第一个**候选字（即“直译”）
    3. OVERRIDES 异体字归一：首候选是异体字 / 港式用字时换成通用繁体
       （爲→為、裏→裡、啓→啟、着→著、鍾→鐘）

不做地区用语替换：扩展 不会变 擴充、设置 不会变 設定、默认 不会变 預設

用法：
    python s2t.py                                # 默认：src/_locales/zh_CN/messages.json → zh_TW/messages.json
    python s2t.py --check                        # 只校验 zh_TW 是否等于直译结果（不一致退出码 1）
    python s2t.py --text "恢复历史记录"            # 转换一段文字并打印
    python s2t.py --file in.txt --out out.txt    # 转换文本文件
    type in.txt | python s2t.py --stdin          # 从标准输入读取并打印

依赖：仅标准库。
"""

import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "s2t_data.txt")
SRC_JSON = os.path.join(ROOT, "src", "_locales", "zh_CN", "messages.json")
DST_JSON = os.path.join(ROOT, "src", "_locales", "zh_TW", "messages.json")

# 异体字 / 港式用字归一：只在“首候选不合适”时覆盖，尽量少动
OVERRIDES = {
    "为": "為",   # OpenCC 首候选是异体字 爲
    "里": "裡",   # OpenCC 首候选是港式用字 裏
    "钟": "鐘",   # OpenCC 首候选是 鍾（钟爱/钟情义），分钟/秒钟应为 鐘
    "启": "啟",   # OpenCC 首候选是异体字 啓
    "着": "著",   # 字表未收录，通用繁体用 著
}

# 词组修正：字对字无法区分的常见词（在逐字转换之前先替换）
PHRASES = {
    "日志": "日誌",
    "轻松": "輕鬆",
    "放松": "放鬆",
    "干净": "乾淨",
    "干活": "幹活",
    "复制": "複製",
    "重复": "重複",
    "复杂": "複雜",
    "复数": "複數",
    "复选": "複選",
    "反复": "反覆",
    "制作": "製作",
    "制品": "製品",
    "一只": "一隻",
    "手表": "手錶",
}
PHRASE_RE = re.compile("|".join(
    re.escape(k) for k in sorted(PHRASES, key=len, reverse=True)))

_table = None


def load_table():
    """读取字表（OpenCC STCharacters），每个字取第一个候选。"""
    global _table
    if _table is None:
        table = {}
        with io.open(DATA_FILE, encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) < 2:
                    continue
                src, dst = parts[0], parts[1]
                if len(src) == 1 and len(dst) == 1:
                    table[src] = dst
        table.update(OVERRIDES)
        _table = table
    return _table


def to_traditional(text):
    """把一段文字转成繁体（ASCII / emoji / $占位符$ 原样保留）。"""
    table = load_table()
    text = PHRASE_RE.sub(lambda m: PHRASES[m.group(0)], text)
    return "".join(table.get(ch, ch) for ch in text)


# ------------------------------------------------------------------ JSON 模式
def read_text(path):
    """读文本，返回 (换行为 \\n 的正文, 原文件的换行风格)。"""
    with io.open(path, "rb") as f:
        raw = f.read()
    newline = "\r\n" if b"\r\n" in raw else "\n"
    text = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    return text, newline


def convert_node(node):
    """递归转换 JSON 的字符串值；键名不动，placeholders 的 $1/$2 是 ASCII 不受影响。"""
    if isinstance(node, str):
        return to_traditional(node)
    if isinstance(node, list):
        return [convert_node(x) for x in node]
    if isinstance(node, dict):
        return {k: convert_node(v) for k, v in node.items()}
    return node


def dumps(data, newline):
    text = json.dumps(data, ensure_ascii=False, indent=4)
    if newline != "\n":
        text = text.replace("\n", newline)
    return text + newline


def run_json(args):
    src_text, _ = read_text(args.src)
    src = json.loads(src_text)
    expected = dumps(convert_node(src), "\n")

    if not os.path.exists(args.dst):
        if args.check:
            print(f"[不一致] 目标文件不存在: {args.dst}")
            return 1
    else:
        dst_text, _ = read_text(args.dst)
        dst = json.loads(dst_text)
        actual = dumps(convert_node(src), "\n")
        raw_actual = dst_text.replace("\r\n", "\n")

        # 键集合对比（zh_CN 是唯一事实来源）
        missing = [k for k in src if k not in dst]
        extra = [k for k in dst if k not in src]
        if missing or extra:
            print(f"[警告] 键不一致: zh_TW 缺少 {len(missing)} 个、多出 {len(extra)} 个"
                  f"（以 zh_CN 为准重建）")
            for k in missing[:10]:
                print(f"        缺少: {k}")
            for k in extra[:10]:
                print(f"        多出: {k}")

        diff_keys = [k for k in src
                     if k in dst and json.dumps(dst[k], ensure_ascii=False, sort_keys=True)
                     != json.dumps(convert_node(src[k]), ensure_ascii=False, sort_keys=True)]
        same = (raw_actual == expected and not missing and not extra)

        if args.check:
            if same:
                print(f"[一致] {os.path.relpath(args.dst, ROOT)} 与直译结果完全相同"
                      f"（{len(src)} 个词条）")
                return 0
            print(f"[不一致] {len(diff_keys)} 个词条与直译结果不同：")
            for k in diff_keys[:15]:
                old = dst[k]["message"] if isinstance(dst.get(k), dict) and "message" in dst[k] else dst.get(k)
                new = convert_node(src[k])
                new = new["message"] if isinstance(new, dict) and "message" in new else new
                print(f"  {k}\n    现: {old}\n    应: {new}")
            if len(diff_keys) > 15:
                print(f"  ...（其余 {len(diff_keys) - 15} 条略）")
            return 1

        if same:
            print(f"[跳过] {os.path.relpath(args.dst, ROOT)} 已是最新（{len(src)} 个词条）")
            return 0

    with io.open(args.dst, "w", encoding="utf-8", newline="") as f:
        f.write(expected)
    print(f"[完成] {os.path.relpath(args.src, ROOT)} → {os.path.relpath(args.dst, ROOT)}"
          f"（{len(src)} 个词条）")
    return 0


# ------------------------------------------------------------------ main
def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="简 → 繁 直译转换（字对字，无地区用语替换）")
    parser.add_argument("--text", help="直接转换给定文字并打印")
    parser.add_argument("--file", help="转换指定文本文件")
    parser.add_argument("--out", help="配合 --file 写出到指定文件（缺省则打印）")
    parser.add_argument("--stdin", action="store_true", help="从标准输入读取并打印转换结果")
    parser.add_argument("--check", action="store_true", help="只校验 JSON 是否等于直译结果，不写文件")
    parser.add_argument("--src", default=SRC_JSON, help="源 JSON（默认 zh_CN/messages.json）")
    parser.add_argument("--dst", default=DST_JSON, help="目标 JSON（默认 zh_TW/messages.json）")
    args = parser.parse_args()

    if args.text is not None:
        print(to_traditional(args.text))
        return 0

    if args.stdin:
        sys.stdout.write(to_traditional(sys.stdin.read()))
        return 0

    if args.file:
        text, newline = read_text(args.file)
        out = to_traditional(text)
        if args.out:
            with io.open(args.out, "w", encoding="utf-8", newline="") as f:
                f.write(out if newline == "\n" else out.replace("\n", newline))
            print(f"[完成] {args.file} → {args.out}")
        else:
            sys.stdout.write(out)
        return 0

    return run_json(args)


if __name__ == "__main__":
    sys.exit(main())
