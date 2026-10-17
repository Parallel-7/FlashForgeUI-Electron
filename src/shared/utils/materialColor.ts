/**
 * @fileoverview Normalizes material colors before they are sent to a printer.
 *
 * The AD5X reports a slot's color as a raw config string - the API docs describe
 * `MatlSlotInfo.materialColor` as the "color string before first ';' in config" - so it
 * arrives with no format guarantee and frequently without a leading '#'. The Creator 5
 * documents the same field as a proper '#RRGGBB' value.
 *
 * `@ghosttypes/ff-api` validates every outbound MaterialMapping color against
 * /^#[0-9A-Fa-f]{6}$/ and refuses to send the request if any color fails, so forwarding
 * a printer-supplied color verbatim can abort an upload before it reaches the network.
 * Normalizing here keeps the mapping payload in the documented '#RRGGBB' form for both
 * printer families without needing the library to relax its check.
 *
 * Key exports:
 * - normalizeMaterialColor(): one color to '#RRGGBB'
 * - normalizeMaterialMappingColors(): a whole mapping array
 */

/** Used when a color is missing or unparseable, matching the material dialog's default. */
export const DEFAULT_MATERIAL_COLOR = '#808080';

/**
 * Coerces a color to '#RRGGBB'.
 *
 * Accepts values with or without a leading '#', and tolerates the trailing
 * config data the AD5X sometimes carries (for example "161616;PLA"). Anything that
 * still does not resolve to six hex digits falls back to `fallback` rather than being
 * passed through, since an invalid color would fail validation downstream anyway.
 */
export function normalizeMaterialColor(value: string | undefined | null, fallback = DEFAULT_MATERIAL_COLOR): string {
  const raw = (value ?? '').trim();
  if (raw.length === 0) {
    return fallback;
  }

  const hex = raw.split(';')[0].trim().replace(/^#/, '');
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : fallback;
}

/** The color fields carried by an AD5X / Creator 5 material mapping. */
interface MaterialMappingColors {
  toolMaterialColor: string;
  slotMaterialColor: string;
}

/**
 * Returns a copy of `mappings` with both color fields normalized.
 * Non-color fields are preserved untouched.
 */
export function normalizeMaterialMappingColors<T extends MaterialMappingColors>(mappings: readonly T[]): T[] {
  return mappings.map((mapping) => ({
    ...mapping,
    toolMaterialColor: normalizeMaterialColor(mapping.toolMaterialColor),
    slotMaterialColor: normalizeMaterialColor(mapping.slotMaterialColor),
  }));
}
