// Main Content Script for Web Automation Extension
import { PageDetector } from './modules/page-detector.js';
import { ElementFinder } from './modules/element-finder.js';
import { ActionExecutor } from './modules/action-executor.js';
import { ProgressTracker } from './modules/progress-tracker.js';

class AutomationContentScript {
  constructor() {
    this.pageDetector = new PageDetector();
    this.elementFinder = new ElementFinder();
    this.actionExecutor = new ActionExecutor();
    this.progressTracker = new ProgressTracker();
    
    this.currentSession = null;
    this.isRunning = false;
    this.isPaused = false;
    this.currentScenario = null;
    this.currentPage = null;
    this.selectors = null;
    
    this.actionQueue = [];
    this.executionTimer = null;
    
    this.init();
  }

  async init() {
    console.log('🎬 Web Automation Content Script loaded');
    
    // Setup message listener
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Detect current page
    await this.detectCurrentPage();
    
    // Setup page change detection
    this.setupPageChangeDetection();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Create debug overlay if enabled
    await this.setupDebugMode();
  }

  /**
   * Handle messages from background script and popup
   */
  async handleMessage(message, sender, sendResponse) {
    console.log('📩 Content script received message:', message.type);
    
    try {
      switch (message.type) {
        case 'START_AUTOMATION':
          return await this.startAutomation(message.data);
          
        case 'STOP_AUTOMATION':
          return await this.stopAutomation();
          
        case 'PAUSE_AUTOMATION':
          return await this.pauseAutomation();
          
        case 'RESUME_AUTOMATION':
          return await this.resumeAutomation();
          
        case 'GET_PAGE_INFO':
          return await this.getPageInfo();
          
        case 'TEST_SELECTOR':
          return await this.testSelector(message.data);
          
        case 'EXECUTE_ACTION':
          return await this.executeAction(message.data);
          
        case 'GET_STATUS':
          return this.getStatus();
          
        case 'SETTINGS_UPDATED':
          return await this.updateSettings(message.data);
          
        case 'TAKE_SCREENSHOT':
          return await this.takeScreenshot();
          
        default:
          console.warn('Unknown message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start automation with given scenario
   */
  async startAutomation(data) {
    try {
      console.log('🎬 Starting automation session:', data.sessionId);
      
      this.currentSession = data.sessionId;
      this.currentScenario = data.scenario;
      this.selectors = data.selectors;
      this.isRunning = true;
      this.isPaused = false;
      
      // Initialize progress tracker
      await this.progressTracker.initialize(this.currentScenario.goals);
      
      // Detect current page
      await this.detectCurrentPage();
      
      // Start execution
      await this.executeScenario();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to start automation:', error);
      await this.logError('start_automation_failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop automation
   */
  async stopAutomation() {
    try {
      console.log('🛑 Stopping automation session');
      
      this.isRunning = false;
      this.isPaused = false;
      this.currentSession = null;
      this.currentScenario = null;
      this.actionQueue = [];
      
      // Clear any pending timers
      if (this.executionTimer) {
        clearTimeout(this.executionTimer);
        this.executionTimer = null;
      }
      
      // Remove debug overlay
      this.removeDebugOverlay();
      
      // Log session end
      await this.logAction('session_ended', {
        reason: 'manual_stop',
        duration: this.progressTracker.getSessionDuration()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to stop automation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause automation
   */
  async pauseAutomation() {
    try {
      console.log('⏸️ Pausing automation');
      
      this.isPaused = true;
      
      // Clear pending timer
      if (this.executionTimer) {
        clearTimeout(this.executionTimer);
        this.executionTimer = null;
      }
      
      await this.logAction('session_paused', {
        duration: this.progressTracker.getSessionDuration()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to pause automation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume automation
   */
  async resumeAutomation() {
    try {
      console.log('▶️ Resuming automation');
      
      this.isPaused = false;
      
      // Continue execution
      await this.executeScenario();
      
      await this.logAction('session_resumed', {
        duration: this.progressTracker.getSessionDuration()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to resume automation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Main scenario execution loop
   */
  async executeScenario() {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    try {
      // Check if session goals are met
      if (await this.progressTracker.areGoalsMet()) {
        console.log('🎉 Session goals completed');
        await this.completeSession();
        return;
      }
      
      // Check session timeout
      if (this.progressTracker.isSessionTimedOut()) {
        console.log('⏰ Session timed out');
        await this.timeoutSession();
        return;
      }
      
      // Get current page configuration
      const pageConfig = this.getPageConfiguration();
      if (!pageConfig) {
        console.error('No page configuration found for current page');
        await this.handlePageConfigError();
        return;
      }
      
      // Execute page actions
      await this.executePageActions(pageConfig);
      
    } catch (error) {
      console.error('Error in scenario execution:', error);
      await this.handleExecutionError(error);
    }
  }

  /**
   * Execute actions for current page
   */
  async executePageActions(pageConfig) {
    try {
      // Execute entry actions if defined
      if (pageConfig.entryActions) {
        await this.executeActionSequence(pageConfig.entryActions);
      }
      
      // Get available actions
      const availableActions = this.getAvailableActions(pageConfig);
      
      if (availableActions.length === 0) {
        console.warn('No available actions for current page');
        await this.handleNoActionsAvailable();
        return;
      }
      
      // Select action based on probability and conditions
      const selectedAction = await this.selectAction(availableActions);
      
      if (selectedAction) {
        await this.executeSelectedAction(selectedAction);
      }
      
      // Schedule next execution
      this.scheduleNextExecution(pageConfig);
      
    } catch (error) {
      console.error('Error executing page actions:', error);
      throw error;
    }
  }

  /**
   * Execute a specific action
   */
  async executeSelectedAction(action) {
    try {
      console.log(`🎯 Executing action: ${action.name}`);
      
      // Log action start
      await this.logAction('action_started', {
        action: action.name,
        page: this.currentPage?.type
      });
      
      // Check action conditions
      if (action.conditions && !await this.checkActionConditions(action.conditions)) {
        console.log('Action conditions not met, skipping');
        return;
      }
      
      // Execute micro sequence
      if (action.microSequence && action.microSequence.length > 0) {
        await this.executeActionSequence(action.microSequence);
      }
      
      // Update progress metrics
      if (action.impact) {
        await this.progressTracker.updateMetrics(action.impact);
      }
      
      // Handle navigation actions
      if (action.targetPage && action.targetPage !== this.currentPage?.type) {
        await this.handlePageTransition(action.targetPage);
      }
      
      // Log action completion
      await this.logAction('action_completed', {
        action: action.name,
        page: this.currentPage?.type,
        duration: Date.now() - this.actionStartTime
      });
      
    } catch (error) {
      console.error('Error executing action:', error);
      await this.logError('action_execution_failed', error, { action: action.name });
      throw error;
    }
  }

  /**
   * Execute a sequence of micro actions
   */
  async executeActionSequence(sequence) {
    for (const microAction of sequence) {
      if (!this.isRunning || this.isPaused) {
        break;
      }
      
      try {
        await this.executeMicroAction(microAction);
      } catch (error) {
        console.error('Error executing micro action:', error);
        
        // Check if we should continue or abort
        if (this.shouldAbortOnError(error)) {
          throw error;
        }
        
        // Log error but continue
        await this.logError('micro_action_failed', error, { action: microAction });
      }
    }
  }

  /**
   * Execute a single micro action
   */
  async executeMicroAction(microAction) {
    const { type } = microAction;
    
    console.log(`🔧 Executing micro action: ${type}`);
    
    switch (type) {
      case 'wait':
        await this.actionExecutor.wait(microAction.duration);
        break;
        
      case 'move':
        await this.actionExecutor.moveToElement(
          await this.findElement(microAction.target),
          microAction.pattern,
          microAction.speed
        );
        break;
        
      case 'hover':
        await this.actionExecutor.hoverElement(
          await this.findElement(microAction.target),
          microAction.duration
        );
        break;
        
      case 'click':
        await this.actionExecutor.clickElement(
          await this.findElement(microAction.target),
          microAction.button,
          microAction.count
        );
        break;
        
      case 'scroll':
        await this.actionExecutor.scroll(
          microAction.distance,
          microAction.to ? await this.findElement(microAction.to) : null,
          microAction.speed
        );
        break;
        
      case 'type':
        await this.actionExecutor.typeText(
          await this.findElement(microAction.target),
          microAction.text,
          microAction.speed,
          microAction.clearFirst
        );
        break;
        
      case 'verify':
        await this.verifyElement(microAction.target, microAction.exists);
        break;
        
      case 'screenshot':
        await this.takeScreenshot(microAction.filename);
        break;
        
      case 'log':
        await this.logAction('custom_log', { message: microAction.message });
        break;
        
      default:
        console.warn('Unknown micro action type:', type);
    }
  }

  /**
   * Find element using selector with fallbacks
   */
  async findElement(selector) {
    try {
      return await this.elementFinder.findElement(selector, this.selectors);
    } catch (error) {
      console.error('Element not found:', selector, error);
      throw new Error(`Element not found: ${selector}`);
    }
  }

  /**
   * Detect current page type
   */
  async detectCurrentPage() {
    try {
      this.currentPage = await this.pageDetector.detectPage(
        window.location.href,
        this.selectors
      );
      
      console.log('📍 Current page detected:', this.currentPage?.type || 'unknown');
      
      // Update progress tracker
      if (this.currentPage) {
        await this.progressTracker.updateCurrentPage(this.currentPage.type);
      }
      
      return this.currentPage;
    } catch (error) {
      console.error('Error detecting page:', error);
      return null;
    }
  }

  /**
   * Get page configuration for current page
   */
  getPageConfiguration() {
    if (!this.currentScenario || !this.currentPage) {
      return null;
    }
    
    return this.currentScenario.pages[this.currentPage.type] || null;
  }

  /**
   * Get available actions for current page
   */
  getAvailableActions(pageConfig) {
    if (!pageConfig || !pageConfig.actions) {
      return [];
    }
    
    const allActions = [
      ...(pageConfig.actions.nonNavigation || []),
      ...(pageConfig.actions.navigation || [])
    ];
    
    return allActions.filter(action => action.probability > 0);
  }

  /**
   * Select action based on probability and conditions
   */
  async selectAction(availableActions) {
    // Filter actions by conditions
    const validActions = [];
    
    for (const action of availableActions) {
      if (!action.conditions || await this.checkActionConditions(action.conditions)) {
        validActions.push(action);
      }
    }
    
    if (validActions.length === 0) {
      return null;
    }
    
    // Weighted random selection
    const totalWeight = validActions.reduce((sum, action) => sum + action.probability, 0);
    let random = Math.random() * totalWeight;
    
    for (const action of validActions) {
      random -= action.probability;
      if (random <= 0) {
        return action;
      }
    }
    
    return validActions[0]; // Fallback
  }

  /**
   * Check if action conditions are met
   */
  async checkActionConditions(conditions) {
    try {
      // Time-based conditions
      if (conditions.minTimeOnPage && this.progressTracker.getTimeOnCurrentPage() < conditions.minTimeOnPage * 1000) {
        return false;
      }
      
      if (conditions.maxTimeOnPage && this.progressTracker.getTimeOnCurrentPage() > conditions.maxTimeOnPage * 1000) {
        return false;
      }
      
      // Element-based conditions
      if (conditions.elementExists) {
        try {
          await this.findElement(conditions.elementExists);
        } catch {
          return false;
        }
      }
      
      if (conditions.elementNotExists) {
        try {
          await this.findElement(conditions.elementNotExists);
          return false; // Element exists, condition not met
        } catch {
          // Element doesn't exist, condition met
        }
      }
      
      // Goal-based conditions
      if (conditions.goalProgress) {
        for (const [metric, threshold] of Object.entries(conditions.goalProgress)) {
          if (this.progressTracker.getMetric(metric) < threshold) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking action conditions:', error);
      return false;
    }
  }

  /**
   * Handle page transition
   */
  async handlePageTransition(targetPageType) {
    console.log(`🔄 Page transition expected to: ${targetPageType}`);
    
    // Wait for page change
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newPage = await this.detectCurrentPage();
      if (newPage && newPage.type === targetPageType) {
        console.log(`✅ Page transition successful: ${targetPageType}`);
        return;
      }
    }
    
    console.warn(`⚠️ Page transition timeout: expected ${targetPageType}, still on ${this.currentPage?.type}`);
  }

  /**
   * Schedule next execution
   */
  scheduleNextExecution(pageConfig) {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    // Calculate delay based on page configuration
    const minDelay = pageConfig.stayDuration?.min || 2;
    const maxDelay = pageConfig.stayDuration?.max || 5;
    const delay = (Math.random() * (maxDelay - minDelay) + minDelay) * 1000;
    
    console.log(`⏰ Next execution scheduled in ${Math.round(delay/1000)}s`);
    
    this.executionTimer = setTimeout(() => {
      this.executeScenario();
    }, delay);
  }

  /**
   * Setup page change detection
   */
  setupPageChangeDetection() {
    let lastUrl = window.location.href;
    
    // URL change detection
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('🔄 URL changed, detecting new page');
        this.detectCurrentPage();
      }
    });
    
    observer.observe(document, {
      subtree: true,
      childList: true
    });
    
    // Popstate event for back/forward navigation
    window.addEventListener('popstate', () => {
      setTimeout(() => this.detectCurrentPage(), 1000);
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+P: Pause/Resume automation
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        if (this.isPaused) {
          this.resumeAutomation();
        } else {
          this.pauseAutomation();
        }
      }
      
      // Ctrl+Shift+D: Toggle debug mode
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        this.toggleDebugOverlay();
      }
    });
  }

  /**
   * Setup debug mode overlay
   */
  async setupDebugMode() {
    const settings = await this.getSettings();
    if (settings.debugMode) {
      this.createDebugOverlay();
    }
  }

  /**
   * Create debug overlay
   */
  createDebugOverlay() {
    if (document.getElementById('wa-debug-overlay')) {
      return; // Already exists
    }

    const overlay = document.createElement('div');
    overlay.id = 'wa-debug-overlay';
    overlay.innerHTML = `
      <div class="wa-debug-header">
        <span>🤖 Web Automation Debug</span>
        <button class="wa-debug-close">×</button>
      </div>
      <div class="wa-debug-content">
        <div class="wa-debug-section">
          <strong>Session:</strong> <span id="wa-debug-session">-</span>
        </div>
        <div class="wa-debug-section">
          <strong>Page:</strong> <span id="wa-debug-page">-</span>
        </div>
        <div class="wa-debug-section">
          <strong>Status:</strong> <span id="wa-debug-status">-</span>
        </div>
        <div class="wa-debug-section">
          <strong>Progress:</strong> <span id="wa-debug-progress">-</span>
        </div>
        <div class="wa-debug-actions">
          <button id="wa-debug-pause">Pause</button>
          <button id="wa-debug-stop">Stop</button>
          <button id="wa-debug-screenshot">Screenshot</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Setup event listeners
    overlay.querySelector('.wa-debug-close').addEventListener('click', () => {
      this.removeDebugOverlay();
    });

    overlay.querySelector('#wa-debug-pause').addEventListener('click', () => {
      if (this.isPaused) {
        this.resumeAutomation();
      } else {
        this.pauseAutomation();
      }
    });

    overlay.querySelector('#wa-debug-stop').addEventListener('click', () => {
      this.stopAutomation();
    });

    overlay.querySelector('#wa-debug-screenshot').addEventListener('click', () => {
      this.takeScreenshot();
    });

    // Start updating debug info
    this.updateDebugOverlay();
    this.debugUpdateInterval = setInterval(() => {
      this.updateDebugOverlay();
    }, 1000);
  }

  /**
   * Update debug overlay information
   */
  updateDebugOverlay() {
    const overlay = document.getElementById('wa-debug-overlay');
    if (!overlay) return;

    const sessionEl = overlay.querySelector('#wa-debug-session');
    const pageEl = overlay.querySelector('#wa-debug-page');
    const statusEl = overlay.querySelector('#wa-debug-status');
    const progressEl = overlay.querySelector('#wa-debug-progress');
    const pauseBtn = overlay.querySelector('#wa-debug-pause');

    sessionEl.textContent = this.currentSession || 'None';
    pageEl.textContent = this.currentPage?.type || 'Unknown';
    
    let status = 'Idle';
    if (this.isRunning) {
      status = this.isPaused ? 'Paused' : 'Running';
    }
    statusEl.textContent = status;

    if (this.progressTracker) {
      const progress = this.progressTracker.getOverallProgress();
      progressEl.textContent = `${Math.round(progress)}%`;
    }

    pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
  }

  /**
   * Remove debug overlay
   */
  removeDebugOverlay() {
    const overlay = document.getElementById('wa-debug-overlay');
    if (overlay) {
      overlay.remove();
    }

    if (this.debugUpdateInterval) {
      clearInterval(this.debugUpdateInterval);
      this.debugUpdateInterval = null;
    }
  }

  /**
   * Toggle debug overlay
   */
  toggleDebugOverlay() {
    const overlay = document.getElementById('wa-debug-overlay');
    if (overlay) {
      this.removeDebugOverlay();
    } else {
      this.createDebugOverlay();
    }
  }

  /**
   * Get current status information
   */
  getStatus() {
    return {
      success: true,
      data: {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        currentSession: this.currentSession,
        currentPage: this.currentPage?.type,
        progress: this.progressTracker?.getOverallProgress() || 0,
        duration: this.progressTracker?.getSessionDuration() || 0
      }
    };
  }

  /**
   * Get page information
   */
  async getPageInfo() {
    await this.detectCurrentPage();
    
    return {
      success: true,
      data: {
        url: window.location.href,
        title: document.title,
        page: this.currentPage,
        availableElements: await this.getAvailableElements()
      }
    };
  }

  /**
   * Get available elements on page
   */
  async getAvailableElements() {
    const elements = [];
    
    // Common interactive elements
    const selectors = [
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      'a[href]',
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'select',
      'textarea'
    ];

    for (const selector of selectors) {
      const foundElements = document.querySelectorAll(selector);
      foundElements.forEach((el, index) => {
        elements.push({
          selector: `${selector}:nth-child(${index + 1})`,
          text: el.textContent?.trim()?.substring(0, 50) || '',
          id: el.id,
          classes: el.className,
          type: el.type || el.tagName.toLowerCase()
        });
      });
    }

    return elements.slice(0, 50); // Limit to 50 elements
  }

  /**
   * Test a selector
   */
  async testSelector(data) {
    try {
      const { selector } = data;
      const element = await this.findElement(selector);
      
      // Highlight element
      this.highlightElement(element);
      
      return {
        success: true,
        data: {
          found: true,
          element: {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            text: element.textContent?.trim()?.substring(0, 100)
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: { found: false }
      };
    }
  }

  /**
   * Highlight element for debugging
   */
  highlightElement(element) {
    // Remove existing highlight
    const existing = document.querySelector('.wa-highlight');
    if (existing) {
      existing.classList.remove('wa-highlight');
    }

    // Add highlight to new element
    element.classList.add('wa-highlight');
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('wa-highlight');
    }, 3000);

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Execute single action (for testing)
   */
  async executeAction(data) {
    try {
      const { action } = data;
      await this.executeMicroAction(action);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(filename) {
    try {
      // Send message to background to capture screenshot
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        data: { filename }
      });

      if (response.success) {
        console.log('📸 Screenshot captured:', filename);
      }

      return response;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings) {
    console.log('⚙️ Settings updated:', newSettings);
    
    // Handle debug mode toggle
    if (newSettings.debugMode !== undefined) {
      if (newSettings.debugMode) {
        this.createDebugOverlay();
      } else {
        this.removeDebugOverlay();
      }
    }

    return { success: true };
  }

  /**
   * Get extension settings
   */
  async getSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });
      return response.success ? response.data : {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  /**
   * Verify element exists
   */
  async verifyElement(selector, shouldExist = true) {
    try {
      await this.findElement(selector);
      if (!shouldExist) {
        throw new Error(`Element should not exist: ${selector}`);
      }
      console.log(`✅ Element verification passed: ${selector}`);
    } catch (error) {
      if (shouldExist) {
        throw new Error(`Element verification failed: ${selector}`);
      }
      console.log(`✅ Element verification passed (should not exist): ${selector}`);
    }
  }

  /**
   * Handle session completion
   */
  async completeSession() {
    console.log('🎉 Automation session completed successfully');
    
    await this.logAction('session_completed', {
      duration: this.progressTracker.getSessionDuration(),
      progress: this.progressTracker.getOverallProgress(),
      goals: this.progressTracker.getGoalStatus()
    });

    await this.stopAutomation();
  }

  /**
   * Handle session timeout
   */
  async timeoutSession() {
    console.log('⏰ Automation session timed out');
    
    await this.logAction('session_timeout', {
      duration: this.progressTracker.getSessionDuration(),
      progress: this.progressTracker.getOverallProgress()
    });

    await this.stopAutomation();
  }

  /**
   * Handle execution errors
   */
  async handleExecutionError(error) {
    console.error('❌ Execution error:', error);
    
    await this.logError('execution_error', error);
    
    // Decide whether to continue or stop based on error type
    if (this.shouldAbortOnError(error)) {
      await this.stopAutomation();
    } else {
      // Retry or continue with next action
      this.scheduleNextExecution(this.getPageConfiguration());
    }
  }

  /**
   * Check if error should abort the session
   */
  shouldAbortOnError(error) {
    const fatalErrors = [
      'network_error',
      'page_crash',
      'extension_error'
    ];
    
    return fatalErrors.some(fatalError => 
      error.message?.toLowerCase().includes(fatalError)
    );
  }

  /**
   * Handle case when no actions are available
   */
  async handleNoActionsAvailable() {
    console.warn('⚠️ No actions available for current page');
    
    await this.logAction('no_actions_available', {
      page: this.currentPage?.type,
      url: window.location.href
    });

    // Try to navigate to a different page or end session
    await this.handleStuckScenario();
  }

  /**
   * Handle stuck scenario (no available actions)
   */
  async handleStuckScenario() {
    // Try to go back or navigate to home
    if (window.history.length > 1) {
      window.history.back();
      await this.wait(2000);
      await this.detectCurrentPage();
    } else {
      // End session if stuck
      await this.completeSession();
    }
  }

  /**
   * Handle page configuration error
   */
  async handlePageConfigError() {
    console.error('❌ No page configuration found');
    
    await this.logError('page_config_error', new Error('No page configuration found'), {
      page: this.currentPage?.type,
      url: window.location.href
    });

    // Try to continue with default behavior or end session
    await this.handleStuckScenario();
  }

  /**
   * Log action to background
   */
  async logAction(actionType, data = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'LOG_ACTION',
        data: {
          actionType,
          ...data,
          timestamp: Date.now(),
          url: window.location.href,
          session: this.currentSession
        }
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  /**
   * Log error to background
   */
  async logError(errorType, error, additionalData = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'LOG_ACTION',
        data: {
          actionType: 'error',
          errorType,
          error: {
            message: error.message,
            stack: error.stack
          },
          ...additionalData,
          timestamp: Date.now(),
          url: window.location.href,
          session: this.currentSession
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Simple wait utility
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize content script
if (typeof window !== 'undefined' && window.document) {
  new AutomationContentScript();
}+S: Stop automation
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        this.stopAutomation();
      }
      
      // Ctrl+Shift