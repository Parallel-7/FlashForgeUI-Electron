// src/web/handlers/APIRouteHandler.js
const path = require('path');
const express = require('express');

/**
 * APIRouteHandler - Handles all REST API routes and static file serving
 * Separated from main server to focus on HTTP route management
 */
class APIRouteHandler {
  constructor(authService, cameraService, configManager) {
    this.authService = authService;
    this.cameraService = cameraService;
    this.configManager = configManager;
    this.config = null;
  }

  /**
   * Initialize with current configuration
   */
  initialize() {
    this.config = this.configManager.getConfig();
  }

  /**
   * Setup all routes on Express app
   */
  setupRoutes(expressApp) {
    // Parse JSON for API routes
    expressApp.use('/api', express.json());

    // Setup authentication routes
    this.setupAuthRoutes(expressApp);

    // Setup camera routes
    this.setupCameraRoutes(expressApp);

    // Setup static file serving
    this.setupStaticRoutes(expressApp);

    console.log('API routes configured');
  }

  /**
   * Setup authentication-related routes
   */
  setupAuthRoutes(expressApp) {
    // Login endpoint
    expressApp.post('/api/login', (req, res) => {
      try {
        const { password, rememberMe } = req.body;
        const result = this.authService.validateLogin(password, rememberMe);

        if (result.success) {
          res.json({ 
            success: true, 
            token: result.token 
          });
        } else {
          res.status(401).json({ 
            success: false, 
            message: result.message 
          });
        }
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Internal server error' 
        });
      }
    });

    // Auth status endpoint
    expressApp.get('/api/auth-status', (req, res) => {
      try {
        const status = this.authService.getAuthStatus();
        res.json(status);
      } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Protected route middleware for all other /api routes
    expressApp.use('/api', (req, res, next) => {
      // Skip authentication middleware for login and auth-status
      if (req.path === '/login' || req.path === '/auth-status') {
        return next();
      }

      const token = this.authService.extractToken(req);
      if (!token || !this.authService.verifyToken(token)) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Attach auth info to request
      req.auth = {
        token,
        isSpecial: this.authService.isSpecialToken(token)
      };

      next();
    });
  }

  /**
   * Setup camera-related routes
   */
  setupCameraRoutes(expressApp) {
    // Camera stream proxy endpoint
    expressApp.get('/camera-proxy', (req, res) => {
      try {
        const token = req.query.token;
        const authResult = this.authService.validateCameraAccess(token);

        if (!authResult.valid) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // Add client to camera service
        if (this.cameraService) {
          console.log(`Camera proxy access granted for ${authResult.source}`);
          this.cameraService.addClient(res);
        } else {
          res.status(503).send('Camera service not available');
        }
      } catch (error) {
        console.error('Error in camera proxy endpoint:', error);
        this.sendErrorResponse(res, 'Internal server error', 500);
      }
    });

    // Camera status endpoint (protected)
    expressApp.get('/api/camera-status', (req, res) => {
      try {
        if (this.cameraService) {
          const status = this.cameraService.getStatus();
          res.json(status);
        } else {
          res.status(503).json({ error: 'Camera service not available' });
        }
      } catch (error) {
        console.error('Error getting camera status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Camera control endpoints (protected)
    expressApp.post('/api/camera/start', (req, res) => {
      try {
        if (this.cameraService) {
          this.cameraService.start();
          res.json({ success: true, message: 'Camera started' });
        } else {
          res.status(503).json({ error: 'Camera service not available' });
        }
      } catch (error) {
        console.error('Error starting camera:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    expressApp.post('/api/camera/stop', (req, res) => {
      try {
        if (this.cameraService) {
          this.cameraService.stop();
          res.json({ success: true, message: 'Camera stopped' });
        } else {
          res.status(503).json({ error: 'Camera service not available' });
        }
      } catch (error) {
        console.error('Error stopping camera:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  /**
   * Setup static file serving routes
   */
  setupStaticRoutes(expressApp) {
    // Serve index.html for root path
    expressApp.get('/', (req, res) => {
      try {
        const indexPath = path.join(__dirname, '..', 'public', 'index.html');
        res.sendFile(indexPath);
      } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Internal server error');
      }
    });

    // Serve static files from public directory
    const staticPath = path.join(__dirname, '..', 'public');
    expressApp.use(express.static(staticPath, {
      // Add some basic security headers
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'DENY');
        }
      }
    }));

    // Note: Static file serving above should handle most cases
    // If SPA routing is needed later, it can be added with specific route patterns
  }

  /**
   * Send error response with consistent format
   */
  sendErrorResponse(res, message, statusCode = 500) {
    try {
      if (!res.headersSent) {
        res.status(statusCode).json({ 
          error: message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error sending error response:', err);
    }
  }

  /**
   * Update configuration when config changes
   */
  updateConfig() {
    this.config = this.configManager.getConfig();
    this.authService.updateConfig();
  }

}

module.exports = APIRouteHandler;
