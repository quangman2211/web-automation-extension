/**
 * Element Finder - Advanced element selection with fallbacks and smart selectors
 */
export class ElementFinder {
  constructor() {
    this.selectorCache = new Map();
    this.lastFoundElements = new Map();
    
    // Selector patterns and aliases
    this.selectorAliases = {
      ':random': this.selectRandom.bind(this),
      ':visible': this.selectVisible.bind(this),
      ':inviewport': this.selectInViewport.bind(this),
      ':nth': this.selectNth.bind(this),
      ':first': this.selectFirst.bind(this),
      ':last': this.selectLast.bind(this),
      'current': this.selectCurrent.bind(this),
      'browser_back': this.selectBrowserBack.bind(this)
    };
  }

  /**
   * Main method to find element with advanced selector support
   */
  async findElement(selector, globalSelectors = null, options = {}) {
    try {
      console.log(`🔍 Finding element: ${selector}`);
      
      // Process selector aliases and references
      const processedSelector = this.processSelector(selector, globalSelectors);
      
      // Try cached element first if enabled
      if (options.useCache && this.selectorCache.has(processedSelector)) {
        const cachedElement = this.selectorCache.get(processedSelector);
        if (this.isElementValid(cachedElement)) {
          console.log(`📋 Using cached element for: ${selector}`);
          return cachedElement;
        } else {
          this.selectorCache.delete(processedSelector);
        }
      }
      
      // Find element using processed selector
      const element = await this.findElementBySelector(processedSelector, options);
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      // Cache successful result
      if (options.useCache) {
        this.selectorCache.set(processedSelector, element);
      }
      
      // Store as last found element
      this.lastFoundElements.set('current', element);
      
      console.log(`✅ Element found: ${selector}`);
      return element;
      
    } catch (error) {
      console.error(`❌ Element not found: ${selector}`, error);
      throw error;
    }
  }

  /**
   * Process selector with aliases and references
   */
  processSelector(selector, globalSelectors) {
    let processedSelector = selector;
    
    // Handle @ references to global selectors
    if (processedSelector.startsWith('@')) {
      const selectorName = processedSelector.substring(1);
      if (globalSelectors && globalSelectors.global && globalSelectors.global[selectorName]) {
        processedSelector = globalSelectors.global[selectorName];
        console.log(`📎 Resolved @${selectorName} to: ${processedSelector}`);
      } else {
        throw new Error(`Global selector not found: ${selectorName}`);
      }
    }
    
    return processedSelector;
  }

  /**
   * Find element by selector with multiple strategies
   */
  async findElementBySelector(selector, options = {}) {
    const strategies = [
      () => this.findByDirectSelector(selector),
      () => this.findByFallbackSelectors(selector),
      () => this.findByTextContent(selector),
      () => this.findByAttributes(selector),
      () => this.findByPosition(selector)
    ];
    
    for (const strategy of strategies) {
      try {
        const element = await strategy();
        if (element) {
          return element;
        }
      } catch (error) {
        // Continue to next strategy
        console.debug('Strategy failed:', error.message);
      }
    }
    
    return null;
  }

