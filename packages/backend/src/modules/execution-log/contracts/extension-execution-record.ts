export type ExtensionExecutionOutcome =
  | 'success'
  | 'error'
  | 'timeout'
  | 'cancelled';

export interface ExtensionExecutionRecord {
  schemaVersion: 'code-extension-execution/v1';
  executionId: string;
  workspaceId: string;
  extensionKind: 'function' | 'trigger';
  extensionId: string;
  extensionName: string;
  packageName?: string | null;
  packageVersion?: string | null;
  contractVersion?: string | null;
  runtimeApiVersion?: string | null;
  sourceRef?: string | null;
  triggerSource?: string | null;
  recordIds?: string[] | null;
  startedAt: string;
  completedAt?: string | null;
  durationMs: number;
  outcome: ExtensionExecutionOutcome;
  providerId?: string | null;
  policyId?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  evidenceRefs?: string[];
}

export interface ExtensionDiagnosticRecord {
  schemaVersion: 'code-extension-diagnostic/v1';
  executionId: string;
  extensionKind: 'function' | 'trigger';
  extensionId: string;
  extensionName: string;
  message: string;
  stack?: string | null;
  sourceRef?: string | null;
  redactionApplied: boolean;
  context: {
    workspaceId: string;
    triggerSource?: string | null;
    recordIds?: string[] | null;
    inputPreview?: Record<string, unknown> | null;
  };
}
