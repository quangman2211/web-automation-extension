/**
 * Action Executor - Execute human-like interactions with web elements
 */
export class ActionExecutor {
  constructor() {
    this.settings = {
      slowMode: false,
      naturalMovement: true,
      randomDelay: true
    };
    
    this.mousePosition = { x: 0, y: 0 };
    this.isExecuting = false;
  }

  /**
   * Wait for specified duration with natural variation
   */
  async wait(duration) {
    let waitTime;
    
    if (typeof duration === 'string') {
      waitTime = this.parseDuration(duration);
    } else {
      waitTime = duration;
    }
    
    // Add natural variation (±20%)
    if (this.settings.randomDelay) {
      const variation = waitTime * 0.2;
      waitTime = waitTime + (Math.random() - 0.5) * variation;
    }
    
    // Apply slow mode multiplier
    if (this.settings.slowMode) {
      waitTime *= 2;
    }
    
    console.log(`⏱️ Waiting ${Math.round(waitTime)}ms`);
    
    return new Promise(resolve => setTimeout(resolve, Math.max(100, waitTime)));
  }

  /**
   * Parse duration string (e.g., "2-3s", "500ms", "1.5s")
   */
  parseDuration(durationStr) {
    if (durationStr.includes('-')) {
      // Range format: "2-3s"
      const [minStr, maxStr] = durationStr.split('-');
      const min = this.parseTimeValue(minStr);
      const max = this.parseTimeValue(maxStr);
      return Math.random() * (max - min) + min;
    } else {
      // Single value: "2s", "500ms"
      return this.parseTimeValue(durationStr);
    }
  }

  /**
   * Parse time value to milliseconds
   */
  parseTimeValue(timeStr) {
    const value = parseFloat(timeStr);
    
    if (timeStr.includes('ms')) {
      return value;
    } else if (timeStr.includes('s')) {
      return value * 1000;
    } else {
      // Default to milliseconds
      return value;
    }
  }

  /**
   * Move mouse to element with natural movement
   */
  async moveToElement(element, pattern = 'natural', speed = 'normal') {
    if (!element) {
      throw new Error('Element not found for move action');
    }

    const rect = element.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    console.log(`🖱️ Moving to element at (${Math.round(targetX)}, ${Math.round(targetY)})`);

    // Scroll element into view if needed
    if (!this.isElementInViewport(element)) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.wait(500); // Wait for scroll to complete
    }

    // Perform natural mouse movement
    await this.moveMouseNaturally(targetX, targetY, pattern, speed);
    
