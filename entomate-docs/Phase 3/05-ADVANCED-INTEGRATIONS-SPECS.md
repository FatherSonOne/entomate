# Advanced Integrations Specification

**Phase 3 - Week 7**
**Priority:** High (ecosystem expansion)

---

## Overview

Advanced Integrations expands Entomate's ecosystem connectivity beyond Logos Vision and Pulse. This includes additional CRMs, video platforms, calendar systems, and a webhook system for custom integrations.

### Business Value
- Support customers with different tech stacks
- Enable custom automation workflows
- Increase platform stickiness
- Open up new market segments

---

## Integration Priorities

| Category | Integration | Priority | Notes |
|----------|-------------|----------|-------|
| **CRM** | Salesforce | P0 | Enterprise standard |
| **CRM** | HubSpot | P1 | Mid-market popular |
| **Video** | Zoom | P0 | Most common |
| **Video** | Microsoft Teams | P1 | Enterprise common |
| **Video** | Google Meet | P2 | Google Workspace |
| **Calendar** | Google Calendar | P0 | Scheduling |
| **Calendar** | Outlook Calendar | P1 | Enterprise |
| **Custom** | Webhooks | P0 | Custom integrations |

---

## Integration Framework

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Integration Framework                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Integration  │  │ OAuth        │  │ Sync Engine      │  │
│  │ Registry     │  │ Manager      │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────▼─────────────────▼────────────────────▼─────────┐ │
│  │                   Integration Base Class               │ │
│  │                                                        │ │
│  │  - authenticate()  - sync()  - fetch()  - push()      │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                 │                    │            │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌────────▼─────────┐ │
│  │ Salesforce   │  │ HubSpot      │  │ Zoom             │ │
│  │ Connector    │  │ Connector    │  │ Connector        │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Integration configurations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  integration_type TEXT NOT NULL,  -- salesforce, hubspot, zoom, etc.
  display_name TEXT NOT NULL,

  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Integration-specific config
  config JSONB NOT NULL DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, integration_type)
);

-- Sync logs for tracking
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,  -- full, incremental, webhook
  direction TEXT NOT NULL,  -- inbound, outbound
  records_processed INT NOT NULL DEFAULT 0,
  records_succeeded INT NOT NULL DEFAULT 0,
  records_failed INT NOT NULL DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'  -- running, success, failed
);

-- Field mappings (how external fields map to Entomate)
CREATE TABLE integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- deal, contact, meeting
  external_field TEXT NOT NULL,
  internal_field TEXT NOT NULL,
  transform TEXT,  -- optional transformation function
  direction TEXT NOT NULL DEFAULT 'bidirectional',  -- inbound, outbound, bidirectional
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integrations_tenant ON integrations (tenant_id);
CREATE INDEX idx_integration_sync_logs ON integration_sync_logs (integration_id, started_at DESC);
```

### Base Integration Class

```typescript
// src/integrations/base.ts

export abstract class BaseIntegration {
  protected integration: Integration;
  protected tenantId: string;

  constructor(integration: Integration, tenantId: string) {
    this.integration = integration;
    this.tenantId = tenantId;
  }

  // OAuth methods
  abstract getAuthUrl(): string;
  abstract handleCallback(code: string): Promise<OAuthTokens>;
  abstract refreshToken(): Promise<OAuthTokens>;

  // Core sync methods
  abstract syncContacts(options?: SyncOptions): Promise<SyncResult>;
  abstract syncDeals(options?: SyncOptions): Promise<SyncResult>;
  abstract syncMeetings(options?: SyncOptions): Promise<SyncResult>;

