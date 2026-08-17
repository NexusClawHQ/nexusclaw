"""agent-governance: deny-by-default governance for AI agent tools.

Three-line adoption (LangGraph / CrewAI / any Python agent):

    from agent_governance import GovernanceClient
    gov = GovernanceClient("http://127.0.0.1:7800")
    update_customer = gov.wrap_tool(update_customer)   # gated + audited
"""

from .client import GovernanceClient
from .exceptions import GovernanceDenied, GovernanceError, GovernancePendingApproval

__all__ = ["GovernanceClient", "GovernanceDenied", "GovernancePendingApproval", "GovernanceError"]
__version__ = "0.1.0"
