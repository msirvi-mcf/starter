import { ProductRemoveImageAction } from '@commercetools/platform-sdk';
import { createApiRoot } from '../client/create.client';
import { logger } from '../utils/logger.utils';

export const removeImages = async (
  removeImagesUpdateActions: ProductRemoveImageAction[],
  productId: string,
  version: number
) => {
  try {
    return await createApiRoot()
      .products()
      .withId({
        ID: productId,
      })
      .post({
        body: {
          version: version,
          actions: removeImagesUpdateActions,
        },
      })
      .execute();
  } catch (error) {
    logger.error(error);
  }
};
