import { sendMessage } from './message-service';

exports.getGarageUpdates = async (event: any) => {
  const message = await sendMessage();
  const response = {
    statusCode: message?.statusCode,
    body: JSON.stringify(message?.body)
  }

  return response;
}