const {ipcRenderer} = require('electron')
const d3 = require("d3")
const fs = require('fs')
const path = require("path")
const autoComplete = require('js-autocomplete')
const Storage = require("./storage.js")
const Diagram = require("./diagram.js")
const common = require("./common.js")

let storage
let diagram
let recorder
let msg

async function init(){
	//document
	let body = d3.select("body")
	body.html("")


	//storage
	storage = new Storage()
	let url = new URL(window.location.href)
	let p = url.searchParams.get("path")
	if (p != ""){
		body.html("loading...")
		try{
			await storage.load(p)
		}catch(err){
			body.html("<h1>load fail</h1>"+err)
			return
		}
		body.html("")
	}else{
		// storage.loadTestData()
		storage.newVert()
	}
	storage.dispatch.on("changed",refreshTitle)
	refreshTitle()


	//diagram
	diagram = new Diagram(body)
	diagram.bindStorage(storage)
	diagram.displayAll()
	storage.dispatch.on("vert:new",v=>{
		diagram.display(v,true)
	})

	//recorder
	recorder = new Recorder()
	recorder.record("Open",common.emptyRev)

	//cmds
	ipcRenderer.on("cmd", (event,cmd) => {
		let fn = global[cmd]
		if (!fn){
			console.warn("Command " + cmd + " not implmented.")
		}else{
			fn()
		}
	})

	switchHistoryPanel()
}

function refreshTitle(){
	let p = storage.path
	if(!p) {
		document.title = "new ..."
		return
	}
	let name = path.basename(p);
	let dir = path.dirname(p);
	let star = "*"
	if (!storage.changed){
		star = ""
	}
	document.title = name + star + " -- " + dir
}

document.addEventListener("DOMContentLoaded",init)

class Recorder{
	constructor(){
		this.stack0 = []
		this.stack1 = []
		this.dispatch = d3.dispatch("changed")
	}

	numUndos(){
		return this.stack0.length
	}

	numRedos(){
		return this.stack1.length
	}

	isLast(record){
		let l = this.stack0.length
		if (l==0) return null == record
		else return this.stack0[l-1] == record
	}

	record(name,rev){
		if (this.stack0.length>30) this.stack0.shift()
		this.stack0.push({
			type:0,
			name:name,
			rev:rev,
		})
		while (this.stack1.length) { this.stack1.pop() }
		this.dispatch.call("changed")
	}

	undo(){
		if (this.stack0.length==0) return
		let r = this.stack0.pop()
		r.type = 1
		r.rev = r.rev()
		this.stack1.push(r)
		this.dispatch.call("changed")
	}

	redo(){
		if (this.stack1.length==0) return
		let r = this.stack1.pop()
		r.type = 0
		r.rev = r.rev()
		this.stack0.push(r)
		this.dispatch.call("changed")
	}

	markAsSaved(){
		let l = this.stack0.length
		if (l == 0 ) return null
		let cr = this.stack0[l-1]

		for (let r of this.stack0) {
			r.saved = false
		}

		for (let r of this.stack1) {
			r.saved = false
		}

		cr.saved = true
		this.dispatch.call("changed")
	}

	jump(record){
		if (record == null){
			while (this.stack0.length) {
				this.undo()
			}
		}else if (record.type == 0){
			while (this.stack0.length&&this.stack0[this.stack0.length-1]!=record) {
				this.undo()
			}
		}else if(record.type == 1){
			while (this.stack1.length){
				this.redo()
				if(this.stack0[this.stack0.length-1]==record){
					break
				}
			}
		}
	}

	list(){
		let arr = []
		for (let r of this.stack0) {
			arr.push(r)
		}

		for (let i = this.stack1.length-1; i>=0; i--) {
			arr.push(this.stack1[i])
		}
		return arr
	}
}

