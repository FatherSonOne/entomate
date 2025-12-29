/**
 * Base Agent Class
 * All AI agents inherit from this class
 * Week 7: Automations & Basic Agents
 */

class BaseAgent {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Analyze context and gather information
   * @param {Object} context - The context to analyze
   * @param {Object} automation - The automation configuration
   * @returns {Object} Analysis results
   */
  async analyze(context, automation) {
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * Generate suggestion based on analysis
   * @param {Object} context - The context
   * @param {Object} automation - The automation configuration
   * @returns {Object} Suggestion with confidence score
   */
  async suggest(context, automation) {
    throw new Error('suggest() must be implemented by subclass');
  }

  /**
   * Execute the suggestion
   * @param {Object} suggestion - The suggestion to execute
   * @param {Object} context - The context
   * @returns {Object} Execution result
   */
  async execute(suggestion, context) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return [];
  }

  /**
   * Log agent activity
   */
  log(message, data = {}) {
    console.log(`🤖 [${this.name}] ${message}`, data);
  }
}

module.exports = BaseAgent;
