// Adapted from PackRat Performance Grapher's bounded rolling-history design.
export const numeric = value => (value == null || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value))) ? null : Number(value);
export class BoundedHistory {
  constructor(max = 900, archiveMax = 360, bucketMs = 10_000) {
    this.max=max; this.archiveMax=archiveMax; this.bucketMs=bucketMs;
    this.raw=[];this.archive=[];this.pending=null;
  }
  push(at, value) {
    const v=numeric(value), t=numeric(at);
    if(v===null || t===null) return false;
    const last=this.raw[this.raw.length-1];
    if(last && t<=last[0]) return false; // duplicate/out-of-order events must not rewrite history
    this.raw.push([t,v]);if(this.raw.length>this.max)this.raw.shift();
    const bucket=Math.floor(t/this.bucketMs)*this.bucketMs;
    if(this.pending?.bucket!==bucket){
      if(this.pending){this.archive.push([this.pending.bucket,this.pending.last]);if(this.archive.length>this.archiveMax)this.archive.shift()}
      this.pending={bucket,last:v};
    } else this.pending.last=v;
    return true;
  }
  series(windowMs=60_000,now=Date.now()){
    const start=now-windowMs;
    const byTime=new Map();
    for(const point of [...this.archive,...(this.pending?[[this.pending.bucket,this.pending.last]]:[]),...this.raw]){
      if(point[0]>=start)byTime.set(point[0],point);
    }
    return [...byTime.values()].sort((a,b)=>a[0]-b[0]);
  }
}
