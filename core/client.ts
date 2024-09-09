import { z } from "zod";
import type { Api, EndpointInputs, MethodByPath, Path } from "./index.js";

/**
 * Mark all properties that can be assigned undefined as optional
 */
type MarkUndefinedableKeysAsOptional<T> = {
    [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
} & {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

/**
 * Removes all keys with never
 */
type RmNever<T> = {[K in keyof T as T[K] extends never ? never : K]: T[K]};

/**
 * Inputs dictionary accepted by the express route handler of the given endpoint
 */
type AcceptedEndpointInputs<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = {
    [K in keyof EndpointInputs<A, M, P>]: EndpointInputs<A, M, P>[K] extends z.ZodType
    ? z.input<EndpointInputs<A, M, P>[K]>
    : never
};

/**
 * Config dictionary required by the Axios wrapper to make a request to the given endpoint.
 * Keys that can be assigned undefined will be marked as optional.
 * All implicit headers that are not in the API are also specified here.
 */
type ClientConfig<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = MarkUndefinedableKeysAsOptional<RmNever<AcceptedEndpointInputs<A, M, P>>> & {
    header?: {
        "Authorization"?: string;
        "Content-Type"?: string;
    };
    responseType?: "text" | "json" | "blob" | "arraybuffer" | "stream" | "document";
};

/**
 * Config parameter required by the Axios wrapper functions to make a request to the given endpoint.
 * This is for the added DX which allows omitting passing an empty config object when all keys are optional.
 */
export type ConfigParam<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = Partial<ClientConfig<A, M, P>> extends ClientConfig<A, M, P> ? [config?: ClientConfig<A, M, P>] : [config: ClientConfig<A, M, P>];