/* Topic hierarchies. Used as embedded fallback by index.html and as the
   source for scripts/seed.cjs which pushes them to Supabase.
   Node shape: { name, desc (one-liner on the tile), detail (what it is +
   how it's used), commands ([CLI/SDK snippets]), children }. */

const AGENTCORE = {
  name: "AWS AgentCore",
  desc: "Amazon Bedrock AgentCore: managed services to deploy and operate AI agents securely at scale, with any framework and any model.",
  detail: "AgentCore is a set of composable services (Runtime, Gateway, Memory, Identity, built-in tools, Observability) that handle the production plumbing around an agent so teams ship agent logic, not infrastructure. Each service is usable alone or together, works with any framework (LangGraph, CrewAI, Strands, custom) and any model (Bedrock or external).",
  commands: [
    "pip install bedrock-agentcore bedrock-agentcore-starter-toolkit",
    "agentcore configure --entrypoint agent.py --name myagent\nagentcore launch",
    "aws bedrock-agentcore-control help   # control plane (create/manage resources)\naws bedrock-agentcore help           # data plane (invoke, sessions, memory)"
  ],
  children: [
    { name: "Runtime", desc: "Serverless, secure hosting for agents built with any framework.",
      detail: "Runtime hosts your agent code as a serverless endpoint: you package the agent (container image or the starter toolkit builds one for you), AgentCore provisions, scales, and secures it. It is the deploy target for the whole platform; Gateway tools, Memory, and Identity all plug into agents hosted here.",
      commands: [
        "agentcore configure --entrypoint agent.py --name myagent",
        "agentcore launch          # builds + deploys to AgentCore Runtime",
        "agentcore invoke '{\"prompt\": \"What is AgentCore?\"}'"
      ],
      children: [
        { name: "Serverless hosting", desc: "Deploy agent code without managing servers or clusters. Package the agent, AgentCore provisions and scales it.",
          detail: "You bring agent code with an HTTP entrypoint; AgentCore builds it into a container (via CodeBuild when using the starter toolkit), stores it in ECR, and runs it behind a managed endpoint with auto scaling and pay-per-use. No EC2, EKS, or Lambda plumbing to own.",
          commands: [
            "from bedrock_agentcore.runtime import BedrockAgentCoreApp\napp = BedrockAgentCoreApp()\n\n@app.entrypoint\ndef handler(payload, context):\n    return {\"result\": my_agent(payload[\"prompt\"])}\n\napp.run()",
            "agentcore launch",
            "aws bedrock-agentcore-control create-agent-runtime \\\n  --agent-runtime-name myagent \\\n  --agent-runtime-artifact 'containerConfiguration={containerUri=<ecr-image-uri>}' \\\n  --network-configuration networkMode=PUBLIC \\\n  --role-arn <execution-role-arn>"
          ]},
        { name: "Session isolation", desc: "Each user session runs in its own dedicated microVM, so state and data never leak across sessions.",
          detail: "Every unique runtimeSessionId gets a dedicated microVM with isolated CPU, memory, and filesystem. The VM lives for the session and is destroyed afterwards, so one user's context, files, or secrets can never bleed into another user's session. You use it by passing a distinct session id per user conversation when invoking the agent.",
          commands: [
            "agentcore invoke '{\"prompt\": \"hi\"}' --session-id user-42-chat-001",
            "import boto3\nclient = boto3.client(\"bedrock-agentcore\")\nresp = client.invoke_agent_runtime(\n    agentRuntimeArn=RUNTIME_ARN,\n    runtimeSessionId=\"user-42-chat-001\",   # unique per conversation\n    payload=b'{\"prompt\": \"hi\"}')",
            "# same session id -> same microVM (state preserved)\n# new session id  -> fresh isolated microVM"
          ]},
        { name: "Long-running sessions", desc: "Sessions can run up to 8 hours, supporting asynchronous and multi-step agent workloads.",
          detail: "Runtime supports long interactive sessions and asynchronous background work up to 8 hours, far beyond typical serverless limits. The SDK exposes async task helpers so the agent can report itself busy while a background job runs, and the /ping health status tells the platform whether the session is HEALTHY or HEALTHY_BUSY.",
          commands: [
            "@app.async_task\ndef long_job(data):\n    ...            # runs in background, keeps session alive",
            "@app.ping\ndef status():\n    return \"HEALTHY_BUSY\" if job_running else \"HEALTHY\"",
            "aws bedrock-agentcore invoke-agent-runtime \\\n  --agent-runtime-arn <arn> --runtime-session-id job-7 \\\n  --payload '{\"action\": \"start-batch\"}' out.json"
          ]},
        { name: "Any framework", desc: "Works with LangGraph, CrewAI, Strands Agents, or fully custom code. No SDK lock-in.",
          detail: "Runtime only requires an HTTP contract (POST /invocations, GET /ping), so any Python/Node agent framework, or none, can be hosted. The starter toolkit wraps popular frameworks; the same agent code keeps working locally and in the cloud.",
          commands: [
            "# Strands example\nfrom strands import Agent\nfrom bedrock_agentcore.runtime import BedrockAgentCoreApp\napp = BedrockAgentCoreApp()\nagent = Agent()\n\n@app.entrypoint\ndef invoke(payload, context):\n    return agent(payload[\"prompt\"]).message",
            "# LangGraph / CrewAI: same pattern, call your graph/crew inside @app.entrypoint",
            "agentcore configure -e my_langgraph_agent.py && agentcore launch"
          ]},
        { name: "Protocols and streaming", desc: "Exposes HTTP and MCP endpoints and streams partial responses back to callers.",
          detail: "An agent is served over plain HTTP (POST /invocations) or as an MCP server (protocol MCP on create), so other agents and IDEs can call it as a tool. Streaming works by yielding chunks from the entrypoint; callers receive Server-Sent Events.",
          commands: [
            "@app.entrypoint\ndef handler(payload, context):\n    for chunk in llm.stream(payload[\"prompt\"]):\n        yield chunk          # -> SSE stream to caller",
            "curl -X POST http://localhost:8080/invocations \\\n  -H 'Content-Type: application/json' -d '{\"prompt\": \"hi\"}'   # local test",
            "aws bedrock-agentcore-control create-agent-runtime ... \\\n  --protocol-configuration serverProtocol=MCP    # host agent as MCP server"
          ]}
      ]},
    { name: "Gateway", desc: "Turns existing APIs and Lambda functions into agent-ready MCP tools.",
      detail: "Gateway converts existing enterprise assets (Lambda functions, REST APIs described by OpenAPI, Smithy models) into MCP tools without rewriting them, and serves them all from one managed MCP endpoint with auth handled by AgentCore Identity. Agents connect once and get every registered tool.",
      commands: [
        "aws bedrock-agentcore-control create-gateway \\\n  --name my-gateway --protocol-type MCP \\\n  --role-arn <role-arn> \\\n  --authorizer-type CUSTOM_JWT \\\n  --authorizer-configuration 'customJWTAuthorizer={discoveryUrl=<issuer>/.well-known/openid-configuration,allowedClients=[<client-id>]}'",
        "aws bedrock-agentcore-control list-gateways"
      ],
      children: [
        { name: "Tool targets", desc: "Sources that Gateway converts into tools.",
          detail: "A target tells Gateway what to wrap: point it at a Lambda ARN, an OpenAPI spec, or a Smithy model and each operation becomes a callable MCP tool. One gateway can front many targets.",
          commands: [
            "aws bedrock-agentcore-control list-gateway-targets --gateway-identifier <gw-id>"
          ],
          children: [
            { name: "Lambda functions", desc: "Wrap existing AWS Lambda functions as MCP tools with no code changes.",
              detail: "Register a Lambda ARN plus a tool schema (name, description, input JSON Schema); Gateway invokes the function when the agent calls the tool. Existing business logic becomes agent-usable without touching the function.",
              commands: [
                "aws bedrock-agentcore-control create-gateway-target \\\n  --gateway-identifier <gw-id> --name orders \\\n  --target-configuration '{\"mcp\":{\"lambda\":{\n    \"lambdaArn\":\"arn:aws:lambda:us-west-2:123:function:get-order\",\n    \"toolSchema\":{\"inlinePayload\":[{\"name\":\"get_order\",\n      \"description\":\"Fetch an order by id\",\n      \"inputSchema\":{\"type\":\"object\",\"properties\":{\"orderId\":{\"type\":\"string\"}},\"required\":[\"orderId\"]}}]}}}}' \\\n  --credential-provider-configurations '[{\"credentialProviderType\":\"GATEWAY_IAM_ROLE\"}]'"
              ]},
            { name: "OpenAPI specs", desc: "Point Gateway at an OpenAPI definition and every operation becomes a callable tool.",
              detail: "Give Gateway an OpenAPI 3 spec (inline or S3); each operation turns into an MCP tool with the request schema derived from the spec. Outbound calls authenticate via an Identity credential provider (API key or OAuth).",
              commands: [
                "aws bedrock-agentcore-control create-gateway-target \\\n  --gateway-identifier <gw-id> --name support-api \\\n  --target-configuration '{\"mcp\":{\"openApiSchema\":{\"s3\":{\"uri\":\"s3://my-bucket/support-api.yaml\"}}}}' \\\n  --credential-provider-configurations '[{\"credentialProviderType\":\"API_KEY\",\"credentialProvider\":{\"apiKeyCredentialProvider\":{\"providerArn\":\"<provider-arn>\",\"credentialLocation\":\"HEADER\",\"credentialParameterName\":\"x-api-key\"}}}]'"
              ]},
            { name: "Smithy models", desc: "AWS Smithy service models can also be registered as tool targets.",
              detail: "For AWS-style services modeled in Smithy, register the model and Gateway exposes its operations as tools, useful for first-party AWS service access through one MCP endpoint.",
              commands: [
                "aws bedrock-agentcore-control create-gateway-target \\\n  --gateway-identifier <gw-id> --name dynamodb-tools \\\n  --target-configuration '{\"mcp\":{\"smithyModel\":{\"s3\":{\"uri\":\"s3://my-bucket/service.smithy.json\"}}}}'"
              ]}
          ]},
        { name: "Managed MCP server", desc: "Gateway exposes one managed MCP endpoint that agents connect to for all registered tools.",
          detail: "After creation, the gateway has an MCP URL. Any MCP-capable client or framework connects with a bearer token, lists tools, and calls them; AWS runs, patches, and scales the server.",
          commands: [
            "# Gateway MCP URL shape\nhttps://<gateway-id>.gateway.bedrock-agentcore.<region>.amazonaws.com/mcp",
            "from mcp import ClientSession\nfrom mcp.client.streamable_http import streamablehttp_client\n\nasync with streamablehttp_client(GATEWAY_URL,\n        headers={\"Authorization\": f\"Bearer {token}\"}) as (r, w, _):\n    async with ClientSession(r, w) as s:\n        await s.initialize()\n        tools = await s.list_tools()"
          ]},
        { name: "Semantic tool search", desc: "Agents can search across thousands of tools semantically and pull in only the relevant ones, keeping context small.",
          detail: "With semantic search enabled, the gateway exposes a built-in search tool; instead of stuffing every tool definition into the model context, the agent queries in natural language and receives just the relevant tools. This keeps prompts small when a gateway fronts hundreds of APIs.",
          commands: [
            "aws bedrock-agentcore-control create-gateway ... \\\n  --protocol-configuration '{\"mcp\":{\"searchType\":\"SEMANTIC\"}}'",
            "# then from any MCP client\nresult = await session.call_tool(\n    \"x_amz_bedrock_agentcore_search\",\n    {\"query\": \"tools for refunding an order\"})"
          ]},
        { name: "Auth passthrough", desc: "Integrates with AgentCore Identity so each tool call carries the right credentials.",
          detail: "Inbound, the gateway validates the caller's JWT (or SigV4). Outbound, each target is linked to an Identity credential provider so calls to the real API carry the right API key or OAuth token, without the agent or model ever seeing the secret.",
          commands: [
            "aws bedrock-agentcore-control update-gateway --gateway-identifier <gw-id> \\\n  --authorizer-configuration 'customJWTAuthorizer={discoveryUrl=<cognito-issuer>/.well-known/openid-configuration,allowedClients=[<app-client-id>]}'",
            "# outbound: attach credential provider on the target (see OpenAPI specs example)"
          ]}
      ]},
    { name: "Memory", desc: "Managed short-term and long-term memory so agents remember context.",
      detail: "Memory is a managed store with two layers: raw short-term events per session, and long-term knowledge extracted from those events by configurable strategies. Agents write conversation turns as events and retrieve relevant memories on later turns or sessions, no vector database to run.",
      commands: [
        "aws bedrock-agentcore-control create-memory \\\n  --name agent_memory --event-expiry-duration P30D \\\n  --memory-strategies '[{\"semanticMemoryStrategy\":{\"name\":\"facts\",\"namespaces\":[\"/facts/{actorId}\"]}}]'",
        "pip install bedrock-agentcore\nfrom bedrock_agentcore.memory import MemoryClient\nclient = MemoryClient(region_name=\"us-west-2\")"
      ],
      children: [
        { name: "Short-term memory", desc: "Raw event storage per session: turns, tool calls, and checkpoints available for the active conversation.",
          detail: "Every user/assistant turn (and tool call) is stored as an event under (memoryId, actorId, sessionId). The agent reloads the recent turns when a session resumes, which gives durable conversation history without managing a database.",
          commands: [
            "client.create_event(\n    memory_id=MEM_ID, actor_id=\"user-42\", session_id=\"chat-001\",\n    messages=[(\"Hi, I prefer window seats\", \"USER\"),\n              (\"Noted!\", \"ASSISTANT\")])",
            "turns = client.get_last_k_turns(\n    memory_id=MEM_ID, actor_id=\"user-42\", session_id=\"chat-001\", k=5)",
            "aws bedrock-agentcore list-events --memory-id <mem-id> \\\n  --actor-id user-42 --session-id chat-001"
          ]},
        { name: "Long-term memory", desc: "Extracted knowledge that persists across sessions.",
          detail: "Asynchronous strategies process short-term events and write durable records (facts, summaries, preferences) into namespaces. Later sessions retrieve them semantically, so the agent remembers the user across conversations.",
          commands: [
            "records = client.retrieve_memories(\n    memory_id=MEM_ID, namespace=\"/facts/user-42\",\n    query=\"seating preferences\", top_k=3)"
          ],
          children: [
            { name: "Semantic strategy", desc: "Extracts durable facts from conversations and stores them as retrievable memories.",
              detail: "Watches events and extracts standalone facts ('user is vegetarian', 'project deadline is March') into vector-searchable records. Use it for knowledge the agent should recall verbatim later.",
              commands: [
                "--memory-strategies '[{\"semanticMemoryStrategy\":{\n  \"name\":\"facts\",\"namespaces\":[\"/facts/{actorId}\"]}}]'"
              ]},
            { name: "Summarization strategy", desc: "Maintains rolling summaries of sessions so agents can resume with compact context.",
              detail: "Continuously summarizes each session so a returning agent loads one compact summary instead of replaying the full transcript, keeping token usage flat as conversations grow.",
              commands: [
                "--memory-strategies '[{\"summaryMemoryStrategy\":{\n  \"name\":\"session_summaries\",\"namespaces\":[\"/summaries/{actorId}/{sessionId}\"]}}]'"
              ]},
            { name: "User preference strategy", desc: "Learns per-user preferences (tone, formats, choices) and applies them in later sessions.",
              detail: "Extracts preferences ('prefers concise answers', 'books aisle seats') into a per-user namespace; the agent retrieves them at session start to personalize behavior immediately.",
              commands: [
                "--memory-strategies '[{\"userPreferenceMemoryStrategy\":{\n  \"name\":\"prefs\",\"namespaces\":[\"/preferences/{actorId}\"]}}]'"
              ]},
            { name: "Namespaces", desc: "Scopes memories per actor, session, or application so retrieval stays tenant-safe.",
              detail: "Namespaces are path templates with {actorId}/{sessionId}/{memoryStrategyId} variables. Records land in the resolved path and retrieval filters by it, which is how multi-tenant isolation happens: one user's memories are never returned for another.",
              commands: [
                "# template on strategy: /preferences/{actorId}\n# resolved at write time: /preferences/user-42",
                "client.retrieve_memories(memory_id=MEM_ID,\n    namespace=\"/preferences/user-42\", query=\"format preferences\")"
              ]}
          ]}
      ]},
    { name: "Identity", desc: "Secure identity and access for agents acting on behalf of users.",
      detail: "Identity answers two questions: who may call the agent (inbound), and how the agent authenticates to other services (outbound). It stores secrets in a token vault and brokers OAuth flows so agents act with delegated, auditable permissions instead of shared super-credentials.",
      commands: [
        "aws bedrock-agentcore-control create-workload-identity --name myagent",
        "aws bedrock-agentcore-control get-token-vault"
      ],
      children: [
        { name: "Inbound auth", desc: "Controls who may invoke the agent: IAM SigV4 or OAuth JWT bearer tokens validated at the door.",
          detail: "By default a runtime accepts IAM SigV4 calls. For user-facing apps you attach a JWT authorizer (Cognito, Okta, Entra ID): callers present a bearer token, AgentCore validates issuer and client id before the request reaches your code.",
          commands: [
            "aws bedrock-agentcore-control create-agent-runtime ... \\\n  --authorizer-configuration 'customJWTAuthorizer={\n    discoveryUrl=https://cognito-idp.<region>.amazonaws.com/<pool>/.well-known/openid-configuration,\n    allowedClients=[<app-client-id>]}'",
            "curl -X POST <runtime-endpoint>/invocations \\\n  -H \"Authorization: Bearer $USER_JWT\" -d '{\"prompt\":\"hi\"}'"
          ]},
        { name: "Outbound auth", desc: "How the agent authenticates to downstream services.",
          detail: "Outbound auth injects credentials into tool calls at runtime via credential providers. The agent code asks for a token by provider name; Identity fetches, caches, and refreshes it from the vault.",
          commands: [
            "aws bedrock-agentcore-control list-oauth2-credential-providers\naws bedrock-agentcore-control list-api-key-credential-providers"
          ],
          children: [
            { name: "OAuth 2.0 flows", desc: "Supports 2-legged (machine) and 3-legged (user consent) OAuth so agents act with delegated permissions.",
              detail: "2LO (client credentials) suits machine-to-machine calls; 3LO redirects the end user to consent once, then the vault holds the refresh token and the agent gets scoped access tokens on demand via a decorator.",
              commands: [
                "aws bedrock-agentcore-control create-oauth2-credential-provider \\\n  --name google-provider --credential-provider-vendor GoogleOauth2 \\\n  --oauth2-provider-config-input '{\"googleOauth2ProviderConfig\":{\n    \"clientId\":\"<id>\",\"clientSecret\":\"<secret>\"}}'",
                "from bedrock_agentcore.identity.auth import requires_access_token\n\n@requires_access_token(provider_name=\"google-provider\",\n    scopes=[\"https://www.googleapis.com/auth/calendar\"],\n    auth_flow=\"USER_FEDERATION\", on_auth_url=print)\nasync def read_calendar(*, access_token: str):\n    ..."
              ]},
            { name: "API keys", desc: "Stores provider API keys and injects them into tool calls without exposing them to the model.",
              detail: "For services that only support static keys, store the key once in the vault; Gateway or the SDK injects it into the header or query string at call time. The model never sees the secret, so it cannot leak it in output.",
              commands: [
                "aws bedrock-agentcore-control create-api-key-credential-provider \\\n  --name weather-api --api-key '<the-key>'",
                "from bedrock_agentcore.identity.auth import requires_api_key\n\n@requires_api_key(provider_name=\"weather-api\")\ndef call_weather(*, api_key: str):\n    ..."
              ]},
          ]},
        { name: "Token vault", desc: "Encrypted storage for tokens and secrets, with automatic refresh handling.",
          detail: "The vault is the encrypted store behind credential providers: API keys, OAuth client secrets, and user refresh tokens live there (KMS-encrypted). Agents never hold long-lived secrets; they request short-lived tokens scoped to the current user and task.",
          commands: [
            "aws bedrock-agentcore-control get-token-vault",
            "aws bedrock-agentcore get-resource-oauth2-token \\\n  --workload-identity-token <wit> --resource-credential-provider-name google-provider \\\n  --scopes '[\"calendar.readonly\"]' --oauth2-flow USER_FEDERATION"
          ]},
        { name: "Credential providers", desc: "Prebuilt connectors for Google, GitHub, Slack, Salesforce, Atlassian, and custom OAuth providers.",
          detail: "Vendors like Google, GitHub, Slack, Salesforce, and Atlassian have prebuilt provider configs (correct endpoints and quirks baked in); anything OIDC-compliant works via the custom provider. Providers are referenced by name from agent code and gateway targets.",
          commands: [
            "aws bedrock-agentcore-control create-oauth2-credential-provider \\\n  --name github-provider --credential-provider-vendor GithubOauth2 \\\n  --oauth2-provider-config-input '{\"githubOauth2ProviderConfig\":{\n    \"clientId\":\"<id>\",\"clientSecret\":\"<secret>\"}}'",
            "# custom OIDC provider\n--credential-provider-vendor CustomOauth2 \\\n--oauth2-provider-config-input '{\"customOauth2ProviderConfig\":{\n  \"oauthDiscovery\":{\"discoveryUrl\":\"https://issuer/.well-known/openid-configuration\"},\n  \"clientId\":\"<id>\",\"clientSecret\":\"<secret>\"}}'"
          ]}
      ]},
    { name: "Built-in Tools", desc: "Managed tools agents can use out of the box.",
      detail: "Two fully managed tools ship with AgentCore: a sandboxed Code Interpreter and a cloud Browser. Both are session-based, isolated per user, and callable from any framework through the bedrock-agentcore data-plane API or SDK helpers.",
      commands: [
        "aws bedrock-agentcore-control list-code-interpreters\naws bedrock-agentcore-control list-browsers"
      ],
      children: [
        { name: "Code Interpreter", desc: "Sandboxed code execution for analysis and computation.",
          detail: "Lets agents write and run code to answer questions (math, data analysis, file transforms) instead of guessing. Each session is an isolated sandbox with configurable network access; AWS provides a default interpreter (aws.codeinterpreter.v1) or you create custom ones.",
          commands: [
            "from bedrock_agentcore.tools.code_interpreter_client import code_session\n\nwith code_session(\"us-west-2\") as ci:\n    r = ci.invoke(\"executeCode\",\n        {\"language\": \"python\", \"code\": \"print(2**32)\"})"
          ],
          children: [
            { name: "Sandboxed execution", desc: "Runs Python, JavaScript, or TypeScript in an isolated sandbox with no network by default.",
              detail: "Code runs in a dedicated microVM per session, network-disabled unless you opt in, so model-generated code cannot reach your VPC or the internet by accident. Supports Python, JavaScript, and TypeScript runtimes.",
              commands: [
                "import boto3\nc = boto3.client(\"bedrock-agentcore\")\ns = c.start_code_interpreter_session(\n    codeInterpreterIdentifier=\"aws.codeinterpreter.v1\",\n    sessionTimeoutSeconds=900)",
                "r = c.invoke_code_interpreter(\n    codeInterpreterIdentifier=\"aws.codeinterpreter.v1\",\n    sessionId=s[\"sessionId\"], name=\"executeCode\",\n    arguments={\"language\": \"python\", \"code\": \"import pandas as pd; ...\"})",
                "c.stop_code_interpreter_session(\n    codeInterpreterIdentifier=\"aws.codeinterpreter.v1\",\n    sessionId=s[\"sessionId\"])"
              ]},
            { name: "Session file I/O", desc: "Upload data files, run code against them, and read generated artifacts back within the session.",
              detail: "The sandbox has a session filesystem: write an uploaded CSV in, run analysis code against it, then read generated files (charts, cleaned data) back out. Files vanish when the session ends.",
              commands: [
                "ci.invoke(\"writeFiles\", {\"content\": [\n    {\"path\": \"data.csv\", \"text\": csv_text}]})",
                "ci.invoke(\"executeCode\", {\"language\": \"python\",\n    \"code\": \"import pandas as pd; df = pd.read_csv('data.csv'); df.describe().to_csv('out.csv')\"})",
                "ci.invoke(\"listFiles\", {\"path\": \"\"})\nci.invoke(\"readFiles\", {\"paths\": [\"out.csv\"]})"
              ]}
          ]},
        { name: "Browser", desc: "A managed cloud browser for web tasks.",
          detail: "A fast, isolated Chrome running in AWS that agents drive for web tasks: filling forms, scraping, testing flows. No browser fleet to run; sessions are per-user isolated and auditable.",
          commands: [
            "aws bedrock-agentcore-control list-browsers"
          ],
          children: [
            { name: "Cloud browser sessions", desc: "Fast, isolated headless browser sessions managed by AWS, no fleet to run.",
              detail: "Start a session against the default browser (aws.browser.v1) and get WebSocket automation endpoints back. Each session is its own sandboxed browser; stop it when the task ends.",
              commands: [
                "c = boto3.client(\"bedrock-agentcore\")\ns = c.start_browser_session(\n    browserIdentifier=\"aws.browser.v1\",\n    sessionTimeoutSeconds=1800)",
                "c.stop_browser_session(browserIdentifier=\"aws.browser.v1\",\n    sessionId=s[\"sessionId\"])"
              ]},
            { name: "CDP and Playwright", desc: "Automate via Chrome DevTools Protocol or Playwright from the agent.",
              detail: "The session exposes a CDP WebSocket, so standard tooling (Playwright, Puppeteer) drives the cloud browser exactly like a local one; agent frameworks wire this up as a browser tool.",
              commands: [
                "from playwright.sync_api import sync_playwright\nfrom bedrock_agentcore.tools.browser_client import browser_session\n\nwith browser_session(\"us-west-2\") as bc:\n    ws_url, headers = bc.generate_ws_headers()\n    with sync_playwright() as p:\n        browser = p.chromium.connect_over_cdp(ws_url, headers=headers)\n        page = browser.contexts[0].pages[0]\n        page.goto(\"https://aws.amazon.com\")"
              ]},
            { name: "Live view and replay", desc: "Watch a live view of what the agent does in the browser and replay sessions for audit.",
              detail: "The AgentCore console shows a live DCV stream of the browser session (you can even take control), and sessions can be recorded to S3 for later replay, which is the audit story for agentic web automation.",
              commands: [
                "# console: Bedrock AgentCore -> Built-in tools -> Browser -> session -> Live view",
                "aws bedrock-agentcore-control create-browser \\\n  --name recorded-browser --network-configuration networkMode=PUBLIC \\\n  --recording 'enabled=true,s3Location={bucket=my-audit-bucket,prefix=browser-sessions/}' \\\n  --execution-role-arn <role-arn>"
              ]}
          ]}
      ]},
    { name: "Observability", desc: "Tracing, metrics, and debugging for agents in production.",
      detail: "Observability instruments agents with OpenTelemetry and surfaces everything in CloudWatch GenAI Observability: traces of each step, token and latency metrics, and session trajectories. It answers 'why did the agent do that' in production.",
      commands: [
        "pip install aws-opentelemetry-distro",
        "opentelemetry-instrument python agent.py   # auto-instrument at start"
      ],
      children: [
        { name: "CloudWatch GenAI dashboards", desc: "Prebuilt dashboards for agent health: invocations, latency, token usage, and error rates.",
          detail: "CloudWatch ships a GenAI Observability page with per-agent dashboards: invocation counts, error rates, latency percentiles, token consumption. Zero dashboard-building; runtime metrics appear once observability is enabled (and transaction search is turned on once per account).",
          commands: [
            "# console: CloudWatch -> GenAI Observability -> Bedrock AgentCore",
            "aws cloudwatch list-metrics --namespace bedrock-agentcore"
          ]},
        { name: "OTEL traces and spans", desc: "OpenTelemetry-compatible traces covering each step: model calls, tool calls, memory reads.",
          detail: "The ADOT distro auto-instruments the agent process; each model call, tool call, and memory operation becomes a span in one trace per invocation. OTEL-standard export means Langfuse/Datadog/Grafana also work as sinks.",
          commands: [
            "# env on the runtime (starter toolkit sets these for you)\nAGENT_OBSERVABILITY_ENABLED=true\nOTEL_PYTHON_DISTRO=aws_distro\nOTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf",
            "opentelemetry-instrument python agent.py"
          ]},
        { name: "Trajectory inspection", desc: "Step through an agent session end to end to debug why it took a given path.",
          detail: "In the console you open a session and walk its trajectory turn by turn: prompts, model responses, tool calls with arguments and results, memory reads. This is the main debugging loop for wrong agent behavior in production.",
          commands: [
            "# console: CloudWatch -> GenAI Observability -> Sessions -> pick session -> trajectory",
            "aws logs tail /aws/bedrock-agentcore/runtimes/<runtime-id>-DEFAULT --follow"
          ]},
        { name: "Alerts and metrics", desc: "Standard CloudWatch metrics and alarms on top of agent telemetry.",
          detail: "All agent telemetry lands as normal CloudWatch metrics and logs, so alarms, SNS notifications, and existing on-call tooling work unchanged, e.g. alert when error rate or p99 latency crosses a threshold.",
          commands: [
            "aws cloudwatch put-metric-alarm --alarm-name agent-errors \\\n  --namespace bedrock-agentcore --metric-name SystemErrors \\\n  --dimensions Name=Resource,Value=<runtime-id> \\\n  --statistic Sum --period 300 --threshold 5 \\\n  --comparison-operator GreaterThanThreshold \\\n  --evaluation-periods 1 --alarm-actions <sns-topic-arn>"
          ]}
      ]}
  ]
};

