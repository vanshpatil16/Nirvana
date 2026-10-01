#!/usr/bin/env python3
"""Item 5 — engineering.

Reports only what is observed:
  * test files and test runners present in the repo, and their pass / fail counts
  * the repo's own verification harnesses (npm run verify:sim / verify:geometry)
  * typecheck and production build
  * whether a top-level docker-compose file exists
  * whether CI exists (.github/workflows)

Usage:  python eval/eng_eval.py [--skip-build]
        LANDSTACK_API_DIR=<path to the separate landstack-api checkout> also runs its pytest suite
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time

from _common import ROOT, write_json

SKIP = ("node_modules", ".git", ".output", ".vercel", ".wrangler", ".tanstack", "public/cesium")


def run(cmd: str, timeout: int, cwd=ROOT) -> dict:
    started = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
        out = (p.stdout or "") + (p.stderr or "")
        return {"cmd": cmd, "exit": p.returncode, "passed": p.returncode == 0, "seconds": round(time.time() - started, 1), "tail": out.strip().splitlines()[-6:]}
    except subprocess.TimeoutExpired:
        return {"cmd": cmd, "exit": None, "passed": False, "timed_out": True, "seconds": timeout, "tail": []}


def repo_files(*patterns: str) -> list[str]:
    found = []
    for pat in patterns:
        for p in ROOT.rglob(pat):
            rel = p.relative_to(ROOT).as_posix()
            if not any(rel.startswith(s) for s in SKIP):
                found.append(rel)
    return sorted(set(found))


def main() -> dict:
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    runners = sorted(d for d in deps if re.search(r"^(vitest|jest|mocha|ava|@playwright/test|cypress|@testing-library/.*)$", d))
    test_files = repo_files("*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx", "*.test.js", "*.spec.js", "test_*.py", "*_test.py")

    typecheck = run("npm run -s typecheck", 600)
    sim = run("npm run -s verify:sim", 600)
    m = re.search(r"ALL (\d+) CHECKS PASSED", "\n".join(sim["tail"]))
    sim["checks_passed"] = int(m.group(1)) if m else None
    geom = run("npm run -s verify:geometry", 600)
    build = {"skipped": True} if "--skip-build" in sys.argv else run("npm run -s build", 900)

    compose = [f for f in ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml") if (ROOT / f).exists()]
    dockerfiles = [f for f in repo_files("Dockerfile", "Dockerfile.*") if "/" not in f]
    workflows = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / ".github" / "workflows").glob("*.y*ml")) if (ROOT / ".github" / "workflows").exists() else []

    backend = None
    api_dir = os.environ.get("LANDSTACK_API_DIR")
    if api_dir and os.path.isdir(api_dir):
        # prefer that repo's own virtualenv, so its dependencies are the ones it pins
        venv = [os.path.join(api_dir, ".venv", "Scripts", "python.exe"), os.path.join(api_dir, ".venv", "bin", "python")]
        py = next((v for v in venv if os.path.exists(v)), shutil.which("python") or "python")
        r = run(f'"{py}" -m pytest -q', 900, cwd=api_dir)
        mm = re.search(r"(\d+) passed", "\n".join(r["tail"]))
        ff = re.search(r"(\d+) failed", "\n".join(r["tail"]))
        backend = {"repo": "landstack-api (SEPARATE repository — not this repo)", "path": api_dir, "passed": int(mm.group(1)) if mm else None, "failed": int(ff.group(1)) if ff else 0, "exit": r["exit"], "tail": r["tail"]}

    out = {
        "item": "engineering",
        "measured": True,
        "unit_tests": {
            "test_runners_in_package_json": runners,
            "test_files": test_files,
            "passed": 0,
            "failed": 0,
            "note": "This repo has no unit/integration test suite (no test runner dependency, no test files, no pytest)." if not (runners or test_files) else "",
        },
        "verification_harnesses": {"verify_sim": sim, "verify_geometry": geom},
        "typecheck": typecheck,
        "build": build,
        "docker": {
            "compose_files_at_top_level": compose,
            "dockerfiles_at_top_level": dockerfiles,
            "docker_compose_up": "not runnable — no compose file exists" if not compose else "compose file present — run `docker compose up` to verify",
        },
        "ci": {"workflows": workflows, "exists": bool(workflows)},
        "separate_backend_repo": backend,
    }
    write_json("eng.json", out)
    return out


if __name__ == "__main__":
    print(json.dumps(main(), ensure_ascii=False, indent=2))
