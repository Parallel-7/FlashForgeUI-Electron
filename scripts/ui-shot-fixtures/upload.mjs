/**
 * @fileoverview ui-shot fixture: the Upload Job dialog with a fully parsed 3MF.
 *
 * Fills in a file selection, confirmed material mappings, slicer warnings and
 * metadata, so the dialog is in the busiest state it can reach.
 */

export default async function apply(page) {
  await page.evaluate(() => {
    const byId = (id) => document.getElementById(id);
    byId('job-upload-modal').classList.remove('hidden');
    byId('job-upload-file-path').textContent = 'OrcaSlicer-2.4.0-alpha-3DBenchy_PLA_37m22s.gcode.3mf';

    const swatch = (color) => {
      const element = document.createElement('span');
      element.className = 'job-upload-mapping-swatch';
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
      element.className = 'job-upload-mapping-chip';
      element.append(
        swatch(toolColor),
        text('job-upload-mapping-label', `Tool ${tool}`),
        text('job-upload-mapping-arrow', '→'),
        swatch(slotColor),
        text('job-upload-mapping-label', `Slot ${slot}`),
        text('job-upload-mapping-material', material)
      );
      return element;
    };

    byId('job-upload-mappings-list').append(
      chip(1, 2, '#26A69A', '#F72224', 'PLA'),
      chip(2, 4, '#E8C62D', '#2D6EE8', 'PETG')
    );
    byId('job-upload-mappings').classList.remove('hidden');

    const warnings = byId('job-upload-meta-warnings');
    warnings.textContent = '';
    [
      'The current hot bed temperature is relatively high. The nozzle may be clogged.',
      'Supports are disabled but overhangs were detected.',
    ].forEach((message) => {
      const item = document.createElement('div');
      item.className = 'job-upload-warning-item';
      const icon = document.createElement('span');
      icon.className = 'job-upload-warning-icon level-warning';
      icon.textContent = '⚠';
      const body = document.createElement('span');
      body.className = 'job-upload-warning-msg';
      body.textContent = message;
      item.append(icon, body);
      warnings.append(item);
    });
    byId('job-upload-warnings-container').classList.remove('hidden');

    const metadata = {
      'job-upload-meta-printer': 'Flashforge Adventurer 5M Pro',
      'job-upload-meta-filament-type': 'PLA',
      'job-upload-meta-filament-len': '3.77 m • 11.23 g',
      'job-upload-meta-slicer-name': 'OrcaSlicer',
      'job-upload-meta-slicer-ver': '2.4.0-alpha',
      'job-upload-meta-slice-date': '2026-05-30',
      'job-upload-meta-slice-time': '3:58 PM',
      'job-upload-meta-eta': '37m22s',
      'job-upload-meta-first-layer-time': '1m 1s',
      'job-upload-meta-layer-height': '0.2 mm',
      'job-upload-meta-infill': '15%',
      'job-upload-meta-layers': '240',
      'job-upload-meta-support': 'No',
    };
    Object.entries(metadata).forEach(([id, value]) => {
      const element = byId(id);
      if (element) {
        element.textContent = value;
      }
    });

    const thumbnail = byId('job-upload-thumbnail');
    thumbnail.textContent = '';
    const preview = document.createElement('div');
    preview.style.cssText = 'width:100%;height:100%;background:linear-gradient(135deg,#0f6b5c,#26A69A)';
    thumbnail.append(preview);

    byId('job-upload-ok').disabled = false;
  });
}
