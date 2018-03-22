const fs = require('fs')
const common = require("./common.js")

class IDGen{
	constructor(id,freeList){
		this.id = id||1 //do not use 0,start from 1
		this.freeList = freeList||new Array()
	}

	genID(){
		if (this.freeList.length > 0){
			return this.freeList.shift()
		}else{
			return this.id++
		}
	}

	regID(id){
		if (id < this.id){
			let i = this.freeList.findIndex(x=>x==id)
			if (i < 0){
				console.error("regID fail!");
			}else{
				this.freeList.splice(i,1)
			}
		}else{
			this.id++
		}
	}

	freeID(id){
		if (id == this.id - 1){
			this.id --
		}else{
			this.freeList.push(id)
		}
	}
}

class C{
	constructor(p){
		this.path = p

		this.idgen = new IDGen()
		this.vertMap = new Map()
		this.edgeMap = new Map()
		this.dispatch = d3.dispatch("changed","vert:new")
		this.colors = [
			"#777777", "#dc3912", "#ff9900", "#109618", "#990099",
			"#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395",
			// "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300",
			// "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"
		]
		{
			for (let i = 0; i < this.colors.length; i++) {
				let c = d3.hsl(this.colors[i])
				c.l -= 0.2
				this.colors[i] = c + ""
			}
		}

		this.edgeMode = {
			multi:false,
			directed:false,
			loop:false,// A loop is an edge (directed or undirected) that connects a vertex to itself
		}
	}

	loadTestData(){
		this.edgeMode.directed = true

		function getRandom(arr) {
		  return arr[Math.floor(Math.random() * Math.floor(arr.length))]
		}
		for (let i = 0; i < 10; i++) {
			let out = {}
			this.newVert(null,out)
			let vert = out.vert
			this.setName(vert,"Sara Green " + i)

			let vs = Array.from(this.verts())
			let arr = []
			for (let j = 0; j < Math.random()*Math.min(vs.length,2); j++) {
				arr.push(getRandom(vs))
			}
			for (let v of arr) {
				let out = {}
				this.newEdge(null,vert,v,out)
				if (out.edge) out.edge.dir = 1
			}
		}
	}

	load(p){
		return new Promise((resolve,reject) => {
			fs.readFile(p, (err, data) => {
				console.log(err);
				if (err) reject(err)
				let jo
				try {
					jo = JSON.parse(data)
				}catch(err){
					reject(err)
					return
				}
				this.idgen = new IDGen(jo.idgen.id,jo.idgen.freeList)
				this.vertMap = new Map(jo.vertMap)
				this.edgeMap = new Map(jo.edgeMap)
				this.edgeMode = jo.edgeMode
				this.colors = jo.colors
				this.changed = false

				resolve()
			})
		})
	}

	save(p){
		if (!p) p = this.path
		if (!p) return
		console.log('Data saved to ' + p +'.')

		var jo = {
			vertMap:[...this.vertMap],
			edgeMap:[...this.edgeMap],
			edgeMode:this.edgeMode,
			idgen:{
				id:this.idgen.id,
				freeList:this.idgen.freeList,
			},
			colors:this.colors,
		}

		fs.writeFile(p, JSON.stringify(jo), (err) => {
			if (err){
				alert(err)
				return
			}
			this.path = p
			this.markAsUnchanged()
		})
	}

	getVert(id){
		if (id) return this.vertMap.get(id)
		return null
	}

	getEdge(id){
		if (id) return this.edgeMap.get(id)
		return null
	}

	getColor(o){
		return this.colors[o.color]
	}

	verts(){
		return this.vertMap.values()
	}

	edges(){
		return this.edgeMap.values()
	}

	getAssociated(o){
		if (o.edges)
			return o.edges.map(id => this.getEdge(id))
		else if (o.verts)
			return o.verts.map(id => this.getVert(id))
		return []
	}

	getSharedAssociated(o0,o1){
		let arr0 = this.getAssociated(o0)
		let arr1 = this.getAssociated(o1)
		return arr0.filter(function(n) {
    	return arr1.indexOf(n) !== -1
		})
	}

	getAdjacent(o){
		let arr = []
		for (let r of this.getAssociated(o)) {
			arr = arr.concat(this.getAssociated(r).filter(_o => o != _o))
		}
		return arr
	}

	precheckEdge(v0,v1){
		if (!v0||!v1||v0.deleted||v1.deleted)  return false

		let m = this.edgeMode
		if (!m.multi){
			let es = this.getSharedAssociated(v0,v1)
			if(es.length!=0) return false
		}

		if (!m.loop){
			if (v0==v1) return false
		}

		return true
	}

