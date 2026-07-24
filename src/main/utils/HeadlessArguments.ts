/**
 * @fileoverview CLI argument parser for headless mode
 *
 * Parses and validates command-line arguments for running FlashForgeUI in headless mode.
 * Supports single printer, multiple printers, last-used printer, and all saved printers.
 *
 * Examples:
 *   --headless --last-used
 *   --headless --all-saved-printers
 *   --headless --printers="192.168.1.100:new:12345678:SNMOMC1234567,192.168.1.101:legacy"
 *   --headless --printers="192.168.1.184:creator-5-pro:12345678:SNCRE51234567"
 *   --headless --webui-port=3001 --webui-password=mypassword
 *   --headless --debug --debug-network
 */

import type { PrinterClientType } from '@shared/types/printer.js';

/**
 * Debug CLI flags parsed from command-line arguments
 * These work in both desktop and headless modes
 */
export interface DebugFlags {
  /** Enable debug logging for this session */
  debug: boolean;
  /** Enable network-specific debug logging for this session */
  debugNetwork: boolean;
}

/**
 * Parse debug-related CLI arguments
 * Works for both headless and desktop modes
 *
 * @returns DebugFlags with parsed values
 */
export function parseDebugFlags(): DebugFlags {
  const args = process.argv;
  return {
    debug: args.includes('--debug'),
    debugNetwork: args.includes('--debug-network'),
  };
}

/**
 * Specification for a single printer connection in headless mode
 */
export interface PrinterSpec {
  ip: string;
  type: PrinterClientType;
  checkCode?: string;
  /**
   * USB product ID hint for HTTP-only models (Creator 5 series). Set when the
   * TYPE token is `creator-5` / `creator-5-pro` so the connection flow types the
   * printer from the ID and skips the legacy TCP probe these printers cannot
   * answer.
   */
  productId?: number;
  /**
   * Printer serial number. Modern printers authenticate with serial + check code.
   * Dual-API models can fall back to the serial reported by the TCP probe;
   * HTTP-only models cannot, so it is required for the Creator 5 series.
   */
  serialNumber?: string;
}

/**
 * Headless mode configuration parsed from CLI arguments
 */
export interface HeadlessConfig {
  enabled: boolean;
  mode: 'last-used' | 'all-saved' | 'explicit-printers';
  printers?: PrinterSpec[]; // For explicit printer specifications
  webUIPort?: number;
  webUIPassword?: string;
  /** Enable debug logging for this session */
  debug?: boolean;
  /** Enable network-specific debug logging for this session */
  debugNetwork?: boolean;
}

/**
 * Validation result for headless configuration
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Parse command-line arguments to extract headless configuration
 *
 * @returns HeadlessConfig if --headless flag present, null otherwise
 */
export function parseHeadlessArguments(): HeadlessConfig | null {
  const args = process.argv;

  // Check if headless mode is enabled
  if (!args.includes('--headless')) {
    return null;
  }

  // Determine mode
  const hasLastUsed = args.includes('--last-used');
  const hasAllSaved = args.includes('--all-saved-printers');
  const printersArg = args.find((arg) => arg.startsWith('--printers='));

  let mode: HeadlessConfig['mode'];
  let printers: PrinterSpec[] | undefined;

  if (hasLastUsed) {
    mode = 'last-used';
  } else if (hasAllSaved) {
    mode = 'all-saved';
  } else if (printersArg) {
    mode = 'explicit-printers';
    printers = parsePrintersArgument(printersArg);
  } else {
    // Default to last-used if no mode specified
    mode = 'last-used';
  }

  // Parse optional overrides
  const webUIPort = parseNumberArgument(args, '--webui-port');
  const webUIPassword = parseStringArgument(args, '--webui-password');

  // Parse debug flags
  const debug = args.includes('--debug');
  const debugNetwork = args.includes('--debug-network');

  return {
    enabled: true,
    mode,
    printers,
    webUIPort,
    webUIPassword,
    debug,
    debugNetwork,
  };
}

