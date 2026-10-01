"""Shared helpers for the evaluation scripts.

Every script calls the REAL pipeline over HTTP (POST /api/ai on a running
`npm run dev` / deployed instance) — nothing is mocked. Set EVAL_BASE_URL to
point at another instance (default http://localhost:8080).
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Windows consoles default to cp1252; results contain "→" and Devanagari.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
EVAL = ROOT / "eval"
OUT = EVAL / "out"
OUT.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("EVAL_BASE_URL", "http://localhost:8080").rstrip("/")


def env_value(name: str) -> str:
    """Read a key from the process env or the git-ignored .env (never printed)."""
    if os.environ.get(name):
        return os.environ[name]
    path = ROOT / ".env"
    if path.exists():
        for key, value in re.findall(r"^([A-Z0-9_]+)=(.*)$", path.read_text(encoding="utf-8"), re.M):
            if key == name:
                return value.strip().strip('"').strip("'")
    return ""


def server_up() -> bool:
    try:
        with urllib.request.urlopen(f"{BASE_URL}/api/parcels?bbox=74,20.2,74.1,20.3", timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def ask(message: str, retries: int = 2, timeout: int = 90) -> dict:
    """POST one question to the real copilot endpoint. Returns the parsed body plus http status."""
    body = json.dumps({"message": message, "history": [], "context": None}).encode("utf-8")
    last: dict = {}
    for attempt in range(retries + 1):
        req = urllib.request.Request(f"{BASE_URL}/api/ai", data=body, headers={"content-type": "application/json"})
        started = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode("utf-8"))
                data["_http"] = r.status
                data["_ms"] = round((time.time() - started) * 1000)
                return data
        except urllib.error.HTTPError as e:
            try:
                last = json.loads(e.read().decode("utf-8"))
            except Exception:
                last = {}
            last.update({"ok": False, "_http": e.code, "_ms": round((time.time() - started) * 1000)})
            if e.code not in (429, 500, 502, 503, 504):
                return last
        except Exception as e:  # timeout / connection reset
            last = {"ok": False, "_http": 0, "error": repr(e)[:200], "_ms": round((time.time() - started) * 1000)}
        time.sleep(2 + attempt * 3)
    return last


def write_json(name: str, payload: dict) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def not_measurable(item: str, missing: list[str], searched: list[str]) -> dict:
    return {"item": item, "measured": False, "missing": missing, "searched": searched}


FALLBACK_SENTENCE = "Here is what could be assembled for that query without a full model answer."


def llm_failed(r: dict) -> bool:
    """True when the pipeline answered without the language model (upstream error / no credits).

    Such a response is an infrastructure failure, not a model result: it must not be
    counted as an invalid plan, a wrong intent, or a blocked attack.
    """
    if r.get("_http") != 200 or not r.get("ok"):
        return True
    if r.get("degraded") is True or (r.get("planner") or {}).get("status") == "upstream_error":
        return True
    # responses recorded before the API exposed `degraded`
    return ((r.get("reply") or {}).get("summary") or "").strip() == FALLBACK_SENTENCE


def preflight() -> tuple[bool, str]:
    """One real question; tells us whether the LLM behind the pipeline is reachable."""
    if not server_up():
        return False, f"No app answering at {BASE_URL}. Start it with `npm run dev`."
    r = ask("What is the climate risk in Pune?", retries=0)
    if llm_failed(r):
        return False, (
            "The app answered but its language model did not (planner/explainer fell back). "
            "Check the server log for the upstream error - e.g. OpenRouter 402 means the key has no credits."
        )
    return True, "ok"


def run_tsx(script: str, timeout: int = 300) -> dict | list:
    """Run an eval/*.ts helper with the repo's own tsx and return its JSON output."""
    import subprocess

    p = subprocess.run(f"npx tsx eval/{script}", cwd=ROOT, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError(f"{script} failed: {(p.stderr or p.stdout)[-400:]}")
    return json.loads(p.stdout.strip().splitlines()[-1])
