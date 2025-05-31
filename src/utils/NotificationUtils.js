// src/utils/NotificationUtils.js
const { Notification } = require('electron');

/**
 * Utility class for handling desktop notifications.
 */
class NotificationUtils {
    /**
     * Shows a desktop notification.
     * Checks if notifications are supported by the OS before attempting to show.
     *
     * @param {string} title - The title of the notification.
     * @param {string} body - The main text content of the notification.
     * @param {Object} options - Optional notification options (icon, silent, etc.)
     * @returns {Notification|null} The notification instance or null if not supported
     */
    static showNotification(title, body, options = {}) {
        // Check if the operating system supports notifications
        if (Notification.isSupported()) {
            const notificationOptions = {
                title: title,
                body: body,
                ...options
                // You can add other options here if needed, like 'icon', 'silent', etc.
                // icon: path.join(__dirname, 'path/to/icon.png') // Example icon path
            };

            const notification = new Notification(notificationOptions);
            notification.show();
            return notification;
        } else {
            // Log a warning if notifications aren't supported
            console.warn('Desktop notifications are not supported on this system.');
            return null;
        }
    }
}

module.exports = NotificationUtils;
