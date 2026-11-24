export class MicController {
  constructor(options: {capture:()=>Promise<MediaStream>;attach:(stream:MediaStream)=>Promise<void>;detach?:()=>void;onState?:(state:'muted'|'requesting'|'on'|'error')=>void;allowed?:boolean});
  toggle():Promise<void>;
  setAllowed(value:boolean):void;
  close():void;
}