	//Change of mode effects future, not past.
	setMode(k,v){
		let m = this.edgeMode
		let _v = m[k]
		m[k] = v
		this.markAsChanged()
		return ()=>{return this.setMode(k,_v)}
	}

	customizeColor(i,c){
		let _c = this.colors[i]
		this.colors[i] = c
		this.markAsChanged()
		return ()=> this.customizeColor(i,_c)
	}

	getMode(k){
		let m = this.edgeMode
		return m[k]
	}

	newVert (v,out) {
		if (v) this.idgen.regID(v.id)
		else{
			v = {
				id:this.idgen.genID(),
				name:"Untitled",
				content:"",
				color:0,
				edges :[],
			}
		}
		v.deleted = false
		this.vertMap.set(v.id,v)
		if (out) out.vert = v

		this.markAsChanged()
		this.dispatch.call("vert:new",this,v)
		return ()=>this.delVert(v)
	}

	delVert (v){
		let revs = []
		if (v.edges.length>0){
			let copy = v.edges.slice(0)
			for (let eid of copy) {
				let e = this.getEdge(eid)
				if (!e) continue
				let rev = this.delEdge(e)
				revs.push(rev)
			}
		}
		v.deleted = true
		this.idgen.freeID(v.id)
		this.vertMap.delete(v.id)
		revs.push(()=>this.newVert(v))
		this.markAsChanged()
		return ()=>common.callRevs(revs)
	}

	newEdge (e,v0,v1,out) {
		if (!this.precheckEdge(v0,v1)) {
			if (out) out.edge = null
			return ()=>{}
		}
		if (e) this.idgen.regID(e.id)
		else{
			e = {
				id:this.idgen.genID(),
				name:"",
				content:"",
				color:0,
				dir:0,//0,1,-1
				verts:new Array(2),
			}
		}
		e.deleted = false
		this._setEnds(e,v0,v1)
		this.edgeMap.set(e.id,e)
		if (out) out.edge = e
		this.markAsChanged()
		return ()=> this.delEdge(e)
	}

	delEdge (e){
		let revs = []
		let v0 = this.getVert(e.verts[0])
		let v1 = this.getVert(e.verts[1])
		this._setEnds(e,null,null)

		e.deleted = true
		this.idgen.freeID(e.id)
		this.edgeMap.delete(e.id)
		this.markAsChanged()
		return ()=>this.newEdge(e,v0,v1)
	}

	setEnds(e,v0,v1){
		let [_v0,_v1] = this._setEnds(e,null,null)

		if (!this.precheckEdge(v0,v1)) {
			this._setEnds(e,_v0,_v1)
			return ()=>{}
		}

		this._setEnds(e,v0,v1)
		this.markAsChanged()
		return ()=> this.setEnds(e,_v0,_v1)
	}

	_setEnds(e,v0,v1){
		let _v0 = this.getVert(e.verts[0])
		let _v1 = this.getVert(e.verts[1])
		if (_v0) remove(_v0.edges,e.id)
		if (_v1) remove(_v1.edges,e.id)

		e.verts[0] = v0?v0.id:null
		e.verts[1] = v1?v1.id:null
		if (v0) add(v0.edges,e.id)
		if (v1) add(v1.edges,e.id)
		return [_v0,_v1]
	}

	setDir(o,dir){
		if (!o.verts) return false
		if (!this.edgeMode.directed) dir = 0 //must
		let _dir = o.dir //0,1,-1
		o.dir = dir
		this.markAsChanged()
		return ()=> this.setDir(o,_dir)
	}

	setName(o,name){
		let _name = o.name
		o.name = name
		this.markAsChanged()
		return ()=> this.setName(o,_name)
	}

	setColor(o,color){
		let _color = o.color
		o.color = color
		this.markAsChanged()
		return ()=>this.setColor(o,_color)
	}

	setContent(v,content){
		let _content = o.content
		o.content = content
		return ()=> this.setContent(o,_content)
	}

	markAsChanged(){
		this.changed = true
		this.dispatch.call("changed",this)
	}

	markAsUnchanged(){
		this.changed = false
		this.dispatch.call("changed",this)
	}
}

function remove(arr,v){
	let i = arr.indexOf(v)
	if (i >= 0) arr.splice(i, 1)
}

function add(arr,v){
	let i = arr.indexOf(v)
	if (i < 0) arr.push(v)
}


module.exports = C
