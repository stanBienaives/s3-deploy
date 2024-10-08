import * as core from '@actions/core'
import * as aws from 'aws-sdk'
import * as mime from 'mime-types'
import * as fs from 'fs'
import glob from 'fast-glob'

const input = (k: string, required: boolean = true) => core.getInput(k, { required })

async function run() {
  const config = {
    accessKeyId: input('aws-key-id'),
    secretAccessKey: input('aws-secret-access-key'),
    bucket: input('aws-bucket'),
    region: input('aws-region'),
    awsKeyPrefix: input('aws-key-prefix', false) ?? '',
    directory: input('directory'),
    emptyBucketFirst: input('empty-bucket') === 'true',
    private: input('acl-private') ?? true,
  }

  const s3 = new aws.S3({
    credentials: { ...config },
    region: config.region,
    apiVersion: 'latest'
  })

  // User wants to empty the bucket
  if (config.emptyBucketFirst) {
    core.info('[s3-deploy] Emptying S3 Bucket')

    const getObjects = () => s3.listObjects({
          Bucket: config.bucket,
          Prefix: config.awsKeyPrefix
        }).promise()
    // Delete all objects until there are no more
    let objects = await getObjects()

    while ((objects.Contents?.length ?? 0) > 0) {
      core.info(`[s3-deploy] Deleted ${objects.Contents!.length} objects from S3 Bucket`)

      await s3.deleteObjects({
        Bucket: config.bucket,
        Delete: {
          Objects: objects.Contents!.map(({ Key }) => ({ Key: Key! }))
        }
      }).promise()

      objects = await getObjects()
    }
  }

  const files = await glob(`${config.directory}/**`, {
    followSymbolicLinks: false,
    onlyFiles: true
  })
  core.info(`[s3-deploy] Found ${files.length} files to upload..`)

  await Promise.all(
    files
      .map(async file => {
        // Strip a slash and the host directory from S3 Key
        //   $folder/path/to/file
        //   ^^^^^^^^
        let baseKeyLength = config.directory.length
        if (config.awsKeyPrefix === '') {
          // If we're in the root directory
          baseKeyLength++
        }
        const s3Key = `${config.awsKeyPrefix}${file}`

        core.info(`[s3-deploy] file: ${s3Key}`);

        // Try to get the mime type of the file, default to undefined if it
        // could not be resolved.
        let mimeType: string | undefined | false = mime.lookup(file)
        if (mimeType === false) {
          mimeType = undefined
        }

        const stream = fs.createReadStream(file)
        stream.on('error', (e) => {
          core.error(`Error using read stream (${file}): [${e.name}] ${e.message}`)
        })

        return await s3.upload({
          Bucket: config.bucket,
          Body: stream,
          ACL: config.private ? 'private' : 'public-read',
          Key: s3Key,
          ContentType: mimeType
        }).promise()
      })
  )
}

run().catch(e => {
  core.error(e)
  core.setFailed(e.message)
})