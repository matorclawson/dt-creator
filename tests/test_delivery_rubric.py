"""A delivery review is bound to its rubric evaluations without being rewritten."""

import pytest

from tests.fixtures.reference import NOW, build_reference_snapshot, publication_profiles
from zeo_creator.contracts.delivery import DeliveryReviewBundle
from zeo_creator.contracts.delivery_rubric import DeliveryRubricBinding
from zeo_creator.contracts.distribution import ChannelPlan
from zeo_creator.contracts.rubric import (
    DocumentSubject,
    FindingKind,
    ManifestSubject,
    RubricEvaluation,
    RubricFinding,
    RubricRef,
    ScorecardRef,
)
from zeo_creator.errors import CreatorDomainError
from zeo_creator.services.delivery_rubric import bind_rubric_evaluations
from zeo_creator.services.validation import validate_delivery_bundle

DIGEST = "sha256:" + "a" * 64


def _inputs() -> dict[str, object]:
    snapshot = build_reference_snapshot()
    brief = snapshot.briefs[0]
    review = snapshot.reviews[0]
    plan = ChannelPlan(
        channel_plan_id=review.input_refs[-1],
        created_at=NOW,
        organization_id=brief.organization_id,
        publication_id=brief.publication_id,
        input_refs=(brief.brief_id,),
        variants=review.proposed_variants,
    )
    return {
        "brief": brief,
        "manifest": snapshot.manifests[0],
        "publication": publication_profiles()[0],
        "synthesis": snapshot.syntheses[0],
        "channel_plan": plan,
        "created_at": NOW,
        "revision": 1,
    }


def _evaluation(
    inputs: dict[str, object],
    *,
    passed: bool = True,
    evaluation_id: str = "eval-1",
    subject: ManifestSubject | DocumentSubject | None = None,
) -> RubricEvaluation:
    brief, manifest = inputs["brief"], inputs["manifest"]
    findings = (
        ()
        if passed
        else (
            RubricFinding(
                code="ZEO_CREATOR_RUBRIC_BELOW_FLOOR",
                kind=FindingKind.BELOW_FLOOR,
                reason="below the floor",
            ),
        )
    )
    return RubricEvaluation(
        created_at=NOW,
        organization_id=brief.organization_id,  # type: ignore[attr-defined]
        publication_id=brief.publication_id,  # type: ignore[attr-defined]
        evaluation_id=evaluation_id,
        rubric_ref=RubricRef(rubric_id="house.note", rubric_version="1.0.0", digest=DIGEST),
        subject=subject
        or ManifestSubject(
            brief_id=brief.brief_id,  # type: ignore[attr-defined]
            manifest_id=manifest.manifest_id,  # type: ignore[attr-defined]
            content_digest=manifest.content_digest,  # type: ignore[attr-defined]
        ),
        language="en",
        scorecard_refs=(ScorecardRef(scorecard_id="sc1", digest=DIGEST),),
        passed=passed,
        weighted_points=9,
        weighted_max=10,
        findings=findings,
    )


def _review(inputs: dict[str, object]) -> DeliveryReviewBundle:
    return validate_delivery_bundle(**inputs)  # type: ignore[arg-type]


def _bind(
    inputs: dict[str, object],
    *evaluations: RubricEvaluation,
    review: DeliveryReviewBundle | None = None,
) -> DeliveryRubricBinding:
    return bind_rubric_evaluations(
        review=review or _review(inputs),
        manifest=inputs["manifest"],  # type: ignore[arg-type]
        evaluations=evaluations,
        created_at=NOW,
    )


def test_the_review_is_untouched_and_a_passing_evaluation_is_bound() -> None:
    inputs = _inputs()
    review = _review(inputs)
    before = review.model_dump_json()
    evaluation = _evaluation(inputs)
    binding = _bind(inputs, evaluation, review=review)
    assert review.model_dump_json() == before
    assert binding.ready_for_approval and binding.findings == ()
    assert binding.review_id == review.review_id
    assert binding.review_approval_digest == review.approval_digest
    assert [(r.evaluation_id, r.digest) for r in binding.evaluation_refs] == [
        ("eval-1", evaluation.content_digest)
    ]
    assert binding.approval_digest != review.approval_digest


def test_a_failing_evaluation_blocks_the_binding() -> None:
    inputs = _inputs()
    binding = _bind(inputs, _evaluation(inputs, passed=False))
    assert not binding.ready_for_approval
    assert {f.code for f in binding.findings} == {"ZEO_CREATOR_RUBRIC_EVALUATION_FAILED"}


def test_a_review_with_blocking_findings_cannot_be_made_ready_by_a_passing_rubric() -> None:
    inputs = _inputs()
    bad = validate_delivery_bundle(**{**inputs, "publication": publication_profiles()[1]})  # type: ignore[arg-type]
    assert not bad.ready_for_approval
    binding = _bind(inputs, _evaluation(inputs), review=bad)
    assert not binding.ready_for_approval
    assert {f.code for f in binding.findings} == {"ZEO_CREATOR_RUBRIC_REVIEW_NOT_READY"}


def test_the_approval_digest_changes_with_the_evaluation_set_and_is_order_free() -> None:
    inputs = _inputs()
    one = _bind(inputs, _evaluation(inputs))
    first, second = _evaluation(inputs), _evaluation(inputs, evaluation_id="eval-2")
    forward = _bind(inputs, first, second)
    backward = _bind(inputs, second, first)
    assert one.approval_digest != forward.approval_digest
    assert forward.approval_digest == backward.approval_digest


def test_foreign_stale_duplicate_and_empty_inputs_are_refused() -> None:
    inputs = _inputs()
    other = ManifestSubject(brief_id="other", manifest_id="other", content_digest=DIGEST)
    document = DocumentSubject(document_id="d", source_revision="r", source_digest=DIGEST)
    for subject in (other, document):
        with pytest.raises(CreatorDomainError, match="does not score this manifest"):
            _bind(inputs, _evaluation(inputs, subject=subject))
    twin = _evaluation(inputs)
    with pytest.raises(CreatorDomainError, match="unique"):
        _bind(inputs, twin, twin)
    with pytest.raises(CreatorDomainError, match="stale"):
        _bind(inputs, twin.model_copy(update={"weighted_points": 1}))
    with pytest.raises(CreatorDomainError, match="at least one"):
        _bind(inputs)


def test_a_review_from_another_manifest_is_refused() -> None:
    inputs = _inputs()
    snapshot = build_reference_snapshot()
    foreign = snapshot.reviews[1]
    with pytest.raises(CreatorDomainError, match="not produced for this manifest"):
        _bind(inputs, _evaluation(inputs), review=foreign)
