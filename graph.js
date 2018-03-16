class Graph{
	constructor(){
		this.vertMap = new Map()
		this.edgeMap = new Map()
		this.dispatch = d3.dispatch("change","vert:new","vert:del","vert:mod","edge:new","edge:del","edge:mod")
		this.id = 0
	}

	iterateVerts(){
		return this.vertMap.values()
	}

	iterateEdges(){
		return this.edgeMap.values()
	}

	forEachVert (fn){
		this.vertMap.forEach((value, key, map)=>{
			fn(value)
		})
	}

	forEachEdge (fn){
		this.edgeMap.forEach((value, key, map)=>{
			fn(value)
		})
	}

	hasVert(id){
		return this.vertMap.has(id)
	}

	hasEdge(id){
		return this.edgeMap.has(id)
	}

	getVert (id) {
		return this.vertMap.get(id)
	}

	getEdge (id) {
		return this.edgeMap.get(id)
	}

	undo(){
		//TODO
	}

	redo(){
		//TODO
	}

	//begin transaction
	begin(name){
		//TODO
	}

	//end transaction
	end(){
		//TODO
	}

	newVert () {
		this.id++
		let id = this.id

		let v = {}
		v.id = id
		v.edges = []
		this.vertMap.set(id,v)
		this.dispatch.call("vert:new",this,v)
		this.dispatch.call("change",this)
		return v
	}

	newEdge (a,b){
		if (a == undefined || b == undefined){
			console.log("a == undefined || b == undefined fail")
			return
		}

		this.id++

		let e = {}
		e.id = this.id
		e = this.resetEdge(e,a,b)

		this.edgeMap.set(id,e)
		this.dispatch.call("edge:new",this,e)
		this.dispatch.call("change",this)
		return e
	}

	delVertById (id) {
		let v = this.vertMap.get(id)
		this.vertMap.delete(id)
		//edge depend on vertex
		for (let eid of v.edges) {
			this.delEdgeById(eid)
		}
		this.dispacth.call("vert:del",this,v)
		this.dispatch.call("change",this)
	}

	delEdgeById (id) {
		let e = this.edgeMap.get(id)
		this.edgeMap.delete(id)

		let a = this.getVert(e.src)
		let b = this.getVert(e.dst)
		if (a) a.edges.splice(a.edges.indexOf(e.id), 1)
		if (b) b.edges.splice(b.edges.indexOf(e.id), 1)
		this.dispacth.call("edge:del",this,e)
		this.dispatch.call("change",this)
	}

	modVert(vert,key,value){
		switch (key) {
			case undefined||null||"":
				return
			case "id":
				console.log("can't mod id")
				return
			case "edges":
				console.log("can't mod edges")
				return
			default:
		}
		let oldValue = o[key]
		o[key] = value
		this.dispatch.call("vert:mod",this,vert,key,value,oldValue)
		this.dispatch.call("change",this)
	}

	modEdge(edge,key,value){
		switch (key) {
			case undefined||null||"":
				return
			case "id":
				console.log("can't mod id")
				return
			case "dst":
				console.log("can't mod dst")
				return
			case "src":
				console.log("can't mod src")
				return
			default:
		}
		let oldValue = o[key]
		o[key] = value
		this.dispatch.call("edge:mod",this,vert,key,value,oldValue)
		this.dispatch.call("change",this)
	}

	resetEdge(edge,a,b){
		//if there‘s already a edge between a and b, then don't create a new one.
		let shareid = a.edges.find((eid)=>{
			return b.edges.find((_eid)=>{
				return eid == _eid
			})
		})

		if (shareid){
			let e = this.getEdge(shareid)
			if (e.bidir == false && e.src == b.id && e.dst == a.id){
				this.modEdge(e,"bidir",true)
			}
			this.delEdgeById(edge.id)
			return e
		}

		let old = [edge.src,edge.dst]
		edge.src = a.id
		edge.dst = b.id
		a.edges.push(edge.id)
		b.edges.push(edge.id)

		this.dispatch.call("edge:mod",this,edge,"srcdst",[edge.src,edge.dst],old)
		this.dispatch.call("change",this)
		return edge
	}

	getVertsFromEdge(e){
		let ret = []
		ret[0] = this.getVert(e.src)
		ret[1] = this.getVert(e.dst)
		return ret
	}

	getEdgesFromVert(v){
		let arr = []
		for (let eid of v.edges) {
			arr.push(this.getEdge(eid))
		}

		return arr
	}

	nearbyVerts (v){
		let edges = this.getEdgesFromVert(v)
		let arr = []
		for (let e of edges) {
			let vs = this.getVertsFromEdge(e)
			for (let _v of vs) {
				if (_v != v) {
					arr.push(_v)
				}
			}
		}
		return arr
	}

	getJSON(){
		var jo = {
			verts:[...this.vertMap],
			edges:[...this.edgeMap],
			id:this.id,
		}
		return JSON.stringify(jo)
	}

	parse(json){
		var jo = JSON.parse(json)
		this.vertMap = new Map(jo.verts)
		this.edgeMap = new Map(jo.edges)
		this.id = jo.id
	}
}

module.exports = Graph
