// Main content script that initializes all scraping functionality

class ContentController {
  constructor() {
    this.domScanner = null;
    this.elementPicker = null;
    this.init();
  }

  init() {
    console.log('HyperScraper Pro content script initialized');
    
    // Initialize DOM scanner
    this.domScanner = new DOMScanner();
    
    // Initialize element picker
    this.elementPicker = new ElementPicker();
    
    // Set up message listeners
    this.setupMessageListeners();
    
    // Expose API to window
    this.exposeAPI();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request.action);
      
      const actions = {
        'extract': () => this.handleExtract(request, sendResponse),
        'testSelector': () => this.handleTestSelector(request, sendResponse),
        'startElementPicker': () => this.handleStartElementPicker(request, sendResponse),
        'highlightElement': () => this.handleHighlightElement(request, sendResponse),
        'stopElementPicker': () => this.handleStopElementPicker(request, sendResponse),
        'getStatus': () => this.handleGetStatus(request, sendResponse),
        'scrape': () => this.handleScrape(request, sendResponse)
      };

      if (actions[request.action]) {
        actions[request.action]();
      } else {
        sendResponse({ error: `Unknown action: ${request.action}` });
      }

      return true; // Keep message channel open for async responses
    });
  }

  exposeAPI() {
    // Expose scraping API to window for background script access
    window.hyperScraperAPI = {
      scrape: (config) => this.domScanner.scrape(config),
      detectStructures: () => this.domScanner.detectStructures(),
      getSelectors: (element) => this.domScanner.generateSelectors(element),
      testSelector: (selector) => this.testSelector(selector)
    };
  }

  async handleExtract(request, sendResponse) {
    try {
      const result = this.domScanner.scrape(request.config);
      sendResponse(result);
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async handleTestSelector(request, sendResponse) {
    try {
      const result = this.testSelector(request.selector);
      sendResponse(result);
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  testSelector(selector) {
    try {
      const elements = document.querySelectorAll(selector);
      const matches = Array.from(elements).map((el, index) => ({
        index,
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        text: el.textContent.trim().slice(0, 100),
        html: el.innerHTML.slice(0, 200)
      }));

      return {
        success: true,
        matches: matches,
        count: matches.length,
        selector: selector
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        selector: selector
      };
    }
  }

  handleStartElementPicker(request, sendResponse) {
    this.elementPicker.start();
    sendResponse({ started: true });
  }

  handleHighlightElement(request, sendResponse) {
    this.elementPicker.highlightBySelector(request.selector, request.index);
    sendResponse({ highlighted: true });
  }

  handleStopElementPicker(request, sendResponse) {
    this.elementPicker.stop();
    sendResponse({ stopped: true });
  }

  handleGetStatus(request, sendResponse) {
    sendResponse({
      ready: true,
      url: window.location.href,
      title: document.title,
      hasData: this.domScanner.hasData()
    });
  }

  async handleScrape(request, sendResponse) {
    try {
      const result = this.domScanner.scrape(request.config);
      sendResponse(result);
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
}

// Element Picker Class
class ElementPicker {
  constructor() {
    this.isPicking = false;
    this.highlightedElement = null;
    this.originalStyles = null;
    this.infoBox = null;
  }

  start() {
    if (this.isPicking) return;
    
    this.isPicking = true;
    this.addPickerStyles();
    
    document.addEventListener('mouseover', this.handleMouseOver.bind(this));
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    
    console.log('Element picker started');
  }

  stop() {
    if (!this.isPicking) return;
    
    this.isPicking = false;
    this.removeHighlight();
    this.removeInfoBox();
    
    document.removeEventListener('mouseover', this.handleMouseOver.bind(this));
    document.removeEventListener('click', this.handleClick.bind(this));
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
    
    console.log('Element picker stopped');
  }

  handleMouseOver(e) {
    e.stopPropagation();
    
    const element = e.target;
    if (element === this.highlightedElement) return;
    
    this.removeHighlight();
    this.highlightElement(element);
  }

  handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (this.highlightedElement) {
      const selector = this.generateSelector(this.highlightedElement);
      
      chrome.runtime.sendMessage({
        action: 'elementPicked',
        selector: selector,
        element: {
          tagName: this.highlightedElement.tagName,
          className: this.highlightedElement.className,
          id: this.highlightedElement.id,
          text: this.highlightedElement.textContent.trim().slice(0, 200)
        }
      });
      
      this.stop();
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.stop();
      chrome.runtime.sendMessage({ action: 'pickerCancelled' });
    }
  }

  highlightElement(element) {
    this.highlightedElement = element;
    
    // Save original styles
    this.originalStyles = {
      outline: element.style.outline,
      backgroundColor: element.style.backgroundColor,
      position: element.style.position,
      zIndex: element.style.zIndex
    };
    
    // Apply highlight
    element.style.outline = '2px solid #667eea';
    element.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
    element.style.position = 'relative';
    element.style.zIndex = '10000';
    
    // Show info box
    this.showInfoBox(element);
  }

  removeHighlight() {
    if (this.highlightedElement && this.originalStyles) {
      this.highlightedElement.style.outline = this.originalStyles.outline;
      this.highlightedElement.style.backgroundColor = this.originalStyles.backgroundColor;
      this.highlightedElement.style.position = this.originalStyles.position;
      this.highlightedElement.style.zIndex = this.originalStyles.zIndex;
    }
    
    this.highlightedElement = null;
    this.originalStyles = null;
  }

  showInfoBox(element) {
    this.removeInfoBox();
    
    this.infoBox = document.createElement('div');
    this.infoBox.id = 'hyper-scraper-info';
    this.infoBox.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: white;
      border: 2px solid #667eea;
      border-radius: 6px;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      z-index: 10001;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      line-height: 1.4;
    `;
    
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const selector = this.generateSelector(element);
    
    this.infoBox.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong style="color: #667eea;">🔍 Click to Select Element</strong><br>
        <small style="color: #666;">Press ESC to cancel</small>
      </div>
      <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin: 8px 0;">
        <div><strong>Tag:</strong> <code>${tag}</code></div>
        ${id ? `<div><strong>ID:</strong> <code>${id}</code></div>` : ''}
        ${classes ? `<div><strong>Classes:</strong> <code>${classes}</code></div>` : ''}
      </div>
      <div style="margin-top: 8px;">
        <strong>Selector:</strong><br>
        <code style="font-size: 11px; background: #f0f7ff; padding: 4px 6px; border-radius: 3px; display: block; margin-top: 4px; word-break: break-all;">
          ${selector}
        </code>
      </div>
    `;
    
    document.body.appendChild(this.infoBox);
  }

  removeInfoBox() {
    if (this.infoBox && this.infoBox.parentNode) {
      this.infoBox.parentNode.removeChild(this.infoBox);
      this.infoBox = null;
    }
  }

  generateSelector(element) {
    // Try ID first
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    
    // Try single unique class
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length === 1) {
        const selector = `.${CSS.escape(classes[0])}`;
        const matches = document.querySelectorAll(selector).length;
        if (matches < 10 && matches > 0) {
          return selector;
        }
      }
    }
    
    // Generate path selector
    return this.generatePathSelector(element);
  }

  generatePathSelector(element) {
    const path = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== document.body && depth < 6) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      // Add class if unique-ish
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length === 1) {
          selector += `.${CSS.escape(classes[0])}`;
        }
      }
      
      path.unshift(selector);
      current = current.parentNode;
      depth++;
    }
    
    if (path.length > 0) {
      return path.join(' > ');
    }
    
    return element.tagName.toLowerCase();
  }

  highlightBySelector(selector, index = 0) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > index) {
        this.highlightElement(elements[index]);
        
        // Scroll to element
        elements[index].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
        
        return true;
      }
    } catch (error) {
      console.error('Failed to highlight element:', error);
    }
    return false;
  }

  addPickerStyles() {
    const style = document.createElement('style');
    style.id = 'hyper-scraper-picker-styles';
    style.textContent = `
      *:hover {
        cursor: crosshair !important;
      }
      
      #hyper-scraper-info {
        animation: hyperScraperFadeIn 0.3s ease-in;
      }
      
      @keyframes hyperScraperFadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentController();
  });
} else {
  new ContentController();
}