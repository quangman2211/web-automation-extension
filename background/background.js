// Main Service Worker for Web Automation Extension
import { ConfigManager } from './modules/config-manager.js';
import { SessionManager } from './modules/session-manager.js';
import { StorageManager } from './modules/storage-manager.js';
import { WebsiteDetector } from './modules/website-detector.js';

class AutomationBackground {
  constructor() {
    this.configManager = new ConfigManager();
    this.sessionManager = new SessionManager();
    this.storageManager = new StorageManager();
    this.websiteDetector = new WebsiteDetector();
    
    this.init();
  }

  async init() {
    console.log('🚀 Web Automation Extension loaded');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize default configurations
    await this.initializeDefaultConfigs();
    
    // Setup periodic cleanup
    this.setupPeriodicTasks();
  }

  setupEventListeners() {
    // Extension installation/update
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
    
    // Tab updates for website detection
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Message handling from popup/content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Storage changes
    chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
  }

  async handleInstall(details) {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
      // First time installation
      await this.storageManager.setDefaultSettings();
      await this.showWelcomeTab();
    } else if (details.reason === 'update') {
      // Extension updated
      await this.handleUpdate(details.previousVersion);
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      try {
        // Detect website and update popup
        const websiteConfig = await this.websiteDetector.detectWebsite(tab.url);
        
        if (websiteConfig) {
          console.log(`📍 Detected website: ${websiteConfig.name}`);
          
          // Update extension icon
          await this.updateExtensionIcon(tabId, websiteConfig.type);
          
          // Store current website info
          await this.storageManager.setCurrentWebsite(tabId, websiteConfig);
          
          // Inject website-specific content script if needed
          await this.injectWebsiteScript(tabId, websiteConfig);
        }
      } catch (error) {
        console.error('Error in tab update handler:', error);
      }
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('📩 Received message:', message.type);
    
    try {
      switch (message.type) {
        case 'GET_WEBSITE_CONFIG':
          return await this.getWebsiteConfig(sender.tab?.id);
          
        case 'START_AUTOMATION':
          return await this.startAutomation(message.data, sender.tab?.id);
          
        case 'STOP_AUTOMATION':
          return await this.stopAutomation(sender.tab?.id);
          
        case 'PAUSE_AUTOMATION':
          return await this.pauseAutomation(sender.tab?.id);
          
        case 'GET_SESSION_STATUS':
          return await this.getSessionStatus(sender.tab?.id);
          
        case 'UPDATE_PROGRESS':
          return await this.updateProgress(message.data, sender.tab?.id);
          
        case 'LOG_ACTION':
          return await this.logAction(message.data, sender.tab?.id);
          
        case 'SAVE_CONFIG':
          return await this.saveConfig(message.data);
          
        case 'EXPORT_DATA':
          return await this.exportData();
          
        case 'IMPORT_DATA':
          return await this.importData(message.data);
          
        default:
          console.warn('Unknown message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  }

  async handleStorageChange(changes, namespace) {
    console.log('💾 Storage changed:', changes);
    
    if (changes.settings) {
      // Settings updated, notify all tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          data: changes.settings.newValue
        }).catch(() => {}); // Ignore errors for tabs without content script
      }
    }
  }

  async initializeDefaultConfigs() {
    // Load default website configurations
    const defaultConfigs = [
      'amazon.json',
      'facebook.json',
      'simple-example.json'
    ];

    for (const configFile of defaultConfigs) {
      try {
        const response = await fetch(chrome.runtime.getURL(`configs/${configFile}`));
        const config = await response.json();
        await this.configManager.saveWebsiteConfig(config);
        console.log(`✅ Loaded config: ${configFile}`);
      } catch (error) {
        console.error(`❌ Failed to load config ${configFile}:`, error);
      }
    }
  }

  async updateExtensionIcon(tabId, websiteType) {
    const iconMap = {
      'ecommerce': 'icons/icon-ecommerce.png',
      'social': 'icons/icon-social.png',
      'news': 'icons/icon-news.png',
      'video': 'icons/icon-video.png',
      'default': 'icons/icon-32.png'
    };

    const iconPath = iconMap[websiteType] || iconMap.default;
    
    try {
      await chrome.action.setIcon({
        tabId: tabId,
        path: iconPath
      });
    } catch (error) {
      console.error('Failed to update icon:', error);
    }
  }

  async getWebsiteConfig(tabId) {
    const tab = await chrome.tabs.get(tabId);
    const websiteConfig = await this.websiteDetector.detectWebsite(tab.url);
    
    return {
      success: true,
      data: websiteConfig
    };
  }

  async startAutomation(data, tabId) {
    try {
      const { scenarioId, websiteConfig } = data;
      
      // Create new session
      const session = await this.sessionManager.createSession({
        tabId,
        scenarioId,
        websiteConfig,
        startTime: Date.now()
      });

      // Send start command to content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_AUTOMATION',
        data: {
          sessionId: session.id,
          scenario: websiteConfig.scenarios[scenarioId],
          selectors: websiteConfig.selectors
        }
      });

      console.log(`🎬 Started automation session: ${session.id}`);
      
      return {
        success: true,
        data: { sessionId: session.id }
      };
    } catch (error) {
      console.error('Failed to start automation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async stopAutomation(tabId) {
    try {
      const session = await this.sessionManager.getActiveSession(tabId);
      
      if (session) {
        await this.sessionManager.endSession(session.id);
        
        // Send stop command to content script
        await chrome.tabs.sendMessage(tabId, {
          type: 'STOP_AUTOMATION'
        });
        
        console.log(`🛑 Stopped automation session: ${session.id}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to stop automation:', error);
      return { success: false, error: error.message };
    }
  }

  async pauseAutomation(tabId) {
    try {
      const session = await this.sessionManager.getActiveSession(tabId);
      
      if (session) {
        await this.sessionManager.pauseSession(session.id);
        
        // Send pause command to content script
        await chrome.tabs.sendMessage(tabId, {
          type: 'PAUSE_AUTOMATION'
        });
        
        console.log(`⏸️ Paused automation session: ${session.id}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to pause automation:', error);
      return { success: false, error: error.message };
    }
  }

  async getSessionStatus(tabId) {
    try {
      const session = await this.sessionManager.getActiveSession(tabId);
      return {
        success: true,
        data: session
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateProgress(data, tabId) {
    try {
      const session = await this.sessionManager.getActiveSession(tabId);
      
      if (session) {
        await this.sessionManager.updateProgress(session.id, data);
        
        // Notify popup if open
        chrome.runtime.sendMessage({
          type: 'PROGRESS_UPDATED',
          data: { sessionId: session.id, progress: data }
        }).catch(() => {}); // Ignore if popup not open
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async logAction(data, tabId) {
    try {
      const session = await this.sessionManager.getActiveSession(tabId);
      
      if (session) {
        await this.sessionManager.logAction(session.id, {
          ...data,
          timestamp: Date.now()
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveConfig(configData) {
    try {
      await this.configManager.saveWebsiteConfig(configData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async exportData() {
    try {
      const data = await this.storageManager.exportAllData();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async importData(data) {
    try {
      await this.storageManager.importAllData(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async injectWebsiteScript(tabId, websiteConfig) {
    // Inject additional scripts if needed for specific websites
    if (websiteConfig.customScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [`content/modules/${websiteConfig.customScript}`]
        });
      } catch (error) {
        console.error('Failed to inject custom script:', error);
      }
    }
  }

  async showWelcomeTab() {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html?welcome=true')
    });
  }

  async handleUpdate(previousVersion) {
    console.log(`📦 Updated from version ${previousVersion}`);
    
    // Handle version-specific updates
    await this.storageManager.migrateData(previousVersion);
  }

  setupPeriodicTasks() {
    // Cleanup old sessions every hour
    setInterval(async () => {
      await this.sessionManager.cleanupOldSessions();
    }, 60 * 60 * 1000);

    // Update extension badge with active sessions count
    setInterval(async () => {
      const activeSessions = await this.sessionManager.getActiveSessions();
      const badgeText = activeSessions.length > 0 ? activeSessions.length.toString() : '';
      
      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    }, 10000);
  }
}

// Initialize the background service
new AutomationBackground();