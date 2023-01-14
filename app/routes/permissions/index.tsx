import { Link, useLoaderData } from '@remix-run/react'
import { Permission, User, UserStatus } from '@prisma/client'
import { json, redirect } from '@remix-run/node'

import { FixedSizeList as List } from 'react-window'
import type { LoaderFunction } from '@remix-run/node'
import UserList from '~/components/user-list'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'

type LoaderData = {
  users: Awaited<ReturnType<typeof prisma.user.findMany>>
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_USERS]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const users = await prisma.user.findMany()

  return json<LoaderData>({ users })
}

export default function UsersRoute() {
  const { users } = useLoaderData() as unknown as LoaderData

  return <UserList users={users} />
}
