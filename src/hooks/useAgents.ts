/**
 * useAgents Hook
 * React hook for managing agents in the UI
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAllAgents,
  getAgentById,
  createAgentFromTemplate,
  enableAgent,
  disableAgent,
  deleteAgent,
  getAgentRuns
} from '../agents/agentService';
import { manualTriggerAgent } from '../agents/agentTriggerService';
import { AGENT_TEMPLATES } from '../agents/templates';
import type { Agent, AgentRun, AgentRunResult } from '../agents/types';

export interface UseAgentsReturn {
  // State
  agents: Agent[];
  selectedAgent: Agent | null;
  runs: AgentRun[];
  loading: boolean;
  error: string | null;

  // Actions
  loadAgents: () => Promise<void>;
  selectAgent: (agentId: string | null) => Promise<void>;
  loadRuns: (agentId: string) => Promise<void>;
  createFromTemplate: (templateId: string) => Promise<Agent | null>;
  toggleAgent: (agentId: string, enabled: boolean) => Promise<boolean>;
  removeAgent: (agentId: string) => Promise<boolean>;
  testAgent: (agentId: string, testPayload: Record<string, any>) => Promise<AgentRunResult | null>;

  // Template helpers
  templates: typeof AGENT_TEMPLATES;
}

export function useAgents(): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all agents
  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllAgents();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  // Select an agent and load its details
  const selectAgent = useCallback(async (agentId: string | null) => {
    if (!agentId) {
      setSelectedAgent(null);
      setRuns([]);
      return;
    }

    setLoading(true);
    try {
      const agent = await getAgentById(agentId);
      setSelectedAgent(agent);
      if (agent) {
        const agentRuns = await getAgentRuns(agentId, { limit: 20 });
        setRuns(agentRuns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load runs for an agent
  const loadRuns = useCallback(async (agentId: string) => {
    try {
      const agentRuns = await getAgentRuns(agentId, { limit: 20 });
      setRuns(agentRuns);
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  }, []);

  // Create agent from template
  const createFromTemplate = useCallback(async (templateId: string): Promise<Agent | null> => {
    setLoading(true);
    setError(null);
    try {
      const agent = await createAgentFromTemplate(templateId);
      if (agent) {
        await loadAgents();
      }
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadAgents]);

  // Toggle agent enabled/disabled
  const toggleAgent = useCallback(async (agentId: string, enabled: boolean): Promise<boolean> => {
    try {
      const result = enabled
        ? await enableAgent(agentId)
        : await disableAgent(agentId);

      if (result) {
        await loadAgents();
        if (selectedAgent?.id === agentId) {
          await selectAgent(agentId);
        }
      }
      return !!result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle agent');
      return false;
    }
  }, [loadAgents, selectAgent, selectedAgent]);

  // Remove an agent
  const removeAgent = useCallback(async (agentId: string): Promise<boolean> => {
    try {
      await deleteAgent(agentId);
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
        setRuns([]);
      }
      await loadAgents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      return false;
    }
  }, [loadAgents, selectedAgent]);

  // Test run an agent
  const testAgent = useCallback(async (
    agentId: string,
    testPayload: Record<string, any>
  ): Promise<AgentRunResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await manualTriggerAgent(agentId, testPayload, { dryRun: true });
      // Refresh runs after test
      await loadRuns(agentId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test agent');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadRuns]);

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return {
    agents,
    selectedAgent,
    runs,
    loading,
    error,
    loadAgents,
    selectAgent,
    loadRuns,
    createFromTemplate,
    toggleAgent,
    removeAgent,
    testAgent,
    templates: AGENT_TEMPLATES
  };
}

export default useAgents;
