import express from "express";
import { z } from "zod";
import { PathParams, RequestHandler } from "express-serve-static-core";
import { METHODS } from "../core/index.js";
import type { Api, Path } from "../core/index.js";
import type { TypedRouter } from "../core/router.js";

export { express }

/**
 * Api aware type-safe wrapper around express.Router() with server-side request and response validation
 */
export class ExZodusRouter {
    //WARNING: Make constructor private 
    private constructor() {
        //Since this cannot be used by anyone, do nothing
    }

    static new<A extends Api>(apiDef: A, config: {
        attachResponseValidator: boolean;
        errorHandler: (err: unknown, req: express.Request, res: express.Response) => void;
    }) {
        const router = express.Router();

        //Modify methods
        for (const method of METHODS) {
            //Save the original express handler registrar function
            const originalHandlerRegistrar = router[method].bind(router);

            //Override the original handler registrar to register additional middleware
            router[method] = (path: PathParams, ...handlers: any[]) => {
                const routeDescription = apiDef[path as Path<A>]?.[method] ?? undefined;

                if (!routeDescription) {
                    //CASE: The called route is not an OpenAPI defined route
                    //Don't add any middleware before it
                    return originalHandlerRegistrar(path, handlers);
                }

                //Define the function to be used as the request validation middleware
                const requestValidator: RequestHandler = (req, res, next) => {
                    try {
                        if (routeDescription?.parameters?.path) {
                            //CASE: Has path params to validate
                            req.params = routeDescription.parameters.path.parse(req.params);
                        } else {
                            //CASE: No path params to validate. So params must be an empty object
                            req.params = z.object({}).parse(req.params);
                        }

                        if (routeDescription?.parameters?.query) {
                            //CASE: Has query params to validate
                            //Only coerce "true" and "false" values as other coercions will be done by Zod
                            for (const key of Object.keys(req.query)) {
                                if (req.query[key] === "true") {
                                    req.query[key] = true as never;
                                } else if (req.query[key] === "false") {
                                    req.query[key] = false as never;
                                }
                            }

                            req.query = routeDescription.parameters.query.parse(req.query);
                        } else {
                            //CASE: No query params to validate. So query must be an empty object
                            req.query = z.object({}).parse(req.query);
                        }

                        if (req.headers["content-type"] === "application/json" && routeDescription?.request) {
                            //CASE: Has request body to validate
                            req.body = routeDescription.request.parse(req.body);
                        } else {
                            //CASE: No request body to validate.
                            //DANGER: Don't modify the body of the request
                        }

                        return next();
                    } catch (err) {
                        config.errorHandler(err, req, res);
                    }
                };

                //Define the function to be used as the response validation middleware
                //NOTE: This function overrides res.json() to validate the response body
                const responseValidator: RequestHandler = (_req, res, next) => {
                    //Save the original res.json() to be used after override
                    const originalJson = res.json;

                    //WARNING: Don't use an arrow function here due to the loss of correct "this" reference
                    res.json = function (body: unknown) {
                        try {
                            const parsedBody = routeDescription.responses?.[res.statusCode]?.parse(body) ?? body;
                            return originalJson.call(this, parsedBody);
                        } catch {
                            res.status(500);
                            return originalJson.call(this, {
                                status: "Internal server error",
                                message: "Server generated response is out of API spec"
                            });
                        }
                    };

                    return next();
                };

                if (config.attachResponseValidator) {
                    //Add both request validation and response validation middleware before all other handlers
                    return originalHandlerRegistrar(path, requestValidator, responseValidator, handlers);
                } else {
                    //Add only the request validation middleware before all other handlers
                    return originalHandlerRegistrar(path, requestValidator, handlers);
                }
            };
        }

        return router as unknown as TypedRouter<A>;
    }
}