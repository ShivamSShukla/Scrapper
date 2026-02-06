class ListDetector {
  constructor() {
    this.CONFIDENCE_THRESHOLD = 0.5;
    this.MIN_ITEMS = 3;
  }

  detect() {
    const startTime = performance.now();
    
    const lists = this.findAllLists();
    const scoredLists = this.scoreLists(lists);
    
    console.log(`List detection completed in ${performance.now() - startTime}ms`);
    
    return {
      lists: scoredLists,
      selectors: this.generateSelectors(scoredLists),
      confidence: scoredLists.length > 0 ? scoredLists[0].confidence : 0
    };
  }

  findAllLists() {
    const strategies = [
      // Native HTML lists
      () => Array.from(document.querySelectorAll('ul, ol')),
      
      // Div lists
      () => this.findDivLists(),
      
      // Table lists (single column tables)
      () => this.findTableLists(),
      
      // Grid lists
      () => this.findGridLists()
    ];
    
    const allLists = new Set();
    
    strategies.forEach(strategy => {
      try {
        const lists = strategy();
        lists.forEach(list => allLists.add(list));
      } catch (e) {
        console.warn('List detection strategy failed:', e);
      }
    });
    
    return Array.from(allLists);
  }

  findDivLists() {
    const divs = Array.from(document.querySelectorAll('div, section'));
    
    return divs.filter(div => {
      const children = div.children;
      if (children.length < this.MIN_ITEMS) return false;
      
      // Check if children have similar structure
      const firstChild = children[0];
      if (!firstChild) return false;
      
      // Count similar siblings
      let similarCount = 0;
      const firstTag = firstChild.tagName;
      const firstClass = firstChild.className;
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === firstTag && child.className === firstClass) {
          similarCount++;
        }
      }
      
      return similarCount >= this.MIN_ITEMS;
    });
  }

  findTableLists() {
    const tables = Array.from(document.querySelectorAll('table'));
    
    return tables.filter(table => {
      const rows = table.rows;
      if (rows.length < this.MIN_ITEMS) return false;
      
      // Check if it's essentially a single-column table
      const firstRow = rows[0];
      if (!firstRow || firstRow.cells.length > 3) return false;
      
      return true;
    });
  }

  findGridLists() {
    const elements = Array.from(document.querySelectorAll('div, ul, ol'));
    
    return elements.filter(el => {
      const style = window.getComputedStyle(el);
      const isGrid = style.display.includes('grid');
      const isFlex = style.display.includes('flex');
      
      if (!isGrid && !isFlex) return false;
      
      // Check for list-like children
      const children = el.children;
      if (children.length < this.MIN_ITEMS) return false;
      
      // Count similar children
      let similarCount = 0;
      const firstChild = children[0];
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.offsetHeight > 0 && child.offsetWidth > 0) {
          similarCount++;
        }
      }
      
      return similarCount >= this.MIN_ITEMS;
    });
  }

  scoreLists(lists) {
    return lists.map(list => {
      let score = 0;
      const reasons = [];
      
      // 1. Native list element score
      const tagName = list.tagName.toLowerCase();
      if (tagName === 'ul' || tagName === 'ol') {
        score += 0.3;
        reasons.push('Native list element');
      }
      
      // 2. Item count score
      const itemCount = this.getItemCount(list);
      if (itemCount >= 5) {
        score += 0.2;
        reasons.push(`Has ${itemCount} items`);
      }
      
      // 3. Item consistency score
      const consistency = this.getConsistencyScore(list);
      score += consistency * 0.2;
      if (consistency > 0.7) {
        reasons.push('Consistent items');
      }
      
      // 4. Text density score
      const textDensity = this.getTextDensity(list);
      if (textDensity > 0.2) {
        score += 0.1;
        reasons.push('Good text content');
      }
      
      // 5. Semantic score
      const semanticScore = this.getSemanticScore(list);
      score += semanticScore;
      
      // 6. Visibility score
      const rect = list.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        score += 0.1;
        reasons.push('Visible on screen');
      }
      
      return {
        element: list,
        score: Math.min(1, score),
        confidence: score,
        reasons,
        metadata: {
          items: itemCount,
          tagName,
          textDensity
        }
      };
    })
    .filter(list => list.score >= this.CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  }

  getItemCount(list) {
    if (list.tagName.toLowerCase() === 'ul' || list.tagName.toLowerCase() === 'ol') {
      return list.children.length;
    }
    
    // For non-list elements, count children that look like items
    const children = list.children;
    let itemCount = 0;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.offsetHeight > 0) {
        itemCount++;
      }
    }
    
    return itemCount;
  }

  getConsistencyScore(list) {
    const children = list.children;
    if (children.length < 2) return 0;
    
    const firstChild = children[0];
    let similarCount = 0;
    
    for (let i = 1; i < Math.min(10, children.length); i++) {
      const child = children[i];
      
      // Compare tag and class
      if (child.tagName === firstChild.tagName && 
          child.className === firstChild.className) {
        similarCount++;
      }
    }
    
    return similarCount / Math.min(10, children.length - 1);
  }

  getTextDensity(list) {
    const textLength = list.textContent.trim().length;
    const htmlLength = list.innerHTML.length;
    
    if (htmlLength === 0) return 0;
    return textLength / htmlLength;
  }

  getSemanticScore(list) {
    let score = 0;
    
    // Check for semantic attributes
    const attributes = ['role', 'aria-label', 'data-list', 'data-items'];
    attributes.forEach(attr => {
      if (list.hasAttribute(attr)) {
        const value = list.getAttribute(attr);
        if (value && value.toLowerCase().includes('list') || 
            value.toLowerCase().includes('items')) {
          score += 0.1;
        }
      }
    });
    
    // Check class names
    const className = list.className.toLowerCase();
    const listWords = ['list', 'items', 'collection', 'products', 'menu', 'nav'];
    
    listWords.forEach(word => {
      if (className.includes(word)) {
        score += 0.05;
      }
    });
    
    return Math.min(0.25, score);
  }

  generateSelectors(scoredLists) {
    const selectors = new Map();
    
    scoredLists.forEach((list, index) => {
      const element = list.element;
      
      // Generate multiple selector options
      const selectorOptions = [];
      
      // 1. ID selector
      if (element.id) {
        selectorOptions.push(`#${CSS.escape(element.id)}`);
      }
      
      // 2. Class-based selectors
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(c => c);
        
        classes.forEach(className => {
          const selector = `.${CSS.escape(className)}`;
          const similarCount = document.querySelectorAll(selector).length;
          
          // Prefer moderately specific selectors
          if (similarCount > 0 && similarCount < 20) {
            selectorOptions.push(selector);
          }
        });
        
        // Combined class selector
        if (classes.length >= 2 && classes.length <= 4) {
          const combined = '.' + classes.map(c => CSS.escape(c)).join('.');
          selectorOptions.push(combined);
        }
      }
      
      // 3. Tag + attribute combinations
      const tag = element.tagName.toLowerCase();
      
      // Add role attribute if present
      if (element.hasAttribute('role')) {
        selectorOptions.push(`${tag}[role="${element.getAttribute('role')}"]`);
      }
      
      // 4. Hierarchical selectors
      const pathSelector = this.generatePathSelector(element);
      if (pathSelector) {
        selectorOptions.push(pathSelector);
      }
      
      // 5. Position-based
      const similarElements = document.querySelectorAll(tag);
      if (similarElements.length > 1) {
        const position = Array.from(similarElements).indexOf(element) + 1;
        selectorOptions.push(`${tag}:nth-of-type(${position})`);
      }
      
      // Rank and filter selectors
      const rankedSelectors = this.rankSelectors(selectorOptions, element);
      
      selectors.set(`list_${index + 1}`, {
        element: element,
        selectors: rankedSelectors,
        confidence: list.confidence,
        metadata: list.metadata
      });
    });
    
    return Object.fromEntries(selectors);
  }

  generatePathSelector(element) {
    const path = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== document.body && depth < 5) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      // Add single class if it provides good specificity
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length === 1) {
          const singleClass = classes[0];
          const similarWithClass = document.querySelectorAll(`.${CSS.escape(singleClass)}`).length;
          
          if (similarWithClass < 10) {
            selector += `.${CSS.escape(singleClass)}`;
          }
        }
      }
      
      path.unshift(selector);
      current = current.parentNode;
      depth++;
    }
    
    if (path.length > 0) {
      return path.join(' > ');
    }
    
    return null;
  }

  rankSelectors(selectors, targetElement) {
    return selectors
      .map(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          const matches = elements.length;
          const isExact = elements[0] === targetElement;
          
          let score = 0;
          
          // Exact match bonus
          if (isExact) score += 2;
          
          // Simplicity bonus (shorter is generally better)
          score += (100 - selector.length) / 100;
          
          // Specificity bonus (fewer matches is better)
          score += Math.max(0, 10 - matches) / 10;
          
          // ID selector bonus
          if (selector.startsWith('#')) score += 1.5;
          
          // Class selector bonus (moderate)
          if (selector.includes('.') && !selector.includes('#')) {
            const classCount = (selector.match(/\./g) || []).length;
            if (classCount === 1) score += 0.8;
            else if (classCount === 2) score += 1.0;
            else if (classCount === 3) score += 0.6;
          }
          
          return {
            selector,
            score,
            matches,
            isExact,
            length: selector.length
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

  extractData(listElement, options = {}) {
    const startTime = performance.now();
    
    const config = {
      includeChildren: options.includeChildren !== false,
      maxItems: options.maxItems || 1000,
      ...options
    };
    
    let items = [];
    
    if (listElement.tagName.toLowerCase() === 'ul' || 
        listElement.tagName.toLowerCase() === 'ol') {
      items = this.extractNativeList(listElement, config);
    } else {
      items = this.extractDivList(listElement, config);
    }
    
    const processingTime = performance.now() - startTime;
    
    return {
      data: items,
      metadata: {
        processingTime,
        items: items.length
      }
    };
  }

  extractNativeList(list, config) {
    const items = Array.from(list.children).slice(0, config.maxItems);
    
    return items.map((item, index) => {
      const itemData = {
        text: this.cleanText(item),
        index: index + 1,
        html: config.includeHtml ? item.innerHTML.trim() : undefined
      };
      
      // Extract links if present
      const links = item.querySelectorAll('a');
      if (links.length > 0) {
        itemData.links = Array.from(links).map(link => ({
          text: link.textContent.trim(),
          href: link.href,
          title: link.title
        }));
      }
      
      // Extract images if present
      const images = item.querySelectorAll('img');
      if (images.length > 0) {
        itemData.images = Array.from(images).map(img => ({
          src: img.src,
          alt: img.alt,
          title: img.title
        }));
      }
      
      return itemData;
    });
  }

  extractDivList(div, config) {
    const children = Array.from(div.children).slice(0, config.maxItems);
    
    return children.map((child, index) => {
      const itemData = {
        text: this.cleanText(child),
        index: index + 1,
        tag: child.tagName.toLowerCase(),
        html: config.includeHtml ? child.innerHTML.trim() : undefined
      };
      
      // Extract additional data based on child type
      if (child.tagName.toLowerCase() === 'a') {
        itemData.href = child.href;
        itemData.title = child.title;
      } else if (child.tagName.toLowerCase() === 'img') {
        itemData.src = child.src;
        itemData.alt = child.alt;
      }
      
      // Recursively extract from nested structures
      if (config.includeChildren && child.children.length > 0) {
        itemData.children = Array.from(child.children).map(grandChild => ({
          tag: grandChild.tagName.toLowerCase(),
          text: this.cleanText(grandChild)
        }));
      }
      
      return itemData;
    });
  }

  cleanText(element) {
    if (!element) return '';
    
    let text = element.textContent || element.innerText || '';
    
    return text.trim()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ');
  }
}

// Export for use in content script
window.ListDetector = ListDetector;