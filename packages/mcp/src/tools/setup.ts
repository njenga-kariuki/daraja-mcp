import { createClient } from '@daraja-kit/sdk';

type Platform = 'cursor' | 'claude_code' | 'lovable' | 'replit' | 'windsurf' | 'other';
type Action = 'check' | 'validate' | 'instructions';

interface SetupInput {
  action?: Action;
  platform?: Platform;
}

interface CredentialStatus {
  source: 'personal' | 'shared_sandbox' | 'none';
  consumerKeySet: boolean;
  consumerSecretSet: boolean;
  oauthValid?: boolean;
  oauthError?: string;
}

interface PlatformConfig {
  platform: string;
  configFile: string;
  config: Record<string, unknown>;
  instructions: string;
}

interface SetupOutput {
  credentialStatus: CredentialStatus;
  platformConfig?: PlatformConfig;
  setupGuide?: string;
  validationResult?: { success: boolean; message: string; duration_ms: number };
}

export const setupSchema = {
  name: 'daraja_setup',
  description:
    'Check your M-Pesa credential status, validate existing credentials, or get platform-specific setup instructions. ' +
    'daraja-kit works out of the box in sandbox mode — no credentials needed. ' +
    'Use this tool when you want your own credentials for dedicated rate limits or production access.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['check', 'validate', 'instructions'],
        description:
          'What to do: "check" detects credential status, "validate" tests OAuth with current credentials, ' +
          '"instructions" returns setup guide. Default: check.',
      },
      platform: {
        type: 'string',
        enum: ['cursor', 'claude_code', 'lovable', 'replit', 'windsurf', 'other'],
        description: 'Your AI platform — determines which config format to return.',
      },
    },
  },
};

function detectCredentialStatus(): CredentialStatus {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY ?? '';
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET ?? '';
  const hasKey = consumerKey.length > 0;
  const hasSecret = consumerSecret.length > 0;

  if (hasKey && hasSecret) {
    return { source: 'personal', consumerKeySet: true, consumerSecretSet: true };
  }
  return { source: 'shared_sandbox', consumerKeySet: hasKey, consumerSecretSet: hasSecret };
}

function getPlatformConfig(platform: Platform): PlatformConfig {
  const npxConfig = {
    mcpServers: {
      'daraja-kit': {
        command: 'npx',
        args: ['-y', '@daraja-kit/mcp'],
      },
    },
  };

  const npxConfigWithCreds = {
    mcpServers: {
      'daraja-kit': {
        command: 'npx',
        args: ['-y', '@daraja-kit/mcp'],
        env: {
          DARAJA_CONSUMER_KEY: 'your_consumer_key',
          DARAJA_CONSUMER_SECRET: 'your_consumer_secret',
        },
      },
    },
  };

  switch (platform) {
    case 'cursor':
      return {
        platform: 'Cursor',
        configFile: '.cursor/mcp.json',
        config: npxConfig,
        instructions:
          '## Cursor Setup\n\n' +
          '### Zero-config (sandbox, works immediately):\n' +
          '1. Create `.cursor/mcp.json` in your project root with the config above\n' +
          '2. Restart Cursor\n' +
          '3. The daraja-kit tools are now available in Cursor Chat (Cmd+L)\n\n' +
          '### With your own credentials:\n' +
          '1. Go to developer.safaricom.co.ke → sign up → My Apps → Add a New App\n' +
          '2. Copy your Consumer Key and Consumer Secret\n' +
          '3. Add env vars to the config (see config with credentials below)\n' +
          '4. Or: Settings > Tools & MCP > Add new MCP server',
      };

    case 'claude_code':
      return {
        platform: 'Claude Code',
        configFile: '.mcp.json',
        config: npxConfig,
        instructions:
          '## Claude Code Setup\n\n' +
          '### Zero-config (sandbox, works immediately):\n' +
          '1. Create `.mcp.json` in your project root with the config above\n' +
          '2. Restart Claude Code\n' +
          '3. All daraja-kit tools are available immediately\n\n' +
          '### With your own credentials:\n' +
          '1. Go to developer.safaricom.co.ke → sign up → My Apps → Add a New App\n' +
          '2. Set environment variables:\n' +
          '   export DARAJA_CONSUMER_KEY=your_key\n' +
          '   export DARAJA_CONSUMER_SECRET=your_secret\n' +
          '3. Or add env vars to .mcp.json config',
      };

    case 'lovable':
      return {
        platform: 'Lovable',
        configFile: 'Settings > Integrations',
        config: npxConfig,
        instructions:
          '## Lovable Setup\n\n' +
          '### Zero-config (sandbox, works immediately):\n' +
          '1. Go to Settings > Integrations in your Lovable project\n' +
          '2. Add a custom MCP server with command: npx -y @daraja-kit/mcp\n' +
          '3. Say "build me a donation page with M-Pesa" — it just works\n\n' +
          '### With your own credentials:\n' +
          '1. Go to developer.safaricom.co.ke → sign up → My Apps → Add a New App\n' +
          '2. Add DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET as environment variables in the MCP server config',
      };

    case 'replit':
      return {
        platform: 'Replit',
        configFile: 'Agent MCP Settings',
        config: npxConfig,
        instructions:
          '## Replit Setup\n\n' +
          '### Zero-config (sandbox, works immediately):\n' +
          '1. In Replit Agent settings, add MCP server: npx -y @daraja-kit/mcp\n' +
          '2. Ask Replit Agent to build your M-Pesa integration\n\n' +
          '### With your own credentials:\n' +
          '1. Go to developer.safaricom.co.ke → sign up → My Apps → Add a New App\n' +
          '2. Add credentials as Replit Secrets (DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET)',
      };

    case 'windsurf':
      return {
        platform: 'Windsurf',
        configFile: 'Settings > Cascade > MCP Servers',
        config: npxConfig,
        instructions:
          '## Windsurf Setup\n\n' +
          '### Zero-config (sandbox, works immediately):\n' +
          '1. Settings > Cascade > MCP Servers > Add Server\n' +
          '2. Command: npx, Args: -y @daraja-kit/mcp\n' +
          '3. daraja-kit tools are available in Cascade workflows\n\n' +
          '### With your own credentials:\n' +
          '1. Go to developer.safaricom.co.ke → sign up → My Apps → Add a New App\n' +
          '2. Add env vars to the MCP server configuration',
      };

    default:
      return {
        platform: 'Generic MCP Client',
        configFile: 'mcp.json or equivalent',
        config: npxConfigWithCreds,
        instructions:
          '## Generic MCP Setup\n\n' +
          '### Zero-config (sandbox, works immediately):\n' +
          'Use stdio transport with command: npx -y @daraja-kit/mcp\n' +
          'No environment variables needed for sandbox.\n\n' +
          '### With your own credentials:\n' +
          '1. Go to developer.safaricom.co.ke → sign up → My Apps → Add a New App\n' +
          '2. Pass DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET as environment variables to the MCP server process',
      };
  }
}

