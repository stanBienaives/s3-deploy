# S3 Upload

This is a GitHub action for publishing preview builds to Amazon S3.

The action uploads a specified directory, recursively to an S3 bucket.

## Full Example

Before you can start using this action, you'll need to get your AWS credentials.
See [docs.aws.amazon.com][aws-credentials] for getting your credentials.

Say we've just built our fancy website on Actions into the `dist` directory. To
upload this build preview to S3, we'll use the following configuration.

```yaml
name: Workflow Test
on: push
jobs:
  main:
    name: Test Deploy Workflow
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v1
      - uses: actions/checkout@v2
      - name: Build Application
        run: ...
      - uses: vexelabs/s3-deploy@v1-rc3
        with:
          aws-key-id: ${{ secrets.AWS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-bucket: ${{ secrets.AWS_BUCKET }}
          aws-region: ${{ secrets.AWS_REGION }}
          aws-key-prefix: my-project
          directory: dist
          empty-bucket: true
```

This workflow would delete every single item in the bucket, upload every single
file inside `dist` on the runner, storing the files inside the `my-project` 
directory inside the S3 bucket.

## Inputs

| Name | Required | Description |
|------|----------|-------------|
| aws-key-id | required | The AWS access key to authenticate with |
| aws-secret-access-key | required | The secret access key associated with the aws-key-id |
| aws-bucket | required | Name of the S3 bucket to upload files to |
| aws-region | required | The region the S3 bucket is located in |
| aws-key-prefix | optional | A prefix to the S3 Key for each uploaded object |
| directory | required | The directory to upload to S3 |
| empty-bucket | required | Whether to get rid of all contents in the bucket before uploading. (neat for automatic deployment of api docs) |

## License

Apache 2.0

[aws-credentials]: https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-your-credentials.html