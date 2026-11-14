'use client'

import { useEffect, useRef } from 'react'

export type SphereOption = { name: string; detail: string; logo: string; color: string }
type Props = { rotation: number; tilt: number; left: SphereOption; right: SphereOption; showNames: boolean; showLogos: boolean; className?: string }

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){vUv=(aPos+1.0)*0.5;gl_Position=vec4(aPos,0.0,1.0);}
`
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uAtlas;
uniform float uRotation;
uniform float uTilt;
void main(){
  vec2 disk=(vUv-0.5)*2.0;
  float d=dot(disk,disk);
  if(d>1.0) discard;
  vec3 n=vec3(disk.x,disk.y,sqrt(max(0.0,1.0-d)));
  // Inverse pitch rotates the sphere surface around its horizontal axis.
  // Zero pitch restores the equatorial front face for pointer-based random results.
  float cp=cos(uTilt),sp=sin(uTilt);
  vec3 rotated=vec3(n.x,n.y*cp+n.z*sp,n.z*cp-n.y*sp);
  float longitude=atan(rotated.x,rotated.z)+uRotation;
  float latitude=asin(clamp(rotated.y,-1.0,1.0));
  float u=fract(longitude/6.28318530718+1.0);
  float v=0.5+latitude/3.14159265359;
  vec4 artwork=texture2D(uAtlas,vec2(u,v));
  vec3 light=normalize(vec3(-0.4,0.65,1.0));
  float diffuse=0.45+0.55*max(0.0,dot(n,light));
  float specular=pow(max(0.0,dot(reflect(-light,n),vec3(0.,0.,1.))),32.0)*0.46;
  float fresnel=pow(1.0-n.z,3.0);
  vec3 shaded=artwork.rgb*diffuse+vec3(specular)+vec3(0.15,0.26,0.36)*fresnel;
  gl_FragColor=vec4(shaded,1.0);
}
`

