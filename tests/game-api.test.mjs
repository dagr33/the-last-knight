import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi} from '../lib/server/api.ts';
import {validateResult,emptyCounts,waveEnemies,scoreFor} from '../lib/game/rules.ts';
function setup(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));return {sqlite,db:{async query(sql,args=[]){return sqlite.prepare(sql).all(...args)}}}}
const request=(path,body,cookie,extra={})=>new Request('https://knight.example/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Knight-Request':'1',...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
test('score rules reject forged wave, duration and enemy counts',()=>{assert.equal(scoreFor({skeleton:2,goblin:1,knight:0,boss:0},1),140);assert.throws(()=>validateResult({wave:10,kills:emptyCounts(),duration:90},90));assert.throws(()=>validateResult({wave:1,kills:{...emptyCounts(),boss:1},duration:90},90));assert.throws(()=>validateResult({wave:1,kills:emptyCounts(),duration:999},2));assert.throws(()=>validateResult({wave:1,kills:{...emptyCounts(),skeleton:-1},duration:10},10));});
test('registration → login → save run → leaderboard → profile → logout',async()=>{
 const {sqlite,db}=setup();
 let response=await handleApi(request('/auth/register',{username:'BraveKnight',email:'knight@example.com',password:'safe-password'}),db,{secure:true,ip:'a'});
 assert.equal(response.status,200);const registration=await response.json();assert.equal(registration.user.username,'BraveKnight');assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);
 const stored=sqlite.prepare('SELECT password_hash FROM users').get();assert.notEqual(stored.password_hash,'safe-password');
 response=await handleApi(request('/auth/login',{email:'knight@example.com',password:'wrong-password'}),db,{ip:'a'});assert.equal(response.status,401);
 response=await handleApi(request('/auth/login',{email:'knight@example.com',password:'safe-password'}),db,{ip:'a'});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
 response=await handleApi(request('/me',undefined,cookie),db);assert.equal((await response.json()).user.id,registration.user.id);
 response=await handleApi(request('/games/start',{},cookie),db);assert.equal(response.status,200);const game=await response.json();sqlite.prepare('UPDATE games SET started_at=started_at-30 WHERE id=?').run(game.id);
 const kills=emptyCounts();for(const k of waveEnemies(1))kills[k]++;
 const payload={gameId:game.id,wave:2,duration:25,kills,score:999999};
 response=await handleApi(request('/games/finish',payload,cookie),db);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.score,scoreFor(kills,1));assert.notEqual(saved.score,999999);
 response=await handleApi(request('/games/finish',payload,cookie),db);assert.equal(response.status,409);
 response=await handleApi(request('/leaderboard',undefined,cookie),db);const leader=await response.json();assert.equal(leader.entries.length,1);assert.equal(leader.me.rank,1);assert.equal(leader.entries[0].username,'BraveKnight');
 response=await handleApi(request('/profile',undefined,cookie),db);const profile=await response.json();assert.equal(profile.stats.games,1);assert.equal(profile.stats.kills,waveEnemies(1).length);assert.equal(profile.history.length,1);
 response=await handleApi(request('/auth/logout',{},cookie),db);assert.equal(response.status,200);response=await handleApi(request('/profile',undefined,cookie),db);assert.equal(response.status,401);sqlite.close();
});
test('cross-origin, unauthenticated, other-user and expired-session writes are rejected',async()=>{
 const {sqlite,db}=setup();
 let r=await handleApi(request('/games/start',{}),db);assert.equal(r.status,401);
 r=await handleApi(request('/games/start',{},null,{origin:'https://evil.example'}),db);assert.equal(r.status,403);
 r=await handleApi(new Request('https://knight.example/api/games/start',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}}),db);assert.equal(r.status,403);
 async function register(name){const r=await handleApi(request('/auth/register',{username:name,email:name+'@example.com',password:'safe-password'}),db,{ip:name});return r.headers.get('set-cookie').split(';')[0]}
 const alice=await register('alice'),bob=await register('bob');r=await handleApi(request('/games/start',{},alice),db);const game=await r.json();
 r=await handleApi(request('/games/finish',{gameId:game.id,wave:1,kills:emptyCounts(),duration:0},bob),db);assert.equal(r.status,404);
 sqlite.exec('UPDATE auth_sessions SET expires_at=0');r=await handleApi(request('/games/start',{},alice),db);assert.equal(r.status,401);sqlite.close();
});
test('rate limit blocks repeated credential attempts',async()=>{const {sqlite,db}=setup();for(let i=0;i<20;i++){const r=await handleApi(request('/auth/login',{email:'bad',password:'bad'}),db,{ip:'same'});assert.equal(r.status,400)}const r=await handleApi(request('/auth/login',{email:'bad',password:'bad'}),db,{ip:'same'});assert.equal(r.status,429);sqlite.close()});
