from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app import cli
from app.cli import run_knowledge
from app.knowledge_import import MAX_DOCUMENT_BYTES, read_knowledge

HEADER = """---
slug: sdk-help
title: Test SDK guide
scope: company
roles: [intern]
owner: Test team
updated_at: 2026-11-15
---
## Installation
Synthetic instructions.
"""


def test_validates_without_database(tmp_path: Path) -> None:
    (tmp_path / "guide.md").write_text(HEADER)
    result = read_knowledge(tmp_path)
    assert result[0].slug == "sdk-help"
    assert "Synthetic" in result[0].body


@pytest.mark.parametrize(
    "content",
    [
        "Missing header",
        "---\nnot: closed",
        "---\n- invalid\n---\nBody",
        HEADER.replace("scope: company", "scope: team"),
        HEADER.replace("scope: company", f"scope: company\nteam_id: {uuid4()}"),
        HEADER.replace("roles: [intern]", "roles: [superuser]"),
        HEADER.replace("roles: [intern]", "roles: []"),
        HEADER.replace("owner: Test team", "owner: Test team\nbody: injected"),
    ],
)
def test_refuses_ambiguous_or_unsafe_metadata(tmp_path: Path, content: str) -> None:
    (tmp_path / "guide.md").write_text(content)
    with pytest.raises((ValueError, ValidationError)):
        read_knowledge(tmp_path)


def test_bounds_files_and_rejects_duplicate_slugs(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="directory"):
        read_knowledge(tmp_path / "missing")
    with pytest.raises(ValueError, match="Expected"):
        read_knowledge(tmp_path)
    (tmp_path / "one.md").write_text(HEADER)
    (tmp_path / "two.md").write_text(HEADER)
    with pytest.raises(ValueError, match="Duplicate"):
        read_knowledge(tmp_path)
    (tmp_path / "two.md").write_bytes(b"x" * (MAX_DOCUMENT_BYTES + 1))
    with pytest.raises(ValueError, match="bounded"):
        read_knowledge(tmp_path)


async def test_cli_check_does_not_need_configuration(tmp_path: Path) -> None:
    (tmp_path / "guide.md").write_text(HEADER)
    assert await run_knowledge(tmp_path, replace=False, check=True) == (
        "validated 1 documents (no database writes)"
    )


async def test_cli_import_disposes_connection(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "guide.md").write_text(HEADER)
    db = SimpleNamespace(dispose=AsyncMock())
    monkeypatch.setattr(cli, "_SeedSettings", Mock(return_value=object()))
    monkeypatch.setattr(cli, "Database", Mock(return_value=db))
    importer = AsyncMock(return_value=1)
    monkeypatch.setattr(cli, "import_knowledge", importer)
    assert "imported 1" in await cli.run_knowledge(tmp_path, replace=True, check=False)
    assert importer.call_args.kwargs["replace"] is True
    db.dispose.assert_awaited_once()
