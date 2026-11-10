import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "./errors";

let client: S3Client | undefined;

function settings() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new AppError(503, "照片存储尚未配置。请联系站点管理员。");
  }
  return { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET };
}

function r2() {
  const config = settings();
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT || `https://${config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: Boolean(process.env.R2_ENDPOINT),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return { client, bucket: config.bucket };
}

export async function signedUpload(key: string) {
  const { client, bucket } = r2();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: photoTypeForKey(key) }), { expiresIn: 300 });
}

function photoTypeForKey(key: string) {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg")) return "image/jpeg";
  throw new AppError(400, "照片格式不符合要求。");
}

export async function signedPhoto(key: string) {
  const { client, bucket } = r2();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}

export async function checkPhoto(key: string) {
  const { client, bucket } = r2();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentType !== photoTypeForKey(key) || !head.ContentLength || head.ContentLength > 2_500_000) {
    throw new AppError(400, "照片格式或大小不符合要求，请重新上传。");
  }
  return head.ContentLength;
}

export async function removePhoto(key: string) {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function copyPhoto(fromKey: string, toKey: string) {
  const { client, bucket } = r2();
  await client.send(new CopyObjectCommand({
    Bucket: bucket, Key: toKey, CopySource: `${bucket}/${fromKey}`,
    ContentType: photoTypeForKey(toKey), MetadataDirective: "REPLACE",
  }));
}
