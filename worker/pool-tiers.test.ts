import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {poolTieredCte} from './pool-tiers.ts'

function makePool(size:number, metric:number|null=null) {
  const db=new DatabaseSync(':memory:')
  db.exec('CREATE TABLE tracks(id TEXT PRIMARY KEY,play_count INTEGER,popularity INTEGER,release_year INTEGER,artist_popularity INTEGER,chart_boost INTEGER)')
  const insert=db.prepare('INSERT INTO tracks(id,popularity) VALUES (?,?)')
  for(let n=0;n<size;n++)insert.run(String(n).padStart(3,'0'),metric)
  return db
}
for(const metric of [null,70])test(`49 equally ranked playlist songs fill every difficulty (${metric===null?'missing':'tied'} metrics)`,()=>{
  const db=makePool(49,metric)
  try {
    const query=poolTieredCte('')+' SELECT id,pool_tier FROM tiered ORDER BY id'
    const first=db.prepare(query).all()
    assert.equal(first.length,49)
    assert.equal(new Set(first.map(row=>row.pool_tier)).size,5)
    assert.deepEqual(db.prepare(query).all(),first,'ties remain stable across count and pick queries')
    db.exec('UPDATE tracks SET popularity=70')
    db.prepare('UPDATE tracks SET popularity=99 WHERE id=?').run('000')
    assert.equal(db.prepare(poolTieredCte('')+" SELECT pool_tier FROM tiered WHERE id='000'").get()?.pool_tier,'easy','actual score outranks the ID tiebreak')
  }finally{db.close()}
})
test('small filtered playlists retain an Easy pool and never admit outside songs',()=>{
  for(const size of [1,2,3,6,14,24]) {
    const db=makePool(50)
    try{
      const rows=db.prepare(poolTieredCte(' AND CAST(id AS INTEGER) < ?')+' SELECT id,pool_tier FROM tiered').all(size)
      assert.equal(rows.length,size)
      assert(rows.every(row=>Number(row.id)<size))
      assert(rows.some(row=>row.pool_tier==='easy'))
    }finally{db.close()}
  }
})