function getSetupGuide(): string {
  return (
    '## Getting Your Own Daraja Credentials\n\n' +
    'daraja-kit works out of the box with shared sandbox credentials.\n' +
    'Get your own credentials for dedicated rate limits or production access:\n\n' +
    '### Step 1: Create a Daraja Account (1 minute)\n' +
    '1. Go to developer.safaricom.co.ke\n' +
    '2. Click "Sign Up" and create an account\n' +
    '3. Verify your email\n\n' +
    '### Step 2: Create an App (1 minute)\n' +
    '1. Go to My Apps → "Add a New App"\n' +
    '2. Give it a name (e.g., "My M-Pesa App")\n' +
    '3. Select the API products you need:\n' +
    '   - "Lipa Na M-Pesa Sandbox" for STK Push (collect payments)\n' +
    '   - "M-Pesa Sandbox" for B2C, Status, Balance, Reversal\n' +
    '   - "QR Code API Sandbox" for QR payments\n' +
    '4. Click "Create App"\n\n' +
    '### Step 3: Copy Your Credentials\n' +
    '1. On the app page, you\'ll see Consumer Key and Consumer Secret\n' +
    '2. Click "Show" to reveal each value\n' +
    '3. Set them as environment variables:\n' +
    '   export DARAJA_CONSUMER_KEY=your_key\n' +
    '   export DARAJA_CONSUMER_SECRET=your_secret\n\n' +
    '### Going to Production?\n' +
    'Use the daraja_go_live tool for a complete production readiness checklist.'
  );
}

export async function handleSetup(input: SetupInput): Promise<SetupOutput> {
  const action = input.action ?? 'check';
  const platform = input.platform ?? 'other';
  const status = detectCredentialStatus();
  const output: SetupOutput = { credentialStatus: status };

  if (action === 'validate' || action === 'check') {
    // Attempt OAuth validation
    const start = Date.now();
    try {
      const mpesa = createClient();
      // Trigger OAuth by making a lightweight API call
      await mpesa.collect({ amount: 1, phone: '254708374149', poll: false });
      status.oauthValid = true;
      output.validationResult = {
        success: true,
        message:
          status.source === 'personal'
            ? 'Your personal credentials are valid. OAuth token acquired successfully.'
            : 'Shared sandbox credentials are working. OAuth token acquired successfully.',
        duration_ms: Date.now() - start,
      };
    } catch (err: unknown) {
      const mpesaErr = err as { message?: string; suggestion?: string };
      status.oauthValid = false;
      status.oauthError = mpesaErr.message;
      output.validationResult = {
        success: false,
        message: mpesaErr.suggestion ?? mpesaErr.message ?? 'OAuth validation failed',
        duration_ms: Date.now() - start,
      };
    }
  }

  if (action === 'instructions' || action === 'check') {
    output.platformConfig = getPlatformConfig(platform);
    output.setupGuide = getSetupGuide();
  }

  return output;
}
