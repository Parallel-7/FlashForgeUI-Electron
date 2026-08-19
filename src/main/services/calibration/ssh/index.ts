/**
 * @fileoverview Exports for the SSH module.
 * Provides SSH connectivity and file transfer functionality for remote printer access.
 */

export { DEFAULT_REMOTE_PATHS, SCPFileTransfer } from './SCPFileTransfer';
export type { CommandResult, SSHConnection, SSHConnectionManagerEvents } from './SSHConnectionManager';
export {
  getSSHConnectionManager,
  SSHConnectionManager,
} from './SSHConnectionManager';
