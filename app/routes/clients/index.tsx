import type { Client, Loan } from '@prisma/client'
import { json, redirect } from '@remix-run/node'

import ClientList from '~/components/client-list'
import ClientSearch from '../../components/client-search'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

export interface ExpandedClient extends Client {
  loans: Partial<Loan>[]
}

type LoaderData = {
  clients: ExpandedClient[]
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.CLIENT_VIEW]
  const loggedInUser = await authenticatedUser(request, permissions)

  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)
  const clientFilter = url.searchParams.get('clientFilter')
  const clientSortBy = url.searchParams.get('clientSortBy')

  const filter =
    clientFilter && clientFilter !== 'undefined' && clientFilter !== 'null'
      ? {
          OR: [
            {
              name: {
                contains: clientFilter,
                mode: 'insensitive',
              },
            },
            {
              clientNum: {
                contains: clientFilter,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}

  const order =
    clientSortBy && clientSortBy !== 'undefined' && clientSortBy !== 'null'
      ? {
          [clientSortBy]: 'asc',
        }
      : {
          name: 'asc',
        }

  const clients = await prisma.client.findMany({
    where: filter as any,
    orderBy: order as any,
    include: {
      loans: {
        select: {
          id: true,
          loanNum: true,
          status: true,
        },
        orderBy: {
          loanNum: 'desc',
        },
      },
    },
  })

  return json<LoaderData>({ clients })
}

export default function ClientsRoute() {
  const { clients } = useLoaderData() as unknown as LoaderData

  return (
    <div>
      <div className="max-w-lg mt-6 mb-6">
        <ClientSearch />
      </div>
      <ClientList clients={clients} />
    </div>
  )
}
