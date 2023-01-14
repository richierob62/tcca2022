import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useCatch,
  useLoaderData,
} from '@remix-run/react'

import Layout from '~/components/layout'
import type { LoaderFunction } from '@remix-run/node'
import { authenticatedUser } from './services/server_side/user_services.server'
import { json } from '@remix-run/node'
import styles from '~/styles/app.css'

export let links = () => {
  return [{ rel: 'stylesheet', href: styles }]
}

export const loader: LoaderFunction = async ({ request }) => {
  return json({
    user: await authenticatedUser(request),
  })
}

export default function App() {
  const { user } = useLoaderData()

  return (
    <Document title="TCCA2022">
      <Layout user={user}>
        <Outlet />
      </Layout>
    </Document>
  )
}

export function ErrorBoundary({ error }: any) {
  console.error(error)
  return (
    <Document title="Error!">
      <Layout>
        <div>
          <h1>There was an error</h1>
          <p>{error.message}</p>
          <hr />
          <p>
            Hey, developer, you should replace this with what you want your
            users to see.
          </p>
        </div>
      </Layout>
    </Document>
  )
}

export function CatchBoundary() {
  let caught = useCatch()
  let message
  switch (caught.status) {
    case 401:
      message = (
        <p>
          Oops! Looks like you tried to visit a page that you do not have access
          to.
        </p>
      )
      break
    case 404:
      message = (
        <p>Oops! Looks like you tried to visit a page that does not exist.</p>
      )
      break

    default:
      throw new Error(caught.data || caught.statusText)
  }

  return (
    <Document title={`${caught.status} ${caught.statusText}`}>
      <Layout>
        <h1>
          {caught.status}: {caught.statusText}
        </h1>
        {message}
      </Layout>
    </Document>
  )
}

function Document({ children, title }: any) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {title ? <title>{title}</title> : null}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}
