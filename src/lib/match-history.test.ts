import {test} from 'node:test'
import assert from 'node:assert/strict'
import {advancePlayer, completedMatchRounds, expireRound, finishRound, nextEntries, publicMatch, type MatchState} from '../../shared/match.ts'
import {matchSittingHistory} from './match-history.ts'
const make = (): MatchState => ({id:'match',roundId:'r1',number:1,phase:'playing',scoringVersion:3,difficulty:'easy',startsAt:0,deadline:90000,used:['secret'],song:{id:'secret',title:'Unrevealed song',artist:'Artist',albumArt:'cover',audio:'audio',offset:0},entries:nextEntries([],['alice','bob'].map(id=>({id,name:id})),false,false)})
test('all skips are recorded, including final Pass, without revealing the song early', () => {
 let m=make()
 for(let stage=0;stage<5;stage++)m=advancePlayer(m,'alice','r1',stage,false,true,1000)
 assert.equal(m.phase,'playing')
 assert.equal(publicMatch(m).answer,null)
 assert.deepEqual(publicMatch(m).completedRounds,[])
 assert.equal(JSON.stringify(publicMatch(m)).includes('Unrevealed song'),false)
 assert.deepEqual(m.entries[0].attempts?.map(a=>a.stage),[.1,.5,2,8,15])
 m=advancePlayer(m,'bob','r1',0,true,false,2000)
 const rows=matchSittingHistory(publicMatch(m),'alice')
 assert.equal(rows.length,1);assert.equal(rows[0].points,0);assert.equal(rows[0].status,'lost');assert.equal(rows[0].marks.length,5)
 assert.deepEqual(completedMatchRounds(finishRound(m)),m.completedRounds,'repeated finish cannot duplicate the song')
})
test('mixed miss/skip history survives reconnect and a following round without leaking its song', () => {
 let m=advancePlayer(make(),'alice','r1',0,false,false,1000)
 m=advancePlayer(m,'alice','r1',1,false,true,2000)
 m=advancePlayer(m,'alice','r1',2,true,false,3000)
 m=expireRound(m,90000)
 const reconnected=JSON.parse(JSON.stringify(m)) as MatchState
 const rows=matchSittingHistory(publicMatch(reconnected),'alice')
 assert.deepEqual(rows[0].marks,[{stage:.1,kind:'miss'},{stage:.5,kind:'skip'}]);assert.equal(rows[0].points,3);assert.equal(rows[0].solvedStage,2)
 const next:MatchState={...reconnected,roundId:'r2',number:2,phase:'playing',entries:nextEntries(m.entries,m.entries,true,false),completedRounds:completedMatchRounds(reconnected),song:{...m.song,id:'next-secret',title:'Next secret'}}
 assert.deepEqual(matchSittingHistory(publicMatch(next),'alice'),rows)
 assert.equal(JSON.stringify(publicMatch(next)).includes('Next secret'),false)
 assert.deepEqual(next.entries[0].attempts,[])
 assert.deepEqual(matchSittingHistory(publicMatch(next),'newcomer'),[])
})
test('timeouts do not invent attempts, and older revealed matches can enter history', () => {
 const m=expireRound(make(),90000)
 const rows=matchSittingHistory(publicMatch(m),'alice')
 assert.deepEqual(rows[0].marks,[]);assert.match(rows[0].description!,/Time ran out/)
 const old={...m,completedRounds:undefined,entries:m.entries.map(({attempts:_attempts,...entry})=>entry)}
 assert.equal(publicMatch(old).completedRounds?.length,1)
 assert.equal(completedMatchRounds({...make(),completedRounds:undefined}).length,0)
})
