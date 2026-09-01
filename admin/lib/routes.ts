export type AdminPage = 'dashboard' | 'catalog' | 'add' | 'settings'

export function pageFromPath(pathname: string): AdminPage {
  const path = pathname.replace(/^\/admin\/?/, '/') || '/'
  if (path.startsWith('/catalog')) return 'catalog'
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
