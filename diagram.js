const borderWidth = 1.4
const nodeRadius = 40

class C{
	constructor(ct){
		this.el = ct.append("div").classed("diagram",true)
		this.el.style("position","absolute")
			.style("z-index",1)
			.style("width","100%")
			.style("height","100%")

		this.svg = this.el.append('svg')
			 .style('-webkit-user-select','none')
			 .style('cursor','default')
			 .style("width","100%")
			 .style("height","100%")
	 let defs = this.svg.append('defs')
	 let arrow = defs.append("marker").attr("id","arrow")
			.attr('viewBox','0 0 10 10')
			.attr('refX',1)
			.attr('refY',5)
			.attr('orient','auto')
			.attr("markerWidth", 8)
			.attr("markerHeight", 8)
			.attr("markerUnits","userSpaceOnUse")
		arrow.append('path')
			.attr('d','M 0 0 L 10 5 L 0 10 z')
			.style('fill','#999')
		let rarrow = defs.append("marker").attr("id","arrow-reverse")
 			.attr('viewBox','0 0 10 10')
 			.attr('refX',1)
 			.attr('refY',5)
 			.attr('orient','auto-start-reverse')
 			.attr("markerWidth", 8)
 			.attr("markerHeight", 8)
 			.attr("markerUnits","userSpaceOnUse")
 		rarrow.append('path')
 			.attr('d','M 0 0 L 10 5 L 0 10 z')
 			.style('fill','#999')


		this.stage = this.svg.append("g")
		// this.stage.append("circle")
		// 	.attr("r",40)

		Object.assign(this,{
			simPaused:false,
			pos:[0,0],
			nodes:new Set(),
			links:new Set(),
			section:new Set(),
			displaySurround:true,
		})

		this.init()
	}

	init(){
		//mouse position
		this.svg.on("mousemove.pos",()=>{
			this.pos = d3.mouse(this.stage.node())
		})
		.on("mouseleave.pos",()=>{
			this.pos = [0,0]
		})

		//zoom and pan
		{
			let zoom = this.zoom = d3.zoom()
				.on("zoom", ()=>{
					let tf = d3.event.transform
					this.stage.attr("transform", "translate(" + tf.x + "," + tf.y +") scale(" + tf.k + ")")
				})
				.on("start", ()=>{
				})
				.on("end", ()=>{
				})
			this.svg.call(zoom)
				 .on("dblclick.zoom",null)

			//delay to get real client width and height
			d3.timeout(()=>{
				this.svg.call(zoom.translateTo,0,0)
			})
		}

		//enableDragToMove
		let me = this
		this.enableDragToMove = d3.drag()
			.container(this.stage.node())
			.subject(function(d){
				return d
			})
			.on("start", function(d){
				// subject.node.fx = d.node.x
				// subject.node.fy = d.node.y
				me.reheatSim()
				d3.event.on("drag", (d) => {
					let x = d3.event.x
					let y = d3.event.y
					d.x = d.fx = x
					d.y = d.fy = y
					me.updatePosition(d)
					me.reheatSim()
				})
				.on("end", (d)=>{
					d.fx = null
					d.fy = null
				});
			})

		this.setupSim()
	}

	resetZoom(){
		this.zoom.scaleTo(this.svg,1)
		this.zoom.translateTo(this.svg,0,0)
	}

	scaleBy(k){
		this.zoom.scaleTo(this.svg,d3.zoomTransform(this.svg.node()).k*k)
	}

	bindStorage(storage){
		this.storage = storage
		this.section.clear()
	}

	displayAll(quiet){
		for (let v of this.storage.verts()) {
			this.section.add(v)
		}
		if(!quiet)this.refresh()
	}

	isDisplay(v){
		return this.section.has(v)
	}

	display(v,quiet){
		this.section.add(v)
		if(!quiet)this.refresh()
	}

	undisplay(v,quiet){
		this.section.delete(v)
		if(!quiet)this.refresh()
	}

