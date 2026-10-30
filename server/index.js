import {createApp} from './app.js';
import express from 'express';
const app=createApp(process.env.DB_PATH||'data/survey.sqlite');
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile('index.html',{root:'dist'}));}
else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Friend Preference Survey listening on port '+(process.env.PORT||3000)));
