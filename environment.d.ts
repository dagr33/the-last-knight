interface D1Statement { bind(...values:unknown[]):D1Statement; all():Promise<{results:any[]}> }
interface D1Database { prepare(sql:string):D1Statement; batch(statements:D1Statement[]):Promise<any[]>; exec(sql:string):Promise<any> }
interface Fetcher { fetch(request:Request):Promise<Response> }
declare module 'cloudflare:workers' { export const env:{DB:D1Database;ASSETS?:Fetcher} }