  /**
   * Find element using direct CSS selector
   */
  async findByDirectSelector(selector) {
    // Handle special alias selectors
    if (this.selectorAliases[selector]) {
      return await this.selectorAliases[selector]();
    }
    
    // Handle special patterns
    if (selector.includes(':')) {
      return await this.handleSpecialSelectors(selector);
    }
    
    // Standard CSS selector
    const elements = document.querySelectorAll(selector);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Handle special selector patterns
   */
  async handleSpecialSelectors(selector) {
    // Pattern: selector:modifier
    const [baseSelector, modifier] = selector.split(':');
    const elements = document.querySelectorAll(baseSelector);
    
    if (elements.length === 0) {
      return null;
    }
    
    switch (modifier) {
      case 'random':
        return this.selectRandom(Array.from(elements));
        
      case 'visible':
        return this.selectVisible(Array.from(elements));
        
      case 'inviewport':
        return this.selectInViewport(Array.from(elements));
        
      case 'first':
        return elements[0];
        
      case 'last':
        return elements[elements.length - 1];
        
      default:
        // Handle :nth(n) pattern
        if (modifier.startsWith('nth(')) {
          const nthMatch = modifier.match(/nth\((\d+)\)/);
          if (nthMatch) {
            const index = parseInt(nthMatch[1]) - 1; // 1-based to 0-based
            return elements[index] || null;
          }
        }
        return elements[0];
    }
  }

  /**
   * Find element using fallback selectors
   */
  async findByFallbackSelectors(selector) {
    // If selector contains commas, treat as fallback list
    if (selector.includes(',')) {
      const selectors = selector.split(',').map(s => s.trim());
      
      for (const fallbackSelector of selectors) {
        const element = document.querySelector(fallbackSelector);
        if (element) {
          return element;
        }
      }
    }
    
    return null;
  }

  /**
   * Find element by text content
   */
  async findByTextContent(selector) {
    // Pattern: text:"content"
    const textMatch = selector.match(/text:"([^"]+)"/);
    if (!textMatch) {
      return null;
    }
    
    const searchText = textMatch[1].toLowerCase();
    const allElements = document.querySelectorAll('*');
    
    for (const element of allElements) {
      const textContent = element.textContent?.toLowerCase();
      if (textContent && textContent.includes(searchText)) {
        // Prefer elements with exact text match
        if (textContent.trim() === searchText) {
          return element;
        }
      }
    }
    
    // Second pass for partial matches
    for (const element of allElements) {
      const textContent = element.textContent?.toLowerCase();
      if (textContent && textContent.includes(searchText)) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Find element by attributes
   */
  async findByAttributes(selector) {
    // Pattern: [attribute*="value"]
    const attrMatch = selector.match(/\[([^=]+)\*?="([^"]+)"\]/);
    if (!attrMatch) {
      return null;
    }
    
    const [, attribute, value] = attrMatch;
    const isPartialMatch = selector.includes('*=');
    
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      const attrValue = element.getAttribute(attribute);
      if (attrValue) {
        if (isPartialMatch && attrValue.includes(value)) {
          return element;
        } else if (!isPartialMatch && attrValue === value) {
          return element;
        }
      }
    }
    
    return null;
  }

  /**
   * Find element by position
   */
  async findByPosition(selector) {
    // Pattern: position(x,y,tolerance)
    const posMatch = selector.match(/position\((\d+),(\d+)(?:,(\d+))?\)/);
    if (!posMatch) {
      return null;
    }
    
    const x = parseInt(posMatch[1]);
    const y = parseInt(posMatch[2]);
    const tolerance = parseInt(posMatch[3]) || 10;
    
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      if (Math.abs(centerX - x) <= tolerance && Math.abs(centerY - y) <= tolerance) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Select random element from array
   */
  selectRandom(elements = []) {
    if (elements.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * elements.length);
    return elements[randomIndex];
  }

  /**
   * Select first visible element
   */
  selectVisible(elements = []) {
    for (const element of elements) {
      if (this.isElementVisible(element)) {
        return element;
      }
    }
    return null;
  }

  /**
   * Select first element in viewport
   */
  selectInViewport(elements = []) {
    for (const element of elements) {
      if (this.isElementInViewport(element)) {
        return element;
      }
    }
    return null;
  }

  /**
   * Select nth element (1-based)
   */
  selectNth(elements = [], n = 1) {
    const index = n - 1; // Convert to 0-based
    return elements[index] || null;
  }

  /**
   * Select first element
   */
  selectFirst(elements = []) {
    return elements[0] || null;
  }

  /**
   * Select last element
   */
  selectLast(elements = []) {
    return elements[elements.length - 1] || null;
  }

  /**
   * Select current element (last found)
   */
  selectCurrent() {
    return this.lastFoundElements.get('current') || null;
  }

  /**
   * Select browser back button (virtual)
   */
  selectBrowserBack() {
    // Return a virtual element that represents browser back action
    return {
      tagName: 'VIRTUAL',
      id: 'browser-back',
      click: () => window.history.back(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
    };
  }

  /**
   * Check if element is visible
   */
  isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }

  /**
   * Check if element is in viewport
   */
  isElementInViewport(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Check if element is still valid (attached to DOM)
   */
  isElementValid(element) {
    return element && document.contains(element);
  }

  /**
   * Find all elements matching selector
   */
  async findElements(selector, globalSelectors = null, options = {}) {
    try {
      const processedSelector = this.processSelector(selector, globalSelectors);
      const elements = document.querySelectorAll(processedSelector);
      
      let filteredElements = Array.from(elements);
      
      // Apply filters based on options
      if (options.visibleOnly) {
        filteredElements = filteredElements.filter(el => this.isElementVisible(el));
      }
      
      if (options.inViewportOnly) {
        filteredElements = filteredElements.filter(el => this.isElementInViewport(el));
      }
      
      if (options.limit) {
        filteredElements = filteredElements.slice(0, options.limit);
      }
      
      return filteredElements;
    } catch (error) {
      console.error('Error finding elements:', error);
      return [];
    }
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(selector, globalSelectors = null, options = {}) {
    const timeout = options.timeout || 10000; // 10 seconds default
    const interval = options.interval || 500; // Check every 500ms
    const startTime = Date.now();
    
    console.log(`⏳ Waiting for element: ${selector}`);
    
    while (Date.now() - startTime < timeout) {
      try {
        const element = await this.findElement(selector, globalSelectors, options);
        if (element) {
          console.log(`✅ Element appeared: ${selector}`);
          return element;
        }
      } catch (error) {
        // Element not found yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Element did not appear within ${timeout}ms: ${selector}`);
  }

  /**
   * Wait for element to disappear
   */
  async waitForElementToDisappear(selector, globalSelectors = null, options = {}) {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 500;
    const startTime = Date.now();
    
    console.log(`⏳ Waiting for element to disappear: ${selector}`);
    
    while (Date.now() - startTime < timeout) {
      try {
        await this.findElement(selector, globalSelectors, options);
        // Element still exists, continue waiting
      } catch (error) {
        // Element not found (disappeared)
        console.log(`✅ Element disappeared: ${selector}`);
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Element did not disappear within ${timeout}ms: ${selector}`);
  }

  /**
   * Get element information for debugging
   */
  getElementInfo(element) {
    if (!element) return null;
    
    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent?.trim()?.substring(0, 100),
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      rect: element.getBoundingClientRect(),
      isVisible: this.isElementVisible(element),
      isInViewport: this.isElementInViewport(element)
    };
  }

  /**
   * Generate smart selector for element
   */
  generateSelector(element) {
    if (!element) return null;
    
    const selectors = [];
    
    // Try ID first (most specific)
    if (element.id) {
      selectors.push(`#${element.id}`);
    }
    
    // Try unique class combinations
    if (element.className) {
      const classes = element.className.trim().split(/\s+/);
      if (classes.length > 0) {
        selectors.push(`.${classes.join('.')}`);
      }
    }
    
    // Try attribute selectors
    ['data-testid', 'data-id', 'name', 'type'].forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        selectors.push(`[${attr}="${value}"]`);
      }
    });
    
    // Try tag + text content for buttons/links
    if (['button', 'a', 'span'].includes(element.tagName.toLowerCase())) {
      const text = element.textContent?.trim();
      if (text && text.length < 50) {
        selectors.push(`${element.tagName.toLowerCase()}:contains("${text}")`);
      }
    }
    
    // Try nth-child as fallback
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      selectors.push(`${element.tagName.toLowerCase()}:nth-child(${index})`);
    }
    
    return selectors;
  }

  /**
   * Clear selector cache
   */
  clearCache() {
    this.selectorCache.clear();
    this.lastFoundElements.clear();
    console.log('🧹 Element finder cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      selectorCacheSize: this.selectorCache.size,
      lastFoundElementsSize: this.lastFoundElements.size
    };
  }
}