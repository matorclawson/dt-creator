"""Binding of rubric evaluations to a delivery review, without changing the review itself."""

from pydantic import Field, model_validator

from zeo_creator.contracts.common import CreatorModel, DurableArtifact
from zeo_creator.contracts.delivery import DeliveryFinding, FindingSeverity


class RubricEvaluationRef(CreatorModel):
    evaluation_id: str = Field(min_length=1)
    digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")


class DeliveryRubricBinding(DurableArtifact):
    """Which rubric evaluations were read for one delivery review, and whether they allow approval.

    The review is bound by its id, content digest and approval digest, and stays untouched.
    `approval_digest` covers the review's approval digest and the sorted evaluation references,
    so changing the review or the evaluation set changes it.
    """

    binding_id: str = Field(min_length=1)
    review_id: str = Field(min_length=1)
    review_content_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    review_approval_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    evaluation_refs: tuple[RubricEvaluationRef, ...] = Field(min_length=1)
    findings: tuple[DeliveryFinding, ...] = ()
    approval_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    ready_for_approval: bool

    @model_validator(mode="after")
    def coherent_binding(self) -> DeliveryRubricBinding:
        ids = [item.evaluation_id for item in self.evaluation_refs]
        if len(ids) != len(set(ids)):
            raise ValueError("evaluation references must be unique")
        blocked = any(item.severity == FindingSeverity.BLOCKING for item in self.findings)
        if self.ready_for_approval == blocked:
            raise ValueError("a binding is ready exactly when it has no blocking finding")
        return self
