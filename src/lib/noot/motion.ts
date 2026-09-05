import { MathUtils } from 'three'

/** Damped springs retain velocity when a gesture is interrupted. */
export function spring(initial = 0, frequency = 4, damping = .8) {
  let value = initial, velocity = 0
  return {
    step(target: number, dt: number) {
      // Substeps keep the antenna and feet stable after a slow mobile frame.
      const steps = Math.max(1, Math.ceil(dt / .008)), h = dt / steps, omega = frequency * Math.PI * 2
      for (let i = 0; i < steps; i++) {
        velocity += (omega * omega * (target - value) - 2 * damping * omega * velocity) * h
        value += velocity * h
      }
      return value
    },
    reset(target = initial) { value = target; velocity = 0; return value },
  }
}
export const smooth = (value: number) => { const t = MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t) }
export const pulse = (time: number, start: number, end: number) => time < start || time > end ? 0 : Math.sin((time - start) / (end - start) * Math.PI) ** 2

/** Quick lid drop, tiny closed hold, slower ease out. Never scales an eyeball. */
export function blinkAmount(age: number) {
  if (age < 0 || age > .31) return 0
  if (age < .075) return smooth(age / .075)
  if (age < .115) return 1
  return 1 - smooth((age - .115) / .195)
}
