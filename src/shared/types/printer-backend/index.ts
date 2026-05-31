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

// Backend operation types
export type {
  AD5XJobInfo,
  BackendCapabilities,
  BackendEvent,
  BackendEventType,
  BackendFactoryOptions,
  BackendInitOptions,
  BackendOperationContext,
  BackendStatus,
  BaseJobInfo,
  BasicJobInfo,
  CommandResult,
  FeatureStubInfo,
  GCodeCommandResult,
  JobListResult,
  JobOperation,
  JobOperationParams,
  JobStartParams,
  JobStartResult,
  PrinterModelType,
  StatusResult,
} from './backend-operations.js';
// Feature types
export type {
  CameraFeature,
  FeatureAvailabilityResult,
  FeatureDisableReason,
  FeatureOverrideSettings,
  FiltrationFeature,
  GCodeCommandFeature,
  JobManagementFeature,
  LEDControlFeature,
  MaterialSlotInfo,
  MaterialStationFeature,
  MaterialStationStatus,
  PrinterFeatureSet,
  PrinterFeatureType,
  StatusMonitoringFeature,
} from './printer-features.js';
