jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }));

const { supabase } = require('../../config/supabase');
const { loadProfile, profileGuidance, seedBotProfile } = require('../meetingIntelligenceProfile');
const { normalizeSections, promptAddon } = require('../summaryTemplates');

test('keeps the ordinary template when the meeting has no profile', async () => {
  expect(await loadProfile()).toBeNull();
  expect(profileGuidance(null, 'planning')).toEqual({
    actionAddon: '',
    sections: [],
    summaryAddon: promptAddon('planning'),
  });
});

test('uses saved context as guidance and adds profile sections to the existing template', () => {
  const guidance = profileGuidance({
    profile: {
      name: 'Grant Specialist',
      tone: 'formal',
      custom_fields: [{ key: 'stage', label: 'Stage', options: [{ value: 'awarded', label: 'Implementation' }] }],
      focus_areas: [{ label: 'Reporting', extractionHint: 'Find reporting commitments' }],
      output_format: { customSections: [{ title: 'Compliance items', prompt: 'Capture reporting obligations' }] },
    },
    custom_field_values: { stage: 'awarded', unrecognized: 'outside the profile' },
    additional_instructions: 'Check deadlines',
  }, 'planning');

  expect(guidance.actionAddon).toContain('Find reporting commitments');
  expect(guidance.actionAddon).toContain('Stage: Implementation');
  expect(guidance.actionAddon).toContain('Check deadlines');
  expect(guidance.actionAddon).not.toContain('outside the profile');
  expect(guidance.actionAddon).toMatch(/transcript as the only source/);
  expect(guidance.summaryAddon).toContain('Capture reporting obligations');
  expect(guidance.summaryAddon).toContain('"Risks and dependencies"');
  expect(normalizeSections([
    { title: 'Compliance items', items: ['File report by May 1'] },
    { title: 'Made up', items: ['Ignore this heading'] },
  ], 'planning', guidance.sections).at(-1)).toEqual({
    title: 'Compliance items', items: ['File report by May 1'],
  });
});

test('carries a bot profile into the meeting without overwriting an existing setup', async () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const calendar = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { profile_id: 'board-profile' } }),
  };
  supabase.from.mockImplementation(table => table === 'calendar_meeting_profiles' ? calendar : { upsert });
  await seedBotProfile({ id: 'scheduled', org_id: 'workspace' }, {
    org_id: 'workspace', meeting_id: 'scheduled',
    calendar_event_key: 'board-occurrence@2026-12-03T15:00:00.000Z',
  });
  await seedBotProfile({ id: 'ad-hoc', org_id: 'workspace' }, {
    org_id: 'workspace', meeting_id: 'ad-hoc', intelligence_profile_id: 'grant-profile',
  });
  await seedBotProfile({ id: 'general', org_id: 'workspace' });
  await seedBotProfile({ id: 'ad-hoc', org_id: 'other-workspace' }, {
    org_id: 'workspace', meeting_id: 'ad-hoc', intelligence_profile_id: 'grant-profile',
  });

  expect(calendar.eq.mock.calls).toEqual([['org_id', 'workspace'], ['event_id', 'board-occurrence']]);
  expect(upsert.mock.calls).toEqual([
    [{ meeting_id: 'scheduled', profile_id: 'board-profile' }, { onConflict: 'meeting_id', ignoreDuplicates: true }],
    [{ meeting_id: 'ad-hoc', profile_id: 'grant-profile' }, { onConflict: 'meeting_id', ignoreDuplicates: true }],
  ]);
});