const MCP = {
  name: "Model Context Protocol",
  desc: "MCP: the open standard that connects AI agents to tools and data. Example second topic; any hierarchy can live here.",
  detail: "MCP standardizes how AI applications talk to tools and data sources: one protocol instead of N custom integrations. AgentCore leans on it heavily; Gateway serves tools as MCP and Runtime can host agents as MCP servers.",
  commands: [
    "npx @modelcontextprotocol/inspector   # interactive MCP debugger",
    "claude mcp add my-server -- npx -y @some/mcp-server"
  ],
  children: [
    { name: "Architecture", desc: "How hosts, clients, and servers fit together.",
      detail: "Three roles: a host application embeds one or more clients; each client holds a 1:1 connection to a server; servers expose capabilities. The separation lets one app combine many independent integrations safely.",
      commands: [],
      children: [
        { name: "Host", desc: "The AI application (IDE, chat app, agent runtime) that embeds one or more MCP clients.",
          detail: "The host owns the model loop and user consent: Claude Desktop, Claude Code, IDEs, or your own agent. It decides which servers to connect and which tool calls to allow.",
          commands: [
            "# Claude Code as host\nclaude mcp add github -- npx -y @modelcontextprotocol/server-github",
            "claude mcp list"
          ]},
        { name: "Client", desc: "Maintains a 1:1 connection with a server and relays requests for the host.",
          detail: "The client speaks JSON-RPC to exactly one server: initializes the session, negotiates capabilities, forwards tool calls, and streams results back to the host.",
          commands: [
            "from mcp import ClientSession, StdioServerParameters\nfrom mcp.client.stdio import stdio_client\n\nparams = StdioServerParameters(command=\"npx\",\n    args=[\"-y\", \"@modelcontextprotocol/server-filesystem\", \"/tmp\"])\nasync with stdio_client(params) as (r, w):\n    async with ClientSession(r, w) as s:\n        await s.initialize()\n        print(await s.list_tools())"
          ]},
        { name: "Server", desc: "Exposes tools, resources, and prompts over the protocol. One server per integration.",
          detail: "A server wraps one system (GitHub, a database, an internal API) and advertises what it offers. Servers are small and composable; write one in a few lines with FastMCP.",
          commands: [
            "from mcp.server.fastmcp import FastMCP\nmcp = FastMCP(\"my-server\")\n\n@mcp.tool()\ndef add(a: int, b: int) -> int:\n    \"\"\"Add two numbers\"\"\"\n    return a + b\n\nmcp.run()"
          ]}
      ]},
    { name: "Primitives", desc: "What a server can offer.",
      detail: "Servers expose three primitives with different control models: tools (model decides), resources (application decides), prompts (user decides). Picking the right primitive is most of MCP server design.",
      commands: [],
      children: [
        { name: "Tools", desc: "Model-invoked functions with JSON Schema inputs; the agent decides when to call them.",
          detail: "Tools are functions the model may call during reasoning; each has a name, description, and JSON Schema for inputs. Good descriptions matter: the model picks tools by reading them.",
          commands: [
            "@mcp.tool()\ndef search_orders(customer_id: str, status: str = \"open\") -> list:\n    \"\"\"Search a customer's orders by status\"\"\"\n    ...",
            "# client side\nresult = await session.call_tool(\"search_orders\",\n    {\"customer_id\": \"C-42\"})"
          ]},
        { name: "Resources", desc: "Application-controlled data (files, records) the host can read into context.",
          detail: "Resources are addressable data (file contents, DB rows, docs) identified by URI. The host chooses when to read them into model context; the model does not fetch them on its own.",
          commands: [
            "@mcp.resource(\"config://app-settings\")\ndef settings() -> str:\n    return open(\"settings.json\").read()",
            "content = await session.read_resource(\"config://app-settings\")"
          ]},
        { name: "Prompts", desc: "User-invoked templates that servers expose for common workflows.",
          detail: "Prompts are reusable templates the user explicitly triggers (slash commands in Claude Code are prompts). They parameterize common workflows the server knows how to run well.",
          commands: [
            "@mcp.prompt()\ndef review_pr(pr_number: int) -> str:\n    return f\"Review PR #{pr_number} focusing on correctness and tests.\"",
            "prompts = await session.list_prompts()"
          ]}
      ]},
    { name: "Transports", desc: "How messages move.",
      detail: "Same JSON-RPC messages, two transports: stdio for local subprocess servers, Streamable HTTP for remote servers. Choice affects deployment and auth, not the protocol.",
      commands: [],
      children: [
        { name: "stdio", desc: "Local servers spawned as subprocesses; JSON-RPC over stdin/stdout.",
          detail: "The host launches the server as a child process and pipes JSON-RPC through stdin/stdout. Zero network setup, credentials stay local; the default for personal/dev tools.",
          commands: [
            "claude mcp add fs -- npx -y @modelcontextprotocol/server-filesystem ~/projects",
            "# server config in a host (e.g. Claude Desktop)\n{\"mcpServers\": {\"fs\": {\"command\": \"npx\",\n  \"args\": [\"-y\", \"@modelcontextprotocol/server-filesystem\", \"/Users/me\"]}}}"
          ]},
        { name: "Streamable HTTP", desc: "Remote servers over HTTP with streaming responses; supports auth via OAuth.",
          detail: "The server is a web endpoint; clients POST JSON-RPC and receive streamed responses, with OAuth bearer tokens for auth. This is how shared/enterprise servers deploy, and what AgentCore Gateway speaks.",
          commands: [
            "mcp.run(transport=\"streamable-http\")   # FastMCP server on HTTP",
            "claude mcp add --transport http gw https://<gateway-id>.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp \\\n  --header \"Authorization: Bearer $TOKEN\""
          ]}
      ]}
  ]
};

const TOPICS = [AGENTCORE, MCP];

if (typeof module !== "undefined") module.exports = TOPICS;
if (typeof window !== "undefined") window.TOPICS = TOPICS;
