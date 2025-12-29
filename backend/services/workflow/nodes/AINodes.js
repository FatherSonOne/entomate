/**
 * AI Node Handlers
 *
 * AI-powered nodes for agents, prompts, extraction, and classification
 */

const BaseNode = require('./BaseNode');

/**
 * AI Agent Node - Run built-in AI agents
 */
class AIAgentNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { agent, autoApply = false } = config;

    console.log(`[AIAgentNode] Running agent: ${agent}`);

    try {
      const agentOrchestrator = require('../../agentOrchestrator');

      const agentContext = {
        task: inputData.task_description || inputData.task || inputData.title,
        priority: inputData.priority,
        meetingTitle: inputData.meeting_title || inputData.meetingTitle,
        meetingDate: inputData.meeting_date || inputData.meetingDate,
        transcript: inputData.transcript,
        summary: inputData.summary,
        actionItems: inputData.action_items || inputData.actionItems,
        actionItemId: inputData.id || inputData.actionItemId
      };

      const result = await agentOrchestrator.runAgent(agent, agentContext);

      if (autoApply && result.success && agentContext.actionItemId) {
        await agentOrchestrator.applyAgentSuggestions(
          agentContext.actionItemId,
          { [agent]: result.suggestion }
        );
      }

      console.log(`[AIAgentNode] Agent ${agent} completed with confidence: ${result.suggestion?.confidence}`);

      return {
        output: 'main',
        data: {
          ...inputData,
          [`${agent}Agent`]: {
            success: result.success,
            suggestion: result.suggestion,
            applied: autoApply && result.success
          }
        }
      };

    } catch (error) {
      console.error(`[AIAgentNode] Agent ${agent} error:`, error);
      return {
        output: 'main',
        data: {
          ...inputData,
          [`${agent}Agent`]: {
            success: false,
            error: error.message
          }
        }
      };
    }
  }
}

/**
 * AI Prompt Node - Send custom prompts to LLM
 */
class AIPromptNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      prompt,
      model = 'gemini-pro',
      temperature = 0.7,
      outputField = 'aiResponse'
    } = config;

    // Interpolate prompt with input data
    const resolvedPrompt = this.interpolate(prompt, inputData);

    console.log(`[AIPromptNode] Sending prompt to ${model}`);

    try {
      const geminiService = require('../../../config/gemini');

      const response = await geminiService.chat([
        { role: 'user', content: resolvedPrompt }
      ], {
        temperature,
        maxTokens: 4096
      });

      console.log('[AIPromptNode] Got response from LLM');

      // Try to parse as JSON if it looks like JSON
      let parsedResponse = response;
      if (response.trim().startsWith('{') || response.trim().startsWith('[')) {
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          // Keep as string
        }
      }

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: parsedResponse
        }
      };

    } catch (error) {
      console.error('[AIPromptNode] Error:', error);
      throw new Error(`AI prompt failed: ${error.message}`);
    }
  }
}

/**
 * AI Extract Node - Extract structured data
 */
class AIExtractNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      inputField,
      schema,
      outputField = 'extracted'
    } = config;

    const text = this.getNestedValue(inputData, inputField);

    if (!text) {
      console.warn(`[AIExtractNode] No text found at field: ${inputField}`);
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: null
        }
      };
    }

    console.log(`[AIExtractNode] Extracting data from ${inputField}`);

    try {
      const geminiService = require('../../../config/gemini');

      const schemaDescription = JSON.stringify(schema, null, 2);
      const prompt = `Extract information from the following text according to this schema:

Schema:
${schemaDescription}

Text:
${text}

Return ONLY a valid JSON object matching the schema. No explanations or additional text.`;

      const response = await geminiService.chat([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1 // Low temperature for extraction
      });

      // Parse the response
      let extracted;
      try {
        // Remove markdown code blocks if present
        const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extracted = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('[AIExtractNode] Failed to parse extraction:', parseError);
        extracted = { raw: response, parseError: true };
      }

      console.log('[AIExtractNode] Extraction complete');

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: extracted
        }
      };

    } catch (error) {
      console.error('[AIExtractNode] Error:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }
}

/**
 * AI Classify Node - Classify content into categories
 */
class AIClassifyNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      inputField,
      categories,
      outputField = 'category'
    } = config;

    const text = this.getNestedValue(inputData, inputField);

    if (!text) {
      console.warn(`[AIClassifyNode] No text found at field: ${inputField}`);
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: { category: 'unknown', confidence: 0 }
        }
      };
    }

    console.log(`[AIClassifyNode] Classifying text into ${categories.length} categories`);

    try {
      const geminiService = require('../../../config/gemini');

      const categoryList = categories.map((c, i) => `${i + 1}. ${c}`).join('\n');

      const prompt = `Classify the following text into one of these categories:

${categoryList}

Text:
${text}

Return ONLY a JSON object with this format:
{
  "category": "the matching category name exactly as listed",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

      const response = await geminiService.chat([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1
      });

      let classification;
      try {
        const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        classification = JSON.parse(cleanResponse);
      } catch {
        // Try to extract category from response
        const matchedCategory = categories.find(c =>
          response.toLowerCase().includes(c.toLowerCase())
        );
        classification = {
          category: matchedCategory || 'unknown',
          confidence: matchedCategory ? 0.5 : 0,
          reasoning: 'Parsed from raw response'
        };
      }

      console.log(`[AIClassifyNode] Classified as: ${classification.category} (${classification.confidence})`);

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: classification
        }
      };

    } catch (error) {
      console.error('[AIClassifyNode] Error:', error);
      throw new Error(`AI classification failed: ${error.message}`);
    }
  }
}

/**
 * Detect Follow-ups Node - Find follow-up opportunities
 */
class DetectFollowupsNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      inputField = 'transcript',
      autoCreate = false
    } = config;

    const text = this.getNestedValue(inputData, inputField) || inputData.transcript;

    if (!text) {
      console.warn('[DetectFollowupsNode] No text to analyze');
      return {
        output: 'main',
        data: {
          ...inputData,
          followups: []
        }
      };
    }

    console.log('[DetectFollowupsNode] Detecting follow-ups');

    try {
      const agentOrchestrator = require('../../agentOrchestrator');

      const agentContext = {
        transcript: text,
        summary: inputData.summary,
        actionItems: inputData.action_items || inputData.actionItems,
        meetingTitle: inputData.title || inputData.meeting_title,
        meetingDate: inputData.created_at || inputData.meeting_date
      };

      const result = await agentOrchestrator.runAgent('followup', agentContext);

      if (!result.success) {
        return {
          output: 'main',
          data: {
            ...inputData,
            followups: [],
            followupError: result.error
          }
        };
      }

      const followups = result.suggestion?.followups || [];

      // Auto-create follow-up tasks if configured
      if (autoCreate && followups.length > 0) {
        const { supabase } = require('../../../config/supabase');

        for (const followup of followups.filter(f => f.confidence >= 0.7)) {
          await supabase
            .from('action_items')
            .insert({
              meeting_id: inputData.meeting_id || inputData.id,
              task_description: followup.suggestedTask,
              due_date: followup.suggestedDate,
              priority: followup.priority || 'medium',
              status: 'pending',
              source: 'followup_agent'
            });
        }
      }

      console.log(`[DetectFollowupsNode] Found ${followups.length} follow-ups`);

      return {
        output: 'main',
        data: {
          ...inputData,
          followups,
          followupsCreated: autoCreate ? followups.filter(f => f.confidence >= 0.7).length : 0
        }
      };

    } catch (error) {
      console.error('[DetectFollowupsNode] Error:', error);
      return {
        output: 'main',
        data: {
          ...inputData,
          followups: [],
          followupError: error.message
        }
      };
    }
  }
}

module.exports = {
  AIAgentNode,
  AIPromptNode,
  AIExtractNode,
  AIClassifyNode,
  DetectFollowupsNode
};
