export const PromotionApprovalStatus = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
} as const;

export type PromotionApprovalStatus =
  (typeof PromotionApprovalStatus)[keyof typeof PromotionApprovalStatus];

export const RolloutSelectionStrategy = {
  hash: 'hash',
  explicit: 'explicit',
} as const;

export type RolloutSelectionStrategy =
  (typeof RolloutSelectionStrategy)[keyof typeof RolloutSelectionStrategy];

export interface PromotionValidationResultsContract {
  sourceExists: boolean;
  targetExists: boolean;
  pathAllowed: boolean;
  approvalRequired: boolean;
}

export interface RegistryPromotionRecordContract {
  id: string;
  packageName: string;
  version: string;
  sourceChannel: string;
  targetChannel: string;
  promotedBy: string;
  promotedAt: string;
  approvalStatus: PromotionApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  promotionPath: string[] | null;
  validationResults: PromotionValidationResultsContract | null;
  signatureChecksum: string | null;
}

export interface RegistryStagedRolloutContract {
  id: string;
  packageName: string;
  version: string;
  channel: string;
  rolloutPercentage: number;
  includedWorkspaces: string[];
  excludedWorkspaces: string[];
  selectionStrategy: RolloutSelectionStrategy;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface RolloutStatusContract {
  packageName: string;
  version: string;
  channel: string;
  percentage: number;
  includedWorkspaceCount: number;
  totalEligibleWorkspaces: number;
  includedWorkspaceIds: string[];
  rollout: RegistryStagedRolloutContract;
}

export interface RolloutWorkspaceEntryContract {
  workspaceId: string;
  included: boolean;
}

export interface GovernorLimitMetricContract {
  resource: string;
  current: number;
  limit: number;
  percentUsed: number;
}

export interface GovernorLimitMetricsContract {
  timestamp: string;
  metrics: GovernorLimitMetricContract[];
}
