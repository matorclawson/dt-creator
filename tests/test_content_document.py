"""NormalizedDocument: the generic document a site adapter hands to a review gate."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from zeo_creator.contracts.common import canonical_digest, digest_is_current
from zeo_creator.contracts.document import NormalizedDocument
from zeo_creator.contracts.rubric import DocumentSubject

DIGEST = "sha256:" + "a" * 64


def make(**changes: object) -> NormalizedDocument:
    fields: dict[str, object] = {
        "created_at": datetime(2026, 10, 19, tzinfo=UTC),
        "organization_id": "org",
        "publication_id": "pub",
        "document_id": "doc-1",
        "content_class": "article",
        "language": "en",
        "title": "A title",
        "blocks": [
            {"block_id": "h1", "kind": "heading", "level": 1, "text": "A title"},
            {"block_id": "p1", "kind": "paragraph", "text": "First paragraph."},
        ],
        "source_revision": "rev-7",
        "source_digest": DIGEST,
    }
    fields.update(changes)
    return NormalizedDocument.model_validate(fields)


def test_document_binds_a_current_digest_and_is_deterministic() -> None:
    first, second = make(), make()
    assert digest_is_current(first)
    assert first.content_digest == second.content_digest == canonical_digest(first)


def test_subject_pins_document_and_source() -> None:
    doc = make()
    assert doc.subject() == DocumentSubject(
        document_id="doc-1", source_revision="rev-7", source_digest=DIGEST
    )
    assert doc.block_texts() == {"h1": "A title", "p1": "First paragraph."}
    assert doc.text() == "A title\nFirst paragraph."


def test_a_changed_source_changes_the_digest() -> None:
    assert make().content_digest != make(source_revision="rev-8").content_digest


@pytest.mark.parametrize(
    "changes",
    [
        {"blocks": []},
        {"blocks": [{"block_id": "a", "kind": "paragraph", "text": "x"}] * 2},
        {"blocks": [{"block_id": "h", "kind": "heading", "text": "x"}]},
        {"blocks": [{"block_id": "p", "kind": "paragraph", "text": "x", "level": 2}]},
        {"blocks": [{"block_id": "p q", "kind": "paragraph", "text": "x"}]},
        {"links": [{"href": "https://example.com/a", "block_id": "missing"}]},
        {"links": [{"href": "https://example.com/a b"}]},
        {"links": [{"href": "https://example.com\\evil"}]},
        {"media": [{"media_id": "m", "media_type": "image/png", "digest": "nope"}]},
        {
            "media": [
                {"media_id": "m", "media_type": "image/png", "digest": DIGEST, "block_id": "z"}
            ]
        },
        {"metadata": {"api_key": "x"}},
        {"metadata": {"nested": {"Token": "x"}}},
        {"source_digest": "sha256:abc"},
        {"content_class": "Article"},
        {"language": "english!"},
        {"unknown_field": 1},
    ],
)
def test_incoherent_documents_are_refused(changes: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        make(**changes)


def test_duplicate_media_ids_are_refused() -> None:
    media = {"media_id": "m", "media_type": "image/png", "digest": DIGEST}
    with pytest.raises(ValidationError):
        make(media=[media, media])


def test_links_and_media_may_name_an_existing_block() -> None:
    doc = make(
        links=[{"href": "https://example.com/a", "text": "a", "block_id": "p1"}],
        media=[{"media_id": "m", "media_type": "image/png", "digest": DIGEST, "alt_text": "x"}],
    )
    assert doc.links[0].block_id == "p1" and doc.media[0].media_id == "m"
