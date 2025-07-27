// src/managers/ConfigManager.ts

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppConfig, MutableAppConfig, DEFAULT_CONFIG, ConfigUpdateEvent, sanitizeConfig, isValidConfig } from '../types/config';

/**
 * Centralized configuration manager with live access and automatic file syncing.
 * Provides type-safe configuration management with event-driven updates.
 * 
 * Features:
 * - Live in-memory configuration access
 * - Automatic file persistence on changes
 * - Event emission for configuration updates
 * - Thread-safe access through getters/setters
 * - Type safety with branded types and validation
 */
export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager | null = null;
  
  private readonly configPath: string;
  private readonly lockFilePath: string;
  private currentConfig: MutableAppConfig;
  private isLoading: boolean = false;
  private isSaving: boolean = false;
  private pendingSave: NodeJS.Timeout | null = null;
  
  private constructor() {
    super();
    
    // Determine config file location
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.lockFilePath = path.join(userDataPath, 'config.lock');
    
    // Initialize with defaults
    this.currentConfig = { ...DEFAULT_CONFIG };
    
    // Load existing configuration
    void this.loadFromFile().catch(error => {
      console.error('Failed to load initial configuration:', error);
    });
  }
  
  /**
   * Gets the singleton instance of ConfigManager
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  /**
   * Gets the complete current configuration (readonly)
   */
  public getConfig(): Readonly<AppConfig> {
    return Object.freeze({ ...this.currentConfig });
  }
  
  /**
   * Gets a specific configuration value by key
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.currentConfig[key];
  }
  
  /**
   * Sets a specific configuration value and triggers save
   */
  public set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    const previousConfig = { ...this.currentConfig };
    this.currentConfig[key] = value;
    
    this.emitUpdateEvent(previousConfig, [key]);
    this.scheduleSave();
  }
  
  /**
   * Type-safe assignment helper for configuration properties
   */
  private assignConfigValue<K extends keyof MutableAppConfig>(
    key: K,
    value: MutableAppConfig[K]
  ): void {
    this.currentConfig[key] = value;
  }

  /**
   * Updates multiple configuration values at once
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    const previousConfig = { ...this.currentConfig };
    const changedKeys: Array<keyof AppConfig> = [];
    
    // Apply updates and track changed keys
    for (const [key, value] of Object.entries(updates)) {
      if (key in DEFAULT_CONFIG) {
        const configKey = key as keyof AppConfig;
        if (this.currentConfig[configKey] !== value) {
          this.assignConfigValue(configKey, value as MutableAppConfig[typeof configKey]);
          changedKeys.push(configKey);
        }
      }
    }
    
    if (changedKeys.length > 0) {
      this.emitUpdateEvent(previousConfig, changedKeys);
      this.scheduleSave();
    }
  }
  
  /**
   * Replaces the entire configuration with a new one
   */
  public replaceConfig(newConfig: Partial<AppConfig>): void {
    const previousConfig = { ...this.currentConfig };
    const sanitizedConfig = sanitizeConfig(newConfig);
    
    // Find all changed keys
    const changedKeys: Array<keyof AppConfig> = [];
    for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>) {
      if (this.currentConfig[key] !== sanitizedConfig[key]) {
        changedKeys.push(key);
      }
    }
    
    this.currentConfig = { ...sanitizedConfig };
    
    if (changedKeys.length > 0) {
      this.emitUpdateEvent(previousConfig, changedKeys);
      this.scheduleSave();
    }
  }
  
  /**
   * Forces an immediate save to file (bypasses scheduled save)
   */
  public async forceSave(): Promise<void> {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }
    
    return this.saveToFile();
  }
  
  /**
   * Reloads configuration from file
   */
  public async reload(): Promise<void> {
    await this.loadFromFile();
  }
  
  /**
   * Resets configuration to defaults
   */
  public resetToDefaults(): void {
    const previousConfig = { ...this.currentConfig };
    this.currentConfig = { ...DEFAULT_CONFIG };
    
    const changedKeys = Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>;
    this.emitUpdateEvent(previousConfig, changedKeys);
    this.scheduleSave();
  }
  
  /**
   * Checks if the configuration file exists
   */
  public configFileExists(): boolean {
    return fs.existsSync(this.configPath);
  }
  
  /**
   * Gets the path to the configuration file
   */
  public getConfigPath(): string {
    return this.configPath;
  }
  
  /**
   * Loads configuration from file
   */
  private async loadFromFile(): Promise<void> {
    if (this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = await fs.promises.readFile(this.configPath, 'utf8');
        const loadedData: unknown = JSON.parse(fileContent);
        
        if (isValidConfig(loadedData)) {
          const previousConfig = { ...this.currentConfig };
          this.currentConfig = { ...loadedData };
          
          // Emit update event for initialization
          const changedKeys = Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>;
          this.emitUpdateEvent(previousConfig, changedKeys);
        } else {
          console.warn('Loaded config is invalid, using defaults');
          // Sanitize and use what we can
          const sanitizedConfig = sanitizeConfig(loadedData as Partial<AppConfig>);
          const previousConfig = { ...this.currentConfig };
          this.currentConfig = sanitizedConfig;
          
          const changedKeys = Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>;
          this.emitUpdateEvent(previousConfig, changedKeys);
          
          // Save the sanitized version
          this.scheduleSave();
        }
      }
    } catch (error) {
      console.error('Failed to load config file:', error);
      // Keep current defaults and save them immediately
      void this.forceSave().catch(error => {
        console.error('Failed to force save config after load error:', error);
      });
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Saves configuration to file with debouncing
   */
  private scheduleSave(): void {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
    }
    
    // Debounce saves to avoid excessive file I/O
    this.pendingSave = setTimeout(() => {
      this.saveToFile().catch(error => {
        console.error('Failed to save config:', error);
        this.emit('saveError', error);
      });
    }, 100);
  }
  
  /**
   * Actually writes the configuration to file
   */
  private async saveToFile(): Promise<void> {
    if (this.isSaving) {
      return;
    }
    
    this.isSaving = true;
    
    try {
      // Create lock file to prevent concurrent writes
      await fs.promises.writeFile(this.lockFilePath, '');
      
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.promises.mkdir(configDir, { recursive: true });
      
      // Write configuration with pretty formatting for human readability
      const configData = JSON.stringify(this.currentConfig, null, 2);
      await fs.promises.writeFile(this.configPath, configData, 'utf8');
      
      this.emit('configSaved', this.getConfig());
    } catch (error) {
      console.error('Failed to save config file:', error);
      this.emit('saveError', error);
      throw error;
    } finally {
      // Clean up lock file
      try {
        if (fs.existsSync(this.lockFilePath)) {
          await fs.promises.unlink(this.lockFilePath);
        }
      } catch (lockError) {
        console.warn('Failed to remove config lock file:', lockError);
      }
      
      this.isSaving = false;
    }
  }
  
  /**
   * Synchronous save to file for critical shutdown scenarios
   * Uses blocking file operations to ensure completion before process exit
   */
  private saveToFileSync(): void {
    try {
      // Create lock file to prevent concurrent writes
      fs.writeFileSync(this.lockFilePath, '');
      
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      fs.mkdirSync(configDir, { recursive: true });
      
      // Write configuration with pretty formatting for human readability
      const configData = JSON.stringify(this.currentConfig, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf8');
      
      console.log('Config saved synchronously during shutdown');
      this.emit('configSaved', this.getConfig());
    } catch (error) {
      console.error('Failed to save config file synchronously:', error);
      this.emit('saveError', error);
    } finally {
      // Clean up lock file
      try {
        if (fs.existsSync(this.lockFilePath)) {
          fs.unlinkSync(this.lockFilePath);
        }
      } catch (lockError) {
        console.warn('Failed to remove config lock file synchronously:', lockError);
      }
    }
  }
  

  
  /**
   * Emits configuration update event
   */
  private emitUpdateEvent(previousConfig: MutableAppConfig, changedKeys: ReadonlyArray<keyof AppConfig>): void {
    const updateEvent: ConfigUpdateEvent = {
      previous: Object.freeze({ ...previousConfig }),
      current: this.getConfig(),
      changedKeys
    };
    
    this.emit('configUpdated', updateEvent);
    
    // Emit specific events for each changed key
    changedKeys.forEach(key => {
      this.emit(`config:${key}`, this.currentConfig[key], previousConfig[key]);
    });
  }
  
  /**
   * Cleanup method for graceful shutdown
   */
  public async dispose(): Promise<void> {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }
    
    // Try async save first, with fallback to sync save
    if (!this.isSaving) {
      try {
        // Attempt async save with timeout
        const savePromise = this.saveToFile();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Save timeout')), 1000);
        });
        
        await Promise.race([savePromise, timeoutPromise]);
        console.log('Config saved asynchronously during shutdown');
      } catch (error) {
        console.warn('Async save failed during shutdown, falling back to sync save:', error);
        // Fallback to synchronous save
        this.saveToFileSync();
      }
    }
    
    this.removeAllListeners();
    ConfigManager.instance = null;
  }
}

// Export singleton instance getter for convenience
export const getConfigManager = (): ConfigManager => ConfigManager.getInstance();

// Export for type declarations
export type { ConfigUpdateEvent } from '../types/config';
