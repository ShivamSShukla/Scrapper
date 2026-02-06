class ProductDetector {
  constructor() {
    this.CONFIDENCE_THRESHOLD = 0.6;
    this.PRICE_PATTERNS = [
      /\$[\d,]+(?:\.\d{2})?/,
      /€[\d,]+(?:\.\d{2})?/,
      /£[\d,]+(?:\.\d{2})?/,
      /¥[\d,]+(?:\.\d{2})?/,
      /[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)/i
    ];
    
    this.PRODUCT_PATTERNS = [
      'product', 'item', 'card', 'good', 'merchandise',
      'listing', 'offer', 'deal', 'sale', 'buy'
    ];
  }

  detect() {
    const startTime = performance.now();
    
    const containers = this.findProductContainers();
    const scoredContainers = this.scoreContainers(containers);
    
    console.log(`Product detection completed in ${performance.now() - startTime}ms`);
    
    return {
      products: scoredContainers,
      selectors: this.generateSelectors(scoredContainers),
      confidence: scoredContainers.length > 0 ? scoredContainers[0].confidence : 0
    };
  }

  findProductContainers() {
    const strategies = [
      // Grid-based product listings
      () => this.findGridProducts(),
      
      // List-based products
      () => this.findListProducts(),
      
      // Table-based products
      () => this.findTableProducts(),
      
      // Card-based products
      () => this.findCardProducts(),
      
      // Generic container products
      () => this.findContainerProducts()
    ];
    
    const allContainers = new Set();
    
    strategies.forEach(strategy => {
      try {
        const containers = strategy();
        containers.forEach(container => allContainers.add(container));
      } catch (e) {
        console.warn('Product detection strategy failed:', e);
      }
    });
    
    return Array.from(allContainers);
  }

  findGridProducts() {
    const elements = Array.from(document.querySelectorAll('div, section, ul, li'));
    
    return elements.filter(el => {
      const style = window.getComputedStyle(el);
      const isGrid = style.display.includes('grid');
      const isFlex = style.display.includes('flex');
      
      if (!isGrid && !isFlex) return false;
      
      // Check children for product-like properties
      const children = el.children;
      if (children.length < 2) return false;
      
      // Count children that look like product cards
      let productLikeCount = 0;
      for (let i = 0; i < Math.min(5, children.length); i++) {
        if (this.isProductLike(children[i])) {
          productLikeCount++;
        }
      }
      
      return productLikeCount >= 2;
    });
  }

  findListProducts() {
    const lists = Array.from(document.querySelectorAll('ul, ol'));
    
    return lists.filter(list => {
      const items = list.children;
      if (items.length < 2) return false;
      
      // Check if items contain product data
      let productLikeCount = 0;
      for (let i = 0; i < Math.min(5, items.length); i++) {
        if (this.isProductLike(items[i])) {
          productLikeCount++;
        }
      }
      
      return productLikeCount >= 2;
    });
  }

  findTableProducts() {
    const tables = Array.from(document.querySelectorAll('table'));
    
    return tables.filter(table => {
      const rows = table.rows;
      if (rows.length < 2) return false;
      
      // Check for product data in first few rows
      let productLikeCount = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        const text = row.textContent.toLowerCase();
        
        if (this.containsPrice(text) || this.containsProductKeywords(text)) {
          productLikeCount++;
        }
      }
      
      return productLikeCount >= 2;
    });
  }

  findCardProducts() {
    const elements = Array.from(document.querySelectorAll('div, article, section'));
    
    return elements.filter(el => {
      // Check class names for card patterns
      const className = el.className.toLowerCase();
      const isCard = className.includes('card') || 
                     className.includes('product') ||
                     className.includes('item');
      
      if (!isCard) return false;
      
      // Check content for product indicators
      const text = el.textContent;
      return this.containsPrice(text) || 
             el.querySelector('img') !== null ||
             el.querySelector('button, .btn') !== null;
    });
  }

  findContainerProducts() {
    const elements = Array.from(document.querySelectorAll('div, section'));
    
    return elements.filter(el => {
      const children = el.children;
      if (children.length < 3) return false;
      
      // Look for repeating patterns
      const patterns = this.analyzePattern(children);
      
      // Check if pattern suggests products
      if (patterns.consistentStructure < 0.7) return false;
      
      // Check if children contain product indicators
      let productIndicators = 0;
      for (let i = 0; i < Math.min(3, children.length); i++) {
        const child = children[i];
        if (this.isProductLike(child)) {
          productIndicators++;
        }
      }
      
      return productIndicators >= 2;
    });
  }

  analyzePattern(children) {
    const sampleSize = Math.min(5, children.length);
    const samples = Array.from(children).slice(0, sampleSize);
    
    // Analyze tag pattern
    const tags = samples.map(child => child.tagName);
    const uniqueTags = new Set(tags);
    
    // Analyze class pattern
    const classes = samples.map(child => child.className);
    const uniqueClasses = new Set(classes.filter(c => c));
    
    // Analyze size pattern
    const sizes = samples.map(child => ({
      width: child.offsetWidth,
      height: child.offsetHeight
    }));
    
    const consistentSize = sizes.every(size => 
      Math.abs(size.width - sizes[0].width) < 50 &&
      Math.abs(size.height - sizes[0].height) < 50
    );
    
    return {
      consistentStructure: uniqueTags.size === 1 ? 1.0 : 0.5,
      consistentClasses: uniqueClasses.size <= 2 ? 1.0 : 0.3,
      consistentSize: consistentSize ? 1.0 : 0.2
    };
  }

  isProductLike(element) {
    if (!element) return false;
    
    const text = element.textContent;
    const hasPrice = this.containsPrice(text);
    const hasImage = element.querySelector('img') !== null;
    const hasButton = element.querySelector('button, .btn, [role="button"]') !== null;
    const hasTitle = element.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]') !== null;
    
    // Score based on product indicators
    let score = 0;
    if (hasPrice) score += 3;
    if (hasImage) score += 2;
    if (hasButton) score += 1;
    if (hasTitle) score += 1;
    
    // Check dimensions (products are usually reasonably sized)
    const rect = element.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 50) score += 1;
    
    return score >= 3;
  }

  containsPrice(text) {
    if (!text) return false;
    
    return this.PRICE_PATTERNS.some(pattern => pattern.test(text));
  }

  containsProductKeywords(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return this.PRODUCT_PATTERNS.some(keyword => lowerText.includes(keyword));
  }

  scoreContainers(containers) {
    return containers.map(container => {
      let score = 0;
      const reasons = [];
      
      // 1. Children analysis
      const children = container.children;
      const childCount = children.length;
      
      if (childCount >= 3) {
        score += 0.2;
        reasons.push(`Has ${childCount} items`);
      }
      
      // 2. Product-like children count
      const productChildren = this.countProductChildren(container);
      const productRatio = productChildren / Math.max(1, childCount);
      
      score += productRatio * 0.3;
      if (productRatio > 0.5) {
        reasons.push(`${Math.round(productRatio * 100)}% product-like items`);
      }
      
      // 3. Pattern consistency
      const pattern = this.analyzePattern(children);
      score += (pattern.consistentStructure + pattern.consistentClasses + pattern.consistentSize) / 3 * 0.2;
      
      if (pattern.consistentStructure > 0.8) {
        reasons.push('Consistent structure');
      }
      
      // 4. Semantic score
      const semanticScore = this.getSemanticScore(container);
      score += semanticScore;
      
      // 5. Visibility and size
      const rect = container.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 100) {
        score += 0.1;
        reasons.push('Good visibility');
      }
      
      return {
        element: container,
        score: Math.min(1, score),
        confidence: score,
        reasons,
        metadata: {
          items: childCount,
          productItems: productChildren,
          patternScore: pattern
        }
      };
    })
    .filter(container => container.score >= this.CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  }

  countProductChildren(container) {
    const children = container.children;
    let count = 0;
    
    for (let i = 0; i < Math.min(10, children.length); i++) {
      if (this.isProductLike(children[i])) {
        count++;
      }
    }
    
    return count;
  }

  getSemanticScore(element) {
    let score = 0;
    
    // Check attributes
    const attributes = ['role', 'data-product', 'data-items', 'aria-label'];
    attributes.forEach(attr => {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr).toLowerCase();
        if (value.includes('product') || value.includes('grid') || value.includes('list')) {
          score += 0.1;
        }
      }
    });
    
    // Check class names
    const className = element.className.toLowerCase();
    const productWords = ['product', 'catalog', 'grid', 'list', 'items', 'shop', 'store'];
    
    productWords.forEach(word => {
      if (className.includes(word)) {
        score += 0.05;
      }
    });
    
    // Check ID
    const id = element.id.toLowerCase();
    if (id.includes('product') || id.includes('catalog')) {
      score += 0.1;
    }
    
    return Math.min(0.25, score);
  }

  generateSelectors(scoredContainers) {
    const selectors = new Map();
    
    scoredContainers.forEach((container, index) => {
      const element = container.element;
      
      const selectorOptions = [];
      
      // 1. Direct ID selector
      if (element.id) {
        const idSelector = `#${CSS.escape(element.id)}`;
        selectorOptions.push(idSelector);
      }
      
      // 2. Smart class selectors
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(c => c);
        
        // Try individual classes first
        classes.forEach(className => {
          const selector = `.${CSS.escape(className)}`;
          const matches = document.querySelectorAll(selector).length;
          
          // Prefer classes that match 1-10 similar elements
          if (matches >= 1 && matches <= 10) {
            selectorOptions.push(selector);
          }
        });
        
        // Try combinations for better specificity
        if (classes.length >= 2 && classes.length <= 4) {
          // Try all 2-class combinations
          for (let i = 0; i < classes.length; i++) {
            for (let j = i + 1; j < classes.length; j++) {
              const combo = `.${CSS.escape(classes[i])}.${CSS.escape(classes[j])}`;
              selectorOptions.push(combo);
            }
          }
        }
      }
      
      // 3. Tag + attribute selectors
      const tag = element.tagName.toLowerCase();
      
      // Check for data attributes
      const dataAttrs = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'));
      
      dataAttrs.forEach(attr => {
        const selector = `${tag}[${attr.name}="${CSS.escape(attr.value)}"]`;
        selectorOptions.push(selector);
      });
      
      // 4. Contextual selectors
      const contextSelector = this.generateContextSelector(element);
      if (contextSelector) {
        selectorOptions.push(contextSelector);
      }
      
      // 5. Structural selectors
      const structureSelector = this.generateStructureSelector(element);
      if (structureSelector) {
        selectorOptions.push(structureSelector);
      }
      
      // Rank and filter
      const rankedSelectors = this.rankProductSelectors(selectorOptions, element);
      
      selectors.set(`products_${index + 1}`, {
        element: element,
        selectors: rankedSelectors,
        confidence: container.confidence,
        metadata: container.metadata
      });
    });
    
    return Object.fromEntries(selectors);
  }

  generateContextSelector(element) {
    // Look for unique parent context
    let current = element.parentNode;
    let depth = 0;
    
    while (current && current !== document.body && depth < 3) {
      if (current.id) {
        return `#${CSS.escape(current.id)} > ${element.tagName.toLowerCase()}`;
      }
      
      // Check for unique class in parent
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length === 1) {
          const parentClass = classes[0];
          const similarParents = document.querySelectorAll(`.${CSS.escape(parentClass)}`);
          
          if (similarParents.length === 1) {
            const childTag = element.tagName.toLowerCase();
            return `.${CSS.escape(parentClass)} > ${childTag}`;
          }
        }
      }
      
      current = current.parentNode;
      depth++;
    }
    
    return null;
  }

  generateStructureSelector(element) {
    const children = element.children;
    if (children.length === 0) return null;
    
    // Analyze children structure
    const firstChild = children[0];
    const childTag = firstChild.tagName.toLowerCase();
    
    // Check if all children have same tag
    const allSameTag = Array.from(children).every(child => 
      child.tagName.toLowerCase() === childTag
    );
    
    if (allSameTag && children.length >= 3) {
      const parentTag = element.tagName.toLowerCase();
      return `${parentTag} > ${childTag}`;
    }
    
    return null;
  }

  rankProductSelectors(selectors, targetElement) {
    return selectors
      .map(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          const matches = elements.length;
          const isExact = elements[0] === targetElement;
          
          let score = 0;
          
          // Exact match is crucial
          if (isExact) score += 3;
          
          // Simplicity (shorter is better)
          score += (150 - selector.length) / 150;
          
          // Specificity (fewer matches is better)
          if (matches === 1) score += 2;
          else if (matches <= 3) score += 1.5;
          else if (matches <= 10) score += 1;
          else score += Math.max(0, (20 - matches) / 20);
          
          // ID selectors get bonus
          if (selector.startsWith('#')) score += 2;
          
          // Class selector analysis
          if (selector.includes('.') && !selector.includes('#')) {
            const classCount = (selector.match(/\./g) || []).length;
            
            // 1-2 classes is ideal
            if (classCount === 1) score += 1.2;
            else if (classCount === 2) score += 1.5;
            else if (classCount === 3) score += 1.0;
            else score += 0.5;
          }
          
          // Contextual selectors (with >) are more stable
          if (selector.includes(' > ')) score += 0.8;
          
          // Attribute selectors are good
          if (selector.includes('[')) score += 0.5;
          
          return {
            selector,
            score: Math.max(0, score),
            matches,
            isExact,
            specificity: this.calculateSpecificity(selector)
          };
        } catch (e) {
          return {
            selector,
            score: -1,
            error: e.message
          };
        }
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  calculateSpecificity(selector) {
    // Simple specificity calculation
    let specificity = 0;
    
    // ID selectors
    const idMatches = selector.match(/#[a-zA-Z][\w\-]*/g);
    if (idMatches) specificity += idMatches.length * 100;
    
    // Class/attribute selectors
    const classMatches = selector.match(/\.[a-zA-Z][\w\-]*/g);
    const attrMatches = selector.match(/\[[^\]]+\]/g);
    if (classMatches) specificity += classMatches.length * 10;
    if (attrMatches) specificity += attrMatches.length * 10;
    
    // Element selectors
    const elementMatches = selector.match(/[^.#\[ ][a-zA-Z][\w\-]*/g);
    if (elementMatches) specificity += elementMatches.length;
    
    return specificity;
  }

  extractData(container, options = {}) {
    const startTime = performance.now();
    
    const config = {
      deep: options.deep !== false,
      maxProducts: options.maxProducts || 100,
      includeImages: options.includeImages !== false,
      includePrices: options.includePrices !== false,
      ...options
    };
    
    const products = this.extractProductsFromContainer(container, config);
    
    const processingTime = performance.now() - startTime;
    
    return {
      data: products,
      metadata: {
        processingTime,
        products: products.length,
        container: container.tagName
      }
    };
  }

  extractProductsFromContainer(container, config) {
    const children = Array.from(container.children).slice(0, config.maxProducts * 2);
    const products = [];
    
    children.forEach((child, index) => {
      if (this.isProductLike(child)) {
        const productData = this.extractProductData(child, config);
        productData.index = index + 1;
        products.push(productData);
      }
    });
    
    return products.slice(0, config.maxProducts);
  }

  extractProductData(element, config) {
    const product = {
      title: this.extractTitle(element),
      price: config.includePrices ? this.extractPrice(element) : null,
      url: this.extractUrl(element),
      image: config.includeImages ? this.extractImage(element) : null,
      description: this.extractDescription(element),
      rating: this.extractRating(element),
      availability: this.extractAvailability(element),
      element: element
    };
    
    // Clean up empty values
    Object.keys(product).forEach(key => {
      if (product[key] === null || product[key] === undefined || product[key] === '') {
        delete product[key];
      }
    });
    
    return product;
  }

  extractTitle(element) {
    // Try multiple strategies to find title
    const selectors = [
      'h1', 'h2', 'h3', 'h4',
      '[class*="title"]', '[class*="name"]',
      '[itemprop="name"]', '.product-title', '.item-title',
      'strong', 'b', '.name', '.title'
    ];
    
    for (const selector of selectors) {
      const element = element.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    // Fallback: find text that looks like a title
    const text = element.textContent.trim();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length > 0) {
      // Return first non-price, non-short line
      for (const line of lines) {
        if (line.length > 10 && line.length < 100 && !this.containsPrice(line)) {
          return line;
        }
      }
    }
    
    return '';
  }

  extractPrice(element) {
    const text = element.textContent;
    
    // Try regex patterns
    for (const pattern of this.PRICE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Try specific price elements
    const priceSelectors = [
      '.price', '.cost', '.amount', '.value',
      '[class*="price"]', '[itemprop="price"]',
      'span[class*="currency"]', '.product-price'
    ];
    
    for (const selector of priceSelectors) {
      const priceElement = element.querySelector(selector);
      if (priceElement && priceElement.textContent.trim()) {
        return priceElement.textContent.trim();
      }
    }
    
    return null;
  }

  extractUrl(element) {
    // Find links within the product element
    const links = element.querySelectorAll('a[href]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        // Prefer absolute URLs
        try {
          return new URL(href, window.location.origin).href;
        } catch (e) {
          return href;
        }
      }
    }
    
    return null;
  }

  extractImage(element) {
    const images = element.querySelectorAll('img[src]');
    
    for (const img of images) {
      const src = img.getAttribute('src');
      if (src && !src.includes('data:image') && !src.includes('placeholder')) {
        try {
          return new URL(src, window.location.origin).href;
        } catch (e) {
          return src;
        }
      }
    }
    
    return null;
  }

  extractDescription(element) {
    const descriptionSelectors = [
      '.description', '.desc', '.details',
      '[class*="description"]', '[itemprop="description"]',
      'p:not(:empty)', '.product-desc'
    ];
    
    for (const selector of descriptionSelectors) {
      const descElement = element.querySelector(selector);
      if (descElement && descElement.textContent.trim()) {
        const text = descElement.textContent.trim();
        if (text.length > 20 && text.length < 500) {
          return text;
        }
      }
    }
    
    return null;
  }

  extractRating(element) {
    const ratingSelectors = [
      '.rating', '.stars', '.review',
      '[class*="rating"]', '[itemprop="ratingValue"]',
      '.product-rating', '[aria-label*="star"]'
    ];
    
    for (const selector of ratingSelectors) {
      const ratingElement = element.querySelector(selector);
      if (ratingElement) {
        const text = ratingElement.textContent.trim();
        // Extract numeric rating
        const match = text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*\d+/i) ||
                     text.match(/(\d+(?:\.\d+)?)/);
        
        if (match) {
          return parseFloat(match[1]);
        }
        
        // Check for star symbols
        const stars = (text.match(/★/g) || []).length;
        if (stars > 0) {
          return stars;
        }
      }
    }
    
    return null;
  }

  extractAvailability(element) {
    const availabilitySelectors = [
      '.availability', '.stock', '.inventory',
      '[class*="stock"]', '[class*="available"]',
      '.product-availability'
    ];
    
    for (const selector of availabilitySelectors) {
      const availElement = element.querySelector(selector);
      if (availElement) {
        const text = availElement.textContent.toLowerCase();
        if (text.includes('in stock') || text.includes('available')) {
          return 'In Stock';
        } else if (text.includes('out of stock') || text.includes('sold out')) {
          return 'Out of Stock';
        } else if (text.includes('preorder') || text.includes('coming soon')) {
          return 'Preorder';
        }
      }
    }
    
    return null;
  }
}

// Export for use in content script
window.ProductDetector = ProductDetector;