function switchHistoryPanel(){
	let panel = d3.select("body").select(".history-panel")
	if (!panel.empty()){
		panel.remove()
		return
	}

	panel = d3.select("body").append("div").classed("history-panel",true)
		.style("z-index",100)
		.style("position","absolute")
		.style("right",0)
		.style("top",0)
		.style("width","200px")
		.style("height","auto")
		.style("box-shadow","0px 0px 5px 1px rgba(0,0,0,0.4)")

	panel.append("div").classed("panel-header",true)
		.style("height","18px")
		.style("line-height","18px")
		.style("padding","2px 5px")
		.html("History")

	let body = panel.append("div")
		.style("height","200px")
		.style("overflow-y","auto")

	let refresh = function(){
		let list = recorder.list()
		//list.unshift(null)
		let its = body.selectAll("div")
			.data(list)

		its.exit().remove()
		its.enter().append("div").classed("item",true)
			.style("height","18px")
			.style("line-height","18px")
			.style("padding","2px 5px")
			.style("-webkit-user-select","none")
			.style("cursor","default")
			.on("mouseenter",function(d){
				if (recorder.isLast(d)) return
				d3.select(this).classed("hover",true)
			})
			.on("mouseleave",function(d){
				if (recorder.isLast(d)) return
				d3.select(this).classed("hover",false)
			})
			.on("click",function(d){
				recorder.jump(d)
				diagram.refresh()
			})
			.merge(its)
			.classed("undo",d=>d.type==0)
			.classed("redo",d=>d.type==1)
			.classed("hover",false)
			.classed("selected",d=>recorder.isLast(d))
			.html(d=>d.name + (d.saved?" (save)":""))

		let h = body.node().scrollHeight - body.node().offsetHeight
		let s = body.node().scrollTop
		if (h-s<50){
			body.node().scrollTop = h
		}
	}

	recorder.dispatch.on("changed",refresh)

	refresh()
}


function saveAs(){
	let p = ipcRenderer.sendSync("showSaveDialog",storage.path)
	storage.save(p)
	recorder.markAsSaved()
}

function save(){
	if (!storage.path){
		saveAs()
		return
	}
	storage.save()
	recorder.markAsSaved()
}

function undo(){
	if (recorder.numUndos()<=1) return
	recorder.undo()
	diagram.refresh()
}

function redo(){
	if (recorder.numRedos()==0) return
	recorder.redo()
	diagram.refresh()
}

function del(){
	let revs = []
	diagram.forEachSelectedLink(l=>{
		let rev = storage.delEdge(l.edge)
		revs.push(rev)
	})

	diagram.forEachSelectedNode(n=>{
		let rev = storage.delVert(n.vert)
		revs.push(rev)
	})

	if (revs.length==0){
		showMsgNone()
		return
	}

	recorder.record("Delete",()=>common.callRevs(revs))
	diagram.refresh()
}

function newVert(reverse){
	let revs = []
	let out = {}
	revs.push(storage.newVert(null,out))
	let v = out.vert
	diagram.display(v,true)

	let directed = storage.getMode("directed")
	diagram.forEachSelectedNode(n=>{
		let out = {}
		revs.push(storage.newEdge(null,n.vert,v,out))
		if (!out.edge) return
		if (directed){
			if (reverse) out.edge.dir = -1
			else out.edge.dir = 1
		}
	})

	recorder.record("New Vertex "+ (reverse?"(Rerverse)":""),()=>common.callRevs(revs))
	diagram.refresh()
}

function newVertR(){
	newVert(true)
}

function newEdge(reverse){
	let mode = storage.mode
	let nodes = []
	diagram.forEachSelectedNode(n=>{
		nodes.push(n)
	})
	if (nodes.length==0){
		showMsgNoneVertex()
		return
	}

	let hover = diagram.getHoverNode()
	if (!hover) return showMsg("You must point on a vertex.")

	let revs = []
	diagram.forEachSelectedNode(n=>{
		let out = {}
		let rev = storage.newEdge(null,n.vert,hover.vert,out)
		let e = out.edge
		if (!e) return
		revs.push(rev)
		if (storage.getMode("directed")){
			if (reverse){
				revs.push(storage.setDir(e,-1))
			}else{
				revs.push(storage.setDir(e,1))
			}
		}
	})

	if (revs.length==0) return //new edge can fail.

	recorder.record("New Edge"+(reverse?" (Rerverse)":""),()=>common.callRevs(revs))
	diagram.refresh()
}

function newEdgeR(){
	newEdge(true)
}

function graphDirMode(){
	let directed = storage.getMode("directed")
	directed = !directed
	let rev = storage.setMode("directed",directed)
	recorder.record("Graph Directed/Undirected",rev)
	showMsg("Graph: " + (directed?"Directed":"Undirected"))
	diagram.refreshStyle()
}

