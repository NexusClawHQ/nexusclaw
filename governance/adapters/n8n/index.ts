import { GovernanceApi } from './credentials/GovernanceApi.credentials';
import { GovernanceGate } from './nodes/GovernanceGate/GovernanceGate.node';
import { GovernanceApprove } from './nodes/GovernanceApprove/GovernanceApprove.node';
import { GovernancePending } from './nodes/GovernancePending/GovernancePending.node';

export const nodes = [GovernanceGate, GovernanceApprove, GovernancePending];
export const credentials = [GovernanceApi];
