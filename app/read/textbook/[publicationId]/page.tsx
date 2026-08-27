import type{Metadata}from"next";
import{unstable_noStore as noStore}from"next/cache";
import{notFound}from"next/navigation";
import{createClient}from"@supabase/supabase-js";
import ReaderClient,{type Chapter,type ReaderPayload}from"./ReaderClient";

export const dynamic="force-dynamic";
export const revalidate=0;

const SITE_URL="https://vibeschool.co.ke";

async function loadPublicReader(publicationId:string):Promise<ReaderPayload|null>{
  noStore();
  if(!publicationId)return null;
  const supabase=createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}}
  );
  let{data,error}=await supabase.rpc("get_public_vibetextbook_reader",{publication_id_input:publicationId});
  if(error&&(error.code==="PGRST202"||error.code==="42883")){
    const legacy=await supabase.rpc("get_vibetextbook_reader",{publication_id_input:publicationId});
    data=legacy.data;error=legacy.error;
  }
  if(error)throw new Error(`Public textbook reader failed: ${error.code??"unknown"}`);
  const payload=data as ReaderPayload|null;
  if(!payload?.ok||!payload.publication)return null;
  payload.chapters=Array.isArray(payload.chapters)?payload.chapters:[];
  return payload;
}

function selectedChapter(payload:ReaderPayload,chapterId?:string):Chapter|null{
  if(chapterId){const requested=payload.chapters.find(chapter=>chapter.id===chapterId);if(requested)return requested;}
  return payload.chapters[0]??null;
}

function plainText(value:string){return value.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();}

function descriptionFor(payload:ReaderPayload,chapter:Chapter|null){
  const chapterText=chapter?.blocks?.map(block=>plainText(block.content??"")).filter(Boolean).join(" ")??"";
  const fallback=payload.publication.description?plainText(payload.publication.description):"Read this VibeSchool textbook chapter online.";
  const text=chapterText||fallback;
  return text.length>160?`${text.slice(0,157).trimEnd()}…`:text;
}

function canonicalFor(publicationId:string,chapter:Chapter|null){
  const base=`${SITE_URL}/read/textbook/${encodeURIComponent(publicationId)}`;
  return chapter?`${base}?chapter=${encodeURIComponent(chapter.id)}`:base;
}

export async function generateMetadata({params,searchParams}:{params:{publicationId:string};searchParams?:{chapter?:string}}):Promise<Metadata>{
  const payload=await loadPublicReader(params.publicationId);
  if(!payload)return{title:"Textbook not found",robots:{index:false,follow:false}};
  const chapter=selectedChapter(payload,searchParams?.chapter);
  const publicationTitle=payload.publication.title||"VibeSchool Textbook";
  const chapterTitle=chapter?.title||publicationTitle;
  const title=chapter&&chapterTitle!==publicationTitle?`${chapterTitle} | ${publicationTitle}`:publicationTitle;
  const socialTitle=`${title} | VibeSchool`;
  const description=descriptionFor(payload,chapter);
  const canonical=canonicalFor(params.publicationId,chapter);
  const images=payload.publication.cover_url?[{url:payload.publication.cover_url,alt:publicationTitle}]:undefined;
  return{
    title,
    description,
    alternates:{canonical},
    openGraph:{title:socialTitle,description,url:canonical,siteName:"VibeSchool",type:"article",images},
    twitter:{card:images?"summary_large_image":"summary",title:socialTitle,description,images:payload.publication.cover_url?[payload.publication.cover_url]:undefined},
    robots:{index:true,follow:true},
  };
}

export default async function ReadTextbookPage({params,searchParams}:{params:{publicationId:string};searchParams?:{chapter?:string}}){
  const payload=await loadPublicReader(params.publicationId);
  if(!payload)notFound();
  const chapter=selectedChapter(payload,searchParams?.chapter);
  return <ReaderClient publicationId={params.publicationId} initialPayload={payload} initialChapterId={chapter?.id??null}/>;
}
