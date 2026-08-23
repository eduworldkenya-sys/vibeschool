export type CyborgCallerPolicy={provider:'groq'|'anthropic';models:readonly string[];maxTokens:number}
const GROQ_TWIN_MODEL=Deno.env.get('GROQ_TWIN_MODEL')??'llama-3.3-70b-versatile'
export const CYBORG_CALLER_POLICIES:Readonly<Record<string,CyborgCallerPolicy>>=Object.freeze({
  'twin-chat':{provider:'groq',models:[GROQ_TWIN_MODEL],maxTokens:1024},
  'app.twin-pulse':{provider:'anthropic',models:['claude-haiku-4-5-20251001'],maxTokens:80},
  'app.report-insight':{provider:'anthropic',models:['claude-sonnet-4-20250514'],maxTokens:200},
  'app.lesson-plan':{provider:'anthropic',models:['claude-sonnet-4-6'],maxTokens:2400},
  'app.vibevoice':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:700},
  'app.subject-insight':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:500},
  'app.exam-generate':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:4096},
  'edge.learning-transform':{provider:'anthropic',models:['claude-haiku-4-5-20251001'],maxTokens:2600},
  'edge.content-assessment-generate':{provider:'anthropic',models:['claude-haiku-4-5-20251001'],maxTokens:3600},
  'edge.content-material-generate':{provider:'anthropic',models:['claude-haiku-4-5-20251001'],maxTokens:3200},
  'edge.swift-processor':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:4000},
  'edge.generate-lesson-plan':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:4000},
  'edge.generate-canonical-lesson-plan':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:4000},
  'edge.curriculum-intelligence-research':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:4200},
  'edge.curriculum-intelligence-health-action':{provider:'groq',models:['llama-3.3-70b-versatile'],maxTokens:4200},
  'edge.content-authoring-worker':{provider:'groq',models:['openai/gpt-oss-120b'],maxTokens:3500},
  'edge.content-critic-worker':{provider:'groq',models:['openai/gpt-oss-120b'],maxTokens:6000},
  'edge.content-repair-worker':{provider:'groq',models:['openai/gpt-oss-120b'],maxTokens:6000},
  'edge.content-semantic-verifier':{provider:'groq',models:['openai/gpt-oss-120b'],maxTokens:3500},
  'script.seed-curriculum-content':{provider:'anthropic',models:['claude-haiku-4-5-20251001'],maxTokens:1500},
})
export function getCyborgCallerPolicy(caller:string):CyborgCallerPolicy|undefined{return CYBORG_CALLER_POLICIES[caller]}
