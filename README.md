This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Overview

This project provides a unified event pipeline for processing webhooks from multiple messaging platforms using Trigger.dev for asynchronous message handling.

### Webhook Endpoints

- **LoopMessage** (iMessage) - `/api/loopmessage`
- **SendBlue** (iMessage via SMS) - `/api/sendblue`
- **Discord** - `/api/discord` (coming soon)
- **Telegram** - `/api/telegram` (coming soon)

### Architecture

1. **Next.js Routes** - Receive and validate webhooks, normalize payloads
2. **Trigger.dev** - Queue and process events asynchronously
3. **Echo Handlers** - Send messages back to the sender/group

Each webhook endpoint normalizes incoming events into a unified schema and forwards them to Trigger.dev for processing. The handler task echoes messages back to the sender.

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

# SendBlue Configuration
SENDBLUE_API_KEY=your_sendblue_api_key_here
SENDBLUE_API_SECRET=your_sendblue_api_secret_here
SENDBLUE_NUMBER=your_sendblue_phone_number_here
SENDBLUE_WEBHOOK_SECRET=your_sendblue_webhook_secret_here  # Optional but recommended
```

## SendBlue Webhook Setup

The SendBlue integration listens for all webhook event types:

- **receive** - Inbound messages (echoed back to sender)
- **outbound** - Outbound message status updates
- **call_log** - Call log events
- **line_blocked** - Line blocked events
- **line_assigned** - Line assigned events
- **contact_created** - Contact created events

To configure SendBlue webhooks, use the SendBlue API:

```bash
curl -X POST https://api.sendblue.co/api/v2/account/webhooks \
  -H "sb-api-key-id: YOUR_API_KEY" \
  -H "sb-api-secret-key: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "webhooks": {
      "receive": ["https://your-domain.com/api/sendblue"],
      "outbound": ["https://your-domain.com/api/sendblue"],
      "call_log": ["https://your-domain.com/api/sendblue"],
      "line_blocked": ["https://your-domain.com/api/sendblue"],
      "line_assigned": ["https://your-domain.com/api/sendblue"],
      "contact_created": ["https://your-domain.com/api/sendblue"],
      "globalSecret": "your_webhook_secret_here"
    }
  }'
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
