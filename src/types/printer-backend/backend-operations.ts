// src/types/printer-backend/backend-operations.ts
// Type definitions for backend operations, commands, and results
// MAJOR REWRITE: Fixed to match actual API behavior - no more fake jobId concept

import { FiveMClient, FlashForgeClient, FFGcodeToolData } from 'ff-api';
import { PrinterFeatureSet, MaterialStationStatus } from './printer-features';

/**
 * Printer model types supported by the backend system
 */
export type PrinterModelType = 
  | 'generic-legacy'
  | 'adventurer-5m'
  | 'adventurer-5m-pro' 
  | 'ad5x';

/**
 * Backend initialization options
 */
export interface BackendInitOptions {
  readonly printerModel: PrinterModelType;
  readonly primaryClient: FiveMClient | FlashForgeClient;
  readonly secondaryClient?: FlashForgeClient; // For dual API scenarios
  readonly printerDetails: {
    readonly name: string;
    readonly ipAddress: string;
    readonly serialNumber: string;
    readonly typeName: string;
    readonly customCameraEnabled?: boolean;
    readonly customCameraUrl?: string;
    readonly customLedsEnabled?: boolean;
    readonly forceLegacyMode?: boolean;
  };
}

/**
 * Command execution result
 */
export interface CommandResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly timestamp: Date;
}

/**
 * G-code command execution result
 */
export interface GCodeCommandResult extends CommandResult {
  readonly command: string;
  readonly response?: string;
  readonly executionTime: number;
}

/**
 * Status monitoring result
 */
export interface StatusResult extends CommandResult {
  readonly status: {
    readonly printerState: string;
    readonly bedTemperature: number;
    readonly nozzleTemperature: number;
    readonly progress: number;
    readonly currentJob?: string;
    readonly estimatedTime?: number;
    readonly remainingTime?: number;
    readonly currentLayer?: number;
    readonly totalLayers?: number;
  };
}

/**
 * Base job information interface - all models extend this
 */
export interface BaseJobInfo {
  readonly fileName: string;
  readonly printingTime: number;
}

/**
 * AD5X job information with rich metadata
 * Based on FFGcodeFileEntry from ff-5mp-api-ts
 */
export interface AD5XJobInfo extends BaseJobInfo {
  readonly toolCount?: number;
  readonly toolDatas?: FFGcodeToolData[];
  readonly totalFilamentWeight?: number;
  readonly useMatlStation?: boolean;
  readonly _type?: 'ad5x'; // Discriminator for type safety
}

/**
 * Basic job information for 5M/5M Pro models
 * Based on basic FFGcodeFileEntry format (converted from string[])
 */
export interface BasicJobInfo extends BaseJobInfo {
  // printingTime will be 0 for 5M/5M Pro models
  // Only fileName and printingTime are available - no additional properties
  readonly _type?: 'basic'; // Discriminator for type safety
}

/**
 * Job list result - uses union types for model-specific job info
 */
export interface JobListResult extends CommandResult {
  readonly jobs: readonly (AD5XJobInfo | BasicJobInfo)[];
  readonly totalCount: number;
  readonly source: 'local' | 'recent';
}

/**
 * Job start parameters - FIXED to use fileName instead of jobId
 */
export interface JobStartParams {
  readonly fileName: string; // Primary identifier - matches API parameter
  readonly leveling: boolean; // Whether to perform bed leveling before printing
  readonly startNow: boolean; // Whether to start printing immediately or just upload
  readonly filePath?: string; // For file upload operations
  readonly additionalParams?: Record<string, unknown>;
}

/**
 * Job start result - FIXED to use fileName and remove estimatedTime
 */
export interface JobStartResult extends CommandResult {
  readonly fileName: string; // Matches API behavior
  readonly started: boolean;
  // Note: estimatedTime removed - APIs only return boolean success
}

/**
 * Job operation types
 */
export type JobOperation = 
  | 'start'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'list-local'
  | 'list-recent';

/**
 * Job operation parameters - FIXED to use fileName instead of jobId
 */
export interface JobOperationParams {
  readonly operation: JobOperation;
  readonly fileName?: string; // Primary identifier - matches API parameter
  readonly leveling: boolean; // Whether to perform bed leveling before printing
  readonly startNow: boolean; // Whether to start printing immediately or just upload
  readonly filePath?: string; // For file upload operations
  readonly additionalParams?: Record<string, unknown>;
}

/**
 * Backend capability information
 */
export interface BackendCapabilities {
  readonly modelType: PrinterModelType;
  readonly supportedFeatures: readonly string[];
  readonly apiClients: readonly ('new' | 'legacy')[];
  readonly materialStationSupport: boolean;
  readonly dualAPISupport: boolean;
}

/**
 * Backend status information
 */
export interface BackendStatus {
  readonly initialized: boolean;
  readonly connected: boolean;
  readonly primaryClientConnected: boolean;
  readonly secondaryClientConnected: boolean;
  readonly features: PrinterFeatureSet;
  readonly capabilities: BackendCapabilities;
  readonly materialStation?: MaterialStationStatus;
  readonly lastUpdate: Date;
}

/**
 * Backend operation context
 */
export interface BackendOperationContext {
  readonly operation: string;
  readonly timestamp: Date;
  readonly printerModel: PrinterModelType;
  readonly usesNewAPI: boolean;
  readonly usesLegacyAPI: boolean;
  readonly parameters?: Record<string, unknown>;
}

/**
 * Feature stub information for disabled features
 */
export interface FeatureStubInfo {
  readonly feature: string;
  readonly printerModel: string;
  readonly reason: string;
  readonly canBeEnabled: boolean;
  readonly settingsPath?: string;
}

/**
 * Backend event types
 */
export type BackendEventType = 
  | 'initialized'
  | 'connected'
  | 'disconnected'
  | 'feature-updated'
  | 'status-updated'
  | 'material-station-updated'
  | 'job-started'
  | 'job-completed'
  | 'job-cancelled'
  | 'error';

/**
 * Backend event data
 */
export interface BackendEvent {
  readonly type: BackendEventType;
  readonly timestamp: Date;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Backend factory options
 */
export interface BackendFactoryOptions {
  readonly printerModel: PrinterModelType;
  readonly printerDetails: {
    readonly name: string;
    readonly ipAddress: string;
    readonly serialNumber: string;
    readonly typeName: string;
    readonly clientType: 'legacy' | 'new';
    readonly checkCode: string;
  };
  readonly primaryClient: FiveMClient | FlashForgeClient;
  readonly secondaryClient?: FlashForgeClient;
  readonly featureOverrides?: {
    readonly customCameraEnabled: boolean;
    readonly customCameraUrl: string;
    readonly customLEDControlEnabled: boolean;
    readonly ForceLegacyAPI: boolean;
  };
}
