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
 * Image generation/editing tool using Google's Gemini model
 *
 * - Generate new images from text prompts
 * - Edit existing images by providing an imageUrl + edit prompt
 *
 * Claude can see images in the conversation, so it knows which URL
 * to pass when the user wants to edit a specific image.
 */
export const createImageTool = tool({
  description:
    "Generate or edit images using AI. " +
    "For NEW images: provide just a prompt. " +
    "For EDITING an existing image: YOU MUST provide imageUrl (copy the exact URL from an image in the conversation) plus a prompt describing the edit. " +
    "IMPORTANT: If the user wants to modify/edit/change an existing image, you MUST pass that image's URL in imageUrl. " +
    "Choose 'fast' for quick images, 'pro' for complex detailed artwork.",
  inputSchema: zodSchema(
    z.object({
      prompt: z
        .string()
        .describe(
          "Text prompt - either describing the new image to generate, or the edit to apply to an existing image",
        ),
      imageUrl: z
        .string()
        .url()
        .optional()
        .describe(
          "REQUIRED when editing: Copy the exact URL of the image you want to edit from the conversation. If user wants to modify an existing image, you MUST provide this.",
        ),
      quality: z
        .enum(["fast", "pro"])
        .default("fast")
        .describe(
          "'fast' for quick simple images (default), 'pro' for complex detailed artwork",
        ),
    }),
  ),
  execute: async ({ prompt, imageUrl, quality = "fast" }) => {
    const modelName = IMAGE_MODELS[quality as ImageQuality];
    const isEditing = !!imageUrl;

    console.log(
      `[createImage] ${
        isEditing ? "Editing" : "Generating"
      } image with ${quality} mode (${modelName})`,
      isEditing ? `\n  Source: ${imageUrl}` : "",
      `\n  Prompt: ${prompt}`,
    );

    try {
      const google = createGoogleGenerativeAI({
        // Echo currently doesn't support pro models
        // baseURL: "https://echo.router.merit.systems",
        // apiKey: process.env.ECHO_API_KEY,
      });

      // Build messages - include source image if editing
      const messages = isEditing
        ? [
            {
              role: "user" as const,
              content: [
                { type: "image" as const, image: new URL(imageUrl) },
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

      const action = isEditing ? "edited" : "generated";
      return {
        success: true,
        url: blob.url,
        mediaType: firstImage.mediaType,
        quality,
        wasEdit: isEditing,
        message: `Image ${action} successfully. Use this URL in attachments: ${blob.url}`,
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
