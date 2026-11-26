/* DOS-maze v1.1: the v1.0 guided orthogonal/free-gap generator only.
   No plates, master backgrounds, graph mixer, diagonals, or exact-grid modes.
   Keep IEEE float math: visual parity depends on the original arithmetic. */
#define COLS 2048
#define ROWS 1536
#define REGIONS 96
#define SEGMENTS 80000
__attribute__((import_module("env"),import_name("sin"))) extern double js_sin(double);
__attribute__((import_module("env"),import_name("cos"))) extern double js_cos(double);
static float sn(float x){return (float)js_sin(x);}
static float cs(float x){return (float)js_cos(x);}
static int min(int a,int b){return a<b?a:b;}
static int max(int a,int b){return a>b?a:b;}
static int abs_i(int a){return a<0?-a:a;}
static int rounded(float x){return (int)(x+(x<0?-.5f:.5f));}
static unsigned hash(unsigned x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;x^=x>>16;return x;}
static unsigned rng;
static float randf(void){rng=hash(rng+0x9e3779b9U);return (float)(rng>>8)/16777216.0f;}
typedef struct{int x,y,w,h,ax,ay,type,rotation;float dx,dy;unsigned seed;} Region;
typedef struct{float x1,y1,x2,y2;} Line;
static Region regions[REGIONS];
// Startup glyph-distance work borrows the maze's grid memory. No extra atlas
// workspace survives initialization, and generation overwrites it normally.
static union{unsigned char cells[COLS*ROWS];float distances[512*512*2];} workspace;
#define owners workspace.cells
static Line lines[SEGMENTS],home_lines[SEGMENTS];
// Only parallel walls within 1.1 px can collide. Index accepted walls by
// perpendicular coordinate instead of comparing every pair in the frame.
#define BUCKETS 4096
static int heads[BUCKETS],next_line[SEGMENTS],candidates[SEGMENTS];
static int bin_of(float coordinate){float value=coordinate/1.1f;int i=(int)value;return i-(value<i);}
static unsigned bucket(int bin,int horizontal){return hash((unsigned)bin^((unsigned)horizontal*0x917fadU))&(BUCKETS-1);}
static int region_count,line_count,nx,ny,budget,overflow;
static const int subdivision=5;
static const float pitch=17,branching=.006f,breakage=.65f;
static float offset_x,offset_y,amount,canvas_width,canvas_height;
static unsigned scene_seed;
static unsigned char guide[344*192];
__attribute__((export_name("get_guide_buffer"))) unsigned get_guide_buffer(void){return (unsigned)guide;}
__attribute__((export_name("get_buffer"))) unsigned get_buffer(void){return (unsigned)lines;}
__attribute__((export_name("get_count"))) int get_count(void){return line_count;}
__attribute__((export_name("get_regions"))) int get_regions(void){return region_count;}
__attribute__((export_name("get_overflow"))) int get_overflow(void){return overflow;}
__attribute__((export_name("get_phase_x"))) float get_phase_x(void){return offset_x;}
__attribute__((export_name("get_phase_y"))) float get_phase_y(void){return offset_y;}
__attribute__((export_name("get_glyph_input"))) unsigned get_glyph_input(void){return (unsigned)home_lines;}
static double smaller(double a,double b){return a<b?a:b;}
static void distance_pass(float *d){
  const double diagonal=1.4142135623730951;
  for(int y=0;y<512;y++)for(int x=0;x<512;x++){
    int i=y*512+x;double v=d[i];
    if(x)v=smaller(v,(double)d[i-1]+1);
    if(y){v=smaller(v,(double)d[i-512]+1);if(x)v=smaller(v,(double)d[i-513]+diagonal);if(x+1<512)v=smaller(v,(double)d[i-511]+diagonal);}
    d[i]=(float)v;
  }
  for(int y=511;y>=0;y--)for(int x=511;x>=0;x--){
    int i=y*512+x;double v=d[i];
    if(x+1<512)v=smaller(v,(double)d[i+1]+1);
    if(y+1<512){v=smaller(v,(double)d[i+512]+1);if(x)v=smaller(v,(double)d[i+511]+diagonal);if(x+1<512)v=smaller(v,(double)d[i+513]+diagonal);}
    d[i]=(float)v;
  }
}
__attribute__((export_name("build_glyph"))) void build_glyph(void){
  const int count=512*512;unsigned char *bits=(unsigned char *)home_lines,*out=(unsigned char *)lines;
  float *white=workspace.distances,*black=white+count;
  for(int i=0;i<count;i++){int inside=(bits[i>>3]>>(i&7))&1;white[i]=inside?0:10000;black[i]=inside?10000:0;}
  distance_pass(white);distance_pass(black);
  for(int i=0;i<count;i++){
    int inside=(bits[i>>3]>>(i&7))&1;
    double value=((double)white[i]-(double)black[i]+(inside?.5:-.5))/512+.5;
    if(value<0)value=0;if(value>1)value=1;
    unsigned encoded=(unsigned)(value*65535+.5);out[i*2]=encoded>>8;out[i*2+1]=encoded&255;
  }
}
static void leaf(int x,int y,int w,int h,float turns){
  int id=region_count++;
  Region *r=&regions[id];r->x=x;r->y=y;r->w=w;r->h=h;r->seed=hash(rng+id*919U);
  int corner=(int)(randf()*4);
  r->ax=x+((corner&1)?w+1:-1);r->ay=y+((corner&2)?h+1:-1);
  r->type=randf()<turns?0:(randf()<.5f?1:2);r->dx=0;r->dy=0;r->rotation=0;
  for(int j=y;j<y+h;j++)for(int i=x;i<x+w;i++)owners[j*COLS+i]=(unsigned char)id;
}
static void divide(int x,int y,int w,int h,int depth,float turns){
  if(depth>=subdivision||region_count>=REGIONS-2||w<15||h<13||(w*h<430&&depth>2)){leaf(x,y,w,h,turns);return;}
  int vertical=w>h*1.2f?1:(h>w*1.2f?0:randf()>.5f);
  float ratio=.29f+randf()*.42f;
  if(vertical){int cut=max(6,min(w-6,(int)(w*ratio)));divide(x,y,cut,h,depth+1,turns);divide(x+cut,y,w-cut,h,depth+1,turns);}
  else{int cut=max(6,min(h-6,(int)(h*ratio)));divide(x,y,w,cut,depth+1,turns);divide(x,y+cut,w,h-cut,depth+1,turns);}
}
static int owner(int x,int y){return owners[max(0,min(ny-1,y))*COLS+max(0,min(nx-1,x))];}
static int level(int x,int y,int id){
  Region *r=&regions[id];
  if(r->type==1)return y;
  if(r->type==2)return x;
  return max(abs_i(x-r->ax),abs_i(y-r->ay));
}
static int wall(int x,int y,int horizontal,int id){
  int a=level(x,y,id),vertical=a!=level(x-1,y,id),across=a!=level(x,y-1,id);
  if(!vertical&&!across){if(regions[id].type==2)vertical=1;else across=1;}
  {
    Region *r=&regions[id];
    float pick=(float)(hash(r->seed+0x318aU)>>8)/16777216.0f;
    if(pick<(1-amount*.9f)){
      float jitter_x=((float)(hash(r->seed+17U)>>8)/16777216.0f-.5f)*120;
      float jitter_y=((float)(hash(r->seed+29U)>>8)/16777216.0f-.5f)*90;
      int gx=(int)(((x-.5f)*pitch-r->dx*.8f+jitter_x)/canvas_width*344);
      int gy=(int)(((y-.5f)*pitch-r->dy*.8f+jitter_y)/canvas_height*192);
      int direction=guide[max(0,min(192-1,gy))*344+max(0,min(344-1,gx))];
      vertical=direction==0;across=direction==1;
    }
  }
  int yes=horizontal?across:vertical;
  unsigned cell=hash(scene_seed+(unsigned)x*92837111U+(unsigned)y*689287499U+(horizontal?0x19afU:0x723eU));
  float chance=(float)(cell>>8)/16777216.0f;
  // Branches are sparse at rest. Corruption introduces more contradicting
  // junctions and missing wall pieces without promising actual solvability.
  if(chance<branching*(.18f+amount*.75f))yes=1;
  unsigned damage=hash(scene_seed+(unsigned)x*92837111U+(unsigned)y*689287499U+0xb5297a4dU);
  if((float)(damage>>8)/16777216.0f<amount*amount*breakage*.48f){
    // Free-gap corruption tears wall runs apart.
    yes=0;
  }
  return yes;
}
static void emit(float x1,float y1,float x2,float y2,int id){
  if(line_count>=budget){overflow=1;return;}
  float dx=offset_x,dy=offset_y;
  dx+=regions[id].dx;dy+=regions[id].dy;
  lines[line_count++]=(Line){x1*pitch+dx,y1*pitch+dy,x2*pitch+dx,y2*pitch+dy};
}
static void clean_parallel_overlaps(float width){
  for(int i=0;i<BUCKETS;i++)heads[i]=-1;
  int original=line_count;for(int i=0;i<original;i++)home_lines[i]=lines[i];line_count=0;
  for(int i=original-1;i>=0;i--){
    Line l=home_lines[i];float dx=l.x2-l.x1,dy=l.y2-l.y1,len=__builtin_sqrtf(dx*dx+dy*dy);if(len<.01f)continue;
    float ux=dx/len,uy=dy/len,intervals[512];int count=1;intervals[0]=0;intervals[1]=len;
    int horizontal=dy==0,bin=bin_of(horizontal?l.y1:l.x1),candidate_count=0;
    // A second neighbor conservatively covers floating-point bin-boundary
    // rounding at large coordinates. The exact distance test still decides.
    for(int b=bin-2;b<=bin+2;b++)for(int j=heads[bucket(b,horizontal)];j>=0;j=next_line[j]){
      Line p=lines[j];
      if((p.y1==p.y2)!=horizontal)continue;
      if(__builtin_fabsf((p.x1-l.x1)*uy-(p.y1-l.y1)*ux)>=width+.1f)continue;
      // Hash collisions can alias neighboring buckets; visit each wall once.
      if(bin_of(horizontal?p.y1:p.x1)!=b)continue;
      candidates[candidate_count++]=j;
    }
    // Preserve the old accepted-wall order, including interval split order.
    for(int gap=candidate_count/2;gap>0;gap/=2)for(int k=gap;k<candidate_count;k++){
      int value=candidates[k],j=k;while(j>=gap&&candidates[j-gap]>value){candidates[j]=candidates[j-gap];j-=gap;}candidates[j]=value;
    }
    for(int at=0;at<candidate_count&&count;at++){
      int j=candidates[at];
      Line p=lines[j];float ax=p.x2-p.x1,ay=p.y2-p.y1;
      if(__builtin_fabsf(ux*ay-uy*ax)>.01f)continue;
      if(__builtin_fabsf((p.x1-l.x1)*uy-(p.y1-l.y1)*ux)>=width+.1f)continue;
      float a=(p.x1-l.x1)*ux+(p.y1-l.y1)*uy,b=(p.x2-l.x1)*ux+(p.y2-l.y1)*uy;if(a>b){float v=a;a=b;b=v;}a-=width;b+=width;
      for(int k=0;k<count;k++){
        float lo=intervals[k*2],hi=intervals[k*2+1];if(a>=hi||b<=lo)continue;
        if(a>lo&&b<hi&&count<256){intervals[count*2]=b;intervals[count*2+1]=hi;count++;intervals[k*2+1]=a;}
        else if(a>lo)intervals[k*2+1]=a;else if(b<hi)intervals[k*2]=b;
        else{count--;intervals[k*2]=intervals[count*2];intervals[k*2+1]=intervals[count*2+1];k--;}
      }
    }
    for(int k=0;k<count;k++)if(intervals[k*2+1]-intervals[k*2]>.5f&&line_count<budget){
      float a=intervals[k*2],b=intervals[k*2+1];
      lines[line_count]=(Line){l.x1+ux*a,l.y1+uy*a,l.x1+ux*b,l.y1+uy*b};
      unsigned key=bucket(bin,horizontal);next_line[line_count]=heads[key];heads[key]=line_count++;
    }
  }
}
__attribute__((export_name("generate"))) void generate(float width,float height,unsigned seed,float chaos,float time){
  if(!(width>0&&height>0&&width<=32768&&height<=24576&&chaos>=0&&chaos<=1&&time>=0&&time<1e9f)){line_count=0;overflow=1;return;}
  canvas_width=width;canvas_height=height;
  nx=min(COLS-2,(int)(width/pitch)+4);ny=min(ROWS-2,(int)(height/pitch)+4);
  region_count=0;line_count=0;overflow=0;budget=SEGMENTS;
  amount=chaos;scene_seed=seed;rng=seed?seed:1;
  divide(0,0,nx,ny,0,.92f);
  for(int i=0;i<region_count;i++){
    Region *r=&regions[i];float s=(float)(r->seed>>8)/16777216.0f;
    float ax=(sn(time*.19f+s*15)*17+cs(time*.11f+s*8)*7)*chaos*4;
    float ay=(cs(time*.16f+s*13)*15+sn(time*.13f+s*6)*9)*chaos*4;
    r->ax+=rounded(ax/pitch);r->ay+=rounded(ay/pitch);r->dx=ax;r->dy=ay;
    int ox=rounded(ax/pitch),oy=rounded(ay/pitch);
    for(int y=max(0,r->y+oy);y<min(ny,r->y+r->h+oy);y++)for(int x=max(0,r->x+ox);x<min(nx,r->x+r->w+ox);x++)owners[y*COLS+x]=(unsigned char)i;
    if(chaos>.1f&&((r->seed&3)==0)){
      int fork=rounded(chaos*7);
      for(int y=max(0,r->y-fork);y<min(ny,r->y+r->h/3);y++)for(int x=max(0,r->x+r->w/2);x<min(nx,r->x+r->w+fork);x++)owners[y*COLS+x]=(unsigned char)i;
    }
  }
  offset_x=-pitch+sn(time*.14f)*pitch*.35f*chaos;
  offset_y=-pitch+cs(time*.12f)*pitch*.35f*chaos;
  for(int x=0;x<=nx;x++){
    int start=-1,last_id=0;
    for(int y=0;y<=ny;y++){
      int id=owner(x,y),yes=y<ny&&wall(x,y,0,id);
      if(start>=0&&(!yes||id!=last_id)){emit(x,start,x,y,last_id);start=-1;}
      if(yes&&start<0){start=y;last_id=id;}
    }
  }
  for(int y=0;y<=ny;y++){
    int start=-1,last_id=0;
    for(int x=0;x<=nx;x++){
      int id=owner(x,y),yes=x<nx&&wall(x,y,1,id);
      if(start>=0&&(!yes||id!=last_id)){emit(start,y,x,y,last_id);start=-1;}
      if(yes&&start<0){start=x;last_id=id;}
    }
  }
  clean_parallel_overlaps(1);
}
