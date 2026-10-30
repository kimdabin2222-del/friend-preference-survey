import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {questions} from '../src/questions.js';
test('40 questions and authorized survey lifecycle',async()=>{
 assert.equal(questions.length,40);
 const server=createApp(':memory:').listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 async function call(path,method='GET',body,token){const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 try{const room='a'.repeat(32);const a=(await call('/join','POST',{room,nickname:'수진'})).data;const b=(await call('/join','POST',{room,nickname:'민지'})).data;const c=(await call('/join','POST',{room:'b'.repeat(32),nickname:'다른 그룹'})).data;
 const body={nickname:'수진',sharing:true,answers:{q1:'파스타',q4:'땅콩',q28:['엽서'],q33:'책'}};
 assert.equal((await call('/me','PUT',body,a.token)).status,200);
 assert.equal((await call('/friends','GET',null,b.token)).status,403);
 await call('/me','PUT',{...body,nickname:'민지'},b.token);await call('/me','PUT',body,c.token);
 const friends=(await call('/friends','GET',null,a.token)).data.profiles;assert.equal(friends.length,1);assert.equal(friends[0].nickname,'민지');assert.equal(friends[0].token_hash,undefined);
 assert.equal((await call('/me','GET',null,'wrong')).status,401);
 assert.equal((await call('/me','PUT',{...body,answers:{q2:['invalid']}},a.token)).status,400);
 await call('/me','PUT',{...body,answers:{q1:'피자'},sharing:false},b.token);assert.equal((await call('/friends','GET',null,a.token)).data.profiles.length,0);
 assert.equal((await call('/me','GET',null,b.token)).data.profile.answers.q1,'피자');
 assert.equal((await call('/me/group','POST',{room:'bad'},c.token)).status,400);
 assert.equal((await call('/me/group','POST',{room},'wrong')).status,401);
 const moved=await call('/me/group','POST',{room},c.token);
 assert.equal(moved.status,200);assert.equal(moved.data.profile.answers.q1,'파스타');assert.equal(moved.data.profile.sharing,false);assert.equal(moved.data.room,room);
 assert.equal((await call('/friends','GET',null,a.token)).data.profiles.length,0);
 await call('/me','PUT',body,c.token);
 assert.equal((await call('/friends','GET',null,a.token)).data.profiles.length,1);
 await call('/me','DELETE',null,b.token);assert.equal((await call('/me','GET',null,b.token)).status,401);
 }finally{await new Promise(r=>server.close(r));}
});
