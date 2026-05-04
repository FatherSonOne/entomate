/**
 * Ecosystem Bridge Service — Entomate
 *
 * Handles outbound events to Logos Vision and Pulse,
 * manages ecosystem configuration, and provides
 * connection status. Mirrors the LV bridge pattern.
 */

import { supabase } from '../lib/supabase';

export interface EcosystemApp {
  appName: string;
  displayName: string;
  apiUrl: string | null;
  enabled: boolean;
  features: Record<string, boolean>;
  lastHeartbeat: string | null;
}

export interface OutboundEvent {
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

class EcosystemBridge {
  private config: Map<string, EcosystemApp> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('ecosystem_config')
        .select('*');

      if (error) {
        console.warn('[EcosystemBridge:Entomate] Failed to load config:', error.message);
        return;
      }

      for (const row of data || []) {
        this.config.set(row.app_name, {
          appName: row.app_name,
          displayName: row.display_name || row.app_name,
          apiUrl: row.api_url,
          enabled: row.enabled,
          features: row.features || {},
          lastHeartbeat: row.last_heartbeat,
        });
      }
      this.initialized = true;
    } catch (err) {
      console.warn('[EcosystemBridge:Entomate] Init error:', err);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isConnected(appName: string): boolean {
    const app = this.config.get(appName);
    return !!(app?.enabled && app?.apiUrl);
  }

  getApp(appName: string): EcosystemApp | null {
    return this.config.get(appName) || null;
  }

  /**
   * Send an event to a target app's ecosystem-inbound endpoint.
   * Returns the parsed JSON response on success, or null on failure.
   */
  async sendEvent(
    targetApp: string,
    event: OutboundEvent
  ): Promise<Record<string, unknown> | null> {
    if (!this.initialized) await this.initialize();

    const app = this.config.get(targetApp);
    if (!app?.enabled || !app?.apiUrl) {
      console.warn(`[EcosystemBridge:Entomate] App not configured or disabled: ${targetApp}`);
      return null;
    }

    const correlationId = event.correlationId || crypto.randomUUID();

    try {
      // Get the service token + gateway key for this app
      const { data: configRow } = await supabase
        .from('ecosystem_config')
        .select('service_token, features')
        .eq('app_name', targetApp)
        .single();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Ecosystem-Token': configRow?.service_token || '',
        'X-Ecosystem-Source': 'entomate',
        'X-Ecosystem-Event-Id': correlationId,
      };

      // Supabase edge functions require an anon/publishable key for the API gateway
      const gatewayKey = (configRow?.features as Record<string, unknown> | undefined)?.gateway_key as string | undefined;
      if (gatewayKey) {
        headers['Authorization'] = `Bearer ${gatewayKey}`;
        headers['apikey'] = gatewayKey;
      }

      const response = await fetch(app.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          eventType: event.eventType,
          source: 'entomate',
          timestamp: new Date().toISOString(),
          correlationId,
          data: event.payload,
        }),
      });

      const responseData = await response.json().catch(() => ({}));
      const status = response.ok ? 'delivered' : 'failed';

      // Log the outbound event
      await supabase.from('ecosystem_events').insert({
        event_id: correlationId,
        source: 'entomate',
        target_app: targetApp,
        event_type: event.eventType,
        direction: 'outbound',
        status,
        payload: event.payload,
        response_data: responseData,
      }).then(({ error }) => {
        if (error) console.warn('[EcosystemBridge:Entomate] Event log insert failed:', error.message);
      });

      if (!response.ok) {
        console.warn(`[EcosystemBridge:Entomate] ${targetApp} returned ${response.status}:`, responseData);
        return null;
      }

      return responseData as Record<string, unknown>;
    } catch (err) {
      console.error(`[EcosystemBridge:Entomate] Failed to send to ${targetApp}:`, err);

      // Log failed event
      await supabase.from('ecosystem_events').insert({
        event_id: correlationId,
        source: 'entomate',
        target_app: targetApp,
        event_type: event.eventType,
        direction: 'outbound',
        status: 'failed',
        payload: event.payload,
        response_data: { error: err instanceof Error ? err.message : 'Unknown error' },
      }).then(({ error: logErr }) => {
        if (logErr) console.warn('[EcosystemBridge:Entomate] Failed to log error event:', logErr.message);
      });

      return null;
    }
  }

  /**
   * Request enriched contact context from Logos Vision.
   * Returns the structured context.response or null if unavailable.
   */
  async requestContext(
    participants: { name: string; email?: string }[],
    meetingTitle: string,
    contextDepth: 'minimal' | 'standard' | 'deep' = 'standard'
  ): Promise<Record<string, unknown> | null> {
    return this.sendEvent('logos_vision', {
      eventType: 'context.request',
      payload: { participants, contextDepth, meetingTitle },
    });
  }

  /**
   * Send a processed meeting with optional intelligence profile to Logos Vision.
   */
  async sendMeetingProcessed(payload: {
    meeting: Record<string, unknown>;
    actionItems: Record<string, unknown>[];
    teamMemberId?: string;
    intelligenceProfile?: {
      name: string;
      icon?: string;
      slug?: string;
      category?: string;
      sections?: { heading: string; content: string }[];
      outputQualityScore?: number;
      contextSources?: { type: string; count: number }[];
    };
  }): Promise<Record<string, unknown> | null> {
    return this.sendEvent('logos_vision', {
      eventType: 'meeting.processed',
      payload,
    });
  }

  /**
   * Send a pre-meeting briefing to Logos Vision (MIP Phase 3).
   */
  async sendMeetingBriefing(payload: {
    meetingId: string;
    meetingTitle?: string;
    participants?: { name: string; email?: string }[];
    briefingData?: {
      suggestedProfile?: string;
      contextSummary?: string;
    };
    scheduledTime?: string;
  }): Promise<Record<string, unknown> | null> {
    return this.sendEvent('logos_vision', {
      eventType: 'meeting.briefing',
      payload,
    });
  }
}

export const ecosystemBridge = new EcosystemBridge();
export default ecosystemBridge;
