import * as dotenv from "dotenv";
dotenv.config();

import { myQApi, myQDeviceInterface } from "@hjdhjd/myq";
import { client } from "./twilio";

type State = myQDeviceInterface["state"];
type DoorState = State["door_state"];

interface MessageResponse {
  statusCode: number;
  body: string;
}

const username = process.env.MY_Q_EMAIL as string;
const password = process.env.MY_Q_PASSWORD as string;

const from = process.env.TWILIO_FROM_NUMBER;
const to = process.env.TWILIO_TO_NUMBER;

const fetchGarageDoorState = async (): Promise<State> => {
    try {
      const myQ = new myQApi(username, password);
      await myQ.refreshDevices();
      const devicesInfo = myQ.devices;

      const garageDoor: Readonly<myQDeviceInterface> | undefined =
        devicesInfo.find((v) => v.device_platform === "myq");

      return garageDoor?.state as State;
      // Commenting this out for now:
      // const openGarage = myQ.execute(garageDoor as Readonly<myQDeviceInterface>, 'close');
    } catch (error) {
      return error;
    }
  };

const getDate = (date: Date): string => {
  const messageDate = new Date(date);
  const todayDate = new Date(); // Check if messageDate is less than 24 hours ago

  const timeDiff = todayDate.getTime() - messageDate.getTime();
  const diffInDays = timeDiff / (1000 * 60 * 60 * 24);
  if (diffInDays < 1) {
    // Format time in AM/PM format
    const hours = Number(
      messageDate.toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      })
    );
    const minutes = messageDate.getMinutes().toString().padStart(2, "0");
    const amPm = hours >= 12 ? "pm" : "am";
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes} ${amPm}`;
  } else {
    // Format date in month/day/year format
    const month = messageDate.getMonth() + 1;
    const day = messageDate.getDate();
    const year = messageDate.getFullYear();
    return `${month}/${day}/${year}`;
  }
};

const createBodyMessage = (garageDoorState: State): MessageResponse => {
  const lastUpdate = new Date(garageDoorState?.last_update as string);
  const timeAgo = getDate(lastUpdate);


  if (garageDoorState && garageDoorState?.door_state.toLowerCase() == "closed") {
    return { statusCode: 200, body: '' };
  }

  return { statusCode: 200, body: `\nCurrent garage state: ${garageDoorState?.door_state}\nLast time updated: ${timeAgo}` };
}

export const getBodyMessage = async (): Promise<MessageResponse> => {
  try {
    const response = await fetchGarageDoorState();
    const message = createBodyMessage(response);

    return message;
  }
  catch(error) {
      return {
        statusCode: 500,
        body: `\nThe following error has occurred: ${error.message}`,
      };
    };
};

export const sendMessage = async (): Promise<MessageResponse> => {
  const messageResponse = await getBodyMessage();

  if (messageResponse?.body.length > 0) {
    await client.messages.create({
      body: messageResponse?.body,
      from: from,
      to: to,
    });
  }
  return messageResponse;
};
