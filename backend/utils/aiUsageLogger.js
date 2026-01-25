/**
 * AI Usage Logger
 * Tracks and logs AI API usage for cost monitoring and optimization
 */

const errorMonitoring = require('../services/monitoring/ErrorMonitoring');

class AIUsageLogger {
  constructor() {
    this.dailyUsage = {
      date: new Date().toISOString().split('T')[0],
      byModel: {},
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0
    };

    // Cost per 1K tokens (as of 2026-01-24)
    this.pricing = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'text-embedding-ada-002': { input: 0.0001, output: 0 }
    };

    // Reset daily usage at midnight
    this.scheduleDailyReset();
  }

  /**
   * Log AI API usage
   * @param {Object} usage - Usage details
   * @param {string} usage.model - Model used
   * @param {number} usage.promptTokens - Input tokens
   * @param {number} usage.completionTokens - Output tokens
   * @param {string} usage.operation - Operation type
   * @param {string} usage.userId - User ID
   * @param {Object} usage.metadata - Additional metadata
   */
  logUsage(usage) {
    const {
      model,
      promptTokens = 0,
      completionTokens = 0,
      operation,
      userId,
      metadata = {}
    } = usage;

    const totalTokens = promptTokens + completionTokens;
    const cost = this.calculateCost(model, promptTokens, completionTokens);

    // Update daily totals
    this.dailyUsage.totalTokens += totalTokens;
    this.dailyUsage.totalCost += cost;
    this.dailyUsage.requestCount++;

    // Update model-specific totals
    if (!this.dailyUsage.byModel[model]) {
      this.dailyUsage.byModel[model] = {
        tokens: 0,
        cost: 0,
        requests: 0
      };
    }

    this.dailyUsage.byModel[model].tokens += totalTokens;
    this.dailyUsage.byModel[model].cost += cost;
    this.dailyUsage.byModel[model].requests++;

    // Log to monitoring service
    errorMonitoring.trackAIUsage(model, totalTokens, cost, {
      operation,
      userId,
      promptTokens,
      completionTokens,
      ...metadata
    });

    // Log detailed usage
    console.log('[AI Usage]', {
      timestamp: new Date().toISOString(),
      model,
      operation,
      userId,
      tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
      cost: `$${cost.toFixed(4)}`,
      dailyTotal: `$${this.dailyUsage.totalCost.toFixed(2)}`
    });

    // Check for cost threshold alerts
    this.checkCostThresholds();

    return {
      tokens: totalTokens,
      cost,
      dailyTotal: this.dailyUsage.totalCost
    };
  }

  /**
   * Calculate cost for API usage
   * @param {string} model - Model name
   * @param {number} promptTokens - Input tokens
   * @param {number} completionTokens - Output tokens
   * @returns {number} Cost in USD
   */
  calculateCost(model, promptTokens, completionTokens) {
    const pricing = this.pricing[model] || this.pricing['gpt-3.5-turbo'];

    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get daily usage summary
   * @returns {Object} Daily usage statistics
   */
  getDailyUsage() {
    return {
      ...this.dailyUsage,
      averageCostPerRequest: this.dailyUsage.requestCount > 0
        ? this.dailyUsage.totalCost / this.dailyUsage.requestCount
        : 0,
      averageTokensPerRequest: this.dailyUsage.requestCount > 0
        ? this.dailyUsage.totalTokens / this.dailyUsage.requestCount
        : 0
    };
  }

  /**
   * Check if cost thresholds are exceeded
   */
  checkCostThresholds() {
    const thresholds = {
      daily: parseFloat(process.env.AI_DAILY_COST_THRESHOLD) || 100,
      request: parseFloat(process.env.AI_REQUEST_COST_THRESHOLD) || 1
    };

    // Daily threshold
    if (this.dailyUsage.totalCost > thresholds.daily) {
      errorMonitoring.captureMessage(
        `Daily AI cost threshold exceeded: $${this.dailyUsage.totalCost.toFixed(2)}`,
        'warning',
        {
          dailyUsage: this.getDailyUsage(),
          threshold: thresholds.daily
        }
      );
    }

    // Log warning at 80% of threshold
    if (this.dailyUsage.totalCost > thresholds.daily * 0.8) {
      console.warn('[AI Usage] Warning: Approaching daily cost threshold', {
        current: `$${this.dailyUsage.totalCost.toFixed(2)}`,
        threshold: `$${thresholds.daily}`,
        remaining: `$${(thresholds.daily - this.dailyUsage.totalCost).toFixed(2)}`
      });
    }
  }

  /**
   * Schedule daily usage reset at midnight
   */
  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow - now;

    setTimeout(() => {
      this.resetDailyUsage();
      // Schedule next reset
      setInterval(() => this.resetDailyUsage(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Reset daily usage statistics
   */
  resetDailyUsage() {
    // Log summary before reset
    console.log('[AI Usage] Daily summary:', this.getDailyUsage());

    // TODO: Save to database for historical tracking

    // Reset counters
    this.dailyUsage = {
      date: new Date().toISOString().split('T')[0],
      byModel: {},
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0
    };

    console.log('[AI Usage] Daily usage reset');
  }

  /**
   * Get cost estimate for a planned operation
   * @param {string} model - Model to use
   * @param {number} estimatedTokens - Estimated total tokens
   * @returns {Object} Cost estimate
   */
  estimateCost(model, estimatedTokens) {
    const pricing = this.pricing[model] || this.pricing['gpt-3.5-turbo'];

    // Assume 60% prompt, 40% completion for estimate
    const promptTokens = Math.floor(estimatedTokens * 0.6);
    const completionTokens = Math.floor(estimatedTokens * 0.4);

    const cost = this.calculateCost(model, promptTokens, completionTokens);

    return {
      model,
      estimatedTokens,
      estimatedCost: cost,
      dailyRemaining: Math.max(
        0,
        (parseFloat(process.env.AI_DAILY_COST_THRESHOLD) || 100) - this.dailyUsage.totalCost
      )
    };
  }
}

module.exports = new AIUsageLogger();
