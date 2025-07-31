// Enhanced Popup Script with API Integration
class AutomationPopup {
  constructor() {
    this.currentTab = null;
    this.websiteConfig = null;
    this.sessionStatus = null;
    this.updateInterval = null;
    
    this.init();
  }

  async init() {
    console.log('🎭 Popup initializing...');
    
    // Get current tab
    await this.getCurrentTab();
    
    // Initialize UI
    this.initializeEventListeners();
    this.initializeTabSwitching();
    
    // Load website configuration
    await this.loadWebsiteConfig();
    
    // Load session status
    await this.loadSessionStatus();
    
    // Start periodic updates
    this.startPeriodicUpdates();
    
    console.log('✅ Popup initialized');
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      console.log('📍 Current tab:', tab?.url);
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Control buttons
    document.getElementById('startBtn')?.addEventListener('click', () => this.handleStartAutomation());
    document.getElementById('stopBtn')?.addEventListener('click', () => this.handleStopAutomation());
    document.getElementById('pauseBtn')?.addEventListener('click', () => this.handlePauseAutomation());
    
    // Scenario selector
    document.getElementById('scenarioSelector')?.addEventListener('change', (e) => this.handleScenarioChange(e));
    
    // Settings checkboxes
    ['debugMode', 'slowMode', 'screenshotMode'].forEach(settingId => {
      document.getElementById(settingId)?.addEventListener('change', (e) => this.handleSettingChange(settingId, e.target.checked));
    });
    
    // Footer links
    document.getElementById('optionsLink')?.addEventListener('click', () => this.openOptionsPage());
    document.getElementById('helpLink')?.addEventListener('click', () => this.openHelpPage());
  }

