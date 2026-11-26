/* Freestanding WASM: one spring-driven descriptor per stack, not per slice.
   Slice generation runs on the GPU. Only sin/cos are imported from JS. */
#define MAX_STACKS 96
__attribute__((import_module("env"),import_name("sin"))) extern double js_sin(double);
__attribute__((import_module("env"),import_name("cos"))) extern double js_cos(double);
static float sn(float a){return (float)js_sin(a);}
static float cs(float a){return (float)js_cos(a);}
static float ab(float a){return a<0?-a:a;}
static float clamp(float x,float a,float b){return x<a?a:(x>b?b:x);}
static float smooth(float x){x=clamp(x,0,1);return x*x*(3-2*x);}
typedef struct {float x,y,z;} Vec;
typedef struct {float position[4],shape[4],motion[4],identity[4];} Descriptor;
typedef struct {Vec anchor,pos,velocity;float width,height,depth,seed;int kind,mask;} Stack;
static Stack stacks[MAX_STACKS];static Descriptor output[MAX_STACKS];
static Vec field[24];static int count;static float last=-1,separation;
__attribute__((export_name("get_buffer"))) unsigned get_buffer(void){return (unsigned)output;}
__attribute__((export_name("get_count"))) int get_count(void){return count;}
__attribute__((export_name("get_separation"))) float get_separation(void){return separation;}
__attribute__((export_name("clear_scene"))) void clear_scene(void){count=0;last=-1;}
__attribute__((export_name("add_stack"))) int add_stack(float x,float y,float z,float w,float h,float depth,int kind,int mask,float seed){
  if(count>=MAX_STACKS)return -1;
  Stack *q=&stacks[count];q->anchor=q->pos=(Vec){x,y,z};q->velocity=(Vec){0,0,0};
  q->width=w;q->height=h;q->depth=depth;q->kind=kind;q->mask=mask;q->seed=seed;return count++;
}
__attribute__((export_name("reassemble"))) void reassemble(void){
  for(int i=0;i<count;i++){stacks[i].pos=stacks[i].anchor;stacks[i].velocity=(Vec){0,0,0};}last=-1;
}
static void turn4(float *p,int a,int b,float angle){float c=cs(angle),s=sn(angle),x=p[a];p[a]=c*x-s*p[b];p[b]=s*x+c*p[b];}
static void tesseract(float time){
  int face=0;
  for(int a=0;a<4;a++)for(int b=a+1;b<4;b++){
    int fixed[2],n=0;for(int d=0;d<4;d++)if(d!=a&&d!=b)fixed[n++]=d;
    for(int bits=0;bits<4;bits++){
      float p[4]={0};p[fixed[0]]=(bits&1)?1:-1;p[fixed[1]]=(bits&2)?1:-1;
      turn4(p,0,3,time*.105f+.4f);turn4(p,1,3,time*.073f+.8f);
      turn4(p,2,3,time*.059f+.2f);turn4(p,0,2,time*.037f);
      float k=3.8f/(3.8f-p[3]);field[face++]=(Vec){p[0]*k,p[1]*k,p[2]*k};
    }
  }
}
__attribute__((export_name("update"))) void update(float time,float strength,float drift,int hold,float repulsion){
  float phase=time/26-(int)(time/26);
  separation=smooth((phase-.25f)/.29f)*(1-smooth((phase-.68f)/.29f))*strength*(hold?0:1);
  float dt=last<0?0:clamp(time-last,0,.05f);last=time;
  tesseract(time);
  Vec targets[MAX_STACKS],push[MAX_STACKS];float angles[MAX_STACKS],widths[MAX_STACKS],heights[MAX_STACKS];
  for(int i=0;i<count;i++){
    Stack *q=&stacks[i];float s=q->seed;Vec f=field[(i*7)%24];
    float amt=q->kind?separation:drift;
    float rest=q->kind?.018f*drift:0;
    targets[i]=(Vec){q->anchor.x+f.x*amt*(q->kind?1.8f:.85f)+sn(time*.25f+s*9)*rest,
      q->anchor.y+f.y*amt*(q->kind?2.4f:.95f)+cs(time*.2f+s*8)*rest,
      q->anchor.z+(q->kind?f.z*amt*1.6f:0)};
    angles[i]=q->kind?amt*(f.z*.19f+sn(time*.15f+s*12)*.27f):drift*(sn(time*.11f+s*11)*.48f+f.z*.15f);
    widths[i]=q->width*(1+amt*sn(time*.17f+s*8)*(q->kind?.22f:.23f));
    heights[i]=q->height*(1+amt*cs(time*.14f+s*7)*(q->kind?.3f:.25f));
    push[i]=(Vec){0,0,0};
  }
  // Soft footprint repulsion: intersecting rectangles exert a spring force.
  // Their four separating axes include in-plane rotation. Limited overlap
  // remains possible; this is an elastic art control, not rigid-body physics.
  if(repulsion>0)for(int i=0;i<count;i++)for(int j=i+1;j<count;j++){
    if(stacks[i].kind!=stacks[j].kind)continue;
    float ci=cs(angles[i]),si=sn(angles[i]),cj=cs(angles[j]),sj=sn(angles[j]);
    float ax[4]={ci,-si,cj,-sj},ay[4]={si,ci,sj,cj};
    float dx=stacks[j].pos.x-stacks[i].pos.x,dy=stacks[j].pos.y-stacks[i].pos.y;
    float best=100000,nx=0,ny=0;
    for(int k=0;k<4;k++){
      float ri=(ab(ax[k]*ci+ay[k]*si)*widths[i]+ab(-ax[k]*si+ay[k]*ci)*heights[i])*.46f;
      float rj=(ab(ax[k]*cj+ay[k]*sj)*widths[j]+ab(-ax[k]*sj+ay[k]*cj)*heights[j])*.46f;
      float dist=dx*ax[k]+dy*ay[k],overlap=ri+rj-ab(dist);
      if(overlap<=0){best=-1;break;}
      if(overlap<best){best=overlap;float sign=dist<0?-1:1;nx=ax[k]*sign;ny=ay[k]*sign;}
    }
    if(best>0){float f=clamp(best*repulsion*12,0,24);push[i].x-=nx*f;push[i].y-=ny*f;push[j].x+=nx*f;push[j].y+=ny*f;}
  }
  for(int i=0;i<count;i++){
    Stack *q=&stacks[i];Descriptor *out=&output[i];float s=q->seed;Vec f=field[(i*7)%24];
    float amt=q->kind?separation:drift;
    for(int step=0;step<4;step++){
      float h=dt*.25f,k=q->kind?48:10,damping=q->kind?13:6;
      q->velocity.x+=(k*(targets[i].x-q->pos.x)-damping*q->velocity.x+push[i].x)*h;
      q->velocity.y+=(k*(targets[i].y-q->pos.y)-damping*q->velocity.y+push[i].y)*h;
      q->velocity.z+=(k*(targets[i].z-q->pos.z)-damping*q->velocity.z)*h;
      q->pos.x+=q->velocity.x*h;q->pos.y+=q->velocity.y*h;q->pos.z+=q->velocity.z*h;
    }
    out->position[0]=q->pos.x;out->position[1]=q->pos.y;out->position[2]=q->pos.z;out->position[3]=angles[i];
    out->shape[0]=widths[i];out->shape[1]=heights[i];out->shape[2]=q->depth*(1+amt*sn(time*.13f+s*13)*.42f);out->shape[3]=(float)q->kind;
    out->motion[0]=f.x*amt*.7f;out->motion[1]=f.y*amt*.7f;
    out->motion[2]=amt*sn(time*.08f+s*11)*.4f;out->motion[3]=s;
    out->identity[0]=(float)q->mask;out->identity[1]=(float)i;out->identity[2]=separation;out->identity[3]=0;
  }
}
