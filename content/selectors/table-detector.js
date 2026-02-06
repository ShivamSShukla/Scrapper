class TableDetector {
  constructor() {
    this.CONFIDENCE_THRESHOLD = 0.6;
    this.MIN_ROWS = 2;
    this.MIN_COLS = 2;
  }

  detect(tables = null) {
    const startTime = performance.now();
    
    const allTables = tables || this.findAllTables();
    const scoredTables = this.scoreTables(allTables);
    
    console.log(`Table detection completed in ${performance.now() - startTime}ms`);
    
    return {
      tables: scoredTables,
      selectors: this.generateSelectors(scoredTables),
      confidence: scoredTables.length > 0 ? scoredTables[0].confidence : 0
    };
  }

  findAllTables() {
    // Multiple strategies to find tables
    const strategies = [
      // Direct table elements
      () => Array.from(document.querySelectorAll('table')),
      
      // Div tables (common in modern sites)
      () => this.findDivTables(),
      
      // List tables
      () => this.findListTables(),
      
      // Grid-based tables
      () => this.findGridTables()
    ];
    
    const allTables = new Set();
    
    strategies.forEach(strategy => {
      try {
        const tables = strategy();
        tables.forEach(table => allTables.add(table));
      } catch (e) {
        console.warn('Table detection strategy failed:', e);
      }
    });
    
    return Array.from(allTables);
  }

  findDivTables() {
    // Look for div structures that behave like tables
    const divs = Array.from(document.querySelectorAll('div'));
    
    return divs.filter(div => {
      // Check if div has table-like structure
      const children = div.children;
      if (children.length < this.MIN_ROWS) return false;
      
      // Check if first row has consistent cell structure
      const firstRow = children[0];
      if (!firstRow || !firstRow.children) return false;
      
      const cellCount = firstRow.children.length;
      if (cellCount < this.MIN_COLS) return false;
      
      // Check if subsequent rows have similar structure
      for (let i = 1; i < Math.min(3, children.length); i++) {
        if (children[i].children.length !== cellCount) {
          return false;
        }
      }
      
      return true;
    });
  }

  findListTables() {
    // Detect tables made from lists
    const lists = Array.from(document.querySelectorAll('ul, ol'));
    
    return lists.filter(list => {
      const items = list.children;
      if (items.length < this.MIN_ROWS) return false;
      
      // Check if list items contain multiple data points
      return Array.from(items).some(item => {
        const subItems = item.querySelectorAll('span, div, p');
        return subItems.length >= this.MIN_COLS;
      });
    });
  }

  findGridTables() {
    // CSS Grid/Flexbox tables
    const elements = Array.from(document.querySelectorAll('div, section'));
    
    return elements.filter(el => {
      const style = window.getComputedStyle(el);
      const isGrid = style.display.includes('grid');
      const isFlex = style.display.includes('flex');
      
      if (!isGrid && !isFlex) return false;
      
      // Check grid/flex children structure
      const children = el.children;
      if (children.length < this.MIN_ROWS * this.MIN_COLS) return false;
      
      // Look for row/col patterns
      let rowCount = 0;
      let colCount = 0;
      
      // Simple heuristic: count visible "cells"
      const visibleChildren = Array.from(children).filter(child => {
        return child.offsetWidth > 0 && child.offsetHeight > 0;
      });
      
      return visibleChildren.length >= (this.MIN_ROWS * this.MIN_COLS);
    });
  }

  scoreTables(tables) {
    return tables.map(table => {
      let score = 0;
      const reasons = [];
      
      // 1. Table element score
      if (table.tagName.toLowerCase() === 'table') {
        score += 0.3;
        reasons.push('Native table element');
      }
      
      // 2. Size score
      const rowCount = this.getRowCount(table);
      const colCount = this.getColumnCount(table);
      
      if (rowCount >= 5) {
        score += 0.2;
        reasons.push('Has 5+ rows');
      }
      
      if (colCount >= 3) {
        score += 0.15;
        reasons.push('Has 3+ columns');
      }
      
      // 3. Content density score
      const textDensity = this.getTextDensity(table);
      if (textDensity > 0.1) {
        score += 0.1;
        reasons.push('Good text density');
      }
      
      // 4. Structure consistency score
      const structureScore = this.getStructureScore(table);
      score += structureScore * 0.15;
      if (structureScore > 0.7) {
        reasons.push('Consistent structure');
      }
      
      // 5. Semantic score
      const semanticScore = this.getSemanticScore(table);
      score += semanticScore;
      
      // 6. Visibility score
      const rect = table.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 50) {
        score += 0.1;
        reasons.push('Visible on screen');
      }
      
      return {
        element: table,
        score: Math.min(1, score),
        confidence: score,
        reasons,
        metadata: {
          rows: rowCount,
          columns: colCount,
          textDensity,
          tagName: table.tagName
        }
      };
    })
    .filter(table => table.score >= this.CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  }

  getRowCount(table) {
    if (table.tagName.toLowerCase() === 'table') {
      return table.rows.length;
    }
    
    // For non-table elements
    const children = table.children;
    let rowCount = 0;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // Check if child looks like a row
      const childStyle = window.getComputedStyle(child);
      const isBlock = childStyle.display.includes('block') || 
                      childStyle.display.includes('flex') ||
                      childStyle.display.includes('grid');
      
      if (isBlock && child.offsetHeight > 0) {
        rowCount++;
      }
    }
    
    return rowCount;
  }

  getColumnCount(table) {
    if (table.tagName.toLowerCase() === 'table') {
      const firstRow = table.rows[0];
      return firstRow ? firstRow.cells.length : 0;
    }
    
    // For non-table elements, find max children in a row
    let maxColumns = 0;
    const children = table.children;
    
    for (let i = 0; i < Math.min(5, children.length); i++) {
      const row = children[i];
      const cells = row.children || row.querySelectorAll('> *');
      maxColumns = Math.max(maxColumns, cells.length);
    }
    
    return maxColumns;
  }

  getTextDensity(table) {
    const textLength = table.textContent.trim().length;
    const htmlLength = table.innerHTML.length;
    
    if (htmlLength === 0) return 0;
    return textLength / htmlLength;
  }

  getStructureScore(table) {
    if (table.tagName.toLowerCase() !== 'table') {
      return this.getDivStructureScore(table);
    }
    
    const rows = table.rows;
    if (rows.length < 2) return 0;
    
    const firstRowCols = rows[0].cells.length;
    let consistentRows = 0;
    
    for (let i = 1; i < Math.min(10, rows.length); i++) {
      if (rows[i].cells.length === firstRowCols) {
        consistentRows++;
      }
    }
    
    return consistentRows / Math.min(10, rows.length - 1);
  }

  getDivStructureScore(div) {
    const children = div.children;
    if (children.length < 2) return 0;
    
    const firstRowChildren = children[0].children.length;
    let consistentRows = 0;
    
    for (let i = 1; i < Math.min(5, children.length); i++) {
      if (children[i].children.length === firstRowChildren) {
        consistentRows++;
      }
    }
    
    return consistentRows / Math.min(5, children.length - 1);
  }

  getSemanticScore(table) {
    let score = 0;
    
    // Check for semantic attributes
    const attributes = ['role', 'aria-label', 'data-table', 'data-grid'];
    attributes.forEach(attr => {
      if (table.hasAttribute(attr)) {
        const value = table.getAttribute(attr);
        if (value && value.toLowerCase().includes('table') || 
            value.toLowerCase().includes('grid')) {
          score += 0.1;
        }
      }
    });
    
    // Check class names
    const className = table.className.toLowerCase();
    const tableWords = ['table', 'grid', 'list', 'data', 'results', 'products'];
    
    tableWords.forEach(word => {
      if (className.includes(word)) {
        score += 0.05;
      }
    });
    
    // Check for common table patterns
    const text = table.textContent.toLowerCase();
    const patterns = ['price', 'total', 'quantity', 'description', 'name'];
    
    patterns.forEach(pattern => {
      if (text.includes(pattern)) {
        score += 0.02;
      }
    });
    
    return Math.min(0.25, score);
  }

  generateSelectors(scoredTables) {
    const selectors = new Map();
    
    scoredTables.forEach((table, index) => {
      const element = table.element;
      
      // Generate multiple selector options
      const selectorOptions = [];
      
      // 1. ID selector (most specific)
      if (element.id) {
        selectorOptions.push(`#${CSS.escape(element.id)}`);
      }
      
      // 2. Class-based selectors
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          // Try different combinations
          classes.forEach(className => {
            const selector = `.${CSS.escape(className)}`;
            if (document.querySelectorAll(selector).length < 10) {
              selectorOptions.push(selector);
            }
          });
          
          // Combined class selector
          if (classes.length <= 3) {
            const combined = '.' + classes.map(c => CSS.escape(c)).join('.');
            selectorOptions.push(combined);
          }
        }
      }
      
      // 3. Tag + attribute combinations
      const tag = element.tagName.toLowerCase();
      
      // Try with data attributes
      const dataAttrs = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'));
      
      dataAttrs.forEach(attr => {
        selectorOptions.push(`${tag}[${attr.name}="${CSS.escape(attr.value)}"]`);
      });
      
      // 4. Hierarchical selectors
      const pathSelector = this.generatePathSelector(element);
      if (pathSelector) {
        selectorOptions.push(pathSelector);
      }
      
      // 5. Position-based selector (last resort)
      const similarElements = document.querySelectorAll(tag);
      if (similarElements.length > 1) {
        const position = Array.from(similarElements).indexOf(element) + 1;
        selectorOptions.push(`${tag}:nth-of-type(${position})`);
      }
      
      // Filter unique selectors and rank them
      const uniqueSelectors = [...new Set(selectorOptions)];
      const rankedSelectors = this.rankSelectors(uniqueSelectors, element);
      
      selectors.set(`table_${index + 1}`, {
        element: element,
        selectors: rankedSelectors,
        confidence: table.confidence,
        metadata: table.metadata
      });
    });
    
    return Object.fromEntries(selectors);
  }

  generatePathSelector(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        return path.join(' > ');
      }
      
      // Add class if unique-ish
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length === 1) {
          selector += `.${CSS.escape(classes[0])}`;
        }
      }
      
      // Get sibling index
      const siblings = Array.from(current.parentNode.children)
        .filter(child => child.tagName === current.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentNode;
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
          
          // Score based on specificity and accuracy
          let score = 0;
          
          // Prefer exact matches
          if (isExact) score += 2;
          
          // Prefer shorter selectors (generally more stable)
          score += (100 - selector.length) / 100;
          
          // Prefer selectors with fewer matches
          score += Math.max(0, 5 - matches) / 5;
          
          // Bonus for ID selectors
          if (selector.startsWith('#')) score += 1;
          
          // Bonus for class selectors with moderate specificity
          if (selector.includes('.') && !selector.includes('#')) {
            const classCount = (selector.match(/\./g) || []).length;
            if (classCount >= 1 && classCount <= 3) score += 0.5;
          }
          
          return {
            selector,
            score,
            matches,
            isExact,
            complexity: selector.length
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
      .slice(0, 5); // Return top 5 selectors
  }

  extractData(tableElement, options = {}) {
    const startTime = performance.now();
    
    const config = {
      includeHeaders: options.includeHeaders !== false,
      includeHtml: options.includeHtml === true,
      maxRows: options.maxRows || 1000,
      ...options
    };
    
    let data = [];
    
    if (tableElement.tagName.toLowerCase() === 'table') {
      data = this.extractNativeTable(tableElement, config);
    } else {
      data = this.extractDivTable(tableElement, config);
    }
    
    const processingTime = performance.now() - startTime;
    
    return {
      data,
      metadata: {
        processingTime,
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]).length : 0
      }
    };
  }

  extractNativeTable(table, config) {
    const rows = Array.from(table.rows);
    const data = [];
    
    // Extract headers
    let headers = [];
    if (config.includeHeaders) {
      const headerRows = table.tHead ? Array.from(table.tHead.rows) : [];
      if (headerRows.length > 0) {
        headers = Array.from(headerRows[0].cells).map(cell => 
          this.cleanText(cell, config.includeHtml)
        );
      }
    }
    
    // If no headers found, generate them
    if (headers.length === 0 && rows.length > 0) {
      const firstRow = rows[0];
      headers = Array.from(firstRow.cells).map((_, index) => `Column ${index + 1}`);
    }
    
    // Extract data rows
    const dataRows = rows.slice(headers.length > 0 ? 1 : 0, config.maxRows);
    
    dataRows.forEach(row => {
      const cells = Array.from(row.cells);
      const rowData = {};
      
      cells.forEach((cell, index) => {
        const header = headers[index] || `Column ${index + 1}`;
        rowData[header] = this.cleanText(cell, config.includeHtml);
      });
      
      data.push(rowData);
    });
    
    return data;
  }

  extractDivTable(div, config) {
    const rows = Array.from(div.children).slice(0, config.maxRows);
    const data = [];
    
    // Try to detect header row
    let headers = [];
    if (config.includeHeaders && rows.length > 0) {
      const firstRow = rows[0];
      const firstRowCells = firstRow.children || firstRow.querySelectorAll('> *');
      headers = Array.from(firstRowCells).map(cell => 
        this.cleanText(cell, config.includeHtml)
      );
    }
    
    // If no headers, generate them
    if (headers.length === 0 && rows.length > 0) {
      const firstRow = rows[0];
      const firstRowCells = firstRow.children || firstRow.querySelectorAll('> *');
      headers = Array.from(firstRowCells).map((_, index) => `Column ${index + 1}`);
    }
    
    // Extract data rows (skip header row if we found headers)
    const startRow = headers.length > 0 ? 1 : 0;
    const dataRows = rows.slice(startRow);
    
    dataRows.forEach(row => {
      const cells = row.children || row.querySelectorAll('> *');
      const rowData = {};
      
      Array.from(cells).forEach((cell, index) => {
        const header = headers[index] || `Column ${index + 1}`;
        rowData[header] = this.cleanText(cell, config.includeHtml);
      });
      
      data.push(rowData);
    });
    
    return data;
  }

  cleanText(element, includeHtml = false) {
    if (!element) return '';
    
    if (includeHtml) {
      return element.innerHTML.trim();
    }
    
    // Get text content with proper spacing
    let text = element.textContent || element.innerText || '';
    
    // Clean whitespace
    text = text.trim()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ');
    
    return text;
  }
}

// Export for use in content script
window.TableDetector = TableDetector;