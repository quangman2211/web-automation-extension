/**
 * Configuration Manager - Handle website configurations and scenarios
 */
export class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.templates = new Map();
    this.lastLoadTime = 0;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load website configuration by domain
   */
  async loadWebsiteConfig(domain) {
    try {
      // Check cache first
      if (this.configs.has(domain) && this.isCacheValid()) {
        return this.configs.get(domain);
      }

      // Load from storage
      const result = await chrome.storage.local.get('wa_websites');
      const websites = result.wa_websites || {};
      
      if (websites[domain]) {
        const config = this.processConfig(websites[domain]);
        this.configs.set(domain, config);
        return config;
      }

      return null;
    } catch (error) {
      console.error('Failed to load website config:', error);
      return null;
    }
  }

  /**
   * Save website configuration
   */
  async saveWebsiteConfig(config) {
    try {
      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      const domain = config.website.domain;
      
      // Process and enhance config
      const processedConfig = this.processConfig(config);
      
      // Load existing configs
      const result = await chrome.storage.local.get('wa_websites');
      const websites = result.wa_websites || {};
      
      // Update config
      websites[domain] = {
        ...processedConfig,
        lastUpdated: new Date().toISOString(),
        version: processedConfig.version || '1.0.0'
      };
      
      // Save to storage
      await chrome.storage.local.set({ wa_websites: websites });
      
      // Update cache
      this.configs.set(domain, processedConfig);
      this.lastLoadTime = Date.now();
      
      console.log(`✅ Website configuration saved: ${domain}`);
      return true;
      
    } catch (error) {
      console.error('Failed to save website config:', error);
      throw error;
    }
  }

  /**
   * Get all website configurations
   */
  async getAllConfigs() {
    try {
      const result = await chrome.storage.local.get('wa_websites');
      const websites = result.wa_websites || {};
      
      // Process each config
      const processedConfigs = {};
      for (const [domain, config] of Object.entries(websites)) {
        processedConfigs[domain] = this.processConfig(config);
      }
      
      return processedConfigs;
    } catch (error) {
      console.error('Failed to get all configs:', error);
      return {};
    }
  }

  /**
   * Delete website configuration
   */
  async deleteWebsiteConfig(domain) {
    try {
      const result = await chrome.storage.local.get('wa_websites');
      const websites = result.wa_websites || {};
      
      if (websites[domain]) {
        delete websites[domain];
        await chrome.storage.local.set({ wa_websites: websites });
        
        // Remove from cache
        this.configs.delete(domain);
        
        console.log(`🗑️ Website configuration deleted: ${domain}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete website config:', error);
      return false;
    }
  }

  /**
   * Process and enhance configuration
   */
  processConfig(config) {
    const processed = JSON.parse(JSON.stringify(config)); // Deep clone
    
    // Add default values
    processed.website = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      ...processed.website
    };
    
    // Process selectors
    if (processed.selectors) {
      processed.selectors = this.processSelectors(processed.selectors);
    }
    
    // Process scenarios
    if (processed.scenarios) {
      processed.scenarios = this.processScenarios(processed.scenarios);
    }
    
    // Add metadata
    processed._metadata = {
      processedAt: Date.now(),
      version: '2.1.0'
    };
    
    return processed;
  }

  /**
   * Process selectors with validation and fallbacks
   */
  processSelectors(selectors) {
    const processed = { ...selectors };
    
    // Ensure global selectors exist
    if (!processed.global) {
      processed.global = {};
    }
    
    // Process page selectors
    if (processed.pages) {
      for (const [pageName, pageSelectors] of Object.entries(processed.pages)) {
        processed.pages[pageName] = this.processPageSelectors(pageSelectors);
      }
    }
    
    return processed;
  }

  /**
   * Process page selectors
   */
  processPageSelectors(pageSelectors) {
    const processed = { ...pageSelectors };
    
    // Ensure required properties exist
    if (!processed.identifiers) {
      processed.identifiers = {};
    }
    
    if (!processed.elements) {
      processed.elements = {};
    }
    
    // Process URL pattern
    if (processed.url_pattern && typeof processed.url_pattern === 'string') {
      try {
        // Validate regex pattern
        new RegExp(processed.url_pattern);
      } catch (error) {
        console.warn('Invalid URL pattern:', processed.url_pattern);
        processed.url_pattern = '.*'; // Fallback to match all
      }
    }
    
    return processed;
  }

  /**
   * Process scenarios with validation and defaults
   */
  processScenarios(scenarios) {
    const processed = {};
    
    for (const [scenarioId, scenario] of Object.entries(scenarios)) {
      processed[scenarioId] = this.processScenario(scenario, scenarioId);
    }
    
    return processed;
  }

  /**
   * Process individual scenario
   */
  processScenario(scenario, scenarioId) {
    const processed = {
      id: scenarioId,
      enabled: true,
      ...scenario
    };
    
    // Ensure required properties
    if (!processed.goals) {
      processed.goals = {
        session_duration: { min: 5, max: 15, unit: 'minutes' }
      };
    }
    
    if (!processed.pages) {
      processed.pages = {};
    }
    
    // Process pages
    for (const [pageName, pageConfig] of Object.entries(processed.pages)) {
      processed.pages[pageName] = this.processPageConfig(pageConfig);
    }
    
    // Add default decision rules if missing
    if (!processed.decision_rules) {
      processed.decision_rules = {
        action_selection: {
          method: 'weighted_random'
        }
      };
    }
    
    return processed;
  }

  /**
   * Process page configuration
   */
  processPageConfig(pageConfig) {
    const processed = { ...pageConfig };
    
    // Ensure stay duration
    if (!processed.stay_duration) {
      processed.stay_duration = { min: 2, max: 5, unit: 'seconds' };
    }
    
    // Ensure actions structure
    if (!processed.actions) {
      processed.actions = {
        non_navigation: [],
        navigation: []
      };
    }
    
    // Process actions
    if (processed.actions.non_navigation) {
      processed.actions.non_navigation = processed.actions.non_navigation.map(action => 
        this.processAction(action)
      );
    }
    
    if (processed.actions.navigation) {
      processed.actions.navigation = processed.actions.navigation.map(action => 
        this.processAction(action)
      );
    }
    
    return processed;
  }

  /**
   * Process action configuration
   */
  processAction(action) {
    const processed = {
      probability: 0.5,
      impact: {},
      conditions: {},
      micro_sequence: [],
      ...action
    };
    
    // Validate probability
    if (processed.probability < 0 || processed.probability > 1) {
      processed.probability = Math.max(0, Math.min(1, processed.probability));
    }
    
    // Process micro sequence
    if (processed.micro_sequence) {
      processed.micro_sequence = processed.micro_sequence.map(microAction => 
        this.processMicroAction(microAction)
      );
    }
    
    return processed;
  }

  /**
   * Process micro action
   */
  processMicroAction(microAction) {
    const processed = { ...microAction };
    
    // Add default duration for wait actions
    if (processed.type === 'wait' && !processed.duration) {
      processed.duration = '1-2s';
    }
    
    // Add default speed for movement actions
    if (['move', 'scroll'].includes(processed.type) && !processed.speed) {
      processed.speed = 'normal';
    }
    
    // Add default pattern for move actions
    if (processed.type === 'move' && !processed.pattern) {
      processed.pattern = 'natural';
    }
    
    return processed;
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    const errors = [];
    
    // Check required top-level properties
    if (!config.website) {
      errors.push('Missing website information');
    } else {
      if (!config.website.name) errors.push('Missing website name');
      if (!config.website.domain) errors.push('Missing website domain');
      if (!config.website.type) errors.push('Missing website type');
    }
    
    // Validate domain format
    if (config.website?.domain) {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(config.website.domain)) {
        errors.push('Invalid domain format');
      }
    }
    
    // Check selectors
    if (!config.selectors) {
      errors.push('Missing selectors');
    } else {
      if (!config.selectors.pages) {
        errors.push('Missing page selectors');
      }
    }
    
    // Check scenarios
    if (!config.scenarios) {
      errors.push('Missing scenarios');
    } else {
      const scenarioCount = Object.keys(config.scenarios).length;
      if (scenarioCount === 0) {
        errors.push('No scenarios defined');
      }
      
      // Validate each scenario
      for (const [scenarioId, scenario] of Object.entries(config.scenarios)) {
        const scenarioErrors = this.validateScenario(scenario, scenarioId);
        errors.push(...scenarioErrors);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual scenario
   */
  validateScenario(scenario, scenarioId) {
    const errors = [];
    
    if (!scenario.name) {
      errors.push(`Scenario ${scenarioId}: Missing name`);
    }
    
    if (!scenario.pages) {
      errors.push(`Scenario ${scenarioId}: Missing pages`);
    } else {
      // Validate each page
      for (const [pageName, pageConfig] of Object.entries(scenario.pages)) {
        const pageErrors = this.validatePageConfig(pageConfig, scenarioId, pageName);
        errors.push(...pageErrors);
      }
    }
    
    if (scenario.goals) {
      const goalErrors = this.validateGoals(scenario.goals, scenarioId);
      errors.push(...goalErrors);
    }
    
    return errors;
  }

  /**
   * Validate page configuration
   */
  validatePageConfig(pageConfig, scenarioId, pageName) {
    const errors = [];
    
    if (pageConfig.actions) {
      ['non_navigation', 'navigation'].forEach(actionType => {
        if (pageConfig.actions[actionType]) {
          pageConfig.actions[actionType].forEach((action, index) => {
            const actionErrors = this.validateAction(action, scenarioId, pageName, actionType, index);
            errors.push(...actionErrors);
          });
        }
      });
    }
    
    return errors;
  }

  /**
   * Validate action configuration
   */
  validateAction(action, scenarioId, pageName, actionType, index) {
    const errors = [];
    
    if (!action.name) {
      errors.push(`Scenario ${scenarioId}, Page ${pageName}, ${actionType}[${index}]: Missing action name`);
    }
    
    if (action.probability !== undefined) {
      if (typeof action.probability !== 'number' || action.probability < 0 || action.probability > 1) {
        errors.push(`Scenario ${scenarioId}, Page ${pageName}, ${actionType}[${index}]: Invalid probability`);
      }
    }
    
    if (action.micro_sequence) {
      action.micro_sequence.forEach((microAction, microIndex) => {
        if (!microAction.type) {
          errors.push(`Scenario ${scenarioId}, Page ${pageName}, ${actionType}[${index}], micro[${microIndex}]: Missing type`);
        }
      });
    }
    
    return errors;
  }

  /**
   * Validate goals configuration
   */
  validateGoals(goals, scenarioId) {
    const errors = [];
    
    if (goals.session_duration) {
      const duration = goals.session_duration;
      if (!duration.min || !duration.max || !duration.unit) {
        errors.push(`Scenario ${scenarioId}: Invalid session_duration format`);
      }
      
      if (duration.min >= duration.max) {
        errors.push(`Scenario ${scenarioId}: session_duration min must be less than max`);
      }
    }
    
    return errors;
  }

  /**
   * Load configuration template
   */
  async loadTemplate(templateName) {
    try {
      if (this.templates.has(templateName)) {
        return this.templates.get(templateName);
      }
      
      const response = await fetch(chrome.runtime.getURL(`templates/${templateName}.json`));
      if (!response.ok) {
        throw new Error(`Template not found: ${templateName}`);
      }
      
      const template = await response.json();
      this.templates.set(templateName, template);
      
      return template;
    } catch (error) {
      console.error('Failed to load template:', error);
      return null;
    }
  }

  /**
   * Create configuration from template
   */
  async createFromTemplate(templateName, websiteInfo) {
    try {
      const template = await this.loadTemplate(templateName);
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }
      
      // Clone template
      const config = JSON.parse(JSON.stringify(template));
      
      // Update with website info
      config.website = {
        ...config.website,
        ...websiteInfo,
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      };
      
      return config;
    } catch (error) {
      console.error('Failed to create from template:', error);
      throw error;
    }
  }

  /**
   * Export configuration as JSON
   */
  async exportConfig(domain) {
    try {
      const config = await this.loadWebsiteConfig(domain);
      if (!config) {
        throw new Error(`Configuration not found: ${domain}`);
      }
      
      // Clean up internal metadata for export
      const exportConfig = { ...config };
      delete exportConfig._metadata;
      
      return {
        ...exportConfig,
        exportedAt: new Date().toISOString(),
        exportVersion: '2.1.0'
      };
    } catch (error) {
      console.error('Failed to export config:', error);
      throw error;
    }
  }

  /**
   * Import configuration from JSON
   */
  async importConfig(configData) {
    try {
      // Validate imported data
      if (!configData.website?.domain) {
        throw new Error('Invalid configuration: missing domain');
      }
      
      // Remove export metadata
      const cleanConfig = { ...configData };
      delete cleanConfig.exportedAt;
      delete cleanConfig.exportVersion;
      
      // Save configuration
      await this.saveWebsiteConfig(cleanConfig);
      
      return cleanConfig.website.domain;
    } catch (error) {
      console.error('Failed to import config:', error);
      throw error;
    }
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return [
      {
        name: 'ecommerce-template',
        displayName: 'E-commerce Template',
        description: 'Template for online shopping websites',
        icon: '🛒'
      },
      {
        name: 'social-template',
        displayName: 'Social Media Template',
        description: 'Template for social networking sites',
        icon: '💬'
      },
      {
        name: 'news-template',
        displayName: 'News Website Template',
        description: 'Template for news and media sites',
        icon: '📰'
      },
      {
        name: 'video-template',
        displayName: 'Video Platform Template',
        description: 'Template for video streaming sites',
        icon: '🎥'
      }
    ];
  }

  /**
   * Check if cache is valid
   */
  isCacheValid() {
    return Date.now() - this.lastLoadTime < this.CACHE_DURATION;
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configs.clear();
    this.templates.clear();
    this.lastLoadTime = 0;
    console.log('🧹 Configuration cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      configsCount: this.configs.size,
      templatesCount: this.templates.size,
      lastLoadTime: this.lastLoadTime,
      isCacheValid: this.isCacheValid()
    };
  }
}