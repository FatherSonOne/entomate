import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetLoaderHandoffForTests, loaderMounted, loaderUnmounted, onLoaderExit } from '../services/loaderHandoff'

afterEach(() => __resetLoaderHandoffForTests())
const tick = (): Promise<void> => new Promise((r) => queueMicrotask(r))

describe('loader handoff', () => {
  it('fires once the last loader goes', async () => {
    const fn = vi.fn()
    onLoaderExit(fn)
    loaderMounted()
    loaderUnmounted('aperture')
    await tick()
    expect(fn).toHaveBeenCalledWith('aperture')
  })

  it('does not fire when one loader replaces another in the same commit', async () => {
    const fn = vi.fn()
    onLoaderExit(fn)
    loaderMounted()
    loaderUnmounted('relay')
    loaderMounted()
    await tick()
    expect(fn).not.toHaveBeenCalled()
  })
})
