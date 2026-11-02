
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
// Multiple WhatsApp screenshot upload configuration
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 10,
    fileSize: 5 * 1024 * 1024, // 5 MB per image
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG and WEBP images are allowed."));
    }
  },
});

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
const extractedMessageSchema = z.object({
  text: z.string(),
  sender: z.enum(["me", "other", "unknown"]),
  confidence: z.enum(["high", "medium", "low"]),
});

const extractionSchema = z.object({
  messages: z.array(extractedMessageSchema),
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

app.post(
  "/api/samples/extract-images",
  upload.array("screenshots", 10),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          success: false,
          error: "OpenAI API key is not configured.",
        });
      }

      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Please upload at least one screenshot.",
        });
      }

      // Convert uploaded images into Base64 data URLs
      const imageInputs = files.map((file) => ({
        type: "input_image",
        image_url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        detail: "high",
      }));

      // Ask Vision AI to extract WhatsApp messages
      const response = await openai.responses.create({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",

        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `
You are a WhatsApp chat extraction assistant.

Extract all visible conversation messages from the supplied screenshots.

Rules:
1. Preserve the original message text and conversation order.
2. Identify messages from the screenshot owner as "me".
3. Identify messages from the other participant as "other".
4. If sender identity is unclear, use "unknown".
5. Never guess missing or unreadable text.
6. Do not include timestamps as messages.
7. Do not invent any conversation.
8. Assign confidence:
   - high: sender and text are clearly readable.
   - medium: some uncertainty exists.
   - low: text or sender is difficult to identify.
9. Return valid JSON only, using this structure:

{
  "messages": [
    {
      "text": "Hello",
      "sender": "other",
      "confidence": "high"
    }
  ]
}
                `,
              },
              ...imageInputs,
            ],
          },
        ],
      });

      // Convert AI response into a JavaScript object
      const extractedText = response.output_text;
      const extractedJSON = JSON.parse(extractedText);

      // Validate AI-generated data
      const parsed = extractionSchema.safeParse(extractedJSON);

      if (!parsed.success) {
        throw new Error("AI returned an invalid message structure.");
      }

      const messages = parsed.data.messages;

      // Pair incoming messages with the following reply
      const samples = [];
      const uncertainMessages = [];

      for (let i = 0; i < messages.length; i++) {
        const incoming = messages[i];
        const reply = messages[i + 1];

        if (incoming.confidence !== "high") {
          uncertainMessages.push(incoming);
        }

        if (
          incoming.sender === "other" &&
          reply?.sender === "me" &&
          incoming.confidence === "high" &&
          reply.confidence === "high"
        ) {
          samples.push({
            context: "Extracted from WhatsApp screenshots",
            incoming_message: incoming.text,
            my_reply: reply.text,
            tone: "casual",
            language: "Hinglish",
          });

          i++;
        }
      }

      return res.json({
        success: true,
        message: "WhatsApp screenshots processed successfully.",
        totalImages: files.length,
        totalMessages: messages.length,
        totalSamples: samples.length,
        samples,
        extractedMessages: messages,
        uncertainMessages,
      });

    } catch (error) {
      console.error("WhatsApp image extraction failed:", error.message);

      return res.status(502).json({
        success: false,
        error: "Unable to extract WhatsApp messages. Please try again.",
      });
    }
  }
);


app.listen(PORT, () => {
  console.log(`ReplyTwin API running at http://localhost:${PORT}`);
});
