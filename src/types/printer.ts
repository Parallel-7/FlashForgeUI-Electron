// src/types/printer.ts
// TypeScript type definitions for printer connection system

import { PrinterModelType } from './printer-backend';

/**
 * Client type for printer connection
 */
export type PrinterClientType = 'legacy' | 'new';

/**
 * Printer details structure for saving to printer_details.json
 * Based on legacy structure but with TypeScript and updated requirements
 */
export interface PrinterDetails {
  readonly Name: string;
  readonly IPAddress: string;
  readonly SerialNumber: string;
  readonly CheckCode: string;
  readonly ClientType: PrinterClientType;
  readonly printerModel: string; // typeName from API for future auto-connect logic
  readonly modelType?: PrinterModelType; // Specific model type for backend selection
}

/**
 * Discovered printer information from network scan
 */
export interface DiscoveredPrinter {
  readonly name: string;
  readonly ipAddress: string;
  readonly serialNumber: string;
  readonly model?: string;
  readonly status?: string;
  readonly firmwareVersion?: string;
}

/**
 * Basic printer information from API response
 */
export interface PrinterApiInfo {
  readonly TypeName?: string;
  readonly SerialNumber?: string;
  readonly FirmwareVersion?: string;
  readonly Status?: string;
}

/**
 * Extended printer info that may include a reuseable client
 */
export interface ExtendedPrinterInfo {
  readonly TypeName?: string;
  readonly SerialNumber?: string;
  readonly FirmwareVersion?: string;
  readonly Status?: string;
  readonly _reuseableClient?: unknown; // For legacy client reuse
  readonly [key: string]: unknown;
}

/**
 * Temporary connection result used during printer type detection
 */
export interface TemporaryConnectionResult {
  readonly success: boolean;
  readonly typeName?: string;
  readonly printerInfo?: ExtendedPrinterInfo;
  readonly error?: string;
}

/**
 * Base interface for printer client instances
 */
export interface PrinterClient {
  readonly isConnected?: boolean;
  readonly disconnect?: () => Promise<void> | void;
  readonly sendRawCmd?: (command: string) => Promise<unknown>;
}

/**
 * Connection flow result after successful connection
 */
export interface ConnectionResult {
  readonly success: boolean;
  readonly printerDetails?: PrinterDetails;
  readonly clientInstance?: unknown;
  readonly error?: string;
}

/**
 * Printer family detection result
 */
export interface PrinterFamilyInfo {
  readonly is5MFamily: boolean;
  readonly requiresCheckCode: boolean;
  readonly familyName: string; // e.g., "Adventurer 5M", "Creator Pro", etc.
}

/**
 * Options for printer connection
 */
export interface ConnectionOptions {
  readonly forceShowPairing?: boolean;
  readonly skipSavedConnection?: boolean;
  readonly checkForActiveConnection?: boolean;
}

/**
 * Current printer connection state
 */
export interface PrinterConnectionState {
  readonly isConnected: boolean;
  readonly printerName?: string;
  readonly ipAddress?: string;
  readonly clientType?: PrinterClientType;
  readonly isPrinting?: boolean;
  readonly lastConnected?: Date;
}

/**
 * Utility function type for determining 5M family printers
 * Based on typeName from printer API response
 */
export type PrinterFamilyDetector = (typeName: string) => PrinterFamilyInfo;

/**
 * Branded type for printer validation
 */
export type ValidatedPrinterDetails = PrinterDetails & { 
  readonly __validated: true;
};

/**
 * Extended printer details with metadata for multi-printer storage
 * Extends PrinterDetails with timestamp for sorting/display
 */
export interface StoredPrinterDetails extends PrinterDetails {
  readonly lastConnected: string; // ISO date string
}

/**
 * Multi-printer configuration structure for printer_details.json
 * Top-level structure supporting multiple saved printers
 */
export interface MultiPrinterConfig {
  readonly lastUsedPrinterSerial: string | null;
  readonly printers: Record<string, StoredPrinterDetails>; // key = serial number
}

/**
 * Result of matching discovered printers with saved printers
 * Used during auto-connect discovery phase
 * discoveredPrinter can be null for offline/unavailable saved printers
 */
export interface SavedPrinterMatch {
  readonly savedDetails: StoredPrinterDetails;
  readonly discoveredPrinter: DiscoveredPrinter | null;
  readonly ipAddressChanged: boolean;
}

/**
 * User's choice for auto-connect when multiple printers are available
 * Result of printer selection dialog
 */
export interface AutoConnectChoice {
  readonly selectedSerial: string;
  readonly printerDetails: StoredPrinterDetails;
}

/**
 * Auto-connect decision result based on available printers
 * Used by AutoConnectService to determine connection strategy
 */
export interface AutoConnectDecision {
  readonly action: 'none' | 'connect' | 'select';
  readonly reason?: string;
  readonly selectedMatch?: SavedPrinterMatch;
  readonly matches?: SavedPrinterMatch[];
}