	getHoverNode(){
		for (let n of this.nodes) {
			if (n.hover){
				return n
			}
		}
		return null
	}

	getSelectedNodes(){
		let arr = []
		this.forEachSelectedNode((n)=>{
			arr.push(n)
		})
		return arr
	}

	getSelectedLinks(){
		let arr = []
		this.forEachSelectedLink((n)=>{
			arr.push(n)
		})
		return arr
	}

	forEachSelected(fn){
		this.forEachSelectedNode(fn)
		this.forEachSelectedLink(fn)
	}

	forEachNode(fn){
		for (let n of this.nodes) {
			fn(n)
		}
	}

	forEachLink(fn){
		for (let l of this.links) {
			fn(l)
		}
	}

	select(n,quiet){
		n.selected = true
		if (!quiet) this.refreshStyle()
	}

	deselect(n,quiet){
		n.selected = false
		if (!quiet) this.refreshStyle()
	}

	forEachSelectedNode(fn){
		for (let n of this.nodes) {
			if (n.selected){
				fn(n)
			}
		}
	}

	forEachSelectedLink(fn){
		for (let l of this.links) {
			if (l.selected){
				fn(l)
			}
		}
	}

	getAssociated(o){
		if (o.links) return o.links
		else return [o.source,o.target]
	}

	refresh(){
		let storage = this.storage
		let section = this.section
		let nodes = this.nodes,links = this.links

		//prune section
		{
			let _section = new Set([...section])
			for (let n of _section) {
				if (storage.getVert(n.id) != n){
					section.delete(n)
				}
			}
		}

		//cal verts,edges
		let verts = new Set(), edges = new Set()
		{
			for (let v of section) {
				verts.add(v)
				let ass = storage.getAssociated(v)
				ass.forEach(x=>{
					let v0 = storage.getVert(x.verts[0]), v1 = storage.getVert(x.verts[1])
					if (v0 == v1 || v0 == null || v1 == null) return
					let _v = [v0,v1].find(x=>x!=v)
					if (section.has(_v))
						edges.add(x)
					else if (this.displaySurround){
						verts.add(_v)
						edges.add(x)
					}
				})
			}
		}

		console.log("refresh  "+verts.size+" verts "+edges.size +" edges");

		//sync collection nodes-verts,links-edges
		{
			let _nodes = new Set(), _links = new Set()
			for (let n of nodes) {
				if (!verts.has(n.vert)) continue
				_nodes.add(n)
				n.virtual = !section.has(n.vert)
			}
			for (let v of verts) {
				let n = find(_nodes,n=>v==n.vert)
				if (n == null){
					_nodes.add({
						id:v.id,
						vert:v,
						links:[],
						x:this.pos[0],
						y:this.pos[1],
						virtual:!section.has(v),
					})
				}
			}

			for (let l of links) {
				if (!edges.has(l.edge)) continue
				_links.add(l)
			}
			for (let e of edges) {
				let l = find(_links,l=>e==l.edge)
				if (l == null){
					l = {
						id:e.id,
						source:null,
						target:null,
						edge:e,
					}
					_links.add(l)
				}
				syncLink(_nodes,l,e)
			}
			nodes = _nodes
			links = _links
		}
		this.nodes = nodes
		this.links = links

		//render
		let ns = this.stage.selectAll(".node")
			.data([...nodes],d=>d.id)
		{
			ns.exit().remove()
			let g = ns.enter().append("g").classed("node",true)
				.each(function(d){d.el = d3.select(this)})
				.call(this.enableDragToMove)
				.style("stroke-width",borderWidth)
				.on("mouseenter",d=>this.onNodeMouseEnter(d,d3.event))
				.on("mouseleave",d=>this.onNodeMouseLeave(d,d3.event))
				.on("click",d=>this.onNodeClick(d,d3.event))

			g.append('circle')
				.attr("r",nodeRadius)
				.attr("transform","translate(0,0)")

			g.append('text')
				.style("stroke-width",0)
				.style("fill","#666")
				.attr('text-anchor','middle')

			g.merge(ns)
			//this.stage.selectAll(".node")
				.select("circle")
				.style("opacity",d=>{
					if (d.virtual) return 0.7
					return 1
				})
				.style("stroke-dasharray",d=>{
					if (d.virtual) return "5,2"
					return ""
				})
		}


		let ls = this.stage.selectAll(".link")
			.data([...links],d=>d.id)
		{
			ls.exit().remove()
			let g = ls.enter().append("g").classed("link",true)
				.each(function(d){d.el = d3.select(this)})

			g.append("path").classed("line",true)
				.style("fill","transparent")
				.style('stroke',"#999")
			g.append("path").classed("bgline",true)
				.style('stroke-width',borderWidth*5)
				.style("fill","transparent")
				.style('stroke',"rgba(255,255,255,0)")
				.on("mouseenter",d=>this.onLinkMouseEnter(d,d3.event))
				.on("mouseleave",d=>this.onLinkMouseLeave(d,d3.event))
				.on("click",d=>this.onLinkClick(d,d3.event))
		}

		this.refreshName()
		this.refreshStyle()
		this.syncToSim()
		this.reheatSim()
	}

