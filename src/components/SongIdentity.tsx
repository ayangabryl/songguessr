interface SongIdentityProps {
  title: string
  artist: string
}

/** Shared answer hierarchy for solo and table rounds. */
export function SongIdentity({ title, artist }: SongIdentityProps) {
  return (
    <div className="song-identity">
      <h2>{title}</h2>
      <p>{artist}</p>
    </div>
  )
}
