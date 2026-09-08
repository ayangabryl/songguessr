import { poolTierCaseSql } from './difficulty.ts'

// Stable IDs split equally scored songs across tiers. Without the tiebreak,
// an imported pool with missing metrics has rank zero everywhere (all Impossible).
export function poolTieredCte(filterSql: string): string {
  return `WITH pool AS (
      SELECT
        tracks.*,
        CASE WHEN play_count IS NOT NULL AND play_count > 0 THEN 1 ELSE 0 END AS has_plays,
        CASE WHEN popularity IS NOT NULL THEN 1 ELSE 0 END AS has_pop,
        CASE
          WHEN play_count IS NOT NULL AND play_count > 0 AND release_year IS NOT NULL THEN 1
          ELSE 0
        END AS has_vel,
        CASE WHEN artist_popularity IS NOT NULL THEN 1 ELSE 0 END AS has_artist,
        CASE
          WHEN play_count IS NOT NULL AND play_count > 0 AND release_year IS NOT NULL
          THEN play_count * 1.0 / MAX(1, CAST(strftime('%Y', 'now') AS INTEGER) - release_year + 1)
        END AS velocity
      FROM tracks
      WHERE 1 = 1${filterSql}
    ),
    ranked AS (
      SELECT
        pool.*,
        CASE
          WHEN has_plays = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_plays ORDER BY play_count ASC)
        END AS play_pct,
        CASE
          WHEN has_pop = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_pop ORDER BY popularity ASC)
        END AS pop_pct,
        CASE
          WHEN has_vel = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_vel ORDER BY velocity ASC)
        END AS vel_pct,
        CASE
          WHEN has_artist = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_artist ORDER BY artist_popularity ASC)
        END AS artist_pct,
        COUNT(*) OVER () AS pool_n
      FROM pool
    ),
    scored AS (
      SELECT
        ranked.*,
        CASE
          WHEN (has_plays * 0.65 + has_pop * 0.20 + has_vel * 0.10 + has_artist * 0.05) = 0
          THEN 0.5
          ELSE (
            COALESCE(play_pct, 0) * has_plays * 0.65
            + COALESCE(pop_pct, 0) * has_pop * 0.20
            + COALESCE(vel_pct, 0) * has_vel * 0.10
            + COALESCE(artist_pct, 0) * has_artist * 0.05
          ) / (has_plays * 0.65 + has_pop * 0.20 + has_vel * 0.10 + has_artist * 0.05)
        END
        + CASE WHEN COALESCE(chart_boost, 0) = 1 THEN 0.03 ELSE 0 END AS pool_score
      FROM ranked
    ),
    fame AS (
      SELECT
        scored.*,
        PERCENT_RANK() OVER (ORDER BY pool_score ASC, id ASC) AS fame_pct
      FROM scored
    ),
    tiered AS (
      SELECT fame.*, ${poolTierCaseSql()} AS pool_tier
      FROM fame
    )`
}

