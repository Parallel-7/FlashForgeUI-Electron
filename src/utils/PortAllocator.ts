/**
 * @fileoverview Port allocation utility for managing port ranges in multi-context scenarios.
 *
 * This utility manages the allocation and deallocation of ports within a specified range,
 * ensuring that each context gets a unique port for services like camera proxy servers.
 * Used by CameraProxyService to manage multiple camera streams across different printer contexts.
 *
 * Key features:
 * - Sequential port allocation within a range
 * - Automatic tracking of allocated ports
 * - Port release and reuse
 * - Exhaustion detection with error handling
 *
 * @example
 * const allocator = new PortAllocator(8181, 8191);
 * const port1 = allocator.allocatePort(); // 8181
 * const port2 = allocator.allocatePort(); // 8182
 * allocator.releasePort(port1);
 * const port3 = allocator.allocatePort(); // 8181 (reused)
 */

// ============================================================================
// PORT ALLOCATOR CLASS
// ============================================================================

/**
 * Manages allocation of ports within a specified range.
 *
 * This class maintains a pool of available ports and ensures that each
 * allocation returns a unique port that hasn't been previously allocated
 * (unless it has been released).
 */
export class PortAllocator {
  /** Set of currently allocated ports */
  private readonly allocatedPorts = new Set<number>();

  /** Current position in the port range for sequential allocation */
  private currentPort: number;

  /**
   * Creates a new port allocator.
   *
   * @param startPort - First port in the allocation range (inclusive)
   * @param endPort - Last port in the allocation range (inclusive)
   * @throws {Error} If startPort is greater than endPort or if range is invalid
   */
  constructor(
    private readonly startPort: number,
    private readonly endPort: number
  ) {
    if (startPort > endPort) {
      throw new Error(
        `Invalid port range: startPort (${startPort}) must be less than or equal to endPort (${endPort})`
      );
    }

    if (startPort < 1 || startPort > 65535 || endPort < 1 || endPort > 65535) {
      throw new Error(
        `Port numbers must be in range 1-65535. Got startPort=${startPort}, endPort=${endPort}`
      );
    }

    this.currentPort = startPort;
  }

  /**
   * Allocates the next available port in the range.
   *
   * Searches sequentially from the current position for an unallocated port.
   * If the end of the range is reached, wraps around to the start and continues
   * searching. Returns the first available port found.
   *
   * @returns The allocated port number
   * @throws {Error} If no ports are available in the range (all ports allocated)
   *
   * @example
   * const port = allocator.allocatePort();
   * console.log(`Allocated port: ${port}`);
   */
  public allocatePort(): number {
    const rangeSize = this.endPort - this.startPort + 1;
    let attempts = 0;

    // Search for available port, wrapping around if needed
    while (attempts < rangeSize) {
      if (!this.allocatedPorts.has(this.currentPort)) {
        const allocatedPort = this.currentPort;
        this.allocatedPorts.add(allocatedPort);

        // Move to next port for next allocation
        this.currentPort++;
        if (this.currentPort > this.endPort) {
          this.currentPort = this.startPort;
        }

        return allocatedPort;
      }

      // Port is allocated, try next
      this.currentPort++;
      if (this.currentPort > this.endPort) {
        this.currentPort = this.startPort;
      }

      attempts++;
    }

    // No ports available in the entire range
    throw new Error(
      `No available ports in range ${this.startPort}-${this.endPort}. ` +
      `All ${rangeSize} ports are currently allocated.`
    );
  }

  /**
   * Releases a previously allocated port, making it available for reuse.
   *
   * @param port - The port number to release
   * @returns true if the port was allocated and has been released, false if it wasn't allocated
   *
   * @example
   * const port = allocator.allocatePort();
   * // ... use port ...
   * allocator.releasePort(port); // Port is now available for reuse
   */
  public releasePort(port: number): boolean {
    return this.allocatedPorts.delete(port);
  }

  /**
   * Checks if a specific port is currently allocated.
   *
   * @param port - The port number to check
   * @returns true if the port is allocated, false otherwise
   *
   * @example
   * if (allocator.isPortAllocated(8181)) {
   *   console.log('Port 8181 is in use');
   * }
   */
  public isPortAllocated(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  /**
   * Gets the number of currently allocated ports.
   *
   * @returns The count of allocated ports
   *
   * @example
   * console.log(`${allocator.getAllocatedCount()} ports in use`);
   */
  public getAllocatedCount(): number {
    return this.allocatedPorts.size;
  }

  /**
   * Gets the number of available ports in the range.
   *
   * @returns The count of available (non-allocated) ports
   *
   * @example
   * console.log(`${allocator.getAvailableCount()} ports available`);
   */
  public getAvailableCount(): number {
    const rangeSize = this.endPort - this.startPort + 1;
    return rangeSize - this.allocatedPorts.size;
  }

  /**
   * Gets a list of all currently allocated ports.
   *
   * @returns Array of allocated port numbers in ascending order
   *
   * @example
   * const ports = allocator.getAllocatedPorts();
   * console.log(`Allocated ports: ${ports.join(', ')}`);
   */
  public getAllocatedPorts(): number[] {
    return Array.from(this.allocatedPorts).sort((a, b) => a - b);
  }

  /**
   * Releases all allocated ports, resetting the allocator to its initial state.
   *
   * @example
   * allocator.reset(); // All ports are now available
   */
  public reset(): void {
    this.allocatedPorts.clear();
    this.currentPort = this.startPort;
  }

  /**
   * Gets information about the port allocator's current state.
   *
   * @returns Object containing allocator state information
   *
   * @example
   * const info = allocator.getInfo();
   * console.log(`Port range: ${info.startPort}-${info.endPort}`);
   * console.log(`Allocated: ${info.allocatedCount}/${info.totalPorts}`);
   */
  public getInfo(): {
    startPort: number;
    endPort: number;
    totalPorts: number;
    allocatedCount: number;
    availableCount: number;
    allocatedPorts: number[];
  } {
    const totalPorts = this.endPort - this.startPort + 1;

    return {
      startPort: this.startPort,
      endPort: this.endPort,
      totalPorts,
      allocatedCount: this.allocatedPorts.size,
      availableCount: totalPorts - this.allocatedPorts.size,
      allocatedPorts: this.getAllocatedPorts()
    };
  }
}
