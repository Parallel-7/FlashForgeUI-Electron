/**
 * @fileoverview Centralized export module for all printer backend type definitions.
 *
 * Aggregates and re-exports TypeScript types from printer-features and backend-operations modules.
 * Provides a single import point for all backend-related types including feature configurations,
 * operational interfaces, job management structures, and capability definitions. Used throughout
 * the application for type-safe printer backend interactions.
 *
 * Key export categories:
 * - Feature types: Camera, LED, filtration, material station configurations
 * - Operation types: Job management, G-code commands, status monitoring
 * - Model types: Printer model identifiers and capabilities
 * - Backend types: Initialization, events, and factory options
 */

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
