/**
 * Storage Manager - Handle all Chrome storage operations
 */
export class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      SETTINGS: 'wa_settings',
      WEBSITES: 'wa_websites',
      SESSIONS: 'wa_sessions',
      CURRENT_WEBSITE: 'wa_current_website',
      USER_DATA: 'wa_user_data'
    };

    this.DEFAULT_SETTINGS = {
      debugMode: false,
      slowMode: false,
      screenshotMode: true,
      notificationMode: true,
      sessionTimeout: 45, // minutes
      retryLimit: 3,
      autoStart: false,
      theme: 'system'
    };
  }

  /**
   * Set default settings on installation
   */
  async setDefaultSettings() {
    try {
      const existing = await this.getSettings();
      if (!existing) {
        await chrome.storage.sync.set({
          [this.STORAGE_KEYS.SETTINGS]: this.DEFAULT_SETTINGS
        });
        console.log('✅ Default settings initialized');
      }
    } catch (error) {
      console.error('Failed to set default settings:', error);
    }
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.SETTINGS);
      return result[this.STORAGE_KEYS.SETTINGS] || this.DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  }

  /**
   * Update specific setting
   */
  async updateSetting(key, value) {
    try {
      const settings = await this.getSettings();
      settings[key] = value;
      
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.SETTINGS]: settings
      });
      
      console.log(`⚙️ Updated setting: ${key} = ${value}`);
      return true;
    } catch (error) {
      console.error('Failed to update setting:', error);
      return false;
    }
  }

  /**
   * Save multiple settings at once
   */
  async saveSettings(newSettings) {
    try {
      const currentSettings = await this.getSettings();
      const mergedSettings = { ...currentSettings, ...newSettings };
      
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.SETTINGS]: mergedSettings
      });
      
      console.log('⚙️ Settings saved:', Object.keys(newSettings));
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Get all website configurations
   */
  async getWebsiteConfigs() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.WEBSITES);
      return result[this.STORAGE_KEYS.WEBSITES] || {};
    } catch (error) {
      console.error('Failed to get website configs:', error);
      return {};
    }
  }

  /**
   * Get specific website configuration
   */
  async getWebsiteConfig(domain) {
    try {
      const configs = await this.getWebsiteConfigs();
      return configs[domain] || null;
    } catch (error) {
      console.error('Failed to get website config:', error);
      return null;
    }
  }

  /**
   * Save website configuration
   */
  async saveWebsiteConfig(domain, config) {
    try {
      const configs = await this.getWebsiteConfigs();
      configs[domain] = {
        ...config,
        lastUpdated: new Date().toISOString(),
        version: config.version || '1.0.0'
      };
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.WEBSITES]: configs
      });
      
      console.log(`💾 Saved website config: ${domain}`);
      return true;
    } catch (error) {
      console.error('Failed to save website config:', error);
      return false;
    }
  }

  /**
   * Delete website configuration
   */
  async deleteWebsiteConfig(domain) {
    try {
      const configs = await this.getWebsiteConfigs();
      delete configs[domain];
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.WEBSITES]: configs
      });
      
      console.log(`🗑️ Deleted website config: ${domain}`);
      return true;
    } catch (error) {
      console.error('Failed to delete website config:', error);
      return false;
    }
  }

  /**
   * Set current website for a tab
   */
  async setCurrentWebsite(tabId, websiteInfo) {
    try {
      const currentWebsites = await this.getCurrentWebsites();
      currentWebsites[tabId] = {
        ...websiteInfo,
        detectedAt: Date.now()
      };
      
      await chrome.storage.session.set({
        [this.STORAGE_KEYS.CURRENT_WEBSITE]: currentWebsites
      });
      
      return true;
    } catch (error) {
      console.error('Failed to set current website:', error);
      return false;
    }
  }

  /**
   * Get current website for a tab
   */
  async getCurrentWebsite(tabId) {
    try {
      const currentWebsites = await this.getCurrentWebsites();
      return currentWebsites[tabId] || null;
    } catch (error) {
      console.error('Failed to get current website:', error);
      return null;
    }
  }

  /**
   * Get all current websites
   */
  async getCurrentWebsites() {
    try {
      const result = await chrome.storage.session.get(this.STORAGE_KEYS.CURRENT_WEBSITE);
      return result[this.STORAGE_KEYS.CURRENT_WEBSITE] || {};
    } catch (error) {
      console.error('Failed to get current websites:', error);
      return {};
    }
  }

  /**
   * Save session data
   */
  async saveSession(sessionId, sessionData) {
    try {
      const sessions = await this.getSessions();
      sessions[sessionId] = {
        ...sessionData,
        lastUpdated: Date.now()
      };
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.SESSIONS]: sessions
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    try {
      const sessions = await this.getSessions();
      return sessions[sessionId] || null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Get all sessions
   */
  async getSessions() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.SESSIONS);
      return result[this.STORAGE_KEYS.SESSIONS] || {};
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return {};
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    try {
      const sessions = await this.getSessions();
      delete sessions[sessionId];
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.SESSIONS]: sessions
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Clean up old sessions (older than 24 hours)  
   */
  async cleanupOldSessions() {
    try {
      const sessions = await this.getSessions();
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      let cleanedCount = 0;
      
      for (const [sessionId, session] of Object.entries(sessions)) {
        if (now - session.lastUpdated > maxAge) {
          delete sessions[sessionId];
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.SESSIONS]: sessions
        });
        
        console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
      return 0;
    }
  }

  /**
   * Export all data for backup
   */
  async exportAllData() {
    try {
      const [settings, websites, sessions] = await Promise.all([
        this.getSettings(),
        this.getWebsiteConfigs(),
        this.getSessions()
      ]);
      
      const exportData = {
        version: '2.1.0',
        exportDate: new Date().toISOString(),
        data: {
          settings,
          websites,
          sessions: Object.fromEntries(
            Object.entries(sessions).filter(([id, session]) => {
              // Only export sessions from last 7 days
              const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
              return session.lastUpdated > weekAgo;
            })
          )
        }
      };
      
      console.log('📤 Exported all data');
      return exportData;
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Import data from backup
   */
  async importAllData(importData) {
    try {
      if (!importData || !importData.data) {
        throw new Error('Invalid import data format');
      }
      
      const { settings, websites, sessions } = importData.data;
      
      // Import settings (merge with current)
      if (settings) {
        await this.saveSettings(settings);
      }
      
      // Import website configs
      if (websites) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.WEBSITES]: websites
        });
      }
      
      // Import sessions (merge with current)
      if (sessions) {
        const currentSessions = await this.getSessions();
        const mergedSessions = { ...currentSessions, ...sessions };
        
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.SESSIONS]: mergedSessions
        });
      }
      
      console.log('📥 Imported all data successfully');
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * Clear all extension data
   */
  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      await chrome.storage.session.clear();
      
      // Reset to defaults
      await this.setDefaultSettings();
      
      console.log('🗑️ Cleared all extension data');
      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    try {
      const [localUsed, syncUsed] = await Promise.all([
        chrome.storage.local.getBytesInUse(),
        chrome.storage.sync.getBytesInUse()
      ]);
      
      return {
        local: {
          used: localUsed,
          quota: chrome.storage.local.QUOTA_BYTES,
          percentage: (localUsed / chrome.storage.local.QUOTA_BYTES) * 100
        },
        sync: {
          used: syncUsed,
          quota: chrome.storage.sync.QUOTA_BYTES,
          percentage: (syncUsed / chrome.storage.sync.QUOTA_BYTES) * 100
        }
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return null;
    }
  }

  /**
   * Migrate data between versions
   */
  async migrateData(fromVersion) {
    try {
      console.log(`🔄 Migrating data from version ${fromVersion}`);
      
      // Add version-specific migration logic here
      if (fromVersion && fromVersion < '2.0.0') {
        // Migrate from v1.x to v2.x
        await this.migrateFromV1();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to migrate data:', error);
      return false;
    }
  }

  /**
   * Migration helper for v1.x to v2.x
   */
  async migrateFromV1() {
    // Implementation for migrating old data structure
    console.log('🔄 Migrating from v1.x to v2.x');
    
    // Example migration logic
    try {
      const oldData = await chrome.storage.local.get(null);
      
      // Transform old data structure to new format
      // This is where you'd implement the actual migration logic
      
      console.log('✅ Migration from v1.x completed');
    } catch (error) {
      console.error('❌ Migration from v1.x failed:', error);
      throw error;
    }
  }
}