function edgeDir(){
	let edges = new Set()
	diagram.forEachSelectedLink(l=>{
		edges.add(l.edge)
	})

	if (edges.size==0) return showMsgNoneEdge()
	edges = [...edges]
	let dir = edges[0].dir

	switch (dir) {
		case 0:
			dir = 1
			break;
		case 1:
			dir = -1
			break;
		case -1:
			dir = 0
			break;
	}

	let revs=[]
	for (let e of edges) {
		let [v0,v1] = storage.getAssociated(e)
		revs.push(storage.setDir(e,dir))
	}
	recorder.record("Edge Direction",()=>common.callRevs(revs))
	diagram.refreshStyle()
}

function autoLayout(){
	if (diagram.simPaused){
		diagram.resumeSim()
		showMsg("Auto layout: Resumed")
	}else{
		diagram.pauseSim()
		showMsg("Auto layout: Paused")
	}
}

function rename(){
	if(isVertNameBoxOpened()) return
	let nodes = diagram.getSelectedNodes()
	let n = nodes.find(_=>true)
	if (!n) return showMsgNoneVertex()
	let pm = openVertNameBox(n.name)
	pm.then(name=>{
		let revs = []
		nodes.forEach(n=>{
			revs.push(storage.setName(n.vert,name))
		})
		recorder.record("Rename",()=>common.callRevs(revs))
		diagram.refreshName()
	}).catch(()=>{})
}

function showOrHideVert(){
	let verts = []
	let displayed = true
	diagram.forEachSelectedNode(n=>{
		verts.push(n.vert)
		if (n.virtual) displayed = false
	})
	if (verts.length==0) {
		showMsgNoneVertex()
		return
	}
	for (let v of verts) {
		if (displayed)
			diagram.undisplay(v,true)
		else
			diagram.display(v,true)
	}
	diagram.refresh()
}

function showVertAlone(){
	let verts = []
	diagram.forEachSelectedNode(n=>{
		verts.push(n.vert)
	})
	if (verts.length==0) {
		showMsgNoneVertex()
		return
	}
	diagram.undisplayAll(true)
	for (let v of verts) {
		diagram.display(v,true)
	}
	diagram.refresh()
}

function displayAdjacent(){
	let d = diagram.displaySurround = !diagram.displaySurround
	diagram.refresh()
	showMsg("Display Adjacent: " + (d?"True":"False"))
}

function findVert(){
	if(isVertFindingOpened()) return
	let pm = openVertFinding()
	pm.then(v=>{
		if (!v) return
		if(!diagram.isDisplay(v))
			diagram.display(v)
		diagram.lookAt(v)
	}).catch(()=>{})
}

function selectAll(){
	diagram.forEachNode((n)=>{
		diagram.select(n,true)
	})
	diagram.forEachLink((l)=>{
		diagram.select(l,true)
	})
	diagram.refreshStyle()
}

function unselect(){
	diagram.forEachNode((n)=>{
		diagram.deselect(n,true)
	})
	diagram.forEachLink((l)=>{
		diagram.deselect(l,true)
	})
	diagram.refreshStyle()
}

function switchSelectionOutset(){
	switchSelection(false)
}

function switchSelectionInset(){
	switchSelection(true)
}

function switchSelection(inset){
	let links = new Set()
	let nodes = new Set()
	diagram.forEachSelectedNode((n)=>{
		diagram.deselect(n,true)
		nodes.add(n)
	})
	diagram.forEachSelectedLink((l)=>{
		diagram.deselect(l,true)
		links.add(l)
	})

	let set0,set1
	if (links.size > nodes.size){
		set0 = nodes
		set1 = links
	}else{
		set0 = links
		set1 = nodes
	}

	for (let o of set1) {
		let ass = diagram.getAssociated(o)
		for (let _o of ass) {
			if (!inset)
				set0.add(_o)
			else {
				let _ass = diagram.getAssociated(_o)
				if (_ass.every(__o=>set1.has(__o))){
					set0.add(_o)
				}
			}
		}
	}

	for (let o of set0) {
		diagram.select(o,true)
	}

	diagram.refreshStyle()
}

function resetZoom(){
	diagram.resetZoom()
}

function zoomin(){
	diagram.scaleBy(2)
}

function zoomout(){
	diagram.scaleBy(1/2)
}

