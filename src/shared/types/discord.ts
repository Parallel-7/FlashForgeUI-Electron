/**
 * @fileoverview Discord webhook integration type definitions
 *
 * Defines type-safe interfaces for Discord webhook payloads, embeds, and service configuration.
 * These types ensure proper structure for Discord API communication and internal service configuration.
 *
 * Key Features:
 * - Discord embed structure matching Discord API specification
 * - Webhook payload format for POST requests
 * - Service configuration for Discord integration settings
 * - Type safety for embed field formatting
 *
 * @module types/discord
 */

/**
 * Discord embed field
 * Represents a single field within a Discord embed
 */
export interface DiscordEmbedField {
  /** Field name/title */
  readonly name: string;
  /** Field value/content */
  readonly value: string;
  /** Whether field should be displayed inline with other fields */
  readonly inline: boolean;
}

/**
 * Discord embed structure
 * Matches Discord webhook embed API specification
 */
export interface DiscordEmbed {
  /** Embed title */
  readonly title: string;
  /** Embed color (integer representation of hex color) */
  readonly color: number;
  /** ISO 8601 timestamp */
  readonly timestamp: string;
  /** Array of embed fields */
  readonly fields: DiscordEmbedField[];
}

/**
 * Discord webhook POST payload
 * Structure for sending embeds to Discord webhook URL
 */
export interface DiscordWebhookPayload {
  /** Array of embeds (max 10 per webhook) */
  readonly embeds: DiscordEmbed[];
}

/**
 * Discord service configuration
 * Extracted from AppConfig for Discord-specific settings
 */
export interface DiscordServiceConfig {
  /** Whether Discord sync is enabled */
  readonly enabled: boolean;
  /** Discord webhook URL */
  readonly webhookUrl: string;
  /** Update interval in minutes */
  readonly updateIntervalMinutes: number;
}
