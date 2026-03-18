import {
  HttpProxyRequestProps,
  HttpProxyResponse,
  httpRequest,
  HttpMethod,
  BatchHttpProxyRequestProps,
  BatchHttpProxyResponse,
  batchHttpRequest,
} from "../http";

/**
 * @public
 */
export interface RestConnectorProps {
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * @public
 *
 * REST Connector for SDK
 *
 * Provides a simple interface for making REST API calls with configurable
 * base URL and headers. All requests go through the Lightyear HTTP proxy.
 */
export class RestConnector {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(props: RestConnectorProps = {}) {
    this.baseUrl = props.baseUrl || "";

    // Default headers
    const defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    this.headers = { ...defaultHeaders, ...props.headers };
  }

  /**
   * Get the configured base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the default headers for requests
   */
  getDefaultHeaders(): Record<string, string> {
    return { ...this.headers };
  }

  /**
   * Build the full URL by combining base URL and endpoint
   */
  private buildUrl(url: string): string {
    if (!url) {
      throw new Error("URL is required for REST connector requests");
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url; // Already a full URL
    }

    if (!this.baseUrl) {
      return url;
    }

    const base = this.baseUrl.endsWith("/")
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;
    const endpoint = url.startsWith("/") ? url : `/${url}`;

    return `${base}${endpoint}`;
  }

  /**
   * Make a proxied HTTP request
   */
  async request(props: HttpProxyRequestProps): Promise<HttpProxyResponse> {
    if (!props) {
      throw new Error("Request props are required");
    }

    const {
      method,
      url,
      params,
      headers,
      /** @deprecated prefer `json` */
      data,
      body,
      json,
      redactKeys,
      maxRetries,
      async: asyncRequest,
      syncInfo,
    } = props as HttpProxyRequestProps & { json?: unknown };

    if (!url) {
      throw new Error("URL is required for REST connector requests");
    }

    const requestProps: HttpProxyRequestProps = {
      method,
      url: this.buildUrl(url),
      params,
      headers: {
        ...this.getDefaultHeaders(),
        ...headers,
      },
      // Prefer explicit body; also pass `json` for the http layer to set headers
      json: json ?? data,
      body,
      redactKeys,
      maxRetries,
      async: asyncRequest,
      syncInfo,
    };

    return await httpRequest(requestProps);
  }

  /**
   * Make a GET request
   */
  async get(props: {
    url: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    redactKeys?: string[];
    maxRetries?: number;
  }): Promise<HttpProxyResponse> {
    return this.request({
      method: "GET",
      ...props,
    });
  }

  /**
   * Make a POST request
   */
  async post(props: {
    url: string;
    data?: object;
    json?: unknown;
    body?: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    redactKeys?: string[];
    maxRetries?: number;
  }): Promise<HttpProxyResponse> {
    return this.request({
      method: "POST",
      ...props,
    });
  }

  /**
   * Make a PUT request
   */
  async put(props: {
    url: string;
    data?: object;
    json?: unknown;
    body?: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    redactKeys?: string[];
    maxRetries?: number;
  }): Promise<HttpProxyResponse> {
    return this.request({
      method: "PUT",
      ...props,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch(props: {
    url: string;
    data?: object;
    json?: unknown;
    body?: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    redactKeys?: string[];
    maxRetries?: number;
  }): Promise<HttpProxyResponse> {
    return this.request({
      method: "PATCH",
      ...props,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete(props: {
    url: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    redactKeys?: string[];
    maxRetries?: number;
  }): Promise<HttpProxyResponse> {
    return this.request({
      method: "DELETE",
      ...props,
    });
  }

  /**
   * Make batch requests asynchronously
   */
  async batchRequest(props: {
    requests: Array<HttpProxyRequestProps>;
    syncId?: string;
  }): Promise<BatchHttpProxyResponse> {
    // Prepare requests with full URLs
    const preparedRequests = props.requests.map((req) => ({
      ...req,
      url: this.buildUrl(req.url),
      headers: {
        ...this.getDefaultHeaders(),
        ...req.headers,
      },
    }));

    return await batchHttpRequest({
      requests: preparedRequests,
      syncId: props.syncId,
    });
  }
}
