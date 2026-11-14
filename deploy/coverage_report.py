"""Combined line coverage of the whole team's code (backend + frontend), as the jury counts it.

Reads reports/backend-coverage.xml (Cobertura, from pytest-cov) and
frontend/coverage/coverage-summary.json (Istanbul json-summary, from Vitest) and writes
reports/coverage-summary.md. corp-mock is an imitation of external services and is excluded (Q&A 72).
"""

import json
import sys
import xml.etree.ElementTree as ET  # noqa: S405 - our own report file
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
THRESHOLD = 80.0


def backend() -> tuple[int, int]:
    root = ET.parse(REPORTS / "backend-coverage.xml").getroot()  # noqa: S314
    return int(root.attrib["lines-covered"]), int(root.attrib["lines-valid"])


def frontend() -> tuple[int, int]:
    summary = json.loads((ROOT / "frontend" / "coverage" / "coverage-summary.json").read_text())
    lines = summary["total"]["lines"]
    return int(lines["covered"]), int(lines["total"])


def main() -> int:
    parts = {"Бэкенд (backend/app)": backend(), "Фронтенд (frontend/src)": frontend()}
    covered = sum(c for c, _ in parts.values())
    total = sum(t for _, t in parts.values())
    combined = 100 * covered / total if total else 0.0
    rows = [f"| {name} | {c} | {t} | {100 * c / t:.1f}% |" for name, (c, t) in parts.items()]
    report = "\n".join(
        [
            "# Покрытие тестами",
            "",
            "| Часть | Покрыто строк | Всего строк | Покрытие |",
            "|---|---|---|---|",
            *rows,
            f"| **Итого** | **{covered}** | **{total}** | **{combined:.1f}%** |",
            "",
            "Моки корпоративных сервисов (`corp-mock/`) не входят в расчёт (№72 Q&A).",
            "Отчёты: `reports/backend-coverage.xml` (Cobertura), `reports/backend.lcov`,",
            "`frontend/coverage/` (Istanbul HTML и json-summary).",
            "",
        ]
    )
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "coverage-summary.md").write_text(report, encoding="utf-8")
    print(report)  # noqa: T201 - CLI output
    return 0 if combined >= THRESHOLD else 1


if __name__ == "__main__":
    sys.exit(main())
