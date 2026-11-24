// Explicit-consent microphone lifecycle. Soft mute retains the capture track;
// revoke/leave always release it. Inject capture and transport for testing.
export class MicController {
  constructor({capture, attach, detach=()=>{}, onState=()=>{}, allowed=false}) {
    Object.assign(this,{capture,attach,detach,onState,allowed});
    this.track=null; this.stream=null; this.state='muted'; this.closed=false; this.epoch=0; this.pending=null;
  }
  setState(state){this.state=state;this.onState(state);}
  async toggle(){
    if(this.closed||!this.allowed)return;
    if(this.state==='on'||this.state==='requesting'){this.mute();return;}
    if(this.pending)return;
    if(this.track?.readyState==='live') {this.track.enabled=true;this.setState('on');return;}
    this.release();
    const epoch=++this.epoch;
    this.setState('requesting');
    const run=async()=>{
      let stream, track;
      try {
        stream=await this.capture();track=stream.getAudioTracks()[0];
        if(!track||this.closed||!this.allowed||epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());if(!track&&epoch===this.epoch&&!this.closed)this.setState('error');return;}
        track.enabled=false;this.stream=stream;this.track=track;
        track.addEventListener?.('ended',()=>{if(this.track===track){this.release();if(!this.closed)this.setState('error');}},{once:true});
        await this.attach(stream);
        if(this.closed||!this.allowed||epoch!==this.epoch||this.track!==track){track.enabled=false;return;}
        track.enabled=true;this.setState('on');
      }catch{
        if(this.track===track&&track)this.release();else stream?.getTracks().forEach(t=>t.stop());
        if(!this.closed&&epoch===this.epoch)this.setState('error');
      }
    };
    this.pending=run();try{await this.pending;}finally{this.pending=null;if(!this.closed&&this.state==='requesting'&&epoch!==this.epoch)this.setState('muted');this.onState(this.state);}
  }
  mute(){++this.epoch;if(this.track)this.track.enabled=false;if(!this.closed)this.setState('muted');}
  release(){const track=this.track,stream=this.stream;this.track=this.stream=null;if(track){track.enabled=false;stream?.getTracks().forEach(t=>t.stop());try{this.detach();}catch{}}}
  setAllowed(value){this.allowed=Boolean(value);if(!this.allowed){++this.epoch;this.release();if(!this.closed)this.setState('muted');}}
  close(){if(this.closed)return;this.closed=true;this.allowed=false;++this.epoch;this.release();this.setState('muted');}
}