  // Helper methods
  protected async saveTokens(tokens: OAuthTokens): Promise<void> {
    await supabase
      .from('integrations')
      .update({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.integration.id);
  }

  protected async ensureValidToken(): Promise<string> {
    if (this.isTokenExpired()) {
      const tokens = await this.refreshToken();
      await this.saveTokens(tokens);
      return tokens.accessToken;
    }
    return this.integration.accessToken!;
  }

  protected isTokenExpired(): boolean {
    if (!this.integration.tokenExpiresAt) return true;
    return new Date(this.integration.tokenExpiresAt) < new Date();
  }

  protected async logSync(params: SyncLogParams): Promise<void> {
    await supabase.from('integration_sync_logs').insert({
      integration_id: this.integration.id,
      ...params
    });
  }
}

interface SyncOptions {
  fullSync?: boolean;
  since?: Date;
  limit?: number;
}

interface SyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}
```

---

## Salesforce Integration

### Configuration

```typescript
// src/integrations/crm/salesforce.ts

import { BaseIntegration, SyncOptions, SyncResult } from '../base';
import jsforce from 'jsforce';

export class SalesforceIntegration extends BaseIntegration {
  private connection: jsforce.Connection | null = null;

  getAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      redirect_uri: `${process.env.APP_URL}/integrations/salesforce/callback`,
      scope: 'api refresh_token offline_access'
    });
    return `https://login.salesforce.com/services/oauth2/authorize?${params}`;
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const conn = new jsforce.Connection({
      oauth2: {
        clientId: process.env.SALESFORCE_CLIENT_ID!,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
        redirectUri: `${process.env.APP_URL}/integrations/salesforce/callback`
      }
    });

    const userInfo = await conn.authorize(code);

    return {
      accessToken: conn.accessToken!,
      refreshToken: conn.refreshToken!,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    };
  }

  async refreshToken(): Promise<OAuthTokens> {
    const conn = this.getConnection();
    await conn.oauth2.refreshToken(this.integration.refreshToken!);

    return {
      accessToken: conn.accessToken!,
      refreshToken: conn.refreshToken || this.integration.refreshToken!,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    };
  }

  private getConnection(): jsforce.Connection {
    if (!this.connection) {
      this.connection = new jsforce.Connection({
        oauth2: {
          clientId: process.env.SALESFORCE_CLIENT_ID!,
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
          redirectUri: `${process.env.APP_URL}/integrations/salesforce/callback`
        },
        accessToken: this.integration.accessToken,
        refreshToken: this.integration.refreshToken,
        instanceUrl: this.integration.config.instanceUrl
      });
    }
    return this.connection;
  }

  async syncDeals(options: SyncOptions = {}): Promise<SyncResult> {
    await this.ensureValidToken();
    const conn = this.getConnection();

    const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    try {
      // Query Salesforce Opportunities
      const query = options.since
        ? `SELECT Id, Name, Amount, StageName, CloseDate, AccountId, OwnerId, LastModifiedDate
           FROM Opportunity
           WHERE LastModifiedDate > ${options.since.toISOString()}
           ORDER BY LastModifiedDate DESC`
        : `SELECT Id, Name, Amount, StageName, CloseDate, AccountId, OwnerId, LastModifiedDate
           FROM Opportunity
           ORDER BY LastModifiedDate DESC
           LIMIT ${options.limit || 1000}`;

      const opportunities = await conn.query(query);

      for (const opp of opportunities.records as any[]) {
        result.processed++;

        try {
          // Map to Entomate deal
          const deal = this.mapOpportunityToDeal(opp);
          await this.upsertDeal(deal);
          result.succeeded++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({ id: opp.Id, error: error.message });
        }
      }

      await this.logSync({
        syncType: options.fullSync ? 'full' : 'incremental',
        direction: 'inbound',
        recordsProcessed: result.processed,
        recordsSucceeded: result.succeeded,
        recordsFailed: result.failed,
        status: 'success'
      });

    } catch (error: any) {
      await this.logSync({
        syncType: 'incremental',
        direction: 'inbound',
        recordsProcessed: result.processed,
        recordsSucceeded: result.succeeded,
        recordsFailed: result.failed,
        errorDetails: { message: error.message },
        status: 'failed'
      });
      throw error;
    }

    return result;
  }

  async syncContacts(options: SyncOptions = {}): Promise<SyncResult> {
    await this.ensureValidToken();
    const conn = this.getConnection();

    const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    const query = options.since
      ? `SELECT Id, FirstName, LastName, Email, Phone, AccountId, Title, LastModifiedDate
         FROM Contact
         WHERE LastModifiedDate > ${options.since.toISOString()}`
      : `SELECT Id, FirstName, LastName, Email, Phone, AccountId, Title, LastModifiedDate
         FROM Contact
         LIMIT ${options.limit || 1000}`;

    const contacts = await conn.query(query);

    for (const contact of contacts.records as any[]) {
      result.processed++;

      try {
        const mapped = this.mapContactToEntomate(contact);
        await this.upsertContact(mapped);
        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: contact.Id, error: error.message });
      }
    }

    return result;
  }

  async syncMeetings(options: SyncOptions = {}): Promise<SyncResult> {
    // Salesforce Events → Entomate Meetings
    await this.ensureValidToken();
    const conn = this.getConnection();

    const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    const query = `SELECT Id, Subject, Description, StartDateTime, EndDateTime, WhoId, WhatId, OwnerId
                   FROM Event
                   WHERE StartDateTime >= TODAY
                   ORDER BY StartDateTime
                   LIMIT ${options.limit || 500}`;

    const events = await conn.query(query);

    for (const event of events.records as any[]) {
      result.processed++;

      try {
        const meeting = this.mapEventToMeeting(event);
        await this.upsertMeeting(meeting);
        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: event.Id, error: error.message });
      }
    }

    return result;
  }

  // Push Entomate data to Salesforce
  async pushDealUpdate(dealId: string, updates: Partial<Deal>): Promise<void> {
    await this.ensureValidToken();
    const conn = this.getConnection();

    const sfUpdates = this.mapDealToOpportunity(updates);
    await conn.sobject('Opportunity').update({
      Id: dealId,
      ...sfUpdates
    });
  }

  private mapOpportunityToDeal(opp: any): Partial<Deal> {
    return {
      externalId: opp.Id,
      externalSource: 'salesforce',
      name: opp.Name,
      value: opp.Amount,
      stage: this.mapSalesforceStage(opp.StageName),
      closeDate: opp.CloseDate,
      ownerId: opp.OwnerId,
      customerId: opp.AccountId
    };
  }

  private mapSalesforceStage(sfStage: string): string {
    const stageMap: Record<string, string> = {
      'Prospecting': 'lead',
      'Qualification': 'qualified',
      'Needs Analysis': 'discovery',
      'Value Proposition': 'proposal',
      'Negotiation/Review': 'negotiation',
      'Closed Won': 'won',
      'Closed Lost': 'lost'
    };
    return stageMap[sfStage] || 'unknown';
  }
}
```

---

## HubSpot Integration

```typescript
// src/integrations/crm/hubspot.ts

