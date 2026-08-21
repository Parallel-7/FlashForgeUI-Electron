/**
 * @fileoverview ui-shot fixture: the material matching dialog mid-mapping.
 *
 * Two tools mapped to two slots, one of them with a colour mismatch, so the
 * warning card at the top of the dialog is populated.
 */

export default async function apply(page) {
  await page.evaluate(() => {
    const byId = (id) => document.getElementById(id);

    const tools = [
      { id: 0, material: 'PLA', weight: 11.2, color: '#26A69A', slot: 2 },
      { id: 1, material: 'PETG', weight: 4.8, color: '#E8C62D', slot: 4 },
    ];
    const slots = [
      { id: 1, material: 'PLA', color: '#2D6EE8', empty: false, assigned: false },
      { id: 2, material: 'PLA', color: '#F72224', empty: false, assigned: true },
      { id: 3, material: null, color: null, empty: true, assigned: false },
      { id: 4, material: 'PETG', color: '#E8C62D', empty: false, assigned: true },
    ];

    const requirements = byId('print-requirements');
    requirements.textContent = '';
    tools.forEach((tool) => {
      const item = document.createElement('div');
      item.className = 'requirement-item';

      const header = document.createElement('div');
      header.className = 'requirement-header';
      const label = document.createElement('div');
      label.className = 'tool-label';
      label.textContent = `Tool ${tool.id + 1}`;
      const swatch = document.createElement('div');
      swatch.className = 'material-swatch';
      swatch.style.backgroundColor = tool.color;
      header.append(label, swatch);

      const details = document.createElement('div');
      details.className = 'requirement-details';
      const material = document.createElement('div');
      material.textContent = `Material: ${tool.material}`;
      const weight = document.createElement('div');
      weight.textContent = `Weight: ${tool.weight.toFixed(1)}g`;
      details.append(material, weight);

      item.append(header, details);
      requirements.append(item);
    });

    const slotList = byId('ifs-slots');
    slotList.textContent = '';
    slots.forEach((slot) => {
      const item = document.createElement('div');
      item.className = 'slot-item';
      if (slot.empty) {
        item.classList.add('disabled');
      }
      if (slot.assigned) {
        item.classList.add('assigned');
      }

      const swatch = document.createElement('div');
      swatch.className = 'slot-swatch';
      swatch.style.backgroundColor = slot.color || 'var(--surface-muted)';

      const info = document.createElement('div');
      info.className = 'slot-info';
      const label = document.createElement('div');
      label.className = 'slot-label';
      label.textContent = `Slot ${slot.id}`;
      const material = document.createElement('div');
      material.className = slot.empty ? 'slot-empty' : 'slot-material';
      material.textContent = slot.empty ? 'Empty' : slot.material;
      info.append(label, material);

      item.append(swatch, info);
      slotList.append(item);
    });

    const mappings = byId('material-mappings');
    mappings.textContent = '';
    tools.forEach((tool, index) => {
      const item = document.createElement('div');
      item.className = 'mapping-item';
      if (index === 0) {
        item.classList.add('mapping-warning');
      }

      const content = document.createElement('div');
      content.className = 'mapping-content';
      const toolSwatch = document.createElement('div');
      toolSwatch.className = 'mapping-swatch';
      toolSwatch.style.backgroundColor = tool.color;
      const text = document.createElement('div');
      text.className = 'mapping-text';
      const arrow = document.createElement('span');
      arrow.className = 'mapping-arrow';
      arrow.textContent = '→';
      text.append(`Tool ${tool.id + 1} `, arrow, ` Slot ${tool.slot}`);
      const slotSwatch = document.createElement('div');
      slotSwatch.className = 'mapping-swatch';
      slotSwatch.style.backgroundColor = slots.find((slot) => slot.id === tool.slot).color;
      content.append(toolSwatch, text, slotSwatch);

      const remove = document.createElement('button');
      remove.className = 'remove-mapping';
      remove.textContent = '×';

      item.append(content, remove);
      mappings.append(item);
    });

    const warningList = byId('warning-message-list');
    warningList.textContent = '';
    const warning = document.createElement('div');
    warning.className = 'warning-card-item';
    warning.textContent = 'Tool 1 expects #26A69A but Slot 2 has #F72224.';
    warningList.append(warning);
    byId('warning-message').style.display = 'block';

    byId('btn-confirm').disabled = false;
  });
}
