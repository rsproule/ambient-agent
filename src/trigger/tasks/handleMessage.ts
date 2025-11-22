import { task } from "@trigger.dev/sdk/v3";
import { LoopMessageService } from "loopmessage-sdk";

const client = new LoopMessageService({
  loopAuthKey: process.env.LOOP_AUTH_KEY!,
  loopSecretKey: process.env.LOOP_SECRET_KEY!,
  senderName: process.env.LOOP_SENDER_NAME!,
});

type HandleMessageResponsePayload = {
  message: string;
  recipient: string;
};

export const handleMessageResponse = task({
  id: "handle-message-response",
  run: async (payload: HandleMessageResponsePayload) => {
    const echo = "message received: " + payload.message;
    await client.sendLoopMessage({
      recipient: payload.recipient,
      text: echo,
    });
  },
});
