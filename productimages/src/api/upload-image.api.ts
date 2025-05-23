import { createApiRoot } from '../client/create.client';
import { logger } from '../utils/logger.utils';

type ImageData = {
  binaryData: Buffer;
  filename: string;
  variantId: number;
  extension: string;
};

export const uploadImage = async (productId: string, image: ImageData) => {
  const supportedImageExtension = ['jpeg', 'png', 'gif'];
  const extension = image.extension;

  try {
    // if (!supportedImageExtension.includes(extension)) {
    //   throw new Error(`Image extension ${extension} not supported by commercetools`);
    // }
    return await createApiRoot()
      .products()
      .withId({
        ID: productId,
      })
      .images()
      .post({
        body: image.binaryData,
        queryArgs: {
          filename: image.filename,
          staged: false,
          variant: image.variantId,
        },
        headers: {
          'Content-Type': `image/${supportedImageExtension.includes(extension) ? extension : 'jpeg'}`, // image/jpeg , image/png, image/gif
        },
      })
      .execute();
  } catch (error) {
    logger.error(error);
    throw new Error('Something went wrong while image upload');
  }
};
