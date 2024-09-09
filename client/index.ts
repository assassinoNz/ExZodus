import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import type { Api, ResponseCode, MethodByPath, Path, PathByMethod, ResponseBody, DefaultResponseBody, Method } from "../core/index.js";
import type { ConfigParam } from "../core/client.js";

/**
 * Api aware type-safe wrapper around Axios
 */
export class ExZodusClient<A extends Api> {
    public readonly axios: AxiosInstance;

    constructor(baseURL: string) {
        this.axios = axios.create({ baseURL });
    }

    async get<P extends PathByMethod<A, "get">>(path: P, ...[config]: ConfigParam<A, "get", P>) {
        const axiosConfig = ExZodusClient.buildAxiosConfig("get", path, config);
        const res = await this.axios.request<DefaultResponseBody<A, "get", P>>(axiosConfig);
        return res.data;
    }

    async post<P extends PathByMethod<A, "post">>(path: P, ...[config]: ConfigParam<A, "post", P>) {
        const axiosConfig = ExZodusClient.buildAxiosConfig("post", path, config);
        const res = await this.axios.request<DefaultResponseBody<A, "post", P>>(axiosConfig);
        return res.data;
    }

    async put<P extends PathByMethod<A, "put">>(path: P, ...[config]: ConfigParam<A, "put", P>) {
        const axiosConfig = ExZodusClient.buildAxiosConfig("put", path, config);
        const res = await this.axios.request<DefaultResponseBody<A, "put", P>>(axiosConfig);
        return res.data;
    }

    async patch<P extends PathByMethod<A, "patch">>(path: P, ...[config]: ConfigParam<A, "patch", P>) {
        const axiosConfig = ExZodusClient.buildAxiosConfig("patch", path, config);
        const res = await this.axios.request<DefaultResponseBody<A, "patch", P>>(axiosConfig);
        return res.data;
    }

    async delete<P extends PathByMethod<A, "delete">>(path: P, ...[config]: ConfigParam<A, "delete", P>) {
        const axiosConfig = ExZodusClient.buildAxiosConfig("delete", path, config);
        const res = await this.axios.request<DefaultResponseBody<A, "delete", P>>(axiosConfig);
        return res.data;
    }

    isErrorOf<M extends MethodByPath<A, P>, P extends Path<A>, C extends ResponseCode<A, M, P>>(err: unknown, method: M, path: P, code: C): err is AxiosError<ResponseBody<A, M, P, C>> & { response: { data: ResponseBody<A, M, P, C> } } {
        if (!(err instanceof AxiosError)) {
            return false;
        }

        const axiosErr = err as AxiosError<ResponseBody<A, M, P, C>>;

        if (axiosErr.config?.method !== method) {
            return false;
        }

        if (axiosErr.config?.url !== path) {
            return false;
        }

        if (axiosErr.response?.status !== code) {
            return false;
        }

        return true;
    }

    private static replacePathParams(url: string, path: Record<string, string | number>) {
        let modifiedUrl: string = url;
        Object.keys(path).forEach(key => {
            modifiedUrl = modifiedUrl.replace(`:${key}`, path[key].toString());
        });
        return modifiedUrl;
    }

    private static buildAxiosConfig<M extends Method>(method: M, path: any, config?: Record<string, any>) {
        if (!config) {
            //CASE: No config provided
            //NOTE: There must be no path parameters in the url. Safe to return url unmodified.
            return {
                method,
                url: path
            } satisfies AxiosRequestConfig;
        }

        //CASE: Config provided
        return {
            method,
            url: "path" in config ? this.replacePathParams(path, config["path"]) : path,
            headers: config["header"],
            params: config["query"],
            data: config["body"],
            responseType: config["responseType"]
        } satisfies AxiosRequestConfig;
    }
}