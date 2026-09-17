/* Topic hierarchies. Used as embedded fallback by index.html and as the
   source for scripts/seed.cjs which pushes them to Supabase. */

const AGENTCORE = {
  name: "AWS AgentCore",
  desc: "Amazon Bedrock AgentCore: managed services to deploy and operate AI agents securely at scale, with any framework and any model.",
  children: [
    { name: "Runtime", desc: "Serverless, secure hosting for agents built with any framework.",
      children: [
        { name: "Serverless hosting", desc: "Deploy agent code without managing servers or clusters. Package the agent, AgentCore provisions and scales it." },
        { name: "Session isolation", desc: "Each user session runs in its own dedicated microVM, so state and data never leak across sessions." },
        { name: "Long-running sessions", desc: "Sessions can run up to 8 hours, supporting asynchronous and multi-step agent workloads." },
        { name: "Any framework", desc: "Works with LangGraph, CrewAI, Strands Agents, or fully custom code. No SDK lock-in." },
        { name: "Protocols and streaming", desc: "Exposes HTTP and MCP endpoints and streams partial responses back to callers." }
      ]},
    { name: "Gateway", desc: "Turns existing APIs and Lambda functions into agent-ready MCP tools.",
      children: [
        { name: "Tool targets", desc: "Sources that Gateway converts into tools.",
          children: [
            { name: "Lambda functions", desc: "Wrap existing AWS Lambda functions as MCP tools with no code changes." },
            { name: "OpenAPI specs", desc: "Point Gateway at an OpenAPI definition and every operation becomes a callable tool." },
            { name: "Smithy models", desc: "AWS Smithy service models can also be registered as tool targets." }
          ]},
        { name: "Managed MCP server", desc: "Gateway exposes one managed MCP endpoint that agents connect to for all registered tools." },
        { name: "Semantic tool search", desc: "Agents can search across thousands of tools semantically and pull in only the relevant ones, keeping context small." },
        { name: "Auth passthrough", desc: "Integrates with AgentCore Identity so each tool call carries the right credentials." }
      ]},
    { name: "Memory", desc: "Managed short-term and long-term memory so agents remember context.",
      children: [
        { name: "Short-term memory", desc: "Raw event storage per session: turns, tool calls, and checkpoints available for the active conversation." },
        { name: "Long-term memory", desc: "Extracted knowledge that persists across sessions.",
          children: [
            { name: "Semantic strategy", desc: "Extracts durable facts from conversations and stores them as retrievable memories." },
            { name: "Summarization strategy", desc: "Maintains rolling summaries of sessions so agents can resume with compact context." },
            { name: "User preference strategy", desc: "Learns per-user preferences (tone, formats, choices) and applies them in later sessions." },
            { name: "Namespaces", desc: "Scopes memories per actor, session, or application so retrieval stays tenant-safe." }
          ]}
      ]},
    { name: "Identity", desc: "Secure identity and access for agents acting on behalf of users.",
      children: [
        { name: "Inbound auth", desc: "Controls who may invoke the agent: IAM SigV4 or OAuth JWT bearer tokens validated at the door." },
        { name: "Outbound auth", desc: "How the agent authenticates to downstream services.",
          children: [
            { name: "OAuth 2.0 flows", desc: "Supports 2-legged (machine) and 3-legged (user consent) OAuth so agents act with delegated permissions." },
            { name: "API keys", desc: "Stores provider API keys and injects them into tool calls without exposing them to the model." }
          ]},
        { name: "Token vault", desc: "Encrypted storage for tokens and secrets, with automatic refresh handling." },
        { name: "Credential providers", desc: "Prebuilt connectors for Google, GitHub, Slack, Salesforce, Atlassian, and custom OAuth providers." }
      ]},
    { name: "Built-in Tools", desc: "Managed tools agents can use out of the box.",
      children: [
        { name: "Code Interpreter", desc: "Sandboxed code execution for analysis and computation.",
          children: [
            { name: "Sandboxed execution", desc: "Runs Python, JavaScript, or TypeScript in an isolated sandbox with no network by default." },
            { name: "Session file I/O", desc: "Upload data files, run code against them, and read generated artifacts back within the session." }
          ]},
        { name: "Browser", desc: "A managed cloud browser for web tasks.",
          children: [
            { name: "Cloud browser sessions", desc: "Fast, isolated headless browser sessions managed by AWS, no fleet to run." },
            { name: "CDP and Playwright", desc: "Automate via Chrome DevTools Protocol or Playwright from the agent." },
            { name: "Live view and replay", desc: "Watch a live view of what the agent does in the browser and replay sessions for audit." }
          ]}
      ]},
    { name: "Observability", desc: "Tracing, metrics, and debugging for agents in production.",
      children: [
        { name: "CloudWatch GenAI dashboards", desc: "Prebuilt dashboards for agent health: invocations, latency, token usage, and error rates." },
        { name: "OTEL traces and spans", desc: "OpenTelemetry-compatible traces covering each step: model calls, tool calls, memory reads." },
        { name: "Trajectory inspection", desc: "Step through an agent session end to end to debug why it took a given path." },
        { name: "Alerts and metrics", desc: "Standard CloudWatch metrics and alarms on top of agent telemetry." }
      ]}
  ]
};

const MCP = {
  name: "Model Context Protocol",
  desc: "MCP: the open standard that connects AI agents to tools and data. Example second topic; any hierarchy can live here.",
  children: [
    { name: "Architecture", desc: "How hosts, clients, and servers fit together.",
      children: [
        { name: "Host", desc: "The AI application (IDE, chat app, agent runtime) that embeds one or more MCP clients." },
        { name: "Client", desc: "Maintains a 1:1 connection with a server and relays requests for the host." },
        { name: "Server", desc: "Exposes tools, resources, and prompts over the protocol. One server per integration." }
      ]},
    { name: "Primitives", desc: "What a server can offer.",
      children: [
        { name: "Tools", desc: "Model-invoked functions with JSON Schema inputs; the agent decides when to call them." },
        { name: "Resources", desc: "Application-controlled data (files, records) the host can read into context." },
        { name: "Prompts", desc: "User-invoked templates that servers expose for common workflows." }
      ]},
    { name: "Transports", desc: "How messages move.",
      children: [
        { name: "stdio", desc: "Local servers spawned as subprocesses; JSON-RPC over stdin/stdout." },
        { name: "Streamable HTTP", desc: "Remote servers over HTTP with streaming responses; supports auth via OAuth." }
      ]}
  ]
};

const TOPICS = [AGENTCORE, MCP];

if (typeof module !== "undefined") module.exports = TOPICS;
if (typeof window !== "undefined") window.TOPICS = TOPICS;
