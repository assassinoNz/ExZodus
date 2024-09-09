import { z } from "zod";

/**
 * All methods supported by the type system, ExZodusClient and ExZodusRouter
 */
export const METHODS = ["get", "post", "put", "delete", "patch"] as const;

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
export type EndpointInputs<A extends Api, M extends MethodByPath<A, P>, P extends Path<A>> = A[P][M] extends { parameters: infer T; request: infer R }
    ? T & { body: R }
    : never;

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