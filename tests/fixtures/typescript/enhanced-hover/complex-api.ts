/**
 * Example API Server demonstrating complex TypeScript class structure
 * that should be parsed correctly by the enhanced hover functionality.
 */

export interface ServerOptions {
  port: number;
  host: string;
  ssl?: boolean;
}

export interface CallbackFunction<T> {
  (data: T): void;
}

export interface ComplexConfig {
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  handlers?: {
    onSuccess?: CallbackFunction<string>;
    onError?: CallbackFunction<Error>;
  };
}

/**
 * A complex API server class with various method signatures
 * to test the enhanced hover parsing capabilities.
 */
export class APIServer<TContext = unknown> {
  /**
   * The server's current configuration
   */
  readonly config: ServerOptions;
  
  /**
   * Internal server instance (private - should not appear in hover)
   */
  private _serverInstance: unknown;
  
  /**
   * Public server status
   */
  public isRunning: boolean = false;

  /**
   * Creates a new API server instance
   */
  constructor(config: ServerOptions, context?: TContext) {
    this.config = config;
    this._serverInstance = null;
  }

  /**
   * Starts the server - simple method with no parameters
   */
  start(): Promise<void> {
    this.isRunning = true;
    return Promise.resolve();
  }

  /**
   * Stops the server with optional timeout
   */
  async stop(timeout?: number): Promise<boolean> {
    this.isRunning = false;
    return true;
  }

  /**
   * Registers a route handler with complex configuration object
   */
  registerRoute<TRequest, TResponse>(
    path: string,
    config: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      middleware?: Array<(req: TRequest) => void>;
      validation?: {
        body?: Record<string, unknown>;
        query?: Record<string, string>;
      };
      rateLimit?: {
        max: number;
        windowMs: number;
      };
    },
    handler: (req: TRequest) => Promise<TResponse>
  ): void {
    // Implementation would go here
  }

  /**
   * Configures the server with a complex configuration object
   */
  configure<T extends Record<string, unknown>>(
    settings: ComplexConfig & T
  ): this {
    return this;
  }

  /**
   * Generic method with multiple type parameters
   */
  transform<TInput, TOutput, TContext>(
    input: TInput,
    transformer: (data: TInput, context: TContext) => TOutput,
    context: TContext
  ): Promise<TOutput> {
    return Promise.resolve(transformer(input, context));
  }

  /**
   * Method with union types and optional parameters
   */
  handleEvent(
    eventType: 'connect' | 'disconnect' | 'error',
    data?: string | Error,
    callback?: CallbackFunction<unknown>
  ): void {
    callback?.(data);
  }

  /**
   * Static factory method
   */
  static create<T>(config: ServerOptions, context?: T): APIServer<T> {
    return new APIServer(config, context);
  }

  /**
   * Method that returns this class type
   */
  clone(): APIServer<TContext> {
    return new APIServer(this.config);
  }
}

// Test instance variables for hover testing
const serverInstance = new APIServer<string>({ port: 3000, host: 'localhost' }, 'test-context');

/**
 * Another instance with complex configuration for testing hover on instances
 */
const productionServer = APIServer.create({ port: 8080, host: '0.0.0.0', ssl: true }, { env: 'production' });