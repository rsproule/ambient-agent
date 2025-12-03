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
 * Tool for generating images using Google's Gemini model
 *
 * Allows the agent to create images from text prompts using either:
 * - "fast" mode (nano-banano): Quick generation for simple requests
 * - "pro" mode (nano-banano pro): Higher quality for complex/detailed images
 *
 * Uploads generated images to Vercel Blob storage and returns the URL.
 */
export const createImageTool = tool({
  description:
    "Generate an image from a text prompt using AI. " +
    "Use this to create visual content based on descriptions. " +
    "Choose 'fast' mode for quick simple images, or 'pro' mode for complex detailed artwork. " +
    "Returns the generated image URL and metadata.",
  inputSchema: zodSchema(
    z.object({
      prompt: z
        .string()
        .describe("The text prompt describing the image to generate"),
      quality: z
        .enum(["fast", "pro"])
        .default("fast")
        .describe(
          "Image generation quality: 'fast' for quick simple images (default), 'pro' for complex detailed artwork requiring higher quality",
        ),
    }),
  ),
  execute: async ({ prompt, quality = "fast" }) => {
    const modelName = IMAGE_MODELS[quality as ImageQuality];
    console.log(
      `[createImage] Generating image with ${quality} mode (${modelName}) for prompt:`,
      prompt,
    );

    try {
      // Echo currently doesnt support pro models
      // const apiKey = process.env.ECHO_API_KEY;

      const google = createGoogleGenerativeAI({
        // baseURL: "https://echo.router.merit.systems",
        // apiKey,
      });

      const result = await generateText({
        model: google(modelName),
        prompt,
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
      return {
        success: true,
        url: blob.url,
        mediaType: firstImage.mediaType,
        quality,
        message: `Image generated with ${quality} mode and uploaded successfully (${firstImage.mediaType}). Use this URL in the 'attachments' array: ${blob.url}`,
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
