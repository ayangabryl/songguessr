import { useEffect, useState } from 'react'
import { FilterModal } from './FilterModal'
import { fetchRegions, fetchCollections, fetchAvailability, type CatalogRegion, type CatalogCollection } from '../lib/api'
import type { CatalogFilters } from '../lib/filters'
import type { MatchDifficulty } from '../../shared/match'
export function HostMix({value,difficulty,onClose,onApply}:{value:CatalogFilters;difficulty:MatchDifficulty;onClose:()=>void;onApply:(f:CatalogFilters)=>void}) {
 const [draft,setDraft]=useState(value)
 const [regions,setRegions]=useState<CatalogRegion[]>([])
 const [collections,setCollections]=useState<CatalogCollection[]>([])
 const [count,setCount]=useState(0), [ready,setReady]=useState(false)
 useEffect(()=>{void fetchRegions().then(setRegions).catch(()=>{});void fetchCollections().then(setCollections).catch(()=>{})},[])
 useEffect(()=>{let alive=true;setReady(false);void fetchAvailability(draft).then(data=>{if(alive){setCount(data.counts[difficulty]);setReady(true)}}).catch(()=>{});return()=>{alive=false}},[draft,difficulty])
 function toggle(key:'eras'|'genres'|'countries'|'collections'|'artists',v:string){setDraft(d=>({...d,[key]:(d[key] as string[]).includes(v)?d[key].filter(x=>x!==v):[...d[key],v]}))}
 return <FilterModal open difficulty={difficulty} draftEras={draft.eras} draftGenres={draft.genres} draftCountries={draft.countries} draftCollections={draft.collections} draftArtists={draft.artists} regions={regions} collections={collections} previewCount={count} previewReady={ready}
 excludedArtists={draft.excludedArtists} excludedGenres={draft.excludedGenres} onExclusions={(excludedArtists,excludedGenres)=>setDraft(d=>({...d,excludedArtists,excludedGenres}))}
 onToggleEra={v=>toggle('eras',v)} onToggleGenre={v=>toggle('genres',v)} onToggleRegion={v=>toggle('countries',v)} onToggleCollection={v=>toggle('collections',v)} onToggleArtist={v=>toggle('artists',v)} onRemoveArtist={v=>toggle('artists',v)}
 onClearEras={()=>setDraft(d=>({...d,eras:[]}))} onClearGenres={()=>setDraft(d=>({...d,genres:[]}))} onClearRegions={()=>setDraft(d=>({...d,countries:[]}))} onClearCollections={()=>setDraft(d=>({...d,collections:[]}))} onClearAll={()=>setDraft({eras:[],genres:[],countries:[],collections:[],artists:[],excludedArtists:[],excludedGenres:[]})} onClose={onClose} onApply={()=>onApply(draft)} />
}
