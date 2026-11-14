import { describe, it, expect, beforeEach } from 'vitest'
import { initClassmap, cls, resetClassmap } from '../src/lib/classmap'

describe('classmap', () => {
  beforeEach(() => {
    resetClassmap()
  })

  it('throws when cls() called before init', () => {
    expect(() => cls('heroWrap')).toThrow()
  })

  it('returns mapped class name after init', () => {
    initClassmap({ heroWrap: 'hero-section', navList: 'main-nav-list' })
    expect(cls('heroWrap')).toBe('hero-section')
    expect(cls('navList')).toBe('main-nav-list')
  })

  it('throws on unknown key', () => {
    initClassmap({ heroWrap: 'hero-section' })
    expect(() => cls('nonExistentKey')).toThrow()
  })

  it('resetClassmap clears state so cls throws again', () => {
    initClassmap({ heroWrap: 'hero-section' })
    expect(cls('heroWrap')).toBe('hero-section')
    resetClassmap()
    expect(() => cls('heroWrap')).toThrow()
  })

  it('allows re-init after reset', () => {
    initClassmap({ heroWrap: 'hero-section' })
    resetClassmap()
    initClassmap({ heroWrap: 'banner-block' })
    expect(cls('heroWrap')).toBe('banner-block')
  })

  it('handles empty classmap', () => {
    initClassmap({})
    expect(() => cls('anything')).toThrow()
  })

  it('returns different values for different keys', () => {
    initClassmap({
      heroWrap: 'hero-section',
      navList: 'main-nav-list',
      ctaButton: 'primary-action-btn',
    })
    expect(cls('heroWrap')).not.toBe(cls('navList'))
    expect(cls('ctaButton')).toBe('primary-action-btn')
  })
})
