// src/types/printer-backend/index.ts
// Main exports for printer backend type definitions

// Feature types
export type {
  PrinterFeatureType,
  CameraFeature,
  LEDControlFeature,
  FiltrationFeature,
  GCodeCommandFeature,
  StatusMonitoringFeature,
  JobManagementFeature,
  MaterialStationFeature,
  PrinterFeatureSet,
  FeatureAvailabilityResult,
  FeatureOverrideSettings,
  MaterialSlotInfo,
  MaterialStationStatus,
  FeatureDisableReason
} from './printer-features';

// Backend operation types
export type {
  PrinterModelType,
  BackendInitOptions,
  CommandResult,
  GCodeCommandResult,
  StatusResult,
  BaseJobInfo,
  AD5XJobInfo,
  BasicJobInfo,
  JobListResult,
  JobStartParams,
  JobStartResult,
  JobOperation,
  JobOperationParams,
  BackendCapabilities,
  BackendStatus,
  BackendOperationContext,
  FeatureStubInfo,
  BackendEventType,
  BackendEvent,
  BackendFactoryOptions
} from './backend-operations';
