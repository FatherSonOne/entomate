import { afterEach, describe, expect, it } from 'vitest'
import {
  __resetBootForTests, bootProgress, endBoot, getBoot, initBoot, markBoot, planFor, stageDurations, uncoverBoot,
} from '../services/bootProgress'

afterEach(() => __resetBootForTests())

describe('first-load plan', () => {
  it('covers app pages, not public ones', () => {
    expect(planFor('/dashboard')?.map((s) => s.id)).toEqual(['app', 'session', 'workspace', 'page'])
    expect(planFor('/meetings/abc')?.map((s) => s.id)).toEqual(['app', 'session', 'workspace', 'page'])
    expect(planFor('/auth/callback')?.[1]?.label).toBe('Sign-in')
    expect(planFor('/workflows/42')?.map((s) => s.id)).toEqual(['app', 'session'])
    expect(planFor('/')).toBeNull()
    expect(planFor('/sign-in')).toBeNull()
    expect(planFor('/opt-out/t')).toBeNull()
    expect(planFor('/no-such-page')).toBeNull()
  })

  it('does nothing on a public page', () => {
    initBoot('/', 100)
    expect(getBoot()).toMatchObject({ phase: 'idle', covering: false })
  })
})

describe('first-load progress', () => {
  it('counts only stages that really finished, creeping inside the current one', () => {
    initBoot('/dashboard', 400)
    const { stages } = getBoot()
    expect(bootProgress(stages, 400, false)).toBe(15)
    const crept = bootProgress(stages, 5000)
    expect(crept).toBeGreaterThan(15)
    expect(crept).toBeLessThan(45) // never reaches the end of Session on time alone
    markBoot('session', 900)
    expect(bootProgress(getBoot().stages, 900, false)).toBe(45)
  })

  it('finishes when the page is drawn, and earlier stages count as done', () => {
    initBoot('/dashboard', 300)
    markBoot('page', 1200)
    expect(getBoot().phase).toBe('done')
    expect(bootProgress(getBoot().stages, 1200)).toBe(100)
    expect(stageDurations(getBoot().stages)).toEqual([300, 900, 0, 0])
  })

  it('ignores marks out of a boot and repeated marks', () => {
    markBoot('session', 10)
    expect(getBoot().phase).toBe('idle')
    initBoot('/tasks', 100)
    markBoot('session', 200)
    markBoot('session', 900)
    expect(getBoot().stages[1]?.doneAt).toBe(200)
  })

  it('ends early: done fills the rest, aborted leaves it', () => {
    initBoot('/tasks', 100)
    endBoot('done', 700)
    expect(bootProgress(getBoot().stages)).toBe(100)
    __resetBootForTests()
    initBoot('/tasks', 100)
    endBoot('aborted')
    expect(getBoot()).toMatchObject({ phase: 'aborted', covering: true })
    uncoverBoot()
    expect(getBoot().covering).toBe(false)
  })
})
