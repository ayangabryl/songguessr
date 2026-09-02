import { useCallback, useEffect, useState } from 'react'
import { AuthError, fetchStatus, type StatusResponse } from '@/api'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { pageFromPath, pathForPage, titleForPage, type AdminPage } from '@/lib/routes'
import { AddSongsPage } from '@/pages/add-songs'
import { ArtistsPage } from '@/pages/artists'
import { CatalogPage } from '@/pages/catalog'
import { CatalogsPage } from '@/pages/catalogs'
import { DashboardPage } from '@/pages/dashboard'
import { LoginPage } from '@/pages/login'
import { SettingsPage } from '@/pages/settings'
import {
  LayersIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListPlusIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

const NAV_ITEMS: { page: AdminPage; title: string; icon: typeof LayoutDashboardIcon }[] = [
  { page: 'dashboard', title: 'Dashboard', icon: LayoutDashboardIcon },
  { page: 'catalog', title: 'Catalog', icon: LibraryIcon },
  { page: 'artists', title: 'Artists', icon: UsersIcon },
  { page: 'catalogs', title: 'Catalogs', icon: LayersIcon },
  { page: 'add', title: 'Add songs', icon: ListPlusIcon },
  { page: 'settings', title: 'Settings', icon: SettingsIcon },
]

export function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [page, setPage] = useState<AdminPage>(() => pageFromPath(window.location.pathname))
  const [status, setStatus] = useState<StatusResponse | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const data = await fetchStatus()
      setStatus(data)
      setAuthed(true)
    } catch (err) {
      if (err instanceof AuthError) {
        setAuthed(false)
        return
      }
      setAuthed(false)
    }
  }, [])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!authed || page !== 'dashboard') return
    const interval = window.setInterval(() => {
      void fetchStatus().then(setStatus).catch(() => undefined)
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [authed, page])

  const navigate = (next: AdminPage) => {
    window.history.pushState({}, '', pathForPage(next))
    setPage(next)
  }

  const handleLogout = () => {
    setAuthed(false)
    setStatus(null)
  }

  if (authed === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="h-8 w-40" />
      </div>
    )
  }

  if (!authed) {
    return (
      <>
        <LoginPage onLogin={() => void checkAuth()} />
        <Toaster />
      </>
    )
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex flex-col gap-0.5 px-2 py-1">
              <span className="text-sm font-semibold">Songguessr</span>
              <span className="text-xs text-muted-foreground">Catalog admin</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Manage</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.page}>
                      <SidebarMenuButton
                        isActive={page === item.page}
                        onClick={() => navigate(item.page)}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>
            <p className="px-2 text-xs text-muted-foreground">
              {status ? `${status.tracks.toLocaleString()} tracks` : '—'}
            </p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-sm font-medium">{titleForPage(page)}</h1>
              <p className="text-xs text-muted-foreground">admin.songguessr.lol</p>
            </div>
          </header>
          <main className="flex-1 p-6">
            {page === 'dashboard' ? (
              <DashboardPage status={status} onStatusRefresh={() => void checkAuth()} />
            ) : null}
            {page === 'catalog' ? <CatalogPage /> : null}
            {page === 'artists' ? <ArtistsPage /> : null}
            {page === 'catalogs' ? <CatalogsPage /> : null}
            {page === 'add' ? <AddSongsPage /> : null}
            {page === 'settings' ? <SettingsPage onLogout={handleLogout} /> : null}
          </main>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  )
}
