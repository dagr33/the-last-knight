export const WIDTH=960, HEIGHT=540;
export type Kind='skeleton'|'goblin'|'knight'|'boss';
export type Counts=Record<Kind,number>;
export const points:Counts={skeleton:10,goblin:20,knight:50,boss:250};
export const emptyCounts=():Counts=>({skeleton:0,goblin:0,knight:0,boss:0});
export function waveEnemies(wave:number):Kind[]{
 const result:Kind[]=Array.from({length:3+wave*2},(_,i)=>wave>=3&&i%5===0?'knight':i%3===0?'goblin':'skeleton');
 if(wave%5===0)result.push('boss');return result;
}
export function scoreFor(kills:Counts,completed:number){return Object.entries(points).reduce((s,[k,v])=>s+kills[k as Kind]*v,completed*100)}
export function validateResult(data:any,wallSeconds:number){
 if(!data||!Number.isInteger(data.wave)||data.wave<1||data.wave>100||!Number.isFinite(data.duration)||data.duration<0||data.duration>wallSeconds+5)throw Error('Invalid game duration or wave.');
 if(!data.kills||typeof data.kills!=='object'||Array.isArray(data.kills)||Object.keys(data.kills).length!==4||Object.keys(data.kills).some(k=>!(k in points)))throw Error('Invalid enemy counts.');
 const max=emptyCounts(),min=emptyCounts();
 for(let w=1;w<=data.wave;w++)for(const kind of waveEnemies(w)){max[kind]++;if(w<data.wave)min[kind]++}
 for(const k of Object.keys(points) as Kind[])if(!Number.isInteger(data.kills?.[k])||data.kills[k]<min[k]||data.kills[k]>max[k])throw Error('The enemy counts do not match this run.');
 const total=Object.values(data.kills as Counts).reduce((a,b)=>a+b,0);
 if(total>data.duration*4+1 || data.wave-1>data.duration/2)throw Error('This run is too short for that result.');
 return {score:scoreFor(data.kills,data.wave-1),kills:total,wave:data.wave,duration:Math.round(data.duration)};
}
