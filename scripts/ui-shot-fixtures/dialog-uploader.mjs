/**
 * @fileoverview ui-shot fixture: the Upload Job dialog with a fully parsed 3MF.
 *
 * Fills in a file selection, confirmed material mappings, slicer warnings and
 * metadata, so the dialog is in the busiest state it can reach.
 */

export default async function apply(page) {
  await page.evaluate(() => {
    const byId = (id) => document.getElementById(id);
    byId('file-path-display').textContent = 'OrcaSlicer-2.4.0-alpha-3DBenchy_PLA_37m22s.gcode.3mf';

    const swatch = (color) => {
      const element = document.createElement('span');
      element.className = 'mapping-chip-swatch';
      element.style.backgroundColor = color;
      return element;
    };
    const text = (className, value) => {
      const element = document.createElement('span');
      element.className = className;
      element.textContent = value;
      return element;
    };
    const chip = (tool, slot, toolColor, slotColor, material) => {
      const element = document.createElement('div');
      element.className = 'mapping-chip';
      element.append(
        swatch(toolColor),
        text('mapping-chip-label', `Tool ${tool}`),
        text('mapping-chip-arrow', '→'),
        swatch(slotColor),
        text('mapping-chip-label', `Slot ${slot}`),
        text('mapping-chip-material', material)
      );
      return element;
    };

    byId('mapping-summary-list').append(
      chip(1, 2, '#26A69A', '#F72224', 'PLA'),
      chip(2, 4, '#E8C62D', '#2D6EE8', 'PETG')
    );
    byId('mapping-summary').style.display = 'block';

    const warnings = byId('meta-warnings');
    warnings.textContent = '';
    [
      'The current hot bed temperature is relatively high. The nozzle may be clogged.',
      'Supports are disabled but overhangs were detected.',
    ].forEach((message) => {
      const item = document.createElement('div');
      item.className = 'warning-item';
      const icon = document.createElement('span');
      icon.className = 'warning-icon level-warning';
      icon.textContent = '⚠';
      const body = document.createElement('span');
      body.className = 'warning-msg';
      body.textContent = message;
      item.append(icon, body);
      warnings.append(item);
    });
    byId('warnings-container').style.display = 'block';

    const metadata = {
      'meta-printer': 'Flashforge Adventurer 5M Pro',
      'meta-filament-type': 'PLA',
      'meta-filament-len': '3.77 m • 11.23 g',
      'meta-slicer-name': 'OrcaSlicer',
      'meta-slicer-ver': '2.4.0-alpha',
      'meta-slice-date': '2026-05-30',
      'meta-slice-time': '3:58 PM',
      'meta-eta': '37m22s',
      'meta-first-layer-time': '1m 1s',
      'meta-layer-height': '0.2 mm',
      'meta-infill': '15%',
      'meta-layers': '240',
      'meta-support': 'No',
    };
    Object.entries(metadata).forEach(([id, value]) => {
      const element = byId(id);
      if (element) {
        element.textContent = value;
      }
    });

    const thumbnail = byId('meta-thumbnail');
    thumbnail.textContent = '';
    const preview = document.createElement('div');
    preview.style.cssText = 'width:100%;height:100%;background:linear-gradient(135deg,#0f6b5c,#26A69A)';
    thumbnail.append(preview);

    byId('btn-ok').disabled = false;
  });
}
