export default class ScrapingEngine {
  constructor() {
    this.cache = new Map();
    this.workerPool = [];
    this.initWorkers();
  }
  
  initWorkers() {
    // Create web workers for parallel processing
    for (let i = 0; i < navigator.hardwareConcurrency || 4; i++) {
      const worker = new Worker('./utils/data-processor.js');
      this.workerPool.push({
        worker,
        busy: false
      });
    }
  }
  
  async extract(tabId, config) {
    const cacheKey = `${tabId}:${JSON.stringify(config)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) { // 30 second cache
        return cached.data;
      }
    }
    
    const startTime = performance.now();
    
    try {
      // Use fastest available method
      const data = await this.extractViaContentScript(tabId, config);
      
      // Post-process in worker for speed
      const processedData = await this.processInWorker(data, config);
      
      // Cache results
      this.cache.set(cacheKey, {
        data: processedData,
        timestamp: Date.now()
      });
      
      const totalTime = performance.now() - startTime;
      console.log(`Extraction completed in ${totalTime}ms`);
      
      return processedData;
    } catch (error) {
      console.error('Extraction failed:', error);
      throw error;
    }
  }
  
  async extractViaContentScript(tabId, config) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'extract',
        config
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }
  
  async processInWorker(data, config) {
    const availableWorker = this.workerPool.find(w => !w.busy);
    
    if (!availableWorker) {
      // Fallback to main thread if all workers busy
      return this.processInline(data, config);
    }
    
    availableWorker.busy = true;
    
    return new Promise((resolve, reject) => {
      availableWorker.worker.onmessage = (event) => {
        availableWorker.busy = false;
        resolve(event.data);
      };
      
      availableWorker.worker.onerror = (error) => {
        availableWorker.busy = false;
        reject(error);
      };
      
      availableWorker.worker.postMessage({
        action: 'process',
        data,
        config
      });
    });
  }
  
  processInline(data, config) {
    // Fast inline processing for small datasets
    const processors = {
      deduplicate: (arr) => [...new Set(arr)],
      sort: (arr, key) => arr.sort((a, b) => a[key] - b[key]),
      filter: (arr, predicate) => arr.filter(predicate)
    };
    
    let result = data;
    
    if (config.processors) {
      config.processors.forEach(processor => {
        if (processors[processor.name]) {
          result = processors[processor.name](result, ...processor.args);
        }
      });
    }
    
    return result;
  }
}