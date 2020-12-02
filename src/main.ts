import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as aws from 'aws-sdk'
import * as mime from 'mime-types'
import * as fs from 'fs'

const input = (k: string, required: boolean = true) => core.getInput(k, { required })

async function run() {
  const config = {
    accessKeyId: input('aws-key-id'),
    secretAccessKey: input('aws-secret-access-key'),
    bucket: input('aws-bucket'),
    region: input('aws-region'),
    awsKeyPrefix: input('aws-key-prefix', false) ?? '',
    directory: input('directory'),
    emptyBucketFirst: input('empty-bucket') === 'true'
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
      Bucket: config.bucket
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

  const globber = await glob.create(`${config.directory}/**/*.*`, {
    followSymbolicLinks: false
  })
  const files = await globber.glob()

  core.info(`[s3-deploy] Found ${files.length} files to upload..`)

  await Promise.all(
    files
      .filter(async file => {
        const stat = await fs.promises.stat(file)
        return stat.isFile()
      })
      .map(async file => {
        core.info(`[s3-deploy]   Preparing to upload ${file}`)
        // Strip the cwd, a slash and the host directory from S3 Key
        //   /home/runner/work/$folder
        //                    ^
        let cwdLength = process.cwd().length + config.directory.length + 1
        if (config.awsKeyPrefix === '') {
          // Strip the leading slash as well
          cwdLength++
        }
        const s3Key = `${config.awsKeyPrefix}${file.substr(cwdLength)}`

        // Try to get the mime type of the file, default to undefined if it
        // could not be resolved.
        let mimeType: string | undefined | false = mime.lookup(file)
        if (mimeType === false) {
          mimeType = undefined
        }

        await s3.upload({
          Bucket: config.bucket,
          Body: fs.createReadStream(file),
          ACL: 'public-read',
          Key: s3Key,
          ContentType: mimeType
        }).promise()

        core.info(`[s3-deploy]    Uploaded ${file}`)
        return true
      })
  )
}

run().catch(e => {
  core.error(e)
  core.setFailed(e.message)
})