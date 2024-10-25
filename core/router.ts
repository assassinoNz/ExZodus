import express from "express";
import { z } from "zod";
import type { Api, EndpointInputs, MethodByPath, Path, PathByMethod, ResponseBody, ResponseCode } from "./index.js";

//Override express IRouterMatcher to accept TypedRouter instances in app.use() calls
declare module "express-serve-static-core" {
    interface IRouterMatcher<
        T,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Method extends "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head" = any,
    > {
        // eslint-disable-next-line @typescript-eslint/prefer-function-type
        (path: PathParams, ...handlers: (RequestHandlerParams | TypedRouter<never, unknown>)[]): T;
    }
}

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
 * Type-safe version of the express.RequestHandler aware of the types involved in the given endpoint
 */
type TypedRequestHandler<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>, Context> = (
    req: ValidatorParsedEndpointInputs<A, M, P> extends { path: infer ReqP; body: infer ReqB; query: infer ReqQ } ? express.Request<
        ReqP,
        unknown,
        ReqB,
        ReqQ
    > & { ctx?: Context } : express.Request<never, never, never, never> & { ctx?: Context },

    res: Omit<express.Response, "status"> & { status: <C extends ResponseCode<A, M, P>>(code: C) => express.Response<ResponseBody<A, M, P, C>> },

    next: express.NextFunction
) => unknown | Promise<unknown>;

/**
 * Context-aware version of the express.RequestHandler
 */
export type RequestHandlerWithContext<Context> = (req: express.Request & { ctx?: Context }, res: express.Response, next: express.NextFunction) => unknown | Promise<unknown>;

/**
 * Type-safe version of the express.Router aware of the types in the given Api
 */
export interface TypedRouter<A extends Api, Context> {
    get: <P extends PathByMethod<A, "get">>(path: P, ...handlers: TypedRequestHandler<A, "get", P, Context>[]) => this;
    post: <P extends PathByMethod<A, "post">>(path: P, ...handlers: TypedRequestHandler<A, "post", P, Context>[]) => this;
    put: <P extends PathByMethod<A, "put">>(path: P, ...handlers: TypedRequestHandler<A, "put", P, Context>[]) => this;
    patch: <P extends PathByMethod<A, "patch">>(path: P, ...handlers: TypedRequestHandler<A, "patch", P, Context>[]) => this;
    delete: <P extends PathByMethod<A, "delete">>(path: P, ...handlers: TypedRequestHandler<A, "delete", P, Context>[]) => this;
    use: (path: string, ...handlers: RequestHandlerWithContext<never>[]) => this;
}