/**
 * Website Detector - Detect and match websites against configured automation targets
 */
export class WebsiteDetector {
  constructor() {
    this.configCache = new Map();
    this.lastCacheUpdate = 0;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Main method to detect website from URL
   */
  async detectWebsite(url) {
    try {
      if (!url || !this.isValidUrl(url)) {
        return null;
      }

      const parsedUrl = new URL(url);
      const domain = this.extractDomain(parsedUrl.hostname);
      
      // Get website configurations
      const configs = await this.getWebsiteConfigs();
      
      // Try exact domain match first
      let matchedConfig = configs[domain];
      
      if (!matchedConfig) {
        // Try subdomain matching
        matchedConfig = this.findSubdomainMatch(domain, configs);
      }
      
      if (!matchedConfig) {
        // Try pattern matching
        matchedConfig = this.findPatternMatch(url, configs);
      }
      
      if (matchedConfig) {
        return {
          ...matchedConfig,
          currentUrl: url,
          domain: domain,
          detectedAt: Date.now(),
          matchType: this.getMatchType(domain, matchedConfig)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting website:', error);
      return null;
    }
  }

  /**
   * Check if URL is valid for automation
   */
  isValidUrl(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Only http/https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }
      
      // Exclude Chrome internal pages
      if (parsedUrl.hostname.includes('chrome://') || 
          parsedUrl.hostname.includes('chrome-extension://') ||
          parsedUrl.hostname.includes('chrome-search://')) {
        return false;
      }
      
      // Exclude localhost in production (configurable)
      if (parsedUrl.hostname === 'localhost' || 
          parsedUrl.hostname === '127.0.0.1') {
        const settings = await this.getSettings();
        return settings?.allowLocalhost || false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract main domain from hostname
   */
  extractDomain(hostname) {
    // Remove www. prefix
    const domain = hostname.replace(/^www\./, '');
    
    // For subdomains, you might want to extract the main domain
    // This is a simplified version - for production, consider using a library
    const parts = domain.split('.');
    
    if (parts.length <= 2) {
      return domain;
    }
    
    // For common TLDs, return last two parts
    const commonTLDs = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int'];
    const lastPart = parts[parts.length - 1];
    
    if (commonTLDs.includes(lastPart)) {
      return parts.slice(-2).join('.');
    }
    
    // For country TLDs like .co.uk, .com.au
    if (parts.length >= 3) {
      const secondLastPart = parts[parts.length - 2];
      if (['co', 'com', 'org', 'net', 'edu', 'gov'].includes(secondLastPart)) {
        return parts.slice(-3).join('.');
      }
    }
    
    return parts.slice(-2).join('.');
  }

  /**
   * Find configuration by subdomain matching
   */
  findSubdomainMatch(domain, configs) {
    for (const [configDomain, config] of Object.entries(configs)) {
      // Check if current domain is a subdomain of configured domain
      if (domain.endsWith('.' + configDomain) || domain === configDomain) {
        return config;
      }
      
      // Check if configured domain is a subdomain of current domain
      if (configDomain.endsWith('.' + domain)) {
        return config;
      }
    }
    
    return null;
  }

  /**
   * Find configuration by URL pattern matching
   */
  findPatternMatch(url, configs) {
    for (const [configDomain, config] of Object.entries(configs)) {
      if (config.urlPatterns) {
        for (const pattern of config.urlPatterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(url)) {
              return config;
            }
          } catch (error) {
            console.error('Invalid regex pattern:', pattern, error);
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Determine how the website was matched
   */
  getMatchType(domain, config) {
    if (config.website?.domain === domain) {
      return 'exact';
    } else if (domain.includes(config.website?.domain) || config.website?.domain?.includes(domain)) {
      return 'subdomain';
    } else {
      return 'pattern';
    }
  }

  /**
   * Get website configurations with caching
   */
  async getWebsiteConfigs() {
    const now = Date.now();
    
    // Return cached configs if still valid
    if (this.configCache.size > 0 && (now - this.lastCacheUpdate) < this.CACHE_DURATION) {
      return Object.fromEntries(this.configCache);
    }
    
    try {
      // Get from storage
      const result = await chrome.storage.local.get('wa_websites');
      const configs = result.wa_websites || {};
      
      // Update cache
      this.configCache.clear();
      for (const [domain, config] of Object.entries(configs)) {
        this.configCache.set(domain, config);
      }
      this.lastCacheUpdate = now;
      
      return configs;
    } catch (error) {
      console.error('Failed to get website configs:', error);
      return {};
    }
  }

  /**
   * Get extension settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get('wa_settings');
      return result.wa_settings || {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  /**
   * Validate website configuration
   */
  validateWebsiteConfig(config) {
    const errors = [];
    
    // Check required fields
    if (!config.website) {
      errors.push('Missing website information');
    } else {
      if (!config.website.name) errors.push('Missing website name');
      if (!config.website.domain) errors.push('Missing website domain');
      if (!config.website.type) errors.push('Missing website type');
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
    if (!config.scenarios || Object.keys(config.scenarios).length === 0) {
      errors.push('No scenarios defined');
    }
    
    // Validate each scenario
    if (config.scenarios) {
      for (const [scenarioId, scenario] of Object.entries(config.scenarios)) {
        if (!scenario.name) {
          errors.push(`Scenario ${scenarioId} missing name`);
        }
        if (!scenario.pages) {
          errors.push(`Scenario ${scenarioId} missing pages`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get website type icon
   */
  getWebsiteTypeIcon(type) {
    const iconMap = {
      'ecommerce': '🛒',
      'social': '💬', 
      'news': '📰',
      'video': '🎥',
      'search': '🔍',
      'education': '🎓',
      'finance': '💰',
      'travel': '✈️',
      'food': '🍕',
      'health': '🏥',
      'technology': '💻',
      'entertainment': '🎭',
      'sports': '⚽',
      'other': '🌐'
    };
    
    return iconMap[type] || iconMap.other;
  }

  /**
   * Get website type color
   */
  getWebsiteTypeColor(type) {
    const colorMap = {
      'ecommerce': '#10b981',
      'social': '#3b82f6',
      'news': '#f59e0b',
      'video': '#ef4444',
      'search': '#8b5cf6',
      'education': '#06b6d4',
      'finance': '#84cc16',
      'travel': '#f97316',
      'food': '#ec4899',
      'health': '#14b8a6',
      'technology': '#6366f1',
      'entertainment': '#d946ef',
      'sports': '#22c55e',
      'other': '#6b7280'
    };
    
    return colorMap[type] || colorMap.other;
  }

  /**
   * Analyze page structure for automatic selector detection
   */
  async analyzePageStructure(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          const analysis = {
            title: document.title,
            url: window.location.href,
            forms: [],
            buttons: [],
            links: [],
            inputs: [],
            images: []
          };
          
          // Analyze forms
          document.querySelectorAll('form').forEach((form, index) => {
            analysis.forms.push({
              index,
              action: form.action,
              method: form.method,
              inputs: form.querySelectorAll('input').length
            });
          });
          
          // Analyze buttons
          document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach((btn, index) => {
            analysis.buttons.push({
              index,
              text: btn.textContent || btn.value,
              type: btn.type,
              id: btn.id,
              classes: btn.className
            });
          });
          
          // Analyze links
          document.querySelectorAll('a[href]').forEach((link, index) => {
            if (index < 20) { // Limit to first 20 links
              analysis.links.push({
                index,
                text: link.textContent?.trim()?.substring(0, 50),
                href: link.href,
                id: link.id,
                classes: link.className
              });
            }
          });
          
          // Analyze inputs
          document.querySelectorAll('input').forEach((input, index) => {
            analysis.inputs.push({
              index,
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder,
              classes: input.className
            });
          });
          
          return analysis;
        }
      });
      
      return results[0]?.result || null;
    } catch (error) {
      console.error('Failed to analyze page structure:', error);
      return null;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Get popular websites for quick setup
   */
  getPopularWebsites() {
    return [
      {
        name: 'Amazon',
        domain: 'amazon.com',
        type: 'ecommerce',
        icon: '🛒',
        color: '#ff9900'
      },
      {
        name: 'eBay', 
        domain: 'ebay.com',
        type: 'ecommerce',
        icon: '🛒',
        color: '#e53238'
      },
      {
        name: 'Facebook',
        domain: 'facebook.com', 
        type: 'social',
        icon: '💬',
        color: '#1877f2'
      },
      {
        name: 'YouTube',
        domain: 'youtube.com',
        type: 'video', 
        icon: '🎥',
        color: '#ff0000'
      },
      {
        name: 'LinkedIn',
        domain: 'linkedin.com',
        type: 'social',
        icon: '💼',
        color: '#0a66c2'
      },
      {
        name: 'Twitter',
        domain: 'twitter.com',
        type: 'social', 
        icon: '🐦',
        color: '#1da1f2'
      },
      {
        name: 'Instagram',
        domain: 'instagram.com',
        type: 'social',
        icon: '📸',
        color: '#e4405f'
      },
      {
        name: 'Reddit',
        domain: 'reddit.com',
        type: 'social',
        icon: '🤖',
        color: '#ff4500'
      }
    ];
  }
}