	refreshName(){
		let ns = this.stage.selectAll(".node")
		ns.select("text").each(function(d){
			let text = d3.select(this);
			let name = d.vert.name
			if (name == d.name) return
			d.name = name
			text.selectAll("tspan").remove()

			let names = d.name.split(' ');
			let l = names.length;
			let totalLength = 0;

			names.forEach((name,i)=>{
				let tspan = text.append('tspan')
					.style('font-size',14)
					.attr('x', 0)
					.html(name);

				tspan.attr('dy',15)
				totalLength += 15
			});

			text.attr('y',-(l+1)*15/2 + 5)
		});
	}

	refreshStyle(){
		let directed = this.storage.getMode("directed")
		let ns = this.stage.selectAll(".node")
		ns
			.style("stroke",d=>d.selected?"#f22":"#666")
			.style('fill',d=>d.color||"#ccc")
			.style("stroke-width",d=>d.hover?borderWidth*1.8:borderWidth)
			.style("font-weight",d=>d.hover?800:200)

		let ls = this.stage.selectAll(".link")
		ls.select(".line")
			.style("stroke",d=>d.selected?"#f22":"#666")
			.style("stroke-width",d=>d.hover?borderWidth*1.8:borderWidth)
			.style('marker-end',d=>this.isEndArrow(d)?'url(#arrow)':'')
			.style('marker-start',d=>this.isStartArrow(d)?'url(#arrow-reverse)':'')
	}

	updatePosition(n){
		let nodes,links
		if (n){
			nodes = new Set([n])
			links = new Set(n.links)
		}else{
			nodes = this.nodes
			links = this.links
		}

		for (let n of nodes) {
			n.el.attr("transform","translate("+n.x+","+n.y+")")
		}

		for (let l of links) {
			let n0 = l.source,n1 = l.target
			let x0 = n0.x, y0 = n0.y, x1 = n1.x, y1 = n1.y
			const r = nodeRadius
			let sp = 0, ep = 0
			if (this.isEndArrow(l)) ep = 8
			if (this.isStartArrow(l)) sp = 8

			let start,end
			{
				let dx = x1-x0
				let dy = y1-y0
				let len = Math.max(1,Math.sqrt(dx*dx + dy*dy))
				let n = [dx/len,dy/len]
				start = [n[0]*(r+sp),n[1]*(r+sp)]
				end = [n[0]*(len-r-ep),n[1]*(len-r-ep)]
			}
			let el = l.el
			el.attr("transform","translate("+x0+","+y0+")")
			el.select(".line").attr("d","M"+start[0]+" "+start[1]+" L "+end[0]+" "+end[1])
			el.select(".bgline").attr("d","M"+start[0]+" "+start[1]+" L "+end[0]+" "+end[1])
		}
	}

