(function () {
  "use strict";
  const C = window.Civ;
  // Technology is arranged as three connected lanes. Only applied upgrades consume materials.
  const catalog = [
    {id:"agriculture",name:"Земледелие",branch:"food",tier:0,cost:18,prerequisites:[],materials:{},description:"Открывает развитие сельского хозяйства.",effect:""},
    {id:"farm_tools",name:"Улучшенные орудия",branch:"food",tier:1,cost:32,prerequisites:["agriculture"],materials:{wood:18,stone:6},description:"Повышает производство еды фермами на 25%.",effect:"farm"},
    {id:"irrigation",name:"Ирригация",branch:"food",tier:2,cost:55,prerequisites:["farm_tools"],materials:{wood:24,stone:18},description:"Повышает производство еды фермами ещё на 20%.",effect:"irrigation"},
    {id:"crop_rotation",name:"Севооборот",branch:"food",tier:3,cost:85,prerequisites:["irrigation"],materials:{wood:35,stone:20},description:"Улучшает эффективность сельского хозяйства ещё на 20%.",effect:"rotation"},

    {id:"woodworking",name:"Обработка древесины",branch:"industry",tier:0,cost:22,prerequisites:[],materials:{},description:"Открывает более эффективную обработку дерева.",effect:""},
    {id:"sawmill_tools",name:"Улучшения лесопилки",branch:"industry",tier:1,cost:38,prerequisites:["woodworking"],materials:{wood:25,stone:8},description:"Повышает производство древесины лесопилками на 30%.",effect:"lumber"},
    {id:"masonry",name:"Каменная кладка",branch:"industry",tier:2,cost:58,prerequisites:["sawmill_tools"],materials:{wood:20,stone:28},description:"Повышает добычу камня на 30% и открывает каменные шахты.",effect:"stone"},
    {id:"mining",name:"Горное дело",branch:"industry",tier:3,cost:95,prerequisites:["masonry"],materials:{wood:35,stone:40},description:"Открывает шахты железа и меди на соответствующих месторождениях.",effect:"mining"},

    {id:"writing",name:"Письменность",branch:"knowledge",tier:0,cost:30,prerequisites:[],materials:{},description:"Увеличивает ежедневное получение науки на 1 очко.",effect:"science"},
    {id:"mathematics",name:"Математика",branch:"knowledge",tier:1,cost:48,prerequisites:["writing"],materials:{},description:"Даёт ещё 1 очко науки каждый день.",effect:"mathematics"},
    {id:"wheel",name:"Колесо",branch:"knowledge",tier:2,cost:62,prerequisites:["mathematics"],materials:{},description:"Снижает содержание дорог на 25%.",effect:"roads"},
    {id:"engineering",name:"Инженерия",branch:"knowledge",tier:3,cost:105,prerequisites:["wheel"],materials:{wood:25,stone:35},description:"Увеличивает скорость строительства и вместимость складов.",effect:"engineering"}
  ];
  const branchNames={food:"СЕЛЬСКОЕ ХОЗЯЙСТВО",industry:"ДОБЫЧА И ПРОИЗВОДСТВО",knowledge:"НАУКА И ИНЖЕНЕРИЯ"};
  C.research={
    catalog,branchNames,points:0,activeId:null,progress:0,completed:[],
    getTech(id){return catalog.find(t=>t.id===id)||null;},
    isCompleted(id){return this.completed.includes(id);},
    missingPrerequisites(tech){return (tech.prerequisites||[]).filter(id=>!this.isCompleted(id));},
    sciencePerDay(){return 1+(this.isCompleted("writing")?1:0)+(this.isCompleted("mathematics")?1:0);},
    start(id){
      const tech=this.getTech(id);
      if(!tech)return {ok:false,message:"Технология не найдена."};
      if(this.isCompleted(id))return {ok:false,message:"Технология уже изучена."};
      if(this.activeId)return {ok:false,message:"Сначала заверши текущее исследование."};
      const missing=this.missingPrerequisites(tech);
      if(missing.length)return {ok:false,message:"Сначала изучи: "+missing.map(k=>this.getTech(k).name).join(", ")+"."};
      const resources=C.state.resources,materials=tech.materials||{};
      for(const key in materials)if((resources[key]||0)<materials[key])return {ok:false,message:"Недостаточно "+({wood:"древесины",stone:"камня"}[key]||key)+" для улучшения «"+tech.name+"»."};
      for(const key in materials)resources[key]-=materials[key];
      this.activeId=id;this.progress=0;C.emit("resources");C.emit("research");
      C.log("Начато исследование: "+tech.name+".");return {ok:true,message:"Исследование начато."};
    },
    daily(){
      this.points=Math.round((this.points+this.sciencePerDay())*10)/10;
      if(this.activeId&&this.points>=1){
        this.points=Math.round((this.points-1)*10)/10;
        const tech=this.getTech(this.activeId);
        if(!tech){this.activeId=null;this.progress=0;}
        else{
          this.progress=Math.min(tech.cost,this.progress+this.sciencePerDay());
          if(this.progress>=tech.cost){this.completed.push(tech.id);this.activeId=null;this.progress=0;C.log("Изучена технология: "+tech.name+". "+tech.description);}
        }
      }
      C.emit("research");
    },
    getEffect(effect){
      const factors={farm:1.25,irrigation:1.2,rotation:1.2,lumber:1.3,stone:1.3};
      let value=1;
      this.completed.forEach(id=>{const tech=this.getTech(id);if(tech&&tech.effect===effect)value*=factors[effect]||1;});
      if(effect==="roads")return this.isCompleted("wheel") ? 0.75 : 1;
      if(effect==="storage")return this.isCompleted("engineering")?100:0;
      return value;
    },
    exportData(){return {points:this.points,activeId:this.activeId,progress:this.progress,completed:this.completed.slice()};},
    importData(data){
      if(!data||typeof data!=="object")return;
      this.points=Math.max(0,Number(data.points)||0);
      this.completed=Array.isArray(data.completed)?data.completed.filter(id=>catalog.some(t=>t.id===id)):[];
      this.activeId=catalog.some(t=>t.id===data.activeId)&&!this.completed.includes(data.activeId)?data.activeId:null;
      const active=this.getTech(this.activeId);this.progress=active?Math.max(0,Math.min(active.cost,Number(data.progress)||0)):0;
    }
  };
})();