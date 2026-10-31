import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { ReviewError } from "./http";
function client() {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
    process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY)
    throw new ReviewError(
      503,
      "Le stockage photo n’est pas configuré. Vous pouvez publier un avis sans photo.",
    );
  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: process.env.S3_REGION || "eu-west-3",
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
}
export async function preparePhotos(files: File[]) {
  if (files.length > 3) throw new ReviewError(400, "Trois photos maximum.");
  const images: Buffer[] = [];
  for (const f of files) {
    if (
      f.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(f.type)
    )
      throw new ReviewError(
        400,
        "Photos JPEG, PNG ou WebP, 5 Mo maximum chacune.",
      );
    try {
      const raw = Buffer.from(await f.arrayBuffer());
      const image = sharp(raw, { limitInputPixels: 20000000, animated: false });
      const info = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(info.format || ""))
        throw new Error("format");
      images.push(
        await image
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer(),
      );
    } catch {
      throw new ReviewError(400, "Une photo est invalide ou trop grande.");
    }
  }
  return images;
}
export async function storePhoto(body: Buffer) {
  const s3 = client();
  const key = `reviews/${crypto.randomUUID()}.jpg`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
    }),
  );
  return key;
}
export async function removePhoto(key: string) {
  await client().send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
export async function readPhoto(key: string) {
  return client().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
