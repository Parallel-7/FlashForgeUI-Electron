/**
 * @fileoverview Shared log panel view + controller for grid and dialog usage.
 *
 * Provides a reusable DOM layout and utility methods for rendering log entries,
 * managing placeholder state, auto-scrolling, and message counts. Both the
 * GridStack log widget and the pinned dialog reuse this module to guarantee a
 * consistent visual experience and identical data-handling semantics.
 */

import '../../shared/log-panel/log-panel.shared.css';

export interface LogEntry {
  readonly timestamp: string;
  readonly message: string;
}

export interface LogPanelOptions {
  /** Element that will receive the log panel DOM. */
  readonly mountPoint: HTMLElement;
  /** Optional panel title; defaults to 'Application Logs'. */
  readonly title?: string;
  /** Whether to render the header region. Defaults to true. */
  readonly showHeader?: boolean;
  /** Placeholder text shown when no entries are present. */
  readonly placeholder?: string;
  /** Auto-scrolls to newest entry whenever entries append. */
  readonly autoScroll?: boolean;
  /** Notify caller whenever the rendered entry count changes. */
  readonly onCountChanged?: (count: number) => void;
}

export interface LogPanelAppendOptions {
  /** Override auto-scroll behaviour for a single append. */
  readonly scroll?: boolean;
}

/**
 * LogPanelController encapsulates the shared log panel DOM and operations for
 * adding, clearing, and counting log entries.
 */
export class LogPanelController {
  private readonly root: HTMLElement;
  private readonly header?: HTMLElement;
  private readonly titleElement?: HTMLElement;
  private readonly output: HTMLElement;
  private readonly emptyState: HTMLElement;
  private readonly autoScroll: boolean;
  private readonly onCountChanged?: (count: number) => void;
  private entryCount = 0;

  constructor(
    root: HTMLElement,
    header: HTMLElement | undefined,
    titleElement: HTMLElement | undefined,
    output: HTMLElement,
    emptyState: HTMLElement,
    options: LogPanelOptions
  ) {
    this.root = root;
    this.header = header;
    this.titleElement = titleElement;
    this.output = output;
    this.emptyState = emptyState;
    this.autoScroll = options.autoScroll ?? true;
    this.onCountChanged = options.onCountChanged;

    if (this.titleElement && options.title) {
      this.titleElement.textContent = options.title;
    }
  }

  /**
   * Replace existing DOM with the provided entries.
   */
  public load(entries: LogEntry[], { scrollToLatest = true }: { scrollToLatest?: boolean } = {}): void {
    this.output.innerHTML = '';
    this.entryCount = 0;

    entries.forEach((entry) => {
      this.appendEntry(entry, { scroll: false });
    });

    this.updateState();

    if (scrollToLatest && this.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Append a fully formatted entry (timestamp already included).
   */
  public appendEntry(entry: LogEntry, options?: LogPanelAppendOptions): void {
    const messageElement = document.createElement('div');
    messageElement.textContent = `[${entry.timestamp}] ${entry.message}`;
    this.output.appendChild(messageElement);
    this.entryCount += 1;
    this.updateState();

    const shouldScroll = options?.scroll ?? this.autoScroll;
    if (shouldScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Append a raw message, automatically timestamping it.
   */
  public appendMessage(message: string, options?: LogPanelAppendOptions): void {
    const timestamp = new Date().toLocaleTimeString();
    this.appendEntry({ timestamp, message }, options);
  }

  /**
   * Clear the panel.
   */
  public clear(): void {
    this.output.innerHTML = '';
    this.entryCount = 0;
    this.updateState();
  }

  /**
   * Update panel title text.
   */
  public setTitle(title: string): void {
    if (this.titleElement) {
      this.titleElement.textContent = title;
    }
  }

  /**
   * Latest rendered entry count.
   */
  public getEntryCount(): number {
    return this.entryCount;
  }

  /**
   * Scroll to the newest message.
   */
  public scrollToBottom(): void {
    this.output.scrollTop = this.output.scrollHeight;
  }

  /**
   * Root DOM node for external class name adjustments if needed.
   */
  public getRootElement(): HTMLElement {
    return this.root;
  }

  /**
   * Perform minimal state cleanup.
   */
  public destroy(): void {
    this.output.innerHTML = '';
    this.entryCount = 0;
    this.updateState();
  }

  private updateState(): void {
    if (this.entryCount > 0) {
      this.root.classList.add('ff-log-panel--has-content');
    } else {
      this.root.classList.remove('ff-log-panel--has-content');
    }

    if (this.onCountChanged) {
      this.onCountChanged(this.entryCount);
    }
  }
}

/**
 * Create and mount a shared log panel to the provided container.
 */
export function createLogPanel(options: LogPanelOptions): LogPanelController {
  const {
    mountPoint,
    title = 'Application Logs',
    showHeader = true,
    placeholder = 'No log messages yet'
  } = options;

  const root = document.createElement('div');
  root.className = 'ff-log-panel';

  let headerElement: HTMLElement | undefined;
  let titleElement: HTMLElement | undefined;

  if (showHeader) {
    headerElement = document.createElement('div');
    headerElement.className = 'ff-log-panel__header';

    titleElement = document.createElement('span');
    titleElement.className = 'ff-log-panel__title';

    const iconElement = document.createElement('span');
    iconElement.className = 'ff-log-panel__title-icon';
    iconElement.textContent = '📝';

    titleElement.append(iconElement, document.createTextNode(title));
    headerElement.appendChild(titleElement);
    root.appendChild(headerElement);
  }

  const bodyElement = document.createElement('div');
  bodyElement.className = 'ff-log-panel__body';

  const emptyStateElement = document.createElement('div');
  emptyStateElement.className = 'ff-log-panel__empty';
  emptyStateElement.textContent = placeholder;

  const outputElement = document.createElement('div');
  outputElement.className = 'ff-log-panel__output';

  bodyElement.append(emptyStateElement, outputElement);
  root.appendChild(bodyElement);

  mountPoint.innerHTML = '';
  mountPoint.appendChild(root);

  const controller = new LogPanelController(
    root,
    headerElement,
    titleElement,
    outputElement,
    emptyStateElement,
    options
  );

  controller.clear();
  return controller;
}

/**
 * Coerce an unknown value to a typed log entry when possible.
 */
export function parseLogEntry(value: unknown): LogEntry | null {
  if (typeof value === 'string') {
    return { timestamp: new Date().toLocaleTimeString(), message: value };
    }

  if (
    typeof value === 'object' &&
    value !== null &&
    'timestamp' in value &&
    'message' in value &&
    typeof (value as { timestamp: unknown }).timestamp === 'string' &&
    typeof (value as { message: unknown }).message === 'string'
  ) {
    const entry = value as { timestamp: string; message: string };
    return { timestamp: entry.timestamp, message: entry.message };
  }

  return null;
}
