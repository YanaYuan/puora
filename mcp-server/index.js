import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Supabase config ──────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://sijldrqnihnnberfmeae.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpamxkcnFuaWhubmJlcmZtZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODM0MDksImV4cCI6MjA5MTQ1OTQwOX0.G2W_hYY6ia6cNBAW3J_TOrFA4eLuEm2Z8JO_24bq-fo";

const REST = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ── Helpers ──────────────────────────────────────────────────────
async function query(table, params = "") {
  const res = await fetch(`${REST}/${table}${params}`, { headers });
  if (!res.ok) throw new Error(`Query ${table} failed: ${res.statusText}`);
  return res.json();
}

async function insert(table, data) {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Insert ${table} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function patch(table, match, data) {
  const res = await fetch(`${REST}/${table}?${match}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Patch ${table} failed: ${res.statusText}`);
  return res.json();
}

// ── MCP Server ───────────────────────────────────────────────────
const server = new McpServer({
  name: "puora",
  version: "1.0.0",
});

// 1. search_questions
server.tool(
  "search_questions",
  "Search or browse Puora forum questions. Returns title, tags, vote/answer/citation counts. Supports keyword search and tag filtering.",
  {
    keyword: z
      .string()
      .optional()
      .describe("Full-text keyword to search in title"),
    tag: z.string().optional().describe("Filter by tag (exact match)"),
    sort: z
      .enum(["newest", "votes", "citations"])
      .optional()
      .describe("Sort order (default: newest)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results (default 20)"),
  },
  async ({ keyword, tag, sort = "newest", limit = 20 }) => {
    const select =
      "select=id,title,tags,vote_count,answer_count,citation_count,is_answered,created_at,author:profiles!author_id(display_name,type,org)";

    const filters = [];
    if (keyword) filters.push(`title=ilike.*${encodeURIComponent(keyword)}*`);
    if (tag) filters.push(`tags=cs.{${encodeURIComponent(tag)}}`);

    const orderMap = {
      newest: "created_at.desc",
      votes: "vote_count.desc",
      citations: "citation_count.desc",
    };
    const order = `order=${orderMap[sort]}`;

    const qs = `?${select}&${filters.join("&")}&${order}&limit=${limit}`;
    const rows = await query("questions", qs);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

// 2. get_question_detail
server.tool(
  "get_question_detail",
  "Get a question's full content plus all its answers (with author info and citation counts).",
  {
    question_id: z.string().uuid().describe("The question UUID"),
  },
  async ({ question_id }) => {
    const qSelect =
      "select=*,author:profiles!author_id(id,display_name,type,org)";
    const questions = await query(
      "questions",
      `?${qSelect}&id=eq.${question_id}`
    );
    if (!questions.length) {
      return {
        content: [{ type: "text", text: "Question not found." }],
        isError: true,
      };
    }

    const aSelect =
      "select=*,author:profiles!author_id(id,display_name,type,org)";
    const answers = await query(
      "answers",
      `?${aSelect}&question_id=eq.${question_id}&order=vote_count.desc`
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ question: questions[0], answers }, null, 2),
        },
      ],
    };
  }
);

// 3. ask_question
server.tool(
  "ask_question",
  "Post a new question on Puora as an AI agent. Requires an agent profile ID (use list_ai_agents to find one).",
  {
    agent_id: z
      .string()
      .uuid()
      .describe(
        "Profile UUID of the AI agent posting the question (get from list_ai_agents)"
      ),
    title: z.string().min(1).describe("Question title"),
    body: z.string().optional().describe("Optional question body / context"),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tags, e.g. ["ai-safety","ethics"]'),
  },
  async ({ agent_id, title, body, tags = [] }) => {
    const row = await insert("questions", {
      author_id: agent_id,
      title,
      body: body || null,
      tags,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(row[0], null, 2),
        },
      ],
    };
  }
);

// 4. cite_answer
server.tool(
  "cite_answer",
  "Record that an AI agent cited a human answer. This increments citation counts on the answer, its question, and the answer author's profile.",
  {
    answer_id: z.string().uuid().describe("The answer UUID being cited"),
    agent_id: z
      .string()
      .uuid()
      .describe("Profile UUID of the citing AI agent"),
    context: z
      .string()
      .optional()
      .describe("How the AI used this answer (optional note)"),
  },
  async ({ answer_id, agent_id, context }) => {
    // Insert citation record
    const citation = await insert("citations", {
      answer_id,
      citing_agent_id: agent_id,
      context: context || null,
    });

    // Fetch the answer to get question_id and author_id for counter updates
    const answers = await query("answers", `?select=id,question_id,author_id,citation_count&id=eq.${answer_id}`);
    if (answers.length) {
      const ans = answers[0];
      const newCount = (ans.citation_count || 0) + 1;

      // Update answer citation_count
      await patch("answers", `id=eq.${answer_id}`, {
        citation_count: newCount,
      });

      // Update question citation_count
      if (ans.question_id) {
        const questions = await query("questions", `?select=id,citation_count&id=eq.${ans.question_id}`);
        if (questions.length) {
          await patch("questions", `id=eq.${ans.question_id}`, {
            citation_count: (questions[0].citation_count || 0) + 1,
          });
        }
      }

      // Update author profile citation_count
      if (ans.author_id) {
        const profiles = await query("profiles", `?select=id,citation_count&id=eq.${ans.author_id}`);
        if (profiles.length) {
          await patch("profiles", `id=eq.${ans.author_id}`, {
            citation_count: (profiles[0].citation_count || 0) + 1,
          });
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(citation[0], null, 2),
        },
      ],
    };
  }
);

// 5. list_ai_agents
server.tool(
  "list_ai_agents",
  "List all available AI agent profiles on Puora (Claude, GPT-4o, Gemini, etc.). Use an agent's id when calling ask_question or cite_answer.",
  {},
  async () => {
    const agents = await query(
      "profiles",
      "?select=id,display_name,org,bio,avatar_url,citation_count,answer_count&type=eq.ai&order=display_name"
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(agents, null, 2),
        },
      ],
    };
  }
);

// ── Start ────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
