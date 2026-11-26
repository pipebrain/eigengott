/* Freestanding WASM. Produces axis-aligned vector segments, never images.
   Stable geometry is a seeded rectangular subdivision with nested contours.
   Corruption migrates/copies fields and breaks/reconnects their wall runs. */
#define COLS 2048
#define ROWS 1536
#define REGIONS 96
#define PLANES 640
#define SEGMENTS 200000
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
static unsigned char owners[COLS*ROWS];
static Line lines[SEGMENTS];
static Line home_lines[SEGMENTS];
static unsigned line_owners[SEGMENTS];
static float plate_frames[PLANES*12],plate_quads[PLANES*8],edge_revisions[PLANES*4];
static float grid_priorities[PLANES*4];
static int perspective_count,fill_plane_count;
static float grid_x,grid_y;
static int home_count,plate_count;
static int region_count,line_count,nx,ny,budget,overflow,constant_gap;
static float pitch,offset_x,offset_y,amount,branching,breakage;
static int zx1,zy1,zx2,zy2;
static unsigned scene_seed;
static unsigned char guide[512*256];
static Line master[20000];static int master_count,reference_fill,reference_title_fill;
static unsigned char void_map[344*192];
__attribute__((export_name("get_master_buffer"))) unsigned get_master_buffer(void){return (unsigned)master;}
__attribute__((export_name("get_void_buffer"))) unsigned get_void_buffer(void){return (unsigned)void_map;}
__attribute__((export_name("set_master"))) void set_master(int count,int fill){master_count=min(20000,max(0,count));reference_fill=fill;}
__attribute__((export_name("set_reference_fill"))) void set_reference_fill(int fill){reference_fill=fill;}
__attribute__((export_name("set_reference_title_fill"))) void set_reference_title_fill(int fill){reference_title_fill=fill;}
static int guide_width,guide_height,layout_mode;
static float layout_strength=1,layout_variation,canvas_width,canvas_height;
static int mix_on,subdivision=5,contour_depth=16,plates_on,diagonal_on;
static float weights[4]={1,0,0,0},newest_bias=.85f,straight_bias=.75f,horizontal_bias=.5f;
static float plate_drift=1,plate_scale=.25f,plate_shear=.25f,plate_rotation=.25f,plate_depth=.6f,plate_overlap=.2f,plate_copies=.2f,diagonal_share=.25f;
static unsigned char division_edges[COLS*ROWS],growing_edges[COLS*ROWS],side_edges[COLS*ROWS];
static int active[COLS*ROWS],positions[COLS*ROWS];
static union {int integers[COLS*ROWS];float distances[COLS*ROWS];} history_workspace;
#define history history_workspace.integers
static int exact_columns,exact_rows,exact_start_x,exact_start_y,exact_coarsening;
static unsigned graph_key;
static int graph_nx,graph_ny;
__attribute__((export_name("set_mixer"))) void set_mixer(int enabled,float contour,float division,float growing,float side,float newest,float straight,float horizontal,int depth,int nested){
  mix_on=enabled;weights[0]=contour;weights[1]=division;weights[2]=growing;weights[3]=side;
  newest_bias=newest;straight_bias=straight;horizontal_bias=horizontal;subdivision=max(2,min(6,depth));contour_depth=max(2,nested);
}
__attribute__((export_name("set_plates"))) void set_plates(int enabled,float drift,float scale,float shear,float depth,float overlap,float copies,float rotation){plates_on=enabled;plate_drift=drift;plate_scale=scale;plate_shear=shear;plate_depth=depth;plate_overlap=overlap;plate_copies=copies;plate_rotation=rotation;}
__attribute__((export_name("set_diagonal"))) void set_diagonal(int enabled,float share){diagonal_on=enabled;diagonal_share=share;}
static void divide_graph(int x,int y,int w,int h,int depth){
  if(w<2||h<2||depth>24)return;
  int vertical=randf()>horizontal_bias;
  if(w>h*2)vertical=1;if(h>w*2)vertical=0;
  if(vertical){int cut=1+(int)(randf()*(w-1)),gap=(int)(randf()*h);for(int j=0;j<h;j++)if(j!=gap)division_edges[(y+j)*COLS+x+cut]|=1;divide_graph(x,y,cut,h,depth+1);divide_graph(x+cut,y,w-cut,h,depth+1);}
  else{int cut=1+(int)(randf()*(h-1)),gap=(int)(randf()*w);for(int i=0;i<w;i++)if(i!=gap)division_edges[(y+cut)*COLS+x+i]|=2;divide_graph(x,y,w,cut,depth+1);divide_graph(x,y+cut,w,h-cut,depth+1);}
}
static void build_graphs(unsigned seed){
  if(!mix_on)return;
  unsigned key=hash(seed^(unsigned)(newest_bias*10000)^(unsigned)(straight_bias*10000)*131U^(unsigned)(horizontal_bias*10000)*731U);
  if(graph_key==key&&graph_nx==nx&&graph_ny==ny)return;
  graph_key=key;graph_nx=nx;graph_ny=ny;
  for(int y=0;y<ny;y++)for(int x=0;x<nx;x++){int i=y*COLS+x;division_edges[i]=0;growing_edges[i]=0;side_edges[i]=0;}
  unsigned previous_rng=rng;rng=hash(seed+0x1a2bU);
  divide_graph(0,0,nx,ny,0);
  // Growing Tree: active cells are selected by weighted newest/random choice.
  int count=1,head=1,last_direction=0;active[0]=0;positions[0]=0;history[0]=0;growing_edges[0]=48;
  const int dx[4]={0,1,0,-1},dy[4]={-1,0,1,0},bit[4]={1,2,4,8};
  while(count){
    while(head>0&&!(growing_edges[history[head-1]]&32))head--;
    int at=randf()<newest_bias&&head?history[head-1]:active[min(count-1,(int)(randf()*count))];
    int x=at%COLS,y=at/COLS,choices[4],n=0;
    for(int d=0;d<4;d++){int xx=x+dx[d],yy=y+dy[d];if(xx>=0&&yy>=0&&xx<nx&&yy<ny&&!(growing_edges[yy*COLS+xx]&16))choices[n++]=d;}
    if(!n){int index=positions[at],replacement=active[--count];active[index]=replacement;positions[replacement]=index;growing_edges[at]&=~32;continue;}
    int d=choices[min(n-1,(int)(randf()*n))];
    if(randf()<straight_bias)for(int k=0;k<n;k++)if(choices[k]==last_direction)d=last_direction;
    if(randf()<.35f)for(int k=0;k<n;k++)if((choices[k]&1)==(randf()<horizontal_bias?1:0))d=choices[k];
    int next=(y+dy[d])*COLS+x+dx[d];growing_edges[at]|=bit[d];growing_edges[next]=48|bit[(d+2)%4];
    positions[next]=count;active[count++]=next;history[head++]=next;last_direction=d;
  }
  // Sidewinder: eastward runs occasionally carve a north connection.
  rng=hash(seed+0x37faU);
  for(int y=0;y<ny;y++){int start=0;for(int x=0;x<nx;x++){
    int i=y*COLS+x,close=x==nx-1||(y>0&&randf()>(.25f+straight_bias*.5f+horizontal_bias*.2f));
    if(close){if(y>0){int chosen=start+(int)(randf()*(x-start+1));side_edges[y*COLS+chosen]|=1;side_edges[(y-1)*COLS+chosen]|=4;}start=x+1;}
    else{side_edges[i]|=2;side_edges[i+1]|=8;}
  }}
  rng=previous_rng;
}
static int algorithm(int id){
  float total=weights[0]+weights[1]+weights[2]+weights[3];if(total<.0001f)return 0;
  float pick=(float)(hash(regions[id].seed+817U)>>8)/16777216.0f*total;
  for(int i=0;i<3;i++){pick-=weights[i];if(pick<0)return i;}return 3;
}
static int graph_wall(int x,int y,int horizontal,int algo){
  x=max(0,min(nx-1,x));y=max(0,min(ny-1,y));int at=y*COLS+x;
  if(algo==1)return (division_edges[at]&(horizontal?2:1))!=0;
  unsigned char *map=algo==2?growing_edges:side_edges;
  return (map[at]&(horizontal?1:8))==0;
}
static int diagonal_region(int id){return diagonal_on&&(float)(hash(regions[id].seed+0x517fU)>>8)/16777216.0f<diagonal_share;}
static int procedural_region(int id){return diagonal_region(id)||(mix_on&&algorithm(id)>0)||(float)(hash(regions[id].seed+0x953bU)>>8)/16777216.0f<amount;}
__attribute__((export_name("get_guide_buffer"))) unsigned get_guide_buffer(void){return (unsigned)guide;}
__attribute__((export_name("set_guide_size"))) void set_guide_size(int width,int height){if(width>0&&width<=512&&height>0&&height<=256){guide_width=width;guide_height=height;}}
__attribute__((export_name("set_layout"))) void set_layout(int mode,float influence,float variation){layout_mode=mode;layout_strength=influence;layout_variation=variation;}
__attribute__((export_name("get_buffer"))) unsigned get_buffer(void){return (unsigned)lines;}
__attribute__((export_name("get_count"))) int get_count(void){return line_count;}
__attribute__((export_name("get_line_owners"))) unsigned get_line_owners(void){return (unsigned)line_owners;}
__attribute__((export_name("get_plate_frames"))) unsigned get_plate_frames(void){return (unsigned)plate_frames;}
__attribute__((export_name("get_plate_quads"))) unsigned get_plate_quads(void){return (unsigned)plate_quads;}
__attribute__((export_name("get_edge_revisions"))) unsigned get_edge_revisions(void){return (unsigned)edge_revisions;}
__attribute__((export_name("get_grid_priorities"))) unsigned get_grid_priorities(void){return (unsigned)grid_priorities;}
__attribute__((export_name("get_grid_cells"))) unsigned get_grid_cells(void){return (unsigned)active;}
__attribute__((export_name("get_grid_columns"))) int get_grid_columns(void){return exact_columns;}
__attribute__((export_name("get_grid_rows"))) int get_grid_rows(void){return exact_rows;}
__attribute__((export_name("get_grid_start_x"))) int get_grid_start_x(void){return exact_start_x;}
__attribute__((export_name("get_grid_start_y"))) int get_grid_start_y(void){return exact_start_y;}
__attribute__((export_name("get_grid_coarsening"))) int get_grid_coarsening(void){return exact_coarsening;}
__attribute__((export_name("get_perspective_count"))) int get_perspective_count(void){return perspective_count;}
__attribute__((export_name("get_fill_plane_count"))) int get_fill_plane_count(void){return fill_plane_count;}
__attribute__((export_name("get_plate_count"))) int get_plate_count(void){return plate_count;}
__attribute__((export_name("get_regions"))) int get_regions(void){return region_count;}
__attribute__((export_name("get_overflow"))) int get_overflow(void){return overflow;}
__attribute__((export_name("get_phase_x"))) float get_phase_x(void){return offset_x;}
__attribute__((export_name("get_phase_y"))) float get_phase_y(void){return offset_y;}
static void leaf(int x,int y,int w,int h,float turns){
  int id=region_count++;
  Region *r=&regions[id];r->x=x;r->y=y;r->w=w;r->h=h;r->seed=hash(rng+id*919U);
  int corner=(int)(randf()*4);
  r->ax=x+((corner&1)?w+1:-1);r->ay=y+((corner&2)?h+1:-1);
  r->type=randf()<turns?0:(randf()<.5f?1:2);r->dx=0;r->dy=0;r->rotation=0;
  for(int j=y;j<y+h;j++)for(int i=x;i<x+w;i++)owners[j*COLS+i]=(unsigned char)id;
}

