"""The committed pre-push hook runs the one gate, and only when a push has something to verify."""

import os
import stat
import subprocess
from pathlib import Path

HOOK = Path(".githooks/pre-push")
ZERO = "0" * 40
SHA = "a" * 40


def _run(tmp_path: Path, stdin: str, make_exit: int = 0) -> tuple[int, list[str]]:
    fake = tmp_path / "bin"
    fake.mkdir()
    log = tmp_path / "calls"
    script = fake / "make"
    script.write_text(f'#!/bin/sh\necho "$@" >> "{log}"\nexit {make_exit}\n')
    script.chmod(script.stat().st_mode | stat.S_IXUSR)
    env = {**os.environ, "PATH": f"{fake}{os.pathsep}{os.environ['PATH']}"}
    done = subprocess.run(
        ["sh", str(HOOK.resolve())],
        input=stdin,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
    return done.returncode, log.read_text().splitlines() if log.exists() else []


def test_the_hook_is_committed_and_executable() -> None:
    assert HOOK.is_file()
    assert HOOK.stat().st_mode & stat.S_IXUSR


def test_a_push_runs_make_verify(tmp_path: Path) -> None:
    code, calls = _run(tmp_path, f"refs/heads/x {SHA} refs/heads/x {ZERO}\n")
    assert (code, calls) == (0, ["verify"])


def test_a_failing_gate_blocks_the_push(tmp_path: Path) -> None:
    code, calls = _run(tmp_path, f"refs/heads/x {SHA} refs/heads/x {ZERO}\n", make_exit=2)
    assert code == 2 and calls == ["verify"]


def test_deleting_a_branch_has_nothing_to_verify(tmp_path: Path) -> None:
    code, calls = _run(tmp_path, f"(delete) {ZERO} refs/heads/x {SHA}\n")
    assert (code, calls) == (0, [])


def test_setup_enables_the_hook() -> None:
    makefile = Path("Makefile").read_text()
    assert "core.hooksPath .githooks" in makefile
