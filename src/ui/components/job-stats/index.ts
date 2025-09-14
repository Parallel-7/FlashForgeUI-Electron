/**
 * @fileoverview Job Statistics Component Barrel Export
 * 
 * This file provides a clean barrel export interface for the Job Statistics
 * component, allowing other parts of the application to import the component
 * and its related types through a single import statement.
 * 
 * Usage:
 * ```typescript
 * import { JobStatsComponent } from '../components/job-stats';
 * 
 * const jobStats = new JobStatsComponent(containerElement);
 * await jobStats.initialize();
 * ```
 */

// Export the main component class
export { JobStatsComponent } from './job-stats';

// Note: This component doesn't export additional types or interfaces
// as it uses the standard component interfaces from the base system.