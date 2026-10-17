import type { ObjectDirective } from 'vue'

type DetailsState = { expanded: boolean; animation?: Animation; dispose: () => void }
const states = new WeakMap<HTMLDetailsElement, DetailsState>()
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Keep native summary keyboard semantics and the open attribute. While closing,
// leave content rendered until the height transition finishes.
export async function setDetailsOpen(element: HTMLDetailsElement, expanded: boolean): Promise<void> {
  const state = states.get(element)
  if (!state) { element.open = expanded; return }
  if (state.expanded === expanded) {
    await state.animation?.finished.catch(() => {})
    return
  }
  const from = element.getBoundingClientRect().height
  state.animation?.cancel()
  state.animation = undefined
  state.expanded = expanded
  element.dataset.expanded = String(expanded)
  element.open = expanded
  const to = element.getBoundingClientRect().height
  if (prefersReducedMotion() || Math.abs(from - to) < 1) return
  element.open = true
  const animation = element.animate(
    [{ height: `${from}px`, overflow: 'clip' }, { height: `${to}px`, overflow: 'clip' }],
    { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
  )
  state.animation = animation
  try { await animation.finished } catch { return }
  if (state.animation !== animation) return
  element.open = expanded
  animation.cancel()
  state.animation = undefined
}

export const vAnimatedDetails: ObjectDirective<HTMLDetailsElement> = {
  mounted(element) {
    const summary = element.querySelector('summary')!
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('a, button, input'))) return
      event.preventDefault()
      void setDetailsOpen(element, !states.get(element)!.expanded)
    }
    const reduceMotion = () => { if (motion.matches) states.get(element)?.animation?.finish() }
    summary.addEventListener('click', click)
    motion.addEventListener('change', reduceMotion)
    element.dataset.expanded = String(element.open)
    states.set(element, {
      expanded: element.open,
      dispose: () => {
        summary.removeEventListener('click', click)
        motion.removeEventListener('change', reduceMotion)
      },
    })
  },
  beforeUnmount(element) {
    const state = states.get(element)
    state?.animation?.cancel()
    state?.dispose()
    states.delete(element)
  },
}
