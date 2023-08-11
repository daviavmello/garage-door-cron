const dotenv = require("dotenv");
dotenv.config();

const { myQApi } = require("@hjdhjd/myq");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

const username = process.env.MY_Q_EMAIL;
const password = process.env.MY_Q_PASSWORD;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const from = process.env.TWILIO_FROM_NUMBER;
const to = process.env.TWILIO_TO_NUMBER;

const fetchGarageDoorState = async () => {
  try {
    const myQ = new myQApi(username, password);
    await myQ.refreshDevices();
    const devicesInfo = myQ.devices;

    const garageDoor = devicesInfo.find((v) => v.device_platform === "myq");

    return garageDoor?.state;
  } catch (error) {
    return error;
  }
};

const getDate = (date) => {
  const messageDate = new Date(date);
  const todayDate = new Date();

  const timeDiff = todayDate.getTime() - messageDate.getTime();
  const diffInDays = timeDiff / (1000 * 60 * 60 * 24);
  if (diffInDays < 1) {
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
    const month = messageDate.getMonth() + 1;
    const day = messageDate.getDate();
    const year = messageDate.getFullYear();
    return `${month}/${day}/${year}`;
  }
};

const createBodyMessage = (garageDoorState) => {
  const lastUpdate = new Date(garageDoorState?.last_update);
  const timeAgo = getDate(lastUpdate);

  if (
    garageDoorState &&
    garageDoorState?.door_state.toLowerCase() == "closed"
  ) {
    return { statusCode: 200, body: "" };
  }

  return {
    statusCode: 200,
    body: `\nCurrent garage state: ${garageDoorState?.door_state}\nLast time updated: ${timeAgo}`,
  };
};

const getBodyMessage = async () => {
  try {
    const response = await fetchGarageDoorState();
    const message = createBodyMessage(response);

    return message;
  } catch (error) {
    return {
      statusCode: 500,
      body: `\nThe following error has occurred: ${error.message}`,
    };
  }
};

const sendMessage = async () => {
  const messageResponse = await getBodyMessage();

  if (messageResponse?.body.length > 0) {
    const twilio = require("twilio");
    const client = new twilio(accountSid, authToken);

    await client.messages.create({
      body: messageResponse?.body,
      from: from,
      to: to,
    });
  }
  return messageResponse;
};

const getGarageUpdates = async () => {
  const message = await sendMessage();
  const response = {
    statusCode: message?.statusCode,
    body: JSON.stringify(message?.body),
  };

  return response;
};

app.get("/garage-updates", async (req, res) => {
  try {
    const response = await getGarageUpdates();
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port);