    this.mousePosition = { x: targetX, y: targetY };
  }

  /**
   * Perform natural mouse movement animation
   */
  async moveMouseNaturally(targetX, targetY, pattern, speed) {
    const startX = this.mousePosition.x;
    const startY = this.mousePosition.y;
    
    const distance = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
    
    // Calculate movement duration based on distance and speed
    const baseSpeed = this.getSpeedValue(speed);
    const duration = Math.max(200, distance / baseSpeed * 1000);
    
    const steps = Math.max(10, Math.floor(duration / 16)); // 60fps
    const stepDelay = duration / steps;
    
    // Generate movement path based on pattern
    const path = this.generateMovementPath(startX, startY, targetX, targetY, pattern, steps);
    
    // Animate movement
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      
      // Dispatch mouse move event
      this.dispatchMouseEvent('mousemove', point.x, point.y);
      
      if (i < path.length - 1) {
        await this.wait(stepDelay);
      }
    }
  }

  /**
   * Generate natural movement path
   */
  generateMovementPath(startX, startY, targetX, targetY, pattern, steps) {
    const path = [];
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      let x, y;
      
      switch (pattern) {
        case 'direct':
          x = startX + (targetX - startX) * progress;
          y = startY + (targetY - startY) * progress;
          break;
          
        case 'natural':
        default:
          // Use bezier curve for natural movement
          const controlPoint = this.generateControlPoint(startX, startY, targetX, targetY);
          const point = this.bezierCurve(
            { x: startX, y: startY },
            controlPoint,
            { x: targetX, y: targetY },
            progress
          );
          x = point.x;
          y = point.y;
          
          // Add small random variations
          if (progress > 0.1 && progress < 0.9) {
            x += (Math.random() - 0.5) * 3;
            y += (Math.random() - 0.5) * 3;
          }
          break;
          
        case 'hesitant':
          // Slow down in the middle
          const adjustedProgress = progress < 0.5 
            ? progress * 0.6
            : 0.3 + (progress - 0.5) * 1.4;
          x = startX + (targetX - startX) * adjustedProgress;
          y = startY + (targetY - startY) * adjustedProgress;
          break;
      }
      
      path.push({ x: Math.round(x), y: Math.round(y) });
    }
    
    return path;
  }

  /**
   * Generate control point for bezier curve
   */
  generateControlPoint(startX, startY, targetX, targetY) {
    const midX = (startX + targetX) / 2;
    const midY = (startY + targetY) / 2;
    
    // Add perpendicular offset for curved movement
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const perpAngle = angle + Math.PI / 2;
    const offset = Math.random() * 50 + 20; // 20-70px curve
    
    return {
      x: midX + Math.cos(perpAngle) * offset,
      y: midY + Math.sin(perpAngle) * offset
    };
  }

  /**
   * Calculate point on bezier curve
   */
  bezierCurve(start, control, end, t) {
    const invT = 1 - t;
    return {
      x: invT * invT * start.x + 2 * invT * t * control.x + t * t * end.x,
      y: invT * invT * start.y + 2 * invT * t * control.y + t * t * end.y
    };
  }

  /**
   * Get speed value in pixels per second
   */
  getSpeedValue(speed) {
    const speedMap = {
      'slow': 200,
      'normal': 500,
      'fast': 1000
    };
    
    return speedMap[speed] || speedMap.normal;
  }

  /**
   * Hover over element
   */
  async hoverElement(element, duration = '1-2s') {
    if (!element) {
      throw new Error('Element not found for hover action');
    }

    console.log('🖱️ Hovering over element');
    
    // Move to element first
    await this.moveToElement(element);
    
    // Dispatch mouse enter event
    this.dispatchMouseEvent('mouseenter', this.mousePosition.x, this.mousePosition.y, element);
    this.dispatchMouseEvent('mouseover', this.mousePosition.x, this.mousePosition.y, element);
    
    // Wait for hover duration with micro movements
    const hoverTime = this.parseDuration(duration);
    const microMovements = Math.floor(hoverTime / 200); // Every 200ms
    
    for (let i = 0; i < microMovements; i++) {
      await this.wait(200);
      
      // Small random movements while hovering
      const microX = this.mousePosition.x + (Math.random() - 0.5) * 4;
      const microY = this.mousePosition.y + (Math.random() - 0.5) * 4;
      
      this.dispatchMouseEvent('mousemove', microX, microY, element);
    }
  }

  /**
   * Click element with natural behavior
   */
  async clickElement(element, button = 'left', count = 1) {
    if (!element) {
      throw new Error('Element not found for click action');
    }

    console.log(`🖱️ Clicking element (${button}, ${count}x)`);
    
    // Move to element first
    await this.moveToElement(element);
    
    // Add small random offset to click position
    const rect = element.getBoundingClientRect();
    const offsetX = (Math.random() - 0.5) * Math.min(rect.width * 0.3, 10);
    const offsetY = (Math.random() - 0.5) * Math.min(rect.height * 0.3, 10);
    
    const clickX = this.mousePosition.x + offsetX;
    const clickY = this.mousePosition.y + offsetY;
    
    // Perform click(s)
    for (let i = 0; i < count; i++) {
      await this.performClick(element, clickX, clickY, button);
      
      if (i < count - 1) {
        // Wait between multiple clicks
        await this.wait(Math.random() * 100 + 50);
      }
    }
    
    // Brief pause after clicking
    await this.wait(Math.random() * 200 + 100);
  }

  /**
   * Perform single click
   */
  async performClick(element, x, y, button) {
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: button === 'left' ? 0 : button === 'right' ? 2 : 1
    };
    
    // Natural click sequence: mousedown -> mouseup -> click
    this.dispatchMouseEvent('mousedown', x, y, element, eventOptions);
    
    // Hold for natural duration (50-150ms)
    await this.wait(Math.random() * 100 + 50);
    
    this.dispatchMouseEvent('mouseup', x, y, element, eventOptions);
    this.dispatchMouseEvent('click', x, y, element, eventOptions);
    
    // Focus element if it's focusable
    if (element.focus && typeof element.focus === 'function') {
      element.focus();
    }
  }

  /**
   * Scroll page or to element
   */
  async scroll(distance, toElement = null, speed = 'smooth') {
    console.log(`📜 Scrolling ${distance || 'to element'}`);
    
    if (toElement) {
      // Scroll to specific element
      toElement.scrollIntoView({ 
        behavior: speed, 
        block: 'center',
        inline: 'center'
      });
      
      await this.wait(1000); // Wait for scroll animation
      return;
    }
    
    // Scroll by distance
    let scrollDistance;
    if (typeof distance === 'string') {
      scrollDistance = parseInt(distance.replace('px', ''));
    } else {
      scrollDistance = distance;
    }
    
    // Perform smooth scrolling in steps
    const steps = Math.abs(scrollDistance) / 50; // 50px per step
    const stepSize = scrollDistance / steps;
    const stepDelay = speed === 'fast' ? 10 : speed === 'slow' ? 100 : 50;
    
    for (let i = 0; i < steps; i++) {
      window.scrollBy(0, stepSize);
      await this.wait(stepDelay);
      
      // Add natural pauses occasionally
      if (Math.random() < 0.1) {
        await this.wait(Math.random() * 300 + 100);
      }
    }
  }

  /**
   * Type text with natural typing behavior
   */
  async typeText(element, text, speed = '100-200ms', clearFirst = false) {
    if (!element) {
      throw new Error('Element not found for type action');
    }

    console.log(`⌨️ Typing text: "${text.substring(0, 20)}..."`);
    
    // Focus element first
    await this.moveToElement(element);
    await this.clickElement(element);
    
    // Clear existing text if requested
    if (clearFirst) {
      element.select();
      await this.wait(100);
    }
    
    // Type each character with natural timing
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Simulate key press
      await this.typeCharacter(element, char);
      
      // Natural typing delay
      const charDelay = this.parseDuration(speed);
      await this.wait(charDelay);
      
      // Occasional longer pauses (thinking)
      if (Math.random() < 0.05) {
        await this.wait(Math.random() * 500 + 200);
      }
      
      // Simulate typos occasionally
      if (Math.random() < 0.03 && i > 0) {
        await this.simulateTypo(element, char);
      }
    }
  }

  /**
   * Type single character
   */
  async typeCharacter(element, char) {
    const keyCode = char.charCodeAt(0);
    
    // Dispatch key events
    const keydownEvent = new KeyboardEvent('keydown', {
      key: char,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true
    });
    
    const keypressEvent = new KeyboardEvent('keypress', {
      key: char,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true
    });
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: char,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true
    });
    
    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keypressEvent);
    
    // Update element value
    if (element.value !== undefined) {
      element.value += char;
    } else {
      element.textContent += char;
    }
    
    // Dispatch input event
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
    
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Simulate typing typo and correction
   */
  async simulateTypo(element, correctChar) {
    // Common typo characters near the correct one on QWERTY keyboard
    const typoMap = {
      'a': 's', 's': 'a', 'd': 's', 'f': 'd',
      'q': 'w', 'w': 'q', 'e': 'w', 'r': 'e',
      // Add more as needed
    };
    
    const typoChar = typoMap[correctChar.toLowerCase()] || 'x';
    
    // Type wrong character
    await this.typeCharacter(element, typoChar);
    await this.wait(200);
    
    // Backspace to correct
    await this.pressKey(element, 'Backspace');
    await this.wait(100);
    
    // Type correct character
    await this.typeCharacter(element, correctChar);
  }

  /**
   * Press special keys
   */
  async pressKey(element, key) {
    const keyEvent = new KeyboardEvent('keydown', {
      key: key,
      bubbles: true
    });
    
    element.dispatchEvent(keyEvent);
    
    // Handle special keys
    if (key === 'Backspace' && element.value !== undefined) {
      element.value = element.value.slice(0, -1);
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
    }
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: key,
      bubbles: true
    });
    
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Dispatch mouse event
   */
  dispatchMouseEvent(type, x, y, element = null, options = {}) {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      ...options
    });
    
    const target = element || document.elementFromPoint(x, y) || document.body;
    target.dispatchEvent(event);
  }

  /**
   * Check if element is in viewport
   */
  isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ ActionExecutor settings updated:', this.settings);
  }

  /**
   * Get current mouse position
   */
  getMousePosition() {
    return { ...this.mousePosition };
  }

  /**
   * Set mouse position (for initialization)
   */
  setMousePosition(x, y) {
    this.mousePosition = { x, y };
  }
}