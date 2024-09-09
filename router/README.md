# ExZodus

ExZodus provides a type-safe Axios client wrapper and an Express router with auto-completion features backed by [Zod](https://github.com/colinhacks/zod) schemas. This project is heavily inspired by the [Zodios](https://www.zodios.org) project.

## Why ExZodus?

The existence of this project is due to following factors.

- The wrappers provided by the Zodios project caused heavy TS-Server performance issues leading to `Type instantiation is excessively deep and possibly infinite.ts(2589)` errors.
- The api definition structure required by Zodios seems limited.

## Can this replace Zodios?
Absolutely not.

- If your workflow didn't encounter above mentioned problems, you should a definitely use Zodios. It is well documented and established.

- Zodios has many more features that won't be included in the scope of this project.

## How to use?

### 1. Installation
```bash
npm i @assassinonz/exzodus
```

### 2. Schema definition
- Use `@kubb/swagger-zod` to generate the API schema using an `openapi.yaml` file or hand write it.

- The API schema is typed as follows.
```typescript
type Path = string;
type Method = string;
type Api = Record<Path, Record<Method, {
    request: z.ZodType | undefined;
    parameters: {
        path: z.ZodType | undefined;
        query: z.ZodType | undefined;
        header: z.ZodType | undefined;
    };
    responses: Record<number | "default", z.ZodType>;
    errors: Record<number, z.ZodType>;
}>>;
```

- An example schema looks as follows.
```typescript
export const paths = {
    "/users/:id": {
        get: {
            request: undefined,
            parameters: {
                path: z.object({ "id": z.coerce.number.int() }),
                query: undefined,
                header: undefined
            },
            responses: {
                200: z.object({ "id": z.number.int(),  "name": z.string() }),
                404: z.object({ "message": z.string() })
                default: z.object({ "id": z.number.int(),  "name": z.string() })
            },
            errors: {
                404: z.object({ "message": z.coerce.string() })
            }
        },
    }
}
```

### 3. Using ExZodusRouter

```typescript
import { paths } from "../../kubb/zod/operations.js";
import { express, ExZodusRouter } from "@assassinonz/exzodus-router";


//             @kubb/swagger-zod generated API schema
//                                 ▼
const router = ExZodusRouter.new(paths, {
    //Provide error handler for Zod errors
    errorHandler: (err, req, res) => {
        //TODO: Handle errors
    },

    //Enable response validation to prevent unintentional data leaks
    attachResponseValidator: true
});


//  auto-complete path  fully typed and validated input params (body, query, params)
//             ▼           ▼    ▼
router.get("/users/:id", (req, res) => {
    const user = findUserById(req.params.id);

    if (!user) {
        //Allows only documented response codes
        //Response is typed from the body of 404 response
        //                 ▼
        return res.status(404).json({
            message: "User not found"
        });
    }

    //Response is typed from the body of 200 response
    //                 ▼
    return res.status(200).json({
        id: user.id,
        name: user.name,
        password: user.password
    });
});


const app = express();
app.use(express.json());
app.use("/api/v1", router);
```
### 4. Using ExZodusClient
Calling this API is now easy and has builtin autocomplete features :  
  
```typescript
import { paths } from "../../kubb/zod/operations.js";
import { ExZodusClient } from "@assassinonz/exzodus-client";


//                    @kubb/swagger-zod generated API schema
//                                        ▼
const client = new ExZodusClient<typeof paths>("http://localhost:8080/api/v1");


//   typed                auto-complete path   auto-complete params
//     ▼                           ▼                   ▼
const user = await client.get("/users/:id", { path: { id: 7 } });
console.log(user);
```

### 5. Output
This should output the following. Note the missing password field due to the `attachResponseValidator` option.
```typescript
{
    id: 7,
    name: "John Doe"
}
```