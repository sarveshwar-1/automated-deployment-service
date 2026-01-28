// MinIO client configuration for host-service
import * as Minio from 'minio';
import {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
} from './config/env';

export const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

export const BUCKETS = {
  SOURCE_CODE: 'source-code',
  STATIC_BUILDS: 'static-builds',
  BUILD_LOGS: 'build-logs',
};

export default minioClient;
