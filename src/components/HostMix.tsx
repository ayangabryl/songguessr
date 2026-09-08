import { useMixAvailability } from '../hooks/useMixAvailability'
import { useEffect, useState } from 'react'
import { FilterModal } from './FilterModal'
import { fetchRegions, fetchCollections, type CatalogRegion, type CatalogCollection } from '../lib/api'
import type { CatalogFilters } from '../lib/filters'
import type { MatchDifficulty } from '../../shared/match'
export function HostMix({value,difficulty,onClose,onApply}:{value:CatalogFilters;difficulty:MatchDifficulty|'mixed';onClose:()=>void;onApply:(f:CatalogFilters,difficulty:MatchDifficulty)=>void}) {
 const [draft,setDraft]=useState(value)
 const [regions,setRegions]=useState<CatalogRegion[]>([])
 const [collections,setCollections]=useState<CatalogCollection[]>([])
 const preview=useMixAvailability(draft,difficulty==='mixed'?'easy':difficulty)
 useEffect(()=>{void fetchRegions().then(setRegions).catch(()=>{});void fetchCollections().then(setCollections).catch(()=>{})},[])

 function toggle(key:'eras'|'genres'|'countries'|'collections'|'artists',v:string){setDraft(d=>({...d,[key]:(d[key] as string[]).includes(v)?d[key].filter(x=>x!==v):[...d[key],v]}))}
 return <FilterModal playlist={draft.playlist} onPlaylist={playlist=>setDraft(d=>({...d,playlist}))} open allDifficulties={difficulty==='mixed'} difficulty={difficulty==='mixed'?preview.difficulty:difficulty} draftEras={draft.eras} draftGenres={draft.genres} draftCountries={draft.countries} draftCollections={draft.collections} draftArtists={draft.artists} regions={regions} collections={collections} previewCount={difficulty==='mixed'?preview.total:preview.count} previewReady={preview.ready} previewError={preview.error} onRetryPreview={preview.retry} previewDifficulty={preview.difficulty}
 excludedArtists={draft.excludedArtists} excludedGenres={draft.excludedGenres} onExclusions={(excludedArtists,excludedGenres)=>setDraft(d=>({...d,excludedArtists,excludedGenres}))}
 onToggleEra={v=>toggle('eras',v)} onToggleGenre={v=>toggle('genres',v)} onToggleRegion={v=>toggle('countries',v)} onToggleCollection={v=>toggle('collections',v)} onToggleArtist={v=>toggle('artists',v)} onRemoveArtist={v=>toggle('artists',v)}
 onClearEras={()=>setDraft(d=>({...d,eras:[]}))} onClearGenres={()=>setDraft(d=>({...d,genres:[]}))} onClearRegions={()=>setDraft(d=>({...d,countries:[]}))} onClearCollections={()=>setDraft(d=>({...d,collections:[]}))} onClearAll={()=>setDraft({eras:[],genres:[],countries:[],collections:[],artists:[],excludedArtists:[],excludedGenres:[]})} onClose={onClose} onApply={()=>{if(preview.ready&&!preview.error&&preview.count>0)onApply(draft,preview.difficulty)}} />
}
