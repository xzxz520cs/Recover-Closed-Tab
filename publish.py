#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recover-Closed-Tab 发布脚本（上传 + 发布到 Chrome Web Store 与 Edge Add-ons）

前置:
    - 已运行 `python build.py --zip` 生成 dist/*.zip
    - 已配置 publish_config.json（见 PUBLISH.md，本机私密文档，不入库），含:
        chrome.client_id / chrome.client_secret / chrome.item_id
        edge.client_id / edge.api_key / edge.product_id
    - 首次使用 Chrome 时需浏览器完成一次 OAuth 授权（脚本会输出 URL）

用法:
    python publish.py                # 上传+发布 两个商店
    python publish.py --store chrome # 只处理 Chrome
    python publish.py --store edge   # 只处理 Edge
    python publish.py --no-publish   # 只上传进草稿，不发布
    python publish.py --dry-run      # 只打印将要执行的操作，不真正调用 API

依赖: 仅标准库（urllib / json / webbrowser / http.server），零第三方包。
"""

import argparse
import glob
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT, "publish_config.json")
DIST_DIR = os.path.join(ROOT, "dist")

CHROME_TOKEN_FILE = os.path.join(ROOT, ".chrome_token.json")
CHROME_SCOPE = "https://www.googleapis.com/auth/chromewebstore"
CHROME_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
CHROME_TOKEN_URL = "https://oauth2.googleapis.com/token"

EDGE_API = "https://api.addons.microsoftedge.microsoft.com"

POLL_INTERVAL = 5   # 轮询间隔（秒）
MAX_POLL = 120      # 最大轮询次数（约 10 分钟）


def fail(msg):
    print(f"[错误] {msg}", file=sys.stderr)
    sys.exit(1)


def http_json(url, method="GET", headers=None, body=None, raw_body=None):
    """发起 HTTP 请求，返回 (status, headers, body_bytes)。"""
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    data = raw_body if raw_body is not None else (
        json.dumps(body).encode("utf-8") if body is not None else None)
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def http_json_retry(url, method="GET", headers=None, body=None, raw_body=None, retries=3):
    last = None
    for i in range(retries):
        st, hd, bd = http_json(url, method, headers, body, raw_body)
        if st < 500:
            return st, hd, bd
        last = (st, hd, bd)
        print(f"  服务端错误 {st}，{2 ** i} 秒后重试...")
        time.sleep(2 ** i)
    return last


def load_config():
    if not os.path.exists(CONFIG_PATH):
        fail(f"未找到 {CONFIG_PATH}。请按 PUBLISH.md 配置 Chrome/Edge 凭据。")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as e:
            fail(f"无法解析 {CONFIG_PATH}: {e}")


def find_zip(store):
    """在 dist/ 找对应商店的 zip（优先版本号最新）。"""
    pat = os.path.join(DIST_DIR, f"recover-closed-tab-{store}-*.zip")
    files = sorted(glob.glob(pat))
    if not files:
        fail(f"未找到 {pat}。请先运行 `python build.py --zip`。")
    return files[-1]


# ---------------------------------------------------------------- Chrome
class _OAuthCallback(BaseHTTPRequestHandler):
    """接收 OAuth 回跳的本地临时服务器。"""
    code = None

    def do_GET(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if "code" in qs:
            _OAuthCallback.code = qs["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("授权成功，可以关闭此页面。".encode("utf-8"))
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"no code")

    def log_message(self, *a):
        pass


def chrome_get_token(cfg):
    """获取 Chrome API access token（缓存 + 首次 OAuth 授权流程）。"""
    # 1) 已有缓存
    if os.path.exists(CHROME_TOKEN_FILE):
        with open(CHROME_TOKEN_FILE, encoding="utf-8") as f:
            tok = json.load(f)
        if tok.get("expires_at", 0) > time.time() + 60:
            return tok["access_token"]

        # 2) 用 refresh_token 刷新
        if tok.get("refresh_token"):
            print("  刷新 access token...")
            body = urllib.parse.urlencode({
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "refresh_token": tok["refresh_token"],
                "grant_type": "refresh_token",
            }).encode()
            st, _, bd = http_json(CHROME_TOKEN_URL, "POST", {
                "Content-Type": "application/x-www-form-urlencoded"}, raw_body=body)
            if st == 200:
                data = json.loads(bd)
                _save_chrome_token(cfg, data, tok.get("refresh_token"))
                return data["access_token"]

    # 3) 首次：OAuth 授权码流程（浏览器 + 本地回跳）
    print("  需要浏览器授权（首次使用）...")
    redirect = "http://localhost:8765/"
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": CHROME_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = CHROME_AUTH + "?" + urllib.parse.urlencode(params)
    print(f"  请在浏览器中打开并授权:\n  {auth_url}")
    webbrowser.open(auth_url)

    _OAuthCallback.code = None
    srv = HTTPServer(("localhost", 8765), _OAuthCallback)
    srv.timeout = 300
    while _OAuthCallback.code is None:
        srv.handle_request()
    srv.server_close()
    code = _OAuthCallback.code

    body = urllib.parse.urlencode({
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "code": code,
        "redirect_uri": redirect,
        "grant_type": "authorization_code",
    }).encode()
    st, _, bd = http_json(CHROME_TOKEN_URL, "POST", {
        "Content-Type": "application/x-www-form-urlencoded"}, raw_body=body)
    if st != 200:
        fail(f"获取 Chrome token 失败: {st} {bd.decode('utf-8', 'replace')}")
    data = json.loads(bd)
    _save_chrome_token(cfg, data)
    return data["access_token"]


def _save_chrome_token(cfg, data, refresh=None):
    with open(CHROME_TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "access_token": data.get("access_token"),
            "refresh_token": refresh or data.get("refresh_token"),
            "expires_at": time.time() + int(data.get("expires_in", 3600)) - 60,
        }, f, ensure_ascii=False, indent=2)


def chrome_upload(token, item_id, zip_path):
    url = f"https://www.googleapis.com/upload/chromewebstore/v1.1/items/{item_id}?uploadType=media"
    with open(zip_path, "rb") as f:
        payload = f.read()
    st, _, bd = http_json_retry(url, "PUT", {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/zip",
        "x-goog-api-version": "2",
    }, raw_body=payload)
    if st != 200:
        fail(f"Chrome 上传失败: {st} {bd.decode('utf-8', 'replace')}")
    data = json.loads(bd)
    print(f"  Chrome 上传成功, uploadState={data.get('uploadState')}")
    if data.get("itemError"):
        print(f"  警告: {data['itemError']}")
    return data


def chrome_publish(token, item_id, target="default"):
    url = f"https://www.googleapis.com/chromewebstore/v1.1/items/{item_id}/publish?publishTarget={target}"
    st, _, bd = http_json_retry(url, "POST", {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }, body={})
    if st != 200:
        fail(f"Chrome 发布失败: {st} {bd.decode('utf-8', 'replace')}")
    data = json.loads(bd)
    print(f"  Chrome 发布结果: {data.get('status')} {data.get('statusDetail')}")
    return data


# ---------------------------------------------------------------- Edge
def edge_upload(client_id, api_key, product_id, zip_path):
    url = f"{EDGE_API}/v1/products/{product_id}/submissions/draft/package"
    with open(zip_path, "rb") as f:
        payload = f.read()
    st, hd, bd = http_json_retry(url, "POST", {
        "Authorization": f"ApiKey {api_key}",
        "X-ClientID": client_id,
        "Content-Type": "application/zip",
    }, raw_body=payload)
    if st == 202:
        op = hd.get("Location", "")
        print(f"  Edge 上传成功, operation: {op}")
        return op
    fail(f"Edge 上传失败: {st} {bd.decode('utf-8', 'replace')}")


def edge_wait(client_id, api_key, op_url, what="上传"):
    """轮询 operation 直到成功/失败。"""
    for i in range(MAX_POLL):
        st, _, bd = http_json_retry(op_url, "GET", {
            "Authorization": f"ApiKey {api_key}",
            "X-ClientID": client_id,
        })
        if st == 200:
            data = json.loads(bd)
            status = data.get("status")
            msg = data.get("message", "")
            print(f"  Edge {what}状态: {status} {msg}")
            if status in ("Succeeded", "Completed", "Published"):
                return data
            if status in ("Failed", "Error"):
                fail(f"Edge {what}失败: {msg}")
        else:
            print(f"  Edge {what}状态: HTTP {st}")
        time.sleep(POLL_INTERVAL)
    fail(f"Edge {what}轮询超时（{MAX_POLL * POLL_INTERVAL} 秒）")


def edge_publish(client_id, api_key, product_id, notes=""):
    url = f"{EDGE_API}/v1/products/{product_id}/submissions"
    body = json.dumps({"notes": notes}).encode("utf-8")
    st, hd, bd = http_json_retry(url, "POST", {
        "Authorization": f"ApiKey {api_key}",
        "X-ClientID": client_id,
        "Content-Type": "application/json",
    }, raw_body=body)
    if st == 202:
        op = hd.get("Location", "")
        print(f"  Edge 发布已提交, operation: {op}")
        return op
    fail(f"Edge 发布失败: {st} {bd.decode('utf-8', 'replace')}")


# ---------------------------------------------------------------- main
def main():
    parser = argparse.ArgumentParser(description="Recover-Closed-Tab 发布脚本")
    parser.add_argument("--store", choices=["chrome", "edge"], help="只处理指定商店")
    parser.add_argument("--no-publish", action="store_true", help="只上传不发布")
    parser.add_argument("--dry-run", action="store_true", help="只打印将执行的操作")
    args = parser.parse_args()

    cfg = load_config()

    if args.dry_run:
        print("=== 试运行模式（不真正调用 API）===")
        if args.store in (None, "chrome"):
            print("  [Chrome] 将上传:", find_zip("chrome"))
            if not args.no_publish:
                print("  [Chrome] 将发布 (target=default)")
        if args.store in (None, "edge"):
            print("  [Edge] 将上传:", find_zip("edge"))
            if not args.no_publish:
                print("  [Edge] 将发布")
        return

    # --- Chrome ---
    if args.store in (None, "chrome"):
        print("== Chrome Web Store ==")
        zip_path = find_zip("chrome")
        print(f"  上传 {zip_path}")
        token = chrome_get_token(cfg["chrome"])
        chrome_upload(token, cfg["chrome"]["item_id"], zip_path)
        if not args.no_publish:
            chrome_publish(token, cfg["chrome"]["item_id"])
        else:
            print("  （--no-publish，跳过发布）")

    # --- Edge ---
    if args.store in (None, "edge"):
        print("== Microsoft Edge Add-ons ==")
        zip_path = find_zip("edge")
        print(f"  上传 {zip_path}")
        edge_cfg = cfg["edge"]
        op = edge_upload(edge_cfg["client_id"], edge_cfg["api_key"], edge_cfg["product_id"], zip_path)
        edge_wait(edge_cfg["client_id"], edge_cfg["api_key"], op, what="上传")
        if not args.no_publish:
            pop = edge_publish(edge_cfg["client_id"], edge_cfg["api_key"], edge_cfg["product_id"])
            edge_wait(edge_cfg["client_id"], edge_cfg["api_key"], pop, what="发布")
        else:
            print("  （--no-publish，跳过发布）")

    print("发布流程完成。")


if __name__ == "__main__":
    main()
