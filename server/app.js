import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { questions } from '../src/questions.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function createApp(dbPath='data/survey.sqlite') {
 if(dbPath!==':memory:') mkdirSync(dirname(dbPath),{recursive:true});
 const db=new DatabaseSync(dbPath); db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, room TEXT NOT NULL, nickname TEXT NOT NULL, sharing INTEGER NOT NULL DEFAULT 0, answers TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS room_idx ON profiles(room);`);
 const app=express(); app.disable('x-powered-by'); app.set('trust proxy', 1); app.use(express.json({limit:'32kb'}));
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store'); if(req.method!=='GET' && req.headers.origin && req.headers.origin!==`${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'허용되지 않은 요청입니다.'}); next();});
 const publicProfile=p=>({id:p.id,nickname:p.nickname,sharing:!!p.sharing,answers:JSON.parse(p.answers),updatedAt:p.updated_at});
 function auth(req,res,next){ const token=req.headers.authorization?.replace(/^Bearer /,''); const p=token&&db.prepare('SELECT * FROM profiles WHERE token_hash=?').get(hash(token)); if(!p)return res.status(401).json({error:'복구 코드를 확인해 주세요.'}); req.profile=p; next(); }
 app.get('/api/health',(req,res)=>res.json({ok:true}));
 app.post('/api/join',(req,res)=>{const {nickname,room}=req.body; if(typeof nickname!=='string'||!nickname.trim()||nickname.length>24||typeof room!=='string'||! /^[a-f0-9]{32}$/.test(room))return res.status(400).json({error:'닉네임과 초대 링크를 확인해 주세요.'});const token=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex'); db.prepare('INSERT INTO profiles(id,token_hash,room,nickname,updated_at) VALUES(?,?,?,?,?)').run(id,hash(token),room,nickname.trim(),new Date().toISOString()); res.status(201).json({token,profile:publicProfile(db.prepare('SELECT * FROM profiles WHERE id=?').get(id))});});
 app.get('/api/me',auth,(req,res)=>res.json({profile:publicProfile(req.profile),room:req.profile.room}));
 app.put('/api/me',auth,(req,res)=>{const {answers,sharing,nickname}=req.body; if(!answers||typeof answers!=='object'||Array.isArray(answers)||typeof sharing!=='boolean'||typeof nickname!=='string'||!nickname.trim()||nickname.length>24)return res.status(400).json({error:'입력 형식을 확인해 주세요.'});const clean={}; for(const [id,v] of Object.entries(answers)){const q=questions.find(q=>q.id===id);if(!q)return res.status(400).json({error:'알 수 없는 문항입니다.'});if(q.type==='multi'){if(!Array.isArray(v)||v.some(x=>!q.options.includes(x)))return res.status(400).json({error:'선택값을 확인해 주세요.'});clean[id]=[...new Set(v)];}else{if(typeof v!=='string'||v.length>1000||(q.type==='single'&&v!==''&&!q.options.includes(v)))return res.status(400).json({error:'답변을 확인해 주세요.'});clean[id]=v;}} db.prepare('UPDATE profiles SET answers=?,sharing=?,nickname=?,updated_at=? WHERE id=?').run(JSON.stringify(clean),Number(sharing),nickname.trim(),new Date().toISOString(),req.profile.id);res.json({ok:true});});
 app.get('/api/friends',auth,(req,res)=>{if(!req.profile.sharing)return res.status(403).json({error:'내 답변 공유에 먼저 동의해 주세요.'});res.json({profiles:db.prepare('SELECT * FROM profiles WHERE room=? AND sharing=1 AND id<>? ORDER BY updated_at DESC').all(req.profile.room,req.profile.id).map(publicProfile)});});
 app.delete('/api/me',auth,(req,res)=>{db.prepare('DELETE FROM profiles WHERE id=?').run(req.profile.id);res.json({ok:true});});
 app.use('/api',(req,res)=>res.status(404).json({error:'요청을 찾을 수 없습니다.'}));
 app.use((err,req,res,next)=>res.status(400).json({error:'요청을 처리할 수 없습니다.'}));
 return app;
}
