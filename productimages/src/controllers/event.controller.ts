import { Request, Response } from 'express';
import { createApiRoot } from '../client/create.client';
import CustomError from '../errors/custom.error';
import { logger } from '../utils/logger.utils';


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

  // Receive the Pub/Sub message
  const pubSubMessage = request.body.message;
  const decodedData = pubSubMessage.data
    ? Buffer.from(pubSubMessage.data, 'base64').toString().trim()
    : undefined;

  if (decodedData) {
    const jsonData = JSON.parse(decodedData);
    logger.info('Decoded Event JsonData --'), JSON.stringify(jsonData);

    const { resource, resourceVersion} = jsonData;
    // need to validate the process.env.image_attributes in the masterVariant.attributes & variants.attributes and the value with image 
    const productResponse = await createApiRoot().productProjections().withId({
      ID: resource.id
    }).get().execute();
    const newResourceVersion = productResponse.body.version;
    logger.info(`old product version: ${resourceVersion}, new product version: ${newResourceVersion}`);
  } else {
    throw new CustomError(400, 'Bad Request: No message in the Pub/Sub message')
  }


  // Return the response for the client
  response.status(200).send();
};
