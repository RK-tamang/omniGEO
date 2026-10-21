/**
 * Schema Injector - Cloudflare Workers
 * Pushes dynamic JSON-LD to client headers
 * Cost: Free (up to 100k req/day)
 */

export interface SchemaInjectionRequest {
  domain: string;
  schemas: Array<{
    type: "Organization" | "WebSite" | "LocalBusiness" | "Product" | "Article" | "FAQPage" | "BreadcrumbList" | "Service";
    data: Record<string, unknown>;
  }>;
  headers?: Record<string, string>;
}

export interface SchemaInjectionResponse {
  success: boolean;
  workerUrl?: string;
  deployedSchemas: string[];
  error?: string;
}

export class CloudflareWorkersClient {
  private accountId: string;
  private apiToken: string;
  private namespace: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN!;
    this.namespace = process.env.CLOUDFLARE_WORKERS_NAMESPACE || "omnigeo-schema";
  }

  async injectSchemas(request: SchemaInjectionRequest): Promise<SchemaInjectionResponse> {
    const workerScript = this.generateWorkerScript(request.schemas);
    const workerName = `schema-${request.domain.replace(/[^a-z0-9]/gi, "-")}`;

    try {
      await this.deployWorker(workerName, workerScript);
      const workerUrl = `https://${workerName}.${this.accountId}.workers.dev`;

      return {
        success: true,
        workerUrl,
        deployedSchemas: request.schemas.map((s) => s.type),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Worker deployment failed",
        deployedSchemas: [],
      };
    }
  }

  private async deployWorker(name: string, script: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${name}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/javascript",
        },
        body: script,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Worker deployment failed: ${JSON.stringify(error.errors)}`);
    }
  }

  private generateWorkerScript(schemas: SchemaInjectionRequest["schemas"]): string {
    const schemaMap = schemas.map((s) => ({
      type: s.type,
      data: s.data,
    }));

    return `
// Auto-generated Schema Injector Worker
// Domain: ${schemas[0]?.data?.url || "unknown"}
// Generated: ${new Date().toISOString()}

const SCHEMAS = ${JSON.stringify(schemaMap, null, 2)};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response = await fetch(request);
    
    // Only inject on HTML responses
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    let html = await response.text();
    
    // Inject JSON-LD scripts before </head>
    const jsonLdScripts = SCHEMAS.map(schema => 
      \`<script type="application/ld+json">\${JSON.stringify(schema.data)}</script>\`
    ).join("\\n");

    html = html.replace("</head>", \`\${jsonLdScripts}\\n</head>\`);
    
    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
  }
};
`;
  }

  async deleteWorker(name: string): Promise<boolean> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${name}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.apiToken}` },
      }
    );
    return response.ok;
  }

  async listWorkers(): Promise<string[]> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts`,
      { headers: { Authorization: `Bearer ${this.apiToken}` } }
    );
    const data = await response.json();
    return data.result?.map((w: { id: string }) => w.id) || [];
  }
}

let cfClient: CloudflareWorkersClient | null = null;

export function getCloudflareWorkersClient(): CloudflareWorkersClient {
  if (!cfClient) cfClient = new CloudflareWorkersClient();
  return cfClient;
}