

interface ImageInfo {
  url: string;
  filename: string;
  extension: string;
}

interface VariantImageData {
  variantId: number;
  source: 'masterVariant' | 'variant';
  images: ImageInfo[];
  attributeImages: (ImageInfo & { attributeName: string })[];
}

interface ProductImageContext {
  productId: string;
  variants: VariantImageData[];
}

interface ImageSyncDiff {
  variantId: number;
  missingAttributeImageUrls: ImageInfo[];
  unmatchedImagesUrls: ImageInfo[];
}

const extractImageMeta = (url: string, platform: 'mirakl' | 'commercetools') => {
  switch (platform) {
    case 'mirakl': {
      const fileName = url.split('/').pop() || '';
      const [name, ext] = fileName.split(/\.(?=[^\.]+$)/);
      return {
        filename: name, // full file name like Brake_Pad.jpg
        extension: ext || ''
      };
    }

    case 'commercetools': {
      const fileName = url.split('/').pop() || '';
      const match = fileName.match(/^(.*)-[A-Za-z0-9]{8}(\.[^.]+)$/);

      if (match) {
        return {
          filename: match[1] , // e.g., Brake_Pad.png
          extension: match[2].replace('.', '') // e.g., png
        };
      }

      const parts = fileName.split(/\.(?=[^\.]+$)/);
      return {
        filename: fileName,
        extension: parts[1] || ''
      };
    }

    default:
      throw new Error("Unknown image platform");
  }
};


const processVariant = (
  variant: any,
  source: 'masterVariant' | 'variant',
  imageAttributes: string[]
): VariantImageData => {
  const images: ImageInfo[] = [];
  const attributeImages: VariantImageData["attributeImages"] = [];

  variant.images?.forEach((img: any) => {
    const { filename, extension } = extractImageMeta(img.url, 'commercetools');
    images.push({
      url: img.url,
      filename,
      extension
    });
  });

  variant.attributes?.forEach((attr: any) => {
    if (imageAttributes.includes(attr.name) && typeof attr.value === 'string') {
      const { filename, extension } = extractImageMeta(attr.value, 'mirakl');
      attributeImages.push({
        url: attr.value,
        filename,
        extension,
        attributeName: attr.name,
      });
    }
  });

  return {
    variantId: variant.id,
    source,
    images,
    attributeImages
  };
};

export const buildProductImageContext = (productProjection: any, imageAttributes: string[]): ProductImageContext => {
  const variants: VariantImageData[] = [];

  // Process masterVariant
  variants.push(processVariant(productProjection.masterVariant, 'masterVariant', imageAttributes));

  // Process each variant
  productProjection.variants?.forEach((variant: any) => {
    variants.push(processVariant(variant, 'variant', imageAttributes));
  });

  return {
    productId: productProjection.id,
    variants
  };
};

export const getImageSyncDiff = (variant: VariantImageData): ImageSyncDiff => {
  const attributeSet = new Set(
    variant.attributeImages.map(attrImg => `${attrImg.filename}.${attrImg.extension}`)
  );

  const imageSet = new Set(
    variant.images.map(img => `${img.filename}.${img.extension}`)
  );

  const missingAttributeImageUrls = variant.attributeImages
    .filter(attrImg => {
      const key = `${attrImg.filename}.${attrImg.extension}`;
      return !imageSet.has(key);
    })
    .map(attrImg => attrImg);

  const unmatchedImagesUrls = variant.images
    .filter(img => {
      const key = `${img.filename}.${img.extension}`;
      return !attributeSet.has(key);
    })
    .map(img => img);

  return {
    variantId: variant.variantId,
    missingAttributeImageUrls,
    unmatchedImagesUrls
  };
};