import { Client } from '@hubspot/api-client';
import { BaseIntegration, SyncOptions, SyncResult } from '../base';

export class HubSpotIntegration extends BaseIntegration {
  private client: Client | null = null;

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      redirect_uri: `${process.env.APP_URL}/integrations/hubspot/callback`,
      scope: 'crm.objects.deals.read crm.objects.contacts.read crm.objects.deals.write'
    });
    return `https://app.hubspot.com/oauth/authorize?${params}`;
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const client = new Client();
    const tokens = await client.oauth.tokensApi.create(
      'authorization_code',
      code,
      `${process.env.APP_URL}/integrations/hubspot/callback`,
      process.env.HUBSPOT_CLIENT_ID!,
      process.env.HUBSPOT_CLIENT_SECRET!
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000)
    };
  }

  async refreshToken(): Promise<OAuthTokens> {
    const client = new Client();
    const tokens = await client.oauth.tokensApi.create(
      'refresh_token',
      undefined,
      undefined,
      process.env.HUBSPOT_CLIENT_ID!,
      process.env.HUBSPOT_CLIENT_SECRET!,
      this.integration.refreshToken!
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000)
    };
  }

  private getClient(): Client {
    if (!this.client) {
      this.client = new Client({ accessToken: this.integration.accessToken! });
    }
    return this.client;
  }

  async syncDeals(options: SyncOptions = {}): Promise<SyncResult> {
    await this.ensureValidToken();
    const client = this.getClient();

    const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    const properties = ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id'];
    const limit = options.limit || 100;
    let after: string | undefined;

    do {
      const response = await client.crm.deals.basicApi.getPage(
        limit,
        after,
        properties
      );

      for (const deal of response.results) {
        result.processed++;

        try {
          const mapped = this.mapHubSpotDeal(deal);
          await this.upsertDeal(mapped);
          result.succeeded++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({ id: deal.id, error: error.message });
        }
      }

      after = response.paging?.next?.after;
    } while (after && result.processed < (options.limit || 10000));

    return result;
  }

  async syncContacts(options: SyncOptions = {}): Promise<SyncResult> {
    await this.ensureValidToken();
    const client = this.getClient();

    const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    const properties = ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle'];

    const response = await client.crm.contacts.basicApi.getPage(
      options.limit || 100,
      undefined,
      properties
    );

    for (const contact of response.results) {
      result.processed++;

      try {
        const mapped = {
          externalId: contact.id,
          externalSource: 'hubspot',
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          email: contact.properties.email,
          phone: contact.properties.phone,
          company: contact.properties.company,
          title: contact.properties.jobtitle
        };
        await this.upsertContact(mapped);
        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: contact.id, error: error.message });
      }
    }

    return result;
  }

  private mapHubSpotDeal(deal: any): Partial<Deal> {
    return {
      externalId: deal.id,
      externalSource: 'hubspot',
      name: deal.properties.dealname,
      value: parseFloat(deal.properties.amount) || 0,
      stage: deal.properties.dealstage,
      closeDate: deal.properties.closedate,
      ownerId: deal.properties.hubspot_owner_id
    };
  }
}
```

---

## Zoom Integration

```typescript
// src/integrations/video/zoom.ts

