import { minioClient, BUCKETS } from "./minio";

async function setup() {
  console.log("🪣 Setting up MinIO buckets for build-service...\n");

  const buckets = [BUCKETS.SOURCE_CODE, BUCKETS.STATIC_BUILDS, BUCKETS.BUILD_LOGS];

  for (const bucket of buckets) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket);
        console.log(`✅ Created bucket: ${bucket}`);
      } else {
        console.log(`ℹ️  Bucket "${bucket}" already exists`);
      }
    } catch (err: any) {
      console.error(`❌ Error with bucket "${bucket}": ${err.message}`);
    }
  }

  // Set public read policy for static-builds bucket
  try {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKETS.STATIC_BUILDS}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(BUCKETS.STATIC_BUILDS, JSON.stringify(policy));
    console.log(`\n✅ Set public read policy for ${BUCKETS.STATIC_BUILDS} bucket`);
  } catch (err: any) {
    console.error(`❌ Error setting bucket policy: ${err.message}`);
  }

  console.log("\n🎉 Build service setup complete!");
  console.log("\nBuckets:");
  console.log(`  • ${BUCKETS.SOURCE_CODE}    - Stores cloned repository files`);
  console.log(`  • ${BUCKETS.STATIC_BUILDS}  - Stores built static files (public read)`);
  console.log(`  • ${BUCKETS.BUILD_LOGS}     - Stores build logs (private)`);
}

setup()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
