const { readManifest, coverageGaps } = require('../services/roomRecordingManifest');

const origin = 1795797000000;
const time = ms => (origin + ms) / 1000;
const event = (type, session, ms, data) => ({ type, participant_id: session, ts: time(ms), data });
const added = (session, number, ms, name) => event('track-added', session, ms, {
  kind: 'audio', trackType: 'cam', trackSessionNum: number, displayName: name,
});
const file = number => `${origin}-track-${number}`;
const started = (session, number, ms) => event('recording-media-started', session, ms, {
  trackSessionNum: number, uri: file(number), contentType: 'audio/mp4', mediaStartTime: time(ms),
});
const removed = (session, number, ms) => event('track-removed', session, ms, { trackSessionNum: number });

const recordings = { start_ts: origin / 1000, duration: 30 };
const participants = [
  { participant_id: 'host', user_id: 'id-host', user_name: 'Host', join_time: time(0), duration: 8 },
  { participant_id: 'guest-one', user_id: 'id-one', user_name: 'Alex', join_time: time(0), duration: 30 },
  { participant_id: 'guest-left', user_id: 'id-two', user_name: 'Alex', join_time: time(0), duration: 9 },
  { participant_id: 'guest-rejoin', user_id: 'id-two', user_name: 'Alex', join_time: time(14000), duration: 16 },
];
const events = [
  added('host', 1, 0, 'Host'), started('host', 1, 0),
  added('guest-one', 2, 0, 'Alex'), started('guest-one', 2, 0),
  added('guest-left', 3, 0, 'Alex'), started('guest-left', 3, 0),
  removed('host', 1, 8000), removed('guest-left', 3, 9000),
  added('guest-rejoin', 4, 14000, 'Alex'), started('guest-rejoin', 4, 14000),
  event('recording-stopped', null, 30000, {}),
];
const keys = [1, 2, 3, 4].map(number => 'domain/room/' + file(number) + '.aac');

test('uses Daily user identity across reconnects, even when participants share a name', () => {
  const manifest = readManifest({ events }, recordings, participants, keys);
  expect(manifest).toMatchObject({ origin, durationMs: 30000 });
  expect(manifest.people.map(person => [person.label, person.segments.map(part => part.startMs)])).toEqual([
    ['Host', [0]], ['Alex', [0]], ['Alex', [0, 14000]],
  ]);
  const media = manifest.people[2].segments.map(segment => ({ ...segment, mediaDurationMs: segment.endMs - segment.startMs }));
  expect(coverageGaps(media, manifest.durationMs, manifest.people[2].witnessedAt)).toEqual([
    { startMs: 9000, endMs: 14000 },
  ]);
});

test('keeps attendance on the same track across reconnects and omits events outside the recording', () => {
  const roster = [
    { ...participants[0], join_time: time(-2000), duration: 10 },
    { ...participants[1], join_time: time(1900), duration: null },
    participants[2], participants[3], participants[3],
    { participant_id: 'late', user_id: 'late', join_time: time(29000), duration: 14 },
  ];
  const manifest = readManifest({ events }, recordings, roster, keys);
  expect(manifest.people.map(person => person.attendance)).toEqual([
    [{ kind: 'leave', atMs: 8000 }],
    [{ kind: 'join', atMs: 1900 }],
    [{ kind: 'join', atMs: 0 }, { kind: 'leave', atMs: 9000 },
      { kind: 'join', atMs: 14000 }, { kind: 'leave', atMs: 30000 }],
    [{ kind: 'join', atMs: 29000 }],
  ]);
});

test('bounds an early roster departure by the recorded session before a reconnect', () => {
  const roster = [
    { ...participants[0], duration: 10 },
    participants[1],
    { ...participants[2], join_time: time(-1800), duration: 3.7 },
    participants[3],
  ];
  const manifest = readManifest({ events }, recordings, roster, keys);
  expect(manifest.people[2].attendance).toEqual([
    { kind: 'leave', atMs: 9000 }, { kind: 'join', atMs: 14000 }, { kind: 'leave', atMs: 30000 },
  ]);
  expect(manifest.people[0].attendance).toContainEqual({ kind: 'leave', atMs: 10000 });
});

test('waits for the identity mapping and the recording objects before assigning tracks', () => {
  expect(readManifest({ events }, recordings, participants.slice(0, 3), keys)).toBeNull();
  expect(readManifest({ events }, recordings, participants, keys.slice(0, 3))).toBeNull();
});

test('marks missing media and does not count time before a late participant joins', () => {
  expect(coverageGaps([{
    startMs: 5000, endMs: 15000, mediaDurationMs: 8500,
    pauses: [{ startMs: 8000, endMs: 10000 }],
  }], 15000, 5000)).toEqual([
    { startMs: 8000, endMs: 10000 }, { startMs: 13500, endMs: 15000 },
  ]);
});
