// Ultra-fast DOM scanner with mutation observer
class DOMScanner {
  constructor() {
    this.observer = null;
    this.cache = new WeakMap();
    this.performanceThreshold = 100; // ms
    this.init();
  }
  
  init() {
    // Expose API to window for background script access
    window.hyperScraperAPI = {
      scrape: (config) => this.scrape(config),
      detectStructures: () => this.detectStructures(),
      getSelectors: (element) => this.generateSelectors(element)
    };
    
    // Monitor DOM changes for dynamic content
    this.startObserving();
  }
  
  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      // Check if mutations contain potential data structures
      const hasDataStructures = mutations.some(mutation => 
        this.isDataContainer(mutation.target)
      );
      
      if (hasDataStructures) {
        this.clearCache();
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }
  
  isDataContainer(element) {
    // Fast detection of data containers
    const tagName = element.tagName.toLowerCase();
    const dataTags = ['table', 'ul', 'ol', 'div', 'section'];
    
    if (!dataTags.includes(tagName)) return false;
    
    // Quick heuristic checks
    const children = element.children.length;
    const textLength = element.textContent.length;
    
    return children > 3 || textLength > 100;
  }
  
  scrape(config) {
    const startTime = performance.now();
    let results = null;
    
    try {
      switch (config.mode) {
        case 'auto':
          results = this.autoDetect();
          break;
        case 'table':
          results = this.extractTables(config);
          break;
        case 'list':
          results = this.extractLists(config);
          break;
        case 'products':
          results = this.extractProducts(config);
          break;
        case 'custom':
          results = this.extractWithSelectors(config.selectors);
          break;
      }
      
      const processingTime = performance.now() - startTime;
      
      // Performance optimization feedback
      if (processingTime > this.performanceThreshold) {
        console.log(`Scraping took ${processingTime}ms, consider optimizing selectors`);
      }
      
      return {
        data: results,
        metadata: {
          url: window.location.href,
          timestamp: new Date().toISOString(),
          processingTime,
          elementCount: results?.length || 0
        }
      };
    } catch (error) {
      console.error('Scraping failed:', error);
      return { error: error.message };
    }
  }
  
  autoDetect() {
    const startTime = performance.now();
    
    // Parallel detection for speed
    const detectors = [
      () => this.detectTables(),
      () => this.detectLists(),
      () => this.detectProducts()
    ];
    
    const results = detectors.map(detector => {
      try {
        return detector();
      } catch (e) {
        return null;
      }
    });
    
    // Return the most promising result
    const bestResult = results.reduce((best, current) => {
      if (!current || !current.data) return best;
      if (!best || current.data.length > best.data.length) return current;
      return best;
    }, null);
    
    console.log(`Auto-detection completed in ${performance.now() - startTime}ms`);
    
    return bestResult;
  }
  
  detectTables() {
    // Optimized table detection
    const tables = Array.from(document.querySelectorAll('table')).slice(0, 20);
    
    return {
      type: 'tables',
      data: tables.map(table => this.extractTableData(table)),
      confidence: tables.length > 0 ? 0.9 : 0
    };
  }
  
  extractTableData(table) {
    // Fast table extraction using direct DOM access
    const rows = table.rows;
    const data = [];
    
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].cells;
      const rowData = {};
      
      for (let j = 0; j < cells.length; j++) {
        rowData[`col${j}`] = cells[j].textContent.trim();
      }
      
      data.push(rowData);
    }
    
    return {
      headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
      rows: data,
      element: table
    };
  }
  
  extractProducts(config = {}) {
    // AI-inspired product detection patterns
    const productPatterns = [
      // E-commerce patterns
      '.product, [class*="product"], [class*="item"]',
      // Card patterns
      '.card, [class*="card"]',
      // Grid items
      '[class*="grid"] > div, [class*="list"] > div',
      // Common product containers
      '.product-item, .product-card, .item-box'
    ];
    
    const selectors = config.selectors || productPatterns;
    const allElements = [];
    
    // Fast selector matching
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => allElements.push(el));
      } catch (e) {
        // Skip invalid selectors
      }
    });
    
    // Deduplicate and filter
    const uniqueElements = [...new Set(allElements)];
    
    return uniqueElements
      .filter(el => this.isLikelyProduct(el))
      .map(el => this.extractProductData(el));
  }
  
  isLikelyProduct(element) {
    // Fast heuristic checks
    const text = element.textContent || '';
    const children = element.children.length;
    
    // Check for common product indicators
    const hasPrice = /(\$|\€|\£)\s*\d+[\.,]\d{2}/.test(text);
    const hasImage = element.querySelector('img');
    const hasButton = element.querySelector('button, [class*="btn"], [class*="button"]');
    
    return (hasPrice || hasImage) && (children > 1 || hasButton);
  }
  
  extractProductData(element) {
    // Fast extraction using pattern matching
    return {
      title: this.extractText(element, ['h1', 'h2', 'h3', '[class*="title"], [class*="name"]']),
      price: this.extractText(element, ['[class*="price"], [class*="cost"], .price']),
      image: this.extractAttribute(element, 'img', 'src'),
      url: this.extractAttribute(element, 'a', 'href'),
      description: this.extractText(element, ['[class*="desc"], [class*="details"], p']),
      rating: this.extractText(element, ['[class*="rating"], [class*="star"], .rating']),
      element: element
    };
  }
  
  extractText(element, selectors) {
    // Fast text extraction
    for (const selector of selectors) {
      const found = element.querySelector(selector);
      if (found && found.textContent.trim()) {
        return found.textContent.trim();
      }
    }
    return '';
  }
  
  extractAttribute(element, tagName, attribute) {
    const el = element.querySelector(tagName);
    return el ? el.getAttribute(attribute) : '';
  }
  
  clearCache() {
    this.cache = new WeakMap();
  }
  
  generateSelectors(element) {
    // Generate optimal CSS selectors
    const selectors = [];
    
    // ID selector (fastest)
    if (element.id) {
      selectors.push(`#${CSS.escape(element.id)}`);
    }
    
    // Class-based selectors
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/);
      if (classes.length > 0) {
        const classSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
        selectors.push(classSelector);
      }
    }
    
    // Tag + attributes
    const tag = element.tagName.toLowerCase();
    selectors.push(tag);
    
    // Path-based selectors (fallback)
    selectors.push(this.generatePathSelector(element));
    
    return selectors;
  }
  
  generatePathSelector(element) {
    // Generate CSS path
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      const siblingIndex = Array.from(current.parentNode.children)
        .indexOf(current) + 1;
      selector += `:nth-child(${siblingIndex})`;
      
      path.unshift(selector);
      current = current.parentNode;
    }
    
    return path.join(' > ');
  }
}

// Initialize scanner
const scanner = new DOMScanner();