/**
 * Parse --printers argument into array of PrinterSpec
 *
 * Format: --printers="IP:TYPE[:CHECKCODE[:SERIAL]],..."
 * e.g. --printers="192.168.1.100:new:12345678:SNMOMC1234567,192.168.1.101:legacy"
 *
 * TYPE is `new`, `legacy`, `creator-5`, or `creator-5-pro`. The Creator tokens
 * mark HTTP-only printers so the connection flow skips the legacy TCP probe.
 *
 * @param arg The --printers= argument string
 * @returns Array of PrinterSpec objects
 */
function parsePrintersArgument(arg: string): PrinterSpec[] {
  const value = arg.split('=')[1];
  if (!value) {
    return [];
  }

  // Remove quotes if present
  const cleanValue = value.replace(/^["']|["']$/g, '');

  // Split by comma to get individual printer specs
  const printerStrings = cleanValue.split(',');

  const specs: PrinterSpec[] = [];

  for (const printerStr of printerStrings) {
    const parts = printerStr.trim().split(':');
    if (parts.length < 2) {
      continue;
    }

    const [ip, typeStr, checkCode, serialNumber] = parts;
    // The Creator 5 series is HTTP-only (no legacy TCP server), so the type token
    // also carries the model for those printers. All other non-"new" tokens fall
    // back to legacy, matching historical behavior.
    const normalizedType = typeStr.trim().toLowerCase();
    const isCreator = normalizedType === 'creator-5' || normalizedType === 'creator-5-pro';
    const type: PrinterClientType = normalizedType === 'new' || isCreator ? 'new' : 'legacy';
    const productId = isCreator ? (normalizedType === 'creator-5' ? 40 : 41) : undefined;

    specs.push({
      ip: ip.trim(),
      type,
      checkCode: checkCode?.trim(),
      productId,
      serialNumber: serialNumber?.trim() || undefined,
    });
  }

  return specs;
}

/**
 * Parse a number argument from command-line args
 *
 * @param args Process argv array
 * @param flag Flag to search for (e.g., '--webui-port')
 * @returns Parsed number or undefined
 */
function parseNumberArgument(args: string[], flag: string): number | undefined {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  if (!arg) {
    return undefined;
  }

  const value = arg.split('=')[1];
  const parsed = parseInt(value, 10);

  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse a string argument from command-line args
 *
 * @param args Process argv array
 * @param flag Flag to search for (e.g., '--webui-password')
 * @returns Parsed string or undefined
 */
function parseStringArgument(args: string[], flag: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  if (!arg) {
    return undefined;
  }

  const value = arg.split('=')[1];
  // Remove quotes if present
  return value?.replace(/^["']|["']$/g, '');
}

/**
 * Validate headless configuration
 *
 * @param config HeadlessConfig to validate
 * @returns ValidationResult with errors if any
 */
export function validateHeadlessConfig(config: HeadlessConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.enabled) {
    errors.push('Headless mode not enabled');
    return { valid: false, errors };
  }

  // Validate mode-specific requirements
  if (config.mode === 'explicit-printers') {
    if (!config.printers || config.printers.length === 0) {
      errors.push('No printers specified for explicit-printers mode');
    } else {
      // Validate each printer spec
      config.printers.forEach((printer, index) => {
        if (!printer.ip) {
          errors.push(`Printer ${index + 1}: Missing IP address`);
        }
        if (!printer.type) {
          errors.push(`Printer ${index + 1}: Missing printer type`);
        }
        if (printer.type === 'new' && !printer.checkCode) {
          errors.push(`Printer ${index + 1}: New printer type requires check code`);
        }
        // HTTP-only models (Creator 5 series) can't be probed over TCP for their
        // serial, so it must be supplied. Dual-API models fall back to the probe's
        // serial, so it stays optional there for compatibility.
        if (printer.productId !== undefined && !printer.serialNumber) {
          errors.push(
            `Printer ${index + 1}: Creator 5 series requires a serial number ` +
              `(format IP:TYPE:CHECKCODE:SERIAL)`
          );
        }
      });
    }
  }

  // Validate optional overrides
  if (config.webUIPort !== undefined) {
    if (config.webUIPort < 1 || config.webUIPort > 65535) {
      errors.push('WebUI port must be between 1 and 65535');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
