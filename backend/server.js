
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
const replySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  tone: z.enum(["casual", "professional", "friendly"]).default("casual"),
  language: z.enum(["English", "Hinglish"]).default("Hinglish"),
});

const chatSampleSchema = z.object({
  context: z.string().trim().max(1000).optional().default(""),

  incoming_message: z.string()
    .trim()
    .min(1, "Incoming message cannot be empty")
    .max(2000),

  my_reply: z.string()
    .trim()
    .min(1, "Your reply cannot be empty")
    .max(2000),

  tone: z.enum([
    "casual",
    "professional",
    "friendly",
  ]).default("casual"),

  language: z.enum([
    "English",
    "Hinglish",
  ]).default("Hinglish"),
});

const sampleBatchSchema = z.object({
  samples: z.array(chatSampleSchema).min(1).max(100),
});

function normalizeText(value) {
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function preprocessSamples(samples) {
  const uniqueSamples = [];
  const seen = new Set();
  let duplicatesRemoved = 0;

  for (const sample of samples) {
    const cleaned = {
      context: normalizeText(sample.context),
      incoming_message: normalizeText(sample.incoming_message),
      my_reply: normalizeText(sample.my_reply),
      tone: sample.tone,
      language: sample.language,
    };

    const duplicateKey = JSON.stringify([
      cleaned.incoming_message.toLowerCase(),
      cleaned.my_reply.toLowerCase(),
    ]);

    if (seen.has(duplicateKey)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(duplicateKey);
    uniqueSamples.push(cleaned);
  }

  return {
    samples: uniqueSamples,
    duplicatesRemoved,
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ReplyTwin API",
  });
});


app.post("/api/reply", async (req, res) => {
  const parsed = replySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Please provide a valid message, tone and language.",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OpenAI API key is not configured.",
    });
  }

  const { message, tone, language } = parsed.data;

  try {
    // STEP 1: Generate embedding for incoming message
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // STEP 2: Retrieve similar past conversations
    const { data: matches, error: searchError } =
      await supabase.rpc("match_chat_samples", {
        query_embedding: queryEmbedding,
        match_count: 3,
      });

    if (searchError) {
      throw searchError;
    }

    // STEP 3: Prepare retrieved examples
    const examples = (matches || []).map((sample, index) => `
      Example ${index + 1}:
      Previous incoming message: ${sample.incoming_message}
      My previous reply: ${sample.my_reply}
      Context: ${sample.context || "Not provided"}
      Previous tone: ${sample.tone}
      Previous language: ${sample.language}
    `).join("\n");

    // STEP 4: Generate personalized reply
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-luna",

      instructions: `
        You are ReplyTwin, a personal AI communication assistant.

        Your task is to draft a reply in the user's communication style.

        USER PREFERENCES:
        Tone: ${tone}
        Language: ${language}

        PREVIOUS CONVERSATION EXAMPLES:
        ${examples || "No previous examples found."}

        IMPORTANT RULES:
        1. Study the user's writing style from the examples.
        2. Match their natural wording, sentence length and communication style.
        3. Use the requested tone and language.
        4. Use previous replies as style references, not as facts for the new conversation.
        5. Answer the current incoming message, not an old message.
        6. Read the entire incoming message and address every question, request,
           offer and alternative it contains. Do not reply only to its first
           sentence or clause; combine the responses naturally in one message.
        7. When the sender offers an alternative (for example, sharing a
           preferred time or arranging a call), acknowledge that offer too.
        8. Never invent facts, availability, commitments or actions. If a detail
           is unknown, respond naturally without making one up.
        9. Return only the suggested reply.
        10. Never send a message on the user's behalf.
      `,

      input: message,
    });

    return res.json({
      success: true,
      reply: response.output_text,
      tone,
      language,
      retrievedExamples: matches?.length || 0,
      personalized: (matches?.length || 0) > 0,
    });

  } catch (error) {
    console.error("Personalized reply generation failed:", error.message);

    return res.status(502).json({
      success: false,
      error: "Could not generate a personalized reply. Please try again.",
    });
  }
});


app.post("/api/samples/preview", (req, res) => {
  const parsed = sampleBatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid chat sample data.",
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const result = preprocessSamples(parsed.data.samples);

  return res.json({
    success: true,
    message: "Chat samples validated and preprocessed.",
    totalReceived: parsed.data.samples.length,
    totalValid: result.samples.length,
    duplicatesRemoved: result.duplicatesRemoved,
    samples: result.samples,
  });
});

app.post("/api/samples/ingest", async (req, res) => {
  const parsed = sampleBatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid chat sample data.",
      details: parsed.error.issues,
    });
  }

  try {
    // 1. Clean and remove duplicate samples
    const result = preprocessSamples(parsed.data.samples);

    const samples = result.samples;

    if (samples.length === 0) {
      return res.status(400).json({
        error: "No valid unique samples found.",
      });
    }

    // 2. Create embedding input for each sample
    const embeddingInputs = samples.map((sample) =>
      [
        `Context: ${sample.context}`,
        `Incoming message: ${sample.incoming_message}`,
      ].join("\n")
    );

    // 3. Generate embeddings
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingInputs,
    });

    // 4. Combine samples with their vectors
    const rows = samples.map((sample, index) => ({
      ...sample,
      embedding: embeddingResponse.data[index].embedding,
    }));

    // 5. Store samples in Supabase
    const { data, error } = await supabase
      .from("chat_samples")
      .insert(rows)
      .select("id");

    if (error) {
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Chat samples embedded and stored successfully.",
      totalReceived: parsed.data.samples.length,
      totalProcessed: samples.length,
      duplicatesRemoved: result.duplicatesRemoved,
      totalStored: data.length,
    });

  } catch (error) {
    console.error("Sample ingestion failed:", error.message);

    return res.status(500).json({
      error: "Unable to ingest chat samples.",
    });
  }
});

app.post("/api/samples/search", async (req, res) => {
  try {
    const message = z.string().trim().min(1).max(2000).parse(
      req.body.message
    );

    // Step 1: Convert incoming message into an embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Search similar conversations in Supabase
    const { data, error } = await supabase.rpc(
      "match_chat_samples",
      {
        query_embedding: queryEmbedding,
        match_count: 3,
      }
    );

    if (error) {
      throw error;
    }

    // Step 3: Return matching samples
    res.json({
      success: true,
      message: "Similar chat samples retrieved successfully.",
      totalFound: data.length,
      matches: data,
    });
  } catch (error) {
    console.error("Semantic search error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to search chat samples.",
      error: error.message,
    });
  }
});


app.listen(PORT, () => {
  console.log(`ReplyTwin API running at http://localhost:${PORT}`);
});
