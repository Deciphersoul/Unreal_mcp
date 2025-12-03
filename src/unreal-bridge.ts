import WebSocket from 'ws';
import { createHttpClient } from './utils/http.js';
import { Logger } from './utils/logger.js';
import { loadEnv } from './types/env.js';
import { ErrorHandler } from './utils/error-handler.js';
import { PYTHON_TEMPLATES, fillTemplate } from './utils/python-templates.js';
import {
  UNSAFE_VIEWMODES,
  HARD_BLOCKED_VIEWMODES,
  VIEWMODE_ALIASES,
  getSafeAlternative,
  getAcceptedModes,
  normalizeViewmodeKey
} from './utils/viewmode.js';
import { CommandQueue, CommandPriority } from './utils/command-queue.js';
import { parseStandardResult } from './utils/python-output.js';
import {
  SAFE_COMMANDS,
  DANGEROUS_COMMANDS,
  isCrashCommand,
  isDangerousCommand,
  containsForbiddenToken
} from './utils/safe-commands.js';
import { generatePluginCheckScript, ENGINE_VERSION_SCRIPT, FEATURE_FLAGS_SCRIPT } from './utils/python.js';

interface RcCallBody {
  objectPath: string; // e.g. "/Script/UnrealEd.Default__EditorAssetLibrary"
  functionName: string; // e.g. "ListAssets"
  parameters?: Record<string, any>;
  generateTransaction?: boolean;
}

export class UnrealBridge {
  private ws?: WebSocket;
  private http = createHttpClient('');
  private env = loadEnv();
  private log = new Logger('UnrealBridge');
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly BASE_RECONNECT_DELAY = 1000;
  private autoReconnectEnabled = false; // disabled by default to prevent looping retries
  private engineVersionCache?: { value: { version: string; major: number; minor: number; patch: number; isUE56OrAbove: boolean }; timestamp: number };
  private readonly ENGINE_VERSION_TTL_MS = 5 * 60 * 1000;
  
  // Command queue for throttling - uses CommandQueue class from ./utils/command-queue.js
  private commandQueueInstance: CommandQueue;

  // Console object cache to reduce FindConsoleObject warnings
  private consoleObjectCache = new Map<string, any>();
  private readonly CONSOLE_CACHE_TTL = 300000; // 5 minutes TTL for cached objects
  private pluginStatusCache = new Map<string, { enabled: boolean; timestamp: number }>();
  private readonly PLUGIN_CACHE_TTL = 5 * 60 * 1000;
  
  constructor() {
    this.commandQueueInstance = new CommandQueue({}, this.log);
  }

  get isConnected() { return this.connected; }
  
  /**
   * Attempt to connect with exponential backoff retry strategy
   * Uses optimized retry pattern from TypeScript best practices
   * @param maxAttempts Maximum number of connection attempts
   * @param timeoutMs Timeout for each connection attempt in milliseconds
   * @param retryDelayMs Initial delay between retry attempts in milliseconds
   * @returns Promise that resolves to true if connected, false otherwise
   */
  private connectPromise?: Promise<void>;

  async tryConnect(maxAttempts: number = 3, timeoutMs: number = 5000, retryDelayMs: number = 2000): Promise<boolean> {
    if (this.connected) return true;

    if (this.connectPromise) {
      try {
        await this.connectPromise;
      } catch {
        // swallow, we'll return connected flag
      }
      return this.connected;
    }

    // Use ErrorHandler's retryWithBackoff for consistent retry behavior
    this.connectPromise = ErrorHandler.retryWithBackoff(
      () => this.connect(timeoutMs),
      {
        maxRetries: maxAttempts - 1,
        initialDelay: retryDelayMs,
        maxDelay: 10000,
        backoffMultiplier: 1.5,
        shouldRetry: (error) => {
          // Only retry on connection-related errors
          const msg = (error as Error)?.message?.toLowerCase() || '';
          return msg.includes('timeout') || msg.includes('connection') || msg.includes('econnrefused');
        }
      }
    ).then(() => {
      // Success
    }).catch((err) => {
      this.log.warn(`Connection failed after ${maxAttempts} attempts:`, err.message);
    });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }

