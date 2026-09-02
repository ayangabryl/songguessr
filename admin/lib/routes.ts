export type AdminPage = 'dashboard' | 'catalog' | 'artists' | 'catalogs' | 'add' | 'settings'

export function artistIdFromPath(pathname: string): string | null {
  const path = pathname.replace(/^\/admin\/?/, '/') || '/'
  const match = path.match(/^\/artists\/([^/]+)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function pathForArtist(id: string): string {
  return `/artists/${encodeURIComponent(id)}`
}

export function pushAdminPath(path: string): void {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function pageFromPath(pathname: string): AdminPage {
  const path = pathname.replace(/^\/admin\/?/, '/') || '/'
  if (path.startsWith('/catalogs')) return 'catalogs'
  if (path.startsWith('/catalog')) return 'catalog'
  if (path.startsWith('/artists')) return 'artists'
  if (path.startsWith('/add')) return 'add'
  if (path.startsWith('/settings')) return 'settings'
  return 'dashboard'
}

export function pathForPage(page: AdminPage): string {
  switch (page) {
    case 'dashboard':
      return '/'
    case 'catalog':
      return '/catalog'
    case 'artists':
      return '/artists'
    case 'catalogs':
      return '/catalogs'
    case 'add':
      return '/add'
    case 'settings':
      return '/settings'
    default: {
      const never: never = page
      return never
    }
  }
}

export function titleForPage(page: AdminPage): string {
  switch (page) {
    case 'dashboard':
      return 'Dashboard'
    case 'catalog':
      return 'Catalog'
    case 'artists':
      return 'Artists'
    case 'catalogs':
      return 'Catalogs'
    case 'add':
      return 'Add songs'
    case 'settings':
      return 'Settings'
    default: {
      const never: never = page
      return never
    }
  }
}
