import type { PlaylistMix } from './playlist-mix'
export interface PlaylistIssue { id:string; title:string; artist:string; reason:string }
export interface PlaylistProgress {
  jobId:string; processed:number; total:number; playable:number; added:number
  unavailable:number; complete:boolean; playlist?:PlaylistMix; issues:PlaylistIssue[]
}
