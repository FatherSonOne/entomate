/**
 * Logic Node Handlers
 *
 * Conditional branching, loops, and flow control
 */

const BaseNode = require('./BaseNode');

/**
 * IF Node - Binary conditional branching
 */
class IfNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { conditions } = config;

    // Evaluate all conditions
    const result = this.evaluateConditions(conditions || [], inputData);

    console.log(`[IfNode] Conditions evaluated to: ${result}`);

    return {
      output: result ? 'true' : 'false',
      data: inputData
    };
  }

  static validate(config) {
    const errors = [];
    if (!config.conditions || config.conditions.length === 0) {
      errors.push('At least one condition is required');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Switch Node - Multi-way branching based on value
 */
class SwitchNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { field, cases } = config;

    // Get the value to switch on
    const value = this.getNestedValue(inputData, field);

    console.log(`[SwitchNode] Switching on field "${field}" with value: ${value}`);

    // Find matching case
    const matchedCase = cases?.find(c => c.value === value);

    if (matchedCase) {
      console.log(`[SwitchNode] Matched case: output ${matchedCase.output}`);
      return {
        output: String(matchedCase.output),
        data: inputData
      };
    }

    console.log('[SwitchNode] No match found, using default');
    return {
      output: 'default',
      data: inputData
    };
  }

  static validate(config) {
    const errors = [];
    if (!config.field) {
      errors.push('Field is required');
    }
    if (!config.cases || config.cases.length === 0) {
      errors.push('At least one case is required');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Merge Node - Combine multiple branches
 */
class MergeNode extends BaseNode {
  // Store for collecting inputs from multiple branches
  static pendingInputs = new Map();

  static async execute(config, inputData, context) {
    const { mode = 'wait_all', combineStrategy = 'merge' } = config;
    const { nodeId, executionId } = context;
    const mergeKey = `${executionId}:${nodeId}`;

    // Initialize pending inputs for this merge
    if (!this.pendingInputs.has(mergeKey)) {
      this.pendingInputs.set(mergeKey, {
        inputs: [],
        expectedInputs: 2 // TODO: Determine from workflow connections
      });
    }

    const pending = this.pendingInputs.get(mergeKey);

    if (mode === 'pass_through') {
      // Just pass through the first input
      console.log('[MergeNode] Pass-through mode, forwarding input');
      return {
        output: 'main',
        data: inputData
      };
    }

    // Collect input
    pending.inputs.push(inputData);
    console.log(`[MergeNode] Collected input ${pending.inputs.length}/${pending.expectedInputs}`);

    if (mode === 'wait_all' && pending.inputs.length < pending.expectedInputs) {
      // Wait for more inputs - this will be handled by the executor
      return {
        output: 'waiting',
        data: null,
        waiting: true
      };
    }

    // All inputs received, combine them
    let combinedData;

    switch (combineStrategy) {
      case 'merge':
        // Deep merge all inputs
        combinedData = pending.inputs.reduce((acc, curr) => {
          return this.deepMerge(acc, curr);
        }, {});
        break;

      case 'append':
        // Create array of all inputs
        combinedData = { items: pending.inputs };
        break;

      case 'zip':
        // Zip arrays from inputs
        const arrays = pending.inputs.map(input => {
          return Array.isArray(input) ? input : [input];
        });
        const maxLength = Math.max(...arrays.map(a => a.length));
        combinedData = {
          items: Array.from({ length: maxLength }, (_, i) => {
            return arrays.map(arr => arr[i]);
          })
        };
        break;

      default:
        combinedData = pending.inputs[0];
    }

    // Clean up
    this.pendingInputs.delete(mergeKey);

    console.log('[MergeNode] Merged all inputs');
    return {
      output: 'main',
      data: combinedData
    };
  }
}

/**
 * Split Batches Node - Process items in batches
 */
class SplitBatchesNode extends BaseNode {
  // Store for batch processing state
  static batchState = new Map();

  static async execute(config, inputData, context) {
    const { batchSize = 10, inputField = 'items' } = config;
    const { nodeId, executionId } = context;
    const stateKey = `${executionId}:${nodeId}`;

    // Get or initialize batch state
    let state = this.batchState.get(stateKey);

    if (!state) {
      // First execution - get items to process
      const items = this.getNestedValue(inputData, inputField) || inputData;
      const itemArray = Array.isArray(items) ? items : [items];

      state = {
        items: itemArray,
        currentIndex: 0,
        batchSize,
        results: []
      };
      this.batchState.set(stateKey, state);
      console.log(`[SplitBatchesNode] Starting batch processing of ${itemArray.length} items`);
    } else {
      // Subsequent execution - collect result from previous batch
      state.results.push(inputData);
    }

    // Get next batch
    const startIndex = state.currentIndex;
    const endIndex = Math.min(startIndex + state.batchSize, state.items.length);
    const batch = state.items.slice(startIndex, endIndex);

    state.currentIndex = endIndex;

    if (batch.length > 0) {
      console.log(`[SplitBatchesNode] Processing batch ${Math.ceil(endIndex / state.batchSize)} (items ${startIndex + 1}-${endIndex})`);
      return {
        output: 'loop',
        data: {
          batch,
          batchIndex: Math.floor(startIndex / state.batchSize),
          totalItems: state.items.length,
          processedItems: startIndex,
          isLastBatch: endIndex >= state.items.length
        }
      };
    }

    // All batches processed
    const finalResults = state.results;
    this.batchState.delete(stateKey);

    console.log('[SplitBatchesNode] All batches processed');
    return {
      output: 'done',
      data: {
        results: finalResults,
        totalProcessed: state.items.length
      }
    };
  }
}

/**
 * Loop Node - Iterate over items one at a time
 */
class LoopNode extends BaseNode {
  static loopState = new Map();

  static async execute(config, inputData, context) {
    const { inputField = 'items', itemVariable = 'item', indexVariable = 'index' } = config;
    const { nodeId, executionId } = context;
    const stateKey = `${executionId}:${nodeId}`;

    let state = this.loopState.get(stateKey);

    if (!state) {
      // First execution
      const items = this.getNestedValue(inputData, inputField) || inputData;
      const itemArray = Array.isArray(items) ? items : [items];

      state = {
        items: itemArray,
        currentIndex: 0,
        results: [],
        originalData: inputData
      };
      this.loopState.set(stateKey, state);
      console.log(`[LoopNode] Starting loop over ${itemArray.length} items`);
    } else {
      // Collect result from previous iteration
      state.results.push(inputData);
      state.currentIndex++;
    }

    if (state.currentIndex < state.items.length) {
      const currentItem = state.items[state.currentIndex];
      console.log(`[LoopNode] Iteration ${state.currentIndex + 1}/${state.items.length}`);

      return {
        output: 'each',
        data: {
          ...state.originalData,
          [itemVariable]: currentItem,
          [indexVariable]: state.currentIndex,
          __loopInfo: {
            index: state.currentIndex,
            total: state.items.length,
            isFirst: state.currentIndex === 0,
            isLast: state.currentIndex === state.items.length - 1
          }
        }
      };
    }

    // Loop complete
    const finalResults = state.results;
    this.loopState.delete(stateKey);

    console.log('[LoopNode] Loop complete');
    return {
      output: 'done',
      data: {
        ...state.originalData,
        loopResults: finalResults,
        itemsProcessed: state.items.length
      }
    };
  }
}

/**
 * Aggregate Node - Collect and combine results
 */
class AggregateNode extends BaseNode {
  static aggregateState = new Map();

  static async execute(config, inputData, context) {
    const { operation = 'collect', outputField = 'results' } = config;
    const { nodeId, executionId } = context;
    const stateKey = `${executionId}:${nodeId}`;

    // Get or initialize aggregate state
    let state = this.aggregateState.get(stateKey);
    if (!state) {
      state = { items: [] };
      this.aggregateState.set(stateKey, state);
    }

    // Add current input to collection
    state.items.push(inputData);

    // Check if we should finalize (this would be determined by workflow structure)
    // For now, we check for a special flag
    if (!inputData.__aggregateComplete) {
      return {
        output: 'collecting',
        data: null,
        collecting: true
      };
    }

    // Finalize aggregation
    let result;

    switch (operation) {
      case 'collect':
        result = state.items;
        break;

      case 'sum':
        result = state.items.reduce((sum, item) => {
          const value = typeof item === 'number' ? item : Number(item) || 0;
          return sum + value;
        }, 0);
        break;

      case 'count':
        result = state.items.length;
        break;

      case 'first':
        result = state.items[0];
        break;

      case 'last':
        result = state.items[state.items.length - 1];
        break;

      case 'flatten':
        result = state.items.flat();
        break;

      default:
        result = state.items;
    }

    this.aggregateState.delete(stateKey);

    console.log(`[AggregateNode] Aggregated ${state.items.length} items with operation: ${operation}`);

    return {
      output: 'main',
      data: {
        [outputField]: result
      }
    };
  }
}

/**
 * Filter Node - Filter items based on condition
 */
class FilterNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { field, operator, value } = config;

    // Check if input is an array
    if (Array.isArray(inputData)) {
      const matches = [];
      const noMatches = [];

      for (const item of inputData) {
        const condition = { field, operator, value };
        if (this.evaluateCondition(condition, item)) {
          matches.push(item);
        } else {
          noMatches.push(item);
        }
      }

      console.log(`[FilterNode] Filtered ${inputData.length} items: ${matches.length} matches, ${noMatches.length} no match`);

      // Return both outputs - executor will handle routing
      return {
        output: matches.length > 0 ? 'matches' : 'no_match',
        data: {
          matches,
          noMatches,
          items: matches // Default output
        }
      };
    }

    // Single item
    const condition = { field, operator, value };
    const matched = this.evaluateCondition(condition, inputData);

    console.log(`[FilterNode] Single item filter result: ${matched ? 'matches' : 'no_match'}`);

    return {
      output: matched ? 'matches' : 'no_match',
      data: inputData
    };
  }
}

/**
 * Wait Node - Pause execution for a duration
 */
class WaitNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { duration, unit = 'seconds' } = config;

    // Convert to milliseconds
    let ms = duration;
    switch (unit) {
      case 'seconds':
        ms = duration * 1000;
        break;
      case 'minutes':
        ms = duration * 60 * 1000;
        break;
      case 'hours':
        ms = duration * 60 * 60 * 1000;
        break;
    }

    console.log(`[WaitNode] Waiting for ${duration} ${unit} (${ms}ms)`);

    await this.wait(ms);

    console.log('[WaitNode] Wait complete');

    return {
      output: 'main',
      data: {
        ...inputData,
        waitedFor: { duration, unit, ms }
      }
    };
  }
}

/**
 * Stop and Error Node - Force workflow failure
 */
class StopErrorNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { errorMessage = 'Workflow stopped by Stop and Error node' } = config;

    // Interpolate error message
    const message = this.interpolate(errorMessage, inputData);

    console.log(`[StopErrorNode] Stopping workflow with error: ${message}`);

    throw new Error(message);
  }
}

module.exports = {
  IfNode,
  SwitchNode,
  MergeNode,
  SplitBatchesNode,
  LoopNode,
  AggregateNode,
  FilterNode,
  WaitNode,
  StopErrorNode
};
