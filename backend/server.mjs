import express from 'express';
import pg from 'pg';
import {handleApi} from '../lib/server/api.ts';
const app=express(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
app.disable('x-powered-by');
app.use(express.text({type:'application/json',limit:'8kb'}));
app.use(async(req,res)=>{
 try{
  const proto=process.env.COOKIE_SECURE==='true'?'https':'http';
  const url=`${proto}://${req.headers.host}${req.originalUrl}`;
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  const request=new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:typeof req.body==='string'?req.body:'{}'});
  const response=await handleApi(request,{async query(sql,args=[]){let i=0;const query=sql.replace(/\?/g,()=>'$'+(++i));return (await pool.query(query,args)).rows;}},{secure:process.env.COOKIE_SECURE==='true',ip:req.headers['x-forwarded-for']?.toString().split(',')[0].trim()||req.socket.remoteAddress});
  response.headers.forEach((v,k)=>res.setHeader(k,v));res.status(response.status).send(await response.text());
 }catch(e){console.error(e);res.status(500).json({error:'Server unavailable.'})}
});
app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.status===413?'Request too large.':'Invalid request.'}));
const server=app.listen(3000,'0.0.0.0',()=>console.log('The Last Knight API listening on :3000'));
process.on('SIGTERM',()=>server.close(()=>{void pool.end().then(()=>process.exit(0))}));
