import { ServerPlugin } from '.'
import { IKoaProxiesOptions } from 'koa-proxies'
import type { ServerOptions as HttpProxyServerOptions } from 'http-proxy'
export declare type ProxiesOptions = IKoaProxiesOptions & HttpProxyServerOptions
export declare const proxyPlugin: ServerPlugin
