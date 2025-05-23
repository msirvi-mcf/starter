import { Request, Response } from 'express';
import CustomError from '../errors/custom.error';
import { logger } from '../utils/logger.utils';
import {
  buildProductImageContext,
  getImageSyncDiff,
} from '../utils/image.utils';
import { readConfiguration } from '../utils/config.utils';
import { downloadImage } from '../api/download-image';
import { uploadImage } from '../api/upload-image.api';
import { ProductRemoveImageAction } from '@commercetools/platform-sdk';
import { removeImages } from '../api/remove-images';

type TrackedImage = {
  url: string;
  filename: string;
  extension: string;
  variantId: number;
  productId: string;
};
/**
 * Exposed event POST endpoint.
 * Receives the Pub/Sub message and works with it
 *
 * @param {Request} request The express request
 * @param {Response} response The express response
 * @returns
 */
export const post = async (request: Request, response: Response) => {
  // Check request body
  if (!request.body) {
    logger.error('Missing request body.');
    throw new CustomError(400, 'Bad request: No Pub/Sub message was received');
  }

  // Check if the body comes in a message
  if (!request.body.message) {
    logger.error('Missing body message');
    throw new CustomError(400, 'Bad request: Wrong No Pub/Sub message format');
  }

  // Receive the Pub/Sub message #production payload
  const pubSubMessage = request.body.message;
  const decodedData = pubSubMessage.data
    ? Buffer.from(pubSubMessage.data, 'base64').toString().trim()
    : undefined;
  // const decodedData = request.body;
  let result: any = {};
  try {
    if (decodedData) {
      // const jsonData = decodedData; // bypassing for local testing
      const jsonData = JSON.parse(decodedData);
      logger.info('Decoded Event JsonData --'), JSON.stringify(jsonData);

      const { productProjection } = jsonData;

      const imageAttributes = readConfiguration().imageAttributes;

      if (imageAttributes) {
        const imageData = buildProductImageContext(
          productProjection,
          imageAttributes
        );
        const imagesToDownload: TrackedImage[] = [];
        const imagesToRemoveUpdateActions: ProductRemoveImageAction[] = [];

        for (const variant of imageData.variants) {
          const imageDiff = getImageSyncDiff(variant);

          logger.info(
            `Variant ${variant.variantId} needs image push:`,
            imageDiff.missingAttributeImageUrls
          );
          logger.info(
            `Variant ${variant.variantId} needs image removal:`,
            imageDiff.unmatchedImagesUrls
          );

          for (const imgData of imageDiff.missingAttributeImageUrls) {
            imagesToDownload.push({
              url: imgData.url,
              filename: imgData.filename,
              extension: imgData.extension,
              variantId: variant.variantId,
              productId: productProjection.id,
            });
          }

          for (const imgData of imageDiff.unmatchedImagesUrls) {
            imagesToRemoveUpdateActions.push({
              action: 'removeImage',
              imageUrl: imgData.url,
              variantId: variant.variantId,
              staged: false,
            });
          }
        }

        const downloadedImages = await Promise.all(
          imagesToDownload.map(
            async ({ url, variantId, productId, filename, extension }) => {
              const buffer = await downloadImage(url); // returns Buffer
              return {
                url,
                buffer,
                variantId,
                productId,
                filename,
                extension,
              };
            }
          )
        );

        // remove old images from ct cdn

        const removeImagesResult = await removeImages(
          imagesToRemoveUpdateActions,
          productProjection.id,
          productProjection.version
        );
        logger.info('trying removing old images ', imagesToRemoveUpdateActions);
        result['image removals'] = removeImagesResult?.statusCode
          ? 'success'
          : 'failed';

        const uploadImagesResults = await Promise.allSettled(
          downloadedImages.map(async (image) =>
            uploadImage(image.productId, {
              binaryData: image.buffer,
              filename: image.filename,
              variantId: image.variantId,
              extension: image.extension,
            })
          )
        );

        // Log or handle failures
        const successfulUploads = uploadImagesResults
          .filter((r) => r.status === 'fulfilled')
          .map((_, index) => ({
            variantId: downloadedImages[index]?.variantId,
            filename: downloadedImages[index]?.url,
          }));

        const failedUploads = uploadImagesResults
          .map((r, i) => ({ result: r, index: i }))
          .filter(({ result }) => result.status === 'rejected')
          .map(({ result, index }) => ({
            error: (result as PromiseRejectedResult).reason,
            variantId: downloadedImages[index]?.variantId,
            filename: downloadedImages[index]?.url,
          }));

        result['succesfull uploads'] = successfulUploads;
        result['failed uploads'] = failedUploads;
        logger.info('result: ', result);
      }
    } else {
      throw new CustomError(
        400,
        'Bad Request: No message in the Pub/Sub message'
      );
    }
  } catch (error) {
    logger.error(error);
    throw new CustomError(500, 'Something went wrong');
  }


  response.status(200).send(result);
};
