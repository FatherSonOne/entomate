/**
 * Suggestion Engine
 * Auto-suggests intelligence profiles for meetings based on their metadata
 * (title, description, tags, participants) matched against profile suggestWhen rules.
 */

import { getActiveProfiles } from './profileService';
import { getProfileEffectiveness } from './analyticsService';
import type { SuggestionRule, ProfileSuggestion } from './types';

/** Minimum confidence to include a suggestion */
const MIN_CONFIDENCE = 0.3;

// ==================== MAIN API ====================

/**
 * Suggest intelligence profiles for a meeting based on its metadata.
 * Returns ranked suggestions sorted by confidence (descending).
 */
export async function suggestProfiles(meeting: {
  title: string;
  description?: string;
  tags?: string[];
  participants?: string[];
  attendees?: string[];
}): Promise<ProfileSuggestion[]> {
  const profiles = await getActiveProfiles();
  if (profiles.length === 0) return [];

  const suggestions: ProfileSuggestion[] = [];

  for (const profile of profiles) {
    const rules = Array.isArray(profile.suggestWhen) ? profile.suggestWhen : [];
    if (rules.length === 0) continue;

    const matchedRules: SuggestionRule[] = [];
    const reasons: string[] = [];
    let maxRuleConfidence = 0;

    for (const rule of rules) {
      const result = evaluateRule(rule, meeting);
      if (result.matched) {
        matchedRules.push(rule);
        reasons.push(result.reason);
        if (result.confidence > maxRuleConfidence) {
          maxRuleConfidence = result.confidence;
        }
      }
    }

    if (matchedRules.length === 0) continue;

    // Composite confidence: use highest rule confidence as floor,
    // boost slightly for each additional matched rule (diminishing returns)
    let confidence = maxRuleConfidence;
    for (let i = 1; i < matchedRules.length; i++) {
      const boost = matchedRules[i].confidence * 0.1 * (1 / (i + 1));
      confidence = Math.min(1.0, confidence + boost);
    }

    // Apply effectiveness-based boost/penalty (learning feedback loop)
    try {
      const eff = await getProfileEffectiveness(profile.id);
      if (eff) {
        // Boost profiles with high acceptance rates and sufficient data
        if (eff.acceptanceRate > 0.7 && eff.timesCompleted > 3) {
          confidence = Math.min(1.0, confidence * 1.1);
        }
        // Penalize profiles that frequently get dismissed
        if (eff.timesDismissed > eff.timesAccepted && eff.timesSuggested > 5) {
          confidence *= 0.8;
        }
        // Boost profiles with high user ratings
        if (eff.avgUserRating != null && eff.avgUserRating >= 4.0) {
          confidence = Math.min(1.0, confidence * 1.05);
        }
      }
    } catch {
      // Effectiveness data is optional — don't block suggestions
    }

    if (confidence < MIN_CONFIDENCE) continue;

    suggestions.push({
      profile,
      confidence: Math.round(confidence * 100) / 100,
      reason: reasons.join('; '),
      matchedRules,
    });
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

// ==================== RULE EVALUATION ====================

/**
 * Evaluate a single suggestion rule against meeting metadata.
 * Exported for testing and for showing users why a profile was suggested.
 */
export function evaluateRule(
  rule: SuggestionRule,
  meeting: { title: string; description?: string; tags?: string[]; participants?: string[]; attendees?: string[] }
): { matched: boolean; confidence: number; reason: string } {
  const matchValues = Array.isArray(rule.match) ? rule.match : [rule.match];
  const searchText = `${meeting.title} ${meeting.description || ''}`.toLowerCase();
  const participants = [...(meeting.participants || []), ...(meeting.attendees || [])].map(p => p.toLowerCase());
  const tags = (meeting.tags || []).map(t => t.toLowerCase());

  switch (rule.type) {
    case 'keyword': {
      const matched = matchValues.filter(kw => searchText.includes(kw.toLowerCase()));
      if (matched.length === 0) return { matched: false, confidence: 0, reason: '' };
      const weight = matched.length / matchValues.length;
      return {
        matched: true,
        confidence: rule.confidence * weight,
        reason: `Title/description contains "${matched.join('", "')}"`,
      };
    }

    case 'participant': {
      const matched = matchValues.filter(name =>
        participants.some(p => p.includes(name.toLowerCase()))
      );
      if (matched.length === 0) return { matched: false, confidence: 0, reason: '' };
      return {
        matched: true,
        confidence: rule.confidence,
        reason: `Participant match: ${matched.join(', ')}`,
      };
    }

    case 'tag': {
      const matched = matchValues.filter(tag =>
        tags.some(t => t.includes(tag.toLowerCase()))
      );
      if (matched.length === 0) return { matched: false, confidence: 0, reason: '' };
      return {
        matched: true,
        confidence: rule.confidence,
        reason: `Tag match: ${matched.join(', ')}`,
      };
    }

    case 'recurring': {
      const recurringKeywords = ['weekly', 'daily', 'biweekly', 'monthly', 'recurring', 'standing'];
      const matchedKeywords = recurringKeywords.filter(kw => searchText.includes(kw));
      if (matchedKeywords.length === 0) return { matched: false, confidence: 0, reason: '' };
      // Also check if rule.match values match
      const ruleMatched = matchValues.some(v => matchedKeywords.includes(v.toLowerCase()));
      if (!ruleMatched && matchedKeywords.length === 0) return { matched: false, confidence: 0, reason: '' };
      return {
        matched: true,
        confidence: rule.confidence,
        reason: `Recurring meeting: ${matchedKeywords.join(', ')}`,
      };
    }

    case 'org_type': {
      // Heuristic: match org type keywords in title/description
      const matched = matchValues.filter(orgType => searchText.includes(orgType.toLowerCase()));
      if (matched.length === 0) return { matched: false, confidence: 0, reason: '' };
      return {
        matched: true,
        confidence: rule.confidence,
        reason: `Organization type: ${matched.join(', ')}`,
      };
    }

    default:
      return { matched: false, confidence: 0, reason: '' };
  }
}
