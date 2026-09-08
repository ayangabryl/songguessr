import { matchRank } from '../../shared/match.ts'

type Seat = { id: string; name: string; points: number }
/** Only actual score crossings between existing seats count as an overtake. */
export function describeOvertake(before: Seat[], after: Seat[], playerId: string): string | null {
  const oldYou = before.find(p => p.id === playerId), you = after.find(p => p.id === playerId)
  if (!oldYou || !you) return null
  const old = new Map(before.map(p => [p.id, p]))
  const passedYou = after.filter(p => p.id !== playerId && old.has(p.id) && old.get(p.id)!.points <= oldYou.points && p.points > you.points)
  const youPassed = after.filter(p => p.id !== playerId && old.has(p.id) && old.get(p.id)!.points >= oldYou.points && p.points < you.points)
  const nameGroup = (seats: Seat[]) => seats.length === 1 ? seats[0].name : `${seats[0].name} and ${seats.length - 1} ${seats.length === 2 ? 'other' : 'others'}`
  if (passedYou.length) return `${nameGroup(passedYou)} passed you.`
  if (youPassed.length) {
    const place = matchRank(after, playerId)
    if (place.rank === 1 && !place.tied) return 'You took the lead.'
    return `You passed ${nameGroup(youPassed)}.`
  }
  return null
}
