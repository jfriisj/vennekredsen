#!/usr/bin/env python3
"""Verify and stage the derived GitHub Wiki from admitted main.

The repository's ``wiki/`` directory is the publication source. This tool owns
source validation, admitted-main verification, and provenance generation. The
actual transport to ``.wiki.git`` is delegated to the pinned deploy-wiki
GitHub Action.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


class WikiPublishFailure(Exception):
    pass


REQUIRED_PAGES = {"Home.md", "_Sidebar.md", "_Footer.md"}
WIKI_LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def run(cmd: list[str], cwd: Path, *, capture: bool = False) -> str:
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            check=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
        )
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        raise WikiPublishFailure(f"command failed: {' '.join(cmd)}: {detail}") from exc
    return (result.stdout or "").strip()


def git_sha(root: Path) -> str:
    return run(["git", "rev-parse", "HEAD"], root, capture=True)


def normalize_wiki_target(target: str) -> str:
    target = target.strip()
    if "|" in target:
        target = target.split("|", 1)[1].strip()
    target = target.split("#", 1)[0].strip()
    return target.replace(" ", "-") + ".md"


def wiki_pages(wiki_dir: Path) -> dict[str, Path]:
    if not wiki_dir.is_dir():
        raise WikiPublishFailure(f"wiki source directory not found: {wiki_dir}")
    pages = {path.name: path for path in wiki_dir.glob("*.md") if path.is_file()}
    missing = sorted(REQUIRED_PAGES - set(pages))
    if missing:
        raise WikiPublishFailure(f"missing required wiki pages: {', '.join(missing)}")
    return pages


def verify_wiki_source(wiki_dir: Path) -> dict[str, Path]:
    pages = wiki_pages(wiki_dir)
    failures: list[str] = []

    for page_name, path in sorted(pages.items()):
        text = path.read_text(encoding="utf-8")
        for raw in WIKI_LINK_RE.findall(text):
            target = normalize_wiki_target(raw)
            if target not in pages:
                failures.append(f"{page_name}: wiki link [[{raw}]] resolves to missing {target}")

    if failures:
        raise WikiPublishFailure("; ".join(failures))
    return pages


def verify_admitted_main(root: Path, expected_sha: str | None) -> str:
    head = git_sha(root)
    if expected_sha and head != expected_sha:
        raise WikiPublishFailure(
            f"source SHA mismatch: expected {expected_sha}, actual {head}"
        )

    run(["git", "fetch", "origin", "main"], root)
    origin_main = run(["git", "rev-parse", "origin/main"], root, capture=True)
    if head != origin_main:
        raise WikiPublishFailure(
            f"publication refused: HEAD {head} is not admitted origin/main {origin_main}"
        )

    dirty = run(["git", "status", "--porcelain"], root, capture=True)
    if dirty:
        raise WikiPublishFailure("publication refused: working tree is not clean")
    return head


def stage_wiki_source(
    wiki_dir: Path,
    stage_dir: Path,
    repo_slug: str,
    source_sha: str,
) -> int:
    pages = verify_wiki_source(wiki_dir)

    if stage_dir.exists():
        shutil.rmtree(stage_dir)
    stage_dir.mkdir(parents=True)

    for name, path in pages.items():
        shutil.copy2(path, stage_dir / name)

    (stage_dir / "Source-Revision.md").write_text(
        "# Source Revision\n\n"
        "This wiki is a derived presentation layer. Normative authority remains in "
        f"`{repo_slug}` at exact source commit `{source_sha}`.\n",
        encoding="utf-8",
    )
    return len(pages) + 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify or stage Vennekredsen GitHub Wiki")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--repo-slug", default="jfriisj/vennekredsen")
    parser.add_argument("--expected-sha", default=None)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--stage-dir", type=Path, default=None)
    args = parser.parse_args()

    root = args.root.resolve()
    source = root / "wiki"

    try:
        pages = verify_wiki_source(source)
        if args.verify_only:
            print(f"WIKI_SOURCE_VALIDATION_PASS pages={len(pages)}")
            return 0

        if args.stage_dir is None:
            raise WikiPublishFailure("--stage-dir is required unless --verify-only is used")

        sha = verify_admitted_main(root, args.expected_sha)
        stage_dir = args.stage_dir
        if not stage_dir.is_absolute():
            stage_dir = root / stage_dir
        staged = stage_wiki_source(source, stage_dir, args.repo_slug, sha)
        print(
            f"WIKI_STAGE_PASS source_sha={sha} files={staged} "
            f"stage_dir={stage_dir.relative_to(root) if stage_dir.is_relative_to(root) else stage_dir}"
        )
    except WikiPublishFailure as exc:
        print(f"WIKI_STAGE_FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