function customizeColors(){
	let layer = d3.select("body").select(".color-customize")
	if(!layer.empty()){
		layer.remove()
	}else{
		layer = d3.select("body").append("div")
			.classed("color-customize",true)
			.style("left",0)
			.style("right",0)
			.style("top",0)
			.style("bottom",0)
			.style("position","absolute")
			.style("z-index",80)
			.style("background","rgba(0,0,0,0.5)")

		let box = layer.append("div").classed("body",true)
			.style("position","relative")
			.style("top","80px")
			.style("left","50%")
			.style("width","200px")
			.style("margin-left","-110px")
			.style("padding","10px 20px")
			.style("border-radius","3px")
			.style("box-shadow","0px 0px 5px 1px rgba(0,0,0,0.4)")

		layer.on("click",()=>{layer.remove()})
		box.on("click",()=>{d3.event.stopPropagation()})

		let its = box.selectAll("div")
			.data(storage.colors)

		let _its = its.enter().append("div")
			.style("margin","2px")
			.style("height","26px")
		_its.append("div").classed("label",true)
			.style("display","inline-block")
			.style("width","60px")
			.html((d,i)=>"Color "+i)
		_its.append("input").classed("input",true)
			.attr("type","color")
			.style("height","20px")
			.on("change",function(_,i){
				let c = d3.color(this.value)
				let rev = storage.customizeColor(i,c+"")
				recorder.record("Customize Color "+ i,rev)
			})

		its = _its.merge(its)
		let refresh = function(){
			its.select(".input")
				.each(function(d,i){
					let c = d3.color(storage.colors[i])
					let hex = common.rgbToHex(c.r,c.g,c.b)
					this.value = hex
				})
			diagram.refreshStyle()
		}
		storage.dispatch.on("changed",refresh)
		refresh()
	}
}

function switchColor(){
	let revs = []
	let nodes = diagram.getSelectedNodes()
	if (nodes.length ==0) {
		showMsgNoneVertex()
		return
	}
	let c = nodes[0].vert.color
	c++
	if (c==10) c=1
	for (let n of nodes) {
		revs.push(storage.setColor(n.vert,c))
	}
	recorder.record("Switch Color",()=>common.callRevs(revs))
	diagram.refreshStyle()
}

{
	for (let i = 0; i < 10; i++) {
		global["color"+i] = function(){
			let revs = []
			diagram.forEachSelectedNode(n=>{
				let v = n.vert
				revs.push(storage.setColor(v,i))
			})
			recorder.record("Color "+ i,()=>common.callRevs(revs))
			diagram.refreshStyle()
		}
	}
}

/***********************************************************/

function showMsgNone(){
	showMsg("None of the vertices or edges were selected.")
}

function showMsgNoneVertex(){
	showMsg("None of the vertices were selected.")
}

function showMsgNoneEdge(){
	showMsg("None of the edges were selected.")
}

function isVertNameBoxOpened(){
	return !d3.select("body").select(".rename-box").empty()
}

function openVertNameBox(str){
	let box = d3.select("body").select(".rename-box")
	if (!box.empty()){
		box.remove()
	}

	box = d3.select("body").append("div").classed("rename-box",true)
		.style("position","absolute")
		.style("width","100%")
		.style("height","100%")
		.style("top","0px")
		.style("z-index",100)
		.style("background","rgba(0,0,0,0.5)")
	let ibox = box.append("div").classed("body",true)
		.style("position","absolute")
		.style("left","30%")
		.style("right","30%")
		.style("height","auto")
		.style("top","50px")
		.style("border-radius","4px")
		.style("padding","10px")
		.style("overflow","hidden")

	//Title
	{
		ibox.append("div")
			.style("position","relative")
			.style("width","100%")
			.style("height","auto")
			.style("font-size","12px")
			.style("padding-bottom","5px")
			.style("box-sizing","border-box")
			.style("color","#666666")
			.html("Rename")
	}

	let input = ibox.append("input")
		.attr("id","input")
		.attr("type","text")
		.style("position","relative")
		.style("width","100%")
		.style("height","28px")
		.style("box-sizing","border-box")

	let activeElement = document.activeElement
	input.node().focus()
	input.attr("value",str)
	input.node().setSelectionRange(0,100)

	//let selected = null
	let ac = enableNodeSuggestion("#input",function(event, term, vert){
		//selected = vert
	})

	return new Promise((resolve,reject)=>{
		let close = ()=>{
			box.remove()
			ac.destroy()
			activeElement.focus()
		}
		input.on("keydown",()=>{
			if (d3.event.key == "Escape"){
				reject()
				close()
			}else if (d3.event.key == "Enter"){
				if (d3.event.metaKey || d3.event.ctrlKey || d3.event.shiftKey || d3.event.altKey) return
				resolve(input.node().value)
				close()
			}
		})

		ibox.on("click",()=>{
			d3.event.stopPropagation()
		})

		box.on("click",()=>{
			reject()
			close()
		})
	})
}

