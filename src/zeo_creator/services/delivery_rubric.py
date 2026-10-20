"""Bind rubric evaluations to a delivery review; pure, fail-closed, and no review is rewritten."""

from datetime import datetime

from zeo_creator.contracts.common import canonical_digest, digest_is_current, stable_id
from zeo_creator.contracts.delivery import (
    ArtifactManifest,
    DeliveryFinding,
    DeliveryReviewBundle,
    FindingSeverity,
)
from zeo_creator.contracts.delivery_rubric import DeliveryRubricBinding, RubricEvaluationRef
from zeo_creator.contracts.rubric import ManifestSubject, RubricEvaluation
from zeo_creator.errors import CreatorDomainError

INVALID = "ZEO_CREATOR_RUBRIC_BINDING_INVALID"


def _refuse(reason: str) -> CreatorDomainError:
    return CreatorDomainError(INVALID, reason)


def bind_rubric_evaluations(
    *,
    review: DeliveryReviewBundle,
    manifest: ArtifactManifest,
    evaluations: tuple[RubricEvaluation, ...],
    created_at: datetime,
) -> DeliveryRubricBinding:
    if not evaluations:
        raise _refuse("at least one rubric evaluation is required")
    if not digest_is_current(review) or not digest_is_current(manifest):
        raise _refuse("the review or the manifest digest is stale")
    if not all(digest_is_current(item) for item in evaluations):
        raise _refuse("a rubric evaluation digest is stale")
    expected_review = stable_id(
        "review", review.brief_id, manifest.content_digest, review.approval_digest
    )
    if (review.manifest_id, review.review_id) != (manifest.manifest_id, expected_review):
        raise _refuse("the review was not produced for this manifest")
    scope = (review.organization_id, review.publication_id)
    ids = [item.evaluation_id for item in evaluations]
    if len(ids) != len(set(ids)):
        raise _refuse("rubric evaluation identifiers must be unique")

    findings: list[DeliveryFinding] = []
    if not review.ready_for_approval:
        findings.append(
            DeliveryFinding(
                code="ZEO_CREATOR_RUBRIC_REVIEW_NOT_READY",
                severity=FindingSeverity.BLOCKING,
                category="rubric",
                message="The delivery review itself has blocking findings",
            )
        )
    for item in evaluations:
        subject = item.subject
        if (
            not isinstance(subject, ManifestSubject)
            or (subject.brief_id, subject.manifest_id, subject.content_digest)
            != (review.brief_id, manifest.manifest_id, manifest.content_digest)
            or (item.organization_id, item.publication_id) != scope
        ):
            raise _refuse(f"rubric evaluation {item.evaluation_id} does not score this manifest")
        if not item.passed:
            findings.append(
                DeliveryFinding(
                    code="ZEO_CREATOR_RUBRIC_EVALUATION_FAILED",
                    severity=FindingSeverity.BLOCKING,
                    category="rubric",
                    message=f"Rubric evaluation {item.evaluation_id} has blocking findings",
                )
            )

    refs = tuple(
        sorted(
            (
                RubricEvaluationRef(evaluation_id=item.evaluation_id, digest=item.content_digest)
                for item in evaluations
            ),
            key=lambda ref: ref.evaluation_id,
        )
    )
    approval_digest = canonical_digest(
        {
            "review_approval_digest": review.approval_digest,
            "evaluations": [[ref.evaluation_id, ref.digest] for ref in refs],
        }
    )
    return DeliveryRubricBinding(
        created_at=created_at,
        organization_id=review.organization_id,
        publication_id=review.publication_id,
        input_refs=(review.review_id, *ids),
        binding_id=stable_id("rubric_binding", review.review_id, approval_digest),
        review_id=review.review_id,
        review_content_digest=review.content_digest,
        review_approval_digest=review.approval_digest,
        evaluation_refs=refs,
        findings=tuple(findings),
        approval_digest=approval_digest,
        ready_for_approval=not findings,
    )
