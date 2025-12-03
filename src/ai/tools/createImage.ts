import type { ConversationContext } from "@/src/db/conversation";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { put } from "@vercel/blob";
import { generateText, tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Convert base64 data URL to Buffer
 */
function base64ToBuffer(base64DataUrl: string): Buffer {
  // Check if it's already just base64 without the data URL prefix
  if (!base64DataUrl.includes(",")) {
    return Buffer.from(base64DataUrl, "base64");
  }

  // Remove the data URL prefix (e.g., "data:image/png;base64,")
  const base64Data = base64DataUrl.split(",")[1];

  if (!base64Data) {
    throw new Error("Failed to extract base64 data from data URL");
  }

  return Buffer.from(base64Data, "base64");
}

// Model configurations for image generation
const IMAGE_MODELS = {
  fast: "gemini-2.5-flash-image-preview", // nano-banano: Quick generation for simple requests
  pro: "gemini-3-pro-image-preview", // nano-banano pro: Higher quality for complex/detailed images
} as const;

type ImageQuality = keyof typeof IMAGE_MODELS;

/**
 * Create context-bound createImage tool
 *
 * This tool can generate new images OR edit existing images from the conversation.
 * When editing, it uses the recentAttachments from the conversation context
 * so the agent doesn't need to hallucinate URLs.
 *
 * Modes:
 * - "fast" (nano-banano): Quick generation for simple requests
 * - "pro" (nano-banano pro): Higher quality for complex/detailed images
 */
export function createImageTool(context: ConversationContext) {
  const attachments = context.recentAttachments || [];
  const hasAttachments = attachments.length > 0;

  // Build description dynamically based on available attachments
  const attachmentInfo = hasAttachments
    ? `\n\nAVAILABLE IMAGES (use attachmentIndex to edit, 0 = most recent):\n${attachments
        .map((url, i) => `  ${i}: ${url}`)
        .join("\n")}`
    : "\n\nNo image attachments available in this conversation yet.";

  return tool({
    description:
      "Generate or edit images using AI. " +
      "For NEW images: provide just a prompt describing what to create. " +
      "For EDITING: set attachmentIndex to select which image (0 = most recent), plus a prompt describing the edit. " +
      "Images include both user-sent attachments AND images you previously generated. " +
      "Choose 'fast' mode for quick simple images, or 'pro' mode for complex detailed artwork. " +
      "Returns the generated/edited image URL." +
      attachmentInfo,
    inputSchema: zodSchema(
      z.object({
        prompt: z
          .string()
          .describe(
            "The text prompt - either describing the image to generate, or the edit to apply to an existing image",
          ),
        attachmentIndex: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Index of the attachment to edit (0 = most recent image the user sent). Only use this when editing an existing image from the conversation.",
          ),
        quality: z
          .enum(["fast", "pro"])
          .default("fast")
          .describe(
            "Image generation quality: 'fast' for quick simple images (default), 'pro' for complex detailed artwork requiring higher quality",
          ),
      }),
    ),
    execute: async ({ prompt, attachmentIndex, quality = "fast" }) => {
      const modelName = IMAGE_MODELS[quality as ImageQuality];

      // Resolve attachment URL if editing
      let imageUrl: string | undefined;
      if (attachmentIndex !== undefined) {
        if (attachments.length === 0) {
          return {
            success: false,
            message:
              "No image attachments available in this conversation. Cannot edit without a source image.",
          };
        }
        if (attachmentIndex >= attachments.length) {
          return {
            success: false,
            message: `Invalid attachment index ${attachmentIndex}. Only ${
              attachments.length
            } attachment(s) available (indices 0-${attachments.length - 1}).`,
          };
        }
        imageUrl = attachments[attachmentIndex];
      }

      const isEditing = !!imageUrl;
      console.log(
        `[createImage] ${
          isEditing ? "Editing" : "Generating"
        } image with ${quality} mode (${modelName})`,
        isEditing ? `\n  Source: ${imageUrl}` : "",
        `\n  Prompt: ${prompt}`,
      );

      try {
        // Echo currently doesnt support pro models
        // const apiKey = process.env.ECHO_API_KEY;

        const google = createGoogleGenerativeAI({
          // baseURL: "https://echo.router.merit.systems",
          // apiKey,
        });

        // Build messages based on whether we're editing or generating
        const messages = isEditing
          ? [
              {
                role: "user" as const,
                content: [
                  { type: "image" as const, image: new URL(imageUrl!) },
                  { type: "text" as const, text: prompt },
                ],
              },
            ]
          : [
              {
                role: "user" as const,
                content: prompt,
              },
            ];

        const result = await generateText({
          model: google(modelName),
          messages,
        });

        // Filter to only image files
        const imageFiles = result.files?.filter((file) =>
          file.mediaType.startsWith("image/"),
        );

        if (!imageFiles || imageFiles.length === 0) {
          return {
            success: false,
            message: "No images were generated",
          };
        }

        const firstImage = imageFiles[0];

        if (!firstImage.base64) {
          return {
            success: false,
            message: "Image was generated but no base64 data was returned",
          };
        }

        // Convert base64 to buffer for upload
        const imageBuffer = base64ToBuffer(firstImage.base64);

        // Upload to Vercel Blob
        const filename = `generated-image-${Date.now()}.png`;
        const blob = await put(filename, imageBuffer, {
          access: "public",
          contentType: firstImage.mediaType,
        });

        console.log("[createImage] Image uploaded successfully:", blob.url);

        // Return the blob URL which can be used directly in attachments
        const action = isEditing ? "edited" : "generated";
        return {
          success: true,
          url: blob.url,
          mediaType: firstImage.mediaType,
          quality,
          wasEdit: isEditing,
          message: `Image ${action} with ${quality} mode and uploaded successfully (${firstImage.mediaType}). Use this URL in the 'attachments' array: ${blob.url}`,
        };
      } catch (error) {
        console.error("[createImage] Error:", error);
        return {
          success: false,
          message: `Failed to generate image: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}
