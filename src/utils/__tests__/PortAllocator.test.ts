/**
 * @fileoverview Tests for PortAllocator utility
 */

import { PortAllocator } from '../PortAllocator';

describe('PortAllocator', () => {
  describe('constructor', () => {
    it('should create allocator with valid range', () => {
      const allocator = new PortAllocator(8181, 8191);
      expect(allocator).toBeDefined();
      const info = allocator.getInfo();
      expect(info.startPort).toBe(8181);
      expect(info.endPort).toBe(8191);
      expect(info.totalPorts).toBe(11);
    });

    it('should throw error if startPort > endPort', () => {
      expect(() => new PortAllocator(8191, 8181)).toThrow('Invalid port range');
    });

    it('should throw error if ports are out of valid range', () => {
      expect(() => new PortAllocator(0, 100)).toThrow('Port numbers must be in range 1-65535');
      expect(() => new PortAllocator(100, 70000)).toThrow('Port numbers must be in range 1-65535');
    });
  });

  describe('allocatePort', () => {
    it('should allocate ports sequentially', () => {
      const allocator = new PortAllocator(8181, 8191);

      const port1 = allocator.allocatePort();
      const port2 = allocator.allocatePort();
      const port3 = allocator.allocatePort();

      expect(port1).toBe(8181);
      expect(port2).toBe(8182);
      expect(port3).toBe(8183);
    });

    it('should throw error when all ports are allocated', () => {
      const allocator = new PortAllocator(8181, 8183); // Only 3 ports

      allocator.allocatePort(); // 8181
      allocator.allocatePort(); // 8182
      allocator.allocatePort(); // 8183

      expect(() => allocator.allocatePort()).toThrow('No available ports in range');
    });

    it('should reuse released ports', () => {
      const allocator = new PortAllocator(8181, 8191);

      const port1 = allocator.allocatePort(); // 8181
      const port2 = allocator.allocatePort(); // 8182

      allocator.releasePort(port1);

      const port3 = allocator.allocatePort(); // Should get 8183 (next in sequence)
      const port4 = allocator.allocatePort(); // Should get 8184

      // After wrapping around, should reuse 8181
      expect(port3).toBe(8183);
      expect(port4).toBe(8184);
    });

    it('should wrap around to find available ports', () => {
      const allocator = new PortAllocator(8181, 8183);

      const port1 = allocator.allocatePort(); // 8181
      const port2 = allocator.allocatePort(); // 8182
      allocator.releasePort(port1); // Release 8181

      const port3 = allocator.allocatePort(); // 8183
      const port4 = allocator.allocatePort(); // Should wrap around and get 8181

      expect(port4).toBe(8181);
    });
  });

  describe('releasePort', () => {
    it('should release allocated port', () => {
      const allocator = new PortAllocator(8181, 8191);

      const port = allocator.allocatePort();
      expect(allocator.isPortAllocated(port)).toBe(true);

      const released = allocator.releasePort(port);
      expect(released).toBe(true);
      expect(allocator.isPortAllocated(port)).toBe(false);
    });

    it('should return false for non-allocated port', () => {
      const allocator = new PortAllocator(8181, 8191);

      const released = allocator.releasePort(8185);
      expect(released).toBe(false);
    });
  });

  describe('isPortAllocated', () => {
    it('should return true for allocated port', () => {
      const allocator = new PortAllocator(8181, 8191);

      const port = allocator.allocatePort();
      expect(allocator.isPortAllocated(port)).toBe(true);
    });

    it('should return false for non-allocated port', () => {
      const allocator = new PortAllocator(8181, 8191);

      expect(allocator.isPortAllocated(8185)).toBe(false);
    });
  });

  describe('getAllocatedCount', () => {
    it('should return correct count of allocated ports', () => {
      const allocator = new PortAllocator(8181, 8191);

      expect(allocator.getAllocatedCount()).toBe(0);

      allocator.allocatePort();
      expect(allocator.getAllocatedCount()).toBe(1);

      allocator.allocatePort();
      allocator.allocatePort();
      expect(allocator.getAllocatedCount()).toBe(3);
    });
  });

  describe('getAvailableCount', () => {
    it('should return correct count of available ports', () => {
      const allocator = new PortAllocator(8181, 8185); // 5 ports total

      expect(allocator.getAvailableCount()).toBe(5);

      allocator.allocatePort();
      expect(allocator.getAvailableCount()).toBe(4);

      allocator.allocatePort();
      allocator.allocatePort();
      expect(allocator.getAvailableCount()).toBe(2);
    });
  });

  describe('getAllocatedPorts', () => {
    it('should return sorted list of allocated ports', () => {
      const allocator = new PortAllocator(8181, 8191);

      allocator.allocatePort(); // 8181
      allocator.allocatePort(); // 8182
      allocator.allocatePort(); // 8183

      const ports = allocator.getAllocatedPorts();
      expect(ports).toEqual([8181, 8182, 8183]);
    });

    it('should return empty array when no ports allocated', () => {
      const allocator = new PortAllocator(8181, 8191);

      const ports = allocator.getAllocatedPorts();
      expect(ports).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should release all allocated ports and reset state', () => {
      const allocator = new PortAllocator(8181, 8191);

      allocator.allocatePort();
      allocator.allocatePort();
      allocator.allocatePort();

      expect(allocator.getAllocatedCount()).toBe(3);

      allocator.reset();

      expect(allocator.getAllocatedCount()).toBe(0);
      expect(allocator.getAvailableCount()).toBe(11);

      // Should allocate from start again
      const port = allocator.allocatePort();
      expect(port).toBe(8181);
    });
  });

  describe('getInfo', () => {
    it('should return comprehensive allocator state', () => {
      const allocator = new PortAllocator(8181, 8185);

      allocator.allocatePort(); // 8181
      allocator.allocatePort(); // 8182

      const info = allocator.getInfo();

      expect(info).toEqual({
        startPort: 8181,
        endPort: 8185,
        totalPorts: 5,
        allocatedCount: 2,
        availableCount: 3,
        allocatedPorts: [8181, 8182]
      });
    });
  });

  describe('real-world scenario', () => {
    it('should handle multiple camera proxy ports for printer contexts', () => {
      // Simulate camera proxy service using port allocator
      const allocator = new PortAllocator(8181, 8191);
      const contextPorts = new Map<string, number>();

      // Context 1: Allocate port for first printer
      const context1Port = allocator.allocatePort();
      contextPorts.set('context-1', context1Port);
      expect(context1Port).toBe(8181);

      // Context 2: Allocate port for second printer
      const context2Port = allocator.allocatePort();
      contextPorts.set('context-2', context2Port);
      expect(context2Port).toBe(8182);

      // Context 3: Allocate port for third printer
      const context3Port = allocator.allocatePort();
      contextPorts.set('context-3', context3Port);
      expect(context3Port).toBe(8183);

      // Remove context 1 and release its port
      const releasedPort = contextPorts.get('context-1');
      if (releasedPort) {
        allocator.releasePort(releasedPort);
        contextPorts.delete('context-1');
      }

      // Context 4: Should be able to allocate a port
      const context4Port = allocator.allocatePort();
      contextPorts.set('context-4', context4Port);

      // Verify state
      expect(allocator.getAllocatedCount()).toBe(3);
      expect(contextPorts.size).toBe(3);
      expect(contextPorts.has('context-1')).toBe(false);
      expect(contextPorts.has('context-2')).toBe(true);
      expect(contextPorts.has('context-3')).toBe(true);
      expect(contextPorts.has('context-4')).toBe(true);
    });
  });
});
