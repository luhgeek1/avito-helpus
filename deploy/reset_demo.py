"""Reset both halves of the local demo with producers stopped (standard library only)."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def compose(*args):
    subprocess.run(["docker", "compose", *args], cwd=ROOT, check=True)


def main():
    compose("stop", "worker", "api")
    # Rewind corporate numbers only after the API has forgotten all old requests.
    compose(
        "run",
        "--rm",
        "--no-deps",
        "migrate",
        "python",
        "-m",
        "app.cli",
        "seed",
        "--reset",
    )
    compose(
        "exec",
        "-T",
        "corp-mock",
        "python",
        "-c",
        "import urllib.request; r=urllib.request.urlopen(urllib.request.Request("
        "'http://127.0.0.1:8090/admin/reset?reset_sequence=true', data=b'', method='POST')); "
        "assert r.status == 200",
    )
    compose("start", "api", "worker")
    print("Демо сброшено в обеих системах. Войдите заново.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, subprocess.CalledProcessError) as exc:
        print(
            f"Сброс не завершён; API и worker оставлены остановленными. Устраните ошибку и повторите: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)
