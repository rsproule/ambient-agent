import { pipeline } from "@xenova/transformers";

let extractor: any = null;
let urgentVec: Float32Array | null = null;
let nonUrgentVec: Float32Array | null = null;

async function embed(text: string) {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const out = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return out.data as Float32Array;
}

function cosine(a: Float32Array, b: Float32Array) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function shouldRespond(prompt: string): Promise<boolean> {
  if (!urgentVec) {
    urgentVec = await embed("This message requires an immediate answer.");
    nonUrgentVec = await embed(
      "This message does not require a direct answer.",
    );
  }

  const v = await embed(prompt);
  const simUrgent = cosine(v, urgentVec);
  const simNon = cosine(v, nonUrgentVec);

  return simUrgent > simNon;
}
