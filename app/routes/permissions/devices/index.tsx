import { ActionFunction, json, redirect } from '@remix-run/node'

import DeviceList from '~/components/device-list'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

type LoaderData = {
  devices: Awaited<ReturnType<typeof prisma.device.findMany>>
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_DEVICES]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const devices = await prisma.device.findMany({
    orderBy: {
      name: 'asc',
    },
  })

  return json<LoaderData>({ devices })
}

export const action: ActionFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_DEVICES]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const data = await request.formData()
  const id = data.get('id') as string

  await prisma.device.delete({
    where: {
      id,
    },
  })

  return null
}

export default function UserList() {
  const { devices } = useLoaderData() as unknown as LoaderData

  return <DeviceList devices={devices} />
}
