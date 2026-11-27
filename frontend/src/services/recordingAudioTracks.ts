export const ISOLATED_AUDIO_TRACKS = ['mic', 'tab'] as const
export type IsolatedAudioTrack = typeof ISOLATED_AUDIO_TRACKS[number]
