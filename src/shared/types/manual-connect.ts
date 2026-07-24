/**
 * @fileoverview Shared contract for the manual printer-connection dialog.
 *
 * Manual connects can no longer rely on the legacy TCP probe to discover a modern
 * printer's identity: any printer whose model is known up front is typed from its
 * USB product ID and never probed. That means the user must supply the details the
 * broadcast would otherwise have carried — the model, the serial number and the
 * check code — which is what this dialog collects.
 *
 * Key exports:
 * - MANUAL_CONNECT_PRINTER_TYPES: the selectable printer types (dropdown source)
 * - ManualConnectPrinterType: union of the selectable type tokens
 * - ManualConnectResult: the payload the dialog resolves with
 * - isModernManualConnectType(): whether a selection requires serial + check code
 *
 * Consumed by the dialog renderer (option list + validation) and by the main
 * process (`ConnectionFlowManager.connectDirectlyToIP`), which maps the selected
 * type to a product ID hint so the connection flow skips the probe.
 */

/**
 * Selectable printer types, in dropdown order. `legacy` is the catch-all for
 * older TCP-only printers, which carry no product ID and are still TCP-probed.
 *
 * The `value` tokens mirror the standalone WebUI's printer-type dropdown so both
 * front-ends speak the same vocabulary.
 */
export const MANUAL_CONNECT_PRINTER_TYPES = [
  { value: 'adventurer-5m', label: 'Adventurer 5M' },
  { value: 'adventurer-5m-pro', label: 'Adventurer 5M Pro' },
  { value: 'ad5x', label: 'AD5X' },
  { value: 'creator-5', label: 'Creator 5' },
  { value: 'creator-5-pro', label: 'Creator 5 Pro' },
  { value: 'legacy', label: 'Legacy Printer (Old API)' },
] as const;

export type ManualConnectPrinterType = (typeof MANUAL_CONNECT_PRINTER_TYPES)[number]['value'];

/**
 * Result returned by the manual-connect dialog. `null` (rather than this object)
 * signals that the user cancelled.
 */
export interface ManualConnectResult {
  readonly ipAddress: string;
  readonly printerType: ManualConnectPrinterType;
  /** Required for modern models; omitted for legacy. */
  readonly serialNumber?: string;
  /** Required for modern models; omitted for legacy. */
  readonly checkCode?: string;
}

/**
 * Modern (new-API) selections authenticate with serial + check code and are typed
 * from their product ID. Only `legacy` falls back to the TCP probe.
 */
export const isModernManualConnectType = (type: ManualConnectPrinterType): boolean =>
  type !== 'legacy';
