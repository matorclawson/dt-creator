"""The normalized document a site adapter hands to a review gate.

A publication's own markup is not Creator's business; the adapter reduces it to this generic,
medium-agnostic shape: typed blocks with identifiers, links, media with digests, and the source
revision it was taken from. A rubric can then quote a block by identifier without parsing markup.
"""

from enum import StrEnum
from typing import Annotated, Self

from pydantic import Field, JsonValue, model_validator

from zeo_creator.contracts.common import CreatorModel, DurableArtifact, assert_secret_safe
from zeo_creator.contracts.rubric import DocumentSubject, Language

IDENTIFIER = r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"
CONTENT_CLASS = r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
DIGEST = r"^sha256:[0-9a-f]{64}$"

Identifier = Annotated[str, Field(pattern=IDENTIFIER, max_length=128)]


class BlockKind(StrEnum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST_ITEM = "list_item"
    QUOTE = "quote"
    CODE = "code"
    CAPTION = "caption"
    OTHER = "other"


class DocumentBlock(CreatorModel):
    block_id: Identifier
    kind: BlockKind
    text: str = Field(min_length=1)
    level: int | None = Field(default=None, ge=1, le=6)

    @model_validator(mode="after")
    def level_belongs_to_headings(self) -> Self:
        if (self.level is not None) != (self.kind is BlockKind.HEADING):
            raise ValueError("only a heading carries a level, and every heading carries one")
        return self


class DocumentLink(CreatorModel):
    href: str = Field(min_length=1, max_length=2048, pattern=r"^[^\s\x00-\x1f\x7f\\]+$")
    text: str | None = Field(default=None, min_length=1)
    block_id: Identifier | None = None


class DocumentMedia(CreatorModel):
    media_id: Identifier
    media_type: str = Field(pattern=r"^[a-z]+/[A-Za-z0-9.+-]+$")
    digest: str = Field(pattern=DIGEST)
    alt_text: str | None = Field(default=None, min_length=1)
    block_id: Identifier | None = None


class NormalizedDocument(DurableArtifact):
    document_id: Identifier
    content_class: str = Field(pattern=CONTENT_CLASS, max_length=96)
    language: Language
    title: str = Field(min_length=1)
    blocks: tuple[DocumentBlock, ...] = Field(min_length=1)
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    links: tuple[DocumentLink, ...] = ()
    media: tuple[DocumentMedia, ...] = ()
    source_revision: str = Field(min_length=1)
    source_digest: str = Field(pattern=DIGEST)

    @model_validator(mode="after")
    def coherent_document(self) -> Self:
        assert_secret_safe(self.metadata)
        block_ids = [block.block_id for block in self.blocks]
        if len(block_ids) != len(set(block_ids)):
            raise ValueError("block identifiers are unique within a document")
        media_ids = [item.media_id for item in self.media]
        if len(media_ids) != len(set(media_ids)):
            raise ValueError("media identifiers are unique within a document")
        known = set(block_ids)
        named = [link.block_id for link in self.links] + [item.block_id for item in self.media]
        if any(name is not None and name not in known for name in named):
            raise ValueError("a link or media item names a block this document lacks")
        return self

    def subject(self) -> DocumentSubject:
        """The rubric subject that pins this exact document and source."""
        return DocumentSubject(
            document_id=self.document_id,
            source_revision=self.source_revision,
            source_digest=self.source_digest,
        )

    def block_texts(self) -> dict[str, str]:
        """Block text by identifier, for quote checks that name a block."""
        return {block.block_id: block.text for block in self.blocks}

    def text(self) -> str:
        """The document's text, one block per line, for quote checks across blocks."""
        return "\n".join(block.text for block in self.blocks)
