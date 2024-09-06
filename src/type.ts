import express from "express";
import { z } from "zod";

//Override express IRouterMatcher to accept TypedRouter instances in app.use() calls
declare module "express-serve-static-core" {
    interface IRouterMatcher<
        T,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Method extends "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head" = any,
    > {
        // eslint-disable-next-line @typescript-eslint/prefer-function-type
        (path: PathParams, ...handlers: (RequestHandlerParams | TypedRouter<never>)[]): T;
    }
}

/**
 * All methods supported by the type system, ExZodusClient and ExZodusRouter
 */
export const METHODS = ["get", "post", "put", "delete", "patch"] as const;

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
 * Type of the apiDefinition
 */
export type Api = Record<string, Record<string, {
    request: z.ZodType | undefined;
    parameters: {
        path: z.ZodType | undefined;
        query: z.ZodType | undefined;
        header: z.ZodType | undefined;
    };
    responses: Record<number | "default", z.ZodType>;
    errors: Record<number, z.ZodType>;
}>>;

/**
 * Union of all methods supported by the type system
 */
export type Method = (typeof METHODS)[number];


/**
 * Union of all the paths defined in the API of the system
 */
export type Path<A extends Api> = keyof A;

/**
 * Union of all methods supported by the given path
 */
export type MethodByPath<A extends Api, P extends Path<A>> = keyof A[P];

/**
 * Union of all paths supported by the given method
 */
export type PathByMethod<A extends Api, M extends Method> = keyof { [P in Path<A> as A[P] extends { [K in M]: unknown } ? P : never]: A[P] };

/**
 * Inputs dictionary needed to make a request to the given endpoint
 */
type EndpointInputs<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = A[P][M] extends { parameters: infer T; request: infer R }
    ? T & { body: R }
    : never;

/**
 * Inputs dictionary available inside the express route handler of the given endpoint after parsed by zod
 */
type ZodParsedEndpointInputs<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = {
    [K in keyof EndpointInputs<A, M, P>]: EndpointInputs<A, M, P>[K] extends z.ZodType
    ? z.output<EndpointInputs<A, M, P>[K]>
    : never
};

/**
 * Inputs dictionary available inside the express route handler of the given endpoint after parsed by the validator middleware.
 * Since the validator middleware ensures req.query, req.body, and req.params are non-nullable, we can safely mark them as non-nullable
 */
type ValidatorParsedEndpointInputs<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = { [K in keyof ZodParsedEndpointInputs<A, M, P>]: NonNullable<ZodParsedEndpointInputs<A, M, P>[K]> };

/**
 * Responses dictionary of the given endpoint
 */
type EndpointResponses<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = A[P][M] extends { responses: infer T }
    ? T
    : never;

/**
 * Union of all response codes possible by the given endpoint
 */
export type ResponseCode<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = Exclude<keyof EndpointResponses<A, M, P>, "default">;

/**
 * Response body of the given endpoint and response code
 */
export type ResponseBody<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>, C extends ResponseCode<A, M, P>> = EndpointResponses<A, M, P>[C] extends z.ZodType ? z.infer<EndpointResponses<A, M, P>[C]> : never;

/**
 * Default response body of the given endpoint
 */
export type DefaultResponseBody<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = EndpointResponses<A, M, P> extends { default: infer T } ? T extends z.ZodType ? z.infer<T> : never : never;

/**
 * Type-safe version of the express.RequestHandler aware of the types involved in the given endpoint
 */
type TypedRequestHandler<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = (
    req: ValidatorParsedEndpointInputs<A, M, P> extends { path: infer ReqP; body: infer ReqB; query: infer ReqQ } ? express.Request<
        ReqP,
        unknown,
        ReqB,
        ReqQ
    > : express.Request<never, never, never, never>,

    res: Omit<express.Response, "status"> & { status: <C extends ResponseCode<A, M, P>>(code: C) => express.Response<ResponseBody<A, M, P, C>> },

    next: express.NextFunction
) => void;

/**
 * Type-safe version of the express.Router aware of the types in the given Api
 */
export interface TypedRouter<A extends Api> {
    get: <P extends PathByMethod<A, "get">>(path: P, ...handlers: TypedRequestHandler<A, "get", P>[]) => this;
    post: <P extends PathByMethod<A, "post">>(path: P, ...handlers: TypedRequestHandler<A, "post", P>[]) => this;
    put: <P extends PathByMethod<A, "put">>(path: P, ...handlers: TypedRequestHandler<A, "put", P>[]) => this;
    patch: <P extends PathByMethod<A, "patch">>(path: P, ...handlers: TypedRequestHandler<A, "patch", P>[]) => this;
    delete: <P extends PathByMethod<A, "delete">>(path: P, ...handlers: TypedRequestHandler<A, "delete", P>[]) => this;
    use: (path: string, ...handlers: express.RequestHandler[]) => this;
}

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