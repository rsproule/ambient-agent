import { perplexity } from "@ai-sdk/perplexity";
import { generateText, tool, UIToolInvocation, zodSchema } from "ai";
import { z } from "zod";

export const webSearchPerplexityTool = tool({
  description:
    "Search the web using Perplexity Sonar for real-time information. " +
    "Returns text, sources, and metadata. " +
    "Set searchImages=true when looking for images.",
  inputSchema: zodSchema(
    z.object({
      query: z.string().min(1).describe("The search query"),
      searchImages: z
        .boolean()
        .default(false)
        .describe(
          "Set to true when looking for images. Returns real image URLs in providerMetadata.",
        ),
    }),
  ),
  execute: async ({ query, searchImages = false }) => {
    const result = await generateText({
      model: perplexity("sonar"),
      prompt: query,
      providerOptions: {
        perplexity: {
          return_images: searchImages,
        },
      },
    });

    return result;
  },
});

export type WebSearchToolInvocation = UIToolInvocation<
  typeof webSearchPerplexityTool
>;
