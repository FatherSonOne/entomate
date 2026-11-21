'use strict';

const { createMatcher, summaryMoments, withActionItemMoments, _internal } = require('../services/transcriptMoments');

const SEGMENTS = [
  { atMs: 2000, speaker: 'Ann', text: 'Thanks for joining. Let us go over the Q4 budget first.' },
  { atMs: 9500, speaker: 'Bo', text: 'The marketing budget for the launch is approved, pending the vendor quote.' },
  { atMs: 21000, speaker: 'Marcus', text: 'I can send the vendor quote to finance by Friday.' },
  { atMs: 34000, speaker: 'Ann', text: 'Great. We will move the product launch to March fifteenth.' },
  { atMs: 61000, speaker: 'Bo', text: 'One more thing, the onboarding deck needs a refresh before the offsite.' },
  { atMs: 75000, speaker: 'Marcus', text: 'I will update the onboarding slides.' },
];

describe('transcriptMoments', () => {
  test('stems plurals and verb forms, drops stop words', () => {
    expect(_internal.tokens('The launches are shipping')).toEqual(['launch', 'shipp']);
    expect(_internal.stem('moved')).toBe(_internal.stem('move'));
  });

  test('a decision links to the line where it was said, even when paraphrased', () => {
    const momentFor = createMatcher(SEGMENTS);
    expect(momentFor('Product launch moved to March 15')).toBe(34000);
    expect(momentFor('Marketing budget approved pending vendor quote')).toBe(9500);
  });

  test('a match can span into the next line (the earlier line wins)', () => {
    const momentFor = createMatcher(SEGMENTS);
    // "onboarding deck" is in 61000, "slides" in 75000.
    expect(momentFor('Refresh onboarding deck and slides')).toBe(61000);
  });

  test('an item the transcript does not support gets no link', () => {
    const momentFor = createMatcher(SEGMENTS);
    expect(momentFor('Hire two engineers in Berlin')).toBeNull();
    expect(momentFor('budget')).toBeNull(); // one shared word is not evidence
    expect(momentFor('')).toBeNull();
  });

  test('summaryMoments is index-aligned and null without a timed transcript', () => {
    expect(summaryMoments(null, ['a'], ['b'])).toBeNull();
    expect(summaryMoments(SEGMENTS, ['Onboarding deck needs a refresh'], ['Launch moves to March', 'Open a Tokyo office'])).toEqual({
      keyPoints: [61000],
      decisions: [34000, null],
    });
  });

  test('action items get transcriptAtMs from task plus context, without mutating input', () => {
    const items = [
      { task: 'Send vendor quote to finance', context: 'Needed for budget approval', owner: 'Marcus' },
      { task: 'Book flights', context: '' },
    ];
    const out = withActionItemMoments(SEGMENTS, items);
    expect(out[0].transcriptAtMs).toBe(21000);
    expect(out[1].transcriptAtMs).toBeUndefined();
    expect(items[0].transcriptAtMs).toBeUndefined();
    expect(withActionItemMoments([], items)).toBe(items);
  });
});
