import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeOvertake } from './match-overtake.ts'
const seats = (you: number, milo: number, luna = 100) => [{id:'you',name:'You',points:you},{id:'milo',name:'Milo',points:milo},{id:'luna',name:'Luna',points:luna}]
test('announces actual crossings, including overtaking from a tie', () => {
  assert.equal(describeOvertake(seats(500,400),seats(500,600),'you'),'Milo passed you.')
  assert.equal(describeOvertake(seats(500,500),seats(500,600),'you'),'Milo passed you.')
  assert.equal(describeOvertake(seats(500,600),seats(700,600),'you'),'You took the lead.')
  assert.equal(describeOvertake(seats(500,600,1000),seats(700,600,1000),'you'),'You passed Milo.')
})
test('a tied score, unchanged rank, new seat or missing player is not an overtake', () => {
  assert.equal(describeOvertake(seats(500,400),seats(500,500),'you'),null)
  assert.equal(describeOvertake(seats(500,400),seats(600,450),'you'),null)
  assert.equal(describeOvertake(seats(500,400),[...seats(500,400),{id:'new',name:'New',points:900}],'you'),null)
  assert.equal(describeOvertake([],seats(500,400),'you'),null)
})
test('groups simultaneous passes without reporting a false lead', () => {
  assert.equal(describeOvertake(seats(500,400,300),seats(500,700,650),'you'),'Milo and 1 other passed you.')
  assert.equal(describeOvertake(seats(500,600,700),seats(700,600,700),'you'),'You passed Milo.')
})
