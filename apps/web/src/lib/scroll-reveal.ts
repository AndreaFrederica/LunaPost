import type { ObjectDirective } from 'vue'

const DURATION = 550
const DISTANCE = 14
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

type RevealState = { animation?: Animation; timer?: number }
const states = new WeakMap<HTMLElement, RevealState>()

// One shared observer keeps a page with dozens of cards cheap. Elements are
// unobserved as soon as they have appeared, so scrolling back up never replays
// the effect.
let observer: IntersectionObserver | undefined

function ensureObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer?.unobserve(entry.target)
      reveal(entry.target as HTMLElement)
    }
  }, { rootMargin: '0px 0px -8% 0px' })
  return observer
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Web Animations instead of a CSS transition: content blocks already use
// transitions and keyframes for hover states, and an animation cannot be
// overridden by those declarations the way a shared `transition` would be.
function reveal(element: HTMLElement) {
  const state = states.get(element)
  if (!state || state.animation) return
  if (state.timer) { window.clearTimeout(state.timer); state.timer = undefined }
  element.classList.remove('reveal')
  const animation = element.animate(
    [{ opacity: 0, transform: `translateY(${DISTANCE}px)` }, { opacity: 1, transform: 'translateY(0)' }],
    { delay: Number(element.dataset.revealDelay ?? 0), duration: DURATION, easing: EASING, fill: 'both' },
  )
  state.animation = animation
  // The last keyframe equals the element's own styles, so dropping the fill
  // cannot produce a visible jump while freeing the transform for hover states.
  animation.addEventListener('finish', () => {
    animation.cancel()
    state.animation = undefined
  })
}

const onScreen = (element: HTMLElement) => {
  const bounds = element.getBoundingClientRect()
  return bounds.bottom > 0 && bounds.top < window.innerHeight
}

// If the observer never reports an element that is on screen (a throttled
// observer, a page restored in a hidden tab), reveal it anyway instead of
// leaving content invisible. The check stops as soon as the element appeared.
function armSafety(element: HTMLElement, state: RevealState) {
  state.timer = window.setTimeout(() => {
    state.timer = undefined
    if (!element.isConnected || !element.classList.contains('reveal')) return
    if (onScreen(element)) reveal(element)
    else armSafety(element, state)
  }, 1000)
}

// `v-reveal` fades and lifts an element the first time it scrolls into view.
// Pass a number for a stagger delay in milliseconds: `v-reveal="index * 40"`.
export const vReveal: ObjectDirective<HTMLElement, number | undefined> = {
  mounted(element, binding) {
    const delay = Math.max(0, Number(binding.value ?? 0))
    if (typeof window === 'undefined' || typeof element.animate !== 'function' || typeof IntersectionObserver === 'undefined' || reducedMotion()) return
    const state: RevealState = {}
    states.set(element, state)
    if (delay > 0) element.dataset.revealDelay = String(delay)
    const bounds = element.getBoundingClientRect()
    // Scrolled past (restored scroll position) or not laid out at all (a closed
    // tab panel): leave it alone, it must show up as a normal block later.
    if (bounds.bottom <= 0) return
    // Below the fold: hide it until it scrolls in. Everything already on screen
    // animates straight away, so a failure here can never hide visible content.
    if (bounds.top >= window.innerHeight) {
      element.classList.add('reveal')
      ensureObserver().observe(element)
      armSafety(element, state)
      return
    }
    reveal(element)
  },
  unmounted(element) {
    observer?.unobserve(element)
    const state = states.get(element)
    if (state?.timer) window.clearTimeout(state.timer)
    state?.animation?.cancel()
    states.delete(element)
  },
}
