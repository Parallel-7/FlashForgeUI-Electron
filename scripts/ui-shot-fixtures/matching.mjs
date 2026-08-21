/**
 * @fileoverview ui-shot fixture: the material matching modal mid-mapping.
 *
 * Two tools mapped to two slots, one of them with a colour mismatch, so the
 * warning card at the top of the dialog is populated.
 */

export default async function apply(page) {
  await page.evaluate(() => {
    const byId = (id) => document.getElementById(id);
    byId('material-matching-modal').classList.remove('hidden');
    byId('material-matching-title').textContent = 'Match Materials – 3DBenchy_multicolor.3mf';

    const tools = [
      { id: 0, material: 'PLA', color: '#26A69A', slot: 2 },
      { id: 1, material: 'PETG', color: '#E8C62D', slot: 4 },
    ];
    const slots = [
      { id: 1, material: 'PLA', color: '#2D6EE8', empty: false, assigned: false },
      { id: 2, material: 'PLA', color: '#F72224', empty: false, assigned: true },
      { id: 3, material: null, color: null, empty: true, assigned: false },
      { id: 4, material: 'PETG', color: '#E8C62D', empty: false, assigned: true },
    ];

    const requirements = byId('material-job-requirements');
    requirements.textContent = '';
    tools.forEach((tool) => {
      const item = document.createElement('div');
      item.className = 'material-tool-item mapped';
      item.dataset.toolId = String(tool.id);

      const header = document.createElement('div');
      header.className = 'material-tool-header';
      const label = document.createElement('span');
      label.className = 'material-tool-label';
      label.textContent = `Tool ${tool.id + 1}`;
      const color = document.createElement('span');
      color.className = 'material-tool-color';
      color.style.backgroundColor = tool.color;
      header.append(label, color);

      const details = document.createElement('div');
      details.className = 'material-tool-details';
      details.textContent = tool.material;
      const mapped = document.createElement('div');
      mapped.className = 'material-tool-mapping';
      mapped.textContent = `Mapped to Slot ${tool.slot}`;
      details.append(mapped);

      item.append(header, details);
      requirements.append(item);
    });

    const slotList = byId('material-slot-list');
    slotList.textContent = '';
    slots.forEach((slot) => {
      const item = document.createElement('div');
      item.className = 'material-slot-item';
      if (slot.empty) {
        item.classList.add('empty', 'disabled');
      }
      if (slot.assigned) {
        item.classList.add('assigned', 'disabled');
      }

      const swatch = document.createElement('span');
      swatch.className = 'material-slot-swatch';
      if (slot.color) {
        swatch.style.backgroundColor = slot.color;
      }

      const info = document.createElement('div');
      info.className = 'material-slot-info';
      const label = document.createElement('div');
      label.className = 'material-slot-label';
      label.textContent = `Slot ${slot.id}`;
      const material = document.createElement('div');
      material.className = 'material-slot-material';
      material.textContent = slot.empty ? 'Empty' : slot.material;
      info.append(label, material);

      item.append(swatch, info);
      slotList.append(item);
    });

    const mappings = byId('material-mappings');
    mappings.textContent = '';
    tools.forEach((tool, index) => {
      const item = document.createElement('div');
      item.className = index === 0 ? 'material-mapping-item warning' : 'material-mapping-item';

      const swatch = (color) => {
        const element = document.createElement('span');
        element.className = 'material-mapping-swatch';
        element.style.backgroundColor = color;
        return element;
      };

      const text = document.createElement('span');
      text.className = 'material-mapping-text';
      const arrow = document.createElement('span');
      arrow.className = 'material-mapping-arrow';
      arrow.textContent = '→';
      text.append(`Tool ${tool.id + 1} `, arrow, ` Slot ${tool.slot}`);

      const content = document.createElement('span');
      content.className = 'material-mapping-content';
      content.append(
        swatch(tool.color),
        text,
        swatch(slots.find((slot) => slot.id === tool.slot).color)
      );

      const remove = document.createElement('button');
      remove.className = 'material-mapping-remove';
      remove.type = 'button';
      remove.textContent = '×';

      item.append(content, remove);
      mappings.append(item);
    });

    const warningList = byId('material-matching-warning-list');
    warningList.textContent = '';
    const warning = document.createElement('div');
    warning.className = 'material-matching-warning-item';
    warning.textContent = 'Tool 1 expects #26A69A but Slot 2 has #F72224.';
    warningList.append(warning);
    byId('material-matching-warning').classList.remove('hidden');

    byId('material-matching-confirm').disabled = false;
  });
}