// Extend the field only where actual vector walls leave a dead zone. The
// original centerlines are never moved or replaced by this operation.
__attribute__((export_name("fill_dead_zones"))) void fill_dead_zones(void){
  float cell=pitch*.5f,radius=pitch;int gw=min(COLS,(int)(canvas_width/cell)+2),gh=min(ROWS,(int)(canvas_height/cell)+2);
  for(int y=0;y<gh;y++)for(int x=0;x<gw;x++)division_edges[y*COLS+x]=0;
  int original=line_count;
  for(int i=0;i<original;i++){
    Line l=lines[i];float dx=l.x2-l.x1,dy=l.y2-l.y1,length=dx*dx+dy*dy;
    float lx=l.x1<l.x2?l.x1:l.x2,hx=l.x1>l.x2?l.x1:l.x2,ly=l.y1<l.y2?l.y1:l.y2,hy=l.y1>l.y2?l.y1:l.y2;
    for(int y=max(0,(int)((ly-radius)/cell));y<min(gh,(int)((hy+radius)/cell)+1);y++)for(int x=max(0,(int)((lx-radius)/cell));x<min(gw,(int)((hx+radius)/cell)+1);x++){
      float px=(x+.5f)*cell,py=(y+.5f)*cell,t=length>0?((px-l.x1)*dx+(py-l.y1)*dy)/length:0;if(t<0)t=0;if(t>1)t=1;
      float ax=px-l.x1-t*dx,ay=py-l.y1-t*dy;
      if(ax*ax+ay*ay<radius*radius)division_edges[y*COLS+x]=1;
    }
  }
  for(int horizontal=0;horizontal<2;horizontal++){
    int rows=(int)((horizontal?canvas_height:canvas_width)/pitch)+2,steps=(int)((horizontal?canvas_width:canvas_height)/cell)+2;
    for(int r=0;r<rows;r++){
      int start=-1;float fixed=r*pitch;
      for(int k=0;k<=steps;k++){
        float variable=k*cell,px=horizontal?variable:fixed,py=horizontal?fixed:variable;
        int gx=max(0,min(gw-1,(int)(px/cell))),gy=max(0,min(gh-1,(int)(py/cell)));
        int fx=max(0,min(guide_width-1,(int)(px/canvas_width*guide_width))),fy=max(0,min(guide_height-1,(int)(py/canvas_height*guide_height)));
        int direction=guide_width&&guide_height?guide[fy*guide_width+fx]:1;
        int yes=k<steps&&px<=canvas_width&&py<=canvas_height&&!division_edges[gy*COLS+gx]&&direction==horizontal;
        if(start>=0&&!yes){
          if(line_count<budget){float a=start*cell,b=(k-1)*cell;if(b>a)lines[line_count++]=horizontal?(Line){a,fixed,b,fixed}:(Line){fixed,a,fixed,b};}else overflow=1;
          start=-1;
        }
        if(yes&&start<0)start=k;
      }
    }
  }
  graph_key=0;graph_nx=0; // The graph scratch field was borrowed for clearance.
}

