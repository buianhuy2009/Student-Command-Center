import { GoogleGenAI } from "@google/genai";
import { SERVER_MODELS, modelError } from "./models.js";
let genAI=null;
function getGenAI(){ if(!genAI){ genAI=new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY||""}); } return genAI; }
const CANDIDATE_MODELS = SERVER_MODELS;
export async function generateWithModelFallback(params){
  const ai=getGenAI(); const errors=[];
  for(const model of CANDIDATE_MODELS){
    try{ const r=await ai.models.generateContent({model, contents: params.contents, config: params.config}); return { response: r, model, errors }; }
    catch(e){ errors.push(`${model}: ${modelError(e)}`); console.warn(`Model ${model} failed ${e.message}`); }
  }
  const err=new Error(errors.join(" | ")||"All models failed"); err.errors=errors; throw err;
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  if(req.method==="OPTIONS") return res.status(200).end();
  try{
    const {contents, config} = req.body||{};
    if(!contents) return res.status(400).json({error:"Missing contents"});
    const { response, model } = await generateWithModelFallback({contents, config});
    res.status(200).json({text: response.text||"", model});
  }catch(err){ console.error("generate error",err); res.status(500).json({error: err.message||"Generate failed", errors: err.errors||[], text:""}); }
}