  /**
   * Initialize tab switching functionality
   */
  initializeTabSwitching() {
    const tabs = document.querySelectorAll('.tab');
    const tabIndicator = document.getElementById('tabIndicator');
    
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Move indicator
        tabIndicator.className = `tab-indicator tab-${index + 1}`;
        
        // Show/hide content
        this.showTabContent(tab.dataset.tab);
      });
    });
  }

  /**
   * Show specific tab content
   */
  showTabContent(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.opacity = '0';
      content.classList.add('hidden');
    });
    
    setTimeout(() => {
      const targetContent = document.getElementById(`${tabName}Tab`);
      if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.style.opacity = '1';
      }
    }, 150);
  }

  /**
   * Load website configuration
   */
  async loadWebsiteConfig() {
    try {
      if (!this.currentTab?.id) return;
      
      console.log('🔍 Loading website config...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_WEBSITE_CONFIG'
      });
      
      if (response.success && response.data) {
        this.websiteConfig = response.data;
        await this.updateWebsiteInfo();
        await this.updateScenarioSelector();
      } else {
        this.showNoWebsiteDetected();
      }
      
    } catch (error) {
      console.error('Failed to load website config:', error);
      this.showNoWebsiteDetected();
    }
  }

  /**
   * Update website information display
   */
  async updateWebsiteInfo() {
    const websiteNameEl = document.getElementById('websiteName');
    const websiteUrlEl = document.getElementById('websiteUrl');
    const websiteIconEl = document.querySelector('.website-icon');
    
    if (this.websiteConfig) {
      websiteNameEl.textContent = this.websiteConfig.website.name;
      websiteUrlEl.textContent = this.websiteConfig.domain;
      websiteIconEl.textContent = this.getWebsiteTypeIcon(this.websiteConfig.website.type);
    }
  }

  /**
   * Update scenario selector dropdown
   */
  async updateScenarioSelector() {
    const scenarioSelector = document.getElementById('scenarioSelector');
    if (!scenarioSelector || !this.websiteConfig?.scenarios) return;
    
    // Clear existing options except the first one
    while (scenarioSelector.children.length > 1) {
      scenarioSelector.removeChild(scenarioSelector.lastChild);
    }
    
    // Add scenario options
    Object.entries(this.websiteConfig.scenarios).forEach(([scenarioId, scenario]) => {
      const option = document.createElement('option');
      option.value = scenarioId;
      option.textContent = `${this.getScenarioIcon(scenario)} ${scenario.name}`;
      
      // Add duration info if available
      if (scenario.goals?.session_duration) {
        const duration = scenario.goals.session_duration;
        option.textContent += ` (${duration.min}-${duration.max} ${duration.unit})`;
      }
      
      scenarioSelector.appendChild(option);
    });
  }

  /**
   * Show no website detected state
   */
  showNoWebsiteDetected() {
    const websiteNameEl = document.getElementById('websiteName');
    const websiteUrlEl = document.getElementById('websiteUrl');
    const websiteIconEl = document.querySelector('.website-icon');
    
    websiteNameEl.textContent = 'No website detected';
    websiteUrlEl.textContent = 'Navigate to a configured website';
    websiteIconEl.textContent = '🌐';
    
    // Disable controls
    this.disableControls();
  }

  /**
   * Handle scenario selection change
   */
  handleScenarioChange(event) {
    const scenarioId = event.target.value;
    const goalsSection = document.getElementById('goalsSection');
    
    if (scenarioId && this.websiteConfig?.scenarios[scenarioId]) {
      const scenario = this.websiteConfig.scenarios[scenarioId];
      this.updateGoalsDisplay(scenario);
      
      goalsSection.classList.remove('hidden');
      goalsSection.style.opacity = '0';
      setTimeout(() => {
        goalsSection.style.opacity = '1';
      }, 100);
    } else {
      goalsSection.classList.add('hidden');
    }
  }

  /**
   * Update goals display
   */
  updateGoalsDisplay(scenario) {
    const goalsList = document.getElementById('goalsList');
    if (!goalsList || !scenario.goals) return;
    
    goalsList.innerHTML = '';
    
    // Session duration
    if (scenario.goals.session_duration) {
      const duration = scenario.goals.session_duration;
      this.addGoalItem(goalsList, '⏱️', 'Duration', `${duration.min}-${duration.max} ${duration.unit}`);
    }
    
    // Required metrics
    if (scenario.goals.required_metrics) {
      Object.entries(scenario.goals.required_metrics).forEach(([metric, value]) => {
        const icon = this.getMetricIcon(metric);
        const label = this.formatMetricLabel(metric);
        this.addGoalItem(goalsList, icon, label, value.toString());
      });
    }
    
    // Optional metrics
    if (scenario.goals.optional_metrics) {
      Object.entries(scenario.goals.optional_metrics).forEach(([metric, value]) => {
        const icon = this.getMetricIcon(metric);
        const label = this.formatMetricLabel(metric) + ' (Optional)';
        this.addGoalItem(goalsList, icon, label, value.toString());
      });
    }
  }

  /**
   * Add goal item to goals list
   */
  addGoalItem(container, icon, label, value) {
    const goalItem = document.createElement('div');
    goalItem.className = 'goal-item';
    
    goalItem.innerHTML = `
      <div class="goal-label">
        <div class="goal-icon">${icon}</div>
        ${label}
      </div>
      <div class="goal-value">${value}</div>
    `;
    
    container.appendChild(goalItem);
  }

  /**
   * Handle start automation
   */
  async handleStartAutomation() {
    try {
      const scenarioSelector = document.getElementById('scenarioSelector');
      const scenarioId = scenarioSelector.value;
      
      if (!scenarioId) {
        this.showNotification('Please select a scenario first', 'warning');
        return;
      }
      
      if (!this.websiteConfig) {
        this.showNotification('No website configuration available', 'error');
        return;
      }
      
      console.log('🎬 Starting automation...');
      
      // Update UI to starting state
      this.updateStatus('Starting...', 'running');
      const startBtn = document.getElementById('startBtn');
      startBtn.disabled = true;
      startBtn.innerHTML = '<div class="loading"></div> Starting...';
      
      // Send start command
      const response = await chrome.runtime.sendMessage({
        type: 'START_AUTOMATION',
        data: {
          scenarioId,
          websiteConfig: this.websiteConfig
        }
      });
      
      if (response.success) {
        console.log('✅ Automation started successfully');
        this.showNotification('Automation started successfully!', 'success');
        
        // Update UI to running state
        this.updateStatus('Running', 'running');
        this.showRunningControls();
        
        // Auto switch to monitor tab
        const monitorTab = document.querySelector('[data-tab="monitor"]');
        if (monitorTab) {
          monitorTab.click();
        }
        
      } else {
        throw new Error(response.error || 'Failed to start automation');
      }
      
    } catch (error) {
      console.error('Failed to start automation:', error);
      this.showNotification(`Failed to start: ${error.message}`, 'error');
      
      // Reset UI state
      this.updateStatus('Idle', 'idle');
      this.showIdleControls();
    }
  }

  /**
   * Handle stop automation
   */
  async handleStopAutomation() {
    try {
      console.log('🛑 Stopping automation...');
      
      // Update UI
      this.updateStatus('Stopping...', 'idle');
      const stopBtn = document.getElementById('stopBtn');
      stopBtn.disabled = true;
      stopBtn.innerHTML = '<div class="loading"></div> Stopping...';
      
      // Send stop command
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_AUTOMATION'
      });
      
      if (response.success) {
        console.log('✅ Automation stopped successfully');
        this.showNotification('Automation stopped', 'info');
        
        // Update UI to idle state
        this.updateStatus('Idle', 'idle');
        this.showIdleControls();
        
      } else {
        throw new Error(response.error || 'Failed to stop automation');
      }
      
    } catch (error) {
      console.error('Failed to stop automation:', error);
      this.showNotification(`Failed to stop: ${error.message}`, 'error');
    }
  }

  /**
   * Handle pause/resume automation
   */
  async handlePauseAutomation() {
    try {
      const isPaused = this.sessionStatus?.status === 'paused';
      const action = isPaused ? 'RESUME_AUTOMATION' : 'PAUSE_AUTOMATION';
      const actionText = isPaused ? 'Resuming' : 'Pausing';
      
      console.log(`⏸️ ${actionText} automation...`);
      
      // Update UI
      const pauseBtn = document.getElementById('pauseBtn');
      pauseBtn.disabled = true;
      pauseBtn.innerHTML = `<div class="loading"></div> ${actionText}...`;
      
      // Send pause/resume command
      const response = await chrome.runtime.sendMessage({
        type: action
      });
      
      if (response.success) {
        const newStatus = isPaused ? 'running' : 'paused';
        this.updateStatus(isPaused ? 'Running' : 'Paused', newStatus);
        
        this.showNotification(`Automation ${isPaused ? 'resumed' : 'paused'}`, 'info');
        
      } else {
        throw new Error(response.error || `Failed to ${actionText.toLowerCase()}`);
      }
      
    } catch (error) {
      console.error('Failed to pause/resume automation:', error);
      this.showNotification(`Failed to pause/resume: ${error.message}`, 'error');
    } finally {
      // Reset pause button
      const pauseBtn = document.getElementById('pauseBtn');
      pauseBtn.disabled = false;
      this.updatePauseButton();
    }
  }

  /**
   * Handle setting changes
   */
  async handleSettingChange(settingName, value) {
    try {
      console.log(`⚙️ Setting ${settingName} = ${value}`);
      
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTING',
        data: { [settingName]: value }
      });
      
      if (response.success) {
        this.showNotification(`${this.formatSettingName(settingName)} ${value ? 'enabled' : 'disabled'}`, 'info');
      } else {
        throw new Error(response.error || 'Failed to update setting');
      }
      
    } catch (error) {
      console.error('Failed to update setting:', error);
      this.showNotification(`Failed to update setting: ${error.message}`, 'error');
    }
  }

  /**
   * Load current session status
   */
  async loadSessionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SESSION_STATUS'
      });
      
      if (response.success && response.data) {
        this.sessionStatus = response.data;
        this.updateUIFromStatus();
      } else {
        // No active session
        this.sessionStatus = null;
        this.updateStatus('Idle', 'idle');
        this.showIdleControls();
      }
      
    } catch (error) {
      console.error('Failed to load session status:', error);
    }
  }

  /**
   * Update UI based on session status
   */
  updateUIFromStatus() {
    if (!this.sessionStatus) {
      this.updateStatus('Idle', 'idle');
      this.showIdleControls();
      return;
    }
    
    const { status, progress, duration } = this.sessionStatus;
    
    // Update status badge
    this.updateStatus(this.formatStatusText(status), status);
    
    // Show appropriate controls
    if (status === 'running' || status === 'paused') {
      this.showRunningControls();
    } else {
      this.showIdleControls();
    }
    
    // Update progress if available
    if (progress) {
      this.updateProgressDisplay(progress);
    }
  }

  /**
   * Update status badge
   */
  updateStatus(text, statusClass) {
    const statusBadge = document.getElementById('status');
    if (statusBadge) {
      statusBadge.textContent = text;
      statusBadge.className = `status-badge ${statusClass}`;
    }
  }

  /**
   * Show idle controls
   */
  showIdleControls() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const runningControls = document.getElementById('runningControls');
    
    if (startBtn) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = false;
      startBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 3L13 8L5 13V3Z"/>
        </svg>
        Start Automation
      `;
    }
    
    if (stopBtn) {
      stopBtn.classList.add('hidden');
    }
    
    if (runningControls) {
      runningControls.classList.add('hidden');
    }
  }

  /**
   * Show running controls
   */
  showRunningControls() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const runningControls = document.getElementById('runningControls');
    
    if (startBtn) {
      startBtn.classList.add('hidden');
    }
    
    if (stopBtn) {
      stopBtn.classList.remove('hidden');
      stopBtn.disabled = false;
      stopBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="4" y="4" width="8" height="8"/>
        </svg>
        Stop
      `;
    }
    
    if (runningControls) {
      runningControls.classList.remove('hidden');
    }
    
    this.updatePauseButton();
  }

  /**
   * Update pause button text
   */
  updatePauseButton() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (!pauseBtn) return;
    
    const isPaused = this.sessionStatus?.status === 'paused';
    
    pauseBtn.innerHTML = isPaused ? `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M5 3L13 8L5 13V3Z"/>
      </svg>
      Resume
    ` : `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="5" y="4" width="2" height="8"/>
        <rect x="9" y="4" width="2" height="8"/>
      </svg>
      Pause
    `;
  }

  /**
   * Disable all controls
   */
  disableControls() {
    const controls = document.querySelectorAll('#startBtn, #stopBtn, #pauseBtn, #scenarioSelector');
    controls.forEach(control => {
      if (control) control.disabled = true;
    });
  }

  /**
   * Update progress display
   */
  updateProgressDisplay(progressData) {
    // Update progress bars in monitor tab
    const progressItems = document.querySelectorAll('.progress-item');
    
    progressItems.forEach((item, index) => {
      const progressFill = item.querySelector('.progress-fill');
      const progressValue = item.querySelector('.progress-value');
      
      if (progressFill && progressValue) {
        let percentage = 0;
        let valueText = '';
        
        switch (index) {
          case 0: // Products Viewed
            if (progressData.products_viewed !== undefined) {
              const total = progressData.products_viewed_target || 20;
              percentage = (progressData.products_viewed / total) * 100;
              valueText = `${progressData.products_viewed} / ${total}`;
            }
            break;
            
          case 1: // Time Elapsed
            if (progressData.duration !== undefined) {
              const totalTime = progressData.target_duration || 1800000; // 30 min default
              percentage = (progressData.duration / totalTime) * 100;
              valueText = `${this.formatDuration(progressData.duration)} / ${this.formatDuration(totalTime)}`;
            }
            break;
            
          case 2: // Overall Progress
            if (progressData.overall_progress !== undefined) {
              percentage = progressData.overall_progress;
              valueText = `${Math.round(percentage)}%`;
            }
            break;
        }
        
        progressFill.style.width = `${Math.min(percentage, 100)}%`;
        progressValue.textContent = valueText;
      }
    });
  }

  /**
   * Start periodic updates
   */
  startPeriodicUpdates() {
    // Update every 2 seconds
    this.updateInterval = setInterval(async () => {
      await this.loadSessionStatus();
      if (this.sessionStatus) {
        this.updateActivityLog();
      }
    }, 2000);
  }

  /**
   * Update activity log
   */
  updateActivityLog() {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    
    // Simulate activity updates (in real implementation, get from background)
    const activities = [
      'Scrolling page content...',
      'Hovering over product card',
      'Clicking navigation menu',
      'Reading product description',
      'Checking price information',
      'Adding item to wishlist',
      'Navigating to new page',
      'Executing micro action sequence'
    ];
    
    // Add new activity occasionally
    if (Math.random() < 0.3) {
      const randomActivity = activities[Math.floor(Math.random() * activities.length)];
      this.addActivityLog(randomActivity);
    }
  }

  /**
   * Add activity log entry
   */
  addActivityLog(message) {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    
    const newLine = document.createElement('div');
    newLine.className = 'activity-line recent';
    newLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    // Remove recent class from other lines
    activityLog.querySelectorAll('.recent').forEach(line => {
      line.classList.remove('recent');
    });
    
    activityLog.appendChild(newLine);
    activityLog.scrollTop = activityLog.scrollHeight;
    
    // Keep only last 20 lines
    while (activityLog.children.length > 20) {
      activityLog.removeChild(activityLog.firstChild);
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.getNotificationColor(type)};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-weight: 600;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  /**
   * Get notification color
   */
  getNotificationColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#667eea'
    };
    return colors[type] || colors.info;
  }

  /**
   * Open options page
   */
  openOptionsPage() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  /**
   * Open help page
   */
  openHelpPage() {
    chrome.tabs.create({
      url: 'https://github.com/your-username/web-automation-extension/wiki'
    });
    window.close();
  }

  /**
   * Get website type icon
   */
  getWebsiteTypeIcon(type) {
    const icons = {
      'ecommerce': '🛒',
      'social': '💬',
      'news': '📰',
      'video': '🎥',
      'search': '🔍',
      'other': '🌐'
    };
    return icons[type] || icons.other;
  }

  /**
   * Get scenario icon
   */
  getScenarioIcon(scenario) {
    if (scenario.name.toLowerCase().includes('shop')) return '🛒';
    if (scenario.name.toLowerCase().includes('browse')) return '👀';
    if (scenario.name.toLowerCase().includes('quick')) return '⚡';
    if (scenario.name.toLowerCase().includes('social')) return '💬';
    return '🎯';
  }

  /**
   * Get metric icon
   */
  getMetricIcon(metric) {
    const icons = {
      'products_viewed': '👁️',
      'pages_visited': '📄',
      'actions_performed': '🎯',
      'cart_interactions': '🛒',
      'engagement_score': '💡',
      'time_spent': '⏱️'
    };
    return icons[metric] || '📊';
  }

  /**
   * Format metric label
   */
  formatMetricLabel(metric) {
    const labels = {
      'products_viewed': 'Products Viewed',
      'pages_visited': 'Pages Visited',
      'actions_performed': 'Actions Performed',
      'cart_interactions': 'Cart Interactions',
      'engagement_score': 'Engagement Score',
      'time_spent': 'Time Spent'
    };
    return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Format setting name
   */
  formatSettingName(settingName) {
    const names = {
      'debugMode': 'Debug Mode',
      'slowMode': 'Slow Mode',
      'screenshotMode': 'Screenshot Mode'
    };
    return names[settingName] || settingName;
  }

  /**
   * Format status text
   */
  formatStatusText(status) {
    const statusTexts = {
      'idle': 'Idle',
      'running': 'Running',
      'paused': 'Paused',
      'completed': 'Completed',
      'error': 'Error'
    };
    return statusTexts[status] || status;
  }

  /**
   * Format duration in milliseconds to readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  }

  /**
   * Cleanup when popup closes
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.automationPopup = new AutomationPopup();
});

// Cleanup when window unloads
window.addEventListener('beforeunload', () => {
  if (window.automationPopup) {
    window.automationPopup.destroy();
  }
});