import { BaseIntegration, SyncResult } from '../base';
import axios from 'axios';

export class ZoomIntegration extends BaseIntegration {
  private baseUrl = 'https://api.zoom.us/v2';

  getAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.ZOOM_CLIENT_ID!,
      redirect_uri: `${process.env.APP_URL}/integrations/zoom/callback`
    });
    return `https://zoom.us/oauth/authorize?${params}`;
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${process.env.APP_URL}/integrations/zoom/callback`
        },
        auth: {
          username: process.env.ZOOM_CLIENT_ID!,
          password: process.env.ZOOM_CLIENT_SECRET!
        }
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000)
    };
  }

  async refreshToken(): Promise<OAuthTokens> {
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      null,
      {
        params: {
          grant_type: 'refresh_token',
          refresh_token: this.integration.refreshToken
        },
        auth: {
          username: process.env.ZOOM_CLIENT_ID!,
          password: process.env.ZOOM_CLIENT_SECRET!
        }
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000)
    };
  }

  // Get upcoming meetings
  async getUpcomingMeetings(): Promise<ZoomMeeting[]> {
    const token = await this.ensureValidToken();

    const response = await axios.get(`${this.baseUrl}/users/me/meetings`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { type: 'upcoming', page_size: 100 }
    });

    return response.data.meetings;
  }

  // Get past meetings with recordings
  async getPastMeetingsWithRecordings(fromDate: Date): Promise<ZoomMeeting[]> {
    const token = await this.ensureValidToken();

    const response = await axios.get(`${this.baseUrl}/users/me/recordings`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        from: fromDate.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        page_size: 100
      }
    });

    return response.data.meetings || [];
  }

  // Download recording transcript
  async getRecordingTranscript(meetingId: string): Promise<string | null> {
    const token = await this.ensureValidToken();

    try {
      // Get recording files
      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}/recordings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Find VTT transcript file
      const vttFile = response.data.recording_files?.find(
        (f: any) => f.file_type === 'TRANSCRIPT'
      );

      if (!vttFile) return null;

      // Download transcript
      const transcriptResponse = await axios.get(vttFile.download_url, {
        headers: { Authorization: `Bearer ${token}` },
        params: { access_token: token }
      });

      return this.parseVTT(transcriptResponse.data);
    } catch (error) {
      console.error('Failed to get transcript:', error);
      return null;
    }
  }

  // Sync Zoom recordings to Entomate meetings
  async syncMeetings(options: { since?: Date } = {}): Promise<SyncResult> {
    const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    const fromDate = options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recordings = await this.getPastMeetingsWithRecordings(fromDate);

    for (const recording of recordings) {
      result.processed++;

      try {
        // Check if meeting already exists
        const existing = await this.findMeetingByExternalId(recording.id);
        if (existing) continue;

        // Get transcript
        const transcript = await this.getRecordingTranscript(recording.id);

        // Create meeting in Entomate
        await this.createMeeting({
          externalId: recording.id,
          externalSource: 'zoom',
          title: recording.topic,
          startTime: new Date(recording.start_time),
          duration: recording.duration,
          transcript,
          recordingUrl: recording.share_url
        });

        result.succeeded++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id: recording.id, error: error.message });
      }
    }

    return result;
  }

  private parseVTT(vttContent: string): string {
    // Parse VTT and extract plain text
    const lines = vttContent.split('\n');
    const textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip timecode lines and empty lines
      if (line && !line.includes('-->') && !line.startsWith('WEBVTT') && !/^\d+$/.test(line)) {
        textLines.push(line);
      }
    }

    return textLines.join(' ');
  }
}

interface ZoomMeeting {
  id: string;
  topic: string;
  start_time: string;
  duration: number;
  share_url?: string;
  recording_files?: any[];
}
```