	isStartArrow(l){
		let directed = this.storage.getMode("directed")
		return directed&&l.edge.dir!=1
	}

	isEndArrow(l){
		let directed = this.storage.getMode("directed")
		return directed&&l.edge.dir!=-1
	}

	setupSim(){
		let forceLink = d3.forceLink()
			//.distance(200)
			.distance(function(link) {
			  return 140 + 30* Math.min(link.source.links.length, link.target.links.length)
			})
			.strength(function(link) {
			  return 0.2 / Math.min(link.source.links.length, link.target.links.length)
			})

		let forceCenter = this.forceCenter = d3.forceCenter()

		let forceCharge = d3.forceManyBody()
			.distanceMax(100)
			.distanceMin(nodeRadius)
			.strength(-1000)
			.theta(1)

		let sim = d3.forceSimulation()
			.force("charge", forceCharge)
			.force("link",forceLink)
			.force("center",forceCenter)
			.alphaDecay(0.05)
			.alpha(1)
			.alphaMin(0)
			//.alphaTarget(0.1)

		sim.on("tick",()=>{
			this.updatePosition()
		})

		this.sim = sim
		this.simPaused = false
	}

	syncToSim(){
		this.sim.nodes([...this.nodes])
		this.sim.force("link").links([...this.links])
	}

	reheatSim(){
		this.sim.alpha(1)
	}

	cooldownSim(){
		this.sim.alpha(this.sim.alphaMin())
	}

	resumeSim(){
		this.simPaused = false
		this.sim.restart()
	}

	pauseSim(){
		this.simPaused = true
		this.sim.stop()
	}

	simPaused(){
		return this.simPaused
	}

	onNodeMouseEnter(n){
		n.hover = true
		this.refreshStyle()
	}

	onNodeMouseLeave(n){
		n.hover = false
		this.refreshStyle()
	}

	onNodeClick(n,evt){
		this.onNodeOrLinkClick(n,evt)
		this.refreshStyle()
		evt.stopPropagation()
	}

	onLinkMouseEnter(n){
		n.hover = true
		this.refreshStyle()
	}

	onLinkMouseLeave(n){
		n.hover = false
		this.refreshStyle()
	}

	onLinkClick(l,evt){
		this.onNodeOrLinkClick(l,evt)
		this.refreshStyle()
		evt.stopPropagation()
	}

	onNodeOrLinkClick(o,evt){
		if (evt.shiftKey){
			if (o.selected){
				o.selected = false
			}else{
				o.selected = true
			}
		}else{
			if (!evt.shiftKey){
				this.forEachSelected((o)=>{
					o.selected = false
				})
				o.selected = true
			}
		}
	}

	lookAt(v){
		let n = find(this.nodes,n=>n.vert == v)
		if (!n) return
		let p = centroid(this.zoom.extent().apply(this.svg.node()))
		let tf = d3.zoomIdentity.translate(p[0],p[1]).scale(1).translate(-n.x,-n.y) //don't know why use negative
		this.svg.transition()
			.duration(1000)
			.call(this.zoom.transform,tf)
	}
}

function centroid(extent) {
  return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
}

function find(iterable,fn){
	for (let x of iterable) {
		let ok = fn(x)
		if (ok) return x
	}
	return null
}

function remove(arr,v){
	let i = arr.indexOf(v)
	if (i >= 0) arr.splice(i, 1)
}

function add(arr,v){
	let i = arr.indexOf(v)
	if (i < 0) arr.push(v)
}

function syncLink(nodes,l,e){
	let s = find(nodes,n=>n.vert.id==e.verts[0])
	let t = find(nodes,n=>n.vert.id==e.verts[1])

	if (l.source==s&&l.target == t) return

	if (l.source != null){
		remove(l.source.links,l)
		l.source = null
	}

	if (l.target != null){
		remove(l.target.links,l)
		l.target = null
	}

	if (s != null){
		add(s.links,l)
		l.source = s
	}

	if (t != null){
		add(t.links,l)
		l.target = t
	}
}

module.exports = C
