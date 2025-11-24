# Ambient Agent

Background Agent with iMessage push delivery.

## Overview

This project processes webhooks from LoopMessage (iMessage) using Trigger.dev for asynchronous message handling.

### Webhook Endpoints

- **LoopMessage** (iMessage) - `/api/loopmessage`
- **Post Message** - `/api/message`

### Architecture

1. **Next.js Routes** - Receive and validate webhooks using loopmessage-sdk types
2. **Trigger.dev** - Queue and process events asynchronously
3. **Echo Handler** - Sends messages back to the sender/group using LoopMessageService

The webhook endpoint receives LoopMessage webhooks and forwards them to Trigger.dev for processing. The handler task echoes messages back to the sender.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Trigger.dev Configuration
TRIGGER_PROJECT_ID=imessage-pipeline  # Optional, defaults to "imessage-pipeline"
TRIGGER_SECRET_KEY=your_trigger_secret_key_here
TRIGGER_API_URL=https://api.trigger.dev  # Optional

# LoopMessage (iMessage) Configuration
LOOP_AUTH_KEY=your_loop_auth_key_here
LOOP_SECRET_KEY=your_loop_secret_key_here
LOOP_SENDER_NAME=your_sender_name_here
LOOP_WEBHOOK_SECRET_KEY=your_loop_webhook_secret_here
```
