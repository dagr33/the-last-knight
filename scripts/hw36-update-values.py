#!/usr/bin/env python3
"""Write the two SHA image tags ArgoCD will pull from Git."""
from pathlib import Path
import re
import sys

if len(sys.argv) != 2 or not re.fullmatch(r"[0-9a-f]{7,40}", sys.argv[1]):
    raise SystemExit("Usage: python scripts/hw36-update-values.py <short-commit-sha>")
tag = sys.argv[1]
out = Path(__file__).resolve().parent.parent / 'chart' / 'values-gitops.yaml'
out.write_text(f"""# Managed by HW36 GitHub Actions after successful lint/test/build.
frontend:
  image:
    tag: '{tag}'
backend:
  image:
    tag: '{tag}'
""", encoding='utf-8')
print(f"Wrote {out} using tag {tag}")
