#!/usr/bin/env python3
"""Shoot the four dossier screenshots for Night Shift.

Serves game/ with the bundled serve.ts, loads each ?shot= scene from
shots.json at 1280x720 in headless Chromium, waits for window.__shotReady,
and saves a JPEG into screenshots/. Fails loudly on any console error or
page error, and on any screenshot over the 256 KiB scorer cap.

Run from the entry root:
    /home/hatch/workspace/wl-agent/venv/bin/python tools/shoot.py
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
PORT = 8091
MAX_BYTES = 262144


def main() -> int:
    shots = json.loads((HERE / "shots.json").read_text())
    server = subprocess.Popen(
        ["node", "serve.ts", "--port", str(PORT)],
        cwd=HERE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        # Wait for the server to answer.
        for _ in range(100):
            try:
                urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=1)
                break
            except OSError:
                time.sleep(0.1)
        else:
            print("server did not come up", file=sys.stderr)
            return 1

        from playwright.sync_api import sync_playwright

        errors = []
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": 1280, "height": 720})
                page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
                for shot in shots:
                    url = f"http://localhost:{PORT}/{shot['query']}"
                    page.goto(url, wait_until="load")
                    page.wait_for_function("window.__shotReady === true", timeout=30000)
                    page.wait_for_timeout(300)  # let the frame settle
                    out = HERE / "screenshots" / shot["name"]
                    page.screenshot(path=str(out), type="jpeg", quality=80)
                    size = out.stat().st_size
                    print(f"{shot['name']}: {size} bytes")
                    if size > MAX_BYTES:
                        errors.append(f"{shot['name']} is {size} bytes, over the {MAX_BYTES} cap")
            finally:
                browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)

    if errors:
        print("FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 1
    print("0 console errors, all screenshots within cap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
