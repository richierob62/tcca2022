import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { Link, useActionData, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import Input from '~/components/form/input'
import { Permission } from '@prisma/client'
import React from 'react'
import type { User } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { authorized } from '~/util/cookies'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { v4 as uuidv4 } from 'uuid'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

interface LoaderData {
  loggedInUser: User
}

const schema = z.object({
  name: z.string().min(1, { message: 'A device name is required' }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.MANAGE_DEVICES]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json<LoaderData>({ loggedInUser })
}

export const action: ActionFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_DEVICES]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(
    schema.refine(
      async (data) => {
        const foundDevice = await prisma.device.findFirst({
          where: {
            name: data.name,
          },
        })
        return !foundDevice
      },
      {
        message: 'That name has already been used',
        path: ['name'],
      }
    )
  )

  const data = await serverValidator.validate(await request.formData())

  if (data.error) return validationError(data.error)

  const { name } = data.data

  const accessKey = uuidv4()

  await prisma.device.create({
    data: {
      name,
      accessKey,
      approvedBy: {
        connect: {
          id: loggedInUser.id,
        },
      },
    },
  })

  return redirect(
    `/permissions/devices?${buildQueryStringFromRequest(request)}`,
    {
      headers: {
        'Set-Cookie': await authorized.serialize({ accessKey }),
      },
    }
  )
}

const NewDevice = () => {
  const actionData = useActionData()

  const [searchParams] = useSearchParams()

  return (
    <ValidatedForm
      validator={clientValidator}
      method="post"
      defaultValues={{ name: '' }}
    >
      <div className="flex flex-col w-full max-w-xl p-4 mt-10 border border-gray-200 rounded-lg shadow-md bg-slate-300 sm:p-6 md:p-8">
        <div className="grow-down">
          <h3 className="mb-2 ">New Device...</h3>
          <h4 className="mb-6 text-sm italic">
            (This will register the device/computer you are currently on. To
            register a device, you must be on that device.)
          </h4>
        </div>

        <div className="flex w-full mt-20 space-x-12">
          <Input name={'name'} label={'Device Name'} />
        </div>

        <div className="mt-12 ml-auto space-x-6 rounded-md shadow-sm">
          <button
            type="submit"
            className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
          >
            <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Save
            </span>
          </button>

          <Link
            to={`/permissions/devices?${buildQueryStringFromSearchParams(
              searchParams
            )}`}
            className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-pink-500 to-orange-400 group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800"
          >
            <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Cancel
            </span>
          </Link>
        </div>
      </div>

      {queryStringOptions.map((option, idx) => {
        return (
          <input
            type="hidden"
            key={idx}
            name={option}
            value={searchParams.get(option) || undefined}
            readOnly
            aria-hidden
          />
        )
      })}
    </ValidatedForm>
  )
}

export default NewDevice