function isVertFindingOpened(){
	return !d3.select("body").select(".vertex-find").empty()
}

function openVertFinding(){
	let box = d3.select("body").select(".vertex-find")
	if (!box.empty()){
		box.remove()
	}

	box = d3.select("body").append("div").classed("vertex-find",true)
		.style("position","absolute")
		.style("width","100%")
		.style("height","100%")
		.style("background-color","rgba(0,0,0,0.5)")
		.style("top","0px")
		.style("z-index",100)
	let ibox = box.append("div").classed("body",true)
		.style("position","absolute")
		.style("left","30%")
		.style("right","30%")
		.style("height","auto")
		.style("top","50px")
		.style("border-radius","4px")
		.style("padding","10px")
		.style("overflow","hidden")

	//Title
	{
		ibox.append("div")
			.style("position","relative")
			.style("width","100%")
			.style("height","auto")
			.style("font-size","12px")
			.style("padding-bottom","5px")
			.style("box-sizing","border-box")
			.html("Find:")
	}

	let input = ibox.append("input")
		.attr("id","input")
		.attr("type","text")
		.style("position","relative")
		.style("width","100%")
		.style("height","28px")
		.style("box-sizing","border-box")

	let activeElement = document.activeElement
	input.node().focus()

	let selected = null
	let ac = enableNodeSuggestion("#input",function(event, term, item){
		selected = storage.getVert(parseInt(item.dataset.id))
	})

	return new Promise((resolve,reject)=>{
		let close = ()=>{
			box.remove()
			ac.destroy()
			activeElement.focus()
		}
		input.on("keydown",()=>{
			if (d3.event.key == "Escape"){
				reject()
				close()
			}else if (d3.event.key == "Enter"){
				if (d3.event.metaKey || d3.event.ctrlKey || d3.event.shiftKey || d3.event.altKey) return
				resolve(selected)
				close()
			}
		})

		ibox.on("click",()=>{
			d3.event.stopPropagation()
		})

		box.on("click",()=>{
			reject()
			close()
		})
	})
}

function enableNodeSuggestion(id,onSelect){
	return new autoComplete({
		selector: id,
		minChars:1,
		delay:0,
		cache:false,
		source: function(term, suggest){
			term = term.toLowerCase();
			let suggestions = []
			for (let v of storage.verts()) {
				if(~v.name.toLowerCase().indexOf(term.toLowerCase()))
					suggestions.push(v)
			}
			suggest(suggestions)
		},
		renderItem: function (vert, search){
			search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
			let re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
			let color = vert.color||"#666"
			return '<div class="autocomplete-suggestion" data-id="'+vert.id+'" data-val="' + vert.name +
				'" style="padding:3px 3px;vertical-align:middle;">' +
				'<span class="suggestion-type" style="background-color:'+color+'"></span>' +
				vert.name.replace(re, "<span>$1</span>") + '</div>';
		},
		onSelect:onSelect,
	})
}


function showMsg(t){
	if (!msg){
		msg = {}
		msg.el = d3.select("body").append("div").classed("msg",true)
			.style("width","auto")
			.style("height","auto")
			.style("display","block")
			.style("position","absolute")
			.style("z-index",200)
			.style("top","30px")
			.style("left","50%")

		msg.el.append("div").classed("body",true)
			.style("position","relative")
			.style("left","-50%")
			.style("padding","10px 20px")
			.style("border-radius","3px")
			.style("box-shadow","0px 0px 5px 1px rgba(0,0,0,0.4)")

		msg.setText = function(t){
			if (this.timer) this.timer.stop()
			msg.timer = d3.timer(()=>{
				this.el.remove()
				this.timer.stop()
				msg = null
			},3000);
			this.el
				.interrupt()
				.style("opacity",1)
				.transition()
				.delay(2000)
				.duration(1000)
				.style("opacity",0)
			this.el.select("div").html(t)
		}
	}
	msg.setText(t)
}

function donothing(){

}