__attribute__((export_name("capture_home"))) void capture_home(void){
  home_count=line_count;for(int i=0;i<home_count;i++)home_lines[i]=lines[i];
}
__attribute__((export_name("clean_parallel_overlaps"))) void clean_parallel_overlaps(float width){
  int original=line_count;for(int i=0;i<original;i++)home_lines[i]=lines[i];line_count=0;
  for(int i=original-1;i>=0;i--){
    Line l=home_lines[i];float dx=l.x2-l.x1,dy=l.y2-l.y1,len=__builtin_sqrtf(dx*dx+dy*dy);if(len<.01f)continue;
    float ux=dx/len,uy=dy/len,intervals[512];int count=1;intervals[0]=0;intervals[1]=len;
    int accepted=line_count;
    for(int j=0;j<accepted&&count;j++){
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
    for(int k=0;k<count;k++)if(intervals[k*2+1]-intervals[k*2]>.5f&&line_count<budget){float a=intervals[k*2],b=intervals[k*2+1];lines[line_count++]=(Line){l.x1+ux*a,l.y1+uy*a,l.x1+ux*b,l.y1+uy*b};}
  }
}
static float low(float a,float b){return a<b?a:b;}
static float high(float a,float b){return a>b?a:b;}
static int clip_axis(float a,float delta,float lo,float hi,float *enter,float *leave){
  if(delta>-.00001f&&delta<.00001f)return a>=lo&&a<=hi;
  float u=(lo-a)/delta,v=(hi-a)/delta;if(u>v){float tmp=u;u=v;v=tmp;}
  *enter=high(*enter,u);*leave=low(*leave,v);return *enter<*leave;
}
static void transform_point(float *x,float *y,float cx,float cy,float sx,float sy,int turn,float tx,float ty){
  float a=(*x-cx)*sx,b=(*y-cy)*sy;turn=(turn%4+4)%4;
  if(turn==1){*x=cx-b+tx;*y=cy+a+ty;}else if(turn==2){*x=cx-a+tx;*y=cy-b+ty;}else if(turn==3){*x=cx+b+tx;*y=cy-a+ty;}else{*x=cx+a+tx;*y=cy+b+ty;}
}
static float snap_x(float x){return rounded((x-grid_x)/pitch)*pitch+grid_x;}
static float snap_y(float y){return rounded((y-grid_y)/pitch)*pitch+grid_y;}
__attribute__((export_name("snap_grid"))) void snap_grid(float origin_x,float origin_y){
  grid_x=origin_x;grid_y=origin_y;int count=0;
  for(int i=0;i<line_count;i++){
    Line l=lines[i];l.x1=snap_x(l.x1);l.y1=snap_y(l.y1);l.x2=snap_x(l.x2);l.y2=snap_y(l.y2);
    if(l.x1==l.x2&&l.y1==l.y2)continue;lines[count]=l;line_owners[count++]=line_owners[i];
  }line_count=count;
  for(int i=0;i<plate_count*8;i++)plate_quads[i]=(i&1)?snap_y(plate_quads[i]):snap_x(plate_quads[i]);
}
static void frame_quad(int index){
  float *f=&plate_frames[index*12],*q=&plate_quads[index*8];
  const float xs[4]={-.5f,.5f,.5f,-.5f},ys[4]={-.5f,-.5f,.5f,.5f};
  for(int k=0;k<4;k++){q[k*2]=f[0]+xs[k]*f[2];q[k*2+1]=f[1]+ys[k]*f[3];transform_point(&q[k*2],&q[k*2+1],f[0],f[1],f[4],f[5],(int)f[8],f[6],f[7]);}
}
__attribute__((export_name("animate_home"))) void animate_home(float state,float time,unsigned motion_seed,unsigned order_seed,float travel,float expansion,float shear,float rotation){
  line_count=0;plate_count=0;perspective_count=0;fill_plane_count=0;overflow=0;
  if(state<.000001f){for(int i=0;i<home_count&&line_count<budget;i++){lines[line_count]=home_lines[i];line_owners[line_count++]=0;}return;}
  // The lower stratum drifts too. Wrapped copies keep its field continuous,
  // without exposing an unchanged copy of the reference beneath every gap.
  float phase0=(float)(hash(motion_seed+983U)>>8)/16777216.0f*6.2831853f;
  float base_dx=sn(time*.09f+phase0)*canvas_width*state*travel*.1f,base_dy=cs(time*.08f+phase0)*canvas_height*state*travel*.14f;
  if(constant_gap){base_dx=rounded(base_dx/pitch)*pitch;base_dy=rounded(base_dy/pitch)*pitch;}
  for(int tile_y=-1;tile_y<=1;tile_y++)for(int tile_x=-1;tile_x<=1;tile_x++)for(int i=0;i<home_count;i++){
    Line l=home_lines[i];float dx=base_dx+tile_x*canvas_width,dy=base_dy+tile_y*canvas_height;
    float a=0,b=1,lx=l.x2-l.x1,ly=l.y2-l.y1;
    if(!clip_axis(l.x1,lx,0,canvas_width,&a,&b)||!clip_axis(l.y1,ly,0,canvas_height,&a,&b))continue;
    l=(Line){l.x1+a*lx,l.y1+a*ly,l.x1+b*lx,l.y1+b*ly};
    if(high(l.x1,l.x2)+dx<0||low(l.x1,l.x2)+dx>canvas_width||high(l.y1,l.y2)+dy<0||low(l.y1,l.y2)+dy>canvas_height)continue;
    if(line_count>=budget){overflow=1;break;}lines[line_count]=(Line){l.x1+dx,l.y1+dy,l.x2+dx,l.y2+dy};line_owners[line_count++]=0;
  }
  int order[REGIONS];for(int i=0;i<region_count;i++)order[i]=i;
  for(int a=1;a<region_count;a++){int id=order[a],j=a-1;unsigned key=hash((order_seed?order_seed:scene_seed)+id*131U);while(j>=0&&hash((order_seed?order_seed:scene_seed)+order[j]*131U)>key){order[j+1]=order[j];j--;}order[j+1]=id;}
  for(int copy=1;copy>=0;copy--)for(int index=0;index<region_count;index++){
    int id=order[index];Region *r=&regions[id];float phase=(float)(hash(motion_seed+id*331U)>>8)/16777216.0f*6.2831853f;
    float depth=(float)(hash(scene_seed+id*191U)>>8)/16777216.0f;
    if(copy&&(depth>=plate_copies||plate_count>=REGIONS-region_count))continue;if(plate_count>=REGIONS)continue;
    float x=high(0,r->x*pitch-pitch),y=high(0,r->y*pitch-pitch),w=low(canvas_width,(r->x+r->w)*pitch-pitch)-x,h=low(canvas_height,(r->y+r->h)*pitch-pitch)-y;
    if(w<=0||h<=0)continue;
    float cx=x+w*.5f,cy=y+h*.5f;
    float sx=1+sn(time*.11f+phase)*state*expansion*.8f+state*plate_overlap*.2f,sy=1+cs(time*.13f+phase)*state*expansion*.8f+state*plate_overlap*.2f;
    float separation=.6f+depth*plate_depth*.4f;
    float tx=(sn(phase+time*.13f)*.22f+cs(phase*.7f)*.06f)*canvas_width*state*travel*separation;
    float ty=(cs(phase+time*.11f)*.3f+sn(phase*.8f)*.08f)*canvas_height*state*travel*separation;
    tx+=sn(time*.17f+phase)*state*shear*w*.3f;
    if(copy){tx-=canvas_width*state*.17f;ty+=canvas_height*state*.2f;}
    if(constant_gap){sx=1;sy=1;tx=rounded(tx/pitch)*pitch;ty=rounded(ty/pitch)*pitch;}
    int turn=rounded(sn(phase+time*.07f)*state*rotation*1.4f);
    unsigned identity=id+1+copy*REGIONS;
    float *frame=&plate_frames[plate_count++*12];frame[0]=cx;frame[1]=cy;frame[2]=w;frame[3]=h;frame[4]=sx;frame[5]=sy;frame[6]=tx;frame[7]=ty;frame[8]=turn;frame[9]=identity;frame[10]=0;frame[11]=0;
    frame_quad(plate_count-1);
    for(int i=0;i<home_count;i++){
      Line l=home_lines[i];float a=0,b=1,dx=l.x2-l.x1,dy=l.y2-l.y1;
      if(!clip_axis(l.x1,dx,x,x+w,&a,&b)||!clip_axis(l.y1,dy,y,y+h,&a,&b))continue;
      Line part={l.x1+a*dx,l.y1+a*dy,l.x1+b*dx,l.y1+b*dy};
      transform_point(&part.x1,&part.y1,cx,cy,sx,sy,turn,tx,ty);transform_point(&part.x2,&part.y2,cx,cy,sx,sy,turn,tx,ty);
      if(line_count>=budget){overflow=1;continue;}lines[line_count]=part;line_owners[line_count++]=identity;
    }
  }
}
static void profile_line(float x1,float y1,float x2,float y2,unsigned id){
  if(line_count>=budget){overflow=1;return;}if(__builtin_fabsf(x2-x1)+__builtin_fabsf(y2-y1)<.01f)return;
  lines[line_count]=(Line){x1,y1,x2,y2};line_owners[line_count++]=id;
}
static int profile_quad(const float *q,unsigned id,int kind,unsigned parent){
  if(plate_count>=PLANES)return -1;int index=plate_count++;float *f=&plate_frames[index*12];
  float x1=q[0],x2=q[0],y1=q[1],y2=q[1];for(int k=0;k<4;k++){x1=low(x1,q[k*2]);x2=high(x2,q[k*2]);y1=low(y1,q[k*2+1]);y2=high(y2,q[k*2+1]);plate_quads[index*8+k*2]=q[k*2];plate_quads[index*8+k*2+1]=q[k*2+1];}
  f[0]=(x1+x2)*.5f;f[1]=(y1+y2)*.5f;f[2]=x2-x1;f[3]=y2-y1;f[4]=1;f[5]=1;f[6]=0;f[7]=0;f[8]=0;f[9]=id;f[10]=kind;f[11]=parent;
  return index;
}
__attribute__((export_name("redraw_profiles"))) void redraw_profiles(float state,float time,float depth,float vx,float vy,int columns,int rows,float hatch_rate,float speed,float jog,int show_perspective,int show_fill){
  if(state<.000001f)return;
  float source[REGIONS*8];unsigned ids[REGIONS];int old_count=min(REGIONS,plate_count);
  for(int i=0;i<old_count;i++){ids[i]=(unsigned)plate_frames[i*12+9];for(int k=0;k<8;k++)source[i*8+k]=plate_quads[i*8+k];}
  plate_count=0;perspective_count=0;fill_plane_count=0;
  int retained=0;for(int i=0;i<line_count;i++)if(show_perspective&&line_owners[i]!=0){lines[retained]=lines[i];line_owners[retained++]=line_owners[i];}line_count=retained;
  if(show_fill){
    columns=max(2,min(10,columns));rows=max(2,min(8,rows));
    for(int y=0;y<rows;y++)for(int x=0;x<columns;x++){
      int tile=y*columns+x;unsigned id=4096U+tile;
      float x1=canvas_width*x/columns,x2=canvas_width*(x+1)/columns,y1=canvas_height*y/rows,y2=canvas_height*(y+1)/rows;
      if(constant_gap){x1=snap_x(x1);x2=snap_x(x2);y1=snap_y(y1);y2=snap_y(y2);if(x==0)x1=low(x1,0);if(y==0)y1=low(y1,0);if(x==columns-1)x2=high(x2,canvas_width);if(y==rows-1)y2=high(y2,canvas_height);}
      float q[8]={x1,y1,x2,y1,x2,y2,x1,y2};if(profile_quad(q,id,3,id)<0)continue;fill_plane_count++;
      unsigned h=hash(scene_seed+tile*419U+(unsigned)(time*hatch_rate)*971U);int horizontal=h&1;
      plate_frames[(plate_count-1)*12+8]=horizontal;
      float moving=time*speed*pitch*4,phase=constant_gap?0:moving-(int)(moving/pitch)*pitch;
      float bend=(horizontal?(x1+x2)*.5f:(y1+y2)*.5f)+sn(time*speed+tile*1.71f)*jog*(horizontal?x2-x1:y2-y1)*.4f;
      bend=constant_gap?(horizontal?snap_x(bend):snap_y(bend)):bend;
      float from=horizontal?y1:x1,to=horizontal?y2:x2,origin=horizontal?grid_y:grid_x;
      int start=(int)((from-origin)/pitch)-1,end=(int)((to-origin)/pitch)+1;
      for(int k=start;k<=end;k++){
        float at=k*pitch+origin+phase;if(at<from||at>to)continue;
        float shift=jog>0?pitch:0;
        if(horizontal){profile_line(x1,at,bend,at,id);profile_line(bend,at,bend,at+shift,id);profile_line(bend,at+shift,x2,at+shift,id);}
        else{profile_line(at,y1,at,bend,id);profile_line(at,bend,at+shift,bend,id);profile_line(at+shift,bend,at+shift,y2,id);}
      }
    }
  }
  if(show_perspective){
    float factor=1/(1+depth*state);
    for(int i=0;i<old_count;i++){
      float *front=&source[i*8];float xl=front[0],xr=front[0],yt=front[1],yb=front[1];
      for(int k=1;k<4;k++){xl=low(xl,front[k*2]);xr=high(xr,front[k*2]);yt=low(yt,front[k*2+1]);yb=high(yb,front[k*2+1]);}
      float cap[8]={xl,yt,xr,yt,xr,yb,xl,yb};
      for(int side=0;side<4;side++){
        if(!((side==0&&vy<yt)||(side==1&&vx>xr)||(side==2&&vy>yb)||(side==3&&vx<xl)))continue;
        int a=side,b=(side+1)%4;float ax=cap[a*2],ay=cap[a*2+1],bx=cap[b*2],by=cap[b*2+1];
        float q[8]={ax,ay,bx,by,vx+(bx-vx)*factor,vy+(by-vy)*factor,vx+(ax-vx)*factor,vy+(ay-vy)*factor};
        unsigned id=512U+ids[i]*4U+side;if(profile_quad(q,id,2,ids[i])<0)continue;perspective_count++;
        int horizontal=ay==by;float near=horizontal?ay:ax,far=horizontal?q[5]:q[4],center=horizontal?vy:vx,origin=horizontal?grid_y:grid_x;
        int start=(int)((low(near,far)-origin)/pitch)-1,end=(int)((high(near,far)-origin)/pitch)+1;
        for(int k=start;k<=end;k++){
          float coordinate=k*pitch+origin;if(coordinate<low(near,far)||coordinate>high(near,far))continue;
          float f=(coordinate-center)/(near-center);
          if(horizontal)profile_line(vx+(ax-vx)*f,coordinate,vx+(bx-vx)*f,coordinate,id);
          else profile_line(coordinate,vy+(ay-vy)*f,coordinate,vy+(by-vy)*f,id);
        }
      }
      profile_quad(cap,ids[i],1,ids[i]);
    }
  }
}
static float segment_distance(float px,float py,float ax,float ay,float bx,float by){
  float dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len>0?((px-ax)*dx+(py-ay)*dy)/len:0;t=low(1,high(0,t));
  float x=px-ax-t*dx,y=py-ay-t*dy;return __builtin_sqrtf(x*x+y*y);
}
__attribute__((export_name("redraw_edges"))) void redraw_edges(float band){
  int lookup[8192];for(int i=0;i<8192;i++)lookup[i]=-1;for(int i=0;i<plate_count;i++){unsigned id=(unsigned)plate_frames[i*12+9];if(id<8192)lookup[id]=i;}
  for(int i=0;i<line_count;i++){
    unsigned id=line_owners[i];int index=id<8192?lookup[id]:-1;if(index<0)continue;
    Line *l=&lines[i];float dx=l->x2-l->x1,dy=l->y2-l->y1,len=__builtin_sqrtf(dx*dx+dy*dy);if(len<pitch*3)continue;
    float *q=&plate_quads[index*8],*revisions=&edge_revisions[index*4];
    for(int end=0;end<2;end++){
      float x=end?l->x2:l->x1,y=end?l->y2:l->y1,best=band*pitch;int edge=-1;
      for(int k=0;k<4;k++)if(revisions[k]>0){int n=(k+1)%4;float d=segment_distance(x,y,q[k*2],q[k*2+1],q[n*2],q[n*2+1]);if(d<best){best=d;edge=k;}}
      if(edge<0)continue;float trim=low(len*.2f,pitch*(1+((int)revisions[edge]%2)));
      if(end){l->x2-=dx/len*trim;l->y2-=dy/len*trim;}else{l->x1+=dx/len*trim;l->y1+=dy/len*trim;}
    }
  }
}

static int floor_i(float value){int v=(int)value;return v-(value<v);}
static float distance_squared(float px,float py,float ax,float ay,float bx,float by){
  float dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy,t=length>0?((px-ax)*dx+(py-ay)*dy)/length:0;t=low(1,high(0,t));
  float x=px-ax-t*dx,y=py-ay-t*dy;return x*x+y*y;
}
static int inside_quad(float x,float y,const float *q){
  int positive=0,negative=0;
  for(int k=0;k<4;k++){int j=(k+1)%4;float c=(q[j*2]-q[k*2])*(y-q[k*2+1])-(q[j*2+1]-q[k*2+1])*(x-q[k*2]);positive|=c>.001f;negative|=c<-.001f;}
  return !(positive&&negative);
}
static int nearest_edge(float x,float y,const float *q,float *distance){
  int edge=0;*distance=1e30f;
  for(int k=0;k<4;k++){int j=(k+1)%4;float d=distance_squared(x,y,q[k*2],q[k*2+1],q[j*2],q[j*2+1]);if(d<*distance){*distance=d;edge=k;}}
  return edge;
}
static int grid_vertical(int x,int y){
  return (x>0&&(active[y*COLS+x-1]&2))||(x<exact_columns&&(active[y*COLS+x]&2));
}
static int grid_horizontal(int x,int y){
  return (y>0&&(active[(y-1)*COLS+x]&1))||(y<exact_rows&&(active[y*COLS+x]&1));
}
static void emit_exact_grid(void){
  line_count=0;overflow=0;
  for(int x=0;x<=exact_columns;x++){
    int start=-1;for(int y=0;y<=exact_rows;y++){
      int yes=y<exact_rows&&grid_vertical(x,y);
      if(start>=0&&!yes){float xx=grid_x+(exact_start_x+x)*pitch;profile_line(xx,grid_y+(exact_start_y+start)*pitch,xx,grid_y+(exact_start_y+y)*pitch,0);start=-1;}
      if(yes&&start<0)start=y;
    }
  }
  for(int y=0;y<=exact_rows;y++){
    int start=-1;for(int x=0;x<=exact_columns;x++){
      int yes=x<exact_columns&&grid_horizontal(x,y);
      if(start>=0&&!yes){float yy=grid_y+(exact_start_y+y)*pitch;profile_line(grid_x+(exact_start_x+start)*pitch,yy,grid_x+(exact_start_x+x)*pitch,yy,0);start=-1;}
      if(yes&&start<0)start=x;
    }
  }
}
// Exact spacing is a topology constraint, not endpoint rounding. Each cell
// receives a horizontal and/or vertical wall pair separated by exactly pitch.
// Resolve visibility once per cell before producing merged vector geometry.
__attribute__((export_name("enforce_exact_grid"))) void enforce_exact_grid(float origin_x,float origin_y,int prevent_overlaps,float redraw_band){
  grid_x=origin_x;grid_y=origin_y;exact_coarsening=1;
  if(!line_count){exact_columns=exact_rows=0;return;}
  exact_start_x=floor_i(-grid_x/pitch)-1;exact_start_y=floor_i(-grid_y/pitch)-1;
  exact_columns=min(COLS-2,(int)(canvas_width/pitch)+4);exact_rows=min(ROWS-2,(int)(canvas_height/pitch)+4);
  budget=max(budget,min(exact_columns,exact_rows)+1);
  int profile_scene=0,fill_scene=0;for(int i=0;i<plate_count;i++){int kind=(int)plate_frames[i*12+10];profile_scene|=kind>0;fill_scene|=kind==3;}
  float start_x=grid_x+exact_start_x*pitch,start_y=grid_y+exact_start_y*pitch;
  for(int y=0;y<exact_rows;y++)for(int x=0;x<exact_columns;x++){int at=y*COLS+x;positions[at]=-1;active[at]=0;history_workspace.distances[at]=-1;}
  for(int i=0;i<plate_count;i++){
    float *q=&plate_quads[i*8],xl=q[0],xr=q[0],yt=q[1],yb=q[1];
    for(int k=1;k<4;k++){xl=low(xl,q[k*2]);xr=high(xr,q[k*2]);yt=low(yt,q[k*2+1]);yb=high(yb,q[k*2+1]);}
    for(int y=max(0,floor_i((yt-start_y)/pitch));y<min(exact_rows,floor_i((yb-start_y)/pitch)+1);y++)for(int x=max(0,floor_i((xl-start_x)/pitch));x<min(exact_columns,floor_i((xr-start_x)/pitch)+1);x++){
      float px=start_x+(x+.5f)*pitch,py=start_y+(y+.5f)*pitch;if(!inside_quad(px,py,q))continue;
      float distance;int edge=nearest_edge(px,py,q,&distance),at=y*COLS+x;float rank=grid_priorities[i*4+edge];
      if(rank>=history_workspace.distances[at]){history_workspace.distances[at]=rank;positions[at]=i;}
    }
  }
  for(int y=0;y<exact_rows;y++)for(int x=0;x<exact_columns;x++)history_workspace.distances[y*COLS+x]=1e30f;
  float radius=pitch*2.5f;
  for(int i=0;i<line_count;i++){
    Line l=lines[i];float dx=l.x2-l.x1,dy=l.y2-l.y1;int direction=__builtin_fabsf(dx)>=__builtin_fabsf(dy)?1:2;
    for(int y=max(0,floor_i((low(l.y1,l.y2)-radius-start_y)/pitch));y<min(exact_rows,floor_i((high(l.y1,l.y2)+radius-start_y)/pitch)+1);y++)for(int x=max(0,floor_i((low(l.x1,l.x2)-radius-start_x)/pitch));x<min(exact_columns,floor_i((high(l.x1,l.x2)+radius-start_x)/pitch)+1);x++){
      int at=y*COLS+x,owner_index=positions[at];unsigned expected=owner_index<0?0:(unsigned)plate_frames[owner_index*12+9];
      if(prevent_overlaps&&line_owners[i]!=expected)continue;
      float px=start_x+(x+.5f)*pitch,py=start_y+(y+.5f)*pitch,d=distance_squared(px,py,l.x1,l.y1,l.x2,l.y2);
      if(!prevent_overlaps&&d<pitch*pitch*.36f){active[at]|=direction;history_workspace.distances[at]=0;}
      else if(d<history_workspace.distances[at]){history_workspace.distances[at]=d;active[at]=direction;}
    }
  }
  for(int y=0;y<exact_rows;y++)for(int x=0;x<exact_columns;x++){
    int at=y*COLS+x,index=positions[at];float px=start_x+(x+.5f)*pitch,py=start_y+(y+.5f)*pitch;
    if(!active[at]){
      if(profile_scene&&!fill_scene&&index<0)continue;
      int gx=max(0,min(guide_width-1,(int)(px/canvas_width*guide_width))),gy=max(0,min(guide_height-1,(int)(py/canvas_height*guide_height)));
      active[at]=guide_width&&guide_height?(guide[gy*guide_width+gx]?1:2):1;
      if(index>=0){int kind=(int)plate_frames[index*12+10];float *q=&plate_quads[index*8];if(kind==2)active[at]=__builtin_fabsf(q[1]-q[3])<.01f?1:2;if(kind==3)active[at]=plate_frames[index*12+8]>.5f?1:2;}
    }
    if(redraw_band>0&&index>=0){
      float distance;int edge=nearest_edge(px,py,&plate_quads[index*8],&distance);unsigned revision=(unsigned)edge_revisions[index*4+edge];
      if(revision&&distance<redraw_band*redraw_band*pitch*pitch&&hash(revision+(unsigned)(x+exact_start_x)*337U+(unsigned)(y+exact_start_y)*971U)%3==0)active[at]=active[at]==1?2:1;
    }
  }
  emit_exact_grid();
  // Reduce directional detail if the user's budget is too small. Never drop
  // arbitrary walls: every coarsened cell still has its exact wall pair.
  while(overflow&&exact_coarsening<max(exact_columns,exact_rows)){
    exact_coarsening*=2;int block=exact_coarsening;
    for(int y=0;y<exact_rows;y+=block)for(int x=0;x<exact_columns;x+=block){
      int value=active[min(exact_rows-1,y+block/2)*COLS+min(exact_columns-1,x+block/2)];
      if(!value)for(int j=y;j<min(exact_rows,y+block)&&!value;j++)for(int k=x;k<min(exact_columns,x+block)&&!value;k++)value=active[j*COLS+k];
      for(int j=y;j<min(exact_rows,y+block);j++)for(int k=x;k<min(exact_columns,x+block);k++)if(active[j*COLS+k])active[j*COLS+k]=value;
    }
    emit_exact_grid();
  }
  if(overflow){budget=SEGMENTS;emit_exact_grid();}
  graph_key=0;graph_nx=0;
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
  if(x>=zx1&&x<=zx2&&y>=zy1&&y<=zy2)return y;
  Region *r=&regions[id];
  if(r->type==1)return y;
  if(r->type==2)return x;
  return max(abs_i(x-r->ax),abs_i(y-r->ay));
}
static int wall(int x,int y,int horizontal,int id){
  if(diagonal_region(id))return 0;
  int a=level(x,y,id),vertical=a!=level(x-1,y,id),across=a!=level(x,y-1,id);
  if(!vertical&&!across){if(regions[id].type==2)vertical=1;else across=1;}
  if(layout_mode&&guide_width&&guide_height){
    Region *r=&regions[id];
    float pick=(float)(hash(r->seed+0x318aU)>>8)/16777216.0f;
    if(pick<layout_strength*(1-amount*.9f)){
      float jitter_x=((float)(hash(r->seed+17U)>>8)/16777216.0f-.5f)*layout_variation*120;
      float jitter_y=((float)(hash(r->seed+29U)>>8)/16777216.0f-.5f)*layout_variation*90;
      int gx=(int)(((x-.5f)*pitch-r->dx*.8f+jitter_x)/canvas_width*guide_width);
      int gy=(int)(((y-.5f)*pitch-r->dy*.8f+jitter_y)/canvas_height*guide_height);
      int direction=guide[max(0,min(guide_height-1,gy))*guide_width+max(0,min(guide_width-1,gx))];
      vertical=direction==0;across=direction==1;
      if(x>=zx1&&x<=zx2&&y>=zy1&&y<=zy2){vertical=0;across=1;}
    }
  }
  int yes=horizontal?across:vertical;
  if(mix_on){int algo=algorithm(id);if(algo)yes=graph_wall(x,y,horizontal,algo);else if(contour_depth!=16&&level(x,y,id)%contour_depth==0)yes=horizontal?vertical:across;}
  if(plates_on&&(regions[id].rotation&1))yes=horizontal?vertical:across;
  unsigned cell=hash(scene_seed+(unsigned)x*92837111U+(unsigned)y*689287499U+(horizontal?0x19afU:0x723eU));
  float chance=(float)(cell>>8)/16777216.0f;
  // Branches are sparse at rest. Corruption introduces more contradicting
  // junctions and missing wall pieces without promising actual solvability.
  if(chance<branching*(.18f+amount*.75f))yes=1;
  unsigned damage=hash(scene_seed+(unsigned)x*92837111U+(unsigned)y*689287499U+0xb5297a4dU);
  if((float)(damage>>8)/16777216.0f<amount*amount*breakage*.48f){
    // Constant-gap corruption reroutes the local wall instead of erasing
    // whole cells into oversized voids. Free mode may tear walls apart.
    yes=constant_gap?(horizontal?vertical:across):0;
  }
  return yes;
}
static void emit_raw(float x1,float y1,float x2,float y2,int id){
  if(line_count>=budget){overflow=1;return;}
  float dx=offset_x,dy=offset_y;
  if(!constant_gap){dx+=regions[id].dx;dy+=regions[id].dy;}
  lines[line_count++]=(Line){x1*pitch+dx,y1*pitch+dy,x2*pitch+dx,y2*pitch+dy};
}
static void emit(float x1,float y1,float x2,float y2,int id){
  if(layout_mode!=2||!master_count||procedural_region(id)){emit_raw(x1,y1,x2,y2,id);return;}
  if(!reference_fill&&!reference_title_fill)return;
  float dx=x2-x1,dy=y2-y1;int steps=max(1,max(abs_i((int)dx),abs_i((int)dy))),start=-1;
  for(int k=0;k<=steps;k++){
    float t=(k+.5f)/steps,px=(x1+dx*t)*pitch+offset_x,py=(y1+dy*t)*pitch+offset_y;
    int vx=max(0,min(343,(int)(px/canvas_width*344))),vy=max(0,min(191,(int)(py/canvas_height*192)));
    float fit=canvas_width/1376;if(canvas_height/768<fit)fit=canvas_height/768;
    float source_x=(px-(canvas_width-1376*fit)*.5f)/fit,source_y=(py-(canvas_height-768*fit)*.5f)/fit;
    int title_band=source_x>=319&&source_x<=1076&&source_y>=263&&source_y<=507;
    int yes=k<steps&&((reference_fill&&void_map[vy*344+vx])||title_band);
    if(start>=0&&!yes){float a=(float)start/steps,b=(float)k/steps;emit_raw(x1+dx*a,y1+dy*a,x1+dx*b,y1+dy*b,id);start=-1;}
    if(yes&&start<0)start=k;
  }
}
__attribute__((export_name("generate"))) void generate(float width,float height,float wall_width,float path_width,unsigned seed,
 float turns,float branches,float chaos,int keep_gap,float drift,float copies,float damage,float time,int max_segments,
 float title_x1,float title_y1,float title_x2,float title_y2){
  pitch=wall_width+path_width;
  canvas_width=width;canvas_height=height;
  if(pitch<1)pitch=1;
  nx=min(COLS-2,(int)(width/pitch)+4);ny=min(ROWS-2,(int)(height/pitch)+4);
  region_count=0;line_count=0;overflow=0;budget=min(SEGMENTS,max(100,max_segments));
  constant_gap=keep_gap;amount=chaos;branching=branches;breakage=damage;scene_seed=seed;rng=seed?seed:1;
  zx1=(int)(title_x1/pitch);zy1=(int)(title_y1/pitch);zx2=(int)(title_x2/pitch);zy2=(int)(title_y2/pitch);
  divide(0,0,nx,ny,0,turns);
  build_graphs(seed);
  for(int i=0;i<region_count;i++){
    Region *r=&regions[i];float s=(float)(r->seed>>8)/16777216.0f;
    float ax=(sn(time*.19f+s*15)*17+cs(time*.11f+s*8)*7)*chaos*drift*4;
    float ay=(cs(time*.16f+s*13)*15+sn(time*.13f+s*6)*9)*chaos*drift*4;
    r->ax+=rounded(ax/pitch);r->ay+=rounded(ay/pitch);
    if(plates_on){
      float depth=(float)(hash(r->seed+7U)>>8)/16777216.0f;
      ax*=1+plate_drift*(.5f+depth*plate_depth);ay*=1+plate_drift*(.5f+depth*plate_depth);
      r->rotation=rounded(sn(time*.11f+s*11)*chaos*plate_rotation*2);
    }
    r->dx=ax;r->dy=ay;
    int ox=rounded(ax*copies/pitch),oy=rounded(ay*copies/pitch);
    // Migrating fields overwrite parts of their neighbors. The old field
    // remains elsewhere, making disagreement between copies visible.
    for(int y=max(0,r->y+oy);y<min(ny,r->y+r->h+oy);y++)for(int x=max(0,r->x+ox);x<min(nx,r->x+r->w+ox);x++)owners[y*COLS+x]=(unsigned char)i;
    if(chaos>.1f&&((r->seed&3)==0)){
      int fork=rounded(chaos*copies*7);
      for(int y=max(0,r->y-fork);y<min(ny,r->y+r->h/3);y++)for(int x=max(0,r->x+r->w/2);x<min(nx,r->x+r->w+fork);x++)owners[y*COLS+x]=(unsigned char)i;
    }
  }
  if(plates_on&&chaos>0){
    // Inverse-sampled, stepped masks are painted back-to-front. Sampling the
    // shared lattice preserves the chosen gap; free mode also moves vectors.
    int order_ids[REGIONS];for(int i=0;i<region_count;i++)order_ids[i]=i;
    for(int a=1;a<region_count;a++){int id=order_ids[a],j=a-1;unsigned key=hash(regions[id].seed+7U);while(j>=0&&hash(regions[order_ids[j]].seed+7U)>key){order_ids[j+1]=order_ids[j];j--;}order_ids[j+1]=id;}
    for(int order=0;order<region_count;order++){
      int i=order_ids[order];Region *r=&regions[i];float depth=(float)(hash(r->seed+7U)>>8)/16777216.0f;
      float scale=1+sn(time*.13f+depth*9)*chaos*plate_scale*.7f;
      float cx=r->x+r->w*.5f+r->dx/pitch,cy=r->y+r->h*.5f+r->dy/pitch;
      float rw=(r->rotation&1)?r->h:r->w,rh=(r->rotation&1)?r->w:r->h;
      float margin=chaos*plate_overlap*12;
      for(int y=max(0,(int)(cy-rh*scale*.5f-margin));y<min(ny,(int)(cy+rh*scale*.5f+margin));y++){
        int step=rounded(sn(y*.07f+depth*8)*chaos*plate_shear*12);
        for(int x=max(0,(int)(cx-rw*scale*.5f-margin)+step);x<min(nx,(int)(cx+rw*scale*.5f+margin)+step);x++)owners[y*COLS+x]=(unsigned char)i;
      }
      if(depth<plate_copies){int ox=rounded(chaos*(depth+.5f)*20),oy=rounded(chaos*plate_depth*17);for(int y=max(0,r->y+oy);y<min(ny,r->y+r->h/2+oy);y++)for(int x=max(0,r->x+ox);x<min(nx,r->x+r->w+ox);x++)owners[y*COLS+x]=(unsigned char)i;}
    }
  }
  offset_x=-pitch+sn(time*.14f)*pitch*.35f*chaos*drift;
  offset_y=-pitch+cs(time*.12f)*pitch*.35f*chaos*drift;
  // Run-length merging creates actual long vector segments, not a bitmap.
  for(int x=0;x<=nx;x++){
    int start=-1,last_id=0;
    for(int y=0;y<=ny;y++){
      int id=owner(x,y),yes=y<ny&&wall(x,y,0,id);
      if(start>=0&&(!yes||(!keep_gap&&id!=last_id))){emit(x,start,x,y,last_id);start=-1;}
      if(yes&&start<0){start=y;last_id=id;}
    }
  }
  for(int y=0;y<=ny;y++){
    int start=-1,last_id=0;
    for(int x=0;x<=nx;x++){
      int id=owner(x,y),yes=x<nx&&wall(x,y,1,id);
      if(start>=0&&(!yes||(!keep_gap&&id!=last_id))){emit(start,y,x,y,last_id);start=-1;}
      if(yes&&start<0){start=x;last_id=id;}
    }
  }
  if(diagonal_on){
    // Rotated coordinate lattice: spacing is measured perpendicular to lines.
    // This avoids the sqrt(2) narrowing caused by simply joining grid corners.
    const float root2=1.41421356237f,step=.70710678118f;
    for(int sign=-1;sign<=1;sign+=2)for(int k=-ny;k<nx+ny;k++){
      int start=-1,last_id=0;float ox=k*root2;
      int length=(nx+ny)*2;
      for(int t=0;t<=length;t++){
        float yy=t*step,xx=ox+sign*yy;
        int inside=xx>=0&&xx<nx&&yy>=0&&yy<ny;
        int id=inside?owner((int)xx,(int)yy):0;
        int yes=inside&&diagonal_region(id)&&((regions[id].seed&1)?1:-1)==sign;
        if(start>=0&&(!yes||(!keep_gap&&id!=last_id))){float sy=start*step;emit(ox+sign*sy,sy,xx,yy,last_id);start=-1;}
        if(yes&&start<0){start=t;last_id=id;}
      }
    }
  }
  if(layout_mode==2&&master_count){
    float fit=canvas_width/1376;if(canvas_height/768<fit)fit=canvas_height/768;
    float ox=(canvas_width-1376*fit)*.5f,oy=(canvas_height-768*fit)*.5f;
    for(int i=0;i<master_count;i++){
      Line l=master[i];float mx=(l.x1+l.x2)*.5f*fit+ox,my=(l.y1+l.y2)*.5f*fit+oy;
      int id=owner((int)(mx/pitch),(int)(my/pitch));if(procedural_region(id)||diagonal_region(id))continue;
      float dx=regions[id].dx,dy=regions[id].dy,scale=1;
      if(plates_on)scale+=sn(time*.13f+(float)id)*amount*plate_scale*.7f;
      if(line_count>=budget){overflow=1;break;}
      if(amount==0)lines[line_count++]=(Line){l.x1*fit+ox,l.y1*fit+oy,l.x2*fit+ox,l.y2*fit+oy};
      else lines[line_count++]=(Line){mx+(l.x1*fit+ox-mx)*scale+dx,my+(l.y1*fit+oy-my)*scale+dy,mx+(l.x2*fit+ox-mx)*scale+dx,my+(l.y2*fit+oy-my)*scale+dy};
    }
  }
}
