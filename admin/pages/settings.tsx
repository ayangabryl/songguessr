import { logout } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { LogOutIcon } from 'lucide-react'

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const handleLogout = async () => {
    await logout().catch(() => undefined)
    onLogout()
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Admin access is cookie-based on .songguessr.lol.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Password</FieldLabel>
              <FieldDescription>
                The admin password is set as the Worker <code>ADMIN_PASSWORD</code> secret. It is
                not shown here.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => void handleLogout()}>
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Game</CardTitle>
          <CardDescription>The public game stays on the apex domain.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" asChild>
            <a href="https://songguessr.lol" target="_blank" rel="noreferrer">
              Open songguessr.lol
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