---

## Google Calendar Integration

```typescript
// src/integrations/calendar/google.ts

import { google } from 'googleapis';
import { BaseIntegration } from '../base';

export class GoogleCalendarIntegration extends BaseIntegration {
  private oauth2Client: any;

  constructor(integration: Integration, tenantId: string) {
    super(integration, tenantId);
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/integrations/google/callback`
    );
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      prompt: 'consent'
    });
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!)
    };
  }

  async refreshToken(): Promise<OAuthTokens> {
    this.oauth2Client.setCredentials({
      refresh_token: this.integration.refreshToken
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || this.integration.refreshToken!,
      expiresAt: new Date(credentials.expiry_date!)
    };
  }

  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    await this.ensureValidToken();
    this.oauth2Client.setCredentials({
      access_token: this.integration.accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return (response.data.items || []).map(event => ({
      id: event.id!,
      title: event.summary || 'Untitled',
      description: event.description || '',
      startTime: new Date(event.start?.dateTime || event.start?.date!),
      endTime: new Date(event.end?.dateTime || event.end?.date!),
      attendees: event.attendees?.map(a => a.email!) || [],
      meetingLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      location: event.location
    }));
  }

  async createEvent(event: CreateEventParams): Promise<string> {
    await this.ensureValidToken();
    this.oauth2Client.setCredentials({
      access_token: this.integration.accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.startTime.toISOString() },
        end: { dateTime: event.endTime.toISOString() },
        attendees: event.attendees?.map(email => ({ email })),
        conferenceData: event.createMeetingLink ? {
          createRequest: { requestId: `entomate-${Date.now()}` }
        } : undefined
      },
      conferenceDataVersion: event.createMeetingLink ? 1 : undefined
    });

    return response.data.id!;
  }
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetingLink?: string;
  location?: string;
}

