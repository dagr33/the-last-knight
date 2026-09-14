import {validateResult} from '../game/rules.ts';
export interface Database {query(sql:string,args?:unknown[]):Promise<any[]>}
const enc=new TextEncoder();
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function passwordHash(password:string,salt=crypto.randomUUID()){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const value=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256));return salt+':'+value;
}
function constantEqual(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
class ApiError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}
const bad=(s:number,m:string):never=>{throw new ApiError(s,m)};
export async function handleApi(req:Request,db:Database,options:{secure?:boolean,ip?:string}={}){
 const url=new URL(req.url),path=url.pathname.replace(/^\/api/,'');const now=Math.floor(Date.now()/1000);
 const json=(body:any,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
 const cookie=(token:string,age:number)=>`knight_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${options.secure?'; Secure':''}`;
 try{
 if(req.method!=='GET'){
  if(req.headers.get('x-knight-request')!=='1')bad(403,'Request verification failed.');
  const origin=req.headers.get('origin');if(origin&&origin!==url.origin)bad(403,'Cross-origin request rejected.');
  if(!req.headers.get('content-type')?.includes('application/json'))bad(415,'Use JSON.');
 }
 let body:any={};if(req.method!=='GET'){
  const raw=await req.text();if(raw.length>8192)bad(413,'Request too large.');try{body=JSON.parse(raw||'{}')}catch{bad(400,'Invalid JSON.')}
 }
 const token=req.headers.get('cookie')?.match(/(?:^|;\s*)knight_session=([^;]+)/)?.[1];
 let user:any=null;
 if(token){const rows=await db.query('SELECT u.id,u.username FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[await hash(token),now]);user=rows[0]??null;}
 const requireUser=()=>{if(!user)bad(401,'Sign in to save your run.');return user};
 if(path==='/health'&&req.method==='GET'){await db.query('SELECT 1 AS ok');return json({status:'ok',database:'ready'})}
 if(path==='/me'&&req.method==='GET')return json({user});
 if(['/auth/register','/auth/login'].includes(path)&&req.method==='POST'){
  const window=Math.floor(now/900),key='auth:'+await hash(options.ip||'local')+':'+window;
  const rows=await db.query('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT (key) DO UPDATE SET count=rate_limits.count+1 RETURNING count',[key,now+900]);
  if(rows[0].count>20)bad(429,'Too many attempts. Try again in 15 minutes.');
  await db.query('DELETE FROM rate_limits WHERE expires_at<?',[now]);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<8||password.length>128)bad(400,'Use a valid email and a password of 8–128 characters.');
  let found:any;
  if(path==='/auth/register'){
   const username=typeof body.username==='string'?body.username.trim():'';
   if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))bad(400,'Knight name: 3–20 letters, numbers or underscores.');
   if((await db.query('SELECT id FROM users WHERE email=? OR LOWER(username)=LOWER(?)',[email,username])).length)bad(409,'Email or knight name is already in use.');
   found={id:crypto.randomUUID(),username};
   try{await db.query('INSERT INTO users (id,username,email,password_hash,created_at) VALUES (?,?,?,?,?)',[found.id,username,email,await passwordHash(password),now])}catch(e){if(/unique|duplicate/i.test(String(e)))bad(409,'Email or knight name is already in use.');throw e}
  }else{
   found=(await db.query('SELECT * FROM users WHERE email=?',[email]))[0];
   const expected=found?.password_hash||'dummy:invalid';
   const calculated=await passwordHash(password,expected.split(':')[0]);
   if(!found||!constantEqual(calculated,expected))bad(401,'Email or password is incorrect.');
  }
  const session=crypto.randomUUID()+crypto.randomUUID();await db.query('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',[await hash(session),found.id,now+604800]);
  await db.query('DELETE FROM auth_sessions WHERE expires_at<?',[now]);
  return json({user:{id:found.id,username:found.username}},200,{'Set-Cookie':cookie(session,604800)});
 }
 if(path==='/auth/logout'&&req.method==='POST'){if(token)await db.query('DELETE FROM auth_sessions WHERE token_hash=?',[await hash(token)]);return json({ok:true},200,{'Set-Cookie':cookie('',0)})}
 if(path==='/games/start'&&req.method==='POST'){
  requireUser();const last=(await db.query('SELECT started_at FROM games WHERE user_id=? ORDER BY started_at DESC LIMIT 1',[user.id]))[0];
  if(last&&now-last.started_at<2)bad(429,'Wait a moment before starting again.');
  const id=crypto.randomUUID();await db.query('INSERT INTO games (id,user_id,started_at) VALUES (?,?,?)',[id,user.id,now]);return json({id});
 }
 if(path==='/games/finish'&&req.method==='POST'){
  requireUser();if(typeof body.gameId!=='string')bad(400,'Missing game.');
  const game=(await db.query('SELECT * FROM games WHERE id=? AND user_id=?',[body.gameId,user.id]))[0];if(!game)bad(404,'Game not found.');
  if((await db.query('SELECT id FROM results WHERE game_id=?',[game.id])).length)bad(409,'This run has already been saved.');
  let result;try{result=validateResult(body,now-game.started_at)}catch(e){bad(400,(e as Error).message)}
  const r=result!;try{await db.query('INSERT INTO results (id,game_id,user_id,score,wave,kills,duration,created_at) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),game.id,user.id,r.score,r.wave,r.kills,r.duration,now])}catch(e){if(/unique|duplicate/i.test(String(e)))bad(409,'This run has already been saved.');throw e}
  return json({saved:true,...r});
 }
 if(path==='/leaderboard'&&req.method==='GET'){
  const ranked=`WITH best AS (SELECT r.*,u.username,ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.score DESC,r.wave DESC,r.created_at ASC,r.id ASC) AS rn FROM results r JOIN users u ON u.id=r.user_id), ranked AS (SELECT user_id,username,score,wave,created_at,ROW_NUMBER() OVER (ORDER BY score DESC,wave DESC,created_at ASC,id ASC) AS rank FROM best WHERE rn=1)`;
  const entries=await db.query(ranked+' SELECT * FROM ranked ORDER BY rank LIMIT 100');
  const me=user?(await db.query(ranked+' SELECT * FROM ranked WHERE user_id=?',[user.id]))[0]??null:null;
  return json({entries,me});
 }
 if(path==='/profile'&&req.method==='GET'){
  requireUser();const stats=(await db.query('SELECT COUNT(*) AS games,COALESCE(MAX(score),0) AS best,COALESCE(SUM(kills),0) AS kills FROM results WHERE user_id=?',[user.id]))[0];
  const history=await db.query('SELECT score,wave,kills,duration,created_at FROM results WHERE user_id=? ORDER BY created_at DESC LIMIT 20',[user.id]);return json({user,stats,history});
 }
 return json({error:'Not found.'},404);
 }catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('API failed',e);return json({error:'The server could not complete this request. Please try again.'},500)}
}
