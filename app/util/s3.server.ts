import AWS from 'aws-sdk'
import { PassThrough } from 'stream'
import type { UploadHandler } from '@remix-run/node'
import { writeAsyncIterableToWritable } from '@remix-run/node'

const { TCCA_ACCESS_KEY, TCCA_SECRET_KEY, TCCA_REGION, TCCA_BUCKET_NAME } =
  process.env

if (!(TCCA_ACCESS_KEY && TCCA_SECRET_KEY && TCCA_REGION && TCCA_BUCKET_NAME)) {
  throw new Error(`Storage is missing required configuration.`)
}

const uploadStream = ({ Key }: Pick<AWS.S3.Types.PutObjectRequest, 'Key'>) => {
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: TCCA_ACCESS_KEY,
      secretAccessKey: TCCA_SECRET_KEY,
    },
    region: TCCA_REGION,
  })
  const pass = new PassThrough()
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket: TCCA_BUCKET_NAME, Key, Body: pass }).promise(),
  }
}

export async function uploadStreamToS3(data: any, filename: string) {
  const stream = uploadStream({
    Key: filename,
  })
  await writeAsyncIterableToWritable(data, stream.writeStream)
  const file = await stream.promise
  return file.Location
}

export const s3UploadHandler: UploadHandler = async ({
  name,
  filename,
  data,
}) => {
  if (name !== 'imageUrl') {
    return undefined
  }

  const newFilename = `${Date.now()}-${filename}`

  const uploadedFileLocation = await uploadStreamToS3(data, newFilename!)
  return uploadedFileLocation
}
