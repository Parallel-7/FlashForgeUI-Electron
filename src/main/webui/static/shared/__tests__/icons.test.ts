/**
 * @fileoverview Jest coverage for shared WebUI Lucide icon helpers.
 *
 * Tests icon-name normalization, selective hydration from the global Lucide
 * registry, and initialization of the default icon set expected by WebUI
 * dialogs and controls.
 */
/**
 * @fileoverview JSDOM tests for shared WebUI icon helpers that translate data-lucide
 * markup into hydrated Lucide SVG icons.
 */

/**
 * @jest-environment jsdom
 */

import { hydrateLucideIcons, initializeLucideIcons, toPascalCase } from '../icons.js';

describe('webui shared icons', () => {
  const createIcons = jest.fn();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    createIcons.mockReset();
    consoleWarnSpy.mockClear();
    window.lucide = {
      createIcons,
      icons: {
        Settings: [['path', {}]],
        Lock: [['path', {}]],
        Package: [['path', {}]],
        Search: [['path', {}]],
        Circle: [['path', {}]],
        Plus: [['path', {}]],
      },
    };
    document.body.innerHTML = '<div id="root"><i data-lucide="plus"></i></div>';
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  it('converts icon names to PascalCase', () => {
    expect(toPascalCase('circle-alert')).toBe('CircleAlert');
    expect(toPascalCase('plus')).toBe('Plus');
  });

  it('hydrates available icons and warns for missing ones', () => {
    hydrateLucideIcons(['plus', 'missing-icon'], document.getElementById('root')!);

    expect(createIcons).toHaveBeenCalledWith(
      expect.objectContaining({
        icons: expect.objectContaining({
          Plus: [['path', {}]],
        }),
      })
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith('[WebUI] Lucide icon "missing-icon" not available in global registry.');
  });

  it('initializes the default icon set including the plus icon used in settings', () => {
    initializeLucideIcons();

    expect(createIcons).toHaveBeenCalledWith(
      expect.objectContaining({
        icons: expect.objectContaining({
          Plus: [['path', {}]],
        }),
      })
    );
  });
});
