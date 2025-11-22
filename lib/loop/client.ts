import type {
  MessageEffect,
  MessageReaction,
  SendMessageParams,
} from "loopmessage-sdk";
import { LoopMessageService } from "loopmessage-sdk";

/**
 * LoopMessage Client Configuration
 */
export interface LoopClientConfig {
  loopAuthKey: string;
  loopSecretKey: string;
  senderName: string;
  logLevel?: "debug" | "info" | "warn" | "error" | "none";
}

/**
 * Simplified LoopMessage Client
 * Wraps the official SDK with proper types and error handling
 */
export class LoopClient {
  private service: LoopMessageService;
  private config: LoopClientConfig;

  constructor(config: LoopClientConfig) {
    this.config = config;
    this.service = new LoopMessageService({
      loopAuthKey: config.loopAuthKey,
      loopSecretKey: config.loopSecretKey,
      senderName: config.senderName,
      logLevel: config.logLevel || "info",
    });
  }

  /**
   * Send a message to a recipient or group
   */
  async sendMessage(params: {
    recipient?: string;
    group?: string;
    text: string;
    attachments?: string[];
    subject?: string;
    effect?: MessageEffect;
    reply_to_id?: string;
  }) {
    const messageParams: Omit<SendMessageParams, "sender_name"> = {
      recipient: params.recipient,
      group: params.group,
      text: params.text,
      attachments: params.attachments,
      subject: params.subject,
      effect: params.effect as MessageEffect,
      reply_to_id: params.reply_to_id,
    };

    return await this.service.sendLoopMessage(messageParams);
  }

  /**
   * Send an audio message
   */
  async sendAudioMessage(params: {
    recipient?: string;
    group?: string;
    text: string;
    media_url: string;
  }) {
    return await this.service.sendAudioMessage({
      recipient: params.recipient,
      group: params.group,
      text: params.text,
      media_url: params.media_url,
    });
  }

  /**
   * Send a reaction to a message
   */
  async sendReaction(params: {
    recipient?: string;
    group?: string;
    message_id: string;
    reaction: MessageReaction;
  }) {
    return await this.service.sendLoopMessage({
      recipient: params.recipient,
      group: params.group,
      text: "",
      message_id: params.message_id,
      reaction: params.reaction as MessageReaction,
    });
  }

  /**
   * Send a message with a visual effect
   */
  async sendMessageWithEffect(params: {
    recipient?: string;
    group?: string;
    text: string;
    effect: MessageEffect;
  }) {
    return await this.service.sendMessageWithEffect({
      recipient: params.recipient,
      group: params.group,
      text: params.text,
      effect: params.effect as MessageEffect,
    });
  }
}
