import { InvariantError } from '../../shared/lib/invariant-error'

let cannotGuaranteeAtomicTimers = false

/**
 * Allows scheduling multiple timers (equivalent to `setTimeout(cb, delayMs)`) that are
 * guaranteed to run in the same iteration of the event loop.
 *
 * @param delayMs - the delay to pass to `setTimeout`. (default: 0)
 * */
export function createAtomicTimerGroup(delayMs = 0) {
  if (process.env.NEXT_RUNTIME === 'edge') {
    throw new InvariantError(
      'createAtomicTimerGroup cannot be called in the edge runtime'
    )
  } else {
    let firstTimerIdleStart: number | null = null

    return function scheduleTimeout(callback: () => void) {
      const timer = setTimeout(callback, delayMs)
      if (cannotGuaranteeAtomicTimers) {
        // We already tried patching some timers, and it didn't work.
        // No point trying again.
        return timer
      }

      // NodeJS timers to have a `_idleStart` property, but it doesn't exist e.g. in Bun.
      // If it's not present, we'll warn and try to continue.
      try {
        if ('_idleStart' in timer && typeof timer._idleStart === 'number') {
          // If this is the first timer that was scheduled, save its `_idleStart`.
          // We'll copy it onto subsequent timers to guarantee that they'll all be
          // considered expired in the same iteration of the event loop
          // and thus will all be executed in the same timer phase.
          if (firstTimerIdleStart === null) {
            firstTimerIdleStart = timer._idleStart
          } else {
            timer._idleStart = firstTimerIdleStart
          }
        } else {
          console.warn(
            "Next.js cannot guarantee that Cache Components will run as expected due to the current runtime's implementation of `setTimeout()`.\nPlease report a github issue here: https://github.com/vercel/next.js/issues/new/"
          )
          cannotGuaranteeAtomicTimers = true
        }
      } catch (err) {
        // This should never fail in current Node, but it might start failing in the future.
        // We might be okay even without tweaking the timers, so warn and try to continue.
        console.error(
          new InvariantError(
            'An unexpected error occurred while adjusting `_idleStart` on an atomic timer',
            { cause: err }
          )
        )
        cannotGuaranteeAtomicTimers = true
      }

      return timer
    }
  }
}