    return this.connected;
  }

  async connect(timeoutMs: number = 5000): Promise<void> {
    // If already connected and socket is open, do nothing
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.log.debug('connect() called but already connected; skipping');
      return;
    }

    const wsUrl = `ws://${this.env.UE_HOST}:${this.env.UE_RC_WS_PORT}`;
    const httpBase = `http://${this.env.UE_HOST}:${this.env.UE_RC_HTTP_PORT}`;
    this.http = createHttpClient(httpBase);

    this.log.debug(`Connecting to UE Remote Control: ${wsUrl}`);
    this.ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('WS not created'));
      
      // Guard against double-resolution/rejection
      let settled = false;
      const safeResolve = () => { if (!settled) { settled = true; resolve(); } };
      const safeReject = (err: Error) => { if (!settled) { settled = true; reject(err); } };
      
      // Setup timeout
      const timeout = setTimeout(() => {
        this.log.warn(`Connection timeout after ${timeoutMs}ms`);
        if (this.ws) {
          try {
            // Attach a temporary error handler to avoid unhandled 'error' events on abort
            this.ws.on('error', () => {});
            // Prefer graceful close; terminate as a fallback
            if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
              try { this.ws.close(); } catch {}
              try { this.ws.terminate(); } catch {}
            }
          } finally {
            try { this.ws.removeAllListeners(); } catch {}
            this.ws = undefined;
          }
        }
        safeReject(new Error('Connection timeout: Unreal Engine may not be running or Remote Control is not enabled'));
      }, timeoutMs);
      
      // Success handler
      const onOpen = () => {
        clearTimeout(timeout);
        this.connected = true;
        this.log.info('Connected to Unreal Remote Control');
        this.startCommandProcessor(); // Start command processor on connect
        safeResolve();
      };
      
      // Error handler
      const onError = (err: Error) => {
        clearTimeout(timeout);
        // Keep error logs concise to avoid stack spam when UE is not running
        this.log.debug(`WebSocket error during connect: ${(err && (err as any).code) || ''} ${err.message}`);
        if (this.ws) {
          try {
            // Attach a temporary error handler to avoid unhandled 'error' events while aborting
            this.ws.on('error', () => {});
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
              try { this.ws.close(); } catch {}
              try { this.ws.terminate(); } catch {}
            }
          } finally {
            try { this.ws.removeAllListeners(); } catch {}
            this.ws = undefined;
          }
        }
        safeReject(new Error(`Failed to connect: ${err.message}`));
      };
      
      // Close handler (if closed before open)
      const onClose = () => {
        if (!this.connected) {
          clearTimeout(timeout);
          safeReject(new Error('Connection closed before establishing'));
        } else {
          // Normal close after connection was established
          this.connected = false;
          this.ws = undefined;
          this.log.warn('WebSocket closed');
          if (this.autoReconnectEnabled) {
            this.scheduleReconnect();
          }
        }
      };
      
      // Message handler (currently best-effort logging)
      const onMessage = (raw: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(String(raw));
          this.log.debug('WS message', msg);
        } catch (_e) {
          // Noise reduction: keep at debug and do nothing on parse errors
        }
      };
      
      // Attach listeners
      this.ws.once('open', onOpen);
      this.ws.once('error', onError);
      this.ws.on('close', onClose);
      this.ws.on('message', onMessage);
    });
  }


  async httpCall<T = any>(path: string, method: 'GET' | 'POST' | 'PUT' = 'POST', body?: any): Promise<T> {
    // Guard: if not connected, do not attempt HTTP
    if (!this.connected) {
      throw new Error('Not connected to Unreal Engine');
    }

    const url = path.startsWith('/') ? path : `/${path}`;
    const started = Date.now();
    
    // Fix Content-Length header issue - ensure body is properly handled
    let payload = body;
    if ((payload === undefined || payload === null) && method !== 'GET') {
      payload = {};
    }
    
    // Add timeout wrapper to prevent hanging - adjust based on operation type
    let CALL_TIMEOUT = 10000; // Default 10 seconds timeout
    const longRunningTimeout = 10 * 60 * 1000; // 10 minutes for heavy editor jobs

    // Use payload contents to detect long-running editor operations
    let payloadSignature = '';
    if (typeof payload === 'string') {
      payloadSignature = payload;
    } else if (payload && typeof payload === 'object') {
      try {
        payloadSignature = JSON.stringify(payload);
      } catch {
        payloadSignature = '';
      }
    }

    // Allow explicit override via meta property when provided
    let sanitizedPayload = payload;
    if (payload && typeof payload === 'object' && '__callTimeoutMs' in payload) {
      const overrideRaw = (payload as any).__callTimeoutMs;
      const overrideMs = typeof overrideRaw === 'number'
        ? overrideRaw
        : Number.parseInt(String(overrideRaw), 10);
      if (Number.isFinite(overrideMs) && overrideMs > 0) {
        CALL_TIMEOUT = Math.max(CALL_TIMEOUT, overrideMs);
      }
      sanitizedPayload = { ...(payload as any) };
      delete (sanitizedPayload as any).__callTimeoutMs;
    }

    // For heavy operations, use longer timeout based on URL or payload signature
    if (url.includes('build') || url.includes('create') || url.includes('asset')) {
      CALL_TIMEOUT = Math.max(CALL_TIMEOUT, 30000); // 30 seconds for heavy operations
    }
    if (url.includes('light') || url.includes('BuildLighting')) {
      CALL_TIMEOUT = Math.max(CALL_TIMEOUT, 60000); // Base 60 seconds for lighting builds
    }

    if (payloadSignature) {
      const longRunningPatterns = [
        /build_light_maps/i,
        /lightingbuildquality/i,
        /editorbuildlibrary/i,
        /buildlighting/i,
        /"command"\s*:\s*"buildlighting/i
      ];
      if (longRunningPatterns.some(pattern => pattern.test(payloadSignature))) {
        if (CALL_TIMEOUT < longRunningTimeout) {
          this.log.debug(`Detected long-running lighting operation, extending HTTP timeout to ${longRunningTimeout}ms`);
        }
        CALL_TIMEOUT = Math.max(CALL_TIMEOUT, longRunningTimeout);
      }
    }
    
    // CRITICAL: Intercept and block dangerous console commands at HTTP level
    // Uses constants from ./utils/safe-commands.js
    if (url === '/remote/object/call' && (payload as any)?.functionName === 'ExecuteConsoleCommand') {
      const command = (payload as any)?.parameters?.Command;
      if (command && typeof command === 'string') {
        // Check if this is a crash-inducing command
        if (isCrashCommand(command)) {
          this.log.warn(`BLOCKED dangerous command that causes crashes: ${command}`);
          return {
            success: false,
            error: `Command '${command}' blocked: This command can cause Unreal Engine to crash. Use the Python API alternatives instead.`
          } as any;
        }
        
        // Also block other dangerous commands
        if (isDangerousCommand(command)) {
          this.log.warn(`BLOCKED potentially dangerous command: ${command}`);
          return {
            success: false,
            error: `Command '${command}' blocked for safety.`
          } as any;
        }
      }
    }
    
    // Retry logic with exponential backoff and timeout
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // For GET requests, send payload as query parameters (not in body)
        const config: any = { url, method, timeout: CALL_TIMEOUT };
        if (method === 'GET' && sanitizedPayload && typeof sanitizedPayload === 'object') {
          config.params = sanitizedPayload;
        } else if (sanitizedPayload !== undefined) {
          config.data = sanitizedPayload;
        }

        // Wrap with timeout promise to ensure we don't hang
  const requestPromise = this.http.request<T>(config);
  const resp = await new Promise<Awaited<typeof requestPromise>>((resolve, reject) => {
          const timer = setTimeout(() => {
            const err = new Error(`Request timeout after ${CALL_TIMEOUT}ms`);
            (err as any).code = 'UE_HTTP_TIMEOUT';
            reject(err);
          }, CALL_TIMEOUT);
          requestPromise.then(result => {
            clearTimeout(timer);
            resolve(result);
          }).catch(err => {
            clearTimeout(timer);
            reject(err);
          });
        });
        const ms = Date.now() - started;

        // Add connection health check for long-running requests
        if (ms > 5000) {
          this.log.debug(`[HTTP ${method}] ${url} -> ${ms}ms (long request)`);
        } else {
          this.log.debug(`[HTTP ${method}] ${url} -> ${ms}ms`);
        }

        return resp.data;
      } catch (error: any) {
        lastError = error;
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff with 5s max
        
        // Log timeout errors specifically
        if (error.message?.includes('timeout')) {
          this.log.debug(`HTTP request timed out (attempt ${attempt + 1}/3): ${url}`);
        }
        
        if (attempt < 2) {
          this.log.debug(`HTTP request failed (attempt ${attempt + 1}/3), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // If connection error, try to reconnect
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            if (this.autoReconnectEnabled) {
              this.scheduleReconnect();
            }
          }
        }
      }
    }
    
    throw lastError;
  }

  // Python JSON result parsing now uses parseStandardResult from ./utils/python-output.js
  private parsePythonJsonResult<T = any>(raw: any): T | null {
    const result = parseStandardResult(raw);
    return result.data as T | null;
  }

  async ensurePluginsEnabled(pluginNames: string[], context?: string): Promise<string[]> {
    if (!pluginNames || pluginNames.length === 0) {
      return [];
    }

    const now = Date.now();
    const pluginsToCheck = pluginNames.filter((name) => {
      const cached = this.pluginStatusCache.get(name);
      if (!cached) return true;
      if (now - cached.timestamp > this.PLUGIN_CACHE_TTL) {
        this.pluginStatusCache.delete(name);
        return true;
      }
      return false;
    });

    if (pluginsToCheck.length > 0) {
      // Use helper from ./utils/python.js
      const python = generatePluginCheckScript(pluginsToCheck);

      try {
        const response = await this.executePython(python);
        const parsed = this.parsePythonJsonResult<Record<string, boolean>>(response);
        if (parsed) {
          for (const [name, enabled] of Object.entries(parsed)) {
            this.pluginStatusCache.set(name, { enabled: Boolean(enabled), timestamp: now });
          }
        } else {
          this.log.warn('Failed to parse plugin status response', { context, pluginsToCheck });
          // Assume enabled if we can't parse - let actual operation fail with real error
          for (const name of pluginsToCheck) {
            this.pluginStatusCache.set(name, { enabled: true, timestamp: now });
          }
        }
      } catch (error) {
        // Python execution failed (likely disabled) - assume plugins enabled
        // This allows Sequencer to try operations and fail with real errors
        this.log.warn('Plugin status check failed (Python disabled?) - assuming plugins enabled', { 
          context, pluginsToCheck, error: (error as Error)?.message ?? error 
        });
        for (const name of pluginsToCheck) {
          this.pluginStatusCache.set(name, { enabled: true, timestamp: now });
        }
      }
    }

    for (const name of pluginNames) {
      if (!this.pluginStatusCache.has(name)) {
        // Only mark as disabled if we actually checked and it wasn't found
        this.pluginStatusCache.set(name, { enabled: true, timestamp: now });
      }
    }

    const missing = pluginNames.filter((name) => !this.pluginStatusCache.get(name)?.enabled);
    if (missing.length && context) {
      this.log.warn(`Missing required Unreal plugins for ${context}: ${missing.join(', ')}`);
    }
    return missing;
  }

  // Generic function call via Remote Control HTTP API
  async call(body: RcCallBody): Promise<any> {
    if (!this.connected) throw new Error('Not connected to Unreal Engine');
    // Using HTTP endpoint /remote/object/call
    const result = await this.httpCall<any>('/remote/object/call', 'PUT', {
      generateTransaction: false,
      ...body
    });
    return result;
  }

  async getExposed(): Promise<any> {
    if (!this.connected) throw new Error('Not connected to Unreal Engine');
    return this.httpCall('/remote/preset', 'GET');
  }

  // Execute a console command safely with validation and throttling
  async executeConsoleCommand(command: string, options: { allowPython?: boolean } = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to Unreal Engine');
    }
    const { allowPython = false } = options;
    // Validate command is not empty
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command: must be a non-empty string');
    }
    
    const cmdTrimmed = command.trim();
    if (cmdTrimmed.length === 0) {
      // Return success for empty commands to match UE behavior
      return { success: true, message: 'Empty command ignored' };
    }

    if (cmdTrimmed.includes('\n') || cmdTrimmed.includes('\r')) {
      throw new Error('Multi-line console commands are not allowed. Send one command per call.');
    }

    const cmdLower = cmdTrimmed.toLowerCase();

    if (!allowPython && (cmdLower === 'py' || cmdLower.startsWith('py '))) {
      throw new Error('Python console commands are blocked from external calls for safety.');
    }
    
    // Check for dangerous commands using imported constants from ./utils/safe-commands.js
    if (DANGEROUS_COMMANDS.some(dangerous => cmdLower.includes(dangerous)) || isCrashCommand(command)) {
      throw new Error(`Dangerous command blocked: ${command}`);
    }

    if (cmdLower.includes('&&') || cmdLower.includes('||')) {
      throw new Error('Command chaining with && or || is blocked for safety.');
    }

    if (containsForbiddenToken(command)) {
      throw new Error(`Command contains unsafe token and was blocked: ${command}`);
    }
    
    // Determine priority: 1=heavy, 5=medium, 7=default, 9=light
    let priority = 7;
    if (command.includes('BuildLighting') || command.includes('BuildPaths')) priority = 1;
    else if (command.includes('summon') || command.includes('spawn')) priority = 5;
    else if (command.startsWith('stat') || command.startsWith('show')) priority = 9;
    
    // Warn on likely invalid commands
    if (/^\d+$|^invalid_command|^this_is_not_a_valid/i.test(cmdTrimmed)) {
      this.log.warn(`Command appears invalid: ${cmdTrimmed}`);
    }
    
    try {
      const result = await this.executeThrottledCommand(
        () => this.httpCall('/remote/object/call', 'PUT', {
          objectPath: '/Script/Engine.Default__KismetSystemLibrary',
          functionName: 'ExecuteConsoleCommand',
          parameters: {
            WorldContextObject: null,
            Command: cmdTrimmed,
            SpecificPlayer: null
          },
          generateTransaction: false
        }),
        priority
      );
      
      return result;
    } catch (error) {
      this.log.error(`Console command failed: ${cmdTrimmed}`, error);
      throw error;
    }
  }

  summarizeConsoleCommand(command: string, response: any) {
    const logLines = Array.isArray(response?.LogOutput)
      ? (response.LogOutput as any[]).map(e => e === null || e === undefined ? '' : typeof e === 'string' ? e : e.Output ?? '').filter(Boolean)
      : [];
    let output = logLines.join('\n').trim();
    if (!output) {
      if (typeof response === 'string') output = response.trim();
      else if (response && typeof response === 'object') {
        output = (response.Output ?? response.result ?? response.ReturnValue ?? '').toString().trim();
      }
    }
    return {
      command: command.trim(),
      output,
      logLines,
      returnValue: response?.ReturnValue,
      raw: response
    };
  }

  async executeConsoleCommands(
    commands: Iterable<string | { command: string; priority?: number; allowPython?: boolean }>,
    options: { continueOnError?: boolean; delayMs?: number } = {}
  ): Promise<any[]> {
    const { continueOnError = false, delayMs = 0 } = options;
    const results: any[] = [];

    for (const rawCommand of commands) {
      const descriptor = typeof rawCommand === 'string' ? { command: rawCommand } : rawCommand;
      const command = descriptor.command?.trim();
      if (!command) {
        continue;
      }
      try {
        const result = await this.executeConsoleCommand(command, {
          allowPython: Boolean(descriptor.allowPython)
        });
        results.push(result);
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        this.log.warn(`Console batch command failed: ${command}`, error);
        results.push(error);
      }

      if (delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  // Try to execute a Python command via the PythonScriptPlugin, fallback to `py` console command.
  async executePython(command: string): Promise<any> {
    if (!this.connected) throw new Error('Not connected to Unreal Engine');
    
    const isMultiLine = /[\r\n]/.test(command) || command.includes(';');
    
    // Try ExecutePythonCommandEx first (best option)
    try {
      return await this.httpCall('/remote/object/call', 'PUT', {
        objectPath: '/Script/PythonScriptPlugin.Default__PythonScriptLibrary', 
        functionName: 'ExecutePythonCommandEx',
        parameters: {
          PythonCommand: command,
          ExecutionMode: isMultiLine ? 'ExecuteFile' : 'ExecuteStatement',
          FileExecutionScope: 'Private'
        },
        generateTransaction: false
      });
    } catch { /* continue to fallback */ }
    
    // Fallback to ExecutePythonCommand
    try {
      return await this.httpCall('/remote/object/call', 'PUT', {
        objectPath: '/Script/PythonScriptPlugin.Default__PythonScriptLibrary',
        functionName: 'ExecutePythonCommand',
        parameters: { Command: command },
        generateTransaction: false
      });
    } catch { /* continue to console fallback */ }
    
    // Final fallback: execute via console py command
    this.log.warn('PythonScriptLibrary not available, falling back to console `py` command');
    
    if (!isMultiLine) {
      return await this.executeConsoleCommand(`py ${command}`, { allowPython: true });
    }
    
    // Multi-line: try exec block first
    try {
      const escapedScript = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
      return await this.executeConsoleCommand(`py exec("${escapedScript}")`, { allowPython: true });
    } catch { /* continue to line-by-line */ }
    
    // Line-by-line execution as last resort
    await this.executeConsoleCommand('py import unreal').catch(() => {});
    const lines = command.replace(/^\s*import\s+unreal\s*;?\s*/m, '').split(/[;\n]/)
      .map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('#'));
    
    let result = null;
    for (const line of lines) {
      const cmd = line.length > 200 ? `exec("""${line.replace(/"/g, '\\"')}""")` : line;
      result = await this.executeConsoleCommand(`py ${cmd}`, { allowPython: true });
      await this.delay(30);
    }
    return result;
  }
  
  // Allow callers to enable/disable auto-reconnect behavior
  setAutoReconnectEnabled(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
  }

  // Connection recovery
  private scheduleReconnect(): void {
    if (!this.autoReconnectEnabled) {
      this.log.info('Auto-reconnect disabled; not scheduling reconnection');
      return;
    }
    if (this.reconnectTimer || this.connected) {
      return;
    }
    
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.log.error('Max reconnection attempts reached. Please check Unreal Engine.');
      return;
    }
    
    // Exponential backoff with jitter
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      30000 // Max 30 seconds
    );
    
    this.log.debug(`Scheduling reconnection attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay)}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      this.reconnectAttempts++;
      
      try {
        await this.connect();
        this.reconnectAttempts = 0;
        this.log.info('Successfully reconnected to Unreal Engine');
      } catch (err) {
        this.log.warn('Reconnection attempt failed:', err);
        this.scheduleReconnect();
      }
    }, delay);
  }
  
  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.ws) {
      try {
        // Avoid unhandled error during shutdown
        this.ws.on('error', () => {});
        try { this.ws.close(); } catch {}
        try { this.ws.terminate(); } catch {}
      } finally {
        try { this.ws.removeAllListeners(); } catch {}
        this.ws = undefined;
      }
    }
    
    this.connected = false;
  }
  
  /**
   * Enhanced Editor Function Access
   * Use Python scripting as a bridge to access modern Editor Subsystem functions
   */
  async executeEditorFunction(functionName: string, params?: Record<string, any>): Promise<any> {
    const template = PYTHON_TEMPLATES[functionName];
    if (!template) {
      throw new Error(`Unknown editor function: ${functionName}`);
    }

    // Use fillTemplate helper for parameter substitution
    const script = params ? fillTemplate(template, params) : template.script;

    try {
      // Execute Python script with result parsing
      const result = await this.executePythonWithResult(script);
      return result;
    } catch (error) {
      this.log.error(`Failed to execute editor function ${functionName}:`, error);
      
      // Fallback to console command if Python fails
      return this.executeFallbackCommand(functionName, params);
    }
  }

  /**
   * Execute Python script and parse the result
   * Uses parseStandardResult from ./utils/python-output.js for robust RESULT: parsing
   */
  public async executePythonWithResult(script: string): Promise<any> {
    try {
      // Wrap script to capture output so we can parse RESULT: lines reliably
      const wrappedScript = `
import sys
import io
old_stdout = sys.stdout
sys.stdout = buffer = io.StringIO()
try:
    ${script.split('\n').join('\n    ')}
finally:
    output = buffer.getvalue()
    sys.stdout = old_stdout
    if output:
        print(output)
      `.trim()
        .replace(/\r?\n/g, '\n');

      const response = await this.executePython(wrappedScript);

      // Use parseStandardResult for robust RESULT: extraction
      const parsed = parseStandardResult(response);
      if (parsed.data !== null) {
        return parsed.data;
      }

      // If no RESULT: marker found, return the original response
      return response;
    } catch {
      this.log.warn('Python execution failed, trying direct execution');
      return this.executePython(script);
    }
  }

  /** Get the Unreal Engine version via Python and parse major/minor/patch. */
  async getEngineVersion(): Promise<{ version: string; major: number; minor: number; patch: number; isUE56OrAbove: boolean; }> {
    const now = Date.now();
    if (this.engineVersionCache && now - this.engineVersionCache.timestamp < this.ENGINE_VERSION_TTL_MS) {
      return this.engineVersionCache.value;
    }

    try {
      const result = await this.executePythonWithResult(ENGINE_VERSION_SCRIPT);
      const version = String(result?.version ?? 'unknown');
      const major = Number(result?.major ?? 0) || 0;
      const minor = Number(result?.minor ?? 0) || 0;
      const patch = Number(result?.patch ?? 0) || 0;
      const isUE56OrAbove = major > 5 || (major === 5 && minor >= 6);
      const value = { version, major, minor, patch, isUE56OrAbove };
      this.engineVersionCache = { value, timestamp: now };
      return value;
    } catch (error) {
      this.log.warn('Failed to get engine version via Python', error);
      const fallback = { version: 'unknown', major: 0, minor: 0, patch: 0, isUE56OrAbove: false };
      this.engineVersionCache = { value: fallback, timestamp: now };
      return fallback;
    }
  }

  /** Query feature flags (Python availability, editor subsystems) via Python. */
  async getFeatureFlags(): Promise<{ pythonEnabled: boolean; subsystems: { unrealEditor: boolean; levelEditor: boolean; editorActor: boolean; } }> {
    try {
      const res = await this.executePythonWithResult(FEATURE_FLAGS_SCRIPT);
      return {
        pythonEnabled: Boolean(res?.pythonEnabled),
        subsystems: {
          unrealEditor: Boolean(res?.unrealEditor),
          levelEditor: Boolean(res?.levelEditor),
          editorActor: Boolean(res?.editorActor)
        }
      };
    } catch (e) {
      this.log.warn('Failed to get feature flags via Python', e);
      return { pythonEnabled: false, subsystems: { unrealEditor: false, levelEditor: false, editorActor: false } };
    }
  }

  /**
   * Fallback commands when Python is not available
   */
  private async executeFallbackCommand(functionName: string, params?: Record<string, any>): Promise<any> {
    switch (functionName) {
      case 'SPAWN_ACTOR_AT_LOCATION':
        return this.executeConsoleCommand(
          `summon ${params?.class_path || 'StaticMeshActor'} ${params?.x || 0} ${params?.y || 0} ${params?.z || 0}`
        );
      
      case 'DELETE_ACTOR':
        // Use Python-based deletion to avoid unsafe console command and improve reliability
        return this.executePythonWithResult(fillTemplate(PYTHON_TEMPLATES.DELETE_ACTOR, { actor_name: params?.actor_name || '' }));
      
      case 'BUILD_LIGHTING':
        return this.executeConsoleCommand('BuildLighting');
      
      default:
        throw new Error(`No fallback available for ${functionName}`);
    }
  }

  /**
   * SOLUTION 2: Safe ViewMode Switching
   * Prevent crashes by validating and safely switching viewmodes
   * Uses utilities from ./utils/viewmode.js
   */
  async setSafeViewMode(mode: string): Promise<any> {
    const acceptedModes = getAcceptedModes();

    if (typeof mode !== 'string') {
      return {
        success: false,
        error: 'View mode must be provided as a string',
        acceptedModes
      };
    }

    const key = normalizeViewmodeKey(mode);
    if (!key) {
      return {
        success: false,
        error: 'View mode cannot be empty',
        acceptedModes
      };
    }

    const targetMode = VIEWMODE_ALIASES.get(key);
    if (!targetMode) {
      return {
        success: false,
        error: `Unknown view mode '${mode}'`,
        acceptedModes
      };
    }

    if (HARD_BLOCKED_VIEWMODES.has(targetMode)) {
      this.log.warn(`Viewmode '${targetMode}' is blocked for safety. Using alternative.`);
      const alternative = getSafeAlternative(targetMode);
      const altCommand = `viewmode ${alternative}`;
      const altResult = await this.executeConsoleCommand(altCommand);
      const altSummary = this.summarizeConsoleCommand(altCommand, altResult);
      return {
        ...altSummary,
        success: false,
        requestedMode: targetMode,
        viewMode: alternative,
        message: `View mode '${targetMode}' is unsafe in remote sessions. Switched to '${alternative}'.`,
        alternative
      };
    }

    const command = `viewmode ${targetMode}`;
    const rawResult = await this.executeConsoleCommand(command);
    const summary = this.summarizeConsoleCommand(command, rawResult);
    const response: any = {
      ...summary,
      success: summary.returnValue !== false,
      requestedMode: targetMode,
      viewMode: targetMode,
      message: `View mode set to ${targetMode}`
    };

    if (UNSAFE_VIEWMODES.includes(targetMode)) {
      response.warning = `View mode '${targetMode}' may be unstable on some engine versions.`;
    }

    if (summary.output && /unknown|invalid/i.test(summary.output)) {
      response.success = false;
      response.error = summary.output;
    }

    return response;
  }

  /**
   * SOLUTION 3: Command Throttling and Queueing
   * Prevent rapid command execution that can overwhelm the engine
   * Uses CommandQueue class from ./utils/command-queue.js
   */
  private async executeThrottledCommand<T>(
    command: () => Promise<T>, 
    priority: number = CommandPriority.NORMAL
  ): Promise<T> {
    return this.commandQueueInstance.enqueue(command, priority);
  }

  /**
   * SOLUTION 4: Enhanced Asset Creation
   * Use Python scripting for complex asset creation that requires editor scripting
   */
  async createComplexAsset(assetType: string, params: Record<string, any>): Promise<any> {
    const assetCreators: Record<string, string> = {
      'Material': 'MaterialFactoryNew',
      'MaterialInstance': 'MaterialInstanceConstantFactoryNew',
      'Blueprint': 'BlueprintFactory',
      'AnimationBlueprint': 'AnimBlueprintFactory',
      'ControlRig': 'ControlRigBlueprintFactory',
      'NiagaraSystem': 'NiagaraSystemFactoryNew',
      'NiagaraEmitter': 'NiagaraEmitterFactoryNew',
      'LandscapeGrassType': 'LandscapeGrassTypeFactory',
      'PhysicsAsset': 'PhysicsAssetFactory'
    };

    const factoryClass = assetCreators[assetType];
    if (!factoryClass) {
      throw new Error(`Unknown asset type: ${assetType}`);
    }

    const createParams = {
      factory_class: factoryClass,
      asset_class: `unreal.${assetType}`,
      asset_name: params.name || `New${assetType}`,
      package_path: params.path || '/Game/CreatedAssets',
      ...params
    };

    return this.executeEditorFunction('CREATE_ASSET', createParams);
  }

  /**
   * Start the command processor
   * Uses CommandQueue class from ./utils/command-queue.js
   */
  private startCommandProcessor(): void {
    // Start periodic queue processing using CommandQueue instance
    this.commandQueueInstance.startPeriodicProcessing(1000);

    // Clean console cache every 5 minutes
    setInterval(() => {
      this.cleanConsoleCache();
    }, this.CONSOLE_CACHE_TTL);
  }

  /**
   * Clean expired entries from console object cache
   */
  private cleanConsoleCache(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of this.consoleObjectCache.entries()) {
      if (now - (value.timestamp || 0) > this.CONSOLE_CACHE_TTL) {
        this.consoleObjectCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.log.debug(`Cleaned ${cleaned} expired console cache entries`);
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch command execution with proper delays
   */
  async executeBatch(commands: Array<{ command: string; priority?: number }>): Promise<any[]> {
    return this.executeConsoleCommands(commands.map(cmd => cmd.command));
  }

  /**
   * Get safe console commands for common operations
   * Uses SAFE_COMMANDS from ./utils/safe-commands.js
   */
  getSafeCommands(): Record<string, string> {
    return { ...SAFE_COMMANDS };
  }
}
