import type {
  ActionFunction,
  LoaderFunction,
  UploadHandler,
} from '@remix-run/node'
import { Form, Link, useLoaderData, useSearchParams } from '@remix-run/react'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'
import {
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  json,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'

import { ImageUploader } from '../../components/form/image_uploader'
import { Permission } from '@prisma/client'
import React from 'react'
import type { User } from '@prisma/client'
import { authenticatedUser } from '../../services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { s3UploadHandler } from '~/util/s3.server'

interface LoaderData {
  loggedInUser: User
  clientId: string
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const clientId = params.clientId

  if (!clientId)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  const client = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
  })

  if (!client)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  return json({ loggedInUser, clientId: client.id })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const clientId = params.clientId

  const uploadHandler: UploadHandler = composeUploadHandlers(
    s3UploadHandler,
    createMemoryUploadHandler()
  )

  const formData = await parseMultipartFormData(request, uploadHandler)
  const imageUrl = formData.get('imageUrl')

  if (!imageUrl) {
    return json({
      errorMsg: 'Something went wrong while uploading',
    })
  }

  await prisma.client.update({
    where: {
      id: clientId,
    },
    data: {
      imageUrl: imageUrl.toString(),
    },
  })

  return redirect(
    `/clients/${clientId}?${buildQueryStringFromRequest(request)}`
  )
}

const ClientUpload = () => {
  const { clientId } = useLoaderData<LoaderData>()

  const [searchParams] = useSearchParams()

  const [imageUrl, setImageUrl] = React.useState<string | undefined>(undefined)

  const handleImageSelection = (file: File) => {
    setImageUrl(URL.createObjectURL(file))
  }

  return (
    <Form method="post" encType="multipart/form-data">
      <div className="flex flex-col items-center max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center m-auto mt-12 rounded-lg cursor-pointer">
          <ImageUploader onChange={handleImageSelection} imageUrl={imageUrl} />
        </div>
        <div className="flex justify-between w-full px-12 mt-12">
          <button
            type="submit"
            disabled={!imageUrl}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border-t border-b border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-blue-500 dark:focus:text-white"
          >
            Save
          </button>
          <div className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border-t border-b border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-blue-500 dark:focus:text-white">
            <Link
              to={`/clients/${clientId}?${buildQueryStringFromSearchParams(
                searchParams
              )}`}
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* insert hidden inputs for search params */}
      {Object.entries(searchParams).map(([key, value]) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={value}
          readOnly
          aria-hidden
        />
      ))}
    </Form>
  )
}

export default ClientUpload
