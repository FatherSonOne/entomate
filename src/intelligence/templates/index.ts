/**
 * Built-in Profile Templates — Index
 * Re-exports all 7 built-in intelligence profile templates.
 */

export { GRANT_SPECIALIST_PROFILE } from './grantSpecialist';
export { SALES_DISCOVERY_PROFILE } from './salesDiscovery';
export { CLIENT_CHECK_IN_PROFILE } from './clientCheckIn';
export { BOARD_MEETING_PROFILE } from './boardMeeting';
export { INTERNAL_STANDUP_PROFILE } from './internalStandup';
export { STRATEGIC_PLANNING_PROFILE } from './strategicPlanning';
export { VENDOR_NEGOTIATION_PROFILE } from './vendorNegotiation';

import type { ProfileTemplate } from '../types';
import { GRANT_SPECIALIST_PROFILE } from './grantSpecialist';
import { SALES_DISCOVERY_PROFILE } from './salesDiscovery';
import { CLIENT_CHECK_IN_PROFILE } from './clientCheckIn';
import { BOARD_MEETING_PROFILE } from './boardMeeting';
import { INTERNAL_STANDUP_PROFILE } from './internalStandup';
import { STRATEGIC_PLANNING_PROFILE } from './strategicPlanning';
import { VENDOR_NEGOTIATION_PROFILE } from './vendorNegotiation';

/**
 * All built-in profile templates in display order
 */
export const BUILTIN_PROFILES: ProfileTemplate[] = [
  GRANT_SPECIALIST_PROFILE,
  SALES_DISCOVERY_PROFILE,
  CLIENT_CHECK_IN_PROFILE,
  BOARD_MEETING_PROFILE,
  INTERNAL_STANDUP_PROFILE,
  STRATEGIC_PLANNING_PROFILE,
  VENDOR_NEGOTIATION_PROFILE,
];
