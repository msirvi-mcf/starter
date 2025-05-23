import axios from "axios";
import { logger } from "../utils/logger.utils";

export async function downloadImage(url:string) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer', 
    });

    const buffer = Buffer.from(response.data, 'binary');
    
    return buffer;
  } catch (error) {
    logger.error(error);
    throw new Error("Download Image failed");
  }
}