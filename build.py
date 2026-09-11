#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recover-Closed-Tab 构建脚本（单源 → 双商店产物）

- 源码唯一编辑源:   src/
- 生成产物:
    Chrome/  → manifest 注入 "update_url"（Chrome Web Store 需要）
    Edge/    → manifest 不注入 "update_url"
- 默认: 生成产物目录，并在 dist/ 打包两个商店的发布 zip（--no-zip 可关闭）
- 可选: 版本号注入（--version 1.2.3）

用法:
    python build.py                 # 生成 Chrome/ 与 Edge/，并在 dist/ 打包发布 zip
    python build.py --version 3.66  # 注入版本号（zip 文件名同步）
    python build.py --no-zip        # 只生成产物目录，不打包
    python build.py --clean         # 生成前清空产物目录（默认不清，只覆盖同名文件）
"""

import argparse
import json
import os
import shutil
import sys
import zipfile

# 兼容 Windows GBK 控制台：避免非 ASCII 输出触发 UnicodeEncodeError
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
CHROME_DIR = os.path.join(ROOT, "Chrome")
EDGE_DIR = os.path.join(ROOT, "Edge")
DIST_DIR = os.path.join(ROOT, "dist")

CHROME_UPDATE_URL = "https://clients2.google.com/service/update2/crx"

# 需要同步到两个商店产物的文件（相对 src/ 的路径）
INCLUDE_EXTENSIONS = (".json", ".html", ".js", ".css", ".png")
# manifest 中不随商店变化的字段之外的例外：manifest.json 需单独处理
MANIFEST = "manifest.json"


def fail(msg):
    print(f"[错误] {msg}", file=sys.stderr)
    sys.exit(1)


def read_manifest():
    path = os.path.join(SRC, MANIFEST)
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as e:
            fail(f"无法解析 {path}: {e}")


def write_manifest(target_dir, manifest, include_update_url):
    """写入 manifest：可选注入 update_url（仅 Chrome）。"""
    manifest = dict(manifest)  # 浅拷贝，不污染内存中的源
    if include_update_url:
        manifest["update_url"] = CHROME_UPDATE_URL
    else:
        manifest.pop("update_url", None)

    # 保持键顺序稳定（update_url 放最前，与旧版一致）
    ordered = {}
    if include_update_url:
        ordered["update_url"] = manifest["update_url"]
    for k, v in manifest.items():
        if k != "update_url":
            ordered[k] = v

    path = os.path.join(target_dir, MANIFEST)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=4)
        f.write("\n")
    return path


def copy_tree(src, dst, clean=False):
    """复制 src 下所有文件到 dst，跳过 manifest.json（单独处理）。"""
    if clean and os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(dst, exist_ok=True)

    for root, dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        target_dir = dst if rel == "." else os.path.join(dst, rel)
        os.makedirs(target_dir, exist_ok=True)
        for name in files:
            if name == MANIFEST:
                continue
            src_file = os.path.join(root, name)
            dst_file = os.path.join(target_dir, name)
            shutil.copy2(src_file, dst_file)
            print(f"  {os.path.relpath(dst_file, ROOT)}")


def build(version=None, clean=False, make_zip=True):
    if not os.path.isdir(SRC):
        fail(f"未找到源码目录 {SRC}，请确认 src/ 存在。")

    manifest = read_manifest()
    if version:
        manifest["version"] = version
        print(f"版本号: {manifest.get('version')}")

    # ---- 生成 Chrome/ ----
    print("生成 Chrome/ ...")
    copy_tree(SRC, CHROME_DIR, clean=clean)
    m = write_manifest(CHROME_DIR, manifest, include_update_url=True)
    print(f"  {os.path.relpath(m, ROOT)} (update_url 已注入)")

    # ---- 生成 Edge/ ----
    print("生成 Edge/ ...")
    copy_tree(SRC, EDGE_DIR, clean=clean)
    m = write_manifest(EDGE_DIR, manifest, include_update_url=False)
    print(f"  {os.path.relpath(m, ROOT)} (无 update_url)")

    # ---- 发布 zip ----
    if make_zip:
        os.makedirs(DIST_DIR, exist_ok=True)
        for target, fname in ((CHROME_DIR, "chrome"), (EDGE_DIR, "edge")):
            zip_path = os.path.join(
                DIST_DIR, f"recover-closed-tab-{fname}-{manifest.get('version', 'dev')}.zip")
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(target):
                    rel = os.path.relpath(root, target)
                    for name in files:
                        full = os.path.join(root, name)
                        arc = name if rel == "." else os.path.join(rel, name)
                        zf.write(full, arc)
            print(f"打包: {os.path.relpath(zip_path, ROOT)}")

    print("构建完成 \u2713")


def main():
    parser = argparse.ArgumentParser(description="Recover-Closed-Tab 构建脚本")
    parser.add_argument("--version", help="注入版本号（如 3.66）")
    parser.add_argument("--clean", action="store_true", help="生成前清空产物目录")
    parser.add_argument("--zip", action="store_true", help="（已默认开启，保留兼容）")
    parser.add_argument("--no-zip", action="store_true", help="不生成发布用 zip")
    args = parser.parse_args()
    build(version=args.version, clean=args.clean, make_zip=not args.no_zip)


if __name__ == "__main__":
    main()
