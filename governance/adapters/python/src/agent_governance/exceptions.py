"""Exceptions raised by the agent-governance client."""


class GovernanceError(Exception):
    """Base class for governance client errors."""


class GovernanceDenied(GovernanceError):
    """The gated tool call was denied (not granted, or an L4 rule, or a
    human rejection). Carries the machine-readable reason."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class GovernancePendingApproval(GovernanceError):
    """The gated tool call is paused awaiting human approval. Wire this to
    your framework's interrupt/human-in-the-loop mechanism, then approve or
    reject via :meth:`GovernanceClient.decide`."""

    def __init__(self, execution_id: str, approval_id: str, tool_name: str, risk_level: str):
        super().__init__(
            f"tool {tool_name!r} paused at risk {risk_level}; approval {approval_id}"
        )
        self.execution_id = execution_id
        self.approval_id = approval_id
        self.tool_name = tool_name
        self.risk_level = risk_level