interface CreateEventParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  createMeetingLink?: boolean;
}
```

---

## Webhook System

### Database Schema

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- For signature verification
  events TEXT[] NOT NULL,  -- ['meeting.completed', 'task.created', ...]

  -- Filters
  filters JSONB,  -- Optional filters like { dealId: 'x' }

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,

  -- Headers
  custom_headers JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Response
  response_status INT,
  response_body TEXT,
  response_headers JSONB,

  -- Timing
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, success, failed, retrying
  attempt_count INT NOT NULL DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_webhooks_tenant ON webhooks (tenant_id);
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries (webhook_id, triggered_at DESC);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries (status) WHERE status != 'success';
```

### Webhook Service

```typescript
// src/integrations/webhooks/service.ts

import crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../../lib/supabase';

export class WebhookService {
  // Available webhook events
  static readonly EVENTS = [
    'meeting.created',
    'meeting.completed',
    'meeting.transcribed',
    'task.created',
    'task.updated',
    'task.completed',
    'deal.created',
    'deal.updated',
    'deal.stage_changed',
    'agent.run.started',
    'agent.run.completed',
    'agent.run.failed',
    'customer.health.changed',
    'alert.created'
  ] as const;

  // Trigger webhooks for an event
  async trigger(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    // Find matching webhooks
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (!webhooks || webhooks.length === 0) return;

    // Queue deliveries for each webhook
    for (const webhook of webhooks) {
      // Check filters
      if (!this.matchesFilters(webhook.filters, payload)) continue;

      await this.queueDelivery(webhook, eventType, payload);
    }
  }

  private async queueDelivery(
    webhook: Webhook,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    // Create delivery record
    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload,
        status: 'pending'
      })
      .select()
      .single();

    // Attempt delivery
    await this.deliver(delivery!.id);
  }

  async deliver(deliveryId: string): Promise<boolean> {
    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .select('*, webhooks(*)')
      .eq('id', deliveryId)
      .single();

    if (!delivery) throw new Error('Delivery not found');

    const webhook = delivery.webhooks as Webhook;
    const startTime = Date.now();

    try {
      // Build payload with metadata
      const fullPayload = {
        event: delivery.event_type,
        timestamp: new Date().toISOString(),
        delivery_id: deliveryId,
        data: delivery.payload
      };

      // Generate signature
      const signature = this.generateSignature(
        JSON.stringify(fullPayload),
        webhook.secret
      );

      // Send request
      const response = await axios.post(webhook.url, fullPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.event_type,
          'X-Webhook-Delivery-Id': deliveryId,
          ...webhook.custom_headers
        },
        timeout: 30000,
        validateStatus: () => true  // Don't throw on non-2xx
      });

      const duration = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      // Update delivery record
      await supabase
        .from('webhook_deliveries')
        .update({
          response_status: response.status,
          response_body: JSON.stringify(response.data).substring(0, 10000),
          response_headers: response.headers,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          status: success ? 'success' : 'failed',
          error_message: success ? null : `HTTP ${response.status}`
        })
        .eq('id', deliveryId);

      // Update webhook status
      if (success) {
        await supabase
          .from('webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            consecutive_failures: 0
          })
          .eq('id', webhook.id);
      } else {
        await this.handleFailure(webhook.id, delivery);
      }

      return success;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      await supabase
        .from('webhook_deliveries')
        .update({
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          status: 'failed',
          error_message: error.message
        })
        .eq('id', deliveryId);

      await this.handleFailure(webhook.id, delivery);
      return false;
    }
  }

  private async handleFailure(webhookId: string, delivery: any): Promise<void> {
    // Increment failure count
    await supabase.rpc('increment_webhook_failures', { webhook_id: webhookId });

    // Schedule retry (exponential backoff)
    const attempts = delivery.attempt_count;
    if (attempts < 5) {
      const delayMinutes = Math.pow(2, attempts); // 2, 4, 8, 16, 32 minutes
      const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);

      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'retrying',
          attempt_count: attempts + 1,
          next_retry_at: nextRetry.toISOString()
        })
        .eq('id', delivery.id);
    }

    // Disable webhook after too many consecutive failures
    const { data: webhook } = await supabase
      .from('webhooks')
      .select('consecutive_failures')
      .eq('id', webhookId)
      .single();

    if (webhook && webhook.consecutive_failures >= 10) {
      await supabase
        .from('webhooks')
        .update({ is_active: false })
        .eq('id', webhookId);

      // Notify admin
      await this.notifyWebhookDisabled(webhookId);
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
  }

  private matchesFilters(
    filters: Record<string, any> | null,
    payload: Record<string, any>
  ): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (payload[key] !== value) return false;
    }

    return true;
  }

  // Retry failed deliveries (run as cron job)
  async retryFailedDeliveries(): Promise<number> {
    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select('id')
      .eq('status', 'retrying')
      .lte('next_retry_at', new Date().toISOString())
      .limit(100);

    let retried = 0;
    for (const delivery of deliveries || []) {
      await this.deliver(delivery.id);
      retried++;
    }

    return retried;
  }
}
```

