// src/web/public/modules/auth.js

/**
 * Authentication Module
 * Handles login/logout functionality and authentication state
 */
class AuthManager {
  constructor(domManager, uiUtils) {
    this.dom = domManager;
    this.ui = uiUtils;
    this.onAuthSuccess = null;
  }

  /**
   * Initialize authentication system
   * @param {Function} onAuthSuccess Callback for successful authentication
   */
  initialize(onAuthSuccess) {
    this.onAuthSuccess = onAuthSuccess;
    this.setupEventHandlers();
    
    // Check for existing auth token
    const savedToken = localStorage.getItem(window.AUTH_TOKEN_KEY);
    if (savedToken) {
      this.connectWithToken(savedToken);
    } else {
      this.showLoginScreen();
    }
  }

  /**
   * Setup authentication event handlers
   */
  setupEventHandlers() {
    const elements = this.dom.getElements();
    
    // Login button click
    elements.loginButton.addEventListener('click', () => this.handleLogin());
    
    // Enter key in password field
    elements.passwordInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.handleLogin();
    });
  }

  /**
   * Handle login form submission
   */
  handleLogin() {
    const elements = this.dom.getElements();
    const password = elements.passwordInput.value.trim();
    
    if (!password) {
      this.showLoginError('Please enter a password');
      return;
    }

    this.showLoginError('');
    this.setLoginButtonState(true, 'Logging in...');

    // Send login request
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        password,
        rememberMe: elements.rememberMeCheckbox.checked 
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.token) {
        localStorage.setItem(window.AUTH_TOKEN_KEY, data.token);
        this.connectWithToken(data.token);
      } else {
        this.showLoginError('Invalid password');
        this.setLoginButtonState(false, 'Login');
      }
    })
    .catch(error => {
      console.error('Login error:', error);
      this.showLoginError('Connection error. Please try again.');
      this.setLoginButtonState(false, 'Login');
    });
  }

  /**
   * Connect with authentication token
   * @param {string} token Authentication token
   */
  connectWithToken(token) {
    if (this.onAuthSuccess) {
      this.onAuthSuccess(token);
    }
  }

  /**
   * Show login screen
   */
  showLoginScreen() {
    const elements = this.dom.getElements();
    
    elements.loginScreen.style.display = 'flex';
    elements.mainUI.classList.add('hidden');
    elements.passwordInput.value = '';
    this.setLoginButtonState(false, 'Login');
    elements.passwordInput.focus();
  }

  /**
   * Show main UI (hide login screen)
   */
  showMainUI() {
    const elements = this.dom.getElements();
    
    elements.loginScreen.style.display = 'none';
    elements.mainUI.classList.remove('hidden');
  }

  /**
   * Display login error message
   * @param {string} message Error message
   */
  showLoginError(message) {
    this.dom.updateText('loginError', message);
  }

  /**
   * Set login button state
   * @param {boolean} disabled Whether button should be disabled
   * @param {string} text Button text
   */
  setLoginButtonState(disabled, text) {
    const elements = this.dom.getElements();
    elements.loginButton.disabled = disabled;
    elements.loginButton.textContent = text;
  }

}

// Export for use by other modules
window.AuthManager = AuthManager;
