import {env} from 'cloudflare:workers';
import {handleApi} from '../../../lib/server/api';
export const dynamic='force-dynamic';
async function route(request:Request){return handleApi(request,{async query(sql,args=[]){const result=await (env.DB as any).prepare(sql).bind(...args).all();return result.results??[];}},{secure:new URL(request.url).protocol==='https:',ip:request.headers.get('cf-connecting-ip')||'unknown'})}
export const GET=route;export const POST=route;