### Webhook API Endpoints

```typescript
// GET /api/webhooks - List webhooks
// POST /api/webhooks - Create webhook
// PUT /api/webhooks/:id - Update webhook
// DELETE /api/webhooks/:id - Delete webhook
// GET /api/webhooks/:id/deliveries - List deliveries
// POST /api/webhooks/:id/test - Send test event
// GET /api/webhooks/events - List available events
```

---

## Integration Management UI

### Integration List Page

```tsx
// src/pages/IntegrationsPage.tsx

export function IntegrationsPage() {
  const { integrations, loading } = useIntegrations();

  const categories = [
    {
      name: 'CRM',
      items: [
        { type: 'salesforce', name: 'Salesforce', icon: SalesforceIcon },
        { type: 'hubspot', name: 'HubSpot', icon: HubSpotIcon }
      ]
    },
    {
      name: 'Video Conferencing',
      items: [
        { type: 'zoom', name: 'Zoom', icon: ZoomIcon },
        { type: 'teams', name: 'Microsoft Teams', icon: TeamsIcon },
        { type: 'meet', name: 'Google Meet', icon: MeetIcon }
      ]
    },
    {
      name: 'Calendar',
      items: [
        { type: 'google_calendar', name: 'Google Calendar', icon: GoogleIcon },
        { type: 'outlook_calendar', name: 'Outlook Calendar', icon: OutlookIcon }
      ]
    }
  ];

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Integrations</h1>

      {categories.map(category => (
        <div key={category.name}>
          <h2 className="text-lg font-medium mb-4">{category.name}</h2>
          <div className="grid grid-cols-3 gap-4">
            {category.items.map(item => {
              const integration = integrations?.find(i => i.integrationType === item.type);
              return (
                <IntegrationCard
                  key={item.type}
                  name={item.name}
                  icon={item.icon}
                  isConnected={!!integration?.isActive}
                  lastSync={integration?.lastSyncAt}
                  onConnect={() => initiateOAuth(item.type)}
                  onDisconnect={() => disconnectIntegration(item.type)}
                  onSettings={() => openSettings(item.type)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Webhooks section */}
      <div>
        <h2 className="text-lg font-medium mb-4">Webhooks</h2>
        <WebhooksList />
      </div>
    </div>
  );
}
```

---

## Testing Plan

### Integration Tests
- OAuth flow for each provider
- Data sync accuracy
- Token refresh handling
- Error handling and retries

### Webhook Tests
- Signature verification
- Retry logic
- Timeout handling
- Filter matching

### Load Tests
- Sync 10,000 records
- 100 concurrent webhook deliveries
- Token refresh under load

---

## Environment Variables

```bash
# Salesforce
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret

# HubSpot
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret

# Zoom
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret

# Google
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Microsoft
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
```

---

## Security Considerations

- All OAuth tokens encrypted at rest
- Webhook secrets generated with crypto-safe randomness
- Webhook signatures verified on receiving end
- Rate limiting on sync operations
- Separate credentials per tenant
- Token rotation on security events

---

## Next File

Reply: **"Show file 06"** for Testing & QA specification.