function shader(gl:WebGLRenderingContext,type:number,source:string){
 const sh=gl.createShader(type)
 if(!sh)throw Error('Sphere shader could not be created')
 gl.shaderSource(sh,source);gl.compileShader(sh)
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const why=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw Error(why||'Sphere shader compilation error')}
 return sh
}
type Engine={gl:WebGLRenderingContext;program:WebGLProgram;buffer:WebGLBuffer;texture:WebGLTexture;pos:number;rotation:WebGLUniformLocation|null;tilt:WebGLUniformLocation|null;atlas:WebGLUniformLocation|null}
function engine(gl:WebGLRenderingContext):Engine{
 const vertex=shader(gl,gl.VERTEX_SHADER,VERTEX),fragment=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT)
 const program=gl.createProgram();if(!program)throw Error('No WebGL program')
 gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program)
 gl.deleteShader(vertex);gl.deleteShader(fragment)
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'WebGL link failed')
 const buffer=gl.createBuffer(),texture=gl.createTexture()
 if(!buffer||!texture)throw Error('Cannot allocate sphere GPU buffers')
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW)
 gl.useProgram(program)
 const pos=gl.getAttribLocation(program,'aPos')
 gl.enableVertexAttribArray(pos)
 gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0)
 gl.bindTexture(gl.TEXTURE_2D,texture)
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR)
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT)
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1)
 return {gl,program,buffer,texture,pos,rotation:gl.getUniformLocation(program,'uRotation'),tilt:gl.getUniformLocation(program,'uTilt'),atlas:gl.getUniformLocation(program,'uAtlas')}
}
function atlas(left:SphereOption,right:SphereOption,showNames:boolean,showLogos:boolean,refresh:()=>void){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512
 const ctx=canvas.getContext('2d')
 if(!ctx)return canvas
 const colors=[left.color,right.color,left.color]
 ctx.fillStyle=colors[0];ctx.fillRect(0,0,256,512)
 ctx.fillStyle=colors[1];ctx.fillRect(256,0,512,512)
 ctx.fillStyle=colors[2];ctx.fillRect(768,0,256,512)
 const drawFace=(item:SphereOption,center:number,letter:string)=>{
  ctx.save();ctx.translate(center,0)
  const fade=ctx.createLinearGradient(0,0,0,512);fade.addColorStop(0,'#ffffff32');fade.addColorStop(.5,'#00000000');fade.addColorStop(1,'#06142b99')
  ctx.fillStyle=fade;ctx.fillRect(-240,0,480,512)
  ctx.lineWidth=5;ctx.strokeStyle='#ffffff66';ctx.beginPath();ctx.ellipse(0,260,155,195,0,0,Math.PI*2);ctx.stroke()
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.shadowColor='#000b';ctx.shadowBlur=8
  ctx.font='900 40px sans-serif';ctx.fillText(letter,0,90)
  if(showNames){
   const words=item.name.replace(/\t/g,'  ').split(/\n|\s+(?=\S{12,})/).filter(Boolean)
   const lines=words.length>3?words.slice(0,3):words
   const nameSize=lines.join('').length>22?28:lines.join('').length>14?34:42
   ctx.font='900 '+nameSize+'px sans-serif'
   lines.forEach((line,i)=>ctx.fillText(line.slice(0,25),0,296+(i-(lines.length-1)/2)*44,360))
  }
  ctx.shadowBlur=0;ctx.font='800 21px sans-serif';ctx.fillText(item.detail.slice(0,30),0,438,380)
  if(showLogos&&item.logo){
   const image=new Image()
   image.onload=()=>{try{const width=Math.min(138,image.width),height=Math.min(125,image.height);const scale=Math.min(138/Math.max(1,width),125/Math.max(1,height));ctx.save();ctx.translate(center,0);ctx.drawImage(image,-width*scale/2,104,width*scale,height*scale);ctx.restore();refresh()}catch{/* malformed image */}}
   image.src=item.logo
  }
  ctx.restore()
 }
 // A is centred at longitude 0° (atlas seam); B at longitude 180°.
 // Repeat A on both edges so the sphere texture remains seamless.
 drawFace(left,0,'A');drawFace(right,512,'B');drawFace(left,1024,'A')
 return canvas
}
export default function SphereSurface({rotation,tilt,left,right,showNames,showLogos,className}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null)
 const engineRef=useRef<Engine|null>(null)
 const texRef=useRef<HTMLCanvasElement|null>(null)
 const rotationRef=useRef(rotation)
 const tiltRef=useRef(tilt)
 const drawRef=useRef<()=>void>(()=>{})
 rotationRef.current=rotation
 tiltRef.current=tilt
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas)return undefined
  try{
   const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true})
   if(!gl)return undefined
   const e=engine(gl);engineRef.current=e
   drawRef.current=()=>{
    const current=engineRef.current,tex=texRef.current
    if(!current||!tex||gl.isContextLost())return
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(e.program);gl.bindBuffer(gl.ARRAY_BUFFER,e.buffer)
    gl.vertexAttribPointer(e.pos,2,gl.FLOAT,false,0,0)
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,e.texture)
    gl.uniform1i(e.atlas,0)
    gl.uniform1f(e.rotation,rotationRef.current*Math.PI/180)
    gl.uniform1f(e.tilt,tiltRef.current*Math.PI/180)
    gl.drawArrays(gl.TRIANGLES,0,6)
   }
   drawRef.current()
   return ()=>{engineRef.current=null;gl.deleteTexture(e.texture);gl.deleteBuffer(e.buffer);gl.deleteProgram(e.program)}
  }catch{/* context blocked or unsupported: keep accessible fallback */}
  return undefined
 },[])
 useEffect(()=>{
  let active=true
  const artwork=atlas(left,right,showNames,showLogos,()=>{
   if(!active)return
   const e=engineRef.current
   if(e){e.gl.bindTexture(e.gl.TEXTURE_2D,e.texture);e.gl.texImage2D(e.gl.TEXTURE_2D,0,e.gl.RGBA,e.gl.RGBA,e.gl.UNSIGNED_BYTE,artwork)}
   drawRef.current()
  })
  texRef.current=artwork
  const e=engineRef.current
  if(e){e.gl.bindTexture(e.gl.TEXTURE_2D,e.texture);e.gl.texImage2D(e.gl.TEXTURE_2D,0,e.gl.RGBA,e.gl.RGBA,e.gl.UNSIGNED_BYTE,artwork)}
  drawRef.current()
  return ()=>{active=false}
 },[left,right,showNames,showLogos])
 useEffect(()=>{drawRef.current()},[rotation,tilt])
 return <canvas ref={canvasRef} width={384} height={384} className={className} role="img" aria-label={'3D spinning sphere showing '+left.name.replace(/\s+/g,' ')+' and '+right.name.replace(/\s+/g,' ')